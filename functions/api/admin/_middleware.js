/** /api/admin/* の入口。合言葉が合わないものはここで止める。 */

function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function onRequest({ request, env, next }) {
  const expected = env.ADMIN_PASSWORD;
  if (!expected) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          "管理画面の合言葉が未設定です。Cloudflareの環境変数 ADMIN_PASSWORD を設定してください。",
      }),
      { status: 503, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  const given =
    request.headers.get("x-admin-key") ||
    new URL(request.url).searchParams.get("key") ||
    "";

  if (!timingSafeEqual(given, expected)) {
    return new Response(
      JSON.stringify({ ok: false, error: "合言葉が違います。" }),
      { status: 401, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  const res = await next();
  const out = new Response(res.body, res);
  out.headers.set("cache-control", "no-store");
  return out;
}
