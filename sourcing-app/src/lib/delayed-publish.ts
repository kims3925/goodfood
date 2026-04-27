/**
 * 발행 지연 헬퍼 (클라이언트 측)
 *
 * 가공상품 자동발행 / 재발행 모달에서 "(N)분 후 자동발행" 입력을 처리하기 위한
 * 공통 로직.
 *
 * 동작 모델:
 *  - delayMinutes <= 0  → 즉시 실행 (기존 흐름과 동일)
 *  - delayMinutes >  0  → setTimeout 으로 지연 + localStorage 에 마커 저장
 *    (페이지 새로고침/돌아왔을 때 복구를 위함, 탭 닫으면 손실)
 *
 * 한계:
 *  - 탭이 닫히면 타이머 취소 (서버 측 영속화 미구현)
 *  - 다음 페이지로 이동하면 같은 타이머는 종료되지만 localStorage 마커가 있으면
 *    새 페이지에서 재개 가능
 *
 * 용어:
 *  - jobKey: 호출 측이 부여하는 고유 키 (예: 'auto-publish' / 'republish')
 *  - jobLabel: 사용자에게 표시할 라벨 (예: '자동발행' / '재발행')
 */

const STORAGE_KEY = 'bandauto.delayedPublish.v1'

export interface DelayedJobMarker {
  jobKey: string
  jobLabel: string
  scheduledAt: number  // epoch ms
  payloadSummary?: string  // 사용자 표시용 (예: "10개 상품 / 5개 채널")
}

/** localStorage 의 모든 활성 마커 읽기 (만료된 건 자동 정리) */
export function readActiveMarkers(): DelayedJobMarker[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as DelayedJobMarker[]
    const now = Date.now()
    // scheduledAt 이 1시간 이상 지난 마커는 stale 로 간주해 제거
    const valid = arr.filter((m) => m && m.scheduledAt > now - 60 * 60 * 1000)
    if (valid.length !== arr.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid))
    }
    return valid
  } catch {
    return []
  }
}

/** 마커 저장 (jobKey 가 같은 기존 마커는 덮어씀) */
export function writeMarker(marker: DelayedJobMarker): void {
  if (typeof window === 'undefined') return
  const cur = readActiveMarkers().filter((m) => m.jobKey !== marker.jobKey)
  cur.push(marker)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cur))
}

/** 특정 jobKey 마커 제거 */
export function clearMarker(jobKey: string): void {
  if (typeof window === 'undefined') return
  const cur = readActiveMarkers().filter((m) => m.jobKey !== jobKey)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cur))
}

/**
 * 지연 발행 스케줄러.
 * @param delayMinutes 분 단위 지연. 0 이하면 즉시 실행.
 * @param run 실제 발행 작업 (Promise 반환)
 * @param marker 페이지 새로고침 복구용 마커 (옵션)
 * @returns cancel 함수. 호출하면 예약된 발행을 취소.
 */
export function scheduleDelayedPublish(
  delayMinutes: number,
  run: () => Promise<void> | void,
  marker?: Omit<DelayedJobMarker, 'scheduledAt'>
): () => void {
  if (delayMinutes <= 0) {
    void run()
    return () => {}
  }

  const delayMs = delayMinutes * 60 * 1000
  const scheduledAt = Date.now() + delayMs

  if (marker) writeMarker({ ...marker, scheduledAt })

  const timerId = window.setTimeout(async () => {
    if (marker) clearMarker(marker.jobKey)
    try {
      await run()
    } catch (err) {
      console.error('[delayed-publish] 실행 실패', err)
    }
  }, delayMs)

  return () => {
    window.clearTimeout(timerId)
    if (marker) clearMarker(marker.jobKey)
  }
}

/** 표시용 시간 포맷터 (예: "오후 3시 25분") */
export function formatScheduledTime(scheduledAt: number): string {
  const d = new Date(scheduledAt)
  const h = d.getHours()
  const m = d.getMinutes()
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${ampm} ${h12}시 ${String(m).padStart(2, '0')}분`
}
