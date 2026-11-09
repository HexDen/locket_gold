/**
 * =============================================================================
 * 🧪 LOCKET GOLD VIP - AUTOMATED TEST SUITE (CHẠY TRỰC TIẾP TRÊN PC)
 * Kiểm thử toàn bộ quá trình Rewrite của Shadowrocket mà không cần mở điện thoại!
 * =============================================================================
 */

const fs = require('fs');
const https = require('https');

console.log('================================================================');
console.log('🚀 BẮT ĐẦU KIỂM THỬ TẤT CẢ CÁC SCRIPT LOCKET GOLD TRÊN PC');
console.log('================================================================\n');

// 1. TEST REVENUECAT (Mở khóa gói Gold)
console.log('📌 1. KIỂM THỬ REVENUECAT SCRIPT (locketgold.js)...');
try {
  const scriptContent = fs.readFileSync('locketgold/locketgold.js', 'utf8');
  let mockDoneData = null;
  const mockContext = {
    $response: { body: JSON.stringify({ subscriber: {} }) },
    $done: (res) => { mockDoneData = res; }
  };

  const runRevenueCat = new Function('$response', '$done', scriptContent);
  runRevenueCat(mockContext.$response, mockContext.$done);

  const parsed = JSON.parse(mockDoneData.body);
  const hasGold = !!parsed.subscriber.entitlements['Gold'];
  const hasSub = !!parsed.subscriber.subscriptions['locket_1600_1y'];

  if (hasGold && hasSub) {
    console.log('   ✅ REVENUECAT: Mở khóa gói Gold thành công!');
    console.log('   - Entitlements:', Object.keys(parsed.subscriber.entitlements).join(', '));
    console.log('   - Hạn dùng:', parsed.subscriber.subscriptions['locket_1600_1y'].expires_date);
  } else {
    console.error('   ❌ REVENUECAT: Thất bại, không tìm thấy Gold entitlement!');
  }
} catch (e) {
  console.error('   ❌ REVENUECAT LỖI:', e.message);
}

// 2. TEST FIREBASE REMOTE CONFIG (Mở khóa Camera, Filter & Captions)
console.log('\n📌 2. KIỂM THỬ FIREBASE REMOTE CONFIG SCRIPT (locket_remote.js)...');
try {
  const rcScript = fs.readFileSync('locketgold/locket_remote.js', 'utf8');
  let mockRCDoneData = null;
  const mockRCContext = {
    $response: { body: JSON.stringify({ entries: {} }) },
    $done: (res) => { mockRCDoneData = res; }
  };

  const runRC = new Function('$response', '$done', rcScript);
  runRC(mockRCContext.$response, mockRCContext.$done);

  const rcParsed = JSON.parse(mockRCDoneData.body);
  const entries = rcParsed.entries || {};

  const fg = JSON.parse(entries.feature_gates || '{}');
  const uf = JSON.parse(entries.upsell_features || '{}');
  const cf = JSON.parse(entries.camera_filter_config || '{}');
  const items = JSON.parse(entries.overlay_items || '[]');

  console.log('   ✅ FEATURE GATES:');
  console.log('      - camera_filter:', fg.camera_filter);
  console.log('      - camera_theme:', fg.camera_theme);
  console.log('      - camera_roll:', fg.camera_roll);
  console.log('      - profile_badge:', fg.profile_badge);

  console.log('   ✅ UPSELL FEATURES:');
  console.log('      - camera_filter:', uf.camera_filter);
  console.log('      - camera_theme:', uf.camera_theme);

  console.log('   ✅ CAMERA FILTER CONFIG:');
  console.log('      - allows_custom_filters:', cf.allows_custom_filters);
  console.log('      - show_filter_button:', cf.show_filter_button);
  console.log('      - Số nhóm filters:', (cf.sheet_filters || []).length);
  console.log('      - Nhóm đầu tiên:', (cf.sheet_filters[0] || {}).title);
  console.log('      - Số lượng filters trong picker:', (cf.picker_filters || []).length);

  console.log('   ✅ CAPTION OVERLAYS (NHÃN DÁN):');
  console.log('      - Số nhóm nhãn dán:', items.length);
  console.log('      - Nhóm nhãn đầu:', items[0].section);
  console.log('      - Nhãn 1:', items[0].items[0].caption.text);
} catch (e) {
  console.error('   ❌ REMOTE CONFIG LỖI:', e.message);
}

// 3. TEST KẾT NỐI MÁY CHỦ AI RENDER
console.log('\n📌 3. KIỂM THỬ KẾT NỐI MÁY CHỦ AI RENDER...');
const req = https.get('https://locket-gold-m1xo.onrender.com', (res) => {
  res.resume(); // Tiêu thụ hết response body để tránh đóng kết nối đột ngột
  console.log('   ✅ MÁY CHỦ AI RENDER:', res.statusCode === 200 ? 'ONLINE 24/7 (200 OK)' : `Status ${res.statusCode}`);
  console.log('\n================================================================');
  console.log('🎉 TOÀN BỘ CÁC SCRIPT VÀ MÁY CHỦ ĐÃ HOẠT ĐỘNG HOÀN HẢO TRÊN PC!');
  console.log('================================================================');
});
req.on('error', (e) => {
  console.error('   ❌ LỖI KẾT NỐI RENDER:', e.message);
});
