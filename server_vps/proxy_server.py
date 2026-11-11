"""
=============================================================================
👑 HEXDEN 24/7 LOCKET GOLD VPS SERVER (SERVER-SIDE MITM + DOH RESOLVER)
Tác giả: HexDen (Văn Nguyên)
Hỗ trợ: https://www.facebook.com/van.nguyen.407297
Chức năng:
  - Máy chủ DNS-over-HTTPS (DoH) bắt cóc tên miền Locket về VPS.
  - Máy chủ HTTPS Proxy tự động ký SSL động theo HexDen Root CA.
  - Tự động tiêm bản quyền Locket Gold VIP vĩnh viễn đến năm 2099.
  - Tự động mở khóa quay video 60 giây, tải video 60 giây và toàn bộ bộ lọc.
  - Khách hàng KHÔNG CẦN CÀI SHADOWROCKET, KHÔNG CẦN BẬT VPN!
=============================================================================
"""

import os
import sys
import ssl
import json
import struct
import socket
import tempfile
import threading
import urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timedelta, timezone

from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

# Cấu hình máy chủ
VPS_IP = os.environ.get("VPS_IP", "127.0.0.1")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CERTS_DIR = os.path.join(BASE_DIR, "certs")
CA_CERT_PATH = os.path.join(CERTS_DIR, "ca.crt")
CA_KEY_PATH = os.path.join(CERTS_DIR, "ca.key")

# Cache lưu trữ chứng chỉ SSL các tên miền đã ký
CERT_CACHE = {}

def get_or_create_leaf_cert(domain):
    """Tự động sinh hoặc lấy chứng chỉ SSL động cho từng tên miền"""
    if domain in CERT_CACHE:
        return CERT_CACHE[domain]
        
    os.makedirs(os.path.join(CERTS_DIR, "domains"), exist_ok=True)
    domain_cert_path = os.path.join(CERTS_DIR, "domains", f"{domain}.crt")
    domain_key_path = os.path.join(CERTS_DIR, "domains", f"{domain}.key")
    
    if os.path.exists(domain_cert_path) and os.path.exists(domain_key_path):
        CERT_CACHE[domain] = (domain_cert_path, domain_key_path)
        return domain_cert_path, domain_key_path
        
    with open(CA_CERT_PATH, "rb") as f:
        ca_cert = x509.load_pem_x509_certificate(f.read())
    with open(CA_KEY_PATH, "rb") as f:
        ca_key = serialization.load_pem_private_key(f.read(), password=None)
        
    leaf_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, domain)])
    now = datetime.now(timezone.utc)
    
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(ca_cert.subject)
        .public_key(leaf_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(days=1))
        .not_valid_after(now + timedelta(days=365))
        .add_extension(
            x509.SubjectAlternativeName([x509.DNSName(domain)]),
            critical=False,
        )
        .add_extension(
            x509.BasicConstraints(ca=False, path_length=None),
            critical=True,
        )
        .sign(ca_key, hashes.SHA256())
    )
    
    with open(domain_cert_path, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))
    with open(domain_key_path, "wb") as f:
        f.write(leaf_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption()
        ))
        
    CERT_CACHE[domain] = (domain_cert_path, domain_key_path)
    return domain_cert_path, domain_key_path

def build_dns_response(query_data, answer_ip):
    """Xây dựng gói tin phản hồi DNS RFC 1035 A record trỏ về VPS IP"""
    if len(query_data) < 12:
        return b""
    tx_id = query_data[:2]
    flags = b"\x81\x80" # Standard query response, No error
    qdcount = query_data[4:6]
    ancount = b"\x00\x01" # 1 Answer
    nscount = b"\x00\x00"
    arcount = b"\x00\x00"
    
    # Question section
    idx = 12
    while idx < len(query_data) and query_data[idx] != 0:
        if (query_data[idx] & 0xC0) == 0xC0:
            idx += 2
            break
        idx += 1 + query_data[idx]
    if idx < len(query_data) and query_data[idx] == 0:
        idx += 1
    idx += 4 # QTYPE + QCLASS
    question_part = query_data[12:idx]
    
    # Answer section (pointer to qname at 0x000C, TYPE A, CLASS IN, TTL 300, RDLENGTH 4, RDATA)
    ans_name = b"\xc0\x0c"
    ans_type = b"\x00\x01" # A
    ans_class = b"\x00\x01" # IN
    ans_ttl = struct.pack("!I", 300)
    ip_parts = [int(p) for p in answer_ip.split(".")]
    ans_rdata = bytes(ip_parts)
    ans_rdlen = struct.pack("!H", len(ans_rdata))
    
    answer_part = ans_name + ans_type + ans_class + ans_ttl + ans_rdlen + ans_rdata
    return tx_id + flags + qdcount + ancount + nscount + arcount + question_part + answer_part

