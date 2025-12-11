'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  Send,
  User,
  Mail,
  Phone,
  MessageSquare,
  Calendar,
  Package,
  Tag,
  ExternalLink,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Loading from '@/components/ui/Loading'
import { useToast } from '@/components/ui/Toast'
import { formatPhoneNumber } from '@/modules/utils/phoneUtils'

interface Reply {
  id: number
  content: string
  isAdmin: boolean
  createdAt: string
}

interface InquiryDetail {
  id: number
  inquiryType: string
  title: string
  content: string
  status: 'PENDING' | 'ANSWERED'
  adminReply?: string
  repliedAt?: string
  createdAt: string
  user: {
    id: number
    name: string
    email: string
    phone?: string
  }
  product?: {
    id: number
    name: string
    thumbnailUrl?: string
  }
  replies: Reply[]
}

const inquiryTypes: Record<string, { label: string; color: string }> = {
  PRODUCT: { label: '상품 문의', color: 'bg-blue-100 text-blue-700' },
  DELIVERY: { label: '배송 문의', color: 'bg-indigo-100 text-indigo-700' },
  ORDER: { label: '주문/결제 문의', color: 'bg-purple-100 text-purple-700' },
  PAYMENT: { label: '환불 문의', color: 'bg-orange-100 text-orange-700' },
  RETURN: { label: '교환/반품 문의', color: 'bg-red-100 text-red-700' },
  EXCHANGE: { label: '교환 문의', color: 'bg-pink-100 text-pink-700' },
  GENERAL: { label: '기타 문의', color: 'bg-gray-100 text-gray-700' },
}

