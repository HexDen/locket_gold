# 👑 Hướng Dẫn Dựng Máy Chủ Locket Gold Server-Side 24/7 (Oracle Cloud Always Free)

> **Tác giả:** HexDen (Văn Nguyên)  
> **Kênh hỗ trợ:** [Facebook Văn Nguyên](https://www.facebook.com/van.nguyen.407297)  
> **Mục tiêu:** Tạo máy chủ riêng chạy 24/7 hoàn toàn miễn phí. Khách hàng chỉ cần tải file `.mobileconfig` là tự động lên Gold vĩnh viễn, quay video 60s và bộ lọc camera **mà không cần cài Shadowrocket hay bật VPN!**

---

## 🌟 Tổng Quan Kiến Trúc Hệ Thống

* **Máy chủ ảo (VPS):** Chạy trên Oracle Cloud Always Free (Miễn phí trọn đời, 1 IPv4 tĩnh riêng, mở toàn quyền cổng 443).
* **HexDen Root CA:** Chứng chỉ gốc riêng nhúng vào file `.mobileconfig` để iOS tin cậy máy chủ.
* **DNS DoH Resolver:** Tự động bắt cóc 3 tên miền `api.revenuecat.com`, `firebaseremoteconfig.googleapis.com`, `api.locketcamera.com` trỏ về VPS của bạn.
* **Server MITM Engine:** Tự động tiêm gói Gold VIP đến năm 2099 và mở thời lượng quay video 60 giây.

---

## 📋 Bước 1: Đăng ký tài khoản Oracle Cloud Always Free

1. Truy cập: [https://www.oracle.com/cloud/free/](https://www.oracle.com/cloud/free/)
2. Bấm nút **Start for free**.
3. Điền thông tin cá nhân (Email, Quốc gia: Vietnam).
4. Nhập thẻ thanh toán quốc tế (Visa / Mastercard) để xác minh danh tính (Oracle sẽ trừ tạm khoảng 1$ rồi hoàn lại ngay lập tức, không mất phí).
5. Hoàn tất đăng ký và đăng nhập vào bảng điều khiển (Console).

---

## 💻 Bước 2: Tạo máy chủ ảo Ubuntu (Compute Instance)

1. Tại thanh tìm kiếm trên cùng của Oracle Cloud, gõ `Instances` ➔ Bấm **Create Instance**.
2. **Name:** Đặt tên bất kỳ (ví dụ: `hexden-locket-server`).
3. **Image and Shape:**
   * Chọn **Ubuntu 22.04 LTS** (hoặc Ubuntu 24.04).
   * Shape: Chọn mặc định **VM.Standard.E2.1.Micro** (Luôn miễn phí - Always Free Eligible) hoặc ARM Ampere.
4. **Networking:**
   * Chọn **Assign a public IPv4 address** (Gán địa chỉ IP công cộng).
5. **Save Private Key:** Bấm nút **Download Private Key** (`.key` / `.pem`) về máy tính để đăng nhập SSH.
6. Bấm **Create**. Chờ khoảng 1-2 phút máy chủ sẽ chuyển sang màu xanh lá (**Running**).
7. Ghi lại **Public IP** của máy chủ (Ví dụ: `150.136.x.x`).

---

## 🔓 Bước 3: Mở Cổng 80 & 443 trên Oracle Cloud (Rất quan trọng!)

Mặc định Oracle Cloud chặn cổng 443 từ bên ngoài. Bạn cần mở cổng như sau:

1. Trong trang chi tiết máy chủ vừa tạo ➔ Bấm vào tên mạng **Subnet** (ví dụ: `subnet-2026...`).
2. Bấm vào **Default Security List for...**.
3. Bấm nút **Add Ingress Rules**:
   * **Source CIDR:** `0.0.0.0/0`
   * **IP Protocol:** `TCP`
   * **Destination Port Range:** `80,443`
   * **Description:** `HexDen Locket Gold Ports`
4. Bấm **Add Ingress Rules**.

---

## 🚀 Bước 4: Chạy lệnh cài đặt 1-Click lên VPS

Mở Terminal trên máy tính hoặc dùng phần mềm **PuTTY / MobaXterm** để đăng nhập vào VPS:

```bash
ssh -i /duong/dan/file_key.pem ubuntu@DIA_CHI_IP_VPS
```

Sau khi đã đăng nhập thành công vào VPS, chạy đúng 1 chuỗi lệnh duy nhất sau:

```bash
git clone https://github.com/HexDen/locket_gold.git
cd locket_gold/server_vps
chmod +x deploy.sh
./deploy.sh
```

Hệ thống sẽ tự động 100%:
* Mở tường lửa hệ điều hành.
* Tự động sinh chứng chỉ **HexDen Root CA**.
* Tạo file **`LocketGold_Server.mobileconfig`** chuẩn Apple gán sẵn IP của bạn.
* Khởi chạy dịch vụ chạy nền **24/7 tự khởi động lại khi mất điện**.

---

## 📱 Bước 5: Cung cấp cho khách hàng hoặc Cài lên iPhone

Sau khi chạy xong, màn hình sẽ in ra đường link:
$$\text{https://<IP_VPS_CỦA_BẠN>/LocketGold_Server.mobileconfig}$$

### Thao tác trên iPhone:
1. Mở Safari truy cập đường link trên và bấm **Cho phép tải về**.
2. Vào **Cài đặt ➔ Đã tải về hồ sơ ➔ Cài đặt**.
3. Vào **Cài đặt ➔ Cài đặt chung ➔ Giới thiệu ➔ Cài đặt tin cậy chứng nhận** ➔ Bật công tắc xanh cho **HexDen Root CA**.
4. **Mở app Locket lên: Đã có vương miện vàng Locket Gold VIP, quay video 60s và toàn bộ bộ lọc mà không cần bất kỳ VPN hay Shadowrocket nào!**
