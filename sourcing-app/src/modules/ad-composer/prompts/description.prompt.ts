/**
 * 카카오톡 광고 카드 — 본문 설명 프롬프트
 * 작업지시서 8-3
 */

export interface DescriptionPromptInput {
  productName: string
  description: string
  priceText: string
  variantSummary: string  // 옵션 요약 ("400g 1팩, 800g 2팩")
  categoryName: string
}

export const buildDescriptionPrompt = (input: DescriptionPromptInput): string => `
상품: ${input.productName}
원본 설명: ${input.description}
가격 정보: ${input.priceText}
옵션: ${input.variantSummary}
카테고리: ${input.categoryName}

위 정보로 **카카오톡 광고 본문 설명**을 작성하세요.

요구사항:
- **3-5줄, 총 200자 내외**
- 이모지 1-2개 (카테고리 맞춤: 수산물 🐟🦪 / 농산물 🥬🍎 / 축산물 🥩 / 김치반찬 🌶️ / 가공식품 🥫 / 건강식품 💊)
- 마지막 줄에 **가격 강조** (옵션별 가격 전부 나열)
- 존댓말, 친근한 톤
- 허위·과장 표현(최저가/100%만족 등) 금지
- 줄바꿈은 \\n으로

출력 형식 (마크다운 없이 plain text):
첫째 줄
둘째 줄
...
가격 라인 (마지막)
`.trim()