# Payload Locket Gold VIP vĩnh viễn (RevenueCat)
GOLD_REVENUECAT_PAYLOAD = {
    "request_date": "2026-11-10T00:00:00Z",
    "request_date_ms": 1794268800000,
    "subscriber": {
        "entitlements": {
            "Gold": {
                "expires_date": "2099-12-31T23:59:59Z",
                "grace_period_expires_date": None,
                "product_identifier": "locket_gold_yearly",
                "purchase_date": "2024-05-18T00:00:00Z"
            }
        },
        "first_seen": "2024-05-18T00:00:00Z",
        "last_seen": "2026-11-10T00:00:00Z",
        "management_url": None,
        "non_subscriptions": {},
        "original_app_user_id": "hexden_vip_user",
        "original_application_version": "1.0",
        "original_purchase_date": "2024-05-18T00:00:00Z",
        "other_purchases": {},
        "subscriptions": {
            "locket_gold_yearly": {
                "auto_resume_date": None,
                "billing_issues_detected_at": None,
                "expires_date": "2099-12-31T23:59:59Z",
                "grace_period_expires_date": None,
                "is_sandbox": False,
                "original_purchase_date": "2024-05-18T00:00:00Z",
                "period_type": "annual",
                "purchase_date": "2024-05-18T00:00:00Z",
                "refunded_at": None,
                "store": "app_store",
                "store_transaction_id": "hexden_vip_transaction",
                "unsubscribe_detected_at": None
            }
        }
    }
}

class HexDenProxyHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {self.headers.get('Host', '')} {args[0]} {args[1]}")

    def do_GET(self):
        host = self.headers.get("Host", "").split(":")[0].lower()
        
        # 1. Endpoint DoH (DNS-over-HTTPS)
        if self.path.startswith("/dns-query"):
            # Nếu là GET DoH query ?dns=...
            self.send_response(200)
            self.send_header("Content-Type", "application/dns-message")
            self.end_headers()
            # Mặc định trả về A record trỏ tới VPS IP
            resp_pkt = build_dns_response(b"\x12\x34\x01\x00\x00\x01\x00\x00\x00\x00\x00\x00\x03api\nrevenuecat\x03com\x00\x00\x01\x00\x01", VPS_IP)
            self.wfile.write(resp_pkt)
            return

        # 2. Xử lý RevenueCat (Tiêm bản quyền Gold)
        if "revenuecat" in host:
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps(GOLD_REVENUECAT_PAYLOAD).encode("utf-8"))
            return

        # 3. Xử lý Firebase Remote Config (Quay 60s, Bộ lọc, Màu camera, Khung tiện ích)
        if "firebaseremoteconfig" in host:
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            rc_entries = {
                "camera_video_recording": json.dumps({"default":{"maximum_duration":60000,"size":1080,"file_type":"mp4","video_codec":"h265"},"gold":{"maximum_duration":60000,"size":1080,"file_type":"mp4","video_codec":"h265"}}),
                "camera_roll": json.dumps({"gold_max_duration":60,"max_duration":60,"video_max_duration":60}),
                "camera_filter": "everyone",
                "camera_filters": "everyone",
                "holiday_filters": "everyone",
                "longer_video": "everyone",
                "video": "everyone",
                "camera_filters_enabled": "true",
                "camera_filter_enabled": "true",
                "camera_filter_sheet_enabled": "true",
                "camera_filter_picker_enabled": "true",
                "holiday_filters_enabled": "true",
                "holiday_filters_free": "true",
                "allows_custom_filters": "true",
                "camera_theme_enabled": "true",
                "camera_themes_enabled": "true",
                "camera_theme_sheet_enabled": "true",
                "camera_theme_picker_enabled": "true",
                "camera_color_enabled": "true",
                "camera_colors_enabled": "true",
                "custom_widget_frames_enabled": "true",
                "widget_frames_enabled": "true",
                "widget_frame_enabled": "true",
                "widget_frames": "true",
                "app_icon_picker_enabled": "true",
                "app_icons_enabled": "true",
                "feature_gates": json.dumps({
                    "holiday_filters": "everyone",
                    "holiday_filter": "everyone",
                    "camera_filter": "everyone",
                    "camera_filters": "everyone",
                    "filters": "everyone",
                    "camera_filter_sheet": "everyone",
                    "camera_filters_sheet": "everyone",
                    "camera_filter_picker": "everyone",
                    "camera_theme": "everyone",
                    "camera_themes": "everyone",
                    "camera_themes_config": "everyone",
                    "camera_theme_sheet": "everyone",
                    "camera_themes_sheet": "everyone",
                    "camera_theme_picker": "everyone",
                    "camera_color": "everyone",
                    "camera_colors": "everyone",
                    "custom_widget_frames": "everyone",
                    "widget_frames": "everyone",
                    "widget_frame": "everyone",
                    "frames": "everyone",
                    "ai_filter": "everyone",
                    "ai_filters": "everyone",
                    "ai_camera_filter": "everyone",
                    "app_icon_picker": "everyone",
                    "app_icons": "everyone",
                    "camera_roll": "everyone",
                    "locket_views": "everyone",
                    "long_captions": "everyone",
                    "longer_video": "everyone",
                    "unlimited_friends": "everyone",
                    "priority_support": "everyone",
                    "profile_badge": "everyone",
                    "remove_ads": "everyone",
                    "video": "everyone",
                    "streak_recovery": "everyone"
                }),
                "upsell_features": json.dumps({
                    "camera_filter": false,
                    "camera_filters": false,
                    "filters": false,
                    "holiday_filter": false,
                    "holiday_filters": false,
                    "camera_theme": false,
                    "camera_themes": false,
                    "camera_color": false,
                    "camera_roll": false,
                    "locket_views": false,
                    "remove_ads": false,
                    "custom_widget_frames": false,
                    "widget_frames": false
                }),
                "camera_themes": json.dumps(["gold", "sakura", "snowflake", "sunset", "surfboard", "ootd", "neon", "classic", "minimal"]),
                "camera_themes_config": json.dumps({"enabled": True, "all_unlocked": True, "themes": ["gold", "sakura", "snowflake", "sunset", "surfboard", "ootd", "neon", "classic", "minimal"]}),
                "camera_theme_config": json.dumps({"enabled": True, "all_unlocked": True, "themes": ["gold", "sakura", "snowflake", "sunset", "surfboard", "ootd", "neon", "classic", "minimal"]}),
                "custom_widget_frames_config": json.dumps({"enabled": True, "all_unlocked": True, "frames": ["gold", "classic", "polaroid", "film", "vintage", "neon", "festive", "valentines", "halloween", "christmas"]}),
                "widget_frames_config": json.dumps({"enabled": True, "all_unlocked": True, "frames": ["gold", "classic", "polaroid", "film", "vintage", "neon", "festive", "valentines", "halloween", "christmas"]})
            }
            resp = {"entries": rc_entries, "state": "UPDATE"}
            self.wfile.write(json.dumps(resp).encode("utf-8"))
            return

        # 4. Tải file cấu hình .mobileconfig trực tiếp từ server
        if self.path.endswith(".mobileconfig") or self.path in ["/download", "/dns", "/profile"]:
            mc_path = os.path.join(BASE_DIR, "LocketGold_Server.mobileconfig")
            if os.path.exists(mc_path):
                with open(mc_path, "rb") as f:
                    data = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "application/x-apple-aspen-config")
                self.send_header("Content-Disposition", 'inline; filename="LocketGold_Server.mobileconfig"')
                self.end_headers()
                self.wfile.write(data)
                return

        # Mặc định trang chào mừng HexDen
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        html = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><title>HexDen Locket Gold Server</title></head>
        <body style="background:#0b1120;color:#fff;font-family:sans-serif;text-align:center;padding:50px;">
            <h1 style="color:#00f2fe;">👑 HexDen Locket Gold Server Đang Hoạt Động 24/7</h1>
            <p>Máy chủ tự động mở khóa Locket Gold VIP không cần Shadowrocket hay VPN.</p>
            <p><a href="/LocketGold_Server.mobileconfig" style="background:#f59e0b;color:#000;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:bold;">📲 Tải Hồ Sơ Cấu Hình Về iPhone</a></p>
        </body></html>"""
        self.wfile.write(html.encode("utf-8"))

    def do_POST(self):
        # Hỗ trợ DoH DNS qua phương thức POST (RFC 8484)
        if self.path.startswith("/dns-query"):
            content_len = int(self.headers.get("Content-Length", 0))
            dns_query = self.rfile.read(content_len)
            resp = build_dns_response(dns_query, VPS_IP)
            self.send_response(200)
            self.send_header("Content-Type", "application/dns-message")
            self.end_headers()
            self.wfile.write(resp)
            return
            
        # RevenueCat receipt post
        self.do_GET()

def start_http_port_80():
    class Http80Handler(BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            pass

        def do_GET(self):
            # Tải file cấu hình .mobileconfig qua HTTP thông thường
            clean_path = self.path.split("?")[0].lower()
            if clean_path.endswith(".mobileconfig") or clean_path in ["/download", "/dns", "/profile"]:
                mc_path = os.path.join(BASE_DIR, "LocketGold_Server.mobileconfig")
                if os.path.exists(mc_path):
                    with open(mc_path, "rb") as f:
                        data = f.read()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/x-apple-aspen-config")
                    self.send_header("Content-Disposition", 'inline; filename="locketgold.mobileconfig"')
                    self.send_header("Content-Length", str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)
                    return

            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            html = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><title>HexDen Locket Gold Server</title></head>
            <body style="background:#0b1120;color:#fff;font-family:sans-serif;text-align:center;padding:50px;">
                <h1 style="color:#00f2fe;">👑 HexDen Locket Gold Server Đang Hoạt Động 24/7</h1>
                <p>Máy chủ tự động mở khóa Locket Gold VIP không cần Shadowrocket hay VPN.</p>
                <p><a href="/locketgold.mobileconfig" style="background:#f59e0b;color:#000;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:bold;">📲 Tải Hồ Sơ Cấu Hình Về iPhone</a></p>
            </body></html>"""
            self.wfile.write(html.encode("utf-8"))

    try:
        http_80_server = HTTPServer(("0.0.0.0", 80), Http80Handler)
        print("🌐 HTTP Server port 80 đang phục vụ tải file .mobileconfig...")
        http_80_server.serve_forever()
    except Exception as e:
        print(f"⚠️ Port 80 thông báo: {e}")

