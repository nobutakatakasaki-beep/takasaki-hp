/* お問合せフォームの送信処理 */
(function () {
  "use strict";
  var form = document.getElementById("contactForm");
  if (!form) return;

  var opened = Date.now();
  var state = document.getElementById("formState");
  var btn = document.getElementById("submitBtn");
  var tsWidget = document.getElementById("turnstile");
  var tsToken = "";

  /* Turnstile（Cloudflareの無料ボット対策）が設定されていれば読み込む */
  fetch("/api/config")
    .then(function (r) {
      return r.json();
    })
    .then(function (c) {
      if (!c.turnstileSiteKey || !tsWidget) return;
      window.onTurnstileLoad = function () {
        window.turnstile.render(tsWidget, {
          sitekey: c.turnstileSiteKey,
          language: "ja",
          callback: function (t) {
            tsToken = t;
          },
        });
      };
      var s = document.createElement("script");
      s.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit";
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    })
    .catch(function () {});

  function setErr(el, on) {
    el.closest(".field").classList.toggle("is-err", on);
  }

  function show(msg) {
    state.textContent = msg;
    state.className = "formstate formstate--err is-on";
    state.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    state.className = "formstate";

    var f = form.elements;
    var bad = false;
    ["name", "email", "body"].forEach(function (k) {
      var el = f[k];
      var empty = !el.value.trim();
      setErr(el, empty);
      if (empty) bad = true;
    });
    var em = f.email;
    if (em.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em.value.trim())) {
      setErr(em, true);
      bad = true;
    }
    if (!f.consent.checked) {
      show("個人情報の取扱いについて、ご同意のうえ送信してください。");
      return;
    }
    if (bad) {
      show("未入力またはご確認いただきたい項目があります。赤枠の欄をご確認ください。");
      return;
    }

    var payload = {
      kind: f.kind.value,
      name: f.name.value.trim(),
      kana: f.kana.value.trim(),
      company: f.company.value.trim(),
      email: f.email.value.trim(),
      tel: f.tel.value.trim(),
      body: f.body.value.trim(),
      source: f.source.value,
      website: f.website.value, // ハニーポット
      elapsed: Math.round((Date.now() - opened) / 1000),
      token: tsToken,
    };

    btn.disabled = true;
    btn.textContent = "送信中…";

    fetch("/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        return r.json().catch(function () {
          return { ok: false, error: "送信に失敗しました。" };
        });
      })
      .then(function (j) {
        if (j.ok) {
          location.href = "thanks.html";
        } else {
          show(j.error || "送信に失敗しました。時間をおいてお試しください。");
          btn.disabled = false;
          btn.innerHTML = '送信する<i class="btn__arrow"></i>';
        }
      })
      .catch(function () {
        show(
          "送信に失敗しました。通信環境をご確認いただくか、お電話（03-3256-2535）でご連絡ください。"
        );
        btn.disabled = false;
        btn.innerHTML = '送信する<i class="btn__arrow"></i>';
      });
  });
})();
