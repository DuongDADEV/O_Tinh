// Build site tĩnh từ data/products.json → dist/
// Chạy: npm run build   (Node 18+, không cần thư viện ngoài)
import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const data = JSON.parse(await readFile(path.join(ROOT, 'data/products.json'), 'utf8'));
const config = JSON.parse(await readFile(path.join(ROOT, 'site.config.json'), 'utf8'));
const SITE_URL = (process.env.SITE_URL || config.siteUrl).replace(/\/$/, '');
const { brand } = data;
const YEAR = new Date().getFullYear();

// ---------- tiện ích ----------
const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';

const products = data.products.filter((p) => p.status !== 'hidden').sort((a, b) => a.order - b.order);
const sellable = products.filter((p) => p.status === 'selling');
const bundles = data.bundles.filter((b) => b.status === 'selling');
const byId = Object.fromEntries(data.products.map((p) => [p.id, p]));
const themeOf = (p) => p.theme || (p.audience === 'chu-cua-hang' ? 'brown' : 'green');
const audName = (id) => data.audiences.find((a) => a.id === id)?.name ?? '';
const bundleInfo = (b) => {
  const list = b.items.map((id) => byId[id]);
  const full = list.reduce((s, p) => s + p.price, 0);
  return { list, full, save: full - b.price };
};

// ---------- thành phần dùng chung ----------
const mascot = (label = 'Linh vật Ô Tính, ô tính có mặt cười') => `
<svg class="mascot" viewBox="0 0 300 300" role="img" aria-label="${esc(label)}">
  <ellipse cx="150" cy="284" rx="78" ry="8" fill="#2B2D42" opacity=".12"/>
  <path d="M150 84 C150 62 140 50 122 48 C126 64 134 76 150 84Z" fill="#3FAE6A" stroke="#2B2D42" stroke-width="6" stroke-linejoin="round"/>
  <path d="M150 84 C158 64 176 58 192 64 C186 78 168 86 150 84Z" fill="#3FAE6A" stroke="#2B2D42" stroke-width="6" stroke-linejoin="round"/>
  <path d="M66 190 C44 186 40 160 58 150" fill="none" stroke="#2B2D42" stroke-width="7" stroke-linecap="round"/>
  <path d="M234 190 C256 186 260 160 242 150" fill="none" stroke="#2B2D42" stroke-width="7" stroke-linecap="round"/>
  <rect class="body" x="72" y="86" width="156" height="178" rx="40" stroke="#2B2D42" stroke-width="8"/>
  <path d="M72 128 H228" stroke="#2B2D42" stroke-width="5" opacity=".2"/>
  <circle cx="122" cy="166" r="11" fill="#2B2D42"/><circle cx="126" cy="162" r="3.6" fill="#fff"/>
  <circle cx="178" cy="166" r="11" fill="#2B2D42"/><circle cx="182" cy="162" r="3.6" fill="#fff"/>
  <ellipse cx="104" cy="194" rx="13" ry="8" fill="#FF9FAE"/>
  <ellipse cx="196" cy="194" rx="13" ry="8" fill="#FF9FAE"/>
  <path d="M136 190 Q150 204 164 190" fill="none" stroke="#2B2D42" stroke-width="6" stroke-linecap="round"/>
  <rect x="94" y="258" width="26" height="24" rx="10" fill="#2B2D42"/>
  <rect x="180" y="258" width="26" height="24" rx="10" fill="#2B2D42"/>
</svg>`;

