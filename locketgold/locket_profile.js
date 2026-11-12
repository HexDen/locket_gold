/**
 * =============================================================================
 *   🚀 LOCKET GOLD VIP - PROFILE BADGE & AI MOMENT UNLOCKER
 *   Tác giả: HexDen ( Văn Nguyên )
 *   Hỗ trợ: https://www.facebook.com/van.nguyen.407297
 *   Tính năng:
 *     1. Bật huy hiệu Locket Gold vĩnh viễn trên trang cá nhân
 *     2. Bẻ khóa toàn bộ ảnh AI / Moment có bộ lọc Gold
 *     3. Gỡ bỏ thông báo "Bắt phải mở khóa gold để được xem ảnh"
 *     4. Chuyển ảnh bị làm mờ (blurred) thành ảnh gốc HD sắc nét
 * =============================================================================
 */

const url = (typeof $request !== 'undefined' && $request && $request.url) ? $request.url : '';

// 👑 Gán huy hiệu Locket Gold cho tài khoản
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
    target.has_gold = true;
  }
  for (let key in target) {
    if (Object.prototype.hasOwnProperty.call(target, key) && typeof target[key] === 'object' && target[key] !== null) {
      injectBadge(target[key]);
    }
  }
}

// 🔓 Bẻ khóa ảnh AI, ảnh Moment bị khóa và gỡ bỏ hoàn toàn Paywall
function unlockMoments(target) {
  if (!target || typeof target !== 'object') return;

  // Nhận diện đối tượng là Moment / Ảnh hoặc có thuộc tính khóa
  if (
    'requires_gold' in target ||
    'requires_subscription' in target ||
    'is_locked' in target ||
    'locked' in target ||
    'is_gold_moment' in target ||
    'is_ai_moment' in target ||
    'show_paywall' in target ||
    'can_view' in target ||
    'blurred_url' in target ||
    'blur_url' in target ||
    'ai_filter' in target ||
    'ai_style' in target ||
    'filter_id' in target
  ) {
    target.requires_gold = false;
    target.requires_subscription = false;
    target.is_locked = false;
    target.locked = false;
    target.can_view = true;
    target.unlocked = true;
    target.show_paywall = false;
    target.is_gold_moment = false;
    target.is_blurred = false;
    target.allow_view = true;
    target.ai_locked = false;

    // Trỏ thẳng ảnh mờ sang ảnh gốc HD
    const clearUrl = target.original_url || target.image_url || target.full_url || target.hd_url || target.photo_url || target.media_url;
    if (clearUrl) {
      if ('blurred_url' in target) target.blurred_url = clearUrl;
      if ('blur_url' in target) target.blur_url = clearUrl;
      if ('preview_url' in target && typeof target.preview_url === 'string' && target.preview_url.includes('blur')) {
        target.preview_url = clearUrl;
      }
      if ('thumbnail_url' in target && typeof target.thumbnail_url === 'string' && target.thumbnail_url.includes('blur')) {
        target.thumbnail_url = clearUrl;
      }
    }
  }

  // Đệ quy sâu vào tất cả object và mảng con (ví dụ: data.moments, history, feed)
  for (let key in target) {
    if (Object.prototype.hasOwnProperty.call(target, key) && typeof target[key] === 'object' && target[key] !== null) {
      unlockMoments(target[key]);
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
          has_gold: true,
          success: true
        },
        result: {
          badge: 'locket_gold',
          badge_tier: 'gold',
          is_gold: true,
          has_gold: true,
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
      unlockMoments(obj);
      obj.badge = 'locket_gold';
      obj.badge_tier = 'gold';
      obj.is_gold = true;
      obj.has_gold = true;
      obj.is_subscriber = true;
      obj.show_badge = true;
      body = JSON.stringify(obj);
    } catch (e) {}
  }
  $done({ body: body });
}
