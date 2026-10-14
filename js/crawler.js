(function () {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const postsKey = "news_posts_v1";
  let results = [];
  const statusNode = $("#status");
  const preview = $("#json-preview");
  const saveButton = $("#save-results");
  const downloadButton = $("#download-json");

  function setStatus(message, type = "") {
    statusNode.className = `status-message ${type}`.trim();
    statusNode.textContent = message;
  }

  function validateDantriUrl(raw) {
    let url;
    try { url = new URL(raw); } catch (_) { throw new Error("URL không hợp lệ. Hãy nhập URL đầy đủ bắt đầu bằng https://"); }
    if (!/^https?:$/.test(url.protocol)) throw new Error("Chỉ chấp nhận URL http/https.");
    const host = url.hostname.toLowerCase();
    if (!(host === "dantri.com.vn" || host.endsWith(".dantri.com.vn"))) {
      throw new Error("Vì lý do an toàn, crawler chỉ nhận URL thuộc dantri.com.vn hoặc tên miền con của Dân Trí.");
    }
    return url.href;
  }

  async function fetchHtml(url) {
    const endpoint = `/api/fetch?url=${encodeURIComponent(url)}`;
    const response = await fetch(endpoint, { headers: { "Accept": "text/html" } });
    const text = await response.text();
    if (!response.ok) {
      let message = text || `Máy chủ trả về HTTP ${response.status}`;
      try { message = JSON.parse(text).error || message; } catch (_) { /* plain text */ }
      if (response.status === 404 && message.toLowerCase().includes("unknown")) message = "Không tìm thấy API proxy. Hãy chạy node server.js trong thư mục dự án.";
      throw new Error(message);
    }
    if (!text.trim()) throw new Error("Trang nguồn trả về nội dung rỗng.");
    return text;
  }

  function textFrom(root, selectors) {
    for (const selector of selectors) {
      const node = root.querySelector(selector);
      if (node) {
        const value = (node.getAttribute("content") || node.textContent || "").trim();
        if (value) return value.replace(/\s+/g, " ");
      }
    }
    return "";
  }

  function getJsonLd(doc) {
    const values = [];
    doc.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
      try {
        const parsed = JSON.parse(script.textContent);
        if (Array.isArray(parsed)) values.push(...parsed);
        else if (parsed && Array.isArray(parsed["@graph"])) values.push(...parsed["@graph"]);
        else if (parsed) values.push(parsed);
      } catch (_) { /* invalid JSON-LD is ignored */ }
    });
    return values.find((item) => /Article|NewsArticle|ReportageNewsArticle/i.test(String(item["@type"] || ""))) || values[0] || {};
  }

  function cleanText(node) {
    if (!node) return "";
    const clone = node.cloneNode(true);
    clone.querySelectorAll("script,style,iframe,button,form,nav,footer,header,figure,figcaption,svg,.ads,.advertisement,[class*=related],[class*=social],[class*=comment],[class*=recommend]").forEach((el) => el.remove());
    const paragraphs = [...clone.querySelectorAll("p")].map((p) => p.textContent.trim()).filter(Boolean);
    const value = paragraphs.length ? paragraphs.join("\n\n") : clone.textContent;
    return value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }

  function deriveCategory(doc, url) {
    const breadcrumbSelectors = [".breadcrumb a", ".breadcrumbs a", "nav[aria-label*=breadcrumb] a", "[class*=breadcrumb] a"];
    for (const selector of breadcrumbSelectors) {
      const links = [...doc.querySelectorAll(selector)].map((node) => node.textContent.trim()).filter(Boolean);
      if (links.length > 1) return links[links.length - 2] || links[links.length - 1];
    }
    const segment = new URL(url).pathname.split("/").filter(Boolean)[0] || "";
    const mapping = {
      "the-gioi":"Thế giới", "thoi-su":"Thời sự", "bat-dong-san":"Bất động sản",
      "kinh-doanh":"Kinh doanh", "the-thao":"Thể thao", "giao-duc":"Giáo dục",
      "suc-khoe":"Sức khỏe", "van-hoa":"Văn hóa", "xa-hoi":"Xã hội",
      "phap-luat":"Pháp luật", "du-lich":"Du lịch", "o-to-xe-may":"Ô tô - Xe máy"
    };
    return mapping[segment] || (segment ? segment.replace(/-/g, " ") : "Tin tức");
  }

  function normalizeArticle(rawUrl, html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const canonical = doc.querySelector('link[rel="canonical"]')?.href || rawUrl;
    const url = new URL(canonical, rawUrl).href;
    const ld = getJsonLd(doc);
    const title = textFrom(doc, ['meta[property="og:title"]', 'meta[name="twitter:title"]', 'h1.singular-title', 'h1', 'title']) || String(ld.headline || "").trim();
    const excerpt = textFrom(doc, ['meta[name="description"]', 'meta[property="og:description"]', '.singular-sapo', '.article__sapo', '[class*=sapo]', 'p.lead']) || String(ld.description || "").trim();
    const bodyNode = doc.querySelector('[itemprop="articleBody"]') || doc.querySelector(".singular-content") || doc.querySelector(".article-content") || doc.querySelector(".detail-content") || doc.querySelector("article") || doc.body;
    const content = cleanText(bodyNode) || String(ld.articleBody || excerpt).trim();
    let author = textFrom(doc, ['meta[name="author"]', '[itemprop="author"] [itemprop="name"]', '[itemprop="author"]', '.singular-author', '.author-name', '[class*=author-name]']);
    if (!author && ld.author) {
      const value = Array.isArray(ld.author) ? ld.author[0] : ld.author;
      author = typeof value === "string" ? value : (value.name || "");
    }
    const published = textFrom(doc, ['meta[property="article:published_time"]', 'meta[itemprop="datePublished"]', 'time[datetime]', '[itemprop="datePublished"]']);
    const publishedNode = doc.querySelector('time[datetime], [itemprop="datePublished"]');
    const publishedAt = (publishedNode && (publishedNode.getAttribute("datetime") || publishedNode.getAttribute("content"))) || published || ld.datePublished || "";
    const image = textFrom(doc, ['meta[property="og:image"]', 'meta[name="twitter:image"]']) || (ld.image && (typeof ld.image === "string" ? ld.image : ld.image.url || (Array.isArray(ld.image) ? ld.image[0]?.url || ld.image[0] : ""))) || doc.querySelector("article img")?.src || "";
    let idNumber = url.match(/(\d{8,})(?=\.htm(?:$|\?))/i);
    const id = `dtri-${idNumber ? idNumber[1] : slugify(url.split("/").pop() || title)}`;
    const leaf = new URL(url).pathname.split("/").pop() || "";
    const slug = decodeURIComponent(leaf).replace(/\.htm$/i, "").replace(/-\d{8,}$/, "") || slugify(title);
    return {
      id, title: title.replace(/\s*\|\s*Báo Dân trí.*$/i, "").trim(), slug,
      excerpt, content, author: author || "Chưa trích xuất được tác giả",
      category: deriveCategory(doc, url), publishedAt: publishedAt ? normalizeDate(publishedAt) : "",
      source: new URL(url).hostname, url, image: String(image || "")
    };
  }

  function slugify(value) {
    return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function normalizeDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
  }

  function showResults() {
    preview.textContent = results.length ? JSON.stringify(results.length === 1 ? results[0] : results, null, 2) : "Chưa có kết quả.";
    saveButton.disabled = !results.length;
    downloadButton.disabled = !results.length;
    const list = $("#results-list");
    list.innerHTML = "";
    results.forEach((post, index) => {
      const item = document.createElement("div");
      item.className = "crawl-result";
      const title = document.createElement("strong"); title.textContent = `${index + 1}. ${post.title || "Không có tiêu đề"}`;
      const detail = document.createElement("small"); detail.textContent = `${post.category || "Chưa rõ chuyên mục"} · ${post.publishedAt || "Chưa rõ ngày đăng"}`;
      const url = document.createElement("small"); url.textContent = post.url;
      item.append(title, detail, url); list.appendChild(item);
    });
  }

  async function crawlOne() {
    results = []; showResults();
    let url;
    try { url = validateDantriUrl($("#url-input").value.trim()); }
    catch (error) { setStatus(error.message, "error"); return; }
    setStatus("Đang tải bài viết và trích xuất dữ liệu…");
    try {
      const html = await fetchHtml(url);
      const post = normalizeArticle(url, html);
      if (!post.title || !post.content) throw new Error("Trang đã tải nhưng không tìm được tiêu đề/nội dung. Có thể trang đổi cấu trúc hoặc chặn crawler.");
      results = [post]; showResults();
      setStatus("Crawl thành công. Kiểm tra JSON rồi nhấn Lưu bài vào LocalStorage.", "success");
    } catch (error) {
      console.error(error);
      setStatus(`Không crawl được bài viết: ${error.message}\n\nHãy kiểm tra Node server còn chạy không. Nếu Dân Trí trả CAPTCHA/403, thử lại sau hoặc dùng URL bài viết khác.`, "error");
    }
  }

  function isLikelyArticleUrl(value, baseUrl) {
    try {
      const url = new URL(value, baseUrl);
      return (url.hostname === "dantri.com.vn" || url.hostname.endsWith(".dantri.com.vn")) && /\d{8,}\.htm$/i.test(url.pathname);
    } catch (_) { return false; }
  }

  async function crawlCategory() {
    results = []; showResults();
    let categoryUrl;
    try { categoryUrl = validateDantriUrl($("#url-input").value.trim()); }
    catch (error) { setStatus(error.message, "error"); return; }
    setStatus("Đang tải trang chuyên mục để tìm liên kết bài viết…");
    try {
      const listHtml = await fetchHtml(categoryUrl);
      const doc = new DOMParser().parseFromString(listHtml, "text/html");
      const links = [...doc.querySelectorAll("a[href]")]
        .map((a) => new URL(a.getAttribute("href"), categoryUrl).href.split("#")[0])
        .filter((url) => isLikelyArticleUrl(url, categoryUrl));
      const uniqueUrls = [...new Set(links)].filter((url) => url !== categoryUrl).slice(0, 10);
      if (!uniqueUrls.length) throw new Error("Không tìm thấy liên kết bài viết trên trang. Có thể trang đã đổi cấu trúc hoặc chặn crawler.");
      let success = 0;
      for (let i = 0; i < uniqueUrls.length; i += 1) {
        const url = uniqueUrls[i];
        setStatus(`Đang crawl bài ${i + 1}/${uniqueUrls.length}…\n${url}`);
        try {
          const html = await fetchHtml(url);
          const post = normalizeArticle(url, html);
          if (post.title && post.content) { results.push(post); success += 1; showResults(); }
        } catch (error) {
          console.warn("Bỏ qua bài không crawl được:", url, error);
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      showResults();
      if (success) setStatus(`Đã trích xuất ${success}/${uniqueUrls.length} bài. Nhấn Lưu bài vào LocalStorage để cập nhật website.`, "success");
      else setStatus("Tìm được URL bài viết nhưng không trích xuất được bài nào. Có thể website chặn yêu cầu hoặc thay cấu trúc HTML.", "error");
    } catch (error) {
      console.error(error);
      setStatus(`Không crawl được chuyên mục: ${error.message}`, "error");
    }
  }

  function saveResults() {
    if (!results.length) return;
    let existing = [];
    try { existing = JSON.parse(localStorage.getItem(postsKey) || "[]"); } catch (_) { existing = []; }
    if (!Array.isArray(existing)) existing = [];
    const merged = new Map(existing.map((post) => [post.url || post.id, post]));
    results.forEach((post) => merged.set(post.url || post.id, { ...post, isSample: false }));
    const posts = [...merged.values()];
    try {
      localStorage.setItem(postsKey, JSON.stringify(posts));
      setStatus(`Đã lưu ${results.length} bài crawl. LocalStorage hiện có ${posts.length} bài. Mở lại trang chủ để xem.`, "success");
    } catch (error) {
      setStatus(`Không lưu được LocalStorage: ${error.message}. Có thể vượt giới hạn dung lượng trình duyệt do lưu toàn bộ nội dung/ảnh URL.`, "error");
    }
  }

  function downloadJson() {
    if (!results.length) return;
    const blob = new Blob([JSON.stringify(results.length === 1 ? results[0] : results, null, 2)], { type: "application/json;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = objectUrl;
    link.download = results.length === 1 ? `${results[0].id || "article"}.json` : "dantri-crawled-posts.json";
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(objectUrl);
  }

  $("#crawl-one").addEventListener("click", crawlOne);
  $("#crawl-category").addEventListener("click", crawlCategory);
  saveButton.addEventListener("click", saveResults);
  downloadButton.addEventListener("click", downloadJson);
  $("#clear-results").addEventListener("click", () => { results = []; showResults(); setStatus("Đã xóa kết quả hiện tại."); });
  $("#remove-samples").addEventListener("click", () => {
    let existing = [];
    try { existing = JSON.parse(localStorage.getItem(postsKey) || "[]"); } catch (_) { existing = []; }
    const before = Array.isArray(existing) ? existing.length : 0;
    const clean = (Array.isArray(existing) ? existing : []).filter((post) => !post.isSample && post.source !== "Dữ liệu mẫu");
    try {
      localStorage.setItem(postsKey, JSON.stringify(clean));
      setStatus(`Đã xóa ${before - clean.length} bài mẫu. Còn ${clean.length} bài trong LocalStorage. Mở lại trang chủ để cập nhật.`, "success");
    } catch (error) { setStatus(`Không cập nhật được LocalStorage: ${error.message}`, "error"); }
  });
})();
