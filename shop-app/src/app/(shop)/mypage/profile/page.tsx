'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useShopUrl } from '@/hooks/useShopUrl'
import { useShop } from '@/contexts/ShopContext'

export default function ProfilePage() {
  const { data: session } = useSession()
  const { getApiPath } = useShopUrl()
  const { shop } = useShop()
  const primaryColor = shop?.theme?.primaryColor || '#FF6B6B'
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  useEffect(() => {
    if (session) {
      fetchProfile()
    }
  }, [session])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const response = await fetch(getApiPath('/api/mypage/profile'))
      const data = await response.json()

      if (data.success) {
        setFormData({
          name: data.user.name || '',
          phone: data.user.phone || '',
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        })
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      return
    }

    try {
      const response = await fetch(getApiPath('/api/mypage/profile'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setFormData({
          ...formData,
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        })
      }
    } catch (error) {
      console.error('Failed to update profile:', error)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: primaryColor }}></div>
      </div>
    )
  }

  return (
    <>
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">회원 정보 관리</h1>
        <p className="text-gray-600">개인정보를 안전하게 관리하세요</p>
      </div>

      {/* 폼 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 lg:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 이메일 (수정 불가) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이메일
              </label>
              <input
                type="email"
                value={session?.user?.email || ''}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1">이메일은 변경할 수 없습니다</p>
            </div>

            {/* 이름 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1"
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
              />
            </div>

            {/* 전화번호 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                전화번호
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="010-1234-5678"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1"
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
              />
            </div>

            <hr className="my-6" />

            {/* 비밀번호 변경 섹션 */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">비밀번호 변경</h3>
              <p className="text-sm text-gray-600">
                비밀번호를 변경하지 않으려면 아래 필드를 비워두세요
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  현재 비밀번호
                </label>
                <input
                  type="password"
                  value={formData.currentPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, currentPassword: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1"
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  새 비밀번호
                </label>
                <input
                  type="password"
                  value={formData.newPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, newPassword: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1"
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  새 비밀번호 확인
                </label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmPassword: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1"
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                />
              </div>
            </div>

            {/* 제출 버튼 */}
            <div className="pt-6">
              <button
                type="submit"
                className="w-full px-6 py-3 text-white rounded-md hover:opacity-90 font-medium"
                style={{ backgroundColor: primaryColor }}
              >
                저장하기
              </button>
            </div>
          </form>
        </div>
    </>
  )
}
