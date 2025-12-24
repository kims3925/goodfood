'use client'

import { useState } from 'react'
import { AlertTriangle, X, Loader2 } from 'lucide-react'

interface DisableAutomationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (cancelPipeline: boolean) => void
  workflow: {
    id: number
    currentStage: string | null
    successCount: number
    totalItems: number
  }
  isLoading?: boolean
}

const STAGE_LABELS: Record<string, string> = {
  collection: '게시물 수집',
  transform: 'AI 변환',
  productCreate: '상품 생성',
  publish: '발행',
}

export default function DisableAutomationModal({
  isOpen,
  onClose,
  onConfirm,
  workflow,
  isLoading,
}: DisableAutomationModalProps) {
  const [selectedOption, setSelectedOption] = useState<'cancel' | 'continue'>('continue')

  if (!isOpen) return null

  const currentStageLabel = workflow.currentStage
    ? STAGE_LABELS[workflow.currentStage] || workflow.currentStage
    : '알 수 없음'

  const handleConfirm = () => {
    onConfirm(selectedOption === 'cancel')
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
        {/* 헤더 */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900">실행 중인 작업이 있습니다</h3>
              <p className="text-sm text-gray-500 mt-1">
                자동화를 비활성화하기 전에 현재 작업을 어떻게 처리할지 선택해주세요.
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

        {/* 현재 작업 정보 */}
        <div className="p-6 border-b border-gray-100">
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">현재 단계</span>
              <span className="text-sm font-medium text-gray-900">{currentStageLabel}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">처리 현황</span>
              <span className="text-sm font-medium text-gray-900">
                {workflow.successCount} / {workflow.totalItems || '?'}건 완료
              </span>
            </div>
          </div>
        </div>

        {/* 선택 옵션 */}
        <div className="p-6 space-y-3">
          <label
            className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
              selectedOption === 'cancel'
                ? 'border-red-500 bg-red-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name="disableOption"
              value="cancel"
              checked={selectedOption === 'cancel'}
              onChange={() => setSelectedOption('cancel')}
              className="mt-0.5 w-4 h-4 text-red-600 focus:ring-red-500"
            />
            <div>
              <span className="font-medium text-gray-900">작업 취소 후 비활성화</span>
              <p className="text-sm text-gray-500 mt-0.5">
                현재 진행 중인 작업을 즉시 중단하고 자동화를 비활성화합니다.
              </p>
            </div>
          </label>

          <label
            className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
              selectedOption === 'continue'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name="disableOption"
              value="continue"
              checked={selectedOption === 'continue'}
              onChange={() => setSelectedOption('continue')}
              className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="font-medium text-gray-900">완료 후 비활성화 (권장)</span>
              <p className="text-sm text-gray-500 mt-0.5">
                현재 작업은 끝까지 진행하고, 다음 예약된 실행만 취소합니다.
              </p>
            </div>
          </label>
        </div>

        {/* 버튼 */}
        <div className="p-6 pt-0 flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
              selectedOption === 'cancel'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                처리 중...
              </>
            ) : (
              '확인'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
