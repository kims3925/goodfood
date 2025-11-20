'use client'

import { useState } from 'react'
import { PlayCircle, PauseCircle, RefreshCw, Settings, CheckCircle, AlertCircle, ArrowRight, Zap } from 'lucide-react'

export default function WorkflowPage() {
  const [isRunning, setIsRunning] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [workflowProgress, setWorkflowProgress] = useState({
    collecting: { status: 'idle', count: 0 },
    aiProcessing: { status: 'idle', count: 0 },
    uploading: { status: 'idle', count: 0 },
    publishing: { status: 'idle', count: 0 },
  })

  const workflowSteps = [
    {
      id: 'collecting',
      name: '도매밴드 수집',
      description: '새로운 상품 게시물 수집',
      icon: '📦',
      duration: '2-5분',
    },
    {
      id: 'aiProcessing',
      name: 'AI 상세페이지 생성',
      description: 'AI를 통한 상품 설명 생성',
      icon: '🤖',
      duration: '5-10분',
    },
    {
      id: 'uploading',
      name: '스룩페이 업로드',
      description: '엑셀 생성 및 대량 업로드',
      icon: '📤',
      duration: '3-7분',
    },
    {
      id: 'publishing',
      name: '소매밴드 발행',
      description: '결제링크 포함 게시물 발행',
      icon: '📮',
      duration: '2-3분',
    },
  ]

  const workflowSettings = {
    autoRetry: true,
    maxRetries: 3,
    batchSize: 10,
    interval: 30, // minutes
    schedule: {
      enabled: true,
      times: ['09:00', '14:00', '19:00'],
    },
  }

  const handleStartWorkflow = () => {
    setIsRunning(true)
    setCurrentStep(0)
    
    // 시뮬레이션 - 실제로는 API 호출
    simulateWorkflow()
  }

  const simulateWorkflow = () => {
    // Step 1: Collecting
    setCurrentStep(0)
    setWorkflowProgress(prev => ({
      ...prev,
      collecting: { status: 'processing', count: 0 }
    }))

    setTimeout(() => {
      setWorkflowProgress(prev => ({
        ...prev,
        collecting: { status: 'completed', count: 15 }
      }))
      
      // Step 2: AI Processing
      setCurrentStep(1)
      setWorkflowProgress(prev => ({
        ...prev,
        aiProcessing: { status: 'processing', count: 0 }
      }))

      setTimeout(() => {
        setWorkflowProgress(prev => ({
          ...prev,
          aiProcessing: { status: 'completed', count: 12 }
        }))

        // Step 3: Uploading
        setCurrentStep(2)
        setWorkflowProgress(prev => ({
          ...prev,
          uploading: { status: 'processing', count: 0 }
        }))

        setTimeout(() => {
          setWorkflowProgress(prev => ({
            ...prev,
            uploading: { status: 'completed', count: 12 }
          }))

          // Step 4: Publishing
          setCurrentStep(3)
          setWorkflowProgress(prev => ({
            ...prev,
            publishing: { status: 'processing', count: 0 }
          }))

          setTimeout(() => {
            setWorkflowProgress(prev => ({
              ...prev,
              publishing: { status: 'completed', count: 10 }
            }))
            setIsRunning(false)
            setCurrentStep(-1)
          }, 3000)
        }, 5000)
      }, 7000)
    }, 4000)
  }

  const handleStopWorkflow = () => {
    setIsRunning(false)
    setCurrentStep(-1)
  }

  const getStepStatus = (stepIndex: number, stepId: string) => {
    if (!isRunning) return 'idle'
    if (stepIndex < currentStep) return 'completed'
    if (stepIndex === currentStep) return 'processing'
    return 'pending'
  }

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'processing':
        return <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
      case 'pending':
        return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Zap className="w-6 h-6 text-yellow-500" />
              자동화 워크플로우
            </h1>
            <p className="mt-2 text-gray-600">전체 프로세스를 자동으로 실행하고 모니터링합니다</p>
          </div>
          <div className="flex gap-3">
            {!isRunning ? (
              <button
                onClick={handleStartWorkflow}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <PlayCircle className="w-5 h-5" />
                워크플로우 시작
              </button>
            ) : (
              <button
                onClick={handleStopWorkflow}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <PauseCircle className="w-5 h-5" />
                중지
              </button>
            )}
            <button className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
              <Settings className="w-5 h-5" />
              설정
            </button>
          </div>
        </div>
      </div>

      {/* Workflow Status */}
      {isRunning && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
            <div>
              <p className="font-semibold text-blue-900">워크플로우 실행 중</p>
              <p className="text-sm text-blue-700 mt-1">
                현재 단계: {currentStep >= 0 ? workflowSteps[currentStep]?.name : '완료'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Steps */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-6">워크플로우 단계</h2>
        <div className="relative">
          {/* Progress Line */}
          <div className="absolute top-8 left-8 right-8 h-0.5 bg-gray-200">
            <div
              className="h-full bg-green-600 transition-all duration-500"
              style={{ width: `${(currentStep + 1) * 25}%` }}
            ></div>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-4 gap-4 relative">
            {workflowSteps.map((step, index) => {
              const status = getStepStatus(index, step.id)
              const progress = workflowProgress[step.id as keyof typeof workflowProgress]
              
              return (
                <div key={step.id} className="relative">
                  <div className={`p-4 rounded-lg border-2 transition-all ${
                    status === 'processing' 
                      ? 'border-blue-500 bg-blue-50 scale-105' 
                      : status === 'completed'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-white'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-2xl">{step.icon}</span>
                      {getStepStatusIcon(status)}
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">{step.name}</h3>
                    <p className="text-xs text-gray-600 mb-2">{step.description}</p>
                    <p className="text-xs text-gray-500">예상: {step.duration}</p>
                    
                    {progress.count > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-sm font-semibold text-gray-900">
                          처리: {progress.count}개
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {index < workflowSteps.length - 1 && (
                    <ArrowRight className="absolute -right-3 top-8 w-6 h-6 text-gray-400" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Settings & Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workflow Settings */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            워크플로우 설정
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">자동 재시도</span>
              <span className={`px-2 py-1 text-xs font-medium rounded ${
                workflowSettings.autoRetry ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
              }`}>
                {workflowSettings.autoRetry ? '활성' : '비활성'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">최대 재시도 횟수</span>
              <span className="font-medium">{workflowSettings.maxRetries}회</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">배치 크기</span>
              <span className="font-medium">{workflowSettings.batchSize}개</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">실행 간격</span>
              <span className="font-medium">{workflowSettings.interval}분</span>
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            스케줄 설정
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-700">자동 실행</span>
              <span className={`px-2 py-1 text-xs font-medium rounded ${
                workflowSettings.schedule.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
              }`}>
                {workflowSettings.schedule.enabled ? '활성' : '비활성'}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-700 mb-2">실행 시간</p>
              <div className="space-y-2">
                {workflowSettings.schedule.times.map((time, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium">{time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Runs */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">최근 실행 이력</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-gray-900">2025-01-19 09:00</p>
                <p className="text-sm text-gray-600">수집 15개 → AI 12개 → 업로드 12개 → 발행 10개</p>
              </div>
            </div>
            <span className="text-sm text-gray-500">소요시간: 17분</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-gray-900">2025-01-18 19:00</p>
                <p className="text-sm text-gray-600">수집 20개 → AI 18개 → 업로드 18개 → 발행 15개</p>
              </div>
            </div>
            <span className="text-sm text-gray-500">소요시간: 22분</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="font-medium text-gray-900">2025-01-18 14:00</p>
                <p className="text-sm text-gray-600">수집 8개 → AI 8개 → 업로드 실패</p>
              </div>
            </div>
            <span className="text-sm text-gray-500">소요시간: 12분</span>
          </div>
        </div>
      </div>
    </div>
  )
}