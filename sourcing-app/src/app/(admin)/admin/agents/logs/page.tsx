'use client'

/**
 * 어드민 — 에이전트 로그 (placeholder)
 *
 * 메뉴(/admin/agents/logs)는 구버전 사이드바부터 존재했으나 페이지 파일이
 * .gitignore 의 `logs` 패턴에 걸려 커밋되지 못하고 유실된 상태였다 (404).
 * 로그 데이터 API 는 동작 중 (GET /api/admin/agents/logs) — 조회 화면 본구현 전까지
 * 404 방지용 준비 중 페이지.
 */

import { History } from 'lucide-react'

export default function AdminAgentLogsPage() {
  return (
    <div className="max-w-3xl mx-auto mt-16 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-indigo-50 mb-4">
        <History className="w-7 h-7 text-indigo-500" />
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">에이전트 로그</h1>
      <p className="text-sm text-gray-500 mb-1">
        에이전트 실행 로그(DEBUG/INFO/WARN/ERROR/CRITICAL)를 조회하는 화면입니다.
      </p>
      <p className="text-sm text-gray-400">
        조회 화면 준비 중입니다 — 로그 API(GET /api/admin/agents/logs)는 동작 중이며,
        실시간 상태는 <a href="/admin/agents/monitor" className="text-indigo-500 underline">에이전트 모니터링</a>에서 확인할 수 있습니다.
      </p>
    </div>
  )
}
