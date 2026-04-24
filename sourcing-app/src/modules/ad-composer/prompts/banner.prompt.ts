/**
 * 카카오톡 광고 카드 — 빨간 강조 배너 프롬프트
 * 작업지시서 8 (선택적 생성)
 *
 * 배너는 모든 카드에 들어가는 것이 아니므로, 상품에 "프리미엄"·"국내산"·
 * "당일제조"·"산지직송" 같은 셀링키워드가 명확할 때만 사용한다.
 */

export interface BannerPromptInput {
  productName: string
  description: string
}

export const buildBannerPrompt = (input: BannerPromptInput): string => `
다음 상품의 **빨간 강조 배너 한 줄**을 작성할지 판단하세요.

상품: ${input.productName}
설명: ${input.description.slice(0, 400)}

판단 기준:
- 명확한 셀링키워드가 있어야 함: "프리미엄", "국내산", "당일제조", "산지직송",
  "친환경", "수제", "유기농", "자연산", "활어", "1+ 등급" 등
- 모호하거나 키워드가 없으면 작성하지 말 것

응답:
- 키워드가 있으면: 그 키워드를 활용한 30자 내외의 한 줄 (예: "프리미엄 국내산 활 전복 100%")
- 없으면 정확히 "SKIP" 한 단어만 출력

출력은 반드시 1줄. 설명 금지.
`.trim()
