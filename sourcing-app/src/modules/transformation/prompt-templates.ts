/**
 * 상품 변환 프롬프트 템플릿 상수
 *
 * 단일 변환(buildProductExtractionPrompt), 배치 변환(buildBatchProductExtractionPrompt),
 * UI 설정 페이지(prompt/page.tsx)에서 공유하는 프롬프트 텍스트를 한 곳에서 관리합니다.
 */

// =============================================
// 공통 규칙 섹션 (단일/배치 프롬프트 모두 사용)
// =============================================

export const EXTRACTION_RULES = `# 🚫 수집 제외 규칙

## 게시물 검증
다음 게시물은 **상품 변환 불가**:
- ❌ 가격 정보가 전혀 없는 게시물
- ❌ 단순 홍보/인사 게시물
- ❌ 상품 없이 입금/배송 안내만 있는 글
- ❌ 품절/마감 공지
- ❌ 구인/구직 게시물

**상품 변환 불가 시 응답:**
{
  "error": "INVALID_POST",
  "reason": "상품 정보 없음 - 단순 공지 게시물",
  "extractable": false
}

---

# 📦 상품 정보 추출 규칙

## 1. 상품명 (카피형 네이밍, 20-35자)

### 네이밍 공식
[임팩트 키워드] + [원산지/브랜드] + [품질 수식어] + [상품명] + (옵션 요약)

### 임팩트 키워드 예시
| 카테고리 | 추천 키워드 |
|---------|-----------|
| 수산물 | 싱싱한, 통통한, 당일조업, 자연산, 활 |
| 농산물 | 꿀맛, 햇, 유기농, 무농약, 산지직송 |
| 가공식품 | N년전통, 수제, 프리미엄, 명품, 홈메이드 |
| 축산물 | 신선한, 1등급, 프리미엄, 한우, 국내산 |

### 작성 규칙
- 첫 단어에 임팩트 있는 형용사 배치
- 원산지/지역명으로 신뢰도 확보
- 느낌표는 최대 1개 (없어도 됨)
- 20~35자 이내로 간결하게

### 예시
✅ "싱싱한 통영산 활돌문어 (대/특대)"
✅ "꿀달수 무안 황토 고구마 10kg"
❌ "낙지!!!" (너무 짧거나 느낌표 등의 표현이 과다함)

---

## 2. 상품 설명 (300-600자, 번호+글머리 서식 필수!)

### 서식 규칙 (반드시 적용)
- 번호 제목: 1. 제목명, 2. 제목명 형식
- 글머리 기호: • 로 세부 내용 나열
- 괄호 보충: (보충 설명) 형식
- 이모지: 적절히 사용 (😊 👍 등)

### 필수 섹션 (4개)
1. 크기/용량/규격
• 구체적 수치 (길이, 무게, 용량 등)
• 비교 표현 (일반 제품 대비 차별점)

2. 신선도/원산지/제조방식
• 산지직송, 당일작업 등 신선도 강조
• 원산지, 생산방식 설명

3. 맛/식감/품질
• 맛 표현 (고소한, 달콤한, 감칠맛 등)
• 식감 표현 (바삭, 촉촉, 쫄깃 등)

4. 섭취방법/보관방법/손질여부
• 조리법, 활용법
• 보관 안내

### 선택 섹션 (원본에 정보 있을 때만 추가)
5. 주문/배송 안내 (선택)
• 배송: "정책에 따름" 정도로 짧게만 표기 (배송비 텍스트는 description 에 적지 말 것 — shipping 필드에서 처리)
• 합배송: N개까지 가능 (합배송 정보 있을 때만)
• 주문 마감: 매일 오후 N시
• 발송일: 주문 후 N일 이내
• 출고 요일: 매주 월/수/금

⚠️ description 에는 "배송비 포함" / "무료배송" / "배송비 N원" 같은 텍스트를 **절대 넣지 마세요**.
배송비 처리는 정책(policySection)과 shipping 필드(shippingFee/shippingInfo)에서만 결정됩니다.
이 영역에 잘못된 키워드가 들어가면 자동 분류기가 오작동합니다.

### 금지
- ❌ 의학적 효능 ("당뇨 치료", "암 예방")
- ❌ 서식 미적용 (번호, 글머리 없이 문장 나열 금지)
- ❌ description에 가격 텍스트 금지 (가격은 pricing/variants 필드에만)
- ❌ description에 배송비 금액 금지 ("배송비 4,000원" 등 - 배송비는 shipping 필드에만)

---

## 3. 옵션 및 가격 추출

### 가격 패턴 인식
일반: 48,000원, 48000원, ₩48,000, ￦48000
화살표: ➡️ 공급가 18,500원, ⏩ 39,000원
슬래시: 1키로: 35,000원, 10미/48,000
괄호: (5미 29,000원)

### 옵션 유형별 그룹명
| 옵션 유형 | groupName | values 예시 |
|----------|-----------|------------|
| 수량 | 수량 | 5미, 10마리, 20미 |
| 중량 | 중량 | 500g, 1kg, 3kg |
| 크기 | 크기/규격 | 소, 중, 대, 특대 |
| 구성 | 구성/세트 | A세트, 단품, 야채세트 |
| 맛/종류 | 종류 | 통팥, 야채, 김치 |

### 복합 옵션 처리
크기 + 수량이 결합된 경우:
"세발낙지 10미", "세발낙지 5미", "얼치기 10미"
→ groupName: "규격" (크기+수량 통합)

{pricingRule}

---

## 4. 배송비 및 합배송 추출

### 정책 우선 원칙 (필수!)
가격 정책에 "배송비: 별도" 가 있다면 → 이 게시물은 **반드시 배송비 별도** 입니다.
본문에 명시 가격이 없어도 shippingInfo 에 "배송비 별도" 라고 표기하고, shippingFee
숫자는 가능하면 본문에서 찾아 추출 (없으면 null 가능).

가격 정책에 "배송비: 포함" 이 있다면 → 이 게시물은 **반드시 배송비 포함** 입니다.
shippingInfo 에 "배송비 포함" 표기, shippingFee = 0.

### 배송비 인식 패턴
포함: "택배비 포함", "배송비 포함", "무료배송"
별도: "배송비 별도 3,000원", "택배비 4,000원"
조건: "2박스 이상 무료", "5만원 이상 무배"

### 합배송 인식 패턴
"3세트까지 합배송", "합배송 3개", "묶음배송 2개까지"
"2세트 이상 배송비 할인", "3박스 동봉 가능"
"2세트(4박스)까지 합배송" → bundleMaxQty: 4

### 추출 규칙
- 정책의 "배송비:" 표시가 우선. 본문 텍스트와 충돌하면 정책을 따른다.
- 배송비 금액이 본문에 명시되면 숫자로 추출
- "포함/무료"면 shippingFee: 0
- 본문에 정보 없는데 정책이 "별도" 면 shippingInfo: "배송비 별도", shippingFee: null
- 합배송 최대 수량 추출 (숫자로 명시된 경우)
- 합배송 언급 없으면 bundleMaxQty: 1 (합배송 불가)

### 옵션별 합배송 단위 (bundleUnit)
- 합배송 한도의 단위를 파악 (박스, kg, 개, 세트 등)
- 각 옵션명에서 해당 단위의 수량을 추출하여 variants에 bundleUnit 추가
- 예: "4박스까지 합배송", 옵션 "2박스(2.8kg)" → bundleUnit: 2
- 예: "5kg까지 합배송", 옵션 "2kg" → bundleUnit: 2
- 단위가 명확하지 않으면 bundleUnit: 1 (기본값)

---

# 📋 데이터 구조 규칙 (필수!)

## 타입 규칙
| 필드 | 타입 | 예시 |
|-----|-----|-----|
| wholesalePrice | number | 48000 ✅ / "48000" ❌ |
| price | number | 48000 ✅ / "48,000원" ❌ |
| shippingFee | number 또는 null | 3000, 0, null |`

