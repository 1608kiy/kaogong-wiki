// =========================================================
// 考公知识库 · 前端交互（主题 / 目录 / 滚动高亮 / 搜索）
// =========================================================
(function () {
  "use strict";

  var doc = document;

  /* ---------- 主题切换 ---------- */
  var themeBtn = doc.getElementById("theme-toggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var root = doc.documentElement;
      var dark = root.classList.toggle("dark");
      try { localStorage.setItem("kb-theme", dark ? "dark" : "light"); } catch (e) {}
      themeBtn.setAttribute("aria-pressed", dark ? "true" : "false");
    });
  }

  /* ---------- 滚动显现（减少动效/无JS 时内容依旧可见，绝不空白） ---------- */
  if (doc.documentElement.classList.contains("anim")) {
    var reveals = Array.prototype.slice.call(doc.querySelectorAll(".reveal"));
    if (reveals.length) {
      var revealAll = function () {
        reveals.forEach(function (el) { el.classList.add("in"); });
      };
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (es) {
          es.forEach(function (e) {
            if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
          });
        }, { rootMargin: "0px 0px -8% 0px", threshold: 0.01 });
        reveals.forEach(function (el) { io.observe(el); });
      } else {
        revealAll();
      }
      window.setTimeout(revealAll, 700);
    }
  }

  /* ---------- 目录分组折叠 ---------- */
  var ghBtns = doc.querySelectorAll(".toc-gh");
  ghBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var group = btn.parentElement;
      if (group) group.classList.toggle("open");
    });
  });

  /* ---------- 滚动高亮 ---------- */
  var tocLinks = Array.prototype.slice.call(doc.querySelectorAll(".toc-gl a"));
  if (tocLinks.length) {
    var ids = tocLinks.map(function (a) {
      var href = a.getAttribute("href") || "";
      return href.charAt(0) === "#" ? href.slice(1) : null;
    }).filter(Boolean);

    var targets = ids.map(function (id) { return doc.getElementById(id); }).filter(Boolean);
    var activeLink = null;

    function setActive(link) {
      if (activeLink) activeLink.parentElement.classList.remove("active");
      if (link) link.parentElement.classList.add("active");
      activeLink = link;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          var id = e.target.id;
          var link = tocLinks.find(function (a) {
            var h = a.getAttribute("href") || "";
            return h === "#" + id;
          });
          if (link) setActive(link);
        }
      });
    }, { rootMargin: "-10% 0px -75% 0px", threshold: 0 });

    targets.forEach(function (t) { io.observe(t); });
    if (targets.length) setActive(tocLinks[0]);
  }

  /* ---------- 搜索 ---------- */
  var input = doc.getElementById("search-input");
  var results = doc.getElementById("search-results");
  var index = null;

  function escHtml(s) {
    return (String(s || ""))
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function escReg(s) { return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function highlight(text, q) {
    var safe = escHtml(text);
    if (!q) return safe;
    var re = new RegExp("(" + escReg(q) + ")", "gi");
    return safe.replace(re, "<mark>$1</mark>");
  }

  function loadIndex() {
    return fetch("assets/search-index.json")
      .then(function (r) { if (!r.ok) throw new Error("no"); return r.json(); })
      .then(function (data) { index = data; })
      .catch(function () { index = null; });
  }

  function scoreItem(item, q) {
    var title = (item.title || "").toLowerCase();
    var headings = (item.headings || []).join(" ").toLowerCase();
    var text = (item.text || "").toLowerCase();
    var mode = (item.mode || "").toLowerCase();
    var ql = q.toLowerCase();
    var s = 0;
    if (title === ql) s += 40;
    if (title.indexOf(ql) > -1) s += 22;
    if (headings.indexOf(ql) > -1) s += 14;
    var i = text.indexOf(ql);
    if (i > -1) s += 10 + (i < 40 ? 6 : 0);
    if (mode === ql) s += 8;
    return s;
  }

  function runSearch(q) {
    results.innerHTML = "";
    if (!q) { results.classList.remove("show"); return; }
    if (index === null) {
      results.classList.add("show");
      results.insertAdjacentHTML("beforeend", "<div class='sr-empty'>搜索索引还在加载…</div>");
      return;
    }
    var scored = index
      .map(function (item) { return { item: item, s: scoreItem(item, q) }; })
      .filter(function (x) { return x.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, 20);

    results.classList.add("show");
    if (!scored.length) {
      results.insertAdjacentHTML("beforeend", "<div class='sr-empty'>没有找到「" + escHtml(q) + "」相关的内容</div>");
      return;
    }

    var snippetSource = function (item) {
      var t = (item.text || "").toLowerCase();
      var idx = t.indexOf(q.toLowerCase());
      if (idx < 0) return "";
      var start = Math.max(0, idx - 24);
      var raw = (item.text || "").slice(start, idx + q.length + 46);
      return "…" + raw.replace(/\s+/g, " ").trim() + "…";
    };

    scored.forEach(function (x) {
      var item = x.item;
      var href = item.url || "#";
      var snippet = snippetSource(item);
      results.insertAdjacentHTML("beforeend",
        "<a class='sr-item' href='" + escHtml(href) + "'>" +
          "<div class='sr-title'>" + highlight(item.title, q) + "</div>" +
          "<div class='sr-meta'>" + escHtml(item.mode || "") + "</div>" +
          (snippet ? "<div class='sr-snippet'>" + highlight(snippet, q) + "</div>" : "") +
        "</a>");
    });
  }

  var debounce = null;
  if (input && results) {
    loadIndex();
    input.addEventListener("input", function () {
      clearTimeout(debounce);
      var v = input.value.trim();
      debounce = setTimeout(function () { runSearch(v); }, 160);
    });
    doc.addEventListener("click", function (e) {
      if (!results.contains(e.target) && e.target !== input) results.classList.remove("show");
    });
    doc.addEventListener("keydown", function (e) {
      if (e.key === "Escape") results.classList.remove("show");
    });
  }
})();
