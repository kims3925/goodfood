'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Store,
  Calendar,
  ShoppingBag,
  MessageSquare,
  Star,
  MapPin,
  CreditCard,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  AlertCircle,
  ChevronRight,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import { formatPhoneNumber } from '@/modules/utils/phoneUtils'
import Loading from '@/components/ui/Loading'
import { useToast } from '@/components/ui/Toast'

type UserRole = 'USER' | 'MANAGER' | 'ADMIN'
type MemberType = 'MEMBER' | 'GUEST'
type OrderStatus = 'PENDING' | 'PAID' | 'PREPARING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED'
type InquiryStatus = 'PENDING' | 'ANSWERED' | 'CLOSED'
type InquiryType = 'PRODUCT' | 'SHIPPING' | 'PAYMENT' | 'RETURN' | 'OTHER'

interface Shop {
  id: number
  name: string
  subdomain: string
}

interface UserDetail {
  id: number
  shopId: number | null
  email: string
  name: string | null
  phone: string | null
  role: UserRole
  profileImage: string | null
  createdAt: string
  signupCompletedAt: string | null
  marketingAgreedAt: string | null
  privacyAgreedAt: string | null
  tosAgreedAt: string | null
  registeredShop: Shop | null
  _count: {
    orders: number
    inquiries: number
    reviews: number
  }
}

interface OrderItem {
  id: number
  productName: string
  thumbnailUrl: string | null
  quantity: number
  unitPrice: string
  totalPrice: string
}

interface Order {
  id: number
  orderNumber: string
  status: OrderStatus
  totalAmount: string
  orderedAt: string
  paidAt: string | null
  shippedAt: string | null
  deliveredAt: string | null
  items: OrderItem[]
  _count: { items: number }
}

interface Inquiry {
  id: number
  inquiryType: InquiryType
  title: string
  status: InquiryStatus
  isPrivate: boolean
  createdAt: string
  repliedAt: string | null
  shopProduct: {
    id: number
    product: {
      name: string
      thumbnailUrl: string | null
    }
  } | null
  _count: { replies: number }
}

interface Review {
  id: number
  rating: number
  title: string | null
  content: string
  images: string | null
  isVisible: boolean
  createdAt: string
  orderItem: {
    id: number
    productName: string
    thumbnailUrl: string | null
    optionSummary: string | null
    order: {
      id: number
      orderNumber: string
    }
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

interface Stats {
  totalOrders: number
  totalInquiries: number
  totalReviews: number
  totalSpent: string | number
}

const roleLabels: Record<UserRole, string> = {
  USER: '일반 사용자',
  MANAGER: '쇼핑몰 관리자',
  ADMIN: '슈퍼 관리자',
}

const roleColors: Record<UserRole, string> = {
  USER: 'bg-green-100 text-green-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  ADMIN: 'bg-purple-100 text-purple-700',
}

const memberTypeLabels: Record<MemberType, string> = {
  MEMBER: '회원',
  GUEST: '비회원',
}

const memberTypeColors: Record<MemberType, string> = {
  MEMBER: 'bg-emerald-100 text-emerald-700',
  GUEST: 'bg-orange-100 text-orange-700',
}

// 회원 유형 판별 헬퍼
const getMemberType = (user: UserDetail): MemberType => {
  if (user.role !== 'USER') return 'MEMBER'
  return user.signupCompletedAt ? 'MEMBER' : 'GUEST'
}

const orderStatusLabels: Record<OrderStatus, string> = {
  PENDING: '주문접수',
  PAID: '결제완료',
  PREPARING: '상품준비중',
  SHIPPED: '배송중',
  DELIVERED: '배송완료',
  CANCELLED: '주문취소',
  REFUNDED: '환불완료',
}

const orderStatusColors: Record<OrderStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  PAID: 'bg-blue-100 text-blue-700',
  PREPARING: 'bg-indigo-100 text-indigo-700',
  SHIPPED: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  REFUNDED: 'bg-gray-100 text-gray-700',
}

const inquiryTypeLabels: Record<InquiryType, string> = {
  PRODUCT: '상품문의',
  SHIPPING: '배송문의',
  PAYMENT: '결제문의',
  RETURN: '반품/교환',
  OTHER: '기타',
}

const inquiryStatusLabels: Record<InquiryStatus, string> = {
  PENDING: '답변대기',
  ANSWERED: '답변완료',
  CLOSED: '종료',
}

const inquiryStatusColors: Record<InquiryStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  ANSWERED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-700',
}

