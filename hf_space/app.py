"""
=============================================================================
👑 HEXDEN LOCKET AI SERVER - BACKEND XỬ LÝ FILTER AI MIỄN PHÍ
Tác giả: HexDen (Văn Nguyên)
Hỗ trợ: https://www.facebook.com/van.nguyen.407297
Hỗ trợ: Hugging Face Spaces (Chạy 24/7 hoàn toàn miễn phí)
=============================================================================
"""

import io
import os
import math
import random
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps, ImageDraw, ImageFont
from fastapi import FastAPI, Request, UploadFile, File, Query, Response
from fastapi.responses import HTMLResponse, StreamingResponse

app = FastAPI(title="HexDen Locket AI Server", version="1.0.0")

# ---------------------------------------------------------------------------
# 🎨 BỘ LỌC 1: HIỆU ỨNG MÁY PHIM "ĐANG RỬA ẢNH" (VINTAGE POLAROID / KODAK)
# ---------------------------------------------------------------------------
def apply_vintage_film(img: Image.Image) -> Image.Image:
    img = img.convert("RGB")
    width, height = img.size
    
    # 1. Tách kênh màu và cân chỉnh tông ấm Kodak Portra
    r, g, b = img.split()
    r = r.point(lambda i: min(255, int(i * 1.08 + 10)))  # Tăng ấm đỏ
    g = g.point(lambda i: min(255, int(i * 1.02 + 5)))   # Cân bằng xanh lá
    b = b.point(lambda i: max(0, int(i * 0.90 + 12)))    # Nâng shadow xanh tạo cảm giác film fade
    vintage_img = Image.merge("RGB", (r, g, b))
    
    # 2. Tăng độ bão hòa màu nhẹ
    enhancer = ImageEnhance.Color(vintage_img)
    vintage_img = enhancer.enhance(1.18)
    
    # 3. Tạo hiệu ứng Vignette (tối viền 4 góc mô phỏng ống kính quang học)
    x = np.linspace(-1, 1, width)
    y = np.linspace(-1, 1, height)
    xx, yy = np.meshgrid(x, y)
    radius = np.sqrt(xx**2 + yy**2)
    vig_arr = np.clip(1 - (radius - 0.45) * 0.35, 0.68, 1.0)
    
    img_arr = np.array(vintage_img, dtype=np.float32)
    img_arr = img_arr * vig_arr[:, :, np.newaxis]
    
    # 4. Thêm hạt bụi phim tự nhiên (Film Grain)
    noise = np.random.normal(0, 6.5, img_arr.shape)
    img_arr = np.clip(img_arr + noise, 0, 255).astype(np.uint8)
    res_img = Image.fromarray(img_arr)
    
    # 5. Thêm vết lóa sáng nhẹ ở góc (Light Leak analog)
    leak = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(leak)
    leak_radius = int(width * 0.35)
    draw.ellipse((-leak_radius//2, -leak_radius//2, leak_radius, leak_radius), fill=(255, 140, 40, 45))
    leak = leak.filter(ImageFilter.GaussianBlur(radius=leak_radius // 3))
    
    res_img = res_img.convert("RGBA")
    res_img = Image.alpha_composite(res_img, leak).convert("RGB")
    return res_img

# ---------------------------------------------------------------------------
# 🎨 BỘ LỌC 2: HIỆU ỨNG ANIME / CARTOON NGHỆ THUẬT (GHIBLI ART)
# ---------------------------------------------------------------------------
def apply_anime_art(img: Image.Image) -> Image.Image:
    img = img.convert("RGB")
    width, height = img.size
    
    # 1. Làm mịn mảng màu và làm nét chi tiết viền
    smooth = img.filter(ImageFilter.SMOOTH_MORE)
    edges = img.filter(ImageFilter.FIND_EDGES).convert('L')
    edges = ImageOps.invert(edges)
    edges = edges.point(lambda i: 0 if i < 140 else 255) # Ngưỡng nét viền
    
    # 2. Tăng độ rực rỡ màu sắc kiểu hoạt hình
    color_enhancer = ImageEnhance.Color(smooth)
    anime_colored = color_enhancer.enhance(1.4)
    
    contrast_enhancer = ImageEnhance.Contrast(anime_colored)
    anime_contrasted = contrast_enhancer.enhance(1.2)
    
    # 3. Phủ viền chì nét vẽ lên ảnh màu
    edges_rgb = Image.merge("RGB", (edges, edges, edges))
    final = ImageChops_multiply(anime_contrasted, edges_rgb)
    return final

def ImageChops_multiply(img1, img2):
    arr1 = np.array(img1, dtype=np.float32) / 255.0
    arr2 = np.array(img2, dtype=np.float32) / 255.0
    res = np.clip(arr1 * arr2 * 255.0, 0, 255).astype(np.uint8)
    return Image.fromarray(res)

# ---------------------------------------------------------------------------
# 🎨 BỘ LỌC 3: HIỆU ỨNG CYBER HEXDEN (NEON CYAN & NIGHT)
# ---------------------------------------------------------------------------
def apply_cyber_hexden(img: Image.Image) -> Image.Image:
    img = img.convert("RGB")
    r, g, b = img.split()
    r = r.point(lambda i: int(i * 0.82))
    g = g.point(lambda i: min(255, int(i * 1.12 + 10)))
    b = b.point(lambda i: min(255, int(i * 1.28 + 18)))
    cyber_img = Image.merge("RGB", (r, g, b))
    
    enhancer = ImageEnhance.Contrast(cyber_img)
    return enhancer.enhance(1.25)


# ---------------------------------------------------------------------------
# 🌐 ENDPOINTS XỬ LÝ API CHO SHADOWROCKET VÀ WEB
# ---------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
async def home():
    """Giao diện Web trực quan để test thử ảnh trước khi dùng trên điện thoại."""
    return """
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>👑 HexDen Locket AI Filter Server</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            body { background: radial-gradient(circle at top, #0f172a, #020617); }
        </style>
    </head>
    <body class="min-h-screen text-slate-100 flex items-center justify-center p-4">
        <div class="max-w-xl w-full bg-slate-900/90 border border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
            <div class="text-center mb-6">
                <span class="text-xs font-mono px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-full font-bold">ONLINE 24/7 • MIỄN PHÍ</span>
                <h1 class="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mt-2">
                    👑 HexDen Locket AI
                </h1>
                <p class="text-slate-400 text-sm mt-1">Máy chủ xử lý bộ lọc ảnh AI & Hiệu ứng Đang Rửa Ảnh cho Locket Gold</p>
            </div>

            <form id="uploadForm" class="space-y-4">
                <div>
                    <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">1. Chọn bộ lọc AI muốn áp dụng:</label>
                    <select id="filterType" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-cyan-300 focus:outline-none focus:border-cyan-400">
                        <option value="vintage_film">🎞️ Đang Rửa Ảnh (Vintage Polaroid & Film Grain)</option>
                        <option value="anime_art">🌸 Anime Nghệ Thuật (Ghibli Style)</option>
                        <option value="cyber_hexden">⚡ Cyber HexDen (Xanh Neon Độc Quyền)</option>
                    </select>
                </div>

                <div>
                    <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">2. Chọn ảnh để test thử:</label>
                    <input type="file" id="imageInput" accept="image/*" class="w-full text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-cyan-500/20 file:text-cyan-300 hover:file:bg-cyan-500/30 cursor-pointer">
                </div>

                <button type="submit" id="btnSubmit" class="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl shadow-lg transition duration-200">
                    Áp Dụng Filter Ngay 🚀
                </button>
            </form>

            <div id="resultContainer" class="mt-6 hidden">
                <p class="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2">✅ Kết quả ảnh sau khi qua AI:</p>
                <div class="rounded-2xl overflow-hidden border border-slate-700 shadow-xl flex justify-center bg-black">
                    <img id="resultImg" class="max-h-[350px] w-auto object-contain">
                </div>
            </div>
        </div>

        <script>
            document.getElementById('uploadForm').onsubmit = async (e) => {
                e.preventDefault();
                const fileInput = document.getElementById('imageInput');
                if (!fileInput.files[0]) {
                    alert('Vui lòng chọn 1 bức ảnh để test!');
                    return;
                }
                const btn = document.getElementById('btnSubmit');
                btn.innerText = 'Đang rửa ảnh... Vui lòng đợi ⏳';
                btn.disabled = true;

                const filter = document.getElementById('filterType').value;
                const file = fileInput.files[0];

                try {
                    const resp = await fetch(`/process?filter=${filter}`, {
                        method: 'POST',
                        body: file,
                        headers: { 'Content-Type': file.type || 'image/jpeg' }
                    });
                    if (!resp.ok) throw new Error('Xử lý thất bại');
                    const blob = await resp.blob();
                    document.getElementById('resultImg').src = URL.createObjectURL(blob);
                    document.getElementById('resultContainer').classList.remove('hidden');
                } catch (err) {
                    alert('Lỗi: ' + err.message);
                } finally {
                    btn.innerText = 'Áp Dụng Filter Ngay 🚀';
                    btn.disabled = false;
                }
            };
        </script>
    </body>
    </html>
    """

@app.post("/process")
async def process_image(
    request: Request,
    filter: str = Query("vintage_film", description="Loại filter: vintage_film, anime_art, cyber_hexden")
):
    """
    Endpoint chính tiếp nhận ảnh từ Shadowrocket hoặc cURL.
    Hỗ trợ nhận raw binary body hoặc form upload.
    """
    body = await request.body()
    if not body:
        return Response(content="Missing image data", status_code=400)
    
    try:
        input_image = Image.open(io.BytesIO(body))
    except Exception as e:
        return Response(content=f"Cannot decode image: {str(e)}", status_code=400)
    
    # Áp dụng bộ lọc tương ứng
    if filter == "anime_art":
        processed = apply_anime_art(input_image)
    elif filter == "cyber_hexden":
        processed = apply_cyber_hexden(input_image)
    else:
        processed = apply_vintage_film(input_image) # Mặc định là hiệu ứng rửa ảnh
    
    # Xuất ra dạng JPEG chất lượng cao
    output_io = io.BytesIO()
    processed.save(output_io, format="JPEG", quality=92)
    output_io.seek(0)
    
    return Response(content=output_io.getvalue(), media_type="image/jpeg")

@app.get("/locketgold.mobileconfig")
@app.get("/dns")
async def download_dns():
    """
    Phân phối Hồ sơ Cấu hình DNS Chống Thu Hồi (.mobileconfig) chuẩn Apple.
    Bắt buộc phải trả về header Content-Type: application/x-apple-aspen-config
    để iOS Safari tự động mở trình cài đặt trong Cài đặt iPhone thay vì tải file thường.
    """
    config_path = os.path.join(os.path.dirname(__file__), "locketgold.mobileconfig")
    if not os.path.exists(config_path):
        config_path = "locketgold.mobileconfig"
    
    if not os.path.exists(config_path):
        return Response(content="Profile not found", status_code=404)
        
    with open(config_path, "rb") as f:
        content = f.read()
        
    return Response(
        content=content,
        media_type="application/x-apple-aspen-config",
        headers={
            "Content-Disposition": 'inline; filename="locketgold.mobileconfig"',
            "Cache-Control": "no-cache, no-store, must-revalidate"
        }
    )

if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)