export default function InquiryDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const toast = useToast()
  const [inquiry, setInquiry] = useState<InquiryDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 모든 답변을 통합 (기존 adminReply + replies)
  const getAllReplies = (): Reply[] => {
    if (!inquiry) return []

    const allReplies: Reply[] = []

    // 기존 adminReply가 있고 replies에 없는 경우 추가
    if (inquiry.adminReply && inquiry.replies.length === 0) {
      allReplies.push({
        id: 0, // 임시 ID
        content: inquiry.adminReply,
        isAdmin: true,
        createdAt: inquiry.repliedAt || inquiry.createdAt,
      })
    }

    // 새로운 replies 추가
    allReplies.push(...inquiry.replies)

    return allReplies
  }

  const loadInquiry = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/cs/inquiry/${params.id}`)
      const data = await response.json()

      if (data.success) {
        setInquiry(data.inquiry)
      } else {
        toast.error(data.error || '문의를 불러오는데 실패했습니다')
        router.push('/cs/inquiry')
      }
    } catch (error) {
      console.error('Failed to load inquiry:', error)
      toast.error('문의를 불러오는데 실패했습니다')
      router.push('/cs/inquiry')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadInquiry()
  }, [params.id])

  const handleSubmitReply = async () => {
    if (!replyText.trim()) {
      toast.warning('답변 내용을 입력해 주세요')
      return
    }

    try {
      setIsSubmitting(true)
      const response = await fetch(`/api/cs/inquiry/${params.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: replyText, isAdmin: true }),
      })

      const data = await response.json()

      if (data.success) {
        // 답변 목록에 추가
        setInquiry(prev => prev ? {
          ...prev,
          status: 'ANSWERED',
          replies: [...prev.replies, data.reply],
        } : null)
        setReplyText('')
        toast.success('답변이 등록되었습니다')
      } else {
        toast.error(data.error || '답변 등록에 실패했습니다')
      }
    } catch (error) {
      console.error('Failed to submit reply:', error)
      toast.error('답변 등록 중 오류가 발생했습니다')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status: string) => {
    if (status === 'ANSWERED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
          <CheckCircle size={16} />
          답변완료
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700">
        <Clock size={16} />
        답변대기
      </span>
    )
  }

  const getTypeBadge = (type: string) => {
    const typeInfo = inquiryTypes[type] || { label: type, color: 'bg-gray-100 text-gray-700' }
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium ${typeInfo.color}`}>
        <Tag size={14} />
        {typeInfo.label}
      </span>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (!inquiry) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">문의를 찾을 수 없습니다</p>
      </div>
    )
  }

  const replies = getAllReplies()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8 flex items-center gap-4">
          <Link href="/shop/cs/inquiry">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              목록으로
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">문의 상세</h1>
              <p className="text-sm text-gray-500">#{inquiry.id}</p>
            </div>
          </div>
          <div className="ml-auto">
            {getStatusBadge(inquiry.status)}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽: 고객 정보 및 문의 내용 */}
          <div className="lg:col-span-1 space-y-6">
            {/* 고객 정보 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-gray-400" />
                고객 정보
              </h2>
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-gray-600">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <User size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">이름</p>
                    <p className="font-medium text-gray-900">{inquiry.user.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-gray-600">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Mail size={20} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">이메일</p>
                    <p className="font-medium text-gray-900">{inquiry.user.email}</p>
                  </div>
                </div>
                {inquiry.user.phone && (
                  <div className="flex items-center gap-3 text-gray-600">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Phone size={20} className="text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">연락처</p>
                      <p className="font-medium text-gray-900">{formatPhoneNumber(inquiry.user.phone || null)}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <Link
                  href={`/user/${inquiry.user.id}`}
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <ExternalLink size={14} />
                  고객 상세 보기
                </Link>
              </div>
            </div>

            {/* 문의 정보 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">문의 정보</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600 flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    문의유형
                  </span>
                  {getTypeBadge(inquiry.inquiryType)}
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    등록일
                  </span>
                  <span className="text-gray-900 font-medium text-sm">{formatDate(inquiry.createdAt)}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    답변수
                  </span>
                  <span className="text-gray-900 font-medium">{replies.length}개</span>
                </div>
              </div>
            </div>

            {/* 관련 상품 */}
            {inquiry.product && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-gray-400" />
                  관련 상품
                </h2>
                <div className="flex items-center gap-3">
                  {inquiry.product.thumbnailUrl ? (
                    <img
                      src={inquiry.product.thumbnailUrl}
                      alt={inquiry.product.name}
                      className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Package className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{inquiry.product.name}</p>
                    <Link
                      href={`/product/detail/${inquiry.product.id}`}
                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mt-1"
                    >
                      <ExternalLink size={12} />
                      상품 상세
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 오른쪽: 문의 내용 및 답변 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 문의 내용 카드 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200 bg-gray-50">
                <h3 className="text-xl font-semibold text-gray-900">{inquiry.title}</h3>
              </div>
              <div className="p-6">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-600 text-white">
                      고객
                    </span>
                    <span className="text-sm text-gray-500">{inquiry.user.name}</span>
                    <span className="text-sm text-gray-400">|</span>
                    <span className="text-sm text-gray-500">{formatDate(inquiry.createdAt)}</span>
                  </div>
                  <p className="text-gray-700 whitespace-pre-line leading-relaxed">{inquiry.content}</p>
                </div>
              </div>
            </div>

            {/* 답변 목록 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-gray-400" />
                  답변 내역 ({replies.length}건)
                </h2>
              </div>

              {replies.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <MessageSquare size={32} className="text-gray-400" />
                  </div>
                  <p className="text-gray-500 font-medium">아직 답변이 없습니다</p>
                  <p className="text-sm text-gray-400 mt-1">아래에서 답변을 등록해주세요</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {replies.map((reply, index) => (
                    <div key={reply.id} className={`p-4 ${reply.isAdmin ? 'bg-green-50' : 'bg-white'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                            reply.isAdmin
                              ? 'bg-green-600 text-white'
                              : 'bg-blue-600 text-white'
                          }`}>
                            {reply.isAdmin ? '관리자' : '고객'}
                          </span>
                          <span className="text-sm text-gray-500">#{index + 1}</span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {formatDate(reply.createdAt)}
                        </span>
                      </div>
                      <p className="text-gray-700 whitespace-pre-line leading-relaxed">{reply.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 답변 작성 폼 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-900">새 답변 작성</h2>
              </div>
              <div className="p-6">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="답변 내용을 입력해 주세요"
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
                <div className="mt-4 flex justify-end gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => router.push('/cs/inquiry')}
                  >
                    목록으로
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSubmitReply}
                    disabled={!replyText.trim() || isSubmitting}
                  >
                    <Send size={16} />
                    {isSubmitting ? '등록 중...' : '답변 등록'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
