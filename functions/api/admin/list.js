const json = (o, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

/** 問合せ一覧。filter=all|client|unsure|sales|todo、q=検索語 */
export async function onRequestGet({ request, env }) {
  const db = env.DB;
  if (!db) return json({ ok: false, error: "データベース(DB)が接続されていません。" }, 503);

  const u = new URL(request.url);
  const filter = u.searchParams.get("filter") || "all";
  const q = (u.searchParams.get("q") || "").trim();
  const limit = Math.min(300, Math.max(1, Number(u.searchParams.get("limit")) || 100));

  const where = [];
  const bind = [];

  /* 人が付けたラベルがあればそれを優先して絞り込む */
  if (filter === "sales") where.push("(COALESCE(label, verdict) = 'sales')");
  else if (filter === "client") where.push("(COALESCE(label, verdict) = 'client')");
  else if (filter === "unsure") where.push("(COALESCE(label, verdict) = 'unsure')");
  else if (filter === "todo")
    where.push("(handled = 0 AND COALESCE(label, verdict) <> 'sales')");

  if (q) {
    where.push("(name LIKE ? OR company LIKE ? OR email LIKE ? OR body LIKE ?)");
    const like = `%${q}%`;
    bind.push(like, like, like, like);
  }

  const sql =
    "SELECT id,created_at,kind,name,kana,company,email,tel,body,source,score,verdict,reasons,label,handled,memo,ip" +
    " FROM inquiries" +
    (where.length ? " WHERE " + where.join(" AND ") : "") +
    " ORDER BY created_at DESC LIMIT ?";
  bind.push(limit);

  try {
    const { results } = await db.prepare(sql).bind(...bind).all();
    const items = (results || []).map((r) => ({
      ...r,
      reasons: safeParse(r.reasons),
    }));

    const counts = await db
      .prepare(
        `SELECT
           COUNT(*) AS all_n,
           SUM(CASE WHEN COALESCE(label,verdict)='sales'  THEN 1 ELSE 0 END) AS sales_n,
           SUM(CASE WHEN COALESCE(label,verdict)='unsure' THEN 1 ELSE 0 END) AS unsure_n,
           SUM(CASE WHEN COALESCE(label,verdict)='client' THEN 1 ELSE 0 END) AS client_n,
           SUM(CASE WHEN handled=0 AND COALESCE(label,verdict)<>'sales' THEN 1 ELSE 0 END) AS todo_n
         FROM inquiries`
      )
      .first();

    return json({ ok: true, items, counts });
  } catch (e) {
    return json({ ok: false, error: "読み込みに失敗しました：" + e.message }, 500);
  }
}

function safeParse(s) {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
