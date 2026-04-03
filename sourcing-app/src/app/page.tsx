'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight, Zap, ShoppingBag, BarChart3, Bot, Shield, Rocket } from 'lucide-react'

export default function LandingPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-bold text-blue-600">SNS AUTO</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/login')}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                로그인
              </button>
              <button
                onClick={() => router.push('/register')}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                무료 시작하기
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium mb-6">
            <Zap size={14} />
            AI 기반 소셜커머스 자동화 플랫폼
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
            밴드 상품 소싱부터<br />
            <span className="text-blue-600">판매까지 완전 자동화</span>
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
            도매 밴드에서 상품을 자동 수집하고, AI가 가공한 후,
            소매 밴드와 자체 쇼핑몰에 원클릭으로 발행하세요.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => router.push('/register')}
              className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
            >
              무료로 시작하기
              <ArrowRight size={18} />
            </button>
            <button
              onClick={() => router.push('/login')}
              className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              로그인
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">
              모든 것을 한 곳에서 관리하세요
            </h3>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              상품 소싱, AI 가공, 발행, 주문 관리, 정산까지 통합 매니저 대시보드에서 운영하세요.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Bot className="w-6 h-6" />}
              title="AI 상품 가공"
              description="Gemini AI가 수집된 상품의 제목, 설명, 카테고리, 가격을 자동으로 최적화합니다."
              color="blue"
            />
            <FeatureCard
              icon={<Zap className="w-6 h-6" />}
              title="자동 수집 파이프라인"
              description="도매 밴드 게시물을 Playwright로 자동 수집하고 스케줄링으로 운영합니다."
              color="yellow"
            />
            <FeatureCard
              icon={<ShoppingBag className="w-6 h-6" />}
              title="멀티 쇼핑몰 운영"
              description="여러 개의 쇼핑몰을 동시에 운영하고, 상품을 한 번에 발행할 수 있습니다."
              color="green"
            />
            <FeatureCard
              icon={<BarChart3 className="w-6 h-6" />}
              title="실시간 대시보드"
              description="주문 현황, 정산, 파이프라인 상태를 실시간으로 모니터링하세요."
              color="purple"
            />
            <FeatureCard
              icon={<Shield className="w-6 h-6" />}
              title="토스페이먼츠 결제"
              description="카드, 계좌이체, 간편결제를 안전하게 처리하고 웹훅으로 실시간 동기화합니다."
              color="red"
            />
            <FeatureCard
              icon={<Rocket className="w-6 h-6" />}
              title="에이전트 자동화"
              description="AI 에이전트팀이 소싱, 쇼핑몰, DB, DevOps를 자율적으로 운영합니다."
              color="indigo"
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">
              3단계로 시작하세요
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard
              step="01"
              title="회원가입"
              description="이메일과 비밀번호만으로 빠르게 가입하세요."
            />
            <StepCard
              step="02"
              title="채널 연결"
              description="도매 밴드 채널과 소매 밴드 채널을 연결하세요."
            />
            <StepCard
              step="03"
              title="자동화 시작"
              description="파이프라인 설정 후 자동 수집-가공-발행을 시작하세요."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h3 className="text-3xl font-bold text-white mb-4">
            지금 바로 시작하세요
          </h3>
          <p className="text-lg text-blue-100 mb-8">
            복잡한 소셜커머스 운영을 AI와 자동화로 간단하게 만들어 드립니다.
          </p>
          <button
            onClick={() => router.push('/register')}
            className="px-8 py-3.5 text-base font-semibold text-blue-600 bg-white rounded-xl hover:bg-blue-50 transition-colors shadow-lg"
          >
            무료로 시작하기
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-lg font-bold text-white">SNS AUTO</h4>
              <p className="text-sm mt-1">Band 기반 소셜커머스 자동화 플랫폼</p>
            </div>
            <div className="text-sm">
              <p>관리자: skkim3925@gmail.com</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

const colorMap: Record<string, { bg: string; text: string }> = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-600' },
  green: { bg: 'bg-green-100', text: 'text-green-600' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
  red: { bg: 'bg-red-100', text: 'text-red-600' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600' },
}

function FeatureCard({ icon, title, description, color }: {
  icon: React.ReactNode
  title: string
  description: string
  color: string
}) {
  const colors = colorMap[color] || colorMap.blue
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-shadow">
      <div className={`inline-flex items-center justify-center w-12 h-12 ${colors.bg} ${colors.text} rounded-xl mb-4`}>
        {icon}
      </div>
      <h4 className="text-lg font-semibold text-gray-900 mb-2">{title}</h4>
      <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
    </div>
  )
}

function StepCard({ step, title, description }: {
  step: string
  title: string
  description: string
}) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 text-white rounded-2xl text-xl font-bold mb-4">
        {step}
      </div>
      <h4 className="text-lg font-semibold text-gray-900 mb-2">{title}</h4>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  )
}
