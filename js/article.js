(async function () {
  "use strict";
  const container = document.getElementById("article-detail");
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id") || "";
  const requestedSlug = params.get("slug") || "";
  const STORAGE_KEY = "news_posts_v1";

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function stableKey(post) {
    if (post.url) return `url:${String(post.url).split("#")[0]}`;
    if (post.id) return `id:${post.id}`;
    return `slug:${post.slug || ""}|${post.title || ""}`;
  }

  function normalize(post) {
    return {
      ...post,
      id: String(post.id || ""),
      title: String(post.title || "Chưa có tiêu đề"),
      slug: String(post.slug || ""),
      excerpt: String(post.excerpt || ""),
      content: String(post.content || post.excerpt || "Bài viết chưa có nội dung chi tiết."),
      author: typeof post.author === "object" && post.author !== null
        ? (post.author.name || post.author.fullName || "Chưa rõ tác giả")
        : String(post.author || "Chưa rõ tác giả"),
      category: Array.isArray(post.category) ? post.category.join(" / ") : String(post.category || "Tin tức"),
      publishedAt: String(post.publishedAt || ""),
      source: String(post.source || "Chưa rõ nguồn"),
      url: String(post.url || ""),
      image: String(post.image || post.imageUrl || "")
    };
  }

  try {
    let saved = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) saved = parsed.map(normalize);
    } catch (error) {
      console.warn("Không đọc được bài đã lưu trong LocalStorage.", error);
    }

    let seed = [];
    try {
      const response = await fetch("../posts.json", { cache: "no-store" });
      if (response.ok) {
        const json = await response.json();
        if (Array.isArray(json)) seed = json.map(normalize);
      }
    } catch (error) {
      console.warn("Không tải được posts.json; sẽ dùng dữ liệu LocalStorage.", error);
    }

    const merged = new Map();
    seed.forEach((post) => merged.set(stableKey(post), post));
    saved.forEach((post) => merged.set(stableKey(post), post));
    const posts = [...merged.values()];

    // Hỗ trợ ID, slug và URL cũ; tránh để trang chi tiết trắng do ID cũ trong LocalStorage.
    let post = posts.find((item) => item.id === id);
    if (!post && requestedSlug) post = posts.find((item) => item.slug === requestedSlug);
    if (!post && id) post = posts.find((item) => item.slug === id || item.url === id);

    if (!post) {
      container.replaceChildren();
      container.appendChild(make("h1", "", "Không tìm thấy bài viết"));
      container.appendChild(make("p", "", "Bài viết chưa được lưu hoặc dữ liệu cũ không còn khớp. Quay lại trang chủ rồi mở bài viết lại."));
      const back = make("a", "back-link", "← Quay lại trang chủ");
      back.href = "../index.html";
      container.appendChild(back);
      return;
    }

    container.replaceChildren();
    container.appendChild(make("div", "article-category", post.category));
    container.appendChild(make("h1", "", post.title));

    const date = post.publishedAt ? new Date(post.publishedAt) : null;
    const dateText = date && !Number.isNaN(date.getTime())
      ? date.toLocaleString("vi-VN") : "Chưa rõ thời gian";
    container.appendChild(make("p", "article-meta", `${post.author} · ${dateText}`));

    

const originalImage = String(
  post.image || post.imageUrl || ""
).trim();

if (originalImage) {
  let displayImageUrl = "";

  try {
    const imageUrl = new URL(
      originalImage,
      window.location.href
    );

    if (
      imageUrl.hostname.toLowerCase() ===
      "cdnphoto.dantri.com.vn"
    ) {
      displayImageUrl =
        `/api/image?url=${encodeURIComponent(imageUrl.href)}` +
        `&referer=${encodeURIComponent(
          post.url || "https://dantri.com.vn/"
        )}`;
    } else {
      displayImageUrl = imageUrl.href;
    }
  } catch (error) {
    console.warn("URL ảnh không hợp lệ:", originalImage);
  }

  if (displayImageUrl) {
    const image = make("img", "article-image");

    image.src = displayImageUrl;
    image.alt = post.title || "Ảnh bài viết";

    image.onerror = () => {
      image.remove();
    };

    container.appendChild(image);
  }
}



    if (post.excerpt) container.appendChild(make("p", "article-lead", post.excerpt));
    container.appendChild(make("div", "article-body", post.content));
    container.appendChild(make("p", "article-source", `Nguồn: ${post.source}`));

    if (post.url) {
      const sourceLink = make("a", "back-link", "Mở bài viết gốc ↗");
      sourceLink.href = post.url;
      sourceLink.target = "_blank";
      sourceLink.rel = "noopener noreferrer";
      container.appendChild(sourceLink);
    }

    const back = make("a", "back-link", "← Quay lại trang chủ");
    back.href = "../index.html";
    back.style.marginLeft = "15px";
    container.appendChild(back);
    document.title = `${post.title} - Tin Tức 24H`;
  } catch (error) {
    console.error("Lỗi trang chi tiết:", error);
    container.replaceChildren();
    container.appendChild(make("h1", "", "Không tải được bài viết"));
    container.appendChild(make("p", "", "Hãy đảm bảo website đang chạy qua node server.js, sau đó tải lại trang."));
    const back = make("a", "back-link", "← Quay lại trang chủ");
    back.href = "../index.html";
    container.appendChild(back);
  }
})();
