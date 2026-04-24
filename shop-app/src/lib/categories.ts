/**
 * 쇼핑몰 카테고리 메타 정보
 *
 * sourcing-app의 카테고리 분류 코드와 동일한 체계를 사용한다 (Product.categoryId).
 * 앱 간 모듈 격리 원칙에 따라 sourcing-app의 category 모듈을 직접 참조하지 않고
 * shop-app 자체 상수로 유지한다. 코드/이름이 변경되면 양쪽 모두 동기화 필요.
 */

export const CATEGORY_MAP = {
  SEA: { name: '수산물', label: '오늘의 수산물', emoji: '🐟', color: '#0077B6' },
  AGR: { name: '농산물', label: '오늘의 농산물', emoji: '🥬', color: '#2D6A4F' },
  MEA: { name: '축산물', label: '오늘의 축산물', emoji: '🥩', color: '#9B2226' },
  MKT: { name: '밀키트/반찬/간편식', label: '오늘의 밀키트/반찬', emoji: '🍱', color: '#E07A5F' },
  PRC: { name: '가공식품', label: '오늘의 가공식품', emoji: '🫙', color: '#3D405B' },
  HLT: { name: '건강식품', label: '오늘의 건강식품', emoji: '💊', color: '#6D6875' },
  COM: { name: '상시상품', label: '상시 판매 상품', emoji: '🏷️', color: '#8B5A3C' },
  ETC: { name: '기타', label: '오늘의 추천상품', emoji: '📦', color: '#6B7280' },
} as const

export type CategoryCode = keyof typeof CATEGORY_MAP
export const CATEGORY_CODES = Object.keys(CATEGORY_MAP) as CategoryCode[]

export function isCategoryCode(value: string): value is CategoryCode {
  return (CATEGORY_CODES as readonly string[]).includes(value)
}
