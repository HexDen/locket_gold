/**
 * =============================================================================
 *   🚀 LOCKET GOLD VIP - DELETE ETAG & CACHE HEADER SCRIPT
 *   Tác giả: HexDen ( Văn Nguyên )
 *   Hỗ trợ: https://www.facebook.com/van.nguyen.407297
 * =============================================================================
 */

let headers = $request.headers || {};
delete headers['If-None-Match'];
delete headers['if-none-match'];
delete headers['If-Modified-Since'];
delete headers['if-modified-since'];
delete headers['X-RevenueCat-ETag'];
delete headers['x-revenuecat-etag'];

$done({ headers });
