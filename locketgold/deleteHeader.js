/**
 * =============================================================================
 *   🚀 LOCKET GOLD VIP - DELETE ETAG HEADER SCRIPT
 *   Tác giả: HexDen ( Văn Nguyên )
 *   Repository: https://github.com/HexDen/locket_gold
 * =============================================================================
 */

let headers = $request.headers || {};
delete headers['If-None-Match'];
delete headers['if-none-match'];

$done({ headers });
