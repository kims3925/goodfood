'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { MapPin, Plus, Edit2, Trash2, Check } from 'lucide-react'

declare global {
  interface Window {
    daum: any
  }
}

interface Address {
  id: number
  label: string | null
  recipientName: string
  recipientPhone: string
  postalCode: string
  address: string
  addressDetail: string | null
  isDefault: boolean
}

export default function AddressesPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    label: '',
    recipientName: '',
    recipientPhone: '',
    postalCode: '',
    address: '',
    addressDetail: '',
    isDefault: false,
  })

  // Daum 우편번호 API 호출 (레이어 방식)
  const openAddressSearch = () => {
    new window.daum.Postcode({
      oncomplete: function (data: any) {
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

  useEffect(() => {
    if (session) {
      fetchAddresses()
    }
  }, [session])

  const fetchAddresses = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/mypage/addresses')
      const data = await response.json()

      if (data.success) {
        setAddresses(data.addresses)
      }
    } catch (error) {
      console.error('Failed to fetch addresses:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingId
        ? `/api/mypage/addresses/${editingId}`
        : '/api/mypage/addresses'

      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        setShowForm(false)
        setEditingId(null)
        resetForm()
        fetchAddresses()
      }
    } catch (error) {
      console.error('Failed to save address:', error)
    }
  }

  const handleEdit = (address: Address) => {
    setFormData({
      label: address.label || '',
      recipientName: address.recipientName,
      recipientPhone: address.recipientPhone,
      postalCode: address.postalCode,
      address: address.address,
      addressDetail: address.addressDetail || '',
      isDefault: address.isDefault,
    })
    setEditingId(address.id)
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('배송지를 삭제하시겠습니까?')) {
      return
    }

    try {
      const response = await fetch(`/api/mypage/addresses/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        fetchAddresses()
      }
    } catch (error) {
      console.error('Failed to delete address:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      label: '',
      recipientName: '',
      recipientPhone: '',
      postalCode: '',
      address: '',
      addressDetail: '',
      isDefault: false,
    })
  }

  if (loading) {
    return (
      <div className="kurly-container py-12">
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B6B] mx-auto"></div>
        </div>
      </div>
    )
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

      <div className="kurly-container py-12">
      {/* 헤더 */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">배송지 관리</h1>
          <p className="text-gray-600">배송지는 최대 5개까지 등록할 수 있습니다</p>
        </div>
        {!showForm && addresses.length < 5 && (
          <button
            onClick={() => {
              resetForm()
              setEditingId(null)
              setShowForm(true)
            }}
            className="px-6 py-3 bg-[#FF6B6B] text-white rounded-md hover:bg-[#FF5252] flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            배송지 추가
          </button>
        )}
      </div>

      {/* 배송지 등록/수정 폼 */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">
            {editingId ? '배송지 수정' : '배송지 추가'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                배송지명 (선택)
              </label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="예: 집, 회사"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#FF6B6B]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  받는 분 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.recipientName}
                  onChange={(e) =>
                    setFormData({ ...formData, recipientName: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#FF6B6B]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  연락처 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.recipientPhone}
                  onChange={(e) =>
                    setFormData({ ...formData, recipientPhone: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#FF6B6B]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                주소 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={formData.postalCode}
                  placeholder="우편번호"
                  className="w-32 px-4 py-2 border border-gray-300 rounded-md bg-gray-50"
                  readOnly
                  required
                />
                <button
                  type="button"
                  onClick={openAddressSearch}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-medium"
                >
                  주소 검색
                </button>
              </div>
              <input
                type="text"
                value={formData.address}
                placeholder="기본 주소"
                className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50 mb-2"
                readOnly
                required
              />
              <input
                type="text"
                value={formData.addressDetail}
                onChange={(e) =>
                  setFormData({ ...formData, addressDetail: e.target.value })
                }
                placeholder="상세 주소를 입력해주세요"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#FF6B6B]"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={formData.isDefault}
                onChange={(e) =>
                  setFormData({ ...formData, isDefault: e.target.checked })
                }
                className="w-4 h-4 text-[#FF6B6B] border-gray-300 rounded focus:ring-[#FF6B6B]"
              />
              <label htmlFor="isDefault" className="text-sm text-gray-700">
                기본 배송지로 설정
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-[#FF6B6B] text-white rounded-md hover:bg-[#FF5252]"
              >
                {editingId ? '수정하기' : '등록하기'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditingId(null)
                  resetForm()
                }}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 배송지 목록 */}
      {addresses.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-lg">
          <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">등록된 배송지가 없습니다</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((address) => (
            <div
              key={address.id}
              className="bg-white border border-gray-200 rounded-lg p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  {address.label && (
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                      {address.label}
                    </span>
                  )}
                  {address.isDefault && (
                    <span className="px-3 py-1 bg-[#FF6B6B] text-white text-sm rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      기본배송지
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(address)}
                    className="p-2 text-gray-600 hover:text-[#FF6B6B]"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(address.id)}
                    className="p-2 text-gray-600 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <p className="font-medium text-gray-900">{address.recipientName}</p>
                <p className="text-gray-600">{address.recipientPhone}</p>
                <p className="text-gray-600">
                  ({address.postalCode}) {address.address}
                </p>
                {address.addressDetail && (
                  <p className="text-gray-600">{address.addressDetail}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </>
  )
}
