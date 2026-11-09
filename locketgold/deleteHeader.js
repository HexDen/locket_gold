/**
 * =============================================================================
 *   🚀 LOCKET GOLD VIP - DELETE ETAG & CACHE HEADER SCRIPT
 *   Tác giả: HexDen ( Văn Nguyên )
 *   Repository: https://github.com/HexDen/locket_gold
 * =============================================================================
 */

let headers = $request.headers || {};
delete headers['If-None-Match'];
delete headers['if-none-match'];
delete headers['X-RevenueCat-ETag'];
delete headers['x-revenuecat-etag'];

$done({ headers });
