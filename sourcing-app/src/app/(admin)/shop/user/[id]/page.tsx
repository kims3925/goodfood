'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Users,
  Mail,
  Phone,
  ShoppingBag,
  MessageSquare,
  Star,
  MapPin,
  Heart,
  Ticket,
  Edit,
  Save,
  X,
  Calendar,
  Shield,
  UserCheck,
  UserCog,
  ShieldCheck,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import { useToast } from '@/components/ui/Toast'

type UserRole = 'SOURCING_USER' | 'CUSTOMER' | 'ADMIN'

interface UserDetail {
  id: number
  email: string
  name: string | null
  phone: string | null
  role: UserRole
  profileImage: string | null
  oauthProvider: string | null
  oauthProviderId: string | null
  createdAt: string
  updatedAt: string
  marketingAgreedAt: string | null
  privacyAgreedAt: string | null
  signupCompletedAt: string | null
  tosAgreedAt: string | null
  orders: {
    id: number
    orderNumber: string
    status: string
    totalAmount: number
    createdAt: string
  }[]
  inquiries: {
    id: number
    inquiryType: string
    title: string
    status: string
    createdAt: string
  }[]
  reviews: {
    id: number
    rating: number
    content: string
    createdAt: string
  }[]
  addresses: {
    id: number
    recipientName: string
    recipientPhone: string
    postalCode: string
    address: string
    addressDetail: string | null
    isDefault: boolean
  }[]
  _count: {
    orders: number
    inquiries: number
    reviews: number
    wishlists: number
    userCoupons: number
  }
}

const roleLabels: Record<UserRole, string> = {
  SOURCING_USER: '소싱 관리자',
  CUSTOMER: '쇼핑몰 고객',
  ADMIN: '슈퍼 관리자',
}

const roleColors: Record<UserRole, string> = {
  SOURCING_USER: 'bg-blue-100 text-blue-700',
  CUSTOMER: 'bg-green-100 text-green-700',
  ADMIN: 'bg-purple-100 text-purple-700',
}

const roleIcons: Record<UserRole, React.ReactNode> = {
  SOURCING_USER: <UserCog size={16} />,
  CUSTOMER: <UserCheck size={16} />,
  ADMIN: <ShieldCheck size={16} />,
}

const statusLabels: Record<string, { label: string; color: string }> = {
  PENDING: { label: '결제대기', color: 'bg-yellow-100 text-yellow-700' },
  PAID: { label: '결제완료', color: 'bg-blue-100 text-blue-700' },
  SHIPPED: { label: '배송중', color: 'bg-indigo-100 text-indigo-700' },
  DELIVERED: { label: '배송완료', color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: '취소', color: 'bg-red-100 text-red-700' },
  REFUNDED: { label: '환불', color: 'bg-gray-100 text-gray-700' },
  ANSWERED: { label: '답변완료', color: 'bg-green-100 text-green-700' },
}

