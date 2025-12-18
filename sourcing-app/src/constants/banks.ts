// 한국 은행 목록 및 계좌번호 형식 정의

export interface BankInfo {
  code: string
  name: string
  format: string // 계좌번호 포맷 (X는 숫자)
  length: number // 총 자릿수 (하이픈 제외)
  placeholder: string // 입력 힌트
}

export const BANKS: BankInfo[] = [
  { code: 'KB', name: 'KB국민은행', format: 'XXXXXX-XX-XXXXXX', length: 14, placeholder: '123456-12-123456' },
  { code: 'SHINHAN', name: '신한은행', format: 'XXX-XXX-XXXXXX', length: 12, placeholder: '123-456-123456' },
  { code: 'WOORI', name: '우리은행', format: 'XXXX-XXX-XXXXXX', length: 13, placeholder: '1234-123-123456' },
  { code: 'HANA', name: '하나은행', format: 'XXX-XXXXXX-XXXXX', length: 14, placeholder: '123-123456-12345' },
  { code: 'NH', name: 'NH농협은행', format: 'XXX-XXXX-XXXX-XX', length: 13, placeholder: '123-1234-1234-12' },
  { code: 'IBK', name: 'IBK기업은행', format: 'XXX-XX-XXXXXX', length: 11, placeholder: '123-12-123456' },
  { code: 'SC', name: 'SC제일은행', format: 'XXX-XX-XXXXXX', length: 11, placeholder: '123-12-123456' },
  { code: 'CITI', name: '한국씨티은행', format: 'XXX-XXXXX-XXX-XX', length: 13, placeholder: '123-12345-123-12' },
  { code: 'KDB', name: '한국산업은행', format: 'XXX-XXXX-XXXX-XXX', length: 14, placeholder: '123-1234-1234-123' },
  { code: 'SH', name: 'Sh수협은행', format: 'XXXX-XXXX-XXXX', length: 12, placeholder: '1234-1234-1234' },
  { code: 'BUSAN', name: 'BNK부산은행', format: 'XXX-XXXX-XXXX-XX', length: 13, placeholder: '123-1234-1234-12' },
  { code: 'GYEONGNAM', name: 'BNK경남은행', format: 'XXX-XXXX-XXXX-XX', length: 13, placeholder: '123-1234-1234-12' },
  { code: 'DAEGU', name: 'iM뱅크(대구)', format: 'XXX-XX-XXXXXX-X', length: 12, placeholder: '123-12-123456-1' },
  { code: 'GWANGJU', name: '광주은행', format: 'XXXX-XXX-XXXXXX', length: 13, placeholder: '1234-123-123456' },
  { code: 'JEONBUK', name: 'JB전북은행', format: 'XXX-XX-XXXXXX', length: 11, placeholder: '123-12-123456' },
  { code: 'JEJU', name: '제주은행', format: 'XXX-XXX-XXXXXX', length: 12, placeholder: '123-123-123456' },
  { code: 'POST', name: '우체국예금', format: 'XXXXXX-XX-XXXXXX', length: 14, placeholder: '123456-12-123456' },
  { code: 'MG', name: '새마을금고', format: 'XXXXX-XX-XXXXXXX', length: 14, placeholder: '12345-12-1234567' },
  { code: 'CU', name: '신용협동조합', format: 'XXX-XXX-XXXXXX', length: 12, placeholder: '123-123-123456' },
  { code: 'KFCC', name: '산림조합', format: 'XXX-XX-XXXXXX', length: 11, placeholder: '123-12-123456' },
  { code: 'SAVINGS', name: '저축은행', format: 'XXX-XXXX-XXXXXX', length: 13, placeholder: '123-1234-123456' },
  { code: 'KAKAO', name: '카카오뱅크', format: 'XXXX-XX-XXXXXXX', length: 13, placeholder: '1234-12-1234567' },
  { code: 'KBANK', name: '케이뱅크', format: 'XXX-XXX-XXXXXX', length: 12, placeholder: '123-123-123456' },
  { code: 'TOSS', name: '토스뱅크', format: 'XXXX-XXXX-XXXX', length: 12, placeholder: '1234-1234-1234' },
]

// 은행 코드로 은행 정보 찾기
export const getBankByCode = (code: string): BankInfo | undefined => {
  return BANKS.find(bank => bank.code === code)
}

// 은행명으로 은행 정보 찾기
export const getBankByName = (name: string): BankInfo | undefined => {
  return BANKS.find(bank => bank.name === name)
}

// 계좌번호 포맷팅 함수
export const formatAccountNumber = (value: string, bankCode: string): string => {
  const bank = getBankByCode(bankCode)
  if (!bank) return value

  // 숫자만 추출
  const numbers = value.replace(/\D/g, '')

  // 포맷에 맞게 변환
  const format = bank.format
  let result = ''
  let numberIndex = 0

  for (let i = 0; i < format.length && numberIndex < numbers.length; i++) {
    if (format[i] === 'X') {
      result += numbers[numberIndex]
      numberIndex++
    } else {
      result += format[i]
      // 다음에 숫자가 있으면 하이픈 추가
      if (numberIndex < numbers.length) {
        // 이미 결과에 추가됨
      }
    }
  }

  return result
}

// 계좌번호에서 숫자만 추출
export const getAccountNumberDigits = (formattedValue: string): string => {
  return formattedValue.replace(/\D/g, '')
}

// 계좌번호 유효성 검사
export const validateAccountNumber = (value: string, bankCode: string): boolean => {
  const bank = getBankByCode(bankCode)
  if (!bank) return false

  const digits = getAccountNumberDigits(value)
  return digits.length === bank.length
}
