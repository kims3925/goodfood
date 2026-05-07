/**
 * 상세페이지 카피라이팅 프롬프트.
 * 입력: 추출된 상품 데이터 → 출력: headline/subheadline/sellingPoints/sections/faq 등.
 */

export const DETAIL_PAGE_PROMPT = `당신은 한국 수산물·식품 쇼핑몰 상세페이지 카피라이터입니다.

# 상품 정보
- 상품명: {productName}
- 가격: {productPrice}원
- 카테고리: {productCategory}
- 기존 설명: {productDescription}
- 판매 포인트: {sellingPoints}

# 생성 요청

다음 JSON 형식으로 상세페이지 콘텐츠를 생성하세요 (마크다운 없이 JSON 만):

{
  "headline": "메인 헤드라인 (임팩트 있는 한 줄, 15-25자)",
  "subheadline": "서브 헤드라인 (설명형, 20-40자)",
  "heroDescription": "상단 요약 설명 (2-3문장, 100자 이내)",
  "sellingPoints": [
    { "icon": "이모지", "title": "포인트 제목 (5-8자)", "description": "설명 (20-30자)" }
  ],
  "detailSections": [
    {
      "title": "섹션 제목",
      "content": "상세 설명 (HTML 태그 사용 가능)",
      "type": "text"
    }
  ],
  "trustBadges": ["무료배송", "당일출고", "100% 신선보장"],
  "ctaText": "구매 버튼 텍스트",
  "seoDescription": "SEO meta description (150자 이내)",
  "faq": [
    { "q": "자주 묻는 질문", "a": "답변" }
  ]
}

규칙:
- 수산물/식품: 신선도, 원산지, 당일배송 강조
- 모든 텍스트 한국어
- 구매 전환에 최적화된 설득력 있는 카피
- sellingPoints 는 3-5개
- detailSections 는 2-4개
- faq 는 3-5개
- detailSections.content 의 HTML 은 <p>, <ul>, <li>, <strong>, <br> 만 사용

JSON 만 응답하세요.`
