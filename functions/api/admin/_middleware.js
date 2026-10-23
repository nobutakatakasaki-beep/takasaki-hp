/** /api/admin/* の入口。合言葉が合わないものはここで止める。 */
import {
  ensureTables,
  authLockState,
  recordAuthFail,
  clearAuthFails,
} from "../../_lib/guard.js";

/** 文字列の比較に毎回同じ時間をかけ、1文字ずつ推測されないようにする */
function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

const deny = (status, error, retryAfter) =>
  new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(retryAfter ? { "retry-after": String(retryAfter) } : {}),
    },
  });

export async function onRequest({ request, env, next }) {
  const expected = env.ADMIN_PASSWORD;
  if (!expected) {
    return deny(
      503,
      "管理画面の合言葉が未設定です。Cloudflareの環境変数 ADMIN_PASSWORD を設定してください。"
    );
  }

  const db = env.DB;
  const ip = request.headers.get("cf-connecting-ip") || "";
  await ensureTables(db);

  /* 総当たりでロック中なら、合言葉を照合する前に止める */
  const lock = await authLockState(db, ip);
  if (lock.locked) {
    const min = Math.ceil(lock.retryAfter / 60);
    return deny(
      429,
      `合言葉の入力を一定回数まちがえたため、一時的にロックしています。約${min}分後に再度お試しください。`,
      lock.retryAfter
    );
  }

  const given =
    request.headers.get("x-admin-key") ||
    new URL(request.url).searchParams.get("key") ||
    "";

  if (!timingSafeEqual(given, expected)) {
    await recordAuthFail(db, ip);
    return deny(401, "合言葉が違います。");
  }

  await clearAuthFails(db, ip);

  const res = await next();
  const out = new Response(res.body, res);
  out.headers.set("cache-control", "no-store");
  out.headers.set("x-robots-tag", "noindex, nofollow");
  return out;
}
