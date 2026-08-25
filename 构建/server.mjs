// =========================================================
// 考公复习知识库 · 本地预览服务器
// 用法：node 构建/server.mjs   (默认 http://localhost:3767)
// 把 网站/ 目录作为静态站点提供，支持中文文件名
// =========================================================

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "网站");
const PORT = Number(process.env.PORT || 3767);
const HOST = process.env.HOST || "0.0.0.0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  } catch {
    res.writeHead(400); res.end("Bad Request"); return;
  }
  if (urlPath === "/" || urlPath === "") urlPath = "/index.html";

  let filePath = path.normalize(path.join(PUBLIC_DIR, urlPath));
  // 防目录穿越
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found: " + urlPath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  const local = `http://localhost:${PORT}`;
  console.log("======================================================");
  console.log("  考公复习知识库 · 本地预览已启动");
  console.log("  本机访问:   " + local);
  console.log("  局域网访问: http://<本机IP>:" + PORT + "   (手机连同一 WiFi 可用)");
  console.log("  按 Ctrl+C 停止");
  console.log("======================================================");
});
