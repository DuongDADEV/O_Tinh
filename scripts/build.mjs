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
// Giá thường (gạch) lấy từ compareAtPrice; combo mặc định = tổng giá thường của các mẫu
const regularOf = (p) => (p.compareAtPrice && p.compareAtPrice > p.price ? p.compareAtPrice : p.price);
const bundleInfo = (b) => {
  const list = b.items.map((id) => byId[id]);
  const full = b.compareAtPrice || list.reduce((s, p) => s + regularOf(p), 0);
  return { list, full, save: full - b.price };
};
const pct = (price, cmp) => (cmp && cmp > price ? Math.round((1 - price / cmp) * 100) : 0);
const offPill = (price, cmp) => (pct(price, cmp) ? `<span class="off">-${pct(price, cmp)}%</span>` : '');
const compareHtml = (price, cmp) =>
  cmp && cmp > price ? `<s class="compare" aria-label="Giá thường ${money(cmp)}">${money(cmp)}</s>${offPill(price, cmp)}` : '';

// ---------- chiến dịch (Giáng Sinh, Tết...) ----------
// data.campaign: { active, theme, name, message, endsAt }. Chỉ bật khi active và chưa quá endsAt (tính lúc build).
const todayISO = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const campaign =
  data.campaign && data.campaign.active && (!data.campaign.endsAt || todayISO <= data.campaign.endsAt) ? data.campaign : null;
const maxOff = Math.max(
  0,
  ...sellableOrAll().map((p) => pct(p.price, p.compareAtPrice)),
  ...data.bundles.filter((b) => b.status === 'selling').map((b) => pct(b.price, bundleInfo(b).full))
);
function sellableOrAll() {
  return data.products.filter((p) => p.status === 'selling');
}
const CAMPAIGN_THEMES = {
  noel: {
    hat: `<svg class="santa-hat" viewBox="0 0 64 56" aria-hidden="true" focusable="false"><path d="M8 44C10 20 26 6 50 8c-8 6-10 14-8 24 3 4 6 8 14 12z" fill="#D6403A" stroke="#2B2D42" stroke-width="3.5" stroke-linejoin="round"/><rect x="4" y="38" width="56" height="14" rx="7" fill="#fff" stroke="#2B2D42" stroke-width="3.5"/><circle cx="52" cy="10" r="7" fill="#fff" stroke="#2B2D42" stroke-width="3.5"/></svg>`,
    lights: Array.from({ length: 26 }, () => '<i></i>').join(''),
    footer: 'Chúc bạn một mùa Giáng Sinh an lành và nhiều niềm vui.',
  },
};
const theme = campaign ? CAMPAIGN_THEMES[campaign.theme] : null;
const hat = theme?.hat || '';
const campaignBar = theme
  ? `<div class="campaign-bar" role="region" aria-label="${esc(campaign.name)}"><div class="wrap campaign-in"><span class="campaign-msg">${esc(campaign.message)}${maxOff ? `: giảm đến <strong>${maxOff}%</strong>` : ''}</span>${campaign.endsAt ? `<span class="campaign-count" data-ends="${esc(campaign.endsAt)}T23:59:59+07:00">đến hết ${esc(fmtDate(campaign.endsAt))}</span>` : ''}</div></div>`
  : '';
function fmtDate(iso) {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse().join('/') : '';
}

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
      <span class="logo-wrap">${logoImg}${hat}</span><span class="brand-name">Ô Tính</span>
    </a>
    <nav aria-label="Menu chính">
      <a href="/#san-pham">Mẫu</a>
      <a href="/#combo">Combo</a>
      <a href="/#cach-mua">Cách mua</a>
      <a href="/#faq">Hỏi đáp</a>
    </nav>
  </div>
  ${theme ? `<div class="lights" aria-hidden="true">${theme.lights}</div>` : ''}
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
        <li><a href="/chinh-sach-hoan-tien/">Chính sách hoàn tiền</a></li>
        <li><a href="/chinh-sach-bao-mat/">Chính sách bảo mật</a></li>
        <li><a href="/#faq">Câu hỏi thường gặp</a></li>
        <li class="muted">Thông tin chủ shop: đang cập nhật</li>
      </ul>
    </div>
  </div>
  ${theme ? `<div class="wrap copy muted">${esc(theme.footer)}</div>` : ''}
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
  ${theme ? `<link rel="stylesheet" href="/assets/campaign-${esc(campaign.theme)}.css">` : ''}
  ${jsonld}
