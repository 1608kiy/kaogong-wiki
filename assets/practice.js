/* 速算 · 每日练习 —— 随机四选一出题 */
(function () {
  "use strict";
  var root = document.getElementById("practice");
  if (!root) return;

  /* ---------- localStorage 安全封装（某些手机浏览器/WebView 会拒绝访问，绝不让它中断渲染） ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* ---------- 随机（按日期做种子，每天一套；再来一组换新） ---------- */
  var deck = 0;
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeRnd() {
    var d = new Date();
    var s = (d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()) * 100 + (deck++);
    var f = mulberry32(s >>> 0);
    return f;
  }
  function ri(r, min, max) { return Math.floor(r() * (max - min + 1)) + min; }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function fmtNum(n) {
    var neg = n < 0;
    n = Math.abs(n);
    var s = String(Math.round(n));
    var out = s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return neg ? "-" + out : out;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- 出题：融合《速算》技巧，全部为「估算」题（四选一选最贴近） ---------- */

  // 分数 -> 百分数字符串（保留 1 位，整则去小数）
  function pctStr(num, den) {
    var r = Math.round((num / den * 100) * 10) / 10;
    if (r === Math.round(r)) return Math.round(r) + "%";
    return r + "%";
  }

  /* ---- 加减法 ---- */
  // 高位叠加法：多位数相加，只加高位估数量级
  function gHighAdd(r, tier) {
    var n = ri(r, 3, 4);
    var lo = tier === 0 ? 520 : tier === 1 ? 3400 : 28000;
    var hi = tier === 0 ? 8600 : tier === 1 ? 68000 : 260000;
    var s = 0, t = [], i;
    for (i = 0; i < n; i++) { var x = ri(r, lo, hi); t.push(x); s += x; }
    return { q: t.map(fmtNum).join(" + ") + " = ?", a: s, tag: "高位叠加法", hint: "只加高位 · 估数量级" };
  }
  // 凑整法：每个数都靠近整十/整百/整千，多退少补
  function gNearAdd(r, tier) {
    var n = ri(r, 3, 4);
    var step = tier === 2 ? 10000 : tier === 1 ? 1000 : 100;
    var s = 0, t = [], i;
    for (i = 0; i < n; i++) {
      var mult = ri(r, tier === 0 ? 12 : tier === 1 ? 60 : 320, tier === 0 ? 99 : tier === 1 ? 480 : 2800);
      var off = (r() < .5 ? 1 : -1) * ri(r, 2, step / 10);
      var v = mult * step + off; t.push(v); s += v;
    }
    return { q: t.map(fmtNum).join(" + ") + " = ?", a: s, tag: "凑整法", hint: "多退少补" };
  }

  /* ---- 乘法 ---- */
  // 错位加减速算：×1.1/+10% 等规整倍数
  function gShiCuo(r, tier) {
    var base = ri(r, tier === 0 ? 180 : tier === 1 ? 900 : 4200, tier === 0 ? 980 : tier === 1 ? 6800 : 64000);
    var pair = pick(r, [[1.1, "+10%"], [0.9, "−10%"], [1.2, "+20%"], [0.8, "−20%"], [1.5, "+50%"], [0.5, "−50%"], [1.25, "+25%"]]);
    return { q: fmtNum(base) + " × " + pair[0] + " ≈ ?", a: base * pair[0], tag: "错位加减速算", hint: pair[1] };
  }
  // 拆分法：乘数拆成 整数+零头
  function gChaiFen(r, tier) {
    var x = ri(r, tier === 0 ? 24 : tier === 1 ? 95 : 380, tier === 0 ? 96 : tier === 1 ? 620 : 5400);
    var m = pick(r, [1.23, 1.15, 1.34, 1.18, 1.27, 0.87, 1.09, 0.94]);
    return { q: fmtNum(x) + " × " + m + " ≈ ?", a: x * m, tag: "拆分法", hint: "整数+零头" };
  }
  // 凑整估算法：多位数 × 非整百分数，一放一缩
  function gCouZheng(r, tier) {
    var N = ri(r, tier === 0 ? 200 : tier === 1 ? 720 : 2600, tier === 0 ? 990 : tier === 1 ? 4200 : 18000);
    var pw = ri(r, tier === 0 ? 10 : tier === 1 ? 16 : 25, tier === 0 ? 24 : tier === 1 ? 35 : 52);
    var pct = pw + (r() < .5 ? 0.3 : 0.7);
    return { q: fmtNum(N) + " × " + pct + "% ≈ ?", a: N * pct / 100, tag: "凑整估算法", hint: "一放一缩" };
  }

  /* ---- 除法 ---- */
  // 化除为乘：r<5%，基期≈现期−现期×r
  function gHuaWei(r, tier) {
    var A = ri(r, tier === 0 ? 900 : tier === 1 ? 3200 : 12000, tier === 0 ? 9200 : tier === 1 ? 42000 : 250000);
    var rv = ri(r, 10, 48) / 10;               // 1.0% ~ 4.8%
    var up = r() < .5 ? 1 : -1;
    var present = Math.round(A * (1 + up * rv / 100));
    return { q: "现期 " + fmtNum(present) + "，" + (up > 0 ? "增长" : "下降") + rv + "%，基期≈？", a: A, tag: "化除为乘", hint: "≈现期−现期×" + rv + "%" };
  }
  // 百化分转乘：5%≤r≤30%，能乘绝不除
  function gBaiHua(r, tier) {
    var pool = [[1, 6], [1, 7], [1, 8], [1, 9], [1, 10], [1, 12], [1, 15], [1, 20], [2, 7], [2, 9], [3, 11], [2, 15]];
    var p = pick(r, pool), num = p[0], den = p[1];
    var A = ri(r, tier === 0 ? 800 : tier === 1 ? 3200 : 14000, tier === 0 ? 8900 : tier === 1 ? 46000 : 260000);
    var up = r() < .5 ? 1 : -1;
    var present = Math.round(A * (den + up * num) / den);
    var rate = pctStr(num, den);
    var factor = up > 0 ? den + "/" + (den + num) : den + "/" + (den - num);
    return { q: "现期 " + fmtNum(present) + "，" + (up > 0 ? "增长" : "下降") + " " + rate + "，基期≈？", a: A, tag: "百化分转乘", hint: "×" + factor };
  }
  // 截位直除：多位数 ÷ 多位数，只截分母
  function gJieWei(r, tier) {
    var d = ri(r, tier === 0 ? 17 : tier === 1 ? 33 : 90, tier === 0 ? 46 : tier === 1 ? 89 : 420);
    var q = ri(r, tier === 0 ? 40 : tier === 1 ? 200 : 1500, tier === 0 ? 300 : tier === 1 ? 2000 : 12000);
    var A = d * q + ri(r, 0, d);
    return { q: fmtNum(A) + " ÷ " + d + " ≈ ?", a: Math.round(A / d), tag: "截位直除", hint: "只截分母" };
  }

  /* ---- 分数 · 百分比 ---- */
  // 分数乘：多位数 × p/q（百化分表）
  function gFracMul(r, tier) {
    var pair = pick(r, [[8, 7], [9, 8], [5, 6], [6, 5], [4, 3], [3, 2], [7, 8], [9, 10], [10, 9], [7, 6]]);
    var N = ri(r, tier === 0 ? 200 : tier === 1 ? 900 : 3000, tier === 0 ? 990 : tier === 1 ? 6400 : 22000);
    return { q: fmtNum(N) + " × " + pair[0] + "/" + pair[1] + " ≈ ?", a: N * pair[0] / pair[1], tag: "分数乘", hint: pair[0] + "/" + pair[1] };
  }
  // 百化分 · 分数快算：非整百分数 = 分数（如 37.5%=3/8）
  function gBaiPct(r, tier) {
    var pair = pick(r, [[3, 8], [5, 8], [7, 8], [5, 6], [2, 7], [3, 7], [4, 7], [1, 6], [1, 7], [1, 8], [1, 9], [2, 9], [1, 12], [1, 15]]);
    var N = ri(r, tier === 0 ? 240 : tier === 1 ? 900 : 2800, tier === 0 ? 990 : tier === 1 ? 5200 : 18000);
    var rate = pctStr(pair[0], pair[1]);
    return { q: fmtNum(N) + " × " + rate + " ≈ ?", a: N * pair[0] / pair[1], tag: "百化分 · 分数快算", hint: "=×" + pair[0] + "/" + pair[1] };
  }
  // 增长量：r=1/n → 增长量=现期÷(n+1)，减少量=现期÷(n−1)
  function gGrowth(r, tier) {
    var den = pick(r, [5, 6, 7, 8, 9, 10, 12, 15]);
    var N = ri(r, tier === 0 ? 400 : tier === 1 ? 1600 : 6000, tier === 0 ? 4200 : tier === 1 ? 12000 : 90000);
    var up = r() < .5 ? 1 : -1;
    var a = up > 0 ? Math.round(N / (den + 1)) : Math.round(N / (den - 1));
    return { q: "现期 " + fmtNum(N) + "，" + (up > 0 ? "增长" : "减少") + " " + pctStr(1, den) + "，" + (up > 0 ? "增长量" : "减少量") + "≈？", a: a, tag: "增长量 · 百化分", hint: up > 0 ? "÷(n+1)" : "÷(n−1)" };
  }

  /* ---- 技巧注册表：混合模式轮转全部技巧，专项模式取对应子集 ---- */
  var GENS = [gHighAdd, gNearAdd, gShiCuo, gChaiFen, gCouZheng, gHuaWei, gBaiHua, gJieWei, gFracMul, gBaiPct, gGrowth];
  var FOCUS_GENS = { add: [0, 1], mul: [2, 3, 4, 5, 6, 7], pct: [8, 9, 10] };

  var TIER_TAG = ["简单 · 容差大", "中等 · 容差中", "困难 · 容差小"];

  function spreadFor(tier, r) {
    var S = [[6, 9], [2.5, 4], [0.8, 1.5]]; // %，由大到小
    var s = S[tier];
    return s[0] + r() * (s[1] - s[0]);
  }

  function makeOptions(V, spread, r) {
    var correct = fmtNum(V);
    var set = {}; set[correct] = true;
    var opts = [correct];
    var unit = Math.max(1, Math.abs(V) * spread / 100); // 扰动步长，V=0 时用整数
    var deltas = [1, -1, 2, -2, 3, 1, -3, 2, -1, 3];
    var cur = 0, guard = 0;
    while (opts.length < 4 && guard++ < 400) {
      var d = deltas[cur % deltas.length]; cur++;
      var val = Math.round(V + d * unit);
      var s = fmtNum(val);
      if (!set[s]) { set[s] = true; opts.push(s); }
    }
    if (opts.length < 4) { // 保险：不依赖 + 扰动，直接给一档整数偏移
      var k = 1;
      while (opts.length < 4) {
        var extra = fmtNum(Math.round(V + k * unit));
        if (!set[extra]) { set[extra] = true; opts.push(extra); }
        k++;
      }
    }
    var order = shuffle(opts);
    return { options: order, ans: correct, ansIdx: order.indexOf(correct) };
  }

  function genQuestion(opts, r, tier) {
    var focus = opts.focus;
    // mix 轮转全部 11 个技巧；专项模式取 FOCUS_GENS 对应子集
    var idxs = focus === "mix" ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : FOCUS_GENS[focus];
    var i = opts.i, shift = opts.mixShift || 0;
    return GENS[idxs[(i + shift) % idxs.length]](r, tier);
  }

  function buildSet(opts, count, r) {
    var list = [];
    var mixShift = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])[0];
    for (var i = 0; i < count; i++) {
      var tier = tierOf(i, count);
      var q = genQuestion({ focus: opts.focus, i: i, count: count, mixShift: mixShift }, r, tier);
      var spread = spreadFor(tier, r);
      var optsQ = makeOptions(q.a, spread, r);
      list.push({
        q: q.q, raw: q.a, tag: q.tag || "", hint: q.hint || "", ans: optsQ.ans,
        opts: optsQ.options, ansIdx: optsQ.ansIdx,
        tier: tier, spread: spread
      });
    }
    return list;
  }

  function tierOf(i, count) {
    if (count <= 10) {
      if (i < 3) return 0;
      if (i < 7) return 1;
      return 2;
    }
    if (i < 6) return 0;
    if (i < 14) return 1;
    return 2;
  }

  /* ---------- 状态 ---------- */
  var state = {
    focus: "mix", count: 10, idx: 0, score: 0,
    list: [], wrong: [], startTime: 0, timerId: null, elapsed: 0, busy: false
  };

  var FOCI = [
    { v: "mix", t: "混合", d: "全技巧 · 选最贴近" },
    { v: "add", t: "加减", d: "高位叠加 · 凑整" },
    { v: "mul", t: "乘除", d: "错位 · 拆分 · 百化分" },
    { v: "pct", t: "分数百分", d: "分数乘 · 增长量" }
  ];
  var COUNTS = [10, 20];
  var bestKey = function () { return "kb-prac-best-" + state.count + "-" + state.focus; };

  /* ---------- 渲染 ---------- */
  function renderSetup() {
    document.body.classList.remove("is-playing");
    var best = lsGet(bestKey());
    var tierDots = "";
    for (var i = 0; i < state.count; i++) {
      tierDots += "<span class='tdot t" + tierOf(i, state.count) + "'></span>";
    }
    root.innerHTML =
      "<div class='setup'>" +
        "<div class='setup-title'>开始一局速算</div>" +
        "<div class='setup-sub' id='set-sub'>融合《速算》技巧出「估算」题 · 四选一选最贴近 · 随日期换一套</div>" +
        "<div class='setup-blk'><div class='setup-label'>题型</div><div class='chip-row'>" +
          FOCI.map(function (c) {
            return "<button class='chip" + (state.focus === c.v ? " on" : "") + "' data-focus='" + c.v + "'><span>" + c.t + "</span><small>" + c.d + "</small></button>";
          }).join("") +
        "</div></div>" +
        "<div class='setup-blk'><div class='setup-label'>题量</div><div class='chip-row small' id='count-row'>" +
          COUNTS.map(function (c) {
            return "<button class='chip s' data-count='" + c + "'>" + c + " 题</button>";
          }).join("") +
        "</div></div>" +
        "<div class='setup-blk'><div class='setup-label'>难度弧线</div><div class='tier-line'>" + tierDots + "</div>" +
          "<div class='tier-legend'><span>简单</span><span>中等</span><span>困难</span></div></div>" +
        (best != null
          ? "<div class='setup-sub bestline'>💪 本组最佳：<b>" + esc(best) + "</b>/" + state.count + "</div>"
          : "") +
        "<button class='start-btn' id='start-btn'>开始</button>" +
      "</div>";
    root.querySelectorAll("[data-focus]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.focus = b.getAttribute("data-focus");
        FOCI.forEach(function (c) {}); // no-op
        renderSetup();
      });
    });
    root.querySelectorAll("[data-count]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.count = parseInt(b.getAttribute("data-count"), 10);
        renderSetup();
      });
    });
    var sb = root.querySelector("#start-btn");
    if (sb) sb.addEventListener("click", function () { startGame(); });
  }

  function startGame() {
    document.body.classList.add("is-playing");
    var r = makeRnd();
    state.list = buildSet({ focus: state.focus }, state.count, r);
    state.idx = 0; state.score = 0; state.wrong = [];
    state.elapsed = 0;
    state.busy = false;
    state.startTime = Date.now();
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = setInterval(function () {
      state.elapsed = Math.floor((Date.now() - state.startTime) / 1000);
      var el = root.querySelector("#time-val");
      if (el) el.textContent = fmtTime(state.elapsed);
    }, 1000);
    renderQuestion();
  }

  function fmtTime(t) {
    var m = Math.floor(t / 60), s = t % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function renderQuestion() {
    var item = state.list[state.idx];
    var idx = state.idx, n = state.list.length;
    var pct = Math.round(idx / n * 100);
    var tierTag = TIER_TAG[item.tier];
    var tech = item.tag || tierTag;
    var hint = item.hint ? "<span class='q-hint'>" + esc(item.hint) + "</span>" : "";
    root.innerHTML =
      "<div class='game-hud'>" +
        "<div class='hud-pair'><span class='hud-label'>第</span><span class='hud-q'>" + (idx + 1) + "</span><span class='hud-label'>/" + n + "</span></div>" +
        "<div class='hud-right'><span class='hud-score'>✓ " + state.score + "</span><span class='hud-time' id='time-val'>" + fmtTime(state.elapsed) + "</span></div>" +
      "</div>" +
      "<div class='game-progress'><div class='bar' style='width:" + pct + "%'></div></div>" +
      "<div class='game-pad'>" +
        "<div class='qwrap'>" +
          "<div class='q-tier tier" + item.tier + "'>" + esc(tech) + "<span class='q-tsep'>·</span>" + esc(tierTag) + hint + "</div>" +
          "<div class='q-big q-practice'>" + esc(item.q) + "</div>" +
        "</div>" +
        "<div class='opt-grid'>" +
          item.opts.map(function (o, i) {
            return "<button class='opt quiz' data-i='" + i + "'><span class='opt-key'>" + "ABCD"[i] + "</span><span class='opt-text'>" + esc(o) + "</span></button>";
          }).join("") +
        "</div>" +
      "</div>";
    root.querySelectorAll(".opt").forEach(function (b) {
      b.addEventListener("click", function () { chooseOpt(b); });
    });
  }

  function chooseOpt(btn) {
    if (state.busy) return;
    state.busy = true;
    var item = state.list[state.idx];
    var ansIdx = item.ansIdx;
    var chosen = parseInt(btn.getAttribute("data-i"), 10);
    var opts = root.querySelectorAll(".opt");
    opts.forEach(function (b) {
      if (parseInt(b.getAttribute("data-i"), 10) === ansIdx) b.classList.add("correct");
      b.disabled = true;
    });
    if (chosen !== ansIdx) {
      btn.classList.add("wrong");
      state.wrong.push({ q: item.q, ans: item.ans, ua: item.opts[chosen], tag: item.tag });
    } else {
      state.score++;
    }
    setTimeout(function () {
      state.idx++;
      state.busy = false;
      if (state.idx >= state.list.length) renderResult();
      else renderQuestion();
    }, 700);
  }

  function renderResult() {
    if (state.timerId) clearInterval(state.timerId);
    var total = state.list.length;
    var grade = gradeOf(state.score, total);
    var wrongCount = state.wrong.length;
    // 保存最佳
    var key = bestKey();
    var prev = lsGet(key);
    var best = prev ? parseInt(prev, 10) : -1;
    if (state.score > best) lsSet(key, String(state.score));

    var rv = "";
    if (wrongCount) {
      rv = "<div class='review'><div class='review-title'>错题复盘</div>" +
        "<div class='review-list'>" +
          state.wrong.map(function (w) {
            return "<div class='rv-item'><span class='rv-tag'>" + esc(w.tag || "") + "</span><span class='rv-q'>" + esc(w.q) + "</span><span class='rv-arrow'>→</span><span class='rv-a'>" + esc(w.ans) + "</span><span class='rv-ua'>你选 " + esc(w.ua) + "</span></div>";
          }).join("") +
        "</div></div>";
    } else {
      rv = "<div class='review'><div class='review-title'>错题复盘</div><div class='review-none'>全对，手感很稳！</div></div>";
    }

    root.innerHTML =
      "<div class='game-pad result'>" +
        "<div class='result-tip'>本组完成</div>" +
        "<div class='result-score' style='color:" + grade.color + "'>" + grade.score + "</div>" +
        "<div class='result-total'><span>" + state.score + "</span> / " + total + "</div>" +
        "<div class='result-grade' style='color:" + grade.color + "'>" + esc(grade.txt) + "</div>" +
        "<div class='result-stats'>" +
          "<div class='r-stat'><span>用时</span><b>" + fmtTime(state.elapsed) + "</b></div>" +
          "<div class='r-stat'><span>准确率</span><b>" + Math.round(state.score / total * 100) + "%</b></div>" +
          "<div class='r-stat'><span>最佳</span><b>" + best + "</b></div>" +
        "</div>" +
        rv +
        "<div class='result-actions'>" +
          "<button class='gbtn' id='again-btn'>再来一组</button>" +
          "<button class='gbtn primary' id='home-btn'>换个题型</button>" +
        "</div>" +
      "</div>";

    var again = root.querySelector("#again-btn");
    if (again) again.addEventListener("click", function () { startGame(); });
    var home = root.querySelector("#home-btn");
    if (home) home.addEventListener("click", function () {
      if (state.timerId) clearInterval(state.timerId);
      renderSetup();
    });
  }

  function gradeOf(s, total) {
    var p = s / total;
    if (p === 1) return { txt: "满分，稳！", score: "S", color: "#a8842a" };
    if (p >= 0.9) return { txt: "手速与准确兼具", score: "A", color: "#7ba05b" };
    if (p >= 0.7) return { txt: "有数，再练几分", score: "B", color: "#8a8f7a" };
    if (p >= 0.5) return { txt: "值得再加一方", score: "C", color: "#b0596a" };
    return { txt: "先把速算方法吃透", score: "D", color: "#a95c49" };
  }

  /* 初次渲染 */
  renderSetup();
})();
