import { emailDomain } from "../../_lib/score.js";

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

/**
 * 1件の問合せを更新する。
 *  { id, label:'sales'|'client'|'unsure'|null, handled:0|1, memo, learn:true }
 * learn が true なら、そのドメインを学習ルールに登録して次回から即断できるようにする。
 */
export async function onRequestPost({ request, env }) {
  const db = env.DB;
  if (!db) return json({ ok: false, error: "データベース(DB)が接続されていません。" }, 503);

  let d;
  try {
    d = await request.json();
  } catch {
    return json({ ok: false, error: "入力を読み取れませんでした。" }, 400);
  }

  const id = Number(d.id);
  if (!id) return json({ ok: false, error: "idが指定されていません。" }, 400);

  const sets = [];
  const bind = [];
  if ("label" in d) {
    const L = d.label;
    if (L !== null && !["sales", "client", "unsure"].includes(L)) {
      return json({ ok: false, error: "ラベルの値が不正です。" }, 400);
    }
    sets.push("label = ?");
    bind.push(L);
  }
  if ("handled" in d) {
    sets.push("handled = ?");
    bind.push(d.handled ? 1 : 0);
  }
  if ("memo" in d) {
    sets.push("memo = ?");
    bind.push(String(d.memo || "").slice(0, 1000));
  }
  if (!sets.length) return json({ ok: false, error: "更新する項目がありません。" }, 400);

  bind.push(id);

  try {
    await db
      .prepare(`UPDATE inquiries SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...bind)
      .run();

    let learned = null;
    if (d.learn && (d.label === "sales" || d.label === "client")) {
      const row = await db
        .prepare("SELECT email FROM inquiries WHERE id = ?")
        .bind(id)
        .first();
      const domain = emailDomain(row && row.email);
      const FREE = [
        "gmail.com", "yahoo.co.jp", "yahoo.ne.jp", "outlook.jp", "outlook.com",
        "hotmail.com", "hotmail.co.jp", "icloud.com", "me.com", "docomo.ne.jp",
        "ezweb.ne.jp", "au.com", "softbank.ne.jp", "nifty.com", "ocn.ne.jp",
      ];
      /* フリーメールは個人も使うので学習対象にしない */
      if (domain && !FREE.includes(domain)) {
        const type = d.label === "sales" ? "ng_domain" : "ok_domain";
        const other = d.label === "sales" ? "ok_domain" : "ng_domain";
        await db
          .prepare("DELETE FROM rules WHERE type = ? AND value = ?")
          .bind(other, domain)
          .run();
        await db
          .prepare(
            "INSERT OR IGNORE INTO rules (type, value, created_at) VALUES (?,?,?)"
          )
          .bind(type, domain, new Date().toISOString())
          .run();
        learned = { type, value: domain };
      }
    }

    return json({ ok: true, learned });
  } catch (e) {
    return json({ ok: false, error: "更新に失敗しました：" + e.message }, 500);
  }
}

/** 1件削除 */
export async function onRequestDelete({ request, env }) {
  const db = env.DB;
  if (!db) return json({ ok: false, error: "データベース(DB)が接続されていません。" }, 503);
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return json({ ok: false, error: "idが指定されていません。" }, 400);
  try {
    await db.prepare("DELETE FROM inquiries WHERE id = ?").bind(id).run();
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: "削除に失敗しました：" + e.message }, 500);
  }
}
