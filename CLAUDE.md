# Ô Tính — Landing page bán mẫu Google Sheets

File này là hướng dẫn cho Claude Code khi làm việc trong thư mục `OT_TemplateSheet`. Đọc hết trước khi viết code.

## 1. Mục tiêu

Một trang web nhỏ, thân thiện, dẫn người xem từ TikTok tới **trang trưng bày sản phẩm**, xem rõ từng mẫu và **mua trong 3 bước**: chọn mẫu → quét QR chuyển khoản → nhận file qua email.

Khách hàng chính:
- **Người đi làm, trưởng nhóm** (OT01, OT02)
- **Chủ cửa hàng nhỏ**, bản đầu là quán cà phê (OT03)

Phần lớn khách vào từ TikTok trên **điện thoại** → thiết kế mobile-first.

## 2. Phong cách hình ảnh

Thân thiện, hơi hoạt hình, màu nhẹ, tạo thiện cảm. Bám theo 3 ảnh trong `images/`.

**Màu**

| Vai trò | Mã |
|---|---|
| Viền, chữ chính (ink) | `#2B2D42` |
| Nền trang | `#FFFBF5` (kem rất nhạt) |
| Vàng điểm nhấn (ngôi sao, nút phụ) | `#FFD66B` |
| Hồng má linh vật | `#FF9FAE` |
| Nhóm Người đi làm — xanh lá | nền `#EEF8F1`, đậm `#1F6B43`, nhấn `#3FAE6A` |
| Nhóm team — xanh navy/mòng két | nền `#EEF3FB`, đậm `#233A66`, nhấn `#1C8C93` |
| Nhóm Chủ cửa hàng — nâu cà phê | nền `#FDF4EA`, đậm `#4A2E1F`, nhấn `#B9783F` |
| Trạng thái tốt / cảnh báo / xấu | `#12733A` / `#B06100` / `#C5221F` |

**Chữ:** `Baloo 2` (tiêu đề, 700–800) + `Nunito` (nội dung, 600–900). Cả hai có bộ ký tự tiếng Việt; tự host bằng `@fontsource` hoặc Google Fonts có `subset=vietnamese`.

**Hình khối:** bo góc 20–30px, viền `3–4px` màu ink, **bóng cứng** `6px 6px 0 #2B2D42` cho thẻ và nút (kiểu sticker). Nền có chấm bi mờ và vài ngôi sao 4 cánh. Nút bấm khi hover dịch lên 2px, bóng giảm còn 3px.

**Linh vật:** ô tính có mặt cười (xem ảnh). Dùng ở hero, trang cảm ơn, trang 404. Vẽ lại bằng SVG inline, giữ đúng tạo hình trong ảnh.

**Tránh:** gradient tím–xanh kiểu "AI", emoji làm icon (dùng icon SVG nét tròn), ảnh stock người thật, chữ trắng trên nền pastel (thiếu tương phản).

## 3. Cấu trúc trang

1. **Hero** — "Mẫu Google Sheets làm sẵn. Mở ra là dùng." + linh vật + nút "Xem các mẫu".
2. **Vì sao Ô Tính** — 3 thẻ: Tự tính, không cần công thức · Mua một lần, dùng mãi · Có hướng dẫn trong file.
3. **Trưng bày sản phẩm** — bộ lọc theo `audiences` (Tất cả / Người đi làm / Chủ cửa hàng nhỏ), lưới thẻ sản phẩm. Thẻ: ảnh, mã, tên, tagline, giá, badge, nút "Xem chi tiết" và "Mua ngay".
4. **Trang chi tiết** `/san-pham/{slug}` — ảnh lớn, mô tả, `benefits`, `includes`, **`limits` (bắt buộc hiển thị)**, giá, nút "Xem file mẫu" (khi có `demoUrl`) và "Mua ngay".
5. **Combo** — đọc từ `bundles`, hiện số tiền tiết kiệm so với mua lẻ.
6. **Cách mua 3 bước** — Chọn mẫu → Quét QR → Nhận link qua email trong vài phút.
7. **Cam kết minh bạch** — mua 1 lần không phí tháng; file nằm trong Google Drive của khách, Ô Tính không xem được dữ liệu; mỗi mẫu ghi rõ giới hạn; hỗ trợ qua Zalo; chính sách hoàn tiền (chủ thương hiệu sẽ cung cấp nội dung).
8. **FAQ** — dùng trên điện thoại được không · cần tài khoản Google không · nhận file thế nào · không nhận được email thì làm sao · có hoàn tiền không.
9. **Footer** — liên hệ, TikTok, chính sách, thông tin chủ shop.

