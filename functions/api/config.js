/** フォームが必要とする公開設定だけを返す */
export function onRequestGet({ env }) {
  return new Response(
    JSON.stringify({ turnstileSiteKey: env.TURNSTILE_SITE_KEY || "" }),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    }
  );
}
