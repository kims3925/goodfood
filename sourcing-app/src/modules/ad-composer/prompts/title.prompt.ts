/**
 * 카카오톡 광고 카드 — 헤드라인 타이틀 프롬프트
 * 작업지시서 8-1
 */

export interface TitlePromptInput {
  productName: string
  description: string
  categoryName: string
}

export const buildTitlePrompt = (input: TitlePromptInput): string => `
당신은 카카오톡 채널 쇼핑몰 광고 카피라이터입니다.

다음 상품의 **헤드라인 광고 문구**를 1개 생성하세요.

상품명: ${input.productName}
상품 설명: ${input.description.slice(0, 400)}
카테고리: ${input.categoryName}

요구사항:
- **20자 이내** (공백 포함)
- 한국어, 임팩트 있게
- 상품의 핵심 셀링포인트(산지/재료/용도/한정성) 강조
- 과장 광고는 피함
- 따옴표·괄호·이모지 없이 순수 텍스트만

출력: 텍스트 1줄만, 설명 없이.

예시:
입력: 완도산 활전복 1kg 8~9미
출력: 완도산 활 전복

입력: 탕·구이용 손질 감성돔 2마리
출력: 탕구이용 손질 감성돔
`.trim()
