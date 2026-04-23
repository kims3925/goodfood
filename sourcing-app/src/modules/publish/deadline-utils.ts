/**
 * 도매방 주문 마감시간을 n분 앞당겨서 쇼핑몰(종합발행) 표시용 마감시간을 만듦.
 *
 * 지원 입력 형식:
 *   - "오후 3시", "오전 10시 30분"
 *   - "15:00", "10:30"
 *   - "3시", "15시 30분"
 *
 * 반환: 표준화된 한국어 시간 문자열 ("오후 2시 30분")
 * 파싱 실패 시 원본 문자열 그대로 반환.
 */

export interface ParsedTime {
  h: number // 0~23
  m: number // 0~59
}

export function parseKoreanTime(input: string | null | undefined): ParsedTime | null {
  if (!input) return null
  const s = input.trim()

  // "오전/오후 H시 [M분]"
  const ampm = s.match(/(오전|오후)\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/)
  if (ampm) {
    let h = parseInt(ampm[2], 10)
    const m = ampm[3] ? parseInt(ampm[3], 10) : 0
    if (ampm[1] === '오후' && h < 12) h += 12
    if (ampm[1] === '오전' && h === 12) h = 0
    return { h, m }
  }

  // "HH:MM" 또는 "H:MM"
  const hm = s.match(/^(\d{1,2}):(\d{2})$/)
  if (hm) {
    return { h: parseInt(hm[1], 10), m: parseInt(hm[2], 10) }
  }

  // "H시 [M분]" (오전/오후 생략)
  const plain = s.match(/(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/)
  if (plain) {
    return { h: parseInt(plain[1], 10), m: plain[2] ? parseInt(plain[2], 10) : 0 }
  }

  return null
}

export function formatKoreanTime(h: number, m: number): string {
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  if (m === 0) return `${ampm} ${h12}시`
  return `${ampm} ${h12}시 ${m.toString().padStart(2, '0')}분`
}

export function subtractMinutes(t: ParsedTime, minutes: number): ParsedTime {
  let total = t.h * 60 + t.m - minutes
  while (total < 0) total += 24 * 60
  return { h: Math.floor(total / 60) % 24, m: total % 60 }
}

/**
 * 도매 마감시간을 받아 쇼핑몰 주문 마감시간(기본 30분 앞) 문자열로 변환.
 * 파싱 실패 시 원본 그대로 반환.
 */
export function shiftDeadlineEarlier(
  rawDeadline: string | null | undefined,
  minutesEarlier: number = 30,
): string | null {
  if (!rawDeadline) return null
  const parsed = parseKoreanTime(rawDeadline)
  if (!parsed) return rawDeadline
  const shifted = subtractMinutes(parsed, minutesEarlier)
  return formatKoreanTime(shifted.h, shifted.m)
}
