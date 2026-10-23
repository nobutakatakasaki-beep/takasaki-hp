/**
 * 不正アクセス・大量送信への備え
 * ------------------------------------------------------------------
 * ・管理画面：合言葉を総当たりされないよう、失敗回数で一時ロックする
 * ・お問合せ：同一回線からの連続送信に上限を設ける
 *
 * テーブルは初回アクセス時に自動で作られるので、事前の準備は要らない。
 * データベースが使えない状況でも、認証そのものは通常どおり動く
 * （制限が効かなくなるだけで、鍵が無い人が入れるようにはならない）。
 */

/* ---- 方針 ---- */
const AUTH_MAX_FAILS = 8; // 合言葉をこの回数まちがえたら
const AUTH_WINDOW_MIN = 15; // この時間内で数える
const AUTH_LOCK_MIN = 30; // この時間ロックする

const POST_MAX_SHORT = 3; // 10分あたりの送信上限
const POST_MAX_DAY = 12; // 24時間あたりの送信上限

let tablesReady = false;

export async function ensureTables(db) {
  if (tablesReady || !db) return;
  try {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS auth_attempts (
           ip TEXT PRIMARY KEY,
           fails INTEGER NOT NULL DEFAULT 0,
           last_at TEXT NOT NULL,
           blocked_until TEXT
         )`
      )
      .run();
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS post_throttle (ip TEXT NOT NULL, at TEXT NOT NULL)`
      )
      .run();
    await db
      .prepare(`CREATE INDEX IF NOT EXISTS idx_throttle ON post_throttle (ip, at)`)
      .run();
    tablesReady = true;
  } catch {
    /* 作れなくても処理は続行する */
  }
}

/* ===== 管理画面：合言葉の総当たり対策 ===== */

/** いまロック中か。ロック中なら残り秒数を返す */
export async function authLockState(db, ip) {
  if (!db || !ip) return { locked: false };
  try {
    const row = await db
      .prepare("SELECT blocked_until FROM auth_attempts WHERE ip = ?")
      .bind(ip)
      .first();
    if (!row || !row.blocked_until) return { locked: false };
    const until = Date.parse(row.blocked_until);
    if (!until || until <= Date.now()) return { locked: false };
    return { locked: true, retryAfter: Math.ceil((until - Date.now()) / 1000) };
  } catch {
    return { locked: false };
  }
}

/** 合言葉を間違えた記録。上限を超えたらロックする */
export async function recordAuthFail(db, ip) {
  if (!db || !ip) return;
  const now = new Date();
  const nowIso = now.toISOString();
  try {
    const row = await db
      .prepare("SELECT fails, last_at FROM auth_attempts WHERE ip = ?")
      .bind(ip)
      .first();

    let fails = 1;
    if (row) {
      const age = (now - Date.parse(row.last_at)) / 60000;
      fails = age <= AUTH_WINDOW_MIN ? (row.fails || 0) + 1 : 1;
    }
    const blocked =
      fails >= AUTH_MAX_FAILS
        ? new Date(now.getTime() + AUTH_LOCK_MIN * 60000).toISOString()
        : null;

    await db
      .prepare(
        `INSERT INTO auth_attempts (ip, fails, last_at, blocked_until) VALUES (?,?,?,?)
         ON CONFLICT(ip) DO UPDATE SET fails = ?, last_at = ?, blocked_until = ?`
      )
      .bind(ip, fails, nowIso, blocked, fails, nowIso, blocked)
      .run();
  } catch {}
}

/** 正しく入れたら記録を消す */
export async function clearAuthFails(db, ip) {
  if (!db || !ip) return;
  try {
    await db.prepare("DELETE FROM auth_attempts WHERE ip = ?").bind(ip).run();
  } catch {}
}

/* ===== お問合せ：大量送信の抑制 ===== */

/** 送信してよいか判定する */
export async function postRateState(db, ip) {
  if (!db || !ip) return { allowed: true };
  try {
    const row = await db
      .prepare(
        `SELECT
           SUM(CASE WHEN at > datetime('now','-10 minutes') THEN 1 ELSE 0 END) AS short_n,
           SUM(CASE WHEN at > datetime('now','-1 day')      THEN 1 ELSE 0 END) AS day_n
         FROM post_throttle WHERE ip = ?`
      )
      .bind(ip)
      .first();
    const shortN = (row && row.short_n) || 0;
    const dayN = (row && row.day_n) || 0;
    if (shortN >= POST_MAX_SHORT) {
      return {
        allowed: false,
        retryAfter: 600,
        message:
          "短時間に続けて送信されています。恐れ入りますが、しばらく経ってからお試しください。お急ぎの場合はお電話（03-3256-2535）をご利用ください。",
      };
    }
    if (dayN >= POST_MAX_DAY) {
      return {
        allowed: false,
        retryAfter: 3600,
        message:
          "本日の送信回数の上限に達しました。恐れ入りますが、お電話（03-3256-2535）でご連絡ください。",
      };
    }
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

/** 送信を記録し、ついでに古い記録を掃除する */
export async function recordPost(db, ip) {
  if (!db || !ip) return;
  try {
    await db
      .prepare("INSERT INTO post_throttle (ip, at) VALUES (?, datetime('now'))")
      .bind(ip)
      .run();
    await db
      .prepare("DELETE FROM post_throttle WHERE at < datetime('now','-2 days')")
      .run();
  } catch {}
}
