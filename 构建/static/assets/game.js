// =========================================================
// 百化分 · 配对小游戏 核心逻辑
// 分数 ↔ 百分数 匹配练习
// =========================================================
(function () {
  "use strict";

  var PAIRS = [
    ["1/2", "50%"], ["1/3", "33.3%"], ["1/4", "25%"], ["1/5", "20%"],
    ["1/6", "16.7%"], ["1/7", "14.3%"], ["1/8", "12.5%"], ["1/9", "11.1%"],
    ["1/10", "10%"], ["1/11", "9.1%"], ["1/12", "8.3%"], ["1/13", "7.7%"],
    ["1/14", "7.1%"], ["1/15", "6.7%"], ["1/16", "6.25%"], ["1/17", "5.9%"],
    ["1/18", "5.6%"], ["1/19", "5.3%"], ["1/20", "5%"], ["1/25", "4%"],
    ["1/30", "3.33%"], ["1/40", "2.5%"], ["1/50", "2%"], ["1/60", "1.67%"],
    ["1/80", "1.25%"], ["1/100", "1%"], ["2/3", "66.7%"], ["2/5", "40%"],
    ["3/5", "60%"], ["4/5", "80%"], ["3/4", "75%"], ["5/6", "83.3%"]
  ];

  var root = document.getElementById("game");
  if (!root) return;

  var todayEl = document.getElementById("today-count");
  var bestEl = document.getElementById("best-score");

  var state = {
    mode: "fp",        // fp = 分数→百分数, pf = 百分数→分数, mix
    count: 10,
    idx: 0,
    score: 0,
    streak: 0,
    maxStreak: 0,
    wrong: [],
    busy: false
  };

  function ls(key, def) {
    try { var v = localStorage.getItem(key); return v === null ? def : JSON.parse(v); }
    catch (e) { return def; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  var best = ls("kb-bai-best", 0);
  var today = ls("kb-bai-today", 0);
  if (bestEl) bestEl.textContent = best > 0 ? best + " 分" : "—";
  if (todayEl) todayEl.textContent = "今日：" + today + " 题";

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // 由当前模式生成一道题
  function makeQuestion() {
    var useFp;
    if (state.mode === "mix") useFp = Math.random() < 0.5;
    else useFp = state.mode === "fp";

    var ansIdx = Math.floor(Math.random() * PAIRS.length);
    var distIdx = shuffle(PAIRS.map(function (_, i) { return i; })
      .filter(function (i) { return i !== ansIdx; }))
      .slice(0, 3);

    var options = shuffle([ansIdx].concat(distIdx));

    var q;
    if (useFp) {
      q = { strong: PAIRS[ansIdx][0], sub: "它对应的百分数是？", opts: options.map(function (i) { return PAIRS[i][1]; }), ans: PAIRS[ansIdx][1] };
    } else {
      q = { strong: PAIRS[ansIdx][1], sub: "它对应的分数是？", opts: options.map(function (i) { return PAIRS[i][0]; }), ans: PAIRS[ansIdx][0] };
    }
    return q;
  }

  /* ---------- 屏幕渲染 ---------- */

  function renderSetup() {
    var modeChips = [
      { v: "fp", t: "分数 → 百分数", d: "给分数，选百分数" },
      { v: "pf", t: "百分数 → 分数", d: "给百分数，选分数" },
      { v: "mix", t: "混合挑战", d: "两者随机切换" }
    ];
    root.innerHTML =
      "<div class='game-pad'>" +
        "<div class='setup-title'>百化分 · 配对训练</div>" +
        "<div class='setup-sub'>每天来几局，把 百化分 练成肌肉记忆</div>" +
        "<div class='setup-blk'><div class='setup-label'>模式</div>" +
          "<div class='chip-row'>" + modeChips.map(function (c) {
            return "<button class='chip" + (state.mode === c.v ? " on" : "") + "' data-mode='" + c.v + "'>" + esc(c.t) + "<small>" + esc(c.d) + "</small></button>";
          }).join("") + "</div></div>" +
        "<div class='setup-blk'><div class='setup-label'>题量</div>" +
          "<div class='chip-row'>" + [10, 20].map(function (n) {
            return "<button class='chip" + (state.count === n ? " on" : "") + "' data-count='" + n + "'>" + n + " 题</button>";
          }).join("") + "</div></div>" +
        "<button class='start-btn' id='start-btn'>开 始</button>" +
        "<div class='game-foot-note'>答对会有正反馈，答错会高亮正确答案 — 记得看错题复盘</div>" +
      "</div>";

    root.querySelectorAll(".chip[data-mode]").forEach(function (c) {
      c.addEventListener("click", function () {
        state.mode = c.getAttribute("data-mode");
        renderSetup();
      });
    });
    root.querySelectorAll(".chip[data-count]").forEach(function (c) {
      c.addEventListener("click", function () {
        state.count = +c.getAttribute("data-count");
        renderSetup();
      });
    });
    root.querySelector("#start-btn").addEventListener("click", function () {
      state.idx = 0; state.score = 0; state.streak = 0; state.maxStreak = 0; state.wrong = [];
      renderProgress();
      renderQuestion();
    });
  }

  function renderProgress() {
    root.innerHTML = "<div class='game-status'>" +
        "<span class='gs-item'>题目 <b>" + (state.idx + 1) + "</b> / " + state.count + "</span>" +
        "<span class='gs-item'>得分 <b>" + state.score + "</b></span>" +
        "<span class='gs-item'>连对 <b>" + state.streak + "</b></span>" +
        "<span class='gs-item'>正确率 <b>" + pctOf(state.score, state.idx) + "</b></span>" +
        "<span class='gs-right'><button class='gs-btn' id='quit-btn'>✕ 退出</button></span>" +
      "</div>" +
      "<div class='game-progress'><div class='bar' style='width:" + (state.idx / state.count * 100) + "%'></div></div>" +
      "<div class='game-pad' id='qpad'></div>";

    root.querySelector("#quit-btn").addEventListener("click", renderSetup);
    var qpad = root.querySelector("#qpad");
    return qpad;
  }

  function renderQuestion() {
    var qpad = renderProgress();
    var q = makeQuestion();
    state.cur = q;
    state.busy = false;

    qpad.innerHTML =
      "<div class='qwrap'>" +
        "<div class='q-label'>第 " + (state.idx + 1) + " 题</div>" +
        "<div class='q-big' id='qbig'>" + esc(q.strong) + "</div>" +
        "<div class='q-sub'>" + esc(q.sub) + "</div>" +
        "<div class='opts'>" + q.opts.map(function (o, oi) {
          return "<button class='opt' data-ans='" + esc(q.ans) + "' data-text='" + esc(o) + "'>" + esc(o) + "</button>";
        }).join("") + "</div>" +
        "<div class='fb' id='fb'></div>" +
      "</div>";

    var qbig = qpad.querySelector("#qbig");
    requestAnimationFrame(function () {
      setTimeout(function () { qbig.classList.add("pulse"); }, 60);
    });

    qpad.querySelectorAll(".opt").forEach(function (b) {
      b.addEventListener("click", function () { pick(b, q); });
    });
  }

  function pick(btn, q) {
    if (state.busy) return;
    state.busy = true;
    var chosen = btn.getAttribute("data-text");

    if (chosen === q.ans) {
      btn.classList.add("right");
      state.score++; state.streak++;
      if (state.streak > state.maxStreak) state.maxStreak = state.streak;
      showFb(root, "ok", "回答正确！继续保持");
    } else {
      btn.classList.add("wrong");
      state.streak = 0;
      state.wrong.push({ q: q.strong, ans: q.ans, ua: chosen, sub: q.sub });
      // 高亮正确选项
      root.querySelectorAll(".opt").forEach(function (ob) {
        if (ob.getAttribute("data-text") === q.ans) ob.classList.add("right");
      });
      showFb(root, "no", "正确答案是 " + q.ans);
    }

    root.querySelectorAll(".opt").forEach(function (ob) { ob.classList.add("disabled"); });

    setTimeout(function () {
      state.idx++;
      if (state.idx >= state.count) renderResult();
      else renderQuestion();
    }, 900);
  }

  function showFb(qpad, kind, msg) {
    var fb = qpad.querySelector("#fb");
    if (fb) {
      fb.className = "fb show fb-" + kind;
      fb.innerHTML = "<span class='fb-dot'></span>" + esc(msg);
    }
  }

  function pctOf(sc, done) {
    if (!done) return "0%";
    return Math.round(sc / done * 100) + "%";
  }

  function renderResult() {
    var acc = pctOf(state.score, state.count);
    var done = state.idx;

    // 更新今日 & 最佳
    today += done;
    lsSet("kb-bai-today", today);
    if (todayEl) todayEl.textContent = "今日：" + today + " 题";

    var isNewBest = state.score > best;
    if (isNewBest) { best = state.score; lsSet("kb-bai-best", best); }
    if (bestEl) bestEl.textContent = best > 0 ? best + " 分" : "—";

    var grade;
    var gradeColor = "#a8842a";
    var pr = state.score / state.count;
    if (pr >= 0.95) { grade = "极 OK，手到擒来！"; }
    else if (pr >= 0.8) { grade = "很棒，再练几局就满级！"; }
    else if (pr >= 0.6) { grade = "不错，若有错题多看看速记卡"; }
    else if (pr >= 0.4) { grade = "有进步，错题是你的下一课"; }
    else { grade = "别灰心，先从速记卡记起"; gradeColor = "#b0596a"; }

    var reviewHtml = "";
    if (state.wrong.length) {
      reviewHtml = "<div class='review'><div class='review-title'>📝 错题复盘（" + state.wrong.length + "）</div>" +
        "<div class='review-list'>" + state.wrong.map(function (w) {
          return "<div class='rv-item'><span class='rv-q'>" + esc(w.q) + "</span><span class='rv-arrow'>→</span><span class='rv-a'>" + esc(w.ans) + "</span><span class='rv-ua'>你选：" + esc(w.ua) + "</span></div>";
        }).join("") + "</div></div>";
    } else {
      reviewHtml = "<div class='review'><div class='review-title'>🏆 全对！</div><div class='review-none'>没有错题，这局完美～</div></div>";
    }

    root.innerHTML =
      "<div class='game-status'>" +
        "<span class='gs-item'>今日 <b>" + today + "</b> 题</span>" +
        "<span class='gs-item'>最佳 <b>" + best + "</b> 分</span>" +
        "<span class='gs-item'>正确率 <b>" + acc + "</b></span>" +
        "<span class='gs-right'>" + (isNewBest ? "<span class='gs-btn on'>新纪录</span>" : "") + "</span>" +
      "</div>" +
      "<div class='game-pad'>" +
        "<div class='result-big'>" +
          "<div class='r-score'>" + state.score + "<small> / " + state.count + "</small></div>" +
          "<div class='r-label'>得分</div>" +
        "</div>" +
        "<div class='r-stats'>" +
          "<div class='r-stat'><b>" + state.maxStreak + "</b><span>最长连对</span></div>" +
          "<div class='r-stat'><b>" + acc + "</b><span>正确率</span></div>" +
          "<div class='r-stat'><b style='color:" + gradeColor + "'>" + grade + "</b><span>评价</span></div>" +
        "</div>" +
        reviewHtml +
        "<div class='result-actions'>" +
          "<button class='gbtn' id='again'>再来一局</button>" +
          "<button class='gbtn primary' id='reset'>换模式</button>" +
        "</div>" +
      "</div>";

    root.querySelector("#again").addEventListener("click", function () {
      state.idx = 0; state.score = 0; state.streak = 0; state.maxStreak = 0; state.wrong = [];
      renderQuestion();
    });
    root.querySelector("#reset").addEventListener("click", renderSetup);
  }

  /* ---------- 初次渲染 ---------- */
  renderSetup();
})();