type TabType = 'orders' | 'inquiries' | 'reviews' | 'addresses'

export default function UserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const toast = useToast()
  const userId = params.id as string

  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<UserDetail | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [addresses, setAddresses] = useState<Address[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('orders')

  const fetchUserDetail = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/user/${userId}`)
      const data = await res.json()

      if (res.ok) {
        setUser(data.user)
        setOrders(data.orders)
        setInquiries(data.inquiries)
        setReviews(data.reviews)
        setAddresses(data.addresses)
        setStats(data.stats)
      } else if (res.status === 404) {
        toast.error('사용자를 찾을 수 없습니다.')
        router.push('/shop/user/list')
      } else {
        toast.error(data.error || '사용자 정보를 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('사용자 로드 실패:', error)
      toast.error('사용자 정보를 불러오는데 실패했습니다.')
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

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatPrice = (price: string | number) => {
    return Number(price).toLocaleString() + '원'
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

  const tabs = [
    { id: 'orders' as TabType, label: '주문 내역', count: stats?.totalOrders || 0, icon: ShoppingBag },
    { id: 'inquiries' as TabType, label: '문의 내역', count: stats?.totalInquiries || 0, icon: MessageSquare },
    { id: 'reviews' as TabType, label: '리뷰', count: stats?.totalReviews || 0, icon: Star },
    { id: 'addresses' as TabType, label: '배송지', count: addresses.length, icon: MapPin },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-6">
          <Link href="/shop/user/list">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              목록으로
            </Button>
          </Link>
        </div>

        {/* 사용자 프로필 카드 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* 프로필 이미지 & 기본 정보 */}
            <div className="flex items-start gap-4">
              {user.profileImage ? (
                <img
                  src={user.profileImage}
                  alt={user.name || '프로필'}
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="w-10 h-10 text-gray-500" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {user.name || '(이름 없음)'}
                  </h1>
                  {user.role === 'USER' && (
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${memberTypeColors[getMemberType(user)]}`}>
                      {memberTypeLabels[getMemberType(user)]}
                    </span>
                  )}
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColors[user.role]}`}>
                    {roleLabels[user.role]}
                  </span>
                </div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {user.email}
                  </div>
                  {user.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {formatPhoneNumber(user.phone)}
                    </div>
                  )}
                  {user.registeredShop && (
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4" />
                      {user.registeredShop.name}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    가입일: {formatDate(user.createdAt)}
                  </div>
                </div>
              </div>
            </div>

            {/* 통계 카드들 */}
            <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4 lg:ml-auto">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <ShoppingBag className="w-5 h-5 text-blue-500" />
                  <span className="text-sm text-gray-600">총 주문</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalOrders || 0}건</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <CreditCard className="w-5 h-5 text-green-500" />
                  <span className="text-sm text-gray-600">총 결제금액</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatPrice(stats?.totalSpent || 0)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <MessageSquare className="w-5 h-5 text-purple-500" />
                  <span className="text-sm text-gray-600">문의</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalInquiries || 0}건</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Star className="w-5 h-5 text-yellow-500" />
                  <span className="text-sm text-gray-600">리뷰</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalReviews || 0}건</p>
              </div>
            </div>
          </div>
        </div>

        {/* 탭 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <div className="flex overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    activeTab === tab.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 탭 컨텐츠 */}
          <div className="p-6">
            {/* 주문 내역 */}
            {activeTab === 'orders' && (
              <div className="space-y-4">
                {orders.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <ShoppingBag className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>주문 내역이 없습니다.</p>
                  </div>
                ) : (
                  orders.map((order) => (
                    <div key={order.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-gray-900">#{order.orderNumber}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${orderStatusColors[order.status]}`}>
                            {orderStatusLabels[order.status]}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">{formatPrice(order.totalAmount)}</p>
                          <p className="text-xs text-gray-500">{formatDateTime(order.orderedAt)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {order.items.slice(0, 3).map((item) => (
                          <div key={item.id} className="flex items-center gap-2">
                            {item.thumbnailUrl ? (
                              <img src={item.thumbnailUrl} alt={item.productName} className="w-10 h-10 rounded object-cover" />
                            ) : (
                              <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center">
                                <Package className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                            <div className="text-sm">
                              <p className="text-gray-900 line-clamp-1">{item.productName}</p>
                              <p className="text-gray-500">{item.quantity}개</p>
                            </div>
                          </div>
                        ))}
                        {order._count.items > 3 && (
                          <span className="text-sm text-gray-500">외 {order._count.items - 3}건</span>
                        )}
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Link href={`/shop/order/detail/${order.orderNumber}`}>
                          <Button variant="ghost" size="sm">
                            상세보기 <ChevronRight className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 문의 내역 */}
            {activeTab === 'inquiries' && (
              <div className="space-y-4">
                {inquiries.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>문의 내역이 없습니다.</p>
                  </div>
                ) : (
                  inquiries.map((inquiry) => (
                    <div key={inquiry.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                              {inquiryTypeLabels[inquiry.inquiryType]}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${inquiryStatusColors[inquiry.status]}`}>
                              {inquiryStatusLabels[inquiry.status]}
                            </span>
                            {inquiry.isPrivate && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">비공개</span>
                            )}
                          </div>
                          <h4 className="font-medium text-gray-900 mb-1">{inquiry.title}</h4>
                          {inquiry.shopProduct && (
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              {inquiry.shopProduct.product.thumbnailUrl ? (
                                <img src={inquiry.shopProduct.product.thumbnailUrl} alt="" className="w-6 h-6 rounded object-cover" />
                              ) : (
                                <Package className="w-4 h-4" />
                              )}
                              <span>{inquiry.shopProduct.product.name}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-right text-sm text-gray-500">
                          <p>{formatDateTime(inquiry.createdAt)}</p>
                          {inquiry._count.replies > 0 && (
                            <p className="text-blue-600">답변 {inquiry._count.replies}개</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Link href={`/shop/cs/inquiry/detail/${inquiry.id}`}>
                          <Button variant="ghost" size="sm">
                            상세보기 <ChevronRight className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 리뷰 */}
            {activeTab === 'reviews' && (
              <div className="space-y-4">
                {reviews.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Star className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>작성한 리뷰가 없습니다.</p>
                  </div>
                ) : (
                  reviews.map((review) => (
                    <div key={review.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-4">
                        {review.orderItem.thumbnailUrl ? (
                          <img src={review.orderItem.thumbnailUrl} alt="" className="w-16 h-16 rounded object-cover" />
                        ) : (
                          <div className="w-16 h-16 rounded bg-gray-200 flex items-center justify-center">
                            <Package className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex items-center">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-4 h-4 ${star <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                                />
                              ))}
                            </div>
                            {!review.isVisible && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">비공개</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-900 font-medium">{review.orderItem.productName}</p>
                          {review.orderItem.optionSummary && (
                            <p className="text-xs text-gray-500">{review.orderItem.optionSummary}</p>
                          )}
                          {review.title && <p className="font-medium text-gray-900 mt-2">{review.title}</p>}
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{review.content}</p>
                          {review.images && (
                            <div className="flex gap-2 mt-2">
                              {JSON.parse(review.images).slice(0, 4).map((img: string, idx: number) => (
                                <img key={idx} src={img} alt="" className="w-12 h-12 rounded object-cover" />
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-gray-400 mt-2">{formatDateTime(review.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 배송지 */}
            {activeTab === 'addresses' && (
              <div className="space-y-4">
                {addresses.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>등록된 배송지가 없습니다.</p>
                  </div>
                ) : (
                  addresses.map((address) => (
                    <div key={address.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-gray-900">{address.label || '배송지'}</span>
                            {address.isDefault && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">기본 배송지</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{address.recipientName} · {formatPhoneNumber(address.recipientPhone)}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            [{address.postalCode}] {address.address}
                            {address.addressDetail && ` ${address.addressDetail}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
