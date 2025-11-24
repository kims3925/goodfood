'use client'

import { useState, useEffect } from 'react'
import { X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

interface ProgressModalProps {
  isOpen: boolean
  onClose: () => void
  bandId: string
  bandName: string
  dateRange?: {
    startDate: string
    endDate: string
  }
  onComplete?: (result: any) => void
  bulkMode?: {
    currentIndex: number
    totalBands: number
    currentBandName: string
  }
}

interface CollectionResult {
  success: boolean
  totalFound: number
  newPosts: number
  errors?: string[]
  message?: string
}

export default function ProgressModal({
  isOpen,
  onClose,
  bandId,
  bandName,
  dateRange,
  onComplete,
  bulkMode
}: ProgressModalProps) {
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<'collecting' | 'success' | 'error'>('collecting')
  const [result, setResult] = useState<CollectionResult | null>(null)
  const [currentStep, setCurrentStep] = useState('준비 중...')

  useEffect(() => {
    if (isOpen) {
      startCollection()
    }
  }, [isOpen, bandId])

  const startCollection = async () => {
    setProgress(0)
    setStatus('collecting')
    setCurrentStep('밴드 수집 시작...')

    try {
      // Step 1: 수집 시작
      setProgress(20)
      setCurrentStep('밴드 데이터 가져오는 중...')

      const params = new URLSearchParams({
        bandId,
        ...(dateRange?.startDate && { startDate: dateRange.startDate }),
        ...(dateRange?.endDate && { endDate: dateRange.endDate })
      })

      const response = await fetch(`/api/band/collect?${params}`, {
        method: 'POST'
      })

      setProgress(60)
      setCurrentStep('데이터 처리 중...')

      if (!response.ok) {
        throw new Error('수집 실패')
      }

      const data = await response.json()

      setProgress(100)
      setCurrentStep('수집 완료!')
      setStatus('success')
      setResult(data)

      // 완료 후 콜백 호출
      if (onComplete) {
        setTimeout(() => {
          onComplete(data)
        }, 1500)
      }
    } catch (error) {
      setStatus('error')
      setCurrentStep('수집 중 오류가 발생했습니다.')
      setResult({
        success: false,
        totalFound: 0,
        newPosts: 0,
        message: error instanceof Error ? error.message : '알 수 없는 오류'
      })
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-divider">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">
              {bulkMode ? '전체 밴드 수집 진행 중' : '밴드 수집 진행 중'}
            </h3>
            <p className="text-sm text-text-secondary mt-1">
              {bulkMode
                ? `${bulkMode.currentIndex} / ${bulkMode.totalBands} - ${bulkMode.currentBandName}`
                : bandName
              }
            </p>
          </div>
          {status !== 'collecting' && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-surface rounded-md transition-colors"
            >
              <X size={20} className="text-text-secondary" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-text-secondary">{currentStep}</span>
              <span className="text-sm font-semibold text-text-primary">{progress}%</span>
            </div>
            <div className="w-full bg-surface rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  status === 'success' ? 'bg-success' :
                  status === 'error' ? 'bg-error' :
                  'bg-primary-color'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Status Icon */}
          <div className="flex flex-col items-center py-6">
            {status === 'collecting' && (
              <Loader2 size={48} className="text-primary-color animate-spin mb-3" />
            )}
            {status === 'success' && (
              <CheckCircle size={48} className="text-success mb-3" />
            )}
            {status === 'error' && (
              <AlertCircle size={48} className="text-error mb-3" />
            )}

            {/* Result */}
            {result && (
              <div className="text-center mt-4">
                {status === 'success' && (
                  <div className="space-y-2">
                    <p className="text-sm text-text-secondary">
                      총 <span className="font-semibold text-text-primary">{result.totalFound}</span>개 게시글 발견
                    </p>
                    <p className="text-sm text-text-secondary">
                      새 게시글 <span className="font-semibold text-success">{result.newPosts}</span>개 수집 완료
                    </p>
                  </div>
                )}
                {status === 'error' && (
                  <p className="text-sm text-error">{result.message}</p>
                )}
              </div>
            )}
          </div>

          {/* Bulk Mode Progress */}
          {bulkMode && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-800">
                전체 진행 상황: {bulkMode.currentIndex} / {bulkMode.totalBands} 밴드
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {status !== 'collecting' && (
          <div className="flex justify-end gap-2 p-6 border-t border-divider">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-primary-color text-white rounded-lg hover:bg-primary-hover transition-colors"
            >
              확인
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
