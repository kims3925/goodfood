'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

declare global {
  interface Window {
    daum: any
  }
}

export default function AddAddressPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [formData, setFormData] = useState({
    label: '',
    recipientName: '',
    recipientPhone: '',
    postalCode: '',
    address: '',
    addressDetail: '',
    isDefault: false,
  })
  const [loading, setLoading] = useState(false)

  // Daum 우편번호 API 호출 (레이어 방식)
  const openAddressSearch = () => {
    new window.daum.Postcode({
      oncomplete: function (data: any) {
        // 도로명 주소 또는 지번 주소 선택
        const fullAddress = data.userSelectedType === 'R' ? data.roadAddress : data.jibunAddress

        setFormData((prev) => ({
          ...prev,
          postalCode: data.zonecode,
          address: fullAddress,
        }))

        // 레이어 닫기
        const layer = document.getElementById('addressLayer')
        if (layer) layer.style.display = 'none'
        // body 스크롤 복원
        document.body.style.overflow = 'unset'
      },
      width: '100%',
      height: '100%',
    }).embed(document.getElementById('addressSearchIframe'))

    // 레이어 표시 및 body 스크롤 막기
    const layer = document.getElementById('addressLayer')
    if (layer) layer.style.display = 'block'
    document.body.style.overflow = 'hidden'
  }

  const closeAddressLayer = () => {
    const layer = document.getElementById('addressLayer')
    if (layer) layer.style.display = 'none'
    // body 스크롤 복원
    document.body.style.overflow = 'unset'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!session) {
      router.push('/auth/login')
      return
    }

    if (!formData.recipientName || !formData.recipientPhone || !formData.postalCode || !formData.address) {
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/mypage/addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        router.push('/mypage/addresses')
      }
    } catch (error) {
      console.error('Failed to add address:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Daum Postcode Script */}
      <script
        src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
        async
      />

      {/* 주소 검색 레이어 */}
      <div
        id="addressLayer"
        style={{
          display: 'none',
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 9999,
        }}
        onClick={closeAddressLayer}
      >
        <div
          style={{
            position: 'relative',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90%',
            maxWidth: '500px',
            backgroundColor: 'white',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 섹션 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderBottom: '1px solid #e5e7eb',
              backgroundColor: '#fff',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#111' }}>
              주소 검색
            </h3>
            <button
              onClick={closeAddressLayer}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6b7280',
                padding: 0,
              }}
            >
              ×
            </button>
          </div>

          {/* 주소 검색 iframe */}
          <div style={{ height: '600px' }}>
            <div id="addressSearchIframe" style={{ width: '100%', height: '100%' }}></div>
          </div>
        </div>
      </div>

      <div className="kurly-container py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">배송지 추가</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 배송지 이름 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                배송지명 (선택)
              </label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="예: 우리집, 회사"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6B6B]"
              />
            </div>

            {/* 받는 분 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                받는 분 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.recipientName}
                onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                placeholder="이름을 입력해주세요"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6B6B]"
                required
              />
            </div>

            {/* 연락처 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                연락처 <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={formData.recipientPhone}
                onChange={(e) => setFormData({ ...formData, recipientPhone: e.target.value })}
                placeholder="01012345678"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6B6B]"
                required
              />
            </div>

            {/* 주소 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                주소 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={formData.postalCode}
                  placeholder="우편번호"
                  className="w-32 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  readOnly
                  required
                />
                <button
                  type="button"
                  onClick={openAddressSearch}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  주소 검색
                </button>
              </div>
              <input
                type="text"
                value={formData.address}
                placeholder="기본 주소"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 mb-2"
                readOnly
                required
              />
              <input
                type="text"
                value={formData.addressDetail}
                onChange={(e) => setFormData({ ...formData, addressDetail: e.target.value })}
                placeholder="상세 주소를 입력해주세요"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6B6B]"
              />
            </div>

            {/* 기본 배송지 설정 */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="w-4 h-4 text-[#FF6B6B] border-gray-300 rounded focus:ring-[#FF6B6B]"
              />
              <label htmlFor="isDefault" className="text-sm text-gray-700">
                기본 배송지로 설정
              </label>
            </div>

            {/* 버튼 */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-[#FF6B6B] text-white rounded-lg hover:bg-[#ff5252] transition-colors font-medium disabled:bg-gray-300"
              >
                {loading ? '저장 중...' : '저장'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
