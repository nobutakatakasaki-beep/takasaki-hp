/** 合言葉の確認だけ。実際の照合は _middleware.js が済ませている。 */
export function onRequestPost() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
