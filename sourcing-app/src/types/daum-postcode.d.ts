// Daum Postcode API Type Definitions
// https://postcode.map.daum.net/guide

interface DaumPostcodeData {
  // 우편번호
  zonecode: string

  // 기본 주소
  address: string           // 기본 주소 (검색 결과에서 첫줄에 , , , 나오는 주소)
  addressEnglish: string    // 기본 영문 주소
  addressType: 'R' | 'J'    // R: 도로명, J: 지번

  // 도로명 주소
  roadAddress: string       // 도로명 주소
  roadAddressEnglish: string

  // 지번 주소
  jibunAddress: string      // 지번 주소
  jibunAddressEnglish: string

  // 자동 완성 주소 (사용자가 '선택 안함' 클릭 시)
  autoRoadAddress: string
  autoRoadAddressEnglish: string
  autoJibunAddress: string
  autoJibunAddressEnglish: string

  // 사용자 선택 주소 타입
  userSelectedType: 'R' | 'J'

  // 법정동/행정동 정보
  bcode: string             // 법정동 코드
  bname: string             // 법정동명
  bname1: string            // 법정동명 첫번째 부분
  bname2: string            // 법정동명 두번째 부분
  bnameEnglish: string

  hname: string             // 행정동명

  // 시/도, 시/군/구
  sido: string              // 도/시 이름
  sidoEnglish: string
  sigungu: string           // 시/군/구 이름
  sigunguEnglish: string
  sigunguCode: string       // 시/군/구 코드

  // 도로명
  roadname: string          // 도로명
  roadnameCode: string      // 도로명 코드
  roadnameEnglish: string

  // 건물 정보
  buildingCode: string      // 건물 관리번호
  buildingName: string      // 건물명
  apartment: 'Y' | 'N'      // 공동주택 여부

  // 상세 정보
  query: string             // 사용자 검색어
  userLanguageType: 'K' | 'E'  // K: 한글, E: 영문

  // 지번
  jibunCode: string         // 지번 코드
}

interface DaumPostcodeOptions {
  oncomplete: (data: DaumPostcodeData) => void
  onclose?: (state: 'FORCE_CLOSE' | 'COMPLETE_CLOSE') => void
  onresize?: (size: { width: number; height: number }) => void
  onsearch?: (data: { q: string; count: number }) => void
  width?: number | string
  height?: number | string
  animation?: boolean
  focusInput?: boolean
  autoMapping?: boolean
  shorthand?: boolean
  pleaseReadGuide?: number
  pleaseReadGuideTimer?: number
  maxSuggestItems?: number
  showMoreHName?: boolean
  hideMapBtn?: boolean
  hideEngBtn?: boolean
  alwaysShowEngAddr?: boolean
  theme?: {
    bgColor?: string
    searchBgColor?: string
    contentBgColor?: string
    pageBgColor?: string
    textColor?: string
    queryTextColor?: string
    postcodeTextColor?: string
    emphTextColor?: string
    outlineColor?: string
  }
}

interface DaumPostcode {
  open: () => void
  embed: (element: HTMLElement, options?: { q?: string; autoClose?: boolean }) => void
}

interface DaumPostcodeConstructor {
  new (options: DaumPostcodeOptions): DaumPostcode
}

declare global {
  interface Window {
    daum: {
      Postcode: DaumPostcodeConstructor
    }
  }
}

export type { DaumPostcodeData, DaumPostcodeOptions, DaumPostcode }
