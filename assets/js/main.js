/* 髙﨑会計事務所 — 共通スクリプト */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- ヘッダーの状態 ---- */
  var hdr = document.querySelector(".hdr");
  if (hdr && !hdr.classList.contains("hdr--solid")) {
    var onScroll = function () {
      hdr.classList.toggle("is-stuck", window.scrollY > 90);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---- スマホメニュー ---- */
  var burger = document.querySelector(".burger");
  if (burger) {
    burger.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      burger.setAttribute("aria-expanded", String(open));
      document.body.style.overflow = open ? "hidden" : "";
    });
    document.querySelectorAll(".drawer a").forEach(function (a) {
      a.addEventListener("click", function () {
        document.body.classList.remove("nav-open");
        document.body.style.overflow = "";
      });
    });
  }

  /* ---- 見出しを一文字ずつに割る ---- */
  document.querySelectorAll(".split").forEach(function (el) {
    if (el.dataset.split === "done") return;
    var chars = Array.from(el.textContent);
    el.textContent = "";
    chars.forEach(function (c, i) {
      var s = document.createElement("span");
      s.textContent = c === " " ? " " : c;
      s.style.setProperty("--c", i);
      el.appendChild(s);
    });
    el.dataset.split = "done";
  });

  /* ---- スクロールで立ち上がる ---- */
  var targets = document.querySelectorAll("[data-reveal], .split, .eyebrow, .philo__quote");
  if (reduce || !("IntersectionObserver" in window)) {
    targets.forEach(function (el) {
      el.classList.add("is-in");
    });
  } else {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    targets.forEach(function (el) {
      io.observe(el);
    });
    /* 連続する要素に順番待ちの間をつくる */
    document.querySelectorAll("[data-stagger]").forEach(function (group) {
      Array.from(group.children).forEach(function (child, i) {
        child.style.setProperty("--i", i);
      });
    });
  }

  /* ---- ヒーローの紋章をマウスに少しだけ追わせる ---- */
  var crest = document.querySelector(".hero__crest");
  if (crest && !reduce && window.matchMedia("(pointer:fine)").matches) {
    var tx = 0,
      ty = 0,
      cx = 0,
      cy = 0,
      raf = null;
    window.addEventListener(
      "mousemove",
      function (e) {
        tx = (e.clientX / window.innerWidth - 0.5) * -26;
        ty = (e.clientY / window.innerHeight - 0.5) * -20;
        if (!raf) raf = requestAnimationFrame(loop);
      },
      { passive: true }
    );
    function loop() {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      crest.style.marginLeft = cx.toFixed(2) + "px";
      crest.style.marginTop = cy.toFixed(2) + "px";
      if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = null;
      }
    }
  }

  /* ---- 今年 ---- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
