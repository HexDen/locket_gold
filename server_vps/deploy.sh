#!/bin/bash
# =============================================================================
# 👑 HEXDEN LOCKET GOLD SERVER - 1-CLICK DEPLOY SCRIPT (ORACLE CLOUD VPS)
# Tác giả: HexDen (Văn Nguyên)
# Hỗ trợ: https://www.facebook.com/van.nguyen.407297
# =============================================================================

set -e

echo "🚀 Bắt đầu cài đặt HexDen Locket Gold Server trên VPS..."

# 1. Cập nhật hệ thống và cài đặt Python 3 + Pip
sudo apt update -y
sudo apt install -y python3 python3-pip python3-venv git curl ufw

# 2. Mở cổng 80 và 443 trên tường lửa (UFW & iptables của Oracle Cloud)
echo "🔓 Đang mở cổng 80 & 443 trên tường lửa..."
sudo ufw allow 80/tcp || true
sudo ufw allow 443/tcp || true
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT || true
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT || true
sudo netfilter-persistent save || true

# 3. Lấy địa chỉ IP Public của VPS
VPS_IP=$(curl -s https://api.ipify.org || curl -s https://ifconfig.me)
echo "🌐 Địa chỉ IP Public của VPS: $VPS_IP"

# 4. Cài đặt thư viện Python cần thiết
cd "$(dirname "$0")"
pip3 install cryptography

# 5. Sinh chứng chỉ Root CA và File .mobileconfig
echo "🔑 Đang sinh chứng chỉ HexDen Root CA..."
python3 generate_ca.py

echo "📱 Đang tạo file cấu hình LocketGold_Server.mobileconfig..."
python3 generate_profile.py "$VPS_IP"

# 6. Thiết lập chạy nền tự động 24/7 bằng Systemd Service
echo "⚙️ Đang cấu hình Systemd Service chạy 24/7 tự khởi động cùng VPS..."

SERVICE_FILE="/etc/systemd/system/hexden-locket.service"
CURRENT_DIR=$(pwd)

sudo bash -c "cat > $SERVICE_FILE" <<EOF
[Unit]
Description=HexDen Locket Gold Server-Side MITM & DoH Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$CURRENT_DIR
Environment="VPS_IP=$VPS_IP"
ExecStart=/usr/bin/python3 $CURRENT_DIR/proxy_server.py 443
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable hexden-locket
sudo systemctl restart hexden-locket

echo "============================================================================="
echo "🎉 CÀI ĐẶT THÀNH CÔNG 100%! SERVER ĐANG CHẠY 24/7!"
echo "🌐 IP VPS của bạn: $VPS_IP"
echo "📲 Link tải cấu hình trực tiếp từ iPhone: https://$VPS_IP/LocketGold_Server.mobileconfig"
echo "============================================================================="

