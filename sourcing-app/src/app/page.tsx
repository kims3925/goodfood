'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight, Zap, ShoppingBag, BarChart3, Bot, Shield, Rocket, Package, Send, CreditCard, Headphones, Store, ChevronRight, PlayCircle, Calculator, Truck, FileSpreadsheet } from 'lucide-react'

export default function LandingPage() {
  const router = useRouter()

  const features = [
    {
      id: 'sourcing',
      icon: <Package className="w-7 h-7" />,
      title: '자동 상품 수집',
      subtitle: '실시간 소싱 정보 반영',
      description: '소싱처 채널에서 상품 게시글을 자동으로 수집합니다. 이미지, 가격, 옵션 정보를 자동 추출하고 중복을 필터링합니다. URL 수집, 직접 등록도 지원합니다.',
      color: 'blue',
      screenshot: '/images/landing/feature-sourcing.svg',
    },
    {
      id: 'ai',
      icon: <Bot className="w-7 h-7" />,
      title: 'AI 상품 가공',
      subtitle: 'AI 자동 변환',
      description: '수집된 상품을 AI가 내 설정에 맞게 소매용으로 자동 변환합니다. 상품명 최적화, 상세 설명 생성, 옵션/가격 자동 설정까지 원클릭으로 완성됩니다.',
      color: 'purple',
      screenshot: '/images/landing/feature-ai.svg',
    },
    {
      id: 'publish',
      icon: <Send className="w-7 h-7" />,
      title: '소매밴드 자동 발행',
      subtitle: '이미지 포함 자동 게시',
      description: '가공된 상품을 소매 밴드와 쇼핑몰에 이미지와 함께 자동 발행합니다. 결제 링크가 포함된 게시글을 자동으로 작성하고 쇼핑몰에도 동시 등록됩니다.',
      color: 'green',
      screenshot: '/images/landing/feature-publish.svg',
    },
    {
      id: 'shop',
      icon: <ShoppingBag className="w-7 h-7" />,
      title: '멀티 쇼핑몰 운영',
      subtitle: '여러 쇼핑몰 동시 관리',
      description: '여러 개의 자체 쇼핑몰을 동시에 운영할 수 있습니다. 상품 발행 시 쇼핑몰에도 자동 등록되며, 토스페이먼츠 결제와 연동됩니다.',
      color: 'yellow',
      screenshot: '/images/landing/feature-shop.svg',
    },
    {
      id: 'order',
      icon: <CreditCard className="w-7 h-7" />,
      title: '주문 · 발주 자동화',
      subtitle: '주문부터 도매 발주까지',
      description: '고객 주문 접수부터 결제 확인, 도매처 발주 연동, 배송 추적까지 전 과정을 자동으로 처리합니다. 미결제 주문은 24시간 후 자동 취소됩니다.',
      color: 'red',
      screenshot: '/images/landing/feature-order.svg',
    },
    {
      id: 'settlement',
      icon: <Calculator className="w-7 h-7" />,
      title: '정산 자동화',
      subtitle: '매출/마진/수수료 자동 계산',
      description: '토스페이먼츠 거래 데이터를 기반으로 쇼핑몰별 매출, 마진, 수수료를 자동 정산합니다. 도매 정산서 생성과 Google Sheets 연동을 지원합니다.',
      color: 'orange',
      screenshot: '/images/landing/feature-settlement.svg',
    },
    {
      id: 'dashboard',
      icon: <BarChart3 className="w-7 h-7" />,
      title: '실시간 대시보드',
      subtitle: '매출/주문/파이프라인 현황',
      description: '매출 추이, 주문 상태, 상품별 성과, 쇼핑몰별 매출을 실시간으로 모니터링합니다. 기간별 비교 분석과 마진율 계산도 자동으로 제공됩니다.',
      color: 'indigo',
      screenshot: '/images/landing/feature-dashboard.svg',
    },
    {
      id: 'manager',
      icon: <Store className="w-7 h-7" />,
      title: '판매관리자 관리',
      subtitle: '매니저 계정/권한 관리',
      description: '매니저 계정을 추가하고 담당자 정보, 비밀번호를 관리합니다. SaaS 형태로 여러 판매관리자가 독립적으로 운영할 수 있습니다.',
      color: 'teal',
      screenshot: '/images/landing/feature-manager.svg',
    },
  ]

  const steps = [
    { num: '01', title: '회원가입 & 채널 연결', desc: '이메일로 가입 후, 도매/소매 밴드 채널을 연결하세요.' },
    { num: '02', title: '자동 수집 & AI 가공', desc: '도매 상품이 자동 수집되고, AI가 소매용으로 가공합니다.' },
    { num: '03', title: '발행 & 판매 시작', desc: '소매밴드와 쇼핑몰에 발행하면 바로 판매가 시작됩니다.' },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-md z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Zap size={18} className="text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">BandAuto</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/register')}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                회원가입
              </button>
              <button
                onClick={() => router.push('/login')}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                판매관리자
                <ArrowRight size={14} className="inline ml-1" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-28 pb-16 sm:pt-36 sm:pb-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-6">
            <Bot size={14} />
            AI 기반 소셜커머스 자동화 플랫폼
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
            밴드 상품 소싱부터 판매,<br />
            <span className="text-blue-600">발주, 정산까지 완전 자동화</span>
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
            소싱처에서 간단히 상품을 자동 수집하고,<br className="hidden sm:block" />
            AI가 내 설정에 맞게 소매용으로 가공한 후,<br className="hidden sm:block" />
            소매 밴드와 자체 쇼핑몰에 원클릭으로 발행하세요.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => router.push('/login')}
              className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200 hover:shadow-xl"
            >
              <Store size={18} />
              판매관리자 시작하기
              <ArrowRight size={18} />
            </button>
            <a
              href="#features"
              className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <PlayCircle size={18} />
              기능 살펴보기
            </a>
          </div>
        </div>

        {/* Hero Screenshot */}
        <div className="max-w-5xl mx-auto mt-16">
          <div className="bg-gray-900 rounded-2xl shadow-2xl p-2 sm:p-3">
            <div className="bg-gray-800 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-700/50 border-b border-gray-700">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <span className="text-xs text-gray-400 ml-2">snsauto.abcpharm.net</span>
              </div>
              <div className="aspect-[16/9] bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center p-8">
                <div className="text-center">
                  <p className="text-sm text-gray-400 mb-4 font-medium">모든 절차 완전 자동화</p>
                  <div className="flex items-center justify-center gap-2 sm:gap-3 text-gray-400 text-xs sm:text-sm flex-wrap">
                    <span className="flex items-center gap-1 bg-gray-700/60 px-3 py-1.5 rounded-lg text-green-400"><Package size={14} /> 상품수집</span>
                    <ChevronRight size={14} className="text-gray-600" />
                    <span className="flex items-center gap-1 bg-gray-700/60 px-3 py-1.5 rounded-lg text-yellow-400"><Bot size={14} /> AI가공</span>
                    <ChevronRight size={14} className="text-gray-600" />
                    <span className="flex items-center gap-1 bg-gray-700/60 px-3 py-1.5 rounded-lg text-blue-400"><Send size={14} /> 발행</span>
                    <ChevronRight size={14} className="text-gray-600" />
                    <span className="flex items-center gap-1 bg-gray-700/60 px-3 py-1.5 rounded-lg text-purple-400"><ShoppingBag size={14} /> 판매</span>
                    <ChevronRight size={14} className="text-gray-600" />
                    <span className="flex items-center gap-1 bg-gray-700/60 px-3 py-1.5 rounded-lg text-orange-400"><Truck size={14} /> 발주</span>
                    <ChevronRight size={14} className="text-gray-600" />
                    <span className="flex items-center gap-1 bg-gray-700/60 px-3 py-1.5 rounded-lg text-red-400"><Calculator size={14} /> 정산</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              핵심 기능 소개
            </h3>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              소싱부터 판매까지, 모든 과정을 자동화합니다.
            </p>
          </div>

          <div className="space-y-20 sm:space-y-28">
            {features.map((feature, index) => {
              const isReversed = index % 2 === 1
              const colors = colorMap[feature.color] || colorMap.blue
              return (
                <div
                  key={feature.id}
                  className={`flex flex-col ${isReversed ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-8 lg:gap-16`}
                >
                  {/* Text */}
                  <div className="flex-1 max-w-lg">
                    <div className={`inline-flex items-center justify-center w-14 h-14 ${colors.bg} ${colors.text} rounded-2xl mb-5`}>
                      {feature.icon}
                    </div>
                    <h4 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                      {feature.title}
                    </h4>
                    <p className={`text-sm font-medium ${colors.text} mb-4`}>
                      {feature.subtitle}
                    </p>
                    <p className="text-gray-600 leading-relaxed text-base">
                      {feature.description}
                    </p>
                  </div>

                  {/* Feature Illustration */}
                  <div className="flex-1 w-full max-w-xl">
                    <div className={`rounded-2xl border-2 ${colors.border} overflow-hidden shadow-lg`}>
                      <div className={`${colors.headerBg} px-4 py-2 flex items-center gap-2`}>
                        <div className="flex gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
                          <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
                          <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
                        </div>
                        <span className="text-xs text-white/60">{feature.subtitle}</span>
                      </div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={feature.screenshot}
                        alt={`${feature.title} 기능 화면`}
                        className="w-full aspect-[4/3] object-cover"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              3단계로 시작하세요
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div key={step.num} className="text-center bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 text-white rounded-2xl text-xl font-bold mb-4">
                  {step.num}
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h4>
                <p className="text-gray-600 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h3 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            지금 바로 시작하세요
          </h3>
          <p className="text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
            복잡한 밴드 소싱과 쇼핑몰 운영을 AI 자동화로 간단하게 만들어 드립니다.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="px-10 py-4 text-base font-semibold text-blue-600 bg-white rounded-xl hover:bg-blue-50 transition-colors shadow-lg inline-flex items-center gap-2"
          >
            <Store size={18} />
            판매관리자 시작하기
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Zap size={16} className="text-white" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">BandAuto</h4>
                <p className="text-xs">Band 기반 소셜커머스 자동화 플랫폼</p>
              </div>
            </div>
            <div className="text-sm text-center md:text-right">
              <p>ABC Group Tech</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

const colorMap: Record<string, {
  bg: string; text: string; border: string;
  headerBg: string; screenshotBg: string
}> = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200', headerBg: 'bg-blue-600', screenshotBg: 'bg-blue-50' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200', headerBg: 'bg-purple-600', screenshotBg: 'bg-purple-50' },
  green: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200', headerBg: 'bg-green-600', screenshotBg: 'bg-green-50' },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-600', border: 'border-yellow-200', headerBg: 'bg-yellow-600', screenshotBg: 'bg-yellow-50' },
  red: { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200', headerBg: 'bg-red-600', screenshotBg: 'bg-red-50' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200', headerBg: 'bg-indigo-600', screenshotBg: 'bg-indigo-50' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200', headerBg: 'bg-orange-600', screenshotBg: 'bg-orange-50' },
  teal: { bg: 'bg-teal-100', text: 'text-teal-600', border: 'border-teal-200', headerBg: 'bg-teal-600', screenshotBg: 'bg-teal-50' },
}
