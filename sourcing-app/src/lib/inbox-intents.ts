/**
 * AI 채팅 자동응답 — 12개 의도 정의 (작업지시서 §2)
 */

export const INTENTS = [
  'ORDER',
  'PRICE',
  'STOCK',
  'DELIVERY',
  'PAYMENT',
  'DEPOSIT',
  'RETURN',
  'COMPLAINT',
  'RESTOCK',
  'RECOMMEND',
  'INFO',
  'GENERAL',
] as const

export type Intent = (typeof INTENTS)[number]

export const INTENT_LABELS: Record<Intent, string> = {
  ORDER: '🛒 주문하기',
  PRICE: '💰 가격문의',
  STOCK: '📦 재고문의',
  DELIVERY: '🚚 배송문의',
  PAYMENT: '💳 결제안내',
  DEPOSIT: '🏦 입금확인',
  RETURN: '↩️ 교환/반품',
  COMPLAINT: '😡 불만/컴플레인',
  RESTOCK: '🔔 재입고알림',
  RECOMMEND: '⭐ 추천/상담',
  INFO: 'ℹ️ 영업정보',
  GENERAL: '💬 인사/잡담',
}

export const INTENT_DESCRIPTIONS: Record<Intent, string> = {
  ORDER: '주문, 살게요, 보내주세요, 1번, 2개 등',
  PRICE: '얼마예요, kg당 가격, 배송비 포함 여부',
  STOCK: '아직 있어요, 몇 개 남았어요, 품절 여부',
  DELIVERY: '언제 도착, 배송 시작, 택배번호',
  PAYMENT: '입금 어디로, 카드 가능, 계좌번호',
  DEPOSIT: '입금했어요, 김OO 입금완료, 송금 완료',
  RETURN: '교환, 반품, 상한 게 왔어요',
  COMPLAINT: '너무 작아요, 설명과 달라요, 화가 납니다',
  RESTOCK: '언제 다시 들어와요, 재입고 알림',
  RECOMMEND: '손님접대용 추천, 회 몇 인분, 뭐가 좋아요',
  INFO: '몇 시까지 영업, 어디서 받나요, 휴무일',
  GENERAL: '감사합니다, 안녕하세요, 잡담',
}

// 자동응답 가능 여부 (작업지시서 §2 표 기반)
export const INTENT_AUTO_REPLY: Record<Intent, 'full' | 'partial' | 'manual'> = {
  ORDER: 'full',
  PRICE: 'full',
  STOCK: 'full',
  DELIVERY: 'full',
  PAYMENT: 'full',
  DEPOSIT: 'full',
  RETURN: 'partial',     // 접수 응답만 자동, 결정은 사장님
  COMPLAINT: 'partial',  // 사과 응답만 자동, 처리는 사장님
  RESTOCK: 'full',
  RECOMMEND: 'full',
  INFO: 'full',
  GENERAL: 'full',
}

// 항상 사장님 알림이 필요한 의도
export const INTENT_ALWAYS_ESCALATE: Record<Intent, boolean> = {
  ORDER: false,
  PRICE: false,
  STOCK: false,
  DELIVERY: false,
  PAYMENT: false,
  DEPOSIT: false,
  RETURN: true,
  COMPLAINT: true,
  RESTOCK: false,
  RECOMMEND: false,
  INFO: false,
  GENERAL: false,
}

export function isValidIntent(v: unknown): v is Intent {
  return typeof v === 'string' && (INTENTS as readonly string[]).includes(v)
}
