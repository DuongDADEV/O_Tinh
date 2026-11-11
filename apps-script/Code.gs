/**
 * Ô Tính — backend đơn hàng: Google Apps Script gắn với Google Sheet "Dsach KH mua Template".
 *
 * Script Properties cần có (Cài đặt dự án → Thuộc tính tập lệnh):
 *   PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY   (từ payOS)
 *   SITE_URL        địa chỉ website, ví dụ https://otinh.pages.dev (không có dấu / cuối)
 *   SUPPORT_ZALO    (tuỳ chọn) số Zalo hiện trong email
 *
 * Triển khai: Triển khai → Tuỳ chọn triển khai mới → Ứng dụng web
 *   Thực thi với tư cách: Tôi · Người có quyền truy cập: Bất kỳ ai
 *
 * Một URL /exec dùng cho cả 2 việc, phân biệt theo nội dung:
 *   - Webhook payOS: có "data" và "signature"
 *   - Tạo đơn từ website: có "code" (mã SP), "name", "email"
 */

const SHEET_ORDERS = 'Đơn hàng';
const SHEET_STORE = 'Kho sản phẩm';
// Cột sheet "Đơn hàng" (bắt đầu từ 1)
const COL = { TIME: 1, CODE: 2, SKU: 3, NAME: 4, AMOUNT: 5, CUSTOMER: 6, EMAIL: 7, PHONE: 8, STATUS: 9, SENT: 10, NOTE: 11, PROMO: 12 };
const ORDER_COLS = 11;
const ST_PENDING = 'Chờ thanh toán';
const ST_PAID = 'Đã thanh toán';
const ST_ERROR = 'Lỗi tạo link';
const PAYOS_HOST = 'https://api-merchant.payos.vn'; // nếu payOS đổi địa chỉ API, chỉ sửa dòng này
const PAYOS_API = PAYOS_HOST + '/v2';

// ---------- điểm vào ----------
function doGet() {
  return json({ ok: true, service: 'Ô Tính' });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (_) {
    return json({ error: 'Dữ liệu không hợp lệ.' });
  }
  try {
    if (body && body.data && body.signature) return json(handleWebhook(body));
    return json(handleCreateOrder(body || {}));
  } catch (err) {
    console.error(err && err.stack || err);
    return json({ error: err.userMessage || 'Hệ thống đang bận, vui lòng thử lại.' });
  }
}

