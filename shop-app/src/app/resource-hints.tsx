'use client'

import ReactDOM from 'react-dom'

/**
 * ResourceHints Component
 * Next.js App Router에서 preconnect/dns-prefetch를 올바르게 추가하기 위한 컴포넌트
 * ReactDOM 헬퍼 함수를 사용하여 리소스 힌트 적용
 */
export function ResourceHints() {
  // CDN 연결 최적화
  ReactDOM.preconnect('https://cdn.jsdelivr.net', { crossOrigin: 'anonymous' })
  ReactDOM.prefetchDNS('https://cdn.jsdelivr.net')

  // AWS S3 이미지용
  ReactDOM.prefetchDNS('https://s3.amazonaws.com')

  return null
}
