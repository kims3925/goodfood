'use client'

/**
 * 어드민 — 오픈 API 클라이언트 관리 (placeholder)
 *
 * ApiClient 발급 / 관리 (B2B 판매자용 오픈 API 키).
 * 본구현은 BandAuto_B2B공급몰전환_VSCode_작업지침서 Phase 4 일정에 따른다.
 * 그 전까지 메뉴 404 방지를 위한 준비 중 페이지.
 */

import { KeyRound } from 'lucide-react'

export default function AdminOpenApiClientsPage() {
  return (
    <div className="max-w-3xl mx-auto mt-16 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-indigo-50 mb-4">
        <KeyRound className="w-7 h-7 text-indigo-500" />
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">API 클라이언트</h1>
      <p className="text-sm text-gray-500 mb-1">
        B2B 판매자용 오픈 API 클라이언트 키를 발급하고 관리하는 기능입니다.
      </p>
      <p className="text-sm text-gray-400">
        준비 중입니다 — B2B 공급몰 전환 Phase 4에서 제공됩니다.
      </p>
    </div>
  )
}