def run_server(port=443):
    # Khởi chạy HTTP port 80 trong luồng nền
    http_thread = threading.Thread(target=start_http_port_80, daemon=True)
    http_thread.start()
    if not os.path.exists(CA_CERT_PATH) or not os.path.exists(CA_KEY_PATH):
        from generate_ca import generate_root_ca
        generate_root_ca(output_dir=CERTS_DIR)
        
    # Tạo chứng chỉ mặc định cho VPS IP và domain chính
    cert_path, key_path = get_or_create_leaf_cert("api.revenuecat.com")
    get_or_create_leaf_cert("firebaseremoteconfig.googleapis.com")
    get_or_create_leaf_cert("api.locketcamera.com")
    
    server_address = ("0.0.0.0", port)
    httpd = HTTPServer(server_address, HexDenProxyHandler)
    
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(cert_path, key_path)
    
    def sni_callback(sslsock, server_name, initial_context):
        if not server_name:
            return
        domain = server_name.lower()
        if domain in ["api.revenuecat.com", "firebaseremoteconfig.googleapis.com", "api.locketcamera.com"]:
            c_path, k_path = get_or_create_leaf_cert(domain)
            new_ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            new_ctx.load_cert_chain(c_path, k_path)
            sslsock.context = new_ctx
            
    ctx.sni_callback = sni_callback
    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
    
    print(f"🚀 HexDen Locket Gold Server đang lắng nghe trên cổng {port} (HTTPS/DoH)...")
    print(f"🌐 VPS IP cấu hình: {VPS_IP}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Server đã dừng.")

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 443
    run_server(port=port)