// =============================================
// 단일 변환 전용 응답 형식
// =============================================

export const SINGLE_RESPONSE_FORMAT = `# 📝 응답 형식

## 정상 응답 (순수 JSON, 마크다운 금지)
{
  "productName": "string (20-35자)",
  "description": "string (300-600자)",
  "category": "string",
  "options": [
    { "groupName": "string", "values": ["string"] }
  ],
  "pricing": {
    "wholesalePrice": number,
    "price": number,
    "currency": "KRW"
  },
  "variants": [
    {
      "optionSummary": "string",
      "options": { "groupName": "value" },
      "wholesalePrice": number,
      "price": number,
      "bundleUnit": number (기본값 1, 합배송 단위 수)
    }
  ],
  "shipping": {
    "shippingFee": number 또는 null,
    "shippingInfo": "string 또는 null",
    "bundleMaxQty": number (기본값 1, 합배송 가능하면 2 이상)
  }
}`

export const SINGLE_EXAMPLE = `# 💡 예시

## 예시: 수산물 다중 옵션
입력:
제목: 고흥 활낙지
내용: 세발낙지 10마리 48,000원 (5미 29,000원)
얼치기 10마리 55,000원 (5미 32,500원)
소낙지 10마리 70,000원
택배비 별도 5,000원

출력:
{
  "productName": "당일조업 고흥 활낙지 (세발/얼치기/소)",
  "description": "1. 크기와 규격\\n• 세발낙지: 다리가 가늘고 부드러운 소형 낙지\\n• 얼치기: 중간 크기로 적당한 식감\\n• 소낙지: 통통하게 살이 오른 대형 낙지\\n• 마리당 100~300g 내외\\n\\n2. 신선도와 원산지\\n• 전남 고흥 청정 갯벌에서 당일 조업!\\n• 펄떡펄떡 살아있는 상태로 산소포장\\n• 받으시면 아직도 움직이는 낙지를 확인하실 수 있어요.\\n\\n3. 맛과 품질\\n• 갯벌에서 자란 뻘낙지 특유의 고소한 맛!\\n• 비린내 없이 감칠맛이 가득합니다.\\n• 산지 어부가 직접 선별하여 품질 보장 😊\\n\\n4. 추천 요리법\\n• 세발낙지: 탕탕이, 연포탕, 낙지전골\\n• 얼치기/소낙지: 낙지볶음, 낙지숙회, 산낙지회",
  "category": "수산물",
  "options": [
    { "groupName": "규격", "values": ["세발 10미", "세발 5미", "얼치기 10미", "얼치기 5미", "소낙지 10미"] }
  ],
  "pricing": { "wholesalePrice": 29000, "price": 29000, "currency": "KRW" },
  "variants": [
    { "optionSummary": "세발 10미", "options": { "규격": "세발 10미" }, "wholesalePrice": 48000, "price": 48000, "bundleUnit": 1 },
    { "optionSummary": "세발 5미", "options": { "규격": "세발 5미" }, "wholesalePrice": 29000, "price": 29000, "bundleUnit": 1 },
    { "optionSummary": "얼치기 10미", "options": { "규격": "얼치기 10미" }, "wholesalePrice": 55000, "price": 55000, "bundleUnit": 1 },
    { "optionSummary": "얼치기 5미", "options": { "규격": "얼치기 5미" }, "wholesalePrice": 32500, "price": 32500, "bundleUnit": 1 },
    { "optionSummary": "소낙지 10미", "options": { "규격": "소낙지 10미" }, "wholesalePrice": 70000, "price": 70000, "bundleUnit": 1 }
  ],
  "shipping": { "shippingFee": 5000, "shippingInfo": "택배비 별도 5,000원", "bundleMaxQty": 1 }
}`

