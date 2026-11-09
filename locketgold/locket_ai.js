/**
 * =============================================================================
 * 👑 LOCKET GOLD VIP - AI FILTER INTERCEPTOR
 * Tác giả: HexDen ( Văn Nguyên )
 * Hỗ trợ: https://www.facebook.com/van.nguyen.407297
 * Máy chủ AI: https://locket-gold-m1xo.onrender.com (Render Cloud)
 * =============================================================================
 */

// 🌐 ĐƯỜNG LINK MÁY CHỦ AI CỦA BẠN TRÊN RENDER:
// Các filter có thể chọn:
// - vintage_film: Hiệu ứng máy phim / Đang Rửa Ảnh Polaroid (Mặc định)
// - anime_art: Hiệu ứng hoạt hình Ghibli sắc nét
// - cyber_hexden: Tông màu Cyan Neon độc quyền HexDen
const AI_SERVER_URL = "https://locket-gold-m1xo.onrender.com/process?filter=vintage_film";

(function() {
  if (typeof $request === "undefined" || !$request.body) {
    return $done({});
  }

  const headers = $request.headers || {};
  const contentType = (headers["Content-Type"] || headers["content-type"] || "").toLowerCase();

  // Bỏ qua các gói tin JSON thuần (như gửi caption, like, bình luận)
  if (contentType.includes("application/json")) {
    return $done({});
  }

  // Gửi ảnh sang máy chủ AI của HexDen để áp dụng hiệu ứng
  $httpClient.post({
    url: AI_SERVER_URL,
    body: $request.body,
    headers: {
      "Content-Type": contentType || "image/jpeg"
    },
    timeout: 20
  }, function(error, response, data) {
    if (!error && response && response.status === 200 && data) {
      // ✅ Thay thế ảnh gốc bằng ảnh đã được AI "rửa ảnh" và áp filter
      $done({ body: data });
    } else {
      // ⚠️ Nếu mạng lag hoặc server chưa phản hồi kịp, giữ nguyên ảnh gốc để không bị gián đoạn gửi
      $done({});
    }
  });
})();
