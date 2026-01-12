'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  UserCog,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import { formatPhoneNumber } from '@/modules/utils/phoneUtils'
import Loading from '@/components/ui/Loading'
import { useToast } from '@/components/ui/Toast'

interface ManagerDetail {
  id: number
  email: string
  name: string | null
  phone: string | null
  role: 'MANAGER'
  profileImage: string | null
  createdAt: string
}

export default function ManagerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const toast = useToast()
  const userId = params.id as string

  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<ManagerDetail | null>(null)

  const fetchUserDetail = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/user/${userId}`)
      const data = await res.json()

      if (res.ok) {
        // 매니저가 아닌 경우 리다이렉트
        if (data.user.role !== 'MANAGER') {
          if (data.user.role === 'USER') {
            toast.error('회원 상세 페이지는 쇼핑몰 메뉴에서 확인하세요.')
            router.push('/shop/user/list')
          } else {
            toast.error('접근할 수 없는 사용자입니다.')
            router.push('/sourcing/user/list')
          }
          return
        }
        setUser(data.user)
      } else if (res.status === 404) {
        toast.error('매니저를 찾을 수 없습니다.')
        router.push('/sourcing/user/list')
      } else {
        toast.error(data.error || '매니저 정보를 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('매니저 로드 실패:', error)
      toast.error('매니저 정보를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [userId, router, toast])

  useEffect(() => {
    if (userId) {
      fetchUserDetail()
    }
  }, [userId, fetchUserDetail])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-6">
          <Link href="/sourcing/user/list">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              목록으로
            </Button>
          </Link>
        </div>

        {/* 매니저 프로필 카드 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-6">
            {/* 프로필 이미지 */}
            {user.profileImage ? (
              <img
                src={user.profileImage}
                alt={user.name || '프로필'}
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center">
                <UserCog className="w-12 h-12 text-blue-500" />
              </div>
            )}

            {/* 기본 정보 */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <h1 className="text-2xl font-bold text-gray-900">
                  {user.name || '(이름 없음)'}
                </h1>
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                  매니저
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-gray-600">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <span>{user.email}</span>
                </div>
                {user.phone && (
                  <div className="flex items-center gap-3 text-gray-600">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <span>{formatPhoneNumber(user.phone)}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-gray-600">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <span>등록일: {formatDate(user.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 추가 정보 또는 액션 버튼 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">계정 관리</h2>
          <div className="flex gap-3">
            <Button variant="secondary" disabled>
              비밀번호 재설정 (준비 중)
            </Button>
            <Button variant="secondary" disabled>
              권한 변경 (준비 중)
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            * 계정 관리 기능은 추후 업데이트 예정입니다.
          </p>
        </div>
      </div>
    </div>
  )
}
