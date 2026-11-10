// Ô Tính — lọc sản phẩm và form mua hàng. Không thư viện.
(function () {
  'use strict';

  // 1) Bộ lọc theo đối tượng (trang chủ)
  var filters = document.querySelectorAll('[data-filter]');
  if (filters.length) {
    filters.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var f = btn.getAttribute('data-filter');
        filters.forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
        document.querySelectorAll('[data-audience]').forEach(function (card) {
          card.hidden = !(f === 'all' || card.getAttribute('data-audience') === f);
        });
      });
    });
  }

  // 2) Form mua hàng: gửi mã sản phẩm + thông tin khách tới Apps Script, nhận checkoutUrl rồi chuyển sang payOS.
  // Giá KHÔNG gửi từ trình duyệt: server tự tra theo mã.
  var form = document.getElementById('checkout-form');
  if (!form) return;

  var msg = document.getElementById('checkout-msg');
  var btn = form.querySelector('button[type="submit"]');
  var cfg = window.OT_CONFIG || {};

  function show(text, kind) {
    msg.textContent = text;
    msg.className = 'msg ' + (kind || '');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.reportValidity()) return;

    if (!cfg.orderEndpoint) {
      show('Cổng thanh toán đang được cấu hình. Vui lòng quay lại sau.', 'err');
      return;
    }

    var payload = {};
    new FormData(form).forEach(function (v, k) { payload[k] = String(v).trim(); });

    btn.disabled = true;
    show('Đang tạo đơn, vui lòng chờ...', '');

    // text/plain tránh preflight CORS khi gọi Apps Script Web App
    fetch(cfg.orderEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json(); })
      .then(function (json) {
        if (!json || !json.checkoutUrl) throw new Error((json && json.error) || 'Không tạo được đơn.');
        window.location.href = json.checkoutUrl;
      })
      .catch(function (err) {
        show('Có lỗi: ' + err.message + ' Bạn thử lại hoặc nhắn Zalo để được hỗ trợ.', 'err');
        btn.disabled = false;
      });
  });
})();
