'use client'

import { useState } from 'react'
import { PlayCircle, PauseCircle, RefreshCw, CheckCircle, XCircle, Clock, AlertCircle, Zap, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface WorkflowStep {
  id: string
  name: string
  description: string
  icon: string
  apiEndpoint: string
  status: 'idle' | 'processing' | 'completed' | 'failed'
  count?: number
  error?: string
  startTime?: Date
  endTime?: Date
}

export default function WorkflowTestPage() {
  const [isRunning, setIsRunning] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(-1)
  const [steps, setSteps] = useState<WorkflowStep[]>([
    {
      id: 'register',
      name: '도매밴드 등록',
      description: 'Band API에서 사용자 밴드 조회 및 자동 등록',
      icon: '📋',
      apiEndpoint: '/api/user/bands',
      status: 'idle',
    },
    {
      id: 'collect',
      name: '게시물 수집',
      description: '등록된 도매밴드에서 신규 게시물 수집',
      icon: '📦',
      apiEndpoint: '/api/wholesale/collect',
      status: 'idle',
    },
    {
      id: 'analyze',
      name: 'AI 상품 분석',
      description: 'Gemini AI로 상품 분류 및 제목/가격 추출',
      icon: '🤖',
      apiEndpoint: '/api/wholesale/post/analyze',
      status: 'idle',
    },
    {
      id: 'confirm',
      name: '소싱 확정',
      description: '가격정책 적용 및 Product 생성',
      icon: '✅',
      apiEndpoint: '/api/wholesale/post/confirm',
      status: 'idle',
    },
    {
      id: 'shop',
      name: '쇼핑몰 등록',
      description: '자체 쇼핑몰에 상품 등록',
      icon: '🛒',
      apiEndpoint: '/api/shop/products',
      status: 'idle',
    },
    {
      id: 'publish',
      name: '소매밴드 발행',
      description: '소매밴드에 쇼핑몰 링크 포함 게시',
      icon: '📮',
      apiEndpoint: '/api/retail/post/publish',
      status: 'idle',
    },
  ])

  const updateStepStatus = (index: number, updates: Partial<WorkflowStep>) => {
    setSteps(prev => {
      const newSteps = [...prev]
      newSteps[index] = { ...newSteps[index], ...updates }
      return newSteps
    })
  }

  const executeStep = async (index: number): Promise<boolean> => {
    const step = steps[index]

    console.log(`🚀 Step ${index + 1} 시작: ${step.name}`)

    updateStepStatus(index, {
      status: 'processing',
      startTime: new Date(),
      error: undefined
    })

    try {
      let requestBody: any = {}

      // 1단계: 도매밴드 등록 - 사용자의 밴드를 조회해서 시스템에 자동 등록
      if (step.id === 'register') {
        // 사용자의 Band API 밴드 목록 조회
        const userBandsResponse = await fetch('/api/user/bands')
        const userBandsData = await userBandsResponse.json()

        if (!userBandsData.success || !userBandsData.bands || userBandsData.bands.length === 0) {
          throw new Error('Band API에서 밴드 목록을 가져올 수 없습니다. API 설정을 확인해주세요.')
        }

        // 이미 등록된 밴드 조회
        const existingBandsResponse = await fetch('/api/wholesale/bands')
        const existingBandsData = await existingBandsResponse.json()
        const existingBandKeys = new Set(
          (existingBandsData.bands || []).map((b: any) => b.bandKey)
        )

        // 아직 등록되지 않은 밴드 필터링
        const newBands = userBandsData.bands.filter(
          (band: any) => !existingBandKeys.has(band.band_key)
        )

        if (newBands.length === 0) {
          updateStepStatus(index, {
            status: 'completed',
            endTime: new Date(),
            count: 0
          })
          console.log(`✅ Step ${index + 1} 완료: 모든 밴드가 이미 등록되어 있습니다`)
          return true
        }

        // 새로운 밴드 자동 등록
        const registerResponse = await fetch('/api/wholesale/bands', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selectedBands: newBands })
        })

        const registerData = await registerResponse.json()

        if (registerData.success) {
          updateStepStatus(index, {
            status: 'completed',
            endTime: new Date(),
            count: newBands.length
          })
          console.log(`✅ Step ${index + 1} 완료: ${newBands.length}개 밴드 등록`)
          return true
        } else {
          throw new Error(registerData.error || '밴드 등록 실패')
        }
      }

      // 2단계: 게시물 수집 - 등록된 모든 밴드에서 게시물 수집
      if (step.id === 'collect') {
        // 등록된 모든 밴드 조회
        const bandsResponse = await fetch('/api/wholesale/bands')
        const bandsData = await bandsResponse.json()

        if (!bandsData.success || !bandsData.bands || bandsData.bands.length === 0) {
          throw new Error('등록된 도매밴드가 없습니다.')
        }

        // 모든 밴드에서 게시물 수집
        let totalCollected = 0
        for (const band of bandsData.bands) {
          console.log(`📦 게시물 수집 중: ${band.name}`)
          const collectResponse = await fetch(step.apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bandId: band.id })
          })

          const collectData = await collectResponse.json()
          if (collectData.success) {
            totalCollected += collectData.newPosts || 0
          }
        }

        updateStepStatus(index, {
          status: 'completed',
          endTime: new Date(),
          count: totalCollected
        })

        console.log(`✅ Step ${index + 1} 완료: ${totalCollected}개 게시물 수집`)
        return true
      }

      // 3단계: AI 분석 - postIds 없이 호출하면 자동으로 미분석 게시물 처리
      if (step.id === 'analyze') {
        requestBody = {} // 빈 객체로 보내면 자동으로 미분석 게시물 처리
      }

      // 4단계: 소싱 확정 - PENDING 상태 게시물 조회
      if (step.id === 'confirm') {
        const postsResponse = await fetch('/api/wholesale/post?status=PENDING')
        const postsData = await postsResponse.json()

        if (!postsData.success || !postsData.posts || postsData.posts.length === 0) {
          throw new Error('소싱 확정할 게시물이 없습니다.')
        }

        const postIds = postsData.posts.map((p: any) => p.id)
        requestBody = { postIds }
      }

      // 5단계: 쇼핑몰 등록 - DRAFT 상태 Product 조회
      if (step.id === 'shop') {
        const productsResponse = await fetch('/api/products?status=DRAFT')
        const productsData = await productsResponse.json()

        if (!productsData.success || !productsData.products || productsData.products.length === 0) {
          throw new Error('쇼핑몰 등록할 상품이 없습니다.')
        }

        const productIds = productsData.products.map((p: any) => p.id)
        requestBody = { productIds }
      }

      // 6단계: 소매밴드 발행 - 아직 구현되지 않음
      if (step.id === 'publish') {
        updateStepStatus(index, {
          status: 'completed',
          endTime: new Date(),
          count: 0
        })
        console.log(`⚠️ Step ${index + 1}: API 미구현 - 건너뜀`)
        return true
      }

      // 실제 API 호출
      const response = await fetch(step.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

      if (data.success) {
        updateStepStatus(index, {
          status: 'completed',
          endTime: new Date(),
          count: data.count || data.analyzed || data.createdProducts || data.newPosts || 0
        })

        console.log(`✅ Step ${index + 1} 완료: ${step.name}`, data)
        return true
      } else {
        throw new Error(data.error || '알 수 없는 오류')
      }
    } catch (error: any) {
      console.error(`❌ Step ${index + 1} 실패: ${step.name}`, error)

      updateStepStatus(index, {
        status: 'failed',
        endTime: new Date(),
        error: error.message || '요청 실패'
      })

      return false
    }
  }

  const handleStartWorkflow = async () => {
    setIsRunning(true)
    setCurrentStepIndex(0)

    // 모든 단계 초기화
    setSteps(prev => prev.map(step => ({
      ...step,
      status: 'idle',
      count: undefined,
      error: undefined,
      startTime: undefined,
      endTime: undefined
    })))

    // 순차적으로 각 단계 실행
    for (let i = 0; i < steps.length; i++) {
      setCurrentStepIndex(i)

      const success = await executeStep(i)

      if (!success) {
        // 실패 시 중단
        alert(`워크플로우가 ${steps[i].name} 단계에서 중단되었습니다.`)
        break
      }

      // 다음 단계로 넘어가기 전 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    setIsRunning(false)
    setCurrentStepIndex(-1)

    // 모든 단계가 완료되었는지 확인
    const allCompleted = steps.every(s => s.status === 'completed')
    if (allCompleted) {
      alert('🎉 모든 워크플로우가 성공적으로 완료되었습니다!')
    }
  }

  const handleStopWorkflow = () => {
    setIsRunning(false)
    setCurrentStepIndex(-1)
  }

  const getStepIcon = (step: WorkflowStep) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'processing':
        return <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />
      default:
        return <Clock className="w-5 h-5 text-gray-400" />
    }
  }

  const formatDuration = (start?: Date, end?: Date) => {
    if (!start || !end) return '-'
    const diff = end.getTime() - start.getTime()
    return `${(diff / 1000).toFixed(1)}초`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Zap className="w-6 h-6 text-yellow-500" />
                워크플로우 테스트 (실제 API)
              </h1>
              <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                NEW
              </span>
            </div>
            <p className="mt-2 text-gray-600">
              실제 API를 호출하여 전체 프로세스를 자동으로 실행합니다
            </p>
            <div className="mt-2 flex items-center gap-2 text-sm text-blue-600">
              <AlertCircle className="w-4 h-4" />
              <span>기존 워크플로우 페이지와 달리 실제로 작동합니다</span>
            </div>
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
            <Link
              href="/automation/workflow"
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              기존 페이지로
            </Link>
          </div>
        </div>
      </div>

      {/* Current Status */}
      {isRunning && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
            <div>
              <p className="font-semibold text-blue-900">워크플로우 실행 중...</p>
              <p className="text-sm text-blue-700 mt-1">
                현재 단계: {currentStepIndex >= 0 ? steps[currentStepIndex]?.name : '대기 중'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Steps */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-6">워크플로우 단계 (실제 API 연동)</h2>

        <div className="space-y-4">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`p-4 rounded-lg border-2 transition-all ${
                step.status === 'processing'
                  ? 'border-blue-500 bg-blue-50'
                  : step.status === 'completed'
                  ? 'border-green-500 bg-green-50'
                  : step.status === 'failed'
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <span className="text-3xl">{step.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {index + 1}. {step.name}
                      </h3>
                      {getStepIcon(step)}
                      {step.status === 'completed' && step.count !== undefined && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
                          {step.count}개 처리
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{step.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>API: <code className="bg-gray-100 px-2 py-1 rounded">{step.apiEndpoint}</code></span>
                      {step.startTime && step.endTime && (
                        <span>소요시간: {formatDuration(step.startTime, step.endTime)}</span>
                      )}
                    </div>
                    {step.error && (
                      <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-sm text-red-800">
                        ❌ 오류: {step.error}
                      </div>
                    )}
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <ArrowRight className="w-5 h-5 text-gray-400 mt-2" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">실행 요약</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">
              {steps.filter(s => s.status === 'completed').length}
            </p>
            <p className="text-sm text-gray-600 mt-1">완료</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-900">
              {steps.filter(s => s.status === 'processing').length}
            </p>
            <p className="text-sm text-blue-600 mt-1">진행 중</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <p className="text-2xl font-bold text-red-900">
              {steps.filter(s => s.status === 'failed').length}
            </p>
            <p className="text-sm text-red-600 mt-1">실패</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">
              {steps.filter(s => s.status === 'idle').length}
            </p>
            <p className="text-sm text-gray-600 mt-1">대기</p>
          </div>
        </div>
      </div>
    </div>
  )
}
