import { scoreInquiry, loadRules, VERDICT_JA } from "../_lib/score.js";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

const KINDS = [
  "顧問税理士のご相談",
  "相続・事業承継のご相談",
  "会社設立・独立開業のご相談",
  "確定申告のご相談",
  "給与計算・年末調整のご相談",
  "求人・採用について",
  "その他のお問合せ",
];

export async function onRequestPost({ request, env, waitUntil }) {
  let d;
  try {
    d = await request.json();
  } catch {
    return json({ ok: false, error: "入力内容を読み取れませんでした。" }, 400);
  }

  /* ---- 必須項目 ---- */
  const name = String(d.name || "").trim();
  const email = String(d.email || "").trim();
  const body = String(d.body || "").trim();
  if (!name || !email || !body) {
    return json({ ok: false, error: "必須項目が入力されていません。" }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return json({ ok: false, error: "メールアドレスの形式をご確認ください。" }, 400);
  }
  if (body.length > 5000 || name.length > 100) {
    return json({ ok: false, error: "入力できる文字数を超えています。" }, 400);
  }

  /* ---- Turnstile（設定されているときだけ検証） ---- */
  if (env.TURNSTILE_SECRET) {
    const ok = await verifyTurnstile(
      env.TURNSTILE_SECRET,
      d.token,
      request.headers.get("cf-connecting-ip")
    );
    if (!ok) {
      return json(
        { ok: false, error: "認証に失敗しました。ページを再読み込みしてお試しください。" },
        400
      );
    }
  }

  const ip = request.headers.get("cf-connecting-ip") || "";
  const ua = request.headers.get("user-agent") || "";
  const db = env.DB;

  /* ---- 同一回線からの連投を数える ---- */
  let ipCount = 0;
  if (db && ip) {
    try {
      const row = await db
        .prepare(
          "SELECT COUNT(*) AS n FROM inquiries WHERE ip = ? AND created_at > datetime('now','-1 day')"
        )
        .bind(ip)
        .first();
      ipCount = (row && row.n) || 0;
    } catch {}
  }

  /* ---- 採点 ---- */
  const rules = await loadRules(db);
  const input = {
    kind: KINDS.includes(d.kind) ? d.kind : "その他のお問合せ",
    name,
    kana: String(d.kana || "").trim(),
    company: String(d.company || "").trim(),
    email,
    tel: String(d.tel || "").trim(),
    body,
    source: String(d.source || "").trim(),
    elapsed: Math.max(0, Math.round(Number(d.elapsed) || 0)),
    hp: !!String(d.website || "").trim(),
    ipCount: ipCount + 1,
  };
  const { score, verdict, reasons } = scoreInquiry(input, rules);

  /* ---- 保存 ---- */
  const now = new Date().toISOString();
  let id = null;
  if (db) {
    try {
      const res = await db
        .prepare(
          `INSERT INTO inquiries
           (created_at,kind,name,kana,company,email,tel,body,source,ip,ua,elapsed,score,verdict,reasons,label,handled)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,0)`
        )
        .bind(
          now,
          input.kind,
          input.name,
          input.kana,
          input.company,
          input.email,
          input.tel,
          input.body,
          input.source,
          ip,
          ua.slice(0, 300),
          input.elapsed,
          score,
          verdict,
          JSON.stringify(reasons)
        )
        .run();
      id = res.meta && res.meta.last_row_id;
    } catch (e) {
      return json(
        { ok: false, error: "保存に失敗しました。お手数ですがお電話をお願いいたします。" },
        500
      );
    }
  }

  /* ---- 通知メール（設定されているときだけ） ---- */
  if (env.RESEND_API_KEY && env.NOTIFY_TO) {
    const send = notify(env, input, score, verdict, reasons, id);
    if (typeof waitUntil === "function") waitUntil(send);
    else await send.catch(() => {});
  }

  return json({ ok: true });
}

async function verifyTurnstile(secret, token, ip) {
  if (!token) return false;
  try {
    const form = new FormData();
    form.append("secret", secret);
    form.append("response", token);
    if (ip) form.append("remoteip", ip);
    const r = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: form }
    );
    const j = await r.json();
    return !!j.success;
  } catch {
    return false;
  }
}

async function notify(env, d, score, verdict, reasons, id) {
  const mark = verdict === "sales" ? "【営業の可能性】" : verdict === "unsure" ? "【要確認】" : "【お問合せ】";
  const lines = [
    `判定：${VERDICT_JA[verdict]}（営業スコア ${score} / 100）`,
    `理由：`,
    ...reasons.map((x) => `　・${x}`),
    "",
    "───────────────",
    `種別　　：${d.kind}`,
    `お名前　：${d.name}${d.kana ? `（${d.kana}）` : ""}`,
    `会社名　：${d.company || "―"}`,
    `メール　：${d.email}`,
    `電話　　：${d.tel || "―"}`,
    `きっかけ：${d.source || "―"}`,
    "───────────────",
    "",
    d.body,
    "",
    "───────────────",
    `管理画面：${env.SITE_URL || ""}/admin.html`,
  ];
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.NOTIFY_FROM || "onboarding@resend.dev",
      to: env.NOTIFY_TO.split(",").map((s) => s.trim()),
      reply_to: d.email,
      subject: `${mark} ${d.company || d.name} 様より（${d.kind}）`,
      text: lines.join("\n"),
    }),
  });
}