export default function UserDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = params
  const router = useRouter()
  const toast = useToast()
  const [user, setUser] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    role: '' as UserRole,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchUser()
  }, [id])

  const fetchUser = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/user/${id}`)
      const data = await res.json()

      if (data.user) {
        setUser(data.user)
        setEditForm({
          name: data.user.name || '',
          phone: data.user.phone || '',
          role: data.user.role,
        })
      } else {
        toast.error(data.error || '사용자를 찾을 수 없습니다.')
        router.push('/user/list')
      }
    } catch (error) {
      console.error('사용자 로드 실패:', error)
      toast.error('사용자 정보를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/user/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()

      if (data.user) {
        toast.success('사용자 정보가 수정되었습니다.')
        setEditing(false)
        fetchUser()
      } else {
        toast.error(data.error || '수정에 실패했습니다.')
      }
    } catch (error) {
      console.error('사용자 수정 실패:', error)
      toast.error('수정에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatPrice = (price: number) => {
    return price.toLocaleString('ko-KR') + '원'
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
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8 flex items-center gap-4">
          <Link href="/user/list">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              목록으로
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            {user.profileImage ? (
              <img
                src={user.profileImage}
                alt={user.name || '프로필'}
                className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-lg"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center border-2 border-white shadow-lg">
                <Users className="w-8 h-8 text-gray-500" />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {user.name || '(이름 없음)'}
              </h1>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽: 기본 정보 및 통계 */}
          <div className="lg:col-span-1 space-y-6">
            {/* 기본 정보 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">기본 정보</h2>
                {!editing ? (
                  <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                    <Edit className="w-4 h-4 mr-1" />
                    수정
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                      <X className="w-4 h-4 mr-1" />
                      취소
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      <Save className="w-4 h-4 mr-1" />
                      저장
                    </Button>
                  </div>
                )}
              </div>
              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      이름
                    </label>
                    <Input
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      전화번호
                    </label>
                    <Input
                      value={editForm.phone}
                      onChange={(e) =>
                        setEditForm({ ...editForm, phone: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      역할
                    </label>
                    <select
                      value={editForm.role}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          role: e.target.value as UserRole,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="CUSTOMER">쇼핑몰 고객</option>
                      <option value="SOURCING_USER">소싱 관리자</option>
                      <option value="ADMIN">슈퍼 관리자</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-gray-600">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <span>{user.email}</span>
                  </div>
                  {user.phone && (
                    <div className="flex items-center gap-3 text-gray-600">
                      <Phone className="w-5 h-5 text-gray-400" />
                      <span>{user.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-gray-400" />
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium ${roleColors[user.role]}`}
                    >
                      {roleIcons[user.role]}
                      {roleLabels[user.role]}
                    </span>
                  </div>
                  {user.oauthProvider && (
                    <div className="text-sm text-gray-500">
                      OAuth 로그인: <span className="font-medium">{user.oauthProvider}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 활동 통계 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">활동 통계</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <ShoppingBag className="w-8 h-8 mx-auto text-blue-600 mb-2" />
                  <div className="text-3xl font-bold text-blue-600">
                    {user._count.orders}
                  </div>
                  <div className="text-sm text-gray-600">주문</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <MessageSquare className="w-8 h-8 mx-auto text-green-600 mb-2" />
                  <div className="text-3xl font-bold text-green-600">
                    {user._count.inquiries}
                  </div>
                  <div className="text-sm text-gray-600">문의</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <Star className="w-8 h-8 mx-auto text-yellow-600 mb-2" />
                  <div className="text-3xl font-bold text-yellow-600">
                    {user._count.reviews}
                  </div>
                  <div className="text-sm text-gray-600">리뷰</div>
                </div>
                <div className="text-center p-4 bg-pink-50 rounded-lg">
                  <Heart className="w-8 h-8 mx-auto text-pink-600 mb-2" />
                  <div className="text-3xl font-bold text-pink-600">
                    {user._count.wishlists}
                  </div>
                  <div className="text-sm text-gray-600">위시리스트</div>
                </div>
              </div>
              <div className="mt-4 p-4 bg-orange-50 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Ticket className="w-8 h-8 text-orange-600" />
                  <span className="text-sm text-gray-600">보유 쿠폰</span>
                </div>
                <span className="text-2xl font-bold text-orange-600">
                  {user._count.userCoupons}
                </span>
              </div>
            </div>

            {/* 가입 정보 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">가입 정보</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    가입일
                  </span>
                  <span className="text-gray-900 font-medium">{formatDate(user.createdAt)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">가입 완료</span>
                  <span className="text-gray-900">{formatDate(user.signupCompletedAt)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">이용약관 동의</span>
                  <span className="text-gray-900">{formatDate(user.tosAgreedAt)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">개인정보 동의</span>
                  <span className="text-gray-900">{formatDate(user.privacyAgreedAt)}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">마케팅 동의</span>
                  <span className={user.marketingAgreedAt ? 'text-green-600 font-medium' : 'text-gray-400'}>
                    {user.marketingAgreedAt ? formatDate(user.marketingAgreedAt) : '미동의'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 오른쪽: 활동 내역 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 배송지 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-gray-400" />
                배송지 ({user.addresses.length})
              </h2>
              {user.addresses.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  등록된 배송지가 없습니다.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {user.addresses.map((addr) => (
                    <div
                      key={addr.id}
                      className={`p-4 rounded-lg border-2 ${
                        addr.isDefault
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-gray-900">{addr.recipientName}</span>
                        {addr.isDefault && (
                          <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
                            기본
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mb-1">{addr.recipientPhone}</div>
                      <div className="text-sm text-gray-900">
                        [{addr.postalCode}] {addr.address}
                        {addr.addressDetail && ` ${addr.addressDetail}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 최근 주문 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-gray-400" />
                최근 주문 ({user._count.orders})
              </h2>
              {user.orders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  주문 내역이 없습니다.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">주문번호</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">상태</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">금액</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">주문일</th>
                      </tr>
                    </thead>
                    <tbody>
                      {user.orders.map((order) => (
                        <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <span className="font-mono text-sm text-gray-900">{order.orderNumber}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                statusLabels[order.status]?.color || 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {statusLabels[order.status]?.label || order.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-gray-900">
                            {formatPrice(order.totalAmount)}
                          </td>
                          <td className="py-3 px-4 text-right text-sm text-gray-600">
                            {formatDate(order.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 최근 문의 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-gray-400" />
                최근 문의 ({user._count.inquiries})
              </h2>
              {user.inquiries.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  문의 내역이 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {user.inquiries.map((inquiry) => (
                    <div
                      key={inquiry.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div>
                        <div className="font-medium text-gray-900">{inquiry.title}</div>
                        <div className="text-sm text-gray-500">
                          {inquiry.inquiryType} · {formatDate(inquiry.createdAt)}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          statusLabels[inquiry.status]?.color || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {statusLabels[inquiry.status]?.label || inquiry.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 최근 리뷰 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-gray-400" />
                최근 리뷰 ({user._count.reviews})
              </h2>
              {user.reviews.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  리뷰 내역이 없습니다.
                </div>
              ) : (
                <div className="space-y-4">
                  {user.reviews.map((review) => (
                    <div key={review.id} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-5 h-5 ${
                                star <= review.rating
                                  ? 'text-yellow-400 fill-yellow-400'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                          <span className="ml-2 font-semibold text-gray-900">{review.rating}점</span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {formatDate(review.createdAt)}
                        </span>
                      </div>
                      <p className="text-gray-700">{review.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