</head>
<body class="${bodyClass}${theme ? ` campaign campaign-${esc(campaign.theme)}` : ''}">
  <a class="skip" href="#main">Bỏ qua menu</a>
  ${campaignBar}
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
  const compare = compareHtml(p.price, p.compareAtPrice);
  const tag = pct(p.price, p.compareAtPrice) ? `<span class="sale-tag" aria-hidden="true">-${pct(p.price, p.compareAtPrice)}%</span>` : '';
  const buy =
    p.status === 'selling'
      ? `<a class="btn btn-primary" href="/mua/${esc(p.slug)}/">Mua ngay</a>`
      : `<span class="btn btn-disabled" aria-disabled="true">Sắp mở bán</span>`;
  return `
<article class="card product t-${t}" data-audience="${esc(p.audience)}">
  <a class="product-img" href="/san-pham/${esc(p.slug)}/" tabindex="-1" aria-hidden="true">${picture(p)}${tag}</a>
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
    <div class="price-row"><span class="price big">${money(b.price)}</span>${compareHtml(b.price, full)}</div>
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
    ['Có hoàn tiền không?', 'Có, trong các trường hợp không nhận được file hoặc file lỗi mà Ô Tính không khắc phục được. Mua nhầm và chưa tạo bản sao thì đổi sang mẫu khác trong 7 ngày.', ' <a href="/chinh-sach-hoan-tien/">Xem chính sách hoàn tiền</a>.'],
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
    <div class="hero-art"><div class="mascot-wrap">${mascot()}${hat}</div></div>
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
      <ul class="ticks">
        <li>Hoàn 100% nếu không nhận được file sau 24 giờ, hoặc file lỗi mà Ô Tính không khắc phục được.</li>
        <li>Mua nhầm và chưa tạo bản sao: đổi sang mẫu khác trong 7 ngày.</li>
        <li>Đã tạo bản sao và file đúng như mô tả thì không hoàn tiền.</li>
      </ul>
      <p><a href="/chinh-sach-hoan-tien/">Xem chính sách hoàn tiền đầy đủ</a></p>
    </div>
  </div>
</section>

<section class="section" id="faq">
  <div class="wrap narrow">
    <h2>Hỏi đáp</h2>
    <div class="faq">
      ${faqs.map(([q, a, extra = '']) => `<details class="card"><summary>${esc(q)}</summary><p>${esc(a)}${extra}</p></details>`).join('')}
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
  const compare = compareHtml(p.price, p.compareAtPrice);
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
    <label class="check"><input name="promo" type="checkbox" value="1">
      <span>Tôi đồng ý nhận email và tin nhắn Zalo giới thiệu mẫu mới, khuyến mãi từ Ô Tính (không bắt buộc, huỷ bất cứ lúc nào).</span>
    </label>
    <button class="btn btn-primary btn-block" type="submit">Tiếp tục thanh toán</button>
    <p class="hint">Khi tiếp tục, bạn đồng ý với <a href="/chinh-sach-bao-mat/">Chính sách bảo mật</a> và <a href="/chinh-sach-hoan-tien/">Chính sách hoàn tiền</a>.</p>
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

// ---------- Chính sách hoàn tiền (nội dung theo CLAUDE.md mục 10) ----------

function refundPage() {
  const date = fmtDate(data.updatedAt);
  const { zalo, email, ownerName, address } = brand;
  // Chưa có Zalo/email thì không để trống: dùng câu thay thế theo CLAUDE.md
  const contactWays = [email && `email ${email}`, zalo && `nhắn Zalo ${zalo}`].filter(Boolean);
  const contactLine = contactWays.length
    ? `Gửi ${contactWays.join(' hoặc ')} kèm:`
    : 'Liên hệ Ô Tính qua nút Zalo nổi trên trang, kèm:';
  const contactInfo = [
    ownerName && `Chủ shop: ${ownerName}.`,
    address && `Địa chỉ: ${address}.`,
    email && `Email: ${email}.`,
    zalo && `Zalo: ${zalo}.`,
  ].filter(Boolean);

  const sections = [
    ['1. Sản phẩm là file kỹ thuật số', [
      'Sau khi bạn tạo bản sao, file thuộc Google Drive của bạn. Ô Tính không thể thu hồi file như hàng hoá vật lý, nên chính sách hoàn tiền dưới đây được xây dựng theo đặc thù đó.',
    ]],
    ['2. Các trường hợp được hoàn tiền 100%', null, [
      'Không nhận được link giao file sau 24 giờ kể từ khi thanh toán thành công (đã kiểm tra cả mục Quảng cáo/Spam), và Ô Tính không gửi lại được trong 2 ngày làm việc.',
      'File không mở được hoặc lỗi khiến bạn không dùng được, và Ô Tính không khắc phục được trong 3 ngày làm việc kể từ khi bạn báo.',
      'Mẫu thiếu tính năng đã liệt kê trong mục "Bao gồm" trên trang chi tiết tại thời điểm bạn mua.',
    ]],
    ['3. Đổi sang mẫu khác', [
      'Nếu bạn mua nhầm và chưa tạo bản sao, nhắn Ô Tính trong 7 ngày kể từ khi thanh toán để đổi sang mẫu khác. Nếu mẫu mới giá cao hơn, bạn trả thêm phần chênh lệch. Nếu giá thấp hơn, Ô Tính hoàn phần chênh lệch.',
    ]],
    ['4. Các trường hợp không hoàn tiền', null, [
      'Bạn đã tạo bản sao, file đúng như mô tả, nhưng không còn nhu cầu dùng.',
      'Lỗi phát sinh do bạn tự sửa công thức, xoá hoặc đổi cấu trúc bảng làm ảnh hưởng phần tự tính. Ô Tính vẫn sẵn lòng hướng dẫn khôi phục.',
      'Yêu cầu sau 7 ngày kể từ khi nhận link giao file. Riêng các trường hợp ở mục 2, thời hạn tính từ ngày bạn phát hiện lỗi hoặc ngày đáng lẽ nhận được link.',
    ]],
    ['5. Cách yêu cầu hoàn tiền', [contactLine], [
      'Mã đơn (dạng #số, có trong email xác nhận)',
      'Họ tên và email đã dùng khi mua',
      'Mô tả lỗi, kèm ảnh chụp màn hình nếu có',
    ], ['Ô Tính phản hồi trong 2 ngày làm việc.']],
    ['6. Thời gian hoàn tiền', [
      'Trong 7 ngày làm việc kể từ khi xác nhận, Ô Tính hoàn tiền về đúng tài khoản hoặc phương thức bạn đã dùng để thanh toán. Thời gian tiền về tới tài khoản còn tuỳ ngân hàng.',
    ]],
    ['7. Quyền lợi theo pháp luật', [
      'Chính sách này không làm mất các quyền bạn có theo Luật Bảo vệ quyền lợi người tiêu dùng và Nghị định về thương mại điện tử hiện hành. Khi có tranh chấp, Ô Tính ưu tiên thương lượng với bạn. Nếu không thoả thuận được, bạn có quyền khiếu nại tới cơ quan quản lý về tiêu dùng hoặc cơ quan có thẩm quyền.',
    ]],
    ['8. Quyền sử dụng file', [
      'File mẫu thuộc Ô Tính. Sau khi mua, bạn được dùng cho mục đích cá nhân hoặc nội bộ đơn vị của mình. Không bán lại, không chia sẻ công khai file gốc hay bản sao của người khác.',
    ]],
  ];
  if (contactInfo.length) sections.push(['9. Liên hệ', [contactInfo.join(' ')]]);

  const html = sections
    .map(([h, intro, list, after]) => `
    <section class="policy-sec">
      <h2>${esc(h)}</h2>
      ${(intro || []).map((t) => `<p>${esc(t)}</p>`).join('')}
      ${list ? `<ul class="${h.startsWith('4.') ? 'cross' : 'ticks'}">${list.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      ${(after || []).map((t) => `<p>${esc(t)}</p>`).join('')}
    </section>`)
    .join('');

  return layout({
    title: 'Chính sách hoàn tiền | Ô Tính',
    desc: 'Khi nào Ô Tính hoàn tiền 100%, cách đổi sang mẫu khác và cách gửi yêu cầu hoàn tiền.',
    path: '/chinh-sach-hoan-tien/',
    body: `
<section class="section">
  <div class="wrap narrow">
    <h1>Chính sách hoàn tiền — Ô Tính</h1>
    <p class="muted">${date ? `Cập nhật: ${esc(date)}. ` : ''}Áp dụng cho mọi đơn mua mẫu Google Sheets trên Ô Tính.</p>
    <div class="card policy">${html}</div>
    <div class="actions"><a class="btn btn-ghost" href="/">Về trang chủ</a></div>
  </div>
</section>`,
  });
}