const icon = (name) => {
  const paths = {
    calc: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6M9 13h2M13 13h2M9 17h2M13 17h2"/>',
    infinity: '<path d="M12 12c-2-3-4-4-6-4a4 4 0 000 8c2 0 4-1 6-4zm0 0c2 3 4 4 6 4a4 4 0 000-8c-2 0-4 1-6 4z"/>',
    book: '<path d="M4 5a2 2 0 012-2h13v15H6a2 2 0 00-2 2V5z"/><path d="M4 20a2 2 0 012-2h13"/>',
    check: '<path d="M5 12l4 4 10-10"/>',
    cross: '<path d="M6 6l12 12M18 6L6 18"/>',
    chat: '<path d="M4 5h16v11H9l-5 4V5z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7l8 6 8-6"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M3 4h2l2.5 11h10L20 7H7"/>',
    qr: '<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><path d="M14 14h2v2h-2zM18 14h2v6h-6v-2"/>',
    send: '<path d="M4 12l16-8-6 16-3-7-7-1z"/>',
    tiktok: '<path d="M14 4v11a3 3 0 11-3-3"/><path d="M14 4c0 2.5 2 4.5 5 4.5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  };
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
};

const picture = (p, cls = '', eager = false) => `
<picture class="${cls}">
  <source srcset="/${p.image}" type="image/webp">
  <img src="/${p.imageFallback}" alt="${esc(p.imageAlt)}" width="1600" height="1200" ${eager ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"'}>
</picture>`;

// Logo linh vật (logo/01-linh-vat.png, bản thu nhỏ trong static/assets/)
const logoImg = `<img class="logo" src="/assets/logo-128.png" alt="" width="44" height="44">`;

const header = `
<header class="site-header">
  <div class="wrap nav">
    <a class="brand" href="/" aria-label="Ô Tính — trang chủ">
      ${logoImg}<span class="brand-name">Ô Tính</span>
    </a>
    <nav aria-label="Menu chính">
      <a href="/#san-pham">Mẫu</a>
      <a href="/#combo">Combo</a>
      <a href="/#cach-mua">Cách mua</a>
      <a href="/#faq">Hỏi đáp</a>
    </nav>
  </div>
</header>`;

const footer = `
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <a class="brand" href="/">${logoImg}<span class="brand-name">Ô Tính</span></a>
      <p class="muted">${esc(brand.tagline)}</p>
    </div>
    <div>
      <h3>Liên hệ</h3>
      <ul class="plain">
        ${brand.tiktok ? `<li><a href="${esc(brand.tiktok)}" target="_blank" rel="noopener">${icon('tiktok')} TikTok</a></li>` : ''}
        ${brand.zalo ? `<li><a href="https://zalo.me/${esc(brand.zalo)}" target="_blank" rel="noopener">${icon('chat')} Zalo hỗ trợ</a></li>` : ''}
        ${brand.email ? `<li><a href="mailto:${esc(brand.email)}">${icon('mail')} ${esc(brand.email)}</a></li>` : ''}
      </ul>
    </div>
    <div>
      <h3>Thông tin</h3>
      <ul class="plain">
        <li><a href="/#hoan-tien">Chính sách hoàn tiền</a></li>
        <li><a href="/#faq">Câu hỏi thường gặp</a></li>
        <li class="muted">Thông tin chủ shop: đang cập nhật</li>
      </ul>
    </div>
  </div>
  <div class="wrap copy muted">© ${YEAR} Ô Tính. Mẫu Google Sheets làm sẵn.</div>
</footer>`;

const zaloFloat = brand.zalo
  ? `<a class="zalo-float" href="https://zalo.me/${esc(brand.zalo)}" target="_blank" rel="noopener" aria-label="Nhắn Zalo hỗ trợ">${icon('chat')}<span>Zalo</span></a>`
  : '';

function layout({ title, desc, path: pathname, body, image, noindex = false, jsonld = '', bodyClass = '', extraScript = '' }) {
  const url = SITE_URL + pathname;
  const ogImage = image ? `${SITE_URL}/${image}` : `${SITE_URL}/${products[0].imageFallback}`;
  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${esc(url)}">
  ${noindex ? '<meta name="robots" content="noindex, nofollow">' : ''}
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Ô Tính">
  <meta property="og:locale" content="vi_VN">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:image" content="${esc(ogImage)}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/assets/logo-180.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Nunito:wght@600;700;800;900&display=swap">
  <link rel="stylesheet" href="/assets/styles.css">
  ${jsonld}
</head>
<body class="${bodyClass}">
  <a class="skip" href="#main">Bỏ qua menu</a>
  ${header}
  <main id="main">${body}</main>
  ${footer}
  ${zaloFloat}
  ${extraScript}
  <script src="/assets/app.js" defer></script>
</body>
</html>
`;
}

// ---------- thẻ sản phẩm ----------
function productCard(p) {
  const t = themeOf(p);
  const badge = p.badge ? `<span class="chip chip-badge">${esc(p.badge)}</span>` : '';
  const soon = p.status === 'coming-soon' ? `<span class="chip chip-soon">Sắp có</span>` : '';
  const compare = p.compareAtPrice ? `<s class="compare">${money(p.compareAtPrice)}</s>` : '';
  const buy =
    p.status === 'selling'
      ? `<a class="btn btn-primary" href="/mua/${esc(p.slug)}/">Mua ngay</a>`
      : `<span class="btn btn-disabled" aria-disabled="true">Sắp mở bán</span>`;
  return `
<article class="card product t-${t}" data-audience="${esc(p.audience)}">
  <a class="product-img" href="/san-pham/${esc(p.slug)}/" tabindex="-1" aria-hidden="true">${picture(p)}</a>
  <div class="product-body">
    <div class="chips"><span class="chip chip-code">${esc(p.id)}</span>${badge}${soon}</div>
    <h3><a href="/san-pham/${esc(p.slug)}/">${esc(p.name)}</a></h3>
    <p class="tagline">${esc(p.tagline)}</p>
    <div class="price-row"><span class="price">${money(p.price)}</span>${compare}</div>
    <div class="actions">
      <a class="btn btn-ghost" href="/san-pham/${esc(p.slug)}/">Xem chi tiết</a>
      ${buy}
    </div>
  </div>
</article>`;
}

// ---------- trang chủ ----------
function homePage() {
  const filters = [
    `<button class="filter" type="button" data-filter="all" aria-pressed="true">Tất cả</button>`,
    ...data.audiences.map(
      (a) => `<button class="filter" type="button" data-filter="${esc(a.id)}" aria-pressed="false">${esc(a.name)}</button>`
    ),
  ].join('');

  const combos = bundles
    .map((b) => {
      const { list, full, save } = bundleInfo(b);
      return `
<article class="card bundle">
  <div>
    <p class="code">${esc(b.id)}</p>
    <h3>${esc(b.name)}</h3>
    <p class="muted">${esc(b.note)}</p>
    <ul class="ticks">${list.map((p) => `<li>${esc(p.name)} · ${money(p.price)}</li>`).join('')}</ul>
  </div>
  <div class="bundle-price">
    <p class="muted">Mua lẻ <s>${money(full)}</s></p>
    <p class="price big">${money(b.price)}</p>
    ${save > 0 ? `<p class="save">Tiết kiệm ${money(save)}</p>` : ''}
    <a class="btn btn-primary" href="/mua/${esc(b.slug)}/">Mua combo</a>
  </div>
</article>`;
    })
    .join('');

  const faqs = [
    ['Dùng trên điện thoại được không?', 'Được. Mở bằng app Google Sheets hoặc trình duyệt trên điện thoại đều xem được. Khi nhập liệu nhiều hoặc chỉnh công thức, nên dùng máy tính cho dễ.'],
    ['Cần tài khoản Google không?', 'Có. Bạn cần tài khoản Google để mở file. Sau khi tạo bản sao, file nằm trong Google Drive của bạn.'],
    ['Nhận file bằng cách nào?', 'Sau khi thanh toán, link tạo bản sao được gửi tới email bạn đã nhập, thường trong 1–2 phút. Bấm link, chọn "Tạo bản sao" là dùng được.'],
    ['Không nhận được email thì làm sao?', 'Kiểm tra mục Quảng cáo hoặc Spam trước. Nếu vẫn không thấy, nhắn Zalo hoặc trả lời email để được gửi lại thủ công.'],
    ['Có hoàn tiền không?', 'Chính sách hoàn tiền sẽ được công bố tại mục "Chính sách hoàn tiền" ở trang này.'],
    ['Mua một lần có phải trả thêm phí không?', 'Không. Bạn trả một lần, không có phí hằng tháng. File thuộc Google Drive của bạn.'],
  ];

  const body = `
<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-text">
      <p class="eyebrow">Ô Tính · Google Sheets làm sẵn</p>
      <h1>Mẫu Google Sheets làm sẵn. <span class="hl">Mở ra là dùng.</span></h1>
      <p class="lead">Chọn mẫu, quét QR chuyển khoản, nhận file qua email trong vài phút. Không cần biết công thức.</p>
      <div class="actions">
        <a class="btn btn-primary" href="#san-pham">Xem các mẫu</a>
        <a class="btn btn-ghost" href="#cach-mua">Cách mua</a>
      </div>
    </div>
    <div class="hero-art">${mascot()}</div>
  </div>
</section>

<section class="section why">
  <div class="wrap">
    <h2>Vì sao chọn Ô Tính?</h2>
    <div class="grid-3">
      <article class="card feature t-green">
        <span class="feature-icon">${icon('calc')}</span>
        <h3>Tự tính, không cần công thức</h3>
        <p>Nhập việc hoặc khoản thu chi, các bảng tổng hợp và biểu đồ tự cập nhật.</p>
      </article>
      <article class="card feature t-navy">
        <span class="feature-icon">${icon('infinity')}</span>
        <h3>Mua một lần, dùng mãi</h3>
        <p>Không phí tháng, không gói đăng ký. File nằm trong Google Drive của bạn.</p>
      </article>
      <article class="card feature t-brown">
        <span class="feature-icon">${icon('book')}</span>
        <h3>Có hướng dẫn trong file</h3>
        <p>Mỗi mẫu có tab "Bắt đầu" và dữ liệu mẫu, mở ra là hiểu cách dùng.</p>
      </article>
    </div>
  </div>
</section>

<section class="section" id="san-pham">
  <div class="wrap">
    <div class="section-head">
      <h2>Trưng bày mẫu</h2>
      <p class="muted">Chọn đúng việc bạn đang cần quản lý.</p>
    </div>
    <div class="filters" role="group" aria-label="Lọc theo đối tượng">${filters}</div>
    <div class="grid" id="grid">${products.map(productCard).join('')}</div>
  </div>
</section>

${bundles.length ? `
<section class="section" id="combo">
  <div class="wrap">
    <div class="section-head">
      <h2>Combo tiết kiệm</h2>
      <p class="muted">Mua gộp rẻ hơn mua lẻ.</p>
    </div>
    <div class="stack">${combos}</div>
  </div>
</section>` : ''}

<section class="section" id="cach-mua">
  <div class="wrap">
    <h2>Mua trong 3 bước</h2>
    <ol class="steps">
      <li class="card"><span class="step-no">1</span><h3>Chọn mẫu</h3><p>Bấm "Mua ngay" và điền họ tên, email nhận file.</p></li>
      <li class="card"><span class="step-no">2</span><h3>Quét QR chuyển khoản</h3><p>Dùng app ngân hàng quét mã QR. Số tiền và nội dung đã điền sẵn.</p></li>
      <li class="card"><span class="step-no">3</span><h3>Nhận link qua email</h3><p>Trong vài phút, link tạo bản sao được gửi tới hộp thư của bạn.</p></li>
    </ol>
  </div>
</section>

<section class="section" id="cam-ket">
  <div class="wrap">
    <h2>Cam kết minh bạch</h2>
    <div class="card">
      <ul class="ticks">
        <li>Mua một lần, không phí tháng.</li>
        <li>File nằm trong Google Drive của bạn. Ô Tính không xem được dữ liệu của bạn.</li>
        <li>Mỗi mẫu ghi rõ giới hạn ngay trên trang chi tiết.</li>
        <li>Hỗ trợ qua Zalo hoặc email.</li>
      </ul>
      <h3 id="hoan-tien">Chính sách hoàn tiền</h3>
      <p class="muted">Nội dung chính sách hoàn tiền đang được chủ shop hoàn thiện và sẽ được cập nhật tại đây.</p>
    </div>
  </div>
</section>

<section class="section" id="faq">
  <div class="wrap narrow">
    <h2>Hỏi đáp</h2>
    <div class="faq">
      ${faqs.map(([q, a]) => `<details class="card"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}
    </div>
  </div>
</section>`;

  const jsonld = `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Ô Tính',
    url: SITE_URL + '/',
    sameAs: brand.tiktok ? [brand.tiktok] : [],
  })}</script>`;

  return layout({
    title: 'Ô Tính — Mẫu Google Sheets làm sẵn, mở ra là dùng',
    desc: 'Mẫu Google Sheets làm sẵn cho người đi làm và chủ quán nhỏ. Mua một lần, nhận file qua email trong vài phút.',
    path: '/',
    body,
    jsonld,
    bodyClass: 'page-home',
  });
}

// ---------- trang chi tiết sản phẩm ----------
function productPage(p) {
  const t = themeOf(p);
  const compare = p.compareAtPrice ? `<s class="compare">${money(p.compareAtPrice)}</s>` : '';
  const buy =
    p.status === 'selling'
      ? `<a class="btn btn-primary" href="/mua/${esc(p.slug)}/">Mua ngay · ${money(p.price)}</a>`
      : `<span class="chip chip-soon">Sắp có</span>`;
  const demo = p.demoUrl
    ? `<a class="btn btn-ghost" href="${esc(p.demoUrl)}" target="_blank" rel="noopener">Xem file mẫu</a>`
    : '';
  const bodyHtml = `
<section class="wrap detail t-${t}">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Trang chủ</a> / <a href="/#san-pham">Mẫu</a> / <span>${esc(p.name)}</span></nav>
  <div class="detail-grid">
    <div class="card detail-img">${picture(p, '', true)}</div>
    <div class="detail-info">
      <p class="code">${esc(p.id)} · ${esc(audName(p.audience))}</p>
      <h1>${esc(p.name)}</h1>
      <p class="lead">${esc(p.tagline)}</p>
      <p>${esc(p.description)}</p>
      <div class="price-row big"><span class="price">${money(p.price)}</span>${compare}</div>
      <div class="actions">${buy}${demo}</div>
    </div>
  </div>
  <div class="detail-cols">
    <section class="card"><h2>Bạn được gì</h2>
      <ul class="ticks">${p.benefits.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
    </section>
    <section class="card"><h2>Có trong file</h2>
      <ul class="ticks">${p.includes.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
    </section>
    <section class="card limits"><h2>Giới hạn cần biết</h2>
      <ul class="cross">${p.limits.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
    </section>
  </div>
  <p class="back"><a href="/#san-pham">← Xem các mẫu khác</a></p>
</section>`;

  const jsonld = `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    sku: p.id,
    description: p.tagline,
    image: `${SITE_URL}/${p.imageFallback}`,
    brand: { '@type': 'Brand', name: 'Ô Tính' },
    offers: {
      '@type': 'Offer',
      price: p.price,
      priceCurrency: data.currency,
      availability: p.status === 'selling' ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
      url: `${SITE_URL}/san-pham/${p.slug}/`,
    },
  })}</script>`;

  return layout({
    title: `${p.name} — Mẫu Google Sheets | Ô Tính`,
    desc: p.tagline + '. ' + p.description,
    path: `/san-pham/${p.slug}/`,
    body: bodyHtml,
    image: p.imageFallback,
    jsonld,
    bodyClass: 'page-product',
  });
}

// ---------- trang mua hàng (form → Apps Script → payOS) ----------
function checkoutPage({ code, slug, name, price, note }) {
  const body = `
<section class="wrap narrow checkout">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Trang chủ</a> / <span>Mua ${esc(name)}</span></nav>
  <h1>Mua ${esc(name)}</h1>
  ${note ? `<p class="muted">${esc(note)}</p>` : ''}
  <p class="total">Tổng thanh toán: <strong>${money(price)}</strong></p>
  <form id="checkout-form" class="card form" action="/" method="post">
    <input type="hidden" name="code" value="${esc(code)}">
    <label>Họ và tên <span class="req">*</span>
      <input name="name" type="text" required autocomplete="name" maxlength="100">
    </label>
    <label>Email nhận file <span class="req">*</span>
      <input name="email" type="email" required autocomplete="email" maxlength="120" inputmode="email">
    </label>
    <p class="hint">File gửi tới email này. Kiểm tra kỹ địa chỉ trước khi tiếp tục.</p>
    <label>Số điện thoại hoặc Zalo <span class="opt">(không bắt buộc)</span>
      <input name="phone" type="tel" autocomplete="tel" maxlength="20">
    </label>
    <button class="btn btn-primary btn-block" type="submit">Tiếp tục thanh toán</button>
    <p id="checkout-msg" class="msg" role="status" aria-live="polite"></p>
  </form>
  <ol class="mini-steps">
    <li>Bạn sẽ chuyển sang trang QR để chuyển khoản.</li>
    <li>Thanh toán xong, hệ thống tự gửi file tới email.</li>
  </ol>
  <p class="back"><a href="/san-pham/${esc(slug)}/">← Quay lại trang sản phẩm</a></p>
</section>`;
  return layout({
    title: `Mua ${name} | Ô Tính`,
    desc: `Thanh toán ${name} và nhận file qua email.`,
    path: `/mua/${slug}/`,
    body,
    noindex: true,
    bodyClass: 'page-checkout',
    extraScript: `<script>window.OT_CONFIG=${JSON.stringify({ orderEndpoint: config.orderEndpoint })};</script>`,
  });
}

// ---------- trang phụ ----------
const cancelPage = () =>
  layout({
    title: 'Đã huỷ thanh toán | Ô Tính',
    desc: 'Bạn đã huỷ thanh toán. Đơn chưa được tính.',
    path: '/thanh-toan-huy/',
    noindex: true,
    body: `
<section class="wrap narrow center">
  <div class="mascot-small">${mascot('Linh vật Ô Tính')}</div>
  <h1>Bạn đã huỷ thanh toán</h1>
  <p class="lead">Đơn chưa được tính. Bạn có thể chọn mẫu và thử lại bất cứ lúc nào.</p>
  <div class="actions center-actions"><a class="btn btn-primary" href="/#san-pham">Xem các mẫu</a></div>
</section>`,
  });

const thanksPage = () =>
  layout({
    title: 'Cảm ơn bạn | Ô Tính',
    desc: 'Cảm ơn bạn đã mua mẫu của Ô Tính.',
    path: '/cam-on/',
    noindex: true,
    body: `
<section class="wrap narrow center">
  <div class="mascot-small">${mascot('Linh vật Ô Tính đang vẫy tay')}</div>
  <h1>Cảm ơn bạn!</h1>
  <p class="lead">Kiểm tra hộp thư (kể cả mục Quảng cáo và Spam) trong 1–2 phút.</p>
  <p class="muted">Chưa thấy email? Nhắn Zalo hoặc trả lời email để được hỗ trợ.</p>
  <div class="actions center-actions"><a class="btn btn-ghost" href="/">Về trang chủ</a></div>
</section>`,
  });

const notFoundPage = () =>
  layout({
    title: 'Không tìm thấy trang | Ô Tính',
    desc: 'Trang bạn tìm không tồn tại.',
    path: '/404.html',
    noindex: true,
    body: `
<section class="wrap narrow center">
  <div class="mascot-small">${mascot('Linh vật Ô Tính, trang không tồn tại')}</div>
  <h1>Ô kìa, không tìm thấy trang</h1>
  <p class="lead">Có thể link đã cũ. Quay lại xem các mẫu nhé.</p>
  <div class="actions center-actions"><a class="btn btn-primary" href="/">Về trang chủ</a></div>
</section>`,
  });

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="6" y="6" width="52" height="52" rx="14" fill="#B8ECCB" stroke="#2B2D42" stroke-width="5"/><text x="32" y="44" font-size="34" text-anchor="middle" font-family="Nunito,Arial" font-weight="900" fill="#2B2D42">ô</text></svg>`;

// ---------- ghi file ----------
async function write(rel, content) {
  const file = path.join(DIST, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, 'utf8');
}

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });
await cp(path.join(ROOT, 'static'), DIST, { recursive: true });
await cp(path.join(ROOT, 'images'), path.join(DIST, 'images'), { recursive: true });

await write('index.html', homePage());
for (const p of sellable.concat(products.filter((p) => p.status === 'coming-soon'))) {
  await write(`san-pham/${p.slug}/index.html`, productPage(p));
}
for (const p of sellable) {
  await write(
    `mua/${p.slug}/index.html`,
    checkoutPage({ code: p.id, slug: p.slug, name: p.name, price: p.price, note: p.tagline })
  );
}
for (const b of bundles) {
  const { list } = bundleInfo(b);
  await write(
    `mua/${b.slug}/index.html`,
    checkoutPage({
      code: b.id,
      slug: b.slug,
      name: b.name,
      price: b.price,
      note: `Gồm: ${list.map((p) => p.name).join(' + ')}. ${b.note}`,
    })
  );
}
await write('cam-on/index.html', thanksPage());
await write('thanh-toan-huy/index.html', cancelPage());
await write('404.html', notFoundPage());

const sitemapUrls = [
  '/',
  ...sellable.map((p) => `/san-pham/${p.slug}/`),
  ...products.filter((p) => p.status === 'coming-soon').map((p) => `/san-pham/${p.slug}/`),
];
await write(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls
    .map((u) => `  <url><loc>${SITE_URL}${u}</loc></url>`)
    .join('\n')}\n</urlset>\n`
);
await write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);

console.log(`Đã build ${sitemapUrls.length} trang sản phẩm/chính, ${sellable.length + bundles.length} trang mua hàng → dist/`);
if (SITE_URL.includes('example.com')) console.warn('Cảnh báo: đặt SITE_URL hoặc sửa site.config.json trước khi deploy.');
