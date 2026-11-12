@echo off
chcp 65001 >nul
title [HexDen] May Chu Locket Gold Local
color 0b

echo ===============================================================================
echo     👑 HEXDEN LOCKET GOLD - MAY CHU LOCAL NANG VIP CHO IPHONE
echo ===============================================================================
echo.

cd /d "%~dp0"

echo [*] Kiem tra chung chi Root CA...
python server_vps/generate_ca.py

echo.
echo [*] Dang lay dia chi IP mang noi bo cua may tinh...
for /f "tokens=*" %%i in ('python -c "import socket; s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(('8.8.8.8', 80)); print(s.getsockname()[0]); s.close()"') do set LOCAL_IP=%%i

echo [+] IP Noi Bo cua may tinh: %LOCAL_IP%
echo.

echo [*] Dang tao file ho so cau hinh .mobileconfig cho IP: %LOCAL_IP%...
python server_vps/generate_profile.py %LOCAL_IP%

echo.
echo ===============================================================================
echo  HUONG DAN SU DUNG CHO IPHONE DUNG CHUNG WI-FI:
echo  1. Ket noi iPhone vao cung mang Wi-Fi voi may tinh nay.
echo  2. Mo Safari tren iPhone va truy cap:
echo     https://%LOCAL_IP%/download
echo  3. Bam Cho Phep tai ho so cau hinh.
echo  4. Vao Cai Dat iPhone - Da tai ve ho so - Bam Cai Dat.
echo  5. Vao Cai Dat - Cai dat chung - Gioi thieu - Cai dat tin cay chung chi:
echo     BAT TIN CAY cho "HexDen Root CA".
echo  6. Mo Locket len la tu dong nhan GOLD VIP 2099!
echo ===============================================================================
echo.
echo [*] Dang khoi chay May Chu Proxy tren cong 443...
echo (Nhan Ctrl + C de dung may chu khi xong)
echo.

python server_vps/proxy_server.py 443

pause

