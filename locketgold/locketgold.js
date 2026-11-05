/**
 * =============================================================================
 *   🚀 LOCKET GOLD VIP - REVENUECAT SUBSCRIPTION MODIFIER
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

obj.subscriber = obj.subscriber || {};

const purchaseDate = "2024-05-18T08:30:00Z";
const expiresDate = "2099-12-31T23:59:59Z";

// Thông báo bản quyền
obj.Attention = "Locket Gold VIP - Kích hoạt thành công bởi HexDen ( Văn Nguyên )!";

const subInfo = {
  "auto_resume_date": null,
  "display_name": "locket_1600_1y",
  "is_sandbox": false,
  "ownership_type": "PURCHASED",
  "billing_issues_detected_at": null,
  "management_url": "https://apps.apple.com/account/subscriptions",
  "period_type": "normal",
  "price": {
    "amount": 399000,
    "currency": "VND"
  },
  "expires_date": expiresDate,
  "grace_period_expires_date": null,
  "refunded_at": null,
  "unsubscribe_detected_at": null,
  "original_purchase_date": purchaseDate,
  "purchase_date": purchaseDate,
  "store": "app_store",
  "store_transaction_id": "2000001108724193"
};

const entitlementInfo = {
  "grace_period_expires_date": null,
  "purchase_date": purchaseDate,
  "original_purchase_date": purchaseDate,
  "product_identifier": "locket_1600_1y",
  "expires_date": expiresDate,
  "ownership_type": "PURCHASED",
  "store": "app_store"
};

obj.subscriber.first_seen = purchaseDate;
obj.subscriber.original_purchase_date = purchaseDate;
obj.subscriber.management_url = "https://apps.apple.com/account/subscriptions";
obj.subscriber.subscriptions = obj.subscriber.subscriptions || {};
obj.subscriber.entitlements = obj.subscriber.entitlements || {};

obj.subscriber.subscriptions["locket_1600_1y"] = subInfo;
obj.subscriber.entitlements["Gold"] = entitlementInfo;
obj.subscriber.entitlements["pro"] = entitlementInfo;
obj.subscriber.entitlements["vip"] = entitlementInfo;

$done({ body: JSON.stringify(obj) });
