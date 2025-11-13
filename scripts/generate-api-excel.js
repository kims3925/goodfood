const ExcelJS = require('exceljs');
const path = require('path');

// API 라우팅 정보 (95개)
const apiRoutes = [
  // ============================================
  // 인증 시스템 (Authentication)
  // ============================================
  {
    url: '/api/auth/[...nextauth]',
    method: 'GET, POST',
    기능: 'NextAuth.js 인증 처리 (로그인, 로그아웃, 세션 관리)',
    적용시스템: '인증 시스템',
    설명: 'NextAuth.js의 모든 인증 엔드포인트 처리 (signin, signout, callback 등)',
    요청예시: 'POST /api/auth/signin',
    응답예시: '{ user: {...}, session: {...} }'
  },
  {
    url: '/api/auth/register',
    method: 'POST',
    기능: '회원가입',
    적용시스템: '인증 시스템',
    설명: '새 사용자 계정 생성 (이메일, 비밀번호, 이름)',
    요청예시: '{ email, password, name, role }',
    응답예시: '{ success: true, userId }'
  },
  {
    url: '/api/auth/band/route',
    method: 'GET',
    기능: 'Band OAuth 인증 시작',
    적용시스템: 'Band API 연동',
    설명: '네이버 밴드 OAuth 인증 페이지로 리디렉션',
    요청예시: 'GET /api/auth/band',
    응답예시: 'Redirect to Band OAuth page'
  },
  {
    url: '/api/auth/band/callback',
    method: 'GET',
    기능: 'Band OAuth 콜백 처리',
    적용시스템: 'Band API 연동',
    설명: 'OAuth 인증 후 Access Token 교환 및 저장',
    요청예시: 'GET /api/auth/band/callback?code=xxx',
    응답예시: '{ success: true, accessToken }'
  },
  {
    url: '/api/auth/band/debug',
    method: 'GET',
    기능: 'Band API 디버깅',
    적용시스템: 'Band API 연동 (개발용)',
    설명: 'Band API 토큰 및 연결 상태 확인',
    요청예시: 'GET /api/auth/band/debug',
    응답예시: '{ token, isValid, bands }'
  },

  // ============================================
  // 관리자 기능
  // ============================================
  {
    url: '/api/admin/refresh-token',
    method: 'POST',
    기능: 'Band Access Token 갱신',
    적용시스템: 'Band API 연동',
    설명: 'Band API Access Token 수동 갱신',
    요청예시: 'POST /api/admin/refresh-token',
    응답예시: '{ success: true, newToken }'
  },

  // ============================================
  // 도매밴드 관리 (Wholesale)
  // ============================================
  {
    url: '/api/wholesale/bands',
    method: 'GET, POST',
    기능: '도매밴드 목록 조회 / 등록',
    적용시스템: '도매밴드 관리',
    설명: '도매밴드 CRUD (생성, 조회)',
    요청예시: 'POST { name, bandKey, pricingPolicy }',
    응답예시: '{ bands: [{id, name, bandKey, pricingPolicy}] }'
  },
  {
    url: '/api/wholesale/bands/[id]',
    method: 'GET, PUT, DELETE',
    기능: '도매밴드 상세 조회 / 수정 / 삭제',
    적용시스템: '도매밴드 관리',
    설명: '특정 도매밴드 관리 (조회, 수정, 삭제)',
    요청예시: 'PUT /api/wholesale/bands/123 { name: "새이름" }',
    응답예시: '{ success: true, band: {...} }'
  },
  {
    url: '/api/wholesale/bands/[id]/policy',
    method: 'PUT',
    기능: '도매밴드 가격정책 수정',
    적용시스템: '도매밴드 관리 + 가격정책',
    설명: '도매밴드의 가격정책만 별도 수정',
    요청예시: 'PUT { pricingPolicy: "구간별 마진..." }',
    응답예시: '{ success: true, updatedPolicy }'
  },
  {
    url: '/api/wholesale/bands/comment-toggle',
    method: 'POST',
    기능: '댓글 수집 여부 토글',
    적용시스템: '도매밴드 관리',
    설명: '도매밴드의 댓글 수집 on/off',
    요청예시: 'POST { bandId, collectComments: true }',
    응답예시: '{ success: true }'
  },
  {
    url: '/api/wholesale/collect',
    method: 'POST',
    기능: '도매밴드 게시물 수집 (메인)',
    적용시스템: '도매밴드 수집 + Band API',
    설명: 'Band API로 게시물 수집 및 저장 (댓글 포함)',
    요청예시: 'POST { bandId, dateRange }',
    응답예시: '{ success: true, collected: 45, duplicates: 5 }'
  },
  {
    url: '/api/wholesale/collect/progress',
    method: 'GET',
    기능: '게시물 수집 진행상황 조회',
    적용시스템: '도매밴드 수집',
    설명: '실시간 수집 진행률 반환',
    요청예시: 'GET /api/wholesale/collect/progress',
    응답예시: '{ progress: 75, status: "collecting" }'
  },
  {
    url: '/api/wholesale/collect-playwright',
    method: 'POST',
    기능: 'Playwright를 이용한 게시물 수집',
    적용시스템: '도매밴드 수집 (브라우저 자동화)',
    설명: 'Playwright로 브라우저 자동화하여 게시물 수집',
    요청예시: 'POST { bandId }',
    응답예시: '{ success: true, collected: 30 }'
  },
  {
    url: '/api/wholesale/posts',
    method: 'GET',
    기능: '수집된 게시물 목록 조회',
    적용시스템: '도매밴드 수집',
    설명: 'CollectedPost 목록 조회 (필터링, 페이징)',
    요청예시: 'GET /api/wholesale/posts?status=PENDING',
    응답예시: '{ posts: [{id, title, images}], total }'
  },
  {
    url: '/api/wholesale/posts/analyze',
    method: 'POST',
    기능: 'AI 상품 분석 (Gemini)',
    적용시스템: 'AI 분석 시스템 + Gemini API',
    설명: 'Gemini AI로 게시물 배치 분석 (제목, 카테고리, 가격)',
    요청예시: 'POST { postIds: ["post1", "post2"] }',
    응답예시: '{ analyzed: 2, results: [{hookingTitle, category}] }'
  },
  {
    url: '/api/wholesale/posts/confirm',
    method: 'POST',
    기능: '소싱 확정 (Product 생성)',
    적용시스템: '상품 관리 + 소싱 시스템',
    설명: 'CollectedPost → Product 변환 (소싱 확정)',
    요청예시: 'POST { postIds: ["post1", "post2"] }',
    응답예시: '{ success: true, productIds: ["prod1", "prod2"] }'
  },
  {
    url: '/api/wholesale/posts/delete',
    method: 'DELETE',
    기능: '수집된 게시물 삭제',
    적용시스템: '도매밴드 수집',
    설명: 'CollectedPost 삭제 (일괄 삭제 가능)',
    요청예시: 'DELETE { postIds: ["post1", "post2"] }',
    응답예시: '{ success: true, deleted: 2 }'
  },

  // ============================================
  // 상품 관리 (Products)
  // ============================================
  {
    url: '/api/products',
    method: 'GET, POST',
    기능: '상품 목록 조회 / 등록',
    적용시스템: '상품 관리',
    설명: 'Product CRUD (생성, 조회)',
    요청예시: 'POST { title, salePrice, description }',
    응답예시: '{ products: [{id, title, salePrice}] }'
  },
  {
    url: '/api/products/[id]',
    method: 'GET, PUT, DELETE',
    기능: '상품 상세 조회 / 수정 / 삭제',
    적용시스템: '상품 관리',
    설명: '특정 상품 관리',
    요청예시: 'PUT /api/products/123 { salePrice: 20000 }',
    응답예시: '{ success: true, product: {...} }'
  },
  {
    url: '/api/products/delete',
    method: 'DELETE',
    기능: '상품 일괄 삭제',
    적용시스템: '상품 관리',
    설명: '여러 상품 한번에 삭제',
    요청예시: 'DELETE { productIds: ["prod1", "prod2"] }',
    응답예시: '{ success: true, deleted: 2 }'
  },
  {
    url: '/api/products/generate-excel',
    method: 'POST',
    기능: '상품 엑셀 파일 생성',
    적용시스템: '상품 관리 + 엑셀 출력',
    설명: '상품 목록을 엑셀 파일로 다운로드',
    요청예시: 'POST { productIds: [...] }',
    응답예시: 'Excel file download'
  },

  // ============================================
  // 쇼핑몰 관리 (Shop)
  // ============================================
  {
    url: '/api/shop/products',
    method: 'GET, POST',
    기능: '쇼핑몰 상품 목록 조회 / 등록',
    적용시스템: '쇼핑몰 시스템',
    설명: 'ShopProduct CRUD (생성, 조회)',
    요청예시: 'POST { productCode, name, salePrice }',
    응답예시: '{ shopProducts: [{id, name, salePrice}] }'
  },
  {
    url: '/api/shop/products/[id]',
    method: 'GET, PUT, DELETE',
    기능: '쇼핑몰 상품 상세 조회 / 수정 / 삭제',
    적용시스템: '쇼핑몰 시스템',
    설명: '특정 쇼핑몰 상품 관리',
    요청예시: 'PUT /api/shop/products/123 { salePrice: 25000 }',
    응답예시: '{ success: true, shopProduct: {...} }'
  },
  {
    url: '/api/shop/products/delete',
    method: 'DELETE',
    기능: '쇼핑몰 상품 일괄 삭제',
    적용시스템: '쇼핑몰 시스템',
    설명: '여러 쇼핑몰 상품 한번에 삭제',
    요청예시: 'DELETE { shopProductIds: [...] }',
    응답예시: '{ success: true, deleted: 5 }'
  },
  {
    url: '/api/shop/products/status',
    method: 'PUT',
    기능: '쇼핑몰 상품 상태 변경',
    적용시스템: '쇼핑몰 시스템',
    설명: '상품 상태 변경 (ACTIVE, INACTIVE, SOLD_OUT)',
    요청예시: 'PUT { shopProductId, status: "SOLD_OUT" }',
    응답예시: '{ success: true }'
  },
  {
    url: '/api/shop/products/reorder',
    method: 'PUT',
    기능: '쇼핑몰 상품 순서 변경',
    적용시스템: '쇼핑몰 시스템',
    설명: '상품 목록의 순서 변경 (드래그앤드롭)',
    요청예시: 'PUT { productOrders: [{id, order}] }',
    응답예시: '{ success: true }'
  },
  {
    url: '/api/shop/products/initialize-order',
    method: 'POST',
    기능: '쇼핑몰 상품 순서 초기화',
    적용시스템: '쇼핑몰 시스템',
    설명: '모든 상품의 순서 값 재설정',
    요청예시: 'POST /api/shop/products/initialize-order',
    응답예시: '{ success: true, updated: 50 }'
  },
  {
    url: '/api/shop/settings',
    method: 'GET, PUT',
    기능: '쇼핑몰 설정 조회 / 수정',
    적용시스템: '쇼핑몰 시스템',
    설명: '쇼핑몰 기본 설정 (이름, 배송비, 정책 등)',
    요청예시: 'PUT { shopName, defaultShippingFee }',
    응답예시: '{ success: true, settings: {...} }'
  },
  {
    url: '/api/shop/settings/test',
    method: 'POST',
    기능: '쇼핑몰 설정 테스트',
    적용시스템: '쇼핑몰 시스템 (개발용)',
    설명: '쇼핑몰 설정 연결 테스트',
    요청예시: 'POST /api/shop/settings/test',
    응답예시: '{ success: true, message: "설정 정상" }'
  },

  // ============================================
  // 장바구니 & 주문 (Cart & Orders)
  // ============================================
  {
    url: '/api/cart',
    method: 'GET, POST, PUT, DELETE',
    기능: '장바구니 관리 (CRUD)',
    적용시스템: '장바구니 시스템',
    설명: '장바구니 아이템 추가/수정/삭제 (세션 기반)',
    요청예시: 'POST { sessionId, productId, quantity }',
    응답예시: '{ cart: {items, totalAmount} }'
  },
  {
    url: '/api/orders',
    method: 'GET, POST',
    기능: '주문 목록 조회 / 생성',
    적용시스템: '주문 관리 시스템',
    설명: 'Order CRUD (생성, 조회)',
    요청예시: 'POST { productId, quantity, shippingAddress }',
    응답예시: '{ orderId, orderNumber, totalAmount }'
  },

  // ============================================
  // 결제 시스템 (Payments - 토스페이먼츠)
  // ============================================
  {
    url: '/api/payments/confirm',
    method: 'POST',
    기능: '토스페이먼츠 결제 승인',
    적용시스템: '결제 시스템 + 토스페이먼츠 API',
    설명: '결제 승인 처리 및 Order 상태 업데이트',
    요청예시: 'POST { paymentKey, orderId, amount }',
    응답예시: '{ success: true, payment: {...} }'
  },
  {
    url: '/api/payments/cancel',
    method: 'POST',
    기능: '토스페이먼츠 결제 취소',
    적용시스템: '결제 시스템 + 토스페이먼츠 API',
    설명: '결제 취소 및 환불 처리',
    요청예시: 'POST { paymentKey, cancelReason }',
    응답예시: '{ success: true, canceledAt }'
  },
  {
    url: '/api/payments/status/[paymentKey]',
    method: 'GET',
    기능: '결제 상태 조회',
    적용시스템: '결제 시스템 + 토스페이먼츠 API',
    설명: '토스페이먼츠 결제 상태 실시간 조회',
    요청예시: 'GET /api/payments/status/toss_abc123',
    응답예시: '{ status: "DONE", approvedAt, amount }'
  },
  {
    url: '/api/payments/webhook',
    method: 'POST',
    기능: '토스페이먼츠 웹훅 수신',
    적용시스템: '결제 시스템 + 토스페이먼츠 웹훅',
    설명: '결제 상태 변경 실시간 수신 및 처리',
    요청예시: 'POST (from Toss) { eventType, data }',
    응답예시: '{ success: true }'
  },

  // ============================================
  // 소매밴드 관리 (Retail)
  // ============================================
  {
    url: '/api/retail/bands',
    method: 'GET, POST, DELETE',
    기능: '소매밴드 목록 조회 / 등록 / 삭제',
    적용시스템: '소매밴드 관리',
    설명: 'RetailBand CRUD',
    요청예시: 'POST { bandKey, bandName }',
    응답예시: '{ retailBands: [{id, bandName}] }'
  },
  {
    url: '/api/retail/posts',
    method: 'GET',
    기능: '소매밴드 게시물 목록 조회',
    적용시스템: '소매밴드 관리',
    설명: 'RetailPost 목록 조회 (발행 내역)',
    요청예시: 'GET /api/retail/posts',
    응답예시: '{ posts: [{id, title, publishedAt}] }'
  },
  {
    url: '/api/retail/publish',
    method: 'POST',
    기능: '소매밴드 자동 포스팅',
    적용시스템: '소매밴드 관리 + Band API',
    설명: '상품을 소매밴드에 자동 포스팅 (쇼핑몰 링크 포함)',
    요청예시: 'POST { retailBandId, productId }',
    응답예시: '{ success: true, bandPostId }'
  },

  // ============================================
  // AliExpress 통합
  // ============================================
  {
    url: '/api/aliexpress/sourcings',
    method: 'GET, POST',
    기능: 'AliExpress 소싱 설정 관리',
    적용시스템: 'AliExpress 통합',
    설명: 'AliExpress 소싱 설정 생성/조회',
    요청예시: 'POST { searchType, searchValue, pricingPolicy }',
    응답예시: '{ sourcings: [{id, displayName}] }'
  },
  {
    url: '/api/aliexpress/sourcings/[id]',
    method: 'GET, PUT, DELETE',
    기능: 'AliExpress 소싱 설정 상세 관리',
    적용시스템: 'AliExpress 통합',
    설명: '특정 소싱 설정 수정/삭제',
    요청예시: 'PUT /api/aliexpress/sourcings/123 { minRating: 4.5 }',
    응답예시: '{ success: true, sourcing: {...} }'
  },
  {
    url: '/api/aliexpress/collect',
    method: 'POST',
    기능: 'AliExpress 상품 수집',
    적용시스템: 'AliExpress 통합 + AliExpress API',
    설명: 'AliExpress API로 상품 수집',
    요청예시: 'POST { sourcingId }',
    응답예시: '{ success: true, collected: 50 }'
  },
  {
    url: '/api/aliexpress/products',
    method: 'GET',
    기능: 'AliExpress 수집 상품 목록 조회',
    적용시스템: 'AliExpress 통합',
    설명: 'AliExpressProduct 목록 조회',
    요청예시: 'GET /api/aliexpress/products?sourcingId=123',
    응답예시: '{ products: [{id, title, originalPrice}] }'
  },
  {
    url: '/api/ali-sourcing/search',
    method: 'GET',
    기능: 'AliExpress 상품 검색',
    적용시스템: 'AliExpress 통합',
    설명: 'AliExpress 상품 키워드 검색',
    요청예시: 'GET /api/ali-sourcing/search?keyword=shrimp',
    응답예시: '{ products: [{productId, title, price}] }'
  },
  {
    url: '/api/ali-sourcing/product/[id]',
    method: 'GET',
    기능: 'AliExpress 상품 상세 조회',
    적용시스템: 'AliExpress 통합',
    설명: 'AliExpress 특정 상품 상세 정보',
    요청예시: 'GET /api/ali-sourcing/product/12345',
    응답예시: '{ product: {id, title, description, images} }'
  },

  // ============================================
  // Band API 연동
  // ============================================
  {
    url: '/api/band/my-bands',
    method: 'GET',
    기능: '내 밴드 목록 조회',
    적용시스템: 'Band API 연동',
    설명: 'Band API로 사용자의 밴드 목록 조회',
    요청예시: 'GET /api/band/my-bands',
    응답예시: '{ bands: [{band_key, name, member_count}] }'
  },
  {
    url: '/api/band/settings',
    method: 'GET, PUT',
    기능: 'Band API 설정 관리',
    적용시스템: 'Band API 연동',
    설명: 'Band API Client ID, Secret 관리',
    요청예시: 'PUT { bandClientId, bandClientSecret }',
    응답예시: '{ success: true }'
  },

  // ============================================
  // 시스템 설정 (Settings)
  // ============================================
  {
    url: '/api/settings/ai',
    method: 'GET, PUT',
    기능: 'AI 설정 (Gemini API)',
    적용시스템: 'AI 분석 시스템',
    설명: 'Gemini API 키, 모델 설정',
    요청예시: 'PUT { geminiApiKey, geminiModel }',
    응답예시: '{ success: true, settings: {...} }'
  },
  {
    url: '/api/settings/ai/test',
    method: 'POST',
    기능: 'AI 연결 테스트',
    적용시스템: 'AI 분석 시스템 (개발용)',
    설명: 'Gemini API 연결 및 작동 테스트',
    요청예시: 'POST /api/settings/ai/test',
    응답예시: '{ success: true, message: "AI 연결 정상" }'
  },
  {
    url: '/api/settings/api',
    method: 'GET, PUT',
    기능: 'API 설정 (Band, AliExpress)',
    적용시스템: 'API 연동 설정',
    설명: '각종 외부 API 키 관리',
    요청예시: 'PUT { bandClientId, aliexpressApiKey }',
    응답예시: '{ success: true }'
  },
  {
    url: '/api/settings/api/test',
    method: 'POST',
    기능: 'API 연결 테스트',
    적용시스템: 'API 연동 설정 (개발용)',
    설명: 'Band, AliExpress API 연결 테스트',
    요청예시: 'POST /api/settings/api/test',
    응답예시: '{ bandApi: true, aliexpressApi: false }'
  },
  {
    url: '/api/settings/automation',
    method: 'GET, PUT',
    기능: '자동화 설정 (기본 가격정책)',
    적용시스템: '자동화 시스템',
    설명: '기본 가격정책 설정',
    요청예시: 'PUT { defaultPricingPolicy: "..." }',
    응답예시: '{ success: true, settings: {...} }'
  },
  {
    url: '/api/settings/notifications',
    method: 'GET, PUT',
    기능: '알림 설정',
    적용시스템: '알림 시스템',
    설명: '이메일, SMS 알림 설정',
    요청예시: 'PUT { emailEnabled, smsEnabled }',
    응답예시: '{ success: true }'
  },
  {
    url: '/api/settings/notifications/test',
    method: 'POST',
    기능: '알림 테스트',
    적용시스템: '알림 시스템 (개발용)',
    설명: '이메일/SMS 전송 테스트',
    요청예시: 'POST { type: "email", to: "test@example.com" }',
    응답예시: '{ success: true, sent: true }'
  },
  {
    url: '/api/settings/retail',
    method: 'GET, PUT',
    기능: '소매밴드 설정',
    적용시스템: '소매밴드 관리',
    설명: '자동 포스팅 설정 (간격, 시간대 등)',
    요청예시: 'PUT { autoPostInterval: 30, enableAutoPosting: true }',
    응답예시: '{ success: true, settings: {...} }'
  },
  {
    url: '/api/settings/strokepay',
    method: 'GET, PUT',
    기능: 'StrokePay 설정 (레거시)',
    적용시스템: 'StrokePay 자동화 (현재 미사용)',
    설명: 'StrokePay 자동화 설정 (현재 시스템에서 미사용)',
    요청예시: 'PUT { strokepayId, strokepayPassword }',
    응답예시: '{ success: true }'
  },
  {
    url: '/api/settings/strokepay/test',
    method: 'POST',
    기능: 'StrokePay 연결 테스트 (레거시)',
    적용시스템: 'StrokePay 자동화 (현재 미사용)',
    설명: 'StrokePay 자동화 테스트',
    요청예시: 'POST /api/settings/strokepay/test',
    응답예시: '{ success: false, message: "현재 미사용" }'
  },

  // ============================================
  // StrokePay 자동화 (레거시 - 현재 미사용)
  // ============================================
  {
    url: '/api/strokepay/excel',
    method: 'POST',
    기능: 'StrokePay 엑셀 생성 (레거시)',
    적용시스템: 'StrokePay 자동화 (현재 미사용)',
    설명: 'StrokePay용 엑셀 파일 생성',
    요청예시: 'POST { products: [...] }',
    응답예시: 'Excel file download'
  },
  {
    url: '/api/strokepay/links',
    method: 'GET, POST',
    기능: 'StrokePay 링크 관리 (레거시)',
    적용시스템: 'StrokePay 자동화 (현재 미사용)',
    설명: 'StrokePay 상품 링크 관리',
    요청예시: 'POST { productId, strokepayLink }',
    응답예시: '{ success: true }'
  },
  {
    url: '/api/strokepay/upload',
    method: 'POST',
    기능: 'StrokePay 엑셀 업로드 (레거시)',
    적용시스템: 'StrokePay 자동화 (현재 미사용)',
    설명: 'StrokePay용 엑셀 파일 업로드',
    요청예시: 'POST (multipart/form-data)',
    응답예시: '{ success: true, uploaded: 50 }'
  },
  {
    url: '/api/strokepay/automation/upload',
    method: 'POST',
    기능: 'StrokePay 자동 업로드 (레거시)',
    적용시스템: 'StrokePay 자동화 (현재 미사용)',
    설명: 'StrokePay 자동 업로드 처리',
    요청예시: 'POST /api/strokepay/automation/upload',
    응답예시: '{ success: true }'
  },
  {
    url: '/api/automation/strokepay/generate-script',
    method: 'POST',
    기능: 'StrokePay 스크립트 생성 (레거시)',
    적용시스템: 'StrokePay 자동화 (현재 미사용)',
    설명: 'Playwright 자동화 스크립트 생성',
    요청예시: 'POST /api/automation/strokepay/generate-script',
    응답예시: '{ script: "..." }'
  },
  {
    url: '/api/automation/strokepay/run',
    method: 'POST',
    기능: 'StrokePay 자동화 실행 (레거시)',
    적용시스템: 'StrokePay 자동화 (현재 미사용)',
    설명: 'Playwright 자동화 실행',
    요청예시: 'POST /api/automation/strokepay/run',
    응답예시: '{ success: true }'
  },
  {
    url: '/api/automation/strokepay/start',
    method: 'POST',
    기능: 'StrokePay 자동화 시작 (레거시)',
    적용시스템: 'StrokePay 자동화 (현재 미사용)',
    설명: 'StrokePay 자동화 프로세스 시작',
    요청예시: 'POST /api/automation/strokepay/start',
    응답예시: '{ success: true, processId }'
  },

  // ============================================
  // 소싱 사이트 관리
  // ============================================
  {
    url: '/api/sourcing/sites',
    method: 'GET, POST, DELETE',
    기능: '소싱 사이트 목록 관리',
    적용시스템: '소싱 관리',
    설명: 'SourcingSite CRUD',
    요청예시: 'POST { name, type, url }',
    응답예시: '{ sites: [{id, name, type}] }'
  },

  // ============================================
  // 유저 관리
  // ============================================
  {
    url: '/api/user/bands',
    method: 'GET',
    기능: '사용자 밴드 목록 조회',
    적용시스템: 'Band API 연동',
    설명: '사용자가 등록한 밴드 목록 (도매+소매)',
    요청예시: 'GET /api/user/bands',
    응답예시: '{ wholesale: [...], retail: [...] }'
  },

  // ============================================
  // 파일 업로드
  // ============================================
  {
    url: '/api/upload',
    method: 'POST',
    기능: '파일 업로드 (일반)',
    적용시스템: '파일 관리',
    설명: '이미지 등 일반 파일 업로드',
    요청예시: 'POST (multipart/form-data)',
    응답예시: '{ success: true, url: "..." }'
  },
  {
    url: '/api/upload/excel',
    method: 'POST',
    기능: '엑셀 파일 업로드',
    적용시스템: '파일 관리 + 엑셀 처리',
    설명: '엑셀 파일 업로드 및 파싱',
    요청예시: 'POST (multipart/form-data)',
    응답예시: '{ success: true, data: [...] }'
  },

  // ============================================
  // 모니터링 & 크론잡
  // ============================================
  {
    url: '/api/monitoring/products',
    method: 'GET',
    기능: '상품 모니터링 상태 조회',
    적용시스템: '모니터링 시스템',
    설명: '상품 재고, 가격 변동 모니터링',
    요청예시: 'GET /api/monitoring/products',
    응답예시: '{ monitored: 50, alerts: [...] }'
  },
  {
    url: '/api/cron/product-monitoring',
    method: 'GET',
    기능: '상품 모니터링 크론잡',
    적용시스템: '모니터링 시스템 + 크론잡',
    설명: '주기적 상품 상태 체크 (크론잡)',
    요청예시: 'GET /api/cron/product-monitoring',
    응답예시: '{ success: true, checked: 100 }'
  },

  // ============================================
  // 헬스체크
  // ============================================
  {
    url: '/api/health',
    method: 'GET',
    기능: '서버 헬스체크',
    적용시스템: '시스템 모니터링',
    설명: '서버 상태 확인 (DB, Redis 등)',
    요청예시: 'GET /api/health',
    응답예시: '{ status: "ok", database: true, redis: true }'
  },

  // ============================================
  // 디버그 & 테스트 API (개발용)
  // ============================================
  {
    url: '/api/debug/pricing',
    method: 'POST',
    기능: '가격정책 디버그',
    적용시스템: '개발/디버그',
    설명: '가격정책 적용 결과 테스트',
    요청예시: 'POST { price: 15000, policy: "..." }',
    응답예시: '{ originalPrice, adjustedPrice, calculation }'
  },
  {
    url: '/api/debug/test-comments',
    method: 'GET',
    기능: '댓글 파싱 테스트',
    적용시스템: '개발/디버그',
    설명: 'Band 댓글 파싱 로직 테스트',
    요청예시: 'GET /api/debug/test-comments',
    응답예시: '{ parsed: {...}, raw: {...} }'
  },
  {
    url: '/api/test/database',
    method: 'GET',
    기능: '데이터베이스 연결 테스트',
    적용시스템: '개발/디버그',
    설명: 'Prisma DB 연결 테스트',
    요청예시: 'GET /api/test/database',
    응답예시: '{ connected: true, tables: 20 }'
  },
  {
    url: '/api/test/pricing-debug',
    method: 'POST',
    기능: '가격 계산 디버그',
    적용시스템: '개발/디버그',
    설명: '가격 계산 과정 상세 로그',
    요청예시: 'POST { price, policy }',
    응답예시: '{ steps: [...], result: 16000 }'
  },

  // ============================================
  // Band API 테스트 (개발용 - 17개)
  // ============================================
  {
    url: '/api/test/band/route',
    method: 'GET',
    기능: 'Band API 기본 테스트',
    적용시스템: '개발/디버그 + Band API',
    설명: 'Band API 연결 및 기본 기능 테스트',
    요청예시: 'GET /api/test/band',
    응답예시: '{ connected: true, bands: [...] }'
  },
  {
    url: '/api/test/band/list-bands',
    method: 'GET',
    기능: 'Band 목록 조회 테스트',
    적용시스템: '개발/디버그 + Band API',
    설명: 'Band API로 밴드 목록 조회 테스트',
    요청예시: 'GET /api/test/band/list-bands',
    응답예시: '{ bands: [{band_key, name}] }'
  },
  {
    url: '/api/test/band/posts',
    method: 'GET',
    기능: 'Band 게시물 조회 테스트',
    적용시스템: '개발/디버그 + Band API',
    설명: 'Band API로 게시물 조회 테스트',
    요청예시: 'GET /api/test/band/posts?bandKey=xxx',
    응답예시: '{ posts: [{post_key, content}] }'
  },
  {
    url: '/api/test/band/collect-posts',
    method: 'POST',
    기능: 'Band 게시물 수집 테스트',
    적용시스템: '개발/디버그 + Band API',
    설명: '게시물 수집 로직 테스트',
    요청예시: 'POST { bandKey }',
    응답예시: '{ collected: 10, saved: 8 }'
  },
  {
    url: '/api/test/band/collect-posts-all',
    method: 'POST',
    기능: '전체 Band 게시물 수집 테스트',
    적용시스템: '개발/디버그 + Band API',
    설명: '모든 밴드에서 게시물 수집 테스트',
    요청예시: 'POST /api/test/band/collect-posts-all',
    응답예시: '{ totalBands: 6, totalCollected: 120 }'
  },
  {
    url: '/api/test/band/comprehensive',
    method: 'GET',
    기능: 'Band API 종합 테스트',
    적용시스템: '개발/디버그 + Band API',
    설명: 'Band API 모든 기능 테스트',
    요청예시: 'GET /api/test/band/comprehensive',
    응답예시: '{ testResults: {...} }'
  },
  {
    url: '/api/test/band/debug',
    method: 'GET',
    기능: 'Band API 디버그',
    적용시스템: '개발/디버그 + Band API',
    설명: 'Band API 상태 및 에러 디버그',
    요청예시: 'GET /api/test/band/debug',
    응답예시: '{ status, errors: [...] }'
  },
  {
    url: '/api/test/band/debug-collection',
    method: 'GET',
    기능: 'Band 수집 프로세스 디버그',
    적용시스템: '개발/디버그',
    설명: '수집 프로세스 단계별 디버그',
    요청예시: 'GET /api/test/band/debug-collection',
    응답예시: '{ steps: [...], issues: [...] }'
  },
  {
    url: '/api/test/band/debug-posts',
    method: 'GET',
    기능: 'Band 게시물 파싱 디버그',
    적용시스템: '개발/디버그',
    설명: '게시물 데이터 파싱 디버그',
    요청예시: 'GET /api/test/band/debug-posts',
    응답예시: '{ parsed: {...}, errors: [...] }'
  },
  {
    url: '/api/test/band/debug-timestamps',
    method: 'GET',
    기능: 'Band 타임스탬프 디버그',
    적용시스템: '개발/디버그',
    설명: '게시물 시간 파싱 디버그',
    요청예시: 'GET /api/test/band/debug-timestamps',
    응답예시: '{ timestamps: [...], formatted: [...] }'
  },
  {
    url: '/api/test/band/direct',
    method: 'GET',
    기능: 'Band API 직접 호출 테스트',
    적용시스템: '개발/디버그 + Band API',
    설명: 'Band API 원본 응답 확인',
    요청예시: 'GET /api/test/band/direct',
    응답예시: '{ rawResponse: {...} }'
  },
  {
    url: '/api/test/band/fix-timestamp',
    method: 'POST',
    기능: 'Band 타임스탬프 수정',
    적용시스템: '개발/디버그',
    설명: '잘못된 타임스탬프 일괄 수정',
    요청예시: 'POST /api/test/band/fix-timestamp',
    응답예시: '{ fixed: 50 }'
  },
  {
    url: '/api/test/band/manual-token',
    method: 'POST',
    기능: 'Band 토큰 수동 입력',
    적용시스템: '개발/디버그 + Band API',
    설명: 'Band Access Token 수동 설정',
    요청예시: 'POST { accessToken }',
    응답예시: '{ success: true }'
  },
  {
    url: '/api/test/band/simple-timestamp-test',
    method: 'GET',
    기능: 'Band 타임스탬프 간단 테스트',
    적용시스템: '개발/디버그',
    설명: '타임스탬프 파싱 단순 테스트',
    요청예시: 'GET /api/test/band/simple-timestamp-test',
    응답예시: '{ testCases: [...] }'
  },
  {
    url: '/api/test/band/test-posts-access',
    method: 'GET',
    기능: 'Band 게시물 접근 권한 테스트',
    적용시스템: '개발/디버그 + Band API',
    설명: 'Band API 게시물 접근 권한 확인',
    요청예시: 'GET /api/test/band/test-posts-access',
    응답예시: '{ accessible: true }'
  },
  {
    url: '/api/test/band/update-token',
    method: 'POST',
    기능: 'Band 토큰 업데이트 테스트',
    적용시스템: '개발/디버그 + Band API',
    설명: 'Band Access Token 갱신 테스트',
    요청예시: 'POST /api/test/band/update-token',
    응답예시: '{ updated: true, newToken }'
  },
  {
    url: '/api/test/wholesale/collect-test',
    method: 'POST',
    기능: '도매밴드 수집 통합 테스트',
    적용시스템: '개발/디버그',
    설명: '도매밴드 수집 전체 플로우 테스트',
    요청예시: 'POST /api/test/wholesale/collect-test',
    응답예시: '{ success: true, results: {...} }'
  }
];

