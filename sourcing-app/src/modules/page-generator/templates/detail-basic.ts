/**
 * 기본 상세페이지 Handlebars 템플릿 — Next.js 번들 호환을 위해 inline 상수.
 */
export const DETAIL_BASIC_TEMPLATE = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{product.name}}</title>
  <meta name="description" content="{{copy.seoDescription}}">
  <style>
    :root {
      --primary: {{config.colors.primary}};
      --secondary: {{config.colors.secondary}};
      --bg: {{config.colors.background}};
      --text: {{config.colors.text}};
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Noto Sans KR', -apple-system, sans-serif; color: var(--text); background: var(--bg); line-height: 1.6; }
    .container { max-width: 860px; margin: 0 auto; padding: 0 20px; }

    .hero { text-align: center; padding: 60px 20px; background: linear-gradient(135deg, var(--bg), #f8f9fa); }
    .hero h1 { font-size: 28px; font-weight: 800; margin-bottom: 12px; }
    .hero .sub { font-size: 16px; color: #666; margin-bottom: 24px; }
    .hero .price-area { display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap; }
    .hero .price { font-size: 32px; font-weight: 800; color: var(--primary); }
    .hero .original-price { font-size: 18px; text-decoration: line-through; color: #999; }
    .hero .discount { background: #FF4444; color: #fff; padding: 4px 10px; border-radius: 4px; font-weight: 700; }

    .gallery { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 32px 0; border-radius: 12px; overflow: hidden; }
    .gallery img { width: 100%; aspect-ratio: 1; object-fit: cover; }
    .gallery img:first-child { grid-column: span 2; aspect-ratio: 16/9; }

    .points { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; padding: 40px 0; }
    .point { text-align: center; padding: 24px; border-radius: 12px; background: #f8f9fa; }
    .point .icon { font-size: 32px; margin-bottom: 8px; }
    .point h3 { font-size: 16px; margin-bottom: 6px; font-weight: 700; }
    .point p { font-size: 14px; color: #666; }

    .detail-section { padding: 48px 0; border-bottom: 1px solid #eee; }
    .detail-section h2 { font-size: 22px; font-weight: 700; margin-bottom: 20px; text-align: center; }
    .detail-section .content { font-size: 15px; line-height: 1.8; color: #444; }

    .trust { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; padding: 32px 0; }
    .trust .badge { background: #f0f9ff; border: 1px solid #c7e1ff; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; color: var(--primary); }

    .cta-area { position: sticky; bottom: 0; background: #fff; padding: 16px 20px; border-top: 1px solid #eee; text-align: center; box-shadow: 0 -4px 12px rgba(0,0,0,0.05); }
    .cta-btn { display: inline-block; width: 100%; max-width: 400px; padding: 16px 32px; background: var(--primary); color: #fff; border: none; border-radius: 12px; font-size: 18px; font-weight: 700; cursor: pointer; }
    .cta-btn:hover { opacity: 0.9; }

    .faq { padding: 40px 0; }
    .faq h2 { text-align: center; margin-bottom: 24px; font-size: 22px; }
    .faq-item { border-bottom: 1px solid #eee; padding: 16px 0; }
    .faq-item .q { font-weight: 600; margin-bottom: 8px; }
    .faq-item .a { color: #666; font-size: 14px; line-height: 1.6; }

    @media (max-width: 600px) {
      .hero h1 { font-size: 22px; }
      .hero .price { font-size: 26px; }
      .gallery { grid-template-columns: 1fr; }
      .gallery img:first-child { grid-column: span 1; }
      .points { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <section class="hero">
    <h1>{{copy.headline}}</h1>
    <p class="sub">{{copy.subheadline}}</p>
    <div class="price-area">
      {{#if product.discount}}
        <span class="discount">{{product.discount}}%</span>
        <span class="original-price">{{product.originalPrice}}원</span>
      {{/if}}
      <span class="price">{{product.price}}원</span>
    </div>
  </section>

  <div class="container">
    {{#if product.images.length}}
    <div class="gallery">
      {{#each product.images}}
        <img src="{{this}}" alt="상품 이미지" loading="lazy">
      {{/each}}
    </div>
    {{/if}}

    {{#if copy.trustBadges.length}}
    <div class="trust">
      {{#each copy.trustBadges}}
        <span class="badge">✓ {{this}}</span>
      {{/each}}
    </div>
    {{/if}}

    {{#if copy.sellingPoints.length}}
    <div class="points">
      {{#each copy.sellingPoints}}
        <div class="point">
          <div class="icon">{{this.icon}}</div>
          <h3>{{this.title}}</h3>
          <p>{{this.description}}</p>
        </div>
      {{/each}}
    </div>
    {{/if}}

    {{#each copy.detailSections}}
      <section class="detail-section">
        <h2>{{this.title}}</h2>
        <div class="content">{{{this.content}}}</div>
      </section>
    {{/each}}

    {{#if copy.faq.length}}
    <section class="faq">
      <h2>자주 묻는 질문</h2>
      {{#each copy.faq}}
        <div class="faq-item">
          <div class="q">Q. {{this.q}}</div>
          <div class="a">{{this.a}}</div>
        </div>
      {{/each}}
    </section>
    {{/if}}
  </div>

  <div class="cta-area">
    <button class="cta-btn">{{copy.ctaText}}</button>
  </div>
</body>
</html>`