// ---------- tạo đơn ----------
function handleCreateOrder(b) {
  const sku = String(b.code || '').trim().toUpperCase();
  const name = String(b.name || '').trim().slice(0, 100);
  const email = String(b.email || '').trim().toLowerCase().slice(0, 120);
  const phone = String(b.phone || '').trim().slice(0, 20);
  const promo = b.promo ? 'Có' : 'Không'; // khách tích đồng ý nhận khuyến mãi (mặc định không)

  if (!name) throw userError('Vui lòng nhập họ tên.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw userError('Email chưa đúng, bạn kiểm tra lại nhé.');

  // Giá luôn lấy từ sheet "Kho sản phẩm", KHÔNG tin dữ liệu từ trình duyệt
  const product = getProduct(sku);
  if (!product || product.status !== 'selling') throw userError('Sản phẩm không tồn tại hoặc chưa mở bán.');
  const amount = product.price;
  // Kiểm tra cấu hình TRƯỚC khi ghi sheet, để lỗi cấu hình không để lại dòng thừa
  const siteUrl = need('SITE_URL').replace(/\/$/, '');
  need('PAYOS_CLIENT_ID'); need('PAYOS_API_KEY'); need('PAYOS_CHECKSUM_KEY');

  const orderCode = Number(String(Date.now()) + Math.floor(Math.random() * 10));
  const sheet = ordersSheet();
  let row;
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    sheet.appendRow([new Date(), orderCode, sku, product.name, amount, '', '', '', ST_PENDING, '', '', promo]);
    row = sheet.getLastRow();
    // Định dạng văn bản thuần cho thông tin khách: giữ số 0 đầu SĐT, chặn công thức
    sheet.getRange(row, COL.CUSTOMER, 1, 3).setNumberFormat('@').setValues([[name, email, phone]]);
  } finally {
    lock.releaseLock();
  }

  const returnUrl = siteUrl + '/cam-on/';
  const cancelUrl = siteUrl + '/thanh-toan-huy/';
  const description = (sku + ' ' + orderCode).slice(0, 25);
  const signature = hmac(
    'amount=' + amount + '&cancelUrl=' + cancelUrl + '&description=' + description +
    '&orderCode=' + orderCode + '&returnUrl=' + returnUrl
  );

  const payload = {
    orderCode: orderCode,
    amount: amount,
    description: description,
    buyerName: name,
    buyerEmail: email,
    items: [{ name: product.name, quantity: 1, price: amount }],
    cancelUrl: cancelUrl,
    returnUrl: returnUrl,
    signature: signature,
  };
  if (phone) payload.buyerPhone = phone;

  const res = UrlFetchApp.fetch(PAYOS_API + '/payment-requests', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-client-id': need('PAYOS_CLIENT_ID'), 'x-api-key': need('PAYOS_API_KEY') },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  let out = {};
  try { out = JSON.parse(res.getContentText()); } catch (_) {}

  if (out.code !== '00' || !out.data || !out.data.checkoutUrl) {
    sheet.getRange(row, COL.STATUS).setValue(ST_ERROR);
    sheet.getRange(row, COL.NOTE).setValue('payOS: ' + (out.code || res.getResponseCode()) + ' ' + (out.desc || ''));
    throw userError('Không tạo được link thanh toán. Vui lòng thử lại sau ít phút.');
  }
  return { checkoutUrl: out.data.checkoutUrl };
}

// ---------- webhook payOS ----------
function handleWebhook(b) {
  if (!verifySignature(b.data, b.signature)) return { success: false, error: 'Sai chữ ký' };
  if (String(b.code) !== '00' || b.success === false) return { success: true }; // chỉ xử lý giao dịch thành công

  const d = b.data;
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = ordersSheet();
    const row = findOrderRow(sheet, d.orderCode);
    if (!row) return { success: true }; // webhook thử của payOS hoặc đơn lạ

    const r = sheet.getRange(row, 1, 1, ORDER_COLS).getValues()[0];
    if (r[COL.SENT - 1]) return { success: true }; // đã gửi rồi → bỏ qua (chống trùng)

    if (Number(r[COL.AMOUNT - 1]) !== Number(d.amount)) {
      sheet.getRange(row, COL.NOTE).setValue('Số tiền không khớp: nhận ' + d.amount + ', cần ' + r[COL.AMOUNT - 1]);
      return { success: true };
    }

    sheet.getRange(row, COL.STATUS).setValue(ST_PAID);
    try {
      sendDelivery(rowToOrder(r));
      sheet.getRange(row, COL.SENT).setValue(new Date());
      sheet.getRange(row, COL.NOTE).setValue('');
    } catch (err) {
      sheet.getRange(row, COL.NOTE).setValue('Lỗi gửi mail: ' + err.message + ' — dùng menu Ô Tính → Gửi lại email');
    }
  } finally {
    lock.releaseLock();
  }
  return { success: true };
}

