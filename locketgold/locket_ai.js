/**
 * =============================================================================
 * 👑 LOCKET GOLD VIP - AI FILTER INTERCEPTOR
 * Tác giả: HexDen ( Văn Nguyên )
 * Repository: https://github.com/HexDen/locket_gold
 * =============================================================================
 */

// 🌐 ĐIỀN ĐƯỜNG LINK HUGGING FACE SPACE CỦA BẠN VÀO ĐÂY:
// (Ví dụ: https://hexden-locket-ai.hf.space/process?filter=vintage_film)
const AI_SERVER_URL = "https://YOUR_HF_SPACE_NAME.hf.space/process?filter=vintage_film";

if (typeof $request !== "undefined" && $request.body && !AI_SERVER_URL.includes("YOUR_HF_SPACE_NAME")) {
  $httpClient.post({
    url: AI_SERVER_URL,
    body: $request.body,
    headers: {
      "Content-Type": "image/jpeg"
    },
    timeout: 15
  }, function(error, response, data) {
    if (!error && response.status === 200 && data) {
      // ✅ Thay thế dữ liệu ảnh gốc bằng ảnh đã qua AI xử lý
      $done({ body: data });
    } else {
      // ⚠️ Nếu lỗi mạng hoặc server chưa sẵn sàng, giữ nguyên ảnh gốc để không bị kẹt gửi
      $done({});
    }
  });
} else {
  // Bỏ qua nếu chưa cấu hình link server
  $done({});
}