Trang **Cảm ơn** `/cam-on` (sau thanh toán) và trang **Huỷ** `/thanh-toan-huy`.

## 4. Dữ liệu: `data/products.json` là nguồn duy nhất

- **Không hard-code** sản phẩm trong HTML. Mọi thẻ, trang chi tiết, bộ lọc, combo, sitemap đều sinh từ `products.json`.
- `status`: `selling` = hiện và mua được · `coming-soon` = hiện nhãn "Sắp có", ẩn nút mua · `hidden` = không hiện.
- Sắp xếp theo `order`. `badge` có thì hiện nhãn góc thẻ.
- Ảnh: dùng `image` (.webp), `imageFallback` (.png) cho trình duyệt cũ, luôn có `alt` từ `imageAlt`.
- Giá hiển thị dạng `69.000đ`. Có `compareAtPrice` thì hiện giá gạch.
- **File này công khai. Không bao giờ đặt link giao hàng (link tạo bản sao) vào đây.**

**Thêm sản phẩm mới:** chỉ cần (1) chép ảnh vào `images/`, (2) thêm 1 object vào `products`, (3) build lại. Không phải sửa code giao diện.

## 5. Kỹ thuật

- Site tĩnh (Astro hoặc HTML/JS thuần, Claude Code chọn), deploy miễn phí trên Cloudflare Pages, Netlify hoặc GitHub Pages.
- Lighthouse mobile ≥ 90; ảnh lazy-load; không thư viện nặng.
- Thẻ Open Graph cho từng sản phẩm (dùng ảnh sản phẩm) để chia sẻ link đẹp trên Zalo/Facebook.
- Có nút Zalo nổi ở góc dưới.

## 6. Thanh toán và gửi email (miễn phí)

### Lựa chọn đã đề xuất

| Việc | Công cụ | Ghi chú |
|---|---|---|
| Nhận tiền + báo đã thanh toán | **payOS** (ưu tiên) | Tạo link thanh toán QR + webhook. Đăng ký bằng CCCD, quảng cáo miễn phí phí giao dịch; giới hạn số giao dịch tuỳ gói/ngân hàng liên kết → chủ shop kiểm tra khi đăng ký. |
| Dự phòng | **SePay** gói FREE | 0đ, 50 giao dịch/tháng, có webhook. Vượt mức tính phí. |
| Lưu đơn + gửi mail | **Google Apps Script** + Google Sheet "Đơn hàng" + Gmail | Miễn phí. Tài khoản Gmail thường: 100 người nhận/ngày. |

### Luồng

```
Khách bấm "Mua ngay"
  → form: Họ tên, Email (bắt buộc), SĐT/Zalo (tuỳ chọn), mã sản phẩm
  → POST tới Apps Script Web App  (/createOrder)
      - kiểm tra mã + giá từ sheet "Kho sản phẩm" (KHÔNG tin giá từ trình duyệt)
      - tạo orderCode (số nguyên, duy nhất), ghi dòng "Chờ thanh toán" vào sheet "Đơn hàng"
      - gọi payOS tạo link thanh toán (amount, orderCode, description = "OT01 " + orderCode, returnUrl, cancelUrl)
      - trả checkoutUrl
  → chuyển khách sang trang QR của payOS
  → khách chuyển khoản
  → payOS gọi webhook → Apps Script (/webhook)
      - xác thực chữ ký bằng checksum key
      - tìm đơn theo orderCode, kiểm tra số tiền khớp
      - nếu chưa gửi: đổi "Đã thanh toán", gửi email, ghi thời điểm gửi (chống gửi trùng)
  → khách về /cam-on: "Kiểm tra hộp thư (kể cả Quảng cáo/Spam) trong 1–2 phút"
```