// ---------- gửi email ----------
function sendDelivery(o) {
  const product = getProduct(o.sku);
  if (!product) throw new Error('Không tìm thấy sản phẩm ' + o.sku);
  const links = product.items.map(function (id) {
    const p = getProduct(id);
    if (!p || !p.deliveryUrl) throw new Error('Thiếu deliveryUrl cho ' + id);
    return { name: p.name, url: p.deliveryUrl };
  });

  const zalo = PropertiesService.getScriptProperties().getProperty('SUPPORT_ZALO');
  const support = zalo ? 'nhắn Zalo ' + zalo + ' hoặc trả lời email này' : 'trả lời email này';
  const linkBlock = links.length === 1
    ? '👉 ' + links[0].url
    : links.map(function (l) { return '👉 ' + l.name + ': ' + l.url; }).join('\n');

  const body =
    'Chào ' + o.customer + ',\n\n' +
    'Cảm ơn bạn đã mua ' + o.name + ' (đơn #' + o.orderCode + ', ' + money(o.amount) + ').\n\n' +
    'Bấm vào link dưới đây, chọn "Tạo bản sao" là file nằm trong Google Drive của bạn, dùng được ngay:\n' +
    linkBlock + '\n\n' +
    'Mẹo: mở tab "Bắt đầu" trong file để xem hướng dẫn 3–4 bước.\n\n' +
    'Cần hỗ trợ, bạn ' + support + '.\n' +
    'Ô Tính – Mẫu Google Sheets làm sẵn. Mở ra là dùng.';

  MailApp.sendEmail({ to: o.email, subject: 'Ô Tính gửi bạn mẫu ' + o.name + ' 🎉', body: body, name: 'Ô Tính' });
}

// ---------- menu trong Google Sheet ----------
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Ô Tính')
    .addItem('Gửi lại email cho dòng đang chọn', 'resendSelected')
    .addItem('Đăng ký webhook với payOS', 'registerWebhook')
    .addItem('Kiểm tra cấu hình', 'checkConfig')
    .addToUi();
}

function resendSelected() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSheet();
  const row = sheet.getActiveCell().getRow();
  if (sheet.getName() !== SHEET_ORDERS || row < 2) {
    ui.alert('Hãy chọn một ô thuộc dòng đơn hàng trong tab "' + SHEET_ORDERS + '".');
    return;
  }
  const r = sheet.getRange(row, 1, 1, ORDER_COLS).getValues()[0];
  if (r[COL.STATUS - 1] !== ST_PAID) {
    ui.alert('Đơn này chưa ở trạng thái "' + ST_PAID + '", không gửi file.');
    return;
  }
  const o = rowToOrder(r);
  if (ui.alert('Gửi lại file cho ' + o.email + '?', 'Đơn #' + o.orderCode + ' · ' + o.name, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  try {
    sendDelivery(o);
    sheet.getRange(row, COL.SENT).setValue(new Date());
    sheet.getRange(row, COL.NOTE).setValue('Đã gửi lại bằng tay');
    ui.alert('Đã gửi.');
  } catch (err) {
    ui.alert('Lỗi: ' + err.message);
  }
}

function registerWebhook() {
  const ui = SpreadsheetApp.getUi();
  const url = ScriptApp.getService().getUrl();
  if (!url) {
    ui.alert('Chưa triển khai Ứng dụng web. Hãy triển khai trước rồi chạy lại.');
    return;
  }
  const res = UrlFetchApp.fetch(PAYOS_HOST + '/confirm-webhook', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-client-id': need('PAYOS_CLIENT_ID'), 'x-api-key': need('PAYOS_API_KEY') },
    payload: JSON.stringify({ webhookUrl: url }),
    muteHttpExceptions: true,
  });
  ui.alert('payOS trả lời (' + res.getResponseCode() + '):\n' + res.getContentText().slice(0, 500) + '\n\nWebhook URL: ' + url);
}

/**
 * Đăng ký webhook ngay từ trình soạn thảo (không cần menu trong sheet).
 * Chọn hàm này trong ô thả xuống → Chạy → xem kết quả trong "Nhật ký thực thi".
 * Địa chỉ web app (/exec) bên dưới là địa chỉ công khai của bạn; sửa nếu bạn tạo triển khai mới.
 */
