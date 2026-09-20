import { scoreInquiry, loadRules } from "../../_lib/score.js";

/** 受け取ったメール本文などを貼り付けて、判定だけを試す */
export async function onRequestPost({ request, env }) {
  let d;
  try {
    d = await request.json();
  } catch {
    d = {};
  }
  const rules = await loadRules(env.DB);
  const out = scoreInquiry(
    {
      kind: d.kind || "",
      name: d.name || "",
      company: d.company || "",
      email: d.email || "",
      tel: d.tel || "",
      body: d.body || "",
      elapsed: Number(d.elapsed) || 0,
      hp: false,
      ipCount: 1,
    },
    rules
  );
  return new Response(JSON.stringify({ ok: true, ...out }), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