export const SINGLE_CHECKLIST = `# ⚠️ 최종 체크리스트
- JSON만 응답 (마크다운 코드블록 사용 금지)
- variants 배열이 비어있지 않음 (최소 1개)
- 각 variant에 options 객체 포함
- options.values와 variants가 1:1 대응
- description 300자 이상
- 모든 가격이 숫자 타입
- 상품 아닌 게시물은 error 응답`

// =============================================
// 배치 변환 전용 응답 형식
// =============================================

export const BATCH_RESPONSE_FORMAT = `# 📋 데이터 구조 규칙 (필수!)

## 타입 규칙
| 필드 | 타입 | 예시 |
|-----|-----|-----|
| wholesalePrice | number | 48000 ✅ / "48000" ❌ |
| price | number | 48000 ✅ / "48,000원" ❌ |
| shippingFee | number 또는 null | 3000, 0, null |

## 필수 검증 항목
- variants 배열이 비어있지 않음 (최소 1개)
- 각 variant에 options 객체 포함
- options.values와 variants가 1:1 대응
- description이 300자 이상
- 모든 가격이 숫자 타입

---

# 📝 응답 형식

## 정상 응답 (순수 JSON 배열, 마크다운 금지)
[
  {
    "postId": 게시물ID숫자,
    "productName": "string (20-35자)",
    "description": "string (300-600자)",
    "category": "string",
    "options": [
      { "groupName": "string", "values": ["string"] }
    ],
    "pricing": {
      "wholesalePrice": number,
      "price": number,
      "currency": "KRW"
    },
    "variants": [
      {
        "optionSummary": "string",
        "options": { "groupName": "value" },
        "wholesalePrice": number,
        "price": number,
        "bundleUnit": number (기본값 1, 합배송 단위 수)
      }
    ],
    "shipping": {
      "shippingFee": number 또는 null,
      "shippingInfo": "string 또는 null",
      "bundleMaxQty": number (기본값 1, 합배송 가능하면 2 이상)
    }
  }
]

## 변환 불가 게시물 응답
{
  "postId": 게시물ID숫자,
  "error": "INVALID_POST | NO_PRICE | NO_PRODUCT",
  "reason": "구체적인 사유",
  "extractable": false
}`

export const BATCH_CHECKLIST = `# ⚠️ 최종 체크리스트
- JSON 배열만 응답 (마크다운 코드블록 사용 금지)
- 각 객체에 postId 포함 (게시물 ID와 일치)
- 모든 가격 숫자 타입
- variants 최소 1개 이상
- description 300자 이상
- 상품 아닌 게시물은 error 응답`

// =============================================
// UI 기본 프롬프트 (설정 페이지용)
// =============================================

/**
 * UI 설정 페이지에서 "기본값으로 복구" 시 사용하는 프롬프트.
 * 변수 플레이스홀더({title}, {content}, {policySection}, {pricingRule})를 포함합니다.
 */
export const DEFAULT_PRODUCT_EXTRACTION_PROMPT = `당신은 한국 도매 쇼핑몰 상품 정보 추출 전문가입니다.

# 입력 데이터
제목: {title}
내용: {content}
{policySection}

---

${EXTRACTION_RULES}

---

${SINGLE_RESPONSE_FORMAT}

---

${SINGLE_EXAMPLE}

---

${SINGLE_CHECKLIST}`
