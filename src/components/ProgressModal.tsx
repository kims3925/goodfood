'use client'

import { useState, useEffect } from 'react'
import { X, Package, Bot, Database, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react'

interface ProgressDetails {
  collected: number
  processing: number
  completed: number
  total: number
  currentAction: string
  timeElapsed: number
  estimatedTimeRemaining: number | null
}

interface ProgressData {
  type: 'init' | 'stage' | 'progress' | 'complete' | 'error'
  message: string
  progress: number
  stage: string
  details: ProgressDetails
  error?: string
  summary?: {
    totalFound: number
    newPosts: number
    aiAnalyzed: number
    commentsCollected: number
    totalTime: number
    averageTimePerPost: number
    processingMethod: string
  }
}

interface ProgressModalProps {
  isOpen: boolean
  onClose: () => void
  bandId: string | null
  bandName: string
  dateRange?: { startDate: string; endDate: string }
  onComplete?: (summary: any) => void
  bulkMode?: {
    currentIndex: number
    totalBands: number
    currentBandName: string
  }
}

interface CompletionSummaryModalProps {
  isOpen: boolean
  onClose: () => void
  startTime: Date
  endTime: Date
  summary: any
  bandName: string
}

// 완료 요약 모달 컴포넌트
function CompletionSummaryModal({ 
  isOpen, 
  onClose, 
  startTime, 
  endTime, 
  summary, 
  bandName 
}: CompletionSummaryModalProps) {
  if (!isOpen || !summary) return null

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const totalTime = endTime.getTime() - startTime.getTime()
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    
    if (minutes > 0) {
      return `${minutes}분 ${remainingSeconds}초`
    } else {
      return `${remainingSeconds}초`
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-green-50 rounded-t-lg">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div>
              <h2 className="text-xl font-semibold text-green-800">수집 완료!</h2>
              <p className="text-sm text-green-600">{bandName}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {/* 시간 정보 */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">처리 시간</h3>
            <div className="space-y-3 bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">시작 시간:</span>
                <span className="font-medium text-gray-900">{formatDateTime(startTime)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">완료 시간:</span>
                <span className="font-medium text-gray-900">{formatDateTime(endTime)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-gray-200 pt-3">
                <span className="text-sm font-medium text-gray-700">총 소요 시간:</span>
                <span className="font-bold text-green-600 text-lg">{formatDuration(totalTime)}</span>
              </div>
            </div>
          </div>

          {/* 수집 결과 */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">수집 결과</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{summary.totalFound}</div>
                <div className="text-xs text-blue-700">발견한 게시물</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{summary.newPosts}</div>
                <div className="text-xs text-green-700">새로운 게시물</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-purple-600">{summary.aiAnalyzed}</div>
                <div className="text-xs text-purple-700">AI 분석 완료</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-600">{summary.commentsCollected}</div>
                <div className="text-xs text-orange-700">댓글 수집</div>
              </div>
            </div>
          </div>

          {/* 성능 정보 */}
          {summary.newPosts > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">성능 정보</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">평균 처리 시간:</span>
                  <span className="font-medium">{(totalTime / summary.newPosts).toFixed(1)}ms/개</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">처리량:</span>
                  <span className="font-medium">{(summary.newPosts / (totalTime / 1000)).toFixed(2)} 상품/초</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">처리 방식:</span>
                  <span className="font-medium text-purple-600">{summary.processingMethod}</span>
                </div>
              </div>
            </div>
          )}

          {/* 메시지 */}
          <div className="text-center text-sm text-gray-600 mb-4">
            수집된 상품은 <strong>도매 수집 페이지</strong>에서 확인하고 소싱을 진행하세요.
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-green-500 hover:bg-green-600 text-white text-base font-medium rounded-md transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle className="h-5 w-5" />
            확인
          </button>
        </div>
      </div>
    </div>
  )
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
  const [progress, setProgress] = useState<ProgressData>({
    type: 'init',
    message: '준비 중...',
    progress: 0,
    stage: 'preparing',
    details: {
      collected: 0,
      processing: 0,
      completed: 0,
      total: 0,
      currentAction: '초기화 중...',
      timeElapsed: 0,
      estimatedTimeRemaining: null
    }
  })
  const [isConnected, setIsConnected] = useState(false)
  const [eventSource, setEventSource] = useState<EventSource | null>(null)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [collectionStartTime, setCollectionStartTime] = useState<Date | null>(null)
  const [collectionEndTime, setCollectionEndTime] = useState<Date | null>(null)
  const [finalSummary, setFinalSummary] = useState<any>(null)

  const formatTime = (ms: number): string => {
    if (!ms || ms <= 0) return '계산 중...'
    
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}시간 ${minutes % 60}분 ${seconds % 60}초`
    } else if (minutes > 0) {
      return `${minutes}분 ${seconds % 60}초`
    } else {
      return `${seconds}초`
    }
  }

  const getStageInfo = (stage: string) => {
    switch (stage) {
      case 'preparing':
      case 'initializing':
        return {
          icon: <Loader2 className="h-5 w-5 animate-spin text-blue-600" />,
          title: '준비 단계',
          description: '수집 준비 및 밴드 정보 확인'
        }
      case 'collecting':
        return {
          icon: <Package className="h-5 w-5 text-green-600" />,
          title: '게시물 수집',
          description: '밴드에서 게시물을 가져오는 중'
        }
      case 'filtering':
        return {
          icon: <CheckCircle className="h-5 w-5 text-orange-600" />,
          title: '중복 확인',
          description: '새로운 게시물 필터링'
        }
      case 'ai_analyzing':
        return {
          icon: <Bot className="h-5 w-5 text-purple-600" />,
          title: 'AI 분석',
          description: '상품 정보 자동 분석 및 개선'
        }
      case 'saving':
        return {
          icon: <Database className="h-5 w-5 text-indigo-600" />,
          title: '데이터 저장',
          description: '분석 결과를 데이터베이스에 저장'
        }
      case 'completed':
        return {
          icon: <CheckCircle className="h-5 w-5 text-green-600" />,
          title: '완료',
          description: '모든 작업이 완료되었습니다'
        }
      case 'error':
        return {
          icon: <AlertCircle className="h-5 w-5 text-red-600" />,
          title: '오류 발생',
          description: '작업 중 문제가 발생했습니다'
        }
      default:
        return {
          icon: <Loader2 className="h-5 w-5 animate-spin text-gray-600" />,
          title: '진행 중',
          description: '작업을 수행하고 있습니다'
        }
    }
  }

  const startCollection = async () => {
    if (!bandId) return

    // 수집 시작 시간 기록
    const startTime = new Date()
    setCollectionStartTime(startTime)

    try {
      // EventSource 설정
      const requestBody: any = { bandId }
      if (dateRange?.startDate && dateRange?.endDate) {
        requestBody.dateRange = dateRange
      }

      const url = new URL('/api/wholesale/collect/progress', window.location.origin)
      const es = new EventSource(`${url.toString()}?data=${encodeURIComponent(JSON.stringify(requestBody))}`)
      
      es.onopen = () => {
        setIsConnected(true)
        console.log('실시간 진행상황 연결 성공')
      }

      es.onmessage = (event) => {
        try {
          const data: ProgressData = JSON.parse(event.data)
          setProgress(data)

          if (data.type === 'complete') {
            // 수집 완료 시간 기록
            const endTime = new Date()
            setCollectionEndTime(endTime)
            setFinalSummary(data.summary)
            
            setTimeout(() => {
              es.close()
              
              // bulk 모드인 경우 완료 모달 건너뛰고 바로 onComplete 실행
              if (bulkMode && onComplete && data.summary) {
                // 다음 밴드로 자동 진행
                onComplete(data.summary)
                onClose() // 프로그레스 모달도 닫기
              } else {
                // 개별 수집 모드인 경우에만 완료 모달 표시
                setShowCompletionModal(true)
              }
            }, 1000)
          } else if (data.type === 'error') {
            setTimeout(() => {
              es.close()
              
              // bulk 모드인 경우 에러 발생 시에도 다음 밴드로 자동 진행
              if (bulkMode && onComplete) {
                // 에러 발생 시 빈 요약으로 다음 밴드 진행
                onComplete({
                  totalFound: 0,
                  newPosts: 0,
                  aiAnalyzed: 0,
                  commentsCollected: 0,
                  error: data.error || '수집 중 오류 발생'
                })
                onClose() // 프로그레스 모달도 닫기
              }
            }, 3000) // 에러 메시지를 3초간 보여준 후 진행
          }
        } catch (error) {
          console.error('SSE 데이터 파싱 오류:', error)
        }
      }

      es.onerror = (error) => {
        console.info('실시간 연결 실패, 폴백 모드로 전환됩니다')
        setIsConnected(false)

        // Show user-friendly message
        setProgress(prev => ({
          ...prev,
          message: '폴백 모드로 전환됩니다 (정상 동작)'
        }))

        // Fallback to regular API
        fallbackToRegularAPI()
      }

      setEventSource(es)

    } catch (error) {
      console.error('수집 시작 오류:', error)
      fallbackToRegularAPI()
    }
  }

  const fallbackToRegularAPI = async () => {
    if (!bandId) return

    try {
      const requestBody: any = { bandId }
      if (dateRange?.startDate && dateRange?.endDate) {
        requestBody.dateRange = dateRange
      }

      const response = await fetch('/api/wholesale/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()
      
      if (data.success) {
        setProgress({
          type: 'complete',
          message: '수집 완료!',
          progress: 100,
          stage: 'completed',
          details: {
            collected: data.totalFound,
            processing: 0,
            completed: data.newPosts,
            total: data.newPosts,
            currentAction: '완료',
            timeElapsed: 0,
            estimatedTimeRemaining: 0
          },
          summary: {
            totalFound: data.totalFound,
            newPosts: data.newPosts,
            aiAnalyzed: data.aiAnalyzed,
            commentsCollected: data.commentsCollected,
            totalTime: 0,
            averageTimePerPost: 0,
            processingMethod: data.processingMethod
          }
        })
        
        // 수집 완료 시간 기록 및 완료 모달 표시
        const endTime = new Date()
        setCollectionEndTime(endTime)
        setFinalSummary(data)
        
        setTimeout(() => {
          setShowCompletionModal(true)
        }, 1000)
      } else {
        // 할당량 초과 등 특수 에러 처리
        const errorMessage = data.errorType === 'quota_exceeded' 
          ? `Band API 할당량 초과\n${data.retryAfter}에 다시 시도해주세요.`
          : data.error
        throw new Error(errorMessage)
      }
    } catch (error) {
      setProgress({
        type: 'error',
        message: '수집 중 오류가 발생했습니다.',
        progress: 0,
        stage: 'error',
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        details: {
          collected: 0,
          processing: 0,
          completed: 0,
          total: 0,
          currentAction: '오류 발생',
          timeElapsed: 0,
          estimatedTimeRemaining: null
        }
      })
    }
  }

  useEffect(() => {
    if (isOpen && bandId) {
      startCollection()
    }

    return () => {
      if (eventSource) {
        eventSource.close()
        setEventSource(null)
      }
    }
  }, [isOpen, bandId])

  const handleClose = () => {
    if (eventSource) {
      eventSource.close()
      setEventSource(null)
    }
    setIsConnected(false)
    onClose()
  }

  const handleCompletionModalClose = () => {
    setShowCompletionModal(false)
    setCollectionStartTime(null)
    setCollectionEndTime(null)
    setFinalSummary(null)
    
    // 완료 모달을 닫은 후 기본 onComplete 콜백 실행
    if (finalSummary && onComplete) {
      onComplete(finalSummary)
    }
    
    onClose()
  }

  if (!isOpen) return null

  const stageInfo = getStageInfo(progress.stage)
  const canClose = progress.type === 'complete' || progress.type === 'error'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            {bulkMode ? (
              <>
                <h2 className="text-xl font-semibold text-gray-900">
                  전체 상품 수집 진행 중
                  <span className="ml-3 text-base font-normal text-purple-600">
                    ({bulkMode.currentIndex}/{bulkMode.totalBands})
                  </span>
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  현재 수집 중: <span className="font-medium text-gray-900">{bulkMode.currentBandName}</span>
                </p>
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(bulkMode.currentIndex / bulkMode.totalBands) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    전체 진행: {bulkMode.currentIndex}/{bulkMode.totalBands} 소싱처 완료
                  </p>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-gray-900">상품 수집 진행 상황</h2>
                <p className="text-sm text-gray-600 mt-1">{bandName}</p>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {progress.type !== 'complete' && progress.type !== 'error' && (
              <button
                onClick={() => {
                  const confirmMessage = bulkMode 
                    ? `전체 수집을 중지하시겠습니까?\n현재 진행: ${bulkMode.currentIndex}/${bulkMode.totalBands}\n진행중인 작업이 모두 취소됩니다.`
                    : '수집을 중지하시겠습니까? 진행중인 작업이 취소됩니다.'
                  
                  if (confirm(confirmMessage)) {
                    handleClose()
                  }
                }}
                className="px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors flex items-center gap-1"
              >
                <X className="h-4 w-4" />
                {bulkMode ? '전체 수집 취소' : '취소'}
              </button>
            )}
            {canClose && (
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title={bulkMode ? "전체 수집 종료" : "닫기"}
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Progress Content */}
        <div className="px-6 py-6">
          {/* Current Stage */}
          <div className="flex items-center gap-4 mb-6">
            {stageInfo.icon}
            <div>
              <h3 className="font-medium text-gray-900">{stageInfo.title}</h3>
              <p className="text-sm text-gray-600">{stageInfo.description}</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">전체 진행률</span>
              <span className="text-sm text-gray-600">{Math.round(progress.progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
          </div>

          {/* Current Action */}
          <div className="mb-6">
            <p className="text-sm text-gray-700 mb-2">현재 작업:</p>
            <p className="text-base font-medium text-gray-900">{progress.details?.currentAction || '처리 중...'}</p>
          </div>

          {/* Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-blue-600">{progress.details?.collected || 0}</div>
              <div className="text-xs text-blue-700">수집됨</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-orange-600">{progress.details?.processing || 0}</div>
              <div className="text-xs text-orange-700">처리 중</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-600">{progress.details?.completed || 0}</div>
              <div className="text-xs text-green-700">완료됨</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-purple-600">{progress.details?.total || 0}</div>
              <div className="text-xs text-purple-700">총 대상</div>
            </div>
          </div>

          {/* Time Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">경과 시간</span>
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {formatTime(progress.details?.timeElapsed || 0)}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">예상 남은 시간</span>
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {progress.details?.estimatedTimeRemaining
                  ? formatTime(progress.details.estimatedTimeRemaining)
                  : '계산 중...'
                }
              </div>
            </div>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-blue-500'}`} />
            {isConnected ? '⚡ 실시간 연결됨' : '🔄 폴백 모드 (정상 동작)'}
          </div>

          {/* Error Message */}
          {progress.type === 'error' && progress.error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-red-800">오류 발생</span>
              </div>
              <p className="text-sm text-red-700 mb-3">{progress.error}</p>
              
              {/* Playwright 대안 버튼 (Band API 관련 오류 시에만 표시) */}
              {(progress.error?.includes('Band API') || progress.error?.includes('할당량') || progress.error?.includes('토큰')) && (
                <div className="border-t border-red-200 pt-3">
                  <p className="text-xs text-red-600 mb-3">
                    🤖 Playwright를 사용하여 브라우저 자동화로 수집을 계속 진행할 수 있습니다
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        try {
                          setProgress({
                            type: 'stage',
                            message: 'Playwright 수집 시작...',
                            progress: 10,
                            stage: 'preparing',
                            details: {
                              collected: 0,
                              processing: 0,
                              completed: 0,
                              total: 0,
                              currentAction: 'Playwright 브라우저 준비 중...',
                              timeElapsed: 0,
                              estimatedTimeRemaining: null
                            }
                          })

                          // Playwright 수집 API 호출
                          const response = await fetch('/api/wholesale/collect-playwright', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                              bandId,
                              dateRange: dateRange || undefined
                            })
                          })
                          
                          const data = await response.json()
                          
                          if (data.success) {
                            setProgress({
                              type: 'complete',
                              message: 'Playwright 수집 완료!',
                              progress: 100,
                              stage: 'completed',
                              details: {
                                collected: data.totalFound || 0,
                                processing: 0,
                                completed: data.newPosts || 0,
                                total: data.totalFound || 0,
                                currentAction: '완료',
                                timeElapsed: 0,
                                estimatedTimeRemaining: 0
                              },
                              summary: {
                                totalFound: data.totalFound || 0,
                                newPosts: data.newPosts || 0,
                                aiAnalyzed: data.aiAnalyzed || 0,
                                commentsCollected: data.commentsCollected || 0,
                                totalTime: 0,
                                averageTimePerPost: 0,
                                processingMethod: 'Playwright 브라우저 자동화'
                              }
                            })
                            
                            if (onComplete) {
                              onComplete(data)
                            }
                          } else {
                            throw new Error(data.error || 'Playwright 수집 실패')
                          }
                        } catch (playwrightError) {
                          setProgress({
                            type: 'error',
                            message: 'Playwright 수집 중 오류가 발생했습니다.',
                            progress: 0,
                            stage: 'error',
                            error: playwrightError instanceof Error ? playwrightError.message : '알 수 없는 오류',
                            details: {
                              collected: 0,
                              processing: 0,
                              completed: 0,
                              total: 0,
                              currentAction: '오류 발생',
                              timeElapsed: 0,
                              estimatedTimeRemaining: null
                            }
                          })
                        }
                      }}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-md transition-colors flex items-center gap-2"
                    >
                      🤖 Playwright로 수집
                    </button>
                    <button
                      onClick={handleClose}
                      className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 text-sm rounded-md transition-colors"
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Success Summary */}
          {progress.type === 'complete' && progress.summary && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-800">수집 완료!</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-green-700">발견한 게시물:</span>
                  <span className="font-medium text-green-900 ml-2">{progress.summary.totalFound}개</span>
                </div>
                <div>
                  <span className="text-green-700">새로운 게시물:</span>
                  <span className="font-medium text-green-900 ml-2">{progress.summary.newPosts}개</span>
                </div>
                <div>
                  <span className="text-green-700">AI 분석 완료:</span>
                  <span className="font-medium text-green-900 ml-2">{progress.summary.aiAnalyzed}개</span>
                </div>
                <div>
                  <span className="text-green-700">댓글 수집:</span>
                  <span className="font-medium text-green-900 ml-2">{progress.summary.commentsCollected}개</span>
                </div>
              </div>
              <div className="mt-3 text-xs text-green-700">
                처리 방식: {progress.summary.processingMethod}
              </div>
              {progress.summary.totalTime > 0 && (
                <div className="text-xs text-green-700">
                  총 소요시간: {formatTime(progress.summary.totalTime)}
                  {progress.summary.newPosts > 0 && (
                    <span className="ml-2">
                      (평균 {formatTime(progress.summary.averageTimePerPost)}/개)
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Message */}
          <div className="text-center">
            <p className="text-sm text-gray-600">{progress.message}</p>
            {!canClose && (
              <p className="text-xs text-gray-500 mt-2">
                브라우저를 닫지 마세요. AI 분석으로 인해 시간이 오래 걸릴 수 있습니다.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        {canClose && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
            <button
              onClick={handleClose}
              className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-md transition-colors"
            >
              {progress.type === 'complete' ? '완료' : '닫기'}
            </button>
          </div>
        )}
      </div>

      {/* 완료 요약 모달 */}
      {showCompletionModal && collectionStartTime && collectionEndTime && finalSummary && (
        <CompletionSummaryModal
          isOpen={showCompletionModal}
          onClose={handleCompletionModalClose}
          startTime={collectionStartTime}
          endTime={collectionEndTime}
          summary={finalSummary}
          bandName={bandName}
        />
      )}
    </div>
  )
}