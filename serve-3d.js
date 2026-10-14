/**
 * Minimal static server for tribo-3d.html + assets
 * Serves: public/ at root + src/assets/ under /assets/
 * Usage: node serve-3d.js  (then open http://localhost:4300/tribo-3d.html)
 */
const http = require("http");
const fs   = require("fs");
const path = require("path");

const PORT = 4300;
const MIME = {
  ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
  ".glb":  "model/gltf-binary", ".png": "image/png", ".jpg": "image/jpeg",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".json": "application/json", ".woff2": "font/woff2", ".woff": "font/woff",
};

// Ordered list of root directories tried in sequence
const ROOTS = [
  path.join(__dirname, "public"),       // public/ → served at /
  path.join(__dirname, "src", "assets") // src/assets/ → served at /assets/
];

function tryFile(roots, urlPath, res) {
  if (!roots.length) { res.writeHead(404); res.end("Not found: " + urlPath); return; }
  const [root, ...rest] = roots;
  const file = path.join(root, urlPath);
  // Security: ensure file is inside root
  if (!file.startsWith(root)) { res.writeHead(403); res.end("Forbidden"); return; }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) { tryFile(rest, urlPath, res); return; }
    const ext  = path.extname(file).toLowerCase();
    const mime = MIME[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type":  mime,
      "Content-Length": stat.size,
      "Cache-Control": "no-cache",
      // Required for SharedArrayBuffer (optional here but good practice)
      "Cross-Origin-Opener-Policy":  "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/" || urlPath === "") urlPath = "/index.html";

  // /assets/... → look in src/assets/ first, then public/assets/
  if (urlPath.startsWith("/assets/")) {
    const subPath = urlPath.slice("/assets/".length);
    const srcFile = path.join(__dirname, "src", "assets", subPath);
    const pubFile = path.join(__dirname, "public", "assets", subPath);
    fs.stat(srcFile, (err, s) => {
      if (!err && s.isFile()) {
        const ext  = path.extname(srcFile).toLowerCase();
        const mime = MIME[ext] || "application/octet-stream";
        res.writeHead(200, { "Content-Type": mime, "Content-Length": s.size, "Cache-Control": "no-cache" });
        fs.createReadStream(srcFile).pipe(res);
      } else {
        tryFile([path.join(__dirname, "public")], urlPath, res);
      }
    });
    return;
  }

  tryFile([path.join(__dirname, "public")], urlPath, res);
});

server.listen(PORT, () => {
  console.log("\n  \u2714 Tribo 3D static server running");
  console.log("  \u25b6 http://localhost:" + PORT + "/tribo-3d.html\n");
});
