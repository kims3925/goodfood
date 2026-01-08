'use client'

import { X, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react'
import Link from 'next/link'

interface InvalidChannel {
  id: number
  name: string
  kind: 'WHOLESALE' | 'RETAIL'
  hasSession: boolean
  isExpired: boolean
}

interface SessionMissingModalProps {
  isOpen: boolean
  onClose: () => void
  invalidChannels: InvalidChannel[]
  onRetry?: () => void
  isValidating?: boolean
}

export default function SessionMissingModal({
  isOpen,
  onClose,
  invalidChannels,
  onRetry,
  isValidating,
}: SessionMissingModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
        {/* 헤더 */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900">밴드 세션이 필요합니다</h3>
              <p className="text-sm text-gray-500 mt-1">
                자동화를 실행하려면 아래 채널의 밴드 세션을 먼저 저장해주세요.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* 세션 없는 채널 목록 (소매채널만 표시 - 발행 시 필요) */}
        <div className="p-6 border-b border-gray-100 max-h-80 overflow-y-auto">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              소매 채널 ({invalidChannels.length}개)
            </h4>
            <div className="space-y-2">
              {invalidChannels.map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center justify-between p-3 bg-green-50 rounded-lg"
                >
                  <span className="text-sm font-medium text-gray-900">{channel.name}</span>
                  <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full">
                    {channel.hasSession ? '세션 만료' : '세션 없음'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 안내 메시지 */}
        <div className="p-6 border-b border-gray-100">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h4 className="text-sm font-medium text-amber-800 mb-2">세션 저장 방법</h4>
            <ol className="text-sm text-amber-700 space-y-1 list-decimal list-inside">
              <li>Band Session Helper 확장을 설치합니다</li>
              <li>Band 웹사이트에 로그인합니다</li>
              <li>확장을 클릭하여 세션을 저장합니다</li>
            </ol>
          </div>
        </div>

        {/* 버튼 */}
        <div className="p-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors"
          >
            닫기
          </button>
          {onRetry && (
            <button
              onClick={onRetry}
              disabled={isValidating}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isValidating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  확인 중...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  다시 확인
                </>
              )}
            </button>
          )}
          <Link
            href="/sourcing/channel"
            className="flex-1 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            채널 관리
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
