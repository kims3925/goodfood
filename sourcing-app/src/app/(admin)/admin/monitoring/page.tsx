'use client'

/**
 * 어드민 — 소스 모니터링 (placeholder)
 *
 * 품절 / 가격변동 / 중복 후보 모니터링 테이블 (SourceSnapshot / PriceHistory / ProductDuplicate).
 * 본구현은 BandAuto_B2B공급몰전환_VSCode_작업지침서 Phase 2 일정에 따른다.
 * 그 전까지 메뉴 404 방지를 위한 준비 중 페이지.
 */

import { Radio } from 'lucide-react'

export default function AdminMonitoringPage() {
  return (
    <div className="max-w-3xl mx-auto mt-16 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-indigo-50 mb-4">
        <Radio className="w-7 h-7 text-indigo-500" />
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">소스 모니터링</h1>
      <p className="text-sm text-gray-500 mb-1">
        도매 소싱처의 품절 · 가격변동 · 중복 후보를 한눈에 모니터링하는 기능입니다.
      </p>
      <p className="text-sm text-gray-400">
        준비 중입니다 — B2B 공급몰 전환 Phase 2에서 제공됩니다.
      </p>
    </div>
  )
}