// ---------- Chính sách bảo mật (bản đã duyệt: lưu 24 tháng, có khuyến mãi khi khách đồng ý) ----------
function privacyPage() {
  const date = fmtDate(data.updatedAt);
  const { zalo, email, ownerName, address } = brand;
  const contactWays = [email && `email ${email}`, zalo && `nhắn Zalo ${zalo}`].filter(Boolean);
  const reach = contactWays.length ? contactWays.join(' hoặc ') : 'nút Zalo nổi trên trang';
  const contactInfo = [
    ownerName && `Chủ shop: ${ownerName}.`,
    address && `Địa chỉ: ${address}.`,
    email && `Email: ${email}.`,
    zalo && `Zalo: ${zalo}.`,
  ].filter(Boolean);

  const sections = [
    ['1. Chúng tôi thu thập thông tin nào', ['Khi bạn bấm "Mua ngay" và điền form, chúng tôi thu thập:'], [
      'Họ tên (bắt buộc)',
      'Email (bắt buộc), dùng để gửi link nhận file',
      'Số điện thoại hoặc Zalo (không bắt buộc)',
      'Lựa chọn của bạn về việc nhận khuyến mãi (ô tích không bắt buộc, mặc định là không)',
    ], [
      'Khi tạo đơn, hệ thống tự ghi thêm: mã sản phẩm, mã đơn, số tiền, thời điểm tạo đơn, trạng thái thanh toán và thời điểm gửi email.',
      'Chúng tôi không thu thập và không nhìn thấy số thẻ, mật khẩu hay thông tin đăng nhập ngân hàng của bạn. Việc thanh toán diễn ra trên trang của cổng thanh toán payOS.',
    ]],
    ['2. Chúng tôi dùng thông tin để làm gì', null, [
      'Tạo đơn hàng và liên kết đơn với khoản thanh toán của bạn.',
      'Gửi email chứa link nhận file sau khi thanh toán thành công.',
      'Hỗ trợ bạn khi cần gửi lại file, đổi mẫu hoặc hoàn tiền.',
      'Đối soát đơn hàng, nghĩa vụ sổ sách và nghĩa vụ pháp lý (nếu có).',
      'Chỉ khi bạn tích đồng ý: gửi email và tin nhắn Zalo giới thiệu mẫu mới, khuyến mãi.',
    ], [`Chúng tôi không bán thông tin của bạn. Nếu bạn không tích ô đồng ý, chúng tôi chỉ liên hệ về đơn hàng của bạn. Bạn có thể ngừng nhận khuyến mãi bất cứ lúc nào bằng cách liên hệ qua ${reach}.`]],
    ['3. Thông tin được lưu ở đâu và chia sẻ với ai', ['Để vận hành, thông tin của bạn đi qua các bên sau:'], [
      'payOS (cổng thanh toán): nhận mã đơn, số tiền, nội dung chuyển khoản để tạo mã QR và báo kết quả. Thông tin tài khoản ngân hàng do payOS và ngân hàng xử lý theo chính sách riêng của họ.',
      'Google (Google Sheets, Apps Script, Gmail): lưu danh sách đơn hàng và gửi email cho bạn, gồm họ tên, email, số điện thoại/Zalo và thông tin đơn.',
      'Vercel (lưu trữ trang web): ghi nhận dữ liệu truy cập kỹ thuật như địa chỉ IP trong nhật ký máy chủ.',
      'Google Fonts: tải phông chữ hiển thị trên trang, nhận địa chỉ IP của trình duyệt.',
    ], [
      'Danh sách đơn hàng nằm trong một Google Sheet riêng tư, chỉ người được chủ shop cấp quyền mới mở được. Khoá bí mật của cổng thanh toán được lưu tách riêng, không nằm trên trang web công khai.',
      'Ngoài các bên trên, chúng tôi không chia sẻ thông tin của bạn cho bên thứ ba, trừ khi pháp luật hoặc cơ quan nhà nước có thẩm quyền yêu cầu bằng văn bản. Một số bên trên đặt máy chủ ở nước ngoài, nên dữ liệu có thể được xử lý ngoài Việt Nam.',
    ]],
    ['4. Cookie và theo dõi', ['Hiện tại trang web không dùng cookie quảng cáo và không cài công cụ theo dõi hành vi (như Google Analytics hay pixel quảng cáo). Nếu sau này chúng tôi thêm, trang này sẽ được cập nhật trước khi áp dụng.']],
    ['5. Thời gian lưu trữ', ['Chúng tôi lưu thông tin đơn hàng trong 24 tháng kể từ ngày mua để hỗ trợ bạn và đối soát. Sau thời hạn này, chúng tôi xoá hoặc ẩn danh thông tin cá nhân, trừ phần pháp luật yêu cầu giữ lại lâu hơn.']],
    ['6. Quyền của bạn', ['Bạn có quyền:'], [
      'Hỏi chúng tôi đang lưu thông tin gì về bạn.',
      'Yêu cầu sửa thông tin sai.',
      'Yêu cầu xoá thông tin cá nhân của bạn. Với đơn đã hoàn tất, chúng tôi có thể phải giữ lại dữ liệu tối thiểu (mã đơn, số tiền, ngày) theo quy định kế toán; họ tên, email, số điện thoại sẽ được xoá.',
      'Rút lại sự đồng ý đã cho, hoặc từ chối nhận email và tin nhắn khuyến mãi.',
    ], [`Để thực hiện, gửi yêu cầu qua ${reach}, kèm mã đơn và email đã dùng khi mua. Chúng tôi phản hồi trong 7 ngày làm việc và có thể cần xác minh bạn đúng là chủ đơn hàng trước khi xử lý.`]],
    ['7. Bảo mật', ['Chúng tôi chỉ thu thập thông tin cần thiết, hạn chế người truy cập vào danh sách đơn hàng, và giá bán được lấy từ máy chủ chứ không tin dữ liệu từ trình duyệt. Dù vậy, không hệ thống nào an toàn tuyệt đối. Nếu xảy ra sự cố ảnh hưởng đến thông tin của bạn, chúng tôi sẽ thông báo cho bạn và cơ quan có thẩm quyền theo quy định.']],
    ['8. Trẻ em', ['Dịch vụ dành cho người từ 16 tuổi trở lên hoặc có sự đồng ý của cha mẹ, người giám hộ. Chúng tôi không chủ ý thu thập thông tin của trẻ em.']],
    ['9. Thay đổi chính sách', ['Khi chính sách thay đổi, chúng tôi cập nhật ngày ở đầu trang. Thay đổi quan trọng sẽ được thông báo rõ trên trang web.']],
  ];
  if (contactInfo.length) sections.push(['10. Liên hệ', [contactInfo.join(' ')]]);

  const html = sections
    .map(([h, intro, list, after]) => `
    <section class="policy-sec">
      <h2>${esc(h)}</h2>
      ${(intro || []).map((t) => `<p>${esc(t)}</p>`).join('')}
      ${list ? `<ul class="ticks">${list.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      ${(after || []).map((t) => `<p>${esc(t)}</p>`).join('')}
    </section>`)
    .join('');

  return layout({
    title: 'Chính sách bảo mật | Ô Tính',
    desc: 'Ô Tính thu thập thông tin nào khi bạn mua hàng, dùng để làm gì, lưu ở đâu và quyền của bạn.',
    path: '/chinh-sach-bao-mat/',
    body: `
<section class="section">
  <div class="wrap narrow">
    <h1>Chính sách bảo mật — Ô Tính</h1>
    <p class="muted">${date ? `Cập nhật: ${esc(date)}. ` : ''}Áp dụng cho mọi người dùng trang web và khách mua hàng của Ô Tính.</p>
    <div class="card policy">${html}</div>
    <div class="actions"><a class="btn btn-ghost" href="/">Về trang chủ</a></div>
  </div>
</section>`,
  });
}

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
await write('chinh-sach-hoan-tien/index.html', refundPage());
await write('chinh-sach-bao-mat/index.html', privacyPage());
await write('404.html', notFoundPage());

const sitemapUrls = [
  '/',
  '/chinh-sach-hoan-tien/',
  '/chinh-sach-bao-mat/',
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
