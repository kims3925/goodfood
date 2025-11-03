'use client'

import Link from 'next/link'
import { Settings, Key, CreditCard, Bell, ChevronRight, Store, Share2, Bot } from 'lucide-react'

interface SettingsItem {
  title: string
  description: string
  href: string
  icon: React.ReactNode
}

export default function SettingsPage() {
  const settingsItems: SettingsItem[] = [
    {
      title: '쇼핑몰 설정',
      description: '자체 쇼핑몰의 기본 정보, 결제 설정, 배송 정책 등을 관리합니다.',
      href: '/admin/settings/shop',
      icon: <Store className="h-6 w-6 text-blue-600" />
    },
    {
      title: '소매밴드 설정',
      description: '소매밴드 API 연동 및 자동 포스팅 설정을 관리합니다.',
      href: '/admin/settings/retail',
      icon: <Share2 className="h-6 w-6 text-green-600" />
    },
    {
      title: 'AI 설정',
      description: 'Gemini AI 연동 설정 및 상품 분석 옵션을 관리합니다.',
      href: '/admin/settings/ai',
      icon: <Bot className="h-6 w-6 text-purple-600" />
    },
    {
      title: '알림 설정',
      description: '주문, 에러, 작업 완료 등 각종 알림 설정을 관리합니다.',
      href: '/admin/settings/notifications',
      icon: <Bell className="h-6 w-6 text-orange-600" />
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">시스템 설정</h1>
          </div>
          <p className="text-gray-600">BandAuto의 다양한 설정을 관리합니다.</p>
        </div>

        {/* Settings Items */}
        <div className="grid gap-6">
          {settingsItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200 cursor-pointer">
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        {item.icon}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {item.title}
                        </h3>
                        <p className="text-gray-600 text-sm">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}