### Bảo mật

- API key, client id, checksum key của payOS chỉ nằm trong **Script Properties** của Apps Script, không nằm trong code frontend hay repo.
- **Link giao hàng** (dạng `https://docs.google.com/spreadsheets/d/<ID>/copy`) chỉ lưu trong sheet riêng tư "Kho sản phẩm", cột `deliveryUrl`. File gốc dùng để giao phải là **bản riêng, quyền "Người xem"**, không phải file đang chỉnh sửa.
- Combo: gửi tất cả link của các mẫu trong `items`.
- Xử lý trùng webhook (idempotent theo `orderCode`).

### Rủi ro cần kiểm thử trước khi mở bán

- Web App của Apps Script trả về **chuyển hướng 302** khi nhận POST. Một số dịch vụ webhook coi đó là lỗi. Dùng nút kiểm tra webhook trong trang quản trị payOS; nếu không qua, đặt một **Cloudflare Worker** (miễn phí) làm trạm trung gian nhận webhook rồi chuyển tiếp sang Apps Script.
- Có nút "Gửi lại email" trong menu của Google Sheet để chủ shop gửi tay khi khách báo chưa nhận.
- Làm thử 1 đơn thật giá nhỏ (đặt giá tạm 2.000đ) từ đầu tới cuối.

### Mẫu email cảm ơn

```
Tiêu đề: Ô Tính gửi bạn mẫu {Tên sản phẩm} 🎉

Chào {Họ tên},

Cảm ơn bạn đã mua {Tên sản phẩm} (đơn #{orderCode}, {Số tiền}đ).

Bấm vào link dưới đây, chọn "Tạo bản sao" là file nằm trong Google Drive của bạn, dùng được ngay:
👉 {deliveryUrl}

Mẹo: mở tab "Bắt đầu" trong file để xem hướng dẫn 3–4 bước.

Cần hỗ trợ, bạn nhắn Zalo {số Zalo} hoặc trả lời email này.
Ô Tính – Mẫu Google Sheets làm sẵn. Mở ra là dùng.
```

## 7. Quy trình khi có sản phẩm mới

1. Claude (chat) dựng Google Sheet mới trong Drive và vẽ ảnh sản phẩm.
2. Chép ảnh vào `images/`, thêm object vào `data/products.json`.
3. Tạo bản giao hàng (quyền Người xem), thêm `deliveryUrl` vào sheet riêng "Kho sản phẩm" cùng giá.
4. Claude Code build và deploy lại.

## 8. Checklist trước khi mở bán

- [ ] Đổi quyền thư mục "Kho template google sheet" về **Hạn chế** (hiện đang để ai có link cũng chỉnh sửa được).
- [ ] Tạo bản xem thử (Người xem) cho từng mẫu, điền `demoUrl`.
- [ ] Chủ shop chốt giá cuối và nội dung chính sách hoàn tiền.
- [ ] Đăng ký payOS (hoặc SePay), test 1 đơn thật.
- [ ] Kiểm tra nghĩa vụ thông báo website bán hàng với Bộ Công Thương (online.gov.vn).
- [ ] Kiểm tra trang trên điện thoại thật (iPhone + Android).

## 9. Ghi chú về ảnh

Ảnh trong `images/` là **ảnh minh hoạ** dựng lại theo bố cục và màu thật của từng file, số liệu lấy từ dữ liệu mẫu trong file. Trang chi tiết nên có thêm ảnh chụp màn hình thật hoặc GIF thao tác khi chủ shop quay xong video.
