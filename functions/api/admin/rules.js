const json = (o, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

const TYPES = ["ng_domain", "ok_domain", "ng_word"];

/** 学習済みルールの一覧 */
export async function onRequestGet({ env }) {
  const db = env.DB;
  if (!db) return json({ ok: false, error: "データベース(DB)が接続されていません。" }, 503);
  try {
    const { results } = await db
      .prepare("SELECT id, type, value, created_at FROM rules ORDER BY type, value")
      .all();
    return json({ ok: true, items: results || [] });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}

/** ルールを追加 { type, value } */
export async function onRequestPost({ request, env }) {
  const db = env.DB;
  if (!db) return json({ ok: false, error: "データベース(DB)が接続されていません。" }, 503);
  let d;
  try {
    d = await request.json();
  } catch {
    return json({ ok: false, error: "入力を読み取れませんでした。" }, 400);
  }
  const type = String(d.type || "");
  const value = String(d.value || "").trim().toLowerCase();
  if (!TYPES.includes(type)) return json({ ok: false, error: "種別が不正です。" }, 400);
  if (!value || value.length > 120)
    return json({ ok: false, error: "値を入力してください。" }, 400);
  try {
    await db
      .prepare("INSERT OR IGNORE INTO rules (type, value, created_at) VALUES (?,?,?)")
      .bind(type, value, new Date().toISOString())
      .run();
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}

/** ルールを削除 ?id= */
export async function onRequestDelete({ request, env }) {
  const db = env.DB;
  if (!db) return json({ ok: false, error: "データベース(DB)が接続されていません。" }, 503);
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return json({ ok: false, error: "idが指定されていません。" }, 400);
  try {
    await db.prepare("DELETE FROM rules WHERE id = ?").bind(id).run();
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}
