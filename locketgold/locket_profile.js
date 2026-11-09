/**
 * =============================================================================
 *   🚀 LOCKET GOLD VIP - PROFILE BADGE ENABLER
 *   Tác giả: HexDen ( Văn Nguyên )
 *   Hỗ trợ: https://www.facebook.com/van.nguyen.407297
 * =============================================================================
 */

let obj = {};
try {
  obj = JSON.parse($response.body || '{}');
} catch (e) {
  obj = {};
}

if (obj.data) {
  obj.data.badge = "locket_gold";
  obj.data.badge_tier = "gold";
  obj.data.is_gold = true;
  obj.data.show_badge = true;
}
if (obj.user) {
  obj.user.badge = "locket_gold";
  obj.user.badge_tier = "gold";
  obj.user.is_gold = true;
  obj.user.show_badge = true;
}
obj.is_gold = true;
obj.badge = "locket_gold";
obj.show_badge = true;

$done({ body: JSON.stringify(obj) });
