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

  // 1b) Chiến dịch (Giáng Sinh...): đếm ngược theo ngày kết thúc thật, tuyết rơi.
  // Quá hạn thì tự gỡ trang trí ở trình duyệt (giá hiển thị đổi sau lần build kế tiếp).
  var count = document.querySelector('.campaign-count');
  if (count) {
    var end = new Date(count.getAttribute('data-ends')).getTime();
    if (!isNaN(end)) {
      var left = end - Date.now();
      if (left <= 0) {
        var bar = document.querySelector('.campaign-bar');
        if (bar) bar.hidden = true;
        document.body.className = document.body.className.replace(/\bcampaign(-\w+)?\b/g, '').trim();
        document.querySelectorAll('.lights, .santa-hat, .sale-tag').forEach(function (el) { el.hidden = true; });
      } else {
        var days = Math.ceil(left / 86400000);
        count.textContent = days > 1 ? 'còn ' + days + ' ngày' : 'hôm nay là ngày cuối';
      }
    }
  }
  if (document.body.classList.contains('campaign-noel') &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var snow = document.createElement('div');
    snow.className = 'snow';
    snow.setAttribute('aria-hidden', 'true');
    var n = window.innerWidth < 600 ? 22 : 36;
    for (var i = 0; i < n; i++) {
      var f = document.createElement('i');
      var s = 4 + Math.random() * 6;
      f.style.cssText = 'left:' + (Math.random() * 100).toFixed(1) + '%;width:' + s.toFixed(1) + 'px;height:' + s.toFixed(1) +
        'px;animation-duration:' + (9 + Math.random() * 10).toFixed(1) + 's;animation-delay:-' + (Math.random() * 18).toFixed(1) +
        's;--dx:' + (Math.random() * 60 - 30).toFixed(0) + 'px;opacity:' + (0.55 + Math.random() * 0.45).toFixed(2);
      snow.appendChild(f);
    }
    document.body.appendChild(snow);
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
