'use client'

import { Construction, ArrowRight } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useRouter } from 'next/navigation'

export default function ShoppingMallPublishPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">쇼핑몰 발행</h1>
          <p className="text-gray-600">
            가공된 상품을 자체 쇼핑몰에 등록합니다.
          </p>
        </div>

        {/* 준비중 안내 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="flex flex-col items-center justify-center py-24 px-8">
            <Construction className="text-yellow-500 mb-6" size={80} />
            <h2 className="text-2xl font-bold text-gray-900 mb-3">기능 준비중</h2>
            <p className="text-gray-600 text-center max-w-md mb-8">
              쇼핑몰 발행 기능은 현재 개발 중입니다.<br />
              곧 업데이트될 예정이니 조금만 기다려주세요.
            </p>

            <div className="bg-gray-50 rounded-lg p-6 max-w-lg w-full">
              <h3 className="font-semibold text-gray-900 mb-3">예정된 기능</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                  e-commerce-app과 상품 데이터 동기화
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                  상품 카테고리 매핑
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                  재고 및 가격 자동 동기화
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                  토스페이먼츠 결제 연동
                </li>
              </ul>
            </div>

            <div className="mt-8">
              <Button
                variant="primary"
                onClick={() => router.push('/publish/retail-band')}
              >
                소매밴드 발행으로 이동
                <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
