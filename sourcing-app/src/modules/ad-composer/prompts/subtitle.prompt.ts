/**
 * 카카오톡 광고 카드 — 서브타이틀 프롬프트
 * 작업지시서 8-2
 */

export interface SubtitlePromptInput {
  productName: string
  description: string
  title: string
}

export const buildSubtitlePrompt = (input: SubtitlePromptInput): string => `
방금 생성한 헤드라인 "${input.title}"의 보조 설명을 1줄 만드세요.

상품: ${input.productName}
설명: ${input.description.slice(0, 400)}

요구사항:
- **30자 내외**
- 한 문장, 마침표 없이
- 헤드라인에서 못 담은 핵심 포인트 (조리법/포장/품질/용량)
- 한글만, 이모지·괄호·따옴표 금지

출력: 1줄만.
`.trim()