async function generateExcel() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('API 라우팅 분석', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
  });

  // 열 정의
  worksheet.columns = [
    { header: 'No', key: 'no', width: 8 },
    { header: 'URL', key: 'url', width: 50 },
    { header: 'Method', key: 'method', width: 15 },
    { header: '기능', key: '기능', width: 40 },
    { header: '적용시스템', key: '적용시스템', width: 35 },
    { header: '상세설명', key: '설명', width: 60 },
    { header: '요청 예시', key: '요청예시', width: 50 },
    { header: '응답 예시', key: '응답예시', width: 50 }
  ];

  // 헤더 스타일
  worksheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 25;

  // 데이터 추가
  apiRoutes.forEach((route, index) => {
    const row = worksheet.addRow({
      no: index + 1,
      url: route.url,
      method: route.method,
      기능: route.기능,
      적용시스템: route.적용시스템,
      설명: route.설명,
      요청예시: route.요청예시,
      응답예시: route.응답예시
    });

    // 행 스타일
    row.alignment = { vertical: 'top', wrapText: true };
    row.height = 30;

    // 적용시스템별 색상 구분
    const system = route.적용시스템;
    let fillColor = 'FFFFFFFF';

    if (system.includes('인증')) fillColor = 'FFFCE4EC';
    else if (system.includes('도매밴드')) fillColor = 'FFE3F2FD';
    else if (system.includes('상품')) fillColor = 'FFE8F5E9';
    else if (system.includes('쇼핑몰')) fillColor = 'FFFFF3E0';
    else if (system.includes('결제') || system.includes('토스페이먼츠')) fillColor = 'FFFCE4EC';
    else if (system.includes('소매밴드')) fillColor = 'FFF3E5F5';
    else if (system.includes('AliExpress')) fillColor = 'FFF1F8E9';
    else if (system.includes('Band API')) fillColor = 'FFE1F5FE';
    else if (system.includes('개발') || system.includes('디버그')) fillColor = 'FFEEEEEE';
    else if (system.includes('StrokePay') || system.includes('레거시')) fillColor = 'FFFBE9E7';

    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
      };

      // No와 Method 열은 가운데 정렬
      if (colNumber === 1 || colNumber === 3) {
        cell.alignment = { ...cell.alignment, horizontal: 'center' };
      }

      // 적용시스템 열만 색상 적용
      if (colNumber === 5) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: fillColor }
        };
        cell.font = { bold: true };
      }
    });
  });

  // 필터 추가
  worksheet.autoFilter = {
    from: 'A1',
    to: 'H1'
  };

  // 통계 시트 추가
  const statsSheet = workbook.addWorksheet('통계');

  // 시스템별 통계 계산
  const systemStats = {};
  apiRoutes.forEach(route => {
    const system = route.적용시스템;
    systemStats[system] = (systemStats[system] || 0) + 1;
  });

  statsSheet.columns = [
    { header: '적용시스템', key: 'system', width: 35 },
    { header: 'API 개수', key: 'count', width: 15 },
    { header: '비율', key: 'percentage', width: 15 }
  ];

  statsSheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  statsSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };
  statsSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  const totalAPIs = apiRoutes.length;
  Object.entries(systemStats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([system, count]) => {
      const percentage = ((count / totalAPIs) * 100).toFixed(1);
      statsSheet.addRow({
        system,
        count,
        percentage: `${percentage}%`
      });
    });

  // 총계 행 추가
  const totalRow = statsSheet.addRow({
    system: '총계',
    count: totalAPIs,
    percentage: '100%'
  });
  totalRow.font = { bold: true };
  totalRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFF4CC' }
  };

  // 파일 저장
  const outputPath = path.join(__dirname, '..', 'docs', 'BandAuto_API_분석서.xlsx');
  await workbook.xlsx.writeFile(outputPath);

  console.log(`✅ API 분석서 생성 완료: ${outputPath}`);
  console.log(`📊 총 API 개수: ${totalAPIs}개`);
  console.log(`📈 시스템 카테고리: ${Object.keys(systemStats).length}개`);
}

// 실행
generateExcel().catch(console.error);
