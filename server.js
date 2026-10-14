// Máy chủ nhỏ dùng Node.js core modules, không cần npm install.
// Chạy: node server.js  |  Mở: http://localhost:3000
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const MIME = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".json":"application/json; charset=utf-8", ".txt":"text/plain; charset=utf-8", ".svg":"image/svg+xml", ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".webp":"image/webp", ".ico":"image/x-icon" };
const allowed = (host) => host === "dantri.com.vn" || host.endsWith(".dantri.com.vn");

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" });
  res.end(body);
}

async function proxyFetch(reqUrl, res) {
  const raw = reqUrl.searchParams.get("url");
  if (!raw) return send(res, 400, JSON.stringify({ error: "Thiếu tham số url." }), "application/json; charset=utf-8");
  let target;
  try { target = new URL(raw); } catch (_) { return send(res, 400, JSON.stringify({ error: "URL không hợp lệ." }), "application/json; charset=utf-8"); }
  if (!/^https?:$/.test(target.protocol) || !allowed(target.hostname.toLowerCase())) {
    return send(res, 400, JSON.stringify({ error: "Chỉ cho phép URL thuộc dantri.com.vn." }), "application/json; charset=utf-8");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);
  try {
    const upstream = await fetch(target.href, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/132 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7"
      }
    });
    if (!allowed(new URL(upstream.url).hostname.toLowerCase())) return send(res, 502, JSON.stringify({ error: "Nguồn chuyển hướng sang tên miền không được phép." }), "application/json; charset=utf-8");
    const contentType = upstream.headers.get("content-type") || "";
    if (!upstream.ok) return send(res, upstream.status, JSON.stringify({ error: `Dân Trí trả về HTTP ${upstream.status}. Trang có thể yêu cầu xác minh hoặc chặn crawler.` }), "application/json; charset=utf-8");
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) return send(res, 415, JSON.stringify({ error: `Nguồn không trả về HTML (${contentType}).` }), "application/json; charset=utf-8");
    const body = await upstream.text();
    send(res, 200, body, "text/html; charset=utf-8");
  } catch (error) {
    const message = error.name === "AbortError" ? "Quá thời gian chờ khi tải trang nguồn." : `Không kết nối được tới Dân Trí: ${error.message}`;
    send(res, 502, JSON.stringify({ error: message }), "application/json; charset=utf-8");
  } finally { clearTimeout(timer); }
}

async function proxyImage(reqUrl, res) {
  const raw = reqUrl.searchParams.get("url");

  if (!raw) {
    return send(
      res,
      400,
      JSON.stringify({ error: "Thiếu URL ảnh." }),
      "application/json; charset=utf-8"
    );
  }

  let target;

  try {
    target = new URL(raw);
  } catch (_) {
    return send(
      res,
      400,
      JSON.stringify({ error: "URL ảnh không hợp lệ." }),
      "application/json; charset=utf-8"
    );
  }

  // Chỉ cho phép lấy ảnh từ CDN Dân trí.
  if (
    target.protocol !== "https:" ||
    target.hostname.toLowerCase() !== "cdnphoto.dantri.com.vn"
  ) {
    return send(
      res,
      400,
      JSON.stringify({ error: "Tên miền ảnh không được phép." }),
      "application/json; charset=utf-8"
    );
  }

  let referer = "https://dantri.com.vn/";
  const rawReferer = reqUrl.searchParams.get("referer");

  if (rawReferer) {
    try {
      const page = new URL(rawReferer);

      if (
        /^https?:$/.test(page.protocol) &&
        allowed(page.hostname.toLowerCase())
      ) {
        referer = page.href;
      }
    } catch (_) {
      // Sử dụng Referer mặc định nếu URL bài báo không hợp lệ.
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);

  try {
    const upstream = await fetch(target.href, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/132 Safari/537.36",
        "Referer": referer,
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7"
      }
    });

    if (
      new URL(upstream.url).hostname.toLowerCase() !==
      "cdnphoto.dantri.com.vn"
    ) {
      return send(
        res,
        502,
        JSON.stringify({ error: "CDN chuyển hướng sang tên miền khác." }),
        "application/json; charset=utf-8"
      );
    }

    if (!upstream.ok) {
      console.error("Lỗi tải ảnh Dân trí:", upstream.status);

      return send(
        res,
        502,
        JSON.stringify({
          error: `CDN Dân trí trả về HTTP ${upstream.status}.`
        }),
        "application/json; charset=utf-8"
      );
    }

    const contentType = upstream.headers.get("content-type") || "";

    if (!contentType.toLowerCase().startsWith("image/")) {
      return send(
        res,
        415,
        JSON.stringify({ error: "Nguồn không trả về dữ liệu ảnh." }),
        "application/json; charset=utf-8"
      );
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());

    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": buffer.length,
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff"
    });

    res.end(buffer);
  } catch (error) {
    console.error("Không tải được ảnh:", error.message);

    if (!res.headersSent) {
      send(
        res,
        502,
        JSON.stringify({ error: "Không tải được ảnh từ CDN Dân trí." }),
        "application/json; charset=utf-8"
      );
    }
  } finally {
    clearTimeout(timer);
  }
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (requestUrl.pathname === "/api/image") return proxyImage(requestUrl, res);
  if (requestUrl.pathname === "/api/fetch") return proxyFetch(requestUrl, res);
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed");
  let pathname;
  try { pathname = decodeURIComponent(requestUrl.pathname); } catch (_) { return send(res, 400, "Bad URL"); }
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.resolve(ROOT, `.${pathname}`);
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== path.join(ROOT, "index.html")) return send(res, 403, "Forbidden");
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return send(res, 404, "Not found");
    const type = MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "X-Content-Type-Options": "nosniff" });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
});
server.keepAliveTimeout = 120000;
server.headersTimeout = 125000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Tin Tức 24H đang chạy tại port ${PORT}`);
  console.log("Nhấn Ctrl+C để dừng máy chủ.");
});