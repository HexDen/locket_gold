"""
=============================================================================
👑 HEXDEN MOBILECONFIG BUILDER - TẠO FILE CẤU HÌNH TỰ ĐỘNG CHO IPHONE
Tác giả: HexDen (Văn Nguyên)
Hỗ trợ: https://www.facebook.com/van.nguyen.407297
=============================================================================
"""

import os
import uuid

def generate_mobileconfig(server_host, ca_base64_path="certs/ca_base64.txt", output_file="LocketGold_Server.mobileconfig", display_name="HexDen Locket Gold VIP"):
    if not os.path.exists(ca_base64_path):
        raise FileNotFoundError(f"Không tìm thấy file {ca_base64_path}! Hãy chạy generate_ca.py trước.")
        
    with open(ca_base64_path, "r", encoding="utf-8") as f:
        ca_b64 = f.read().strip()
        
    profile_uuid = str(uuid.uuid4()).upper()
    cert_uuid = str(uuid.uuid4()).upper()
    dns_uuid = str(uuid.uuid4()).upper()
    
    server_url = f"https://{server_host}/dns-query"
    
    # Nếu server_host là IP, thêm ServerAddresses
    server_addresses_block = ""
    if not any(c.isalpha() for c in server_host.replace(".", "")):
        server_addresses_block = f"""
                <key>ServerAddresses</key>
                <array>
                    <string>{server_host}</string>
                </array>"""
                
    content = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadDisplayName</key>
    <string>{display_name}</string>
    <key>PayloadDescription</key>
    <string>Mở khóa Locket Gold VIP vĩnh viễn, quay video 60s và bộ lọc trực tiếp không cần Shadowrocket hay VPN.</string>
    <key>PayloadIdentifier</key>
    <string>com.hexden.locketgold.server.{profile_uuid.lower()}</string>
    <key>PayloadOrganization</key>
    <string>HexDen (Văn Nguyên)</string>
    <key>PayloadScope</key>
    <string>System</string>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>{profile_uuid}</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
    <key>PayloadRemovalDisallowed</key>
    <false/>
    <key>PayloadContent</key>
    <array>
        <!-- 🔐 1. CHỨNG CHỈ GỐC ROOT CA (Giải mã HTTPS để tiêm Gold) -->
        <dict>
            <key>PayloadDisplayName</key>
            <string>HexDen Root CA</string>
            <key>PayloadDescription</key>
            <string>Chứng chỉ tin cậy nội bộ kích hoạt bản quyền Locket Gold VIP</string>
            <key>PayloadCertificateFileName</key>
            <string>HexDen Root CA.crt</string>
            <key>PayloadIdentifier</key>
            <string>com.apple.security.root.{cert_uuid.lower()}</string>
            <key>PayloadType</key>
            <string>com.apple.security.root</string>
            <key>PayloadUUID</key>
            <string>{cert_uuid}</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
            <key>PayloadContent</key>
            <data>{ca_b64}</data>
        </dict>

        <!-- 🛡️ 2. MÁY CHỦ DNS ĐIỀU HƯỚNG TỚI VPS CỦA BẠN -->
        <dict>
            <key>PayloadDisplayName</key>
            <string>HexDen Locket DoH</string>
            <key>PayloadDescription</key>
            <string>Định tuyến an toàn các yêu cầu Locket Gold về máy chủ HexDen 24/7</string>
            <key>PayloadIdentifier</key>
            <string>com.apple.dnsSettings.managed.{dns_uuid.lower()}</string>
            <key>PayloadType</key>
            <string>com.apple.dnsSettings.managed</string>
            <key>PayloadUUID</key>
            <string>{dns_uuid}</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
            <key>DNSSettings</key>
            <dict>
                <key>DNSProtocol</key>
                <string>HTTPS</string>
                <key>ServerURL</key>
                <string>{server_url}</string>{server_addresses_block}
                <key>SupplementalMatchDomains</key>
                <array>
                    <string>api.revenuecat.com</string>
                    <string>firebaseremoteconfig.googleapis.com</string>
                    <string>api.locketcamera.com</string>
                </array>
            </dict>
        </dict>
    </array>
</dict>
</plist>
"""
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(content)
        
    print(f"🎉 Đã tạo thành công file hồ sơ: {output_file}")
    print(f"🔗 Server DoH kết nối tới: {server_url}")
    return output_file

if __name__ == "__main__":
    import sys
    host = sys.argv[1] if len(sys.argv) > 1 else "YOUR_VPS_IP_HERE"
    generate_mobileconfig(host)
