// =========================================================
// 考公复习知识库 · 构建脚本
// 读 笔记/目录.json + 各模块 .md，按「章节」拆分成独立页，
// 生成 网站/ 下的静态网页 + 百化分匹配小游戏页。
// 用法：node 构建/build.mjs
// =========================================================

import { marked } from "marked";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const NOTES_DIR = path.join(ROOT, "笔记");
const OUT_DIR = path.join(ROOT, "网站");
const ASSETS_DIR = path.join(OUT_DIR, "assets");
const CONFIG_PATH = path.join(NOTES_DIR, "目录.json");

// 确保输出目录存在（本地可能已存在，CI 干净环境需要）
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(ASSETS_DIR, { recursive: true });

marked.setOptions({ gfm: true, breaks: false });

function readText(p) { return fs.readFileSync(p, "utf8"); }
function safeName(s) { return s.replace(/[\\/:*?"<>|]/g, "_"); }
function enc(s) { return encodeURIComponent(s); }

// ---------- 模块主题（日式素雅配色） ----------
const THEME = {
  "常识判断":        { emoji: "🏮", ac: "#3f5d7d", tone: "藍" },   // 蓝
  "言语理解与表达":  { emoji: "🍃", ac: "#a8842a", tone: "山吹" }, // 山吹
  "数量关系":        { emoji: "🧮", ac: "#a8543f", tone: "朱" },    // 朱
  "判断推理":        { emoji: "🧩", ac: "#7d6a9b", tone: "藤" },    // 藤
  "资料分析":        { emoji: "📊", ac: "#5f8f6e", tone: "青竹" },  // 青竹
  "速算":           { emoji: "⚡", ac: "#b0596a", tone: "茜" },    // 茜
  "申论":           { emoji: "✍️", ac: "#3a5a8c", tone: "群青" },  // 群青
};
function themeFor(name) {
  return THEME[name] || { emoji: "📄", ac: "#4a4a4a", tone: "墨" };
}

// 百化分速查数据（分数 → 百分数）
const PAIRS = [
  ["1/2", "50%"], ["1/3", "33.3%"], ["1/4", "25%"], ["1/5", "20%"],
  ["1/6", "16.7%"], ["1/7", "14.3%"], ["1/8", "12.5%"], ["1/9", "11.1%"],
  ["1/10", "10%"], ["1/11", "9.1%"], ["1/12", "8.3%"], ["1/13", "7.7%"],
  ["1/14", "7.1%"], ["1/15", "6.7%"], ["1/16", "6.25%"], ["1/17", "5.9%"],
  ["1/18", "5.6%"], ["1/19", "5.3%"], ["1/20", "5%"], ["1/25", "4%"],
  ["1/30", "3.33%"], ["1/40", "2.5%"], ["1/50", "2%"], ["1/60", "1.67%"],
  ["1/80", "1.25%"], ["1/100", "1%"], ["2/3", "66.7%"], ["2/5", "40%"],
  ["3/5", "60%"], ["4/5", "80%"], ["3/4", "75%"], ["5/6", "83.3%"]
];

// ---------- 小工具 ----------
function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// 从文本抽一句比较完整的简介
function introOf(text, len) {
  const clean = text
    .replace(/[^\u4e00-\u9fa5A-Za-z0-9，。、：；！？%+\-×÷≈·]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.slice(0, len || 72);
}

// 给标题加锚点 id，并收集目录
function addAnchors(html) {
  const toc = [];
  let n = 0;
  const re = /<h([1-4])\b([^>]*)>([\s\S]*?)<\/h\1>/g;
  html = html.replace(re, (m, level, attrs, inner) => {
    n += 1;
    const id = "sec-" + n;
    const text = stripTags(inner);
    toc.push({ level: +level, id, text });
    const a = attrs.replace(/\bid="[^"]*"/g, "");
    return `<h${level}${a} id="${id}">${inner}</h${level}>`;
  });
  return { html, toc };
}

// 给表格外包一层横向滚动容器
function wrapTables(html) {
  return html.replace(/<table>([\s\S]*?)<\/table>/g, (m, body) => {
    return `<div class="table-wrap"><table>${body}</table></div>`;
  });
}

// ---------- 读取配置 ----------
const config = JSON.parse(readText(CONFIG_PATH));
const siteTitle = config["站点标题"] || "考公复习知识库";
const siteDesc = config["站点描述"] || "";
const sections = config["板块"] || [];

// 拍平模块列表（有序，用于上/下篇）
const allModules = [];
sections.forEach((sec) => {
  (sec["模块"] || []).forEach((name) => {
    allModules.push({ section: sec["名称"], name });
  });
});
function findModule(name) {
  const i = allModules.findIndex((m) => m.name === name);
  return i === -1 ? null : allModules[i];
}

// ---------- 解析一篇笔记（按 # 章节拆分） ----------
function parseNote(moduleName) {
  const mdPath = path.join(NOTES_DIR, safeName(moduleName) + ".md");
  if (!fs.existsSync(mdPath)) {
    return { exists: false, title: moduleName, intro: "等待补充内容", chapters: [], text: "" };
  }

  let md = readText(mdPath);
  const lines = md.split("\n");
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  let title = moduleName;
  if (i < lines.length && /^#\s+/.test(lines[i].trim())) {
    title = lines[i].trim().replace(/^#\s+/, "").trim();
    i++;
  }

  // 按二级 # 分章
  const chunks = [];
  let cur = null;
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (/^#\s+/.test(l)) {
      if (cur) chunks.push(cur);
      cur = { title: l.replace(/^#\s+/, "").trim(), body: [] };
    } else {
      if (!cur) cur = { title: null, body: [] };
      cur.body.push(l);
    }
  }
  if (cur) chunks.push(cur);

  let named = chunks.filter((c) => c.title);
  if (named.length === 0) {
    named = [{ title: null, body: chunks.flatMap((c) => c.body).join("\n") }];
  }

  const chapters = named.map((ch) => {
    const mdText = ch.body.join("\n").trim();
    const html = wrapTables(marked.parse(mdText));
    const { html: annotated, toc } = addAnchors(html);
    const chapterToc = toc.filter((t) => t.level > 1);
    const prose = annotated.replace(/^\s*<h1[\s\S]*?<\/h1>\s*/, "");
    const text = stripTags(prose);
    return {
      title: ch.title || title,
      html: prose,
      toc: chapterToc,
      count: chapterToc.length,
      text,
      intro: introOf(text, 60),
    };
  });

  const text = chapters.map((c) => c.text).join(" ");
  const intro =
    (chapters[0] && chapters[0].intro) ||
    introOf(stripTags(chapters[0] ? chapters[0].html : ""), 90) ||
    "等待补充内容";

  return { exists: true, title, intro, chapters, text };
}

// ---------- 目录分组 ----------
function buildTocGroups(toc, label) {
  const group = [];
  const groups = [];
  function flush() {
    if (group.length) {
      const first = group[0];
      groups.push({
        title: first.level <= 1 ? first.text : label,
        items: group.filter((t) => t.level > 1),
      });
      group.length = 0;
    }
  }
  toc.forEach((t) => {
    if (t.level <= 1) flush();
    group.push(t);
  });
  flush();
  if (groups.length === 1 && groups[0].title === label) {
    return groups.map((g) => ({ title: "", items: g.items }));
  }
  return groups;
}

function renderTocHtml(groups) {
  if (!groups.length || groups.every((g) => !g.items.length)) return "";
  const inner = groups
    .map((g) => {
      const gTitle = g.title
        ? `<button class="toc-gh" type="button"><span class="g-caret">▾</span>${escapeHtml(g.title)}</button>`
        : "";
      const lis = g.items
        .map((t) => `<li><a href="#${t.id}">${escapeHtml(t.text)}</a></li>`)
        .join("");
      return `<div class="toc-group${g.title ? "" : " flat"}${g.title ? " open" : ""}">${gTitle}<ul class="toc-body">${lis}</ul></div>`;
    })
    .join("");
  return `<div class="toc-card reveal" style="--d:.15s">
    <div class="toc-head"><span class="toc-mark">目</span><span class="toc-label">本篇目录</span></div>
    <div class="toc-nav">${inner}</div>
  </div>`;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------- 页面骨架 ----------
function layout(opts) {
  const { body, theme, activeMenu, title, desc, extra, extraScript } = opts;
  const ac = theme.ac;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="theme-color" content="#f6f4ef" />
<title>${escapeHtml(title)} · ${escapeHtml(siteTitle)}</title>
<meta name="description" content="${escapeHtml(desc || siteDesc)}" />
<style>:root{--ac:${ac};}</style>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="stylesheet" href="assets/style.css" />
${extra || ""}
<script>try{if(localStorage.getItem("kb-theme")==="dark")document.documentElement.classList.add("dark");}catch(e){}</script>
<script>try{var _m=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;if(!_m)document.documentElement.classList.add("anim");}catch(e){}</script>
</head>
<body>
<div class="grain"></div>
<header class="topbar">
  <div class="topbar-inner">
    <a class="brand" href="index.html">
      <span class="brand-logo">考</span>
      <span class="brand-text"><span class="brand-title">${escapeHtml(siteTitle)}</span><span class="brand-sub">每日复盘 · 复习手帐</span></span>
    </a>
    <nav class="topnav">
      <a class="nav-link${activeMenu === "home" ? " on" : ""}" href="index.html">首页</a>
      <a class="nav-link${activeMenu === "game" ? " on" : ""}" href="百化分游戏.html">小游戏</a>
      <button class="theme-btn" id="theme-toggle" type="button" aria-label="切换主题">✦</button>
    </nav>
  </div>
</header>
${body}
<footer class="foot">${escapeHtml(siteTitle)} · ${new Date().getFullYear()} · 本地复习手帐，静心而作</footer>
<script src="assets/app.js"></script>
${extraScript || ""}
</body>
</html>`;
}

// ---------- 首页 ----------
function buildIndex(notesMap) {
  const secCards = sections
    .map((sec) => {
      const mods = (sec["模块"] || [])
        .map((name) => {
          const n = notesMap[name];
          const t = themeFor(name);
          const count = n && n.exists ? `${n.chapters.length} 章` : "待补充";
          const desc = n && n.exists ? n.intro : "尚在整理，敬请期待";
          return `<a class="card reveal" style="--ac:${t.ac};--d:.18s" href="${enc(name)}.html">
            <div class="card-top"><span class="c-emoji">${t.emoji}</span><span class="c-count">${count}</span></div>
            <div class="c-name">${escapeHtml(name)}</div>
            <div class="c-desc">${escapeHtml(desc)}</div>
            <div class="c-go">开卷 <span class="arr">→</span></div>
          </a>`;
        })
        .join("");
      return `<section class="group reveal" style="--d:.08s">
        <div class="group-head"><span class="g-num">sec</span><h2 class="g-title">${escapeHtml(sec["名称"])}</h2><span class="g-en">${escapeHtml(sec["名称"] === "行测" ? "GYOKUSOKU" : "RONBUN")}</span><span class="g-note">${escapeHtml(sec["描述"] || "")}</span></div>
        <div class="cards">${mods}</div>
      </section>`;
    })
    .join("");

  const body = `<main class="container">
    <section class="hero reveal" style="--d:.02s">
      <div class="hero-kicker reveal" style="--d:.06s">修身 · 齐家 · 治国 · 平天下</div>
      <h1 class="hero-title reveal" style="--d:.12s">${escapeHtml(siteTitle)}<span class="brush"></span></h1>
      <p class="hero-desc reveal" style="--d:.2s">${escapeHtml(siteDesc)}<br/>${escapeHtml("日拱一卒，功不唐捐。每日翻一页，考场见真章。")}</p>
    </section>
    <div class="search-box reveal" style="--d:.26s">
      <svg viewBox="0 0 24 24" class="s-ico" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      <input id="search-input" type="text" placeholder="搜索知识点，如 百化分 / 增长率 / 同义替换…" autocomplete="off" />
      <div class="search-results" id="search-results"></div>
    </div>
    ${secCards}
  </main>`;

  const extra = `<link rel="stylesheet" href="assets/game.css" />`;
  return layout({ body, theme: { ac: "#4a4a4a" }, activeMenu: "home", title: siteTitle, desc: siteDesc, extra });
}

// ---------- 模块首页（章节列表） ----------
function buildModulePage(sectionName, moduleName, note, prev, next) {
  const t = themeFor(moduleName);
  const chapterCards = note.chapters
    .map((c, i) => {
      const url = `${enc(moduleName)}-${i + 1}.html`;
      return `<a class="chapter-card reveal" style="--ac:${t.ac};--d:${0.14 + i * 0.05}s" href="${url}">
        <div class="cc-num">${String(i + 1).padStart(2, "0")}</div>
        <div class="cc-body">
          <div class="cc-name">${escapeHtml(c.title)}</div>
          <div class="cc-desc">${escapeHtml(c.intro)}</div>
          <div class="cc-meta"><span class="cc-count">${c.count} 节</span><span class="cc-go">阅读 →</span></div>
        </div>
      </a>`;
    })
    .join("");

  const gameCard = moduleName === "速算"
    ? `<a class="chapter-card game-card reveal" style="--ac:#a8842a;--d:.34s" href="百化分游戏.html">
        <div class="cc-num">🎮</div>
        <div class="cc-body">
          <div class="cc-name">百化分 · 每日配对小游戏</div>
          <div class="cc-desc">分数 ↔ 百分数 翻牌配对，把 百化分 练成肌肉记忆。每天玩一把，考试秒算。</div>
          <div class="cc-meta"><span class="cc-count game-badge">小游戏</span><span class="cc-go">开始游戏 →</span></div>
        </div>
      </a>`
    : "";

  const practiceCard = moduleName === "速算"
    ? `<a class="chapter-card game-card rose reveal" style="--ac:#b0596a;--d:.26s" href="速算练习.html">
        <div class="cc-num">⚡</div>
        <div class="cc-body">
          <div class="cc-name">速算 · 每日练习</div>
          <div class="cc-desc">加减乘除 + 百化分 混合随机出题。四选一选最贴近的，限时作答，天天不重样。</div>
          <div class="cc-meta"><span class="cc-count game-badge">专项题</span><span class="cc-go">开始练习 →</span></div>
        </div>
      </a>`
    : "";

  const body = `<main class="container">
    <nav class="navcrumbs reveal" style="--d:.02s">
      <a href="index.html">首页</a><span class="crumb-sep">/</span><span class="crumb-sec">${escapeHtml(sectionName)}</span><span class="crumb-sep">/</span><span class="crumb-cur">${escapeHtml(moduleName)}</span>
    </nav>
    <section class="doc-hero reveal" style="--ac:${t.ac};--d:.06s">
      <div class="hyd-kicker"><span class="hyd-tone">${escapeHtml(t.tone || "")}</span><span class="hyd-tag">${escapeHtml(sectionName)} · ${escapeHtml(moduleName)}</span></div>
      <h1 class="hyd-title">${t.emoji} ${escapeHtml(moduleName)}</h1>
      <p class="hyd-intro">${escapeHtml(note.intro)}</p>
      <div class="hyd-meta"><span class="hm-item">共 ${note.chapters.length} 章</span><span class="hm-item">${note.chapters.reduce((a, c) => a + c.count, 0)} 个小节</span></div>
    </section>
    <div class="module-grid">
      <div class="chapter-list">
        <div class="list-head reveal" style="--d:.1s"><span class="list-mark">目</span><span class="list-label">点击章节，进入细读</span></div>
        ${chapterCards}
        ${practiceCard}
        ${gameCard}
      </div>
      <aside class="side-card reveal" style="--ac:${t.ac};--d:.18s">
        <div class="side-title">复习指引</div>
        <ul class="side-list">
          <li>每章独立成篇，点进去不被打扰</li>
          <li>结合目录跳转，反复回看薄弱点</li>
          <li>速算 → 配套「每日练习」练速度</li>
          <li>百化分 → 「配对小游戏」记熟</li>
        </ul>
      </aside>
    </div>
    ${renderPager(prev, next)}
  </main>`;

  return layout({ body, theme: t, activeMenu: "home", title: moduleName, desc: note.intro });
}

// ---------- 章节页 ----------
function buildChapterPage(sectionName, moduleName, note, chapter, idx, prevCh, nextCh) {
  const t = themeFor(moduleName);
  const tocHtml = renderTocHtml(buildTocGroups(chapter.toc, "本页小节"));
  const body = `<main class="container">
    <nav class="navcrumbs reveal" style="--d:.02s">
      <a href="index.html">首页</a><span class="crumb-sep">/</span><span class="crumb-sec">${escapeHtml(sectionName)}</span><span class="crumb-sep">/</span><a class="crumb-cur" href="${enc(moduleName)}.html">${escapeHtml(moduleName)}</a><span class="crumb-sep">/</span><span class="crumb-cur">${escapeHtml(chapter.title)}</span>
    </nav>
    <section class="doc-hero reveal" style="--ac:${t.ac};--d:.06s">
      <div class="hyd-kicker"><span class="hyd-tone">${escapeHtml(t.tone || "")}</span><span class="hyd-tag">${escapeHtml(moduleName)} · 第 ${idx + 1} 章</span></div>
      <h1 class="hyd-title">${escapeHtml(chapter.title)}</h1>
      <div class="hyd-meta"><span class="hm-item">${chapter.count} 个小节</span></div>
    </section>
    <div class="note-grid">
      ${tocHtml}
      <article class="note-body reveal" style="--d:.16s">
        <div class="prose">${chapter.html}</div>
        <div class="pager chapter-pager">
          <a class="pg-btn${prevCh ? "" : " off"}" href="${prevCh ? `${enc(moduleName)}-${idx}.html` : "#"}">← 上一章</a>
          <a class="pg-btn pg-home" href="${enc(moduleName)}.html">☰ 返回目录</a>
          <a class="pg-btn${nextCh ? "" : " off"}" href="${nextCh ? `${enc(moduleName)}-${idx + 2}.html` : "#"}">下一章 →</a>
        </div>
      </article>
    </div>
  </main>`;

  const desc = introOf(chapter.text, 90);
  return layout({ body, theme: t, activeMenu: "home", title: chapter.title, desc });
}

// ---------- 单主题页（模块只有一章/无章节标题） ----------
function buildSinglePage(sectionName, moduleName, note, prev, next) {
  const t = themeFor(moduleName);
  const ch = note.chapters[0] || { title: note.title, html: "", toc: [], count: 0 };
  const tocHtml = renderTocHtml(buildTocGroups(ch.toc, "本页小节"));
  const body = `<main class="container">
    <nav class="navcrumbs reveal" style="--d:.02s">
      <a href="index.html">首页</a><span class="crumb-sep">/</span><span class="crumb-sec">${escapeHtml(sectionName)}</span><span class="crumb-sep">/</span><span class="crumb-cur">${escapeHtml(moduleName)}</span>
    </nav>
    <section class="doc-hero reveal" style="--ac:${t.ac};--d:.06s">
      <div class="hyd-kicker"><span class="hyd-tone">${escapeHtml(t.tone || "")}</span><span class="hyd-tag">${escapeHtml(sectionName)} · ${escapeHtml(moduleName)}</span></div>
      <h1 class="hyd-title">${t.emoji} ${escapeHtml(note.title)}</h1>
      <p class="hyd-intro">${escapeHtml(note.intro)}</p>
    </section>
    <div class="note-grid">
      ${tocHtml}
      <article class="note-body reveal" style="--d:.16s">
        <div class="prose">${ch.html}</div>
        ${renderPager(prev, next)}
      </article>
    </div>
  </main>`;

  return layout({ body, theme: t, activeMenu: "home", title: note.title, desc: note.intro });
}

// ---------- 上一/下一篇（模块级） ----------
function renderPager(prev, next) {
  return `<div class="pager">
    <a class="pg-btn${prev ? "" : " off"}" href="${prev ? `${enc(prev.name)}.html` : "#"}">← ${prev ? escapeHtml(prev.name) : "已到起点"}</a>
    <a class="pg-btn pg-home" href="index.html">☰ 回到首页</a>
    <a class="pg-btn${next ? "" : " off"}" href="${next ? `${enc(next.name)}.html` : "#"}">${next ? escapeHtml(next.name) : "已是终章"} →</a>
  </div>`;
}

// ---------- 百化分小游戏页 ----------
function buildGamePage() {
  const body = `<main class="container">
    <nav class="navcrumbs reveal" style="--d:.02s">
      <a href="index.html">首页</a><span class="crumb-sep">/</span><span class="crumb-cur">百化分 · 配对小游戏</span>
    </nav>
    <section class="doc-hero game-hero reveal" style="--ac:#a8842a;--d:.06s">
      <div class="hyd-kicker"><span class="hyd-tone">山吹</span><span class="hyd-tag">速算 · 专项练习</span></div>
      <h1 class="hyd-title">🎮 百化分 · 每日配对小游戏</h1>
      <p class="hyd-intro">把一个分数和它对应的百分数配对。玩着玩着，百化分就成了肌肉记忆。</p>
      <div class="hyd-meta"><span class="hm-item" id="today-count">今日：—</span><span class="hm-item" id="best-score">最佳：—</span></div>
    </section>
    <div class="game-wrap reveal" style="--d:.14s" id="game"></div>
    <div class="gamelinks reveal" style="--d:.22s">
      <a class="game-link" href="百化分速查.html">📖 打开百化分速查总表</a>
      <a class="game-link" href="速算练习.html">⚡ 去练速算题 →</a>
    </div>
  </main>`;
  const extra = `<link rel="stylesheet" href="assets/game.css" />`;
  const extraScript = `<script src="assets/game.js"></script>`;
  return layout({ body, theme: { ac: "#a8842a" }, activeMenu: "game", title: "百化分 · 配对小游戏", desc: "分数 ↔ 百分数 匹配练习小游戏", extra, extraScript });
}

// ---------- 百化分速查总表（独立页，不占游戏界面） ----------
function refRows() {
  const cols = 3;
  const per = Math.ceil(PAIRS.length / cols);
  const rows = [];
  for (let r = 0; r < per; r++) {
    let cells = "";
    for (let c = 0; c < cols; c++) {
      const idx = r + c * per;
      const pr = PAIRS[idx];
      cells += pr ? `<td>${pr[0]}</td><td>${pr[1]}</td>` : `<td></td><td></td>`;
    }
    rows.push(`<tr>${cells}</tr>`);
  }
  return rows.join("");
}
function buildSpeedTablePage() {
  const body = `<main class="container">
    <nav class="navcrumbs reveal" style="--d:.02s">
      <a href="index.html">首页</a><span class="crumb-sep">/</span><a class="crumb-cur" href="速算.html">速算</a><span class="crumb-sep">/</span><span class="crumb-cur">百化分 · 速查总表</span>
    </nav>
    <section class="doc-hero reveal" style="--ac:#a8842a;--d:.06s">
      <div class="hyd-kicker"><span class="hyd-tone">山吹</span><span class="hyd-tag">速算 · 速查总表</span></div>
      <h1 class="hyd-title">📖 百化分速查总表</h1>
      <p class="hyd-intro">分数 ↔ 百分数 一一对应。做题时看到百分数，秒变「÷n」再算，又快又准。</p>
      <div class="hyd-meta"><span class="hm-item">共 ${PAIRS.length} 组</span><span class="hm-item">配对小游戏可反复练</span></div>
    </section>
    <div class="reference-wrap reveal" style="--d:.14s">
      <div class="ref-card">
        <div class="ref-head"><span>📌 百化分速查</span></div>
        <div class="ref-body"><table class="ref-table"><thead><tr><th>分数</th><th>百分数</th><th>分数</th><th>百分数</th><th>分数</th><th>百分数</th></tr></thead><tbody>${refRows()}</tbody></table></div>
      </div>
      <p class="game-foot-note">提示：把百分数拆成「÷n」来算。12.5% = ÷8，16.7% = ÷6，33.3% = ÷3，20% = ÷5。练熟后《速算练习》就快了。</p>
    </div>
  </main>`;
  const extra = `<link rel="stylesheet" href="assets/game.css" /><link rel="stylesheet" href="assets/reference.css" />`;
  return layout({ body, theme: { ac: "#a8842a" }, activeMenu: "game", title: "百化分 · 速查总表", desc: "分数 ↔ 百分数 对照速查表", extra });
}

// ---------- 速算 · 每日练习（随机四选一出题） ----------
function buildPracticePage() {
  const body = `<main class="container">
    <nav class="navcrumbs reveal" style="--d:.02s">
      <a href="index.html">首页</a><span class="crumb-sep">/</span><a class="crumb-cur" href="速算.html">速算</a><span class="crumb-sep">/</span><span class="crumb-cur">速算 · 每日练习</span>
    </nav>
    <section class="doc-hero reveal" style="--ac:#b0596a;--d:.06s">
      <div class="hyd-kicker"><span class="hyd-tone">茜</span><span class="hyd-tag">速算 · 专项练习</span></div>
      <h1 class="hyd-title">⚡ 速算 · 每日练习</h1>
      <p class="hyd-intro">加减乘除 + 百化分混合随机出题。四选一选最贴近的，限时作答，每天不重样。</p>
      <div class="hyd-meta"><span class="hm-item">由易到难</span><span class="hm-item">逐题计分 · 错题复盘</span></div>
    </section>
    <div class="game-wrap reveal" style="--d:.14s" id="practice"></div>
  </main>`;
  const extra = `<link rel="stylesheet" href="assets/game.css" /><link rel="stylesheet" href="assets/practice.css" />`;
  const extraScript = `<script src="assets/practice.js"></script>`;
  return layout({ body, theme: { ac: "#b0596a" }, activeMenu: "game", title: "速算 · 每日练习", desc: "加减乘除 + 百化分 混合速算练习", extra, extraScript });
}

// ---------- 组装 ----------
const notesMap = {};
const pages = [];

sections.forEach((sec) => {
  (sec["模块"] || []).forEach((name) => {
    const note = parseNote(name);
    notesMap[name] = note;
    pages.push({ name, url: safeName(name) + ".html", note });
  });
});

// 生成模块页 + 章节页
pages.forEach((p, mi) => {
  const { name, note } = p;
  const modIndex = allModules.findIndex((m) => m.name === name);
  const prev = modIndex > 0 ? allModules[modIndex - 1] : null;
  const next = modIndex < allModules.length - 1 ? allModules[modIndex + 1] : null;
  const sec = sections.find((s) => (s["模块"] || []).includes(name));
  const secName = sec ? sec["名称"] : "";

  if (!note.exists) {
    const page = layout({
      body: `<main class="container">
        <section class="doc-hero reveal" style="--ac:${themeFor(name).ac};--d:.06s">
          <div class="hyd-kicker"><span class="hyd-tone">${escapeHtml(themeFor(name).tone)}</span><span class="hyd-tag">${escapeHtml(secName)} · ${escapeHtml(name)}</span></div>
          <h1 class="hyd-title">${themeFor(name).emoji} ${escapeHtml(name)}</h1>
          <p class="hyd-intro">本篇尚在整理，敬请期待。</p>
        </section>
        <div class="placeholder reveal" style="--ac:${themeFor(name).ac};--d:.14s">✎ 内容整理中</div>
        ${renderPager(prev, next)}
      </main>`,
      theme: themeFor(name),
      activeMenu: "home",
      title: name,
      desc: "等待补充",
    });
    fs.writeFileSync(path.join(OUT_DIR, safeName(name) + ".html"), page);
    return;
  }

  const multi = note.chapters.length > 1;
  if (multi) {
    // 模块首页
    fs.writeFileSync(path.join(OUT_DIR, safeName(name) + ".html"), buildModulePage(secName, name, note, prev, next));
    // 每章一页
    note.chapters.forEach((ch, ci) => {
      const prevCh = ci > 0 ? note.chapters[ci - 1] : null;
      const nextCh = ci < note.chapters.length - 1 ? note.chapters[ci + 1] : null;
      const fname = `${safeName(name)}-${ci + 1}.html`;
      fs.writeFileSync(path.join(OUT_DIR, fname), buildChapterPage(secName, name, note, ch, ci, prevCh, nextCh));
    });
  } else {
    fs.writeFileSync(path.join(OUT_DIR, safeName(name) + ".html"), buildSinglePage(secName, name, note, prev, next));
  }
});

// 首页
fs.writeFileSync(path.join(OUT_DIR, "index.html"), buildIndex(notesMap));

// 搜索索引（按章节粒度）
const searchIndex = [];
pages.forEach((p) => {
  const { name, note } = p;
  if (!note.exists) return;
  if (note.chapters.length > 1) {
    note.chapters.forEach((ch, ci) => {
      searchIndex.push({
        title: ch.title,
        url: `${enc(name)}-${ci + 1}.html`,
        mode: name,
        text: ch.text,
        headings: ch.toc.map((t) => t.text),
      });
    });
  } else {
    searchIndex.push({
      title: note.title,
      url: `${enc(name)}.html`,
      mode: name,
      text: note.text,
      headings: note.chapters[0] ? note.chapters[0].toc.map((t) => t.text) : [],
    });
  }
});
fs.writeFileSync(path.join(OUT_DIR, "assets", "search-index.json"), JSON.stringify(searchIndex, null, 0));

// 百化分小游戏页
fs.writeFileSync(path.join(OUT_DIR, "百化分游戏.html"), buildGamePage());

// 速算 · 每日练习 + 百化分速查总表
fs.writeFileSync(path.join(OUT_DIR, "速算练习.html"), buildPracticePage());
fs.writeFileSync(path.join(OUT_DIR, "百化分速查.html"), buildSpeedTablePage());

console.log(
  "构建完成。板块 " + sections.length + "，模块 " + allModules.length +
  "，已填充 " + pages.filter((p) => p.note.exists).length + " 篇，章节 " +
  pages.reduce((a, p) => a + p.note.chapters.length, 0) + " 个，游戏页 1 个，速算练习 1 个，速查表 1 个。"
);
