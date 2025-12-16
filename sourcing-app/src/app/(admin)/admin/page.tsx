'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight, Package, Bot, Upload, Send, TrendingUp, Clock } from 'lucide-react'

export default function AdminDashboard() {
  const router = useRouter()

  const workflowSteps = [
    {
      step: 1,
      title: '도매밴드 수집',
      description: '도매 밴드에서 상품 정보를 자동으로 수집합니다',
      icon: <Package className="w-6 h-6" />,
      status: 'active',
      count: 45,
      href: '/automation/collect',
      color: 'green'
    },
    {
      step: 2,
      title: 'AI 상세페이지 생성',
      description: 'AI가 자동으로 매력적인 상품 설명을 생성합니다',
      icon: <Bot className="w-6 h-6" />,
      status: 'processing',
      count: 12,
      href: '/products/ai-generate',
      color: 'yellow'
    },
    {
      step: 3,
      title: '소매밴드 포스팅',
      description: '결제링크와 함께 소매밴드에 자동 발행합니다',
      icon: <Send className="w-6 h-6" />,
      status: 'pending',
      count: 0,
      href: '/retail/publish',
      color: 'purple'
    }
  ]

  const recentActivities = [
    { time: '5분 전', action: '도매밴드에서 10개 상품 수집 완료', type: 'collect' },
    { time: '12분 전', action: 'AI 상세페이지 5개 생성 완료', type: 'ai' },
    { time: '30분 전', action: '쇼핑몰 엑셀 업로드 완료 (15개)', type: 'upload' },
    { time: '1시간 전', action: '소매밴드 3개 게시물 발행', type: 'publish' },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'processing': return 'bg-yellow-100 text-yellow-800 animate-pulse'
      case 'ready': return 'bg-blue-100 text-blue-800'
      case 'pending': return 'bg-gray-100 text-gray-600'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return '활성'
      case 'processing': return '처리중'
      case 'ready': return '준비됨'
      case 'pending': return '대기'
      default: return '대기'
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900">자동화 워크플로우</h1>
        <p className="mt-2 text-gray-600">도매밴드 수집부터 소매밴드 발행까지 전 과정을 자동화합니다</p>
      </div>

      {/* Workflow Progress */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">워크플로우 진행 상황</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {workflowSteps.map((step, index) => (
            <div
              key={step.step}
              className="relative cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push(step.href)}
            >
              <div className="p-6 border-2 border-gray-200 rounded-lg hover:border-primary-color">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-full bg-${step.color}-100`}>
                    {step.icon}
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(step.status)}`}>
                    {getStatusText(step.status)}
                  </span>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-900">
                    Step {step.step}: {step.title}
                  </h3>
                  <p className="text-sm text-gray-600">{step.description}</p>
                  {step.count > 0 && (
                    <div className="pt-2">
                      <span className="text-2xl font-bold text-primary-color">{step.count}</span>
                      <span className="text-sm text-gray-600 ml-1">개 처리중</span>
                    </div>
                  )}
                </div>
              </div>
              {index < workflowSteps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-2 transform -translate-y-1/2">
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stats and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Stats */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">오늘의 실적</h2>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">총 수집 상품</span>
              <span className="text-xl font-bold text-gray-900">156</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">AI 생성 완료</span>
              <span className="text-xl font-bold text-gray-900">89</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">쇼핑몰 업로드</span>
              <span className="text-xl font-bold text-gray-900">67</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">밴드 발행 완료</span>
              <span className="text-xl font-bold text-gray-900">45</span>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">최근 활동</h2>
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <div className="space-y-3">
            {recentActivities.map((activity, index) => (
              <div key={index} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg">
                <div className={`w-2 h-2 mt-2 rounded-full ${
                  activity.type === 'collect' ? 'bg-green-500' :
                  activity.type === 'ai' ? 'bg-yellow-500' :
                  activity.type === 'upload' ? 'bg-blue-500' :
                  'bg-purple-500'
                }`}></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{activity.action}</p>
                  <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">빠른 실행</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => router.push('/automation/collect')}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            도매밴드 수집 시작
          </button>
          <button
            onClick={() => router.push('/products/ai-generate')}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
          >
            AI 컨텐츠 생성
          </button>
          <button
            onClick={() => router.push('/retail/publish')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            소매밴드 발행
          </button>
          <button
            onClick={() => router.push('/automation/workflow')}
            className="px-4 py-2 bg-primary-color text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            전체 워크플로우 실행
          </button>
        </div>
      </div>
    </div>
  )
}