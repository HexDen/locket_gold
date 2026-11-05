/**
 * =============================================================================
 *   🚀 LOCKET GOLD VIP - PROFILE BADGE ENABLER
 *   Tác giả: HexDen ( Văn Nguyên )
 *   Repository: https://github.com/HexDen/locket_gold
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

$done({ body: JSON.stringify(obj) });