function registerWebhookNow() {
  const url = 'https://script.google.com/macros/s/AKfycbz2tCJoetAfrsr_xp0lFVKXKjHJxGBxJe8-ZGIgunIQXLi7HKzZ0XCW9X_u1bMVlXeQ/exec';
  const res = UrlFetchApp.fetch(PAYOS_HOST + '/confirm-webhook', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-client-id': need('PAYOS_CLIENT_ID'), 'x-api-key': need('PAYOS_API_KEY') },
    payload: JSON.stringify({ webhookUrl: url }),
    muteHttpExceptions: true,
  });
  console.log('payOS trả lời (' + res.getResponseCode() + '): ' + res.getContentText().slice(0, 600));
}

/**
 * Thử tạo đơn ngay trong trình soạn thảo để thấy lỗi thật (nếu có).
 * Sẽ tạo 1 dòng "Chờ thanh toán" trong sheet và 1 link payOS chưa thanh toán (vô hại, có thể xoá dòng đó).
 */
function testCreateOrder() {
  try {
    const out = handleCreateOrder({ code: 'OT01', name: 'Khách test', email: 'test@example.com', phone: '' });
    console.log('OK: ' + JSON.stringify(out));
  } catch (err) {
    console.log('LỖI: ' + err.message + '\n' + (err.stack || ''));
  }
}

function checkConfig() {
  const props = PropertiesService.getScriptProperties();
  const missing = ['PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY', 'SITE_URL'].filter(function (k) { return !props.getProperty(k); });
  const msg = missing.length ? 'Thiếu Script Properties: ' + missing.join(', ') : 'Đủ cấu hình. Sẵn sàng.';
  try { SpreadsheetApp.getUi().alert(msg); } catch (_) { console.log(msg); }
}

// ---------- tiện ích ----------
function ordersSheet() {
  const s = SpreadsheetApp.getActive().getSheetByName(SHEET_ORDERS);
  if (!s) throw new Error('Thiếu tab ' + SHEET_ORDERS);
  return s;
}

function getProduct(sku) {
  const s = SpreadsheetApp.getActive().getSheetByName(SHEET_STORE);
  if (!s || s.getLastRow() < 2) return null;
  const rows = s.getRange(2, 1, s.getLastRow() - 1, 7).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toUpperCase() === sku) {
      const r = rows[i];
      const items = String(r[6] || '').split(',').map(function (x) { return x.trim().toUpperCase(); }).filter(Boolean);
      return {
        sku: sku, name: String(r[1]), price: Number(r[2]), status: String(r[3]).trim(),
        deliveryUrl: String(r[4] || '').trim(), items: items.length ? items : [sku],
      };
    }
  }
  return null;
}

function findOrderRow(sheet, orderCode) {
  const last = sheet.getLastRow();
  if (last < 2) return 0;
  const vals = sheet.getRange(2, COL.CODE, last - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) if (Number(vals[i][0]) === Number(orderCode)) return i + 2;
  return 0;
}

function rowToOrder(r) {
  return {
    orderCode: r[COL.CODE - 1], sku: String(r[COL.SKU - 1]), name: String(r[COL.NAME - 1]),
    amount: Number(r[COL.AMOUNT - 1]), customer: String(r[COL.CUSTOMER - 1]), email: String(r[COL.EMAIL - 1]),
  };
}

function hmac(text) {
  const bytes = Utilities.computeHmacSha256Signature(text, need('PAYOS_CHECKSUM_KEY'));
  return bytes.map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, '0'); }).join('');
}

// Ký dữ liệu webhook: sắp xếp khóa theo A–Z, ghép key=value bằng &, null → rỗng
function verifySignature(data, signature) {
  const text = Object.keys(data).sort().map(function (k) {
    let v = data[k];
    if (v === null || v === undefined || v === 'null' || v === 'undefined') v = '';
    else if (typeof v === 'object') v = JSON.stringify(v);
    return k + '=' + v;
  }).join('&');
  return hmac(text) === String(signature).toLowerCase();
}

function need(key) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) throw new Error('Thiếu Script Property: ' + key);
  return v;
}

function money(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ'; }
function json(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function userError(msg) { const e = new Error(msg); e.userMessage = msg; return e; }
