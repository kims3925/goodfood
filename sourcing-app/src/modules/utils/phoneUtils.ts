/**
 * 전화번호를 xxx-xxxx-xxxx 형식으로 포맷팅합니다.
 * @param phone 전화번호 (숫자만 또는 하이픈 포함)
 * @returns 포맷팅된 전화번호 또는 원본 (포맷팅 불가 시)
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '-'

  // 숫자만 추출
  const digits = phone.replace(/\D/g, '')

  // 휴대폰 번호 (010, 011, 016, 017, 018, 019)
  if (digits.length === 11 && digits.startsWith('01')) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }

  // 휴대폰 번호 (구형 10자리: 011-xxx-xxxx)
  if (digits.length === 10 && digits.startsWith('01')) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  // 서울 지역번호 (02)
  if (digits.startsWith('02')) {
    if (digits.length === 9) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`
    }
    if (digits.length === 10) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
    }
  }

  // 기타 지역번호 (031, 032, 033 등)
  if (digits.length === 10 && digits.startsWith('0')) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }

  // 포맷팅 불가능한 경우 원본 반환
  return phone
}
