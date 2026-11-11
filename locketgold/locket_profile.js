/**
 * =============================================================================
 *   🚀 LOCKET GOLD VIP - PROFILE BADGE ENABLER
 *   Tác giả: HexDen ( Văn Nguyên )
 *   Hỗ trợ: https://www.facebook.com/van.nguyen.407297
 * =============================================================================
 */

const url = (typeof $request !== 'undefined' && $request && $request.url) ? $request.url : '';

function injectBadge(target) {
  if (!target || typeof target !== 'object') return;
  if (
    'user' in target ||
    'profile' in target ||
    'data' in target ||
    'first_name' in target ||
    'phone_number' in target ||
    'uid' in target ||
    'id' in target
  ) {
    target.badge = 'locket_gold';
    target.badge_tier = 'gold';
    target.is_gold = true;
    target.show_badge = true;
  }
  for (let key in target) {
    if (Object.prototype.hasOwnProperty.call(target, key) && typeof target[key] === 'object' && target[key] !== null) {
      injectBadge(target[key]);
    }
  }
}

if (url.includes('changeProfileInfo')) {
  $done({
    response: {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        data: {
          badge: 'locket_gold',
          badge_tier: 'gold',
          is_gold: true,
          success: true
        },
        result: {
          badge: 'locket_gold',
          badge_tier: 'gold',
          is_gold: true,
          success: true
        }
      })
    }
  });
} else {
  let body = (typeof $response !== 'undefined' && $response && $response.body) ? $response.body : null;
  if (body) {
    try {
      let obj = JSON.parse(body);
      injectBadge(obj);
      obj.badge = 'locket_gold';
      obj.badge_tier = 'gold';
      obj.is_gold = true;
      obj.show_badge = true;
      body = JSON.stringify(obj);
    } catch (e) {}
  }
  $done({ body: body });
}
