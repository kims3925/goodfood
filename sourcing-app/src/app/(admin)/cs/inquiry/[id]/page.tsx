'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Clock, CheckCircle, Send, User, Mail, Phone } from 'lucide-react'
import Button from '@/components/ui/Button'
import Loading from '@/components/ui/Loading'

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

const inquiryTypes: Record<string, string> = {
  PRODUCT: '상품 문의',
  DELIVERY: '배송 문의',
  ORDER: '주문/결제 문의',
  PAYMENT: '환불 문의',
  RETURN: '교환/반품 문의',
  EXCHANGE: '교환 문의',
  GENERAL: '기타 문의',
}

export default function InquiryDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
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
        alert(data.error || '문의를 불러오는데 실패했습니다')
        router.push('/cs/inquiry')
      }
    } catch (error) {
      console.error('Failed to load inquiry:', error)
      alert('문의를 불러오는데 실패했습니다')
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
      alert('답변 내용을 입력해 주세요')
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
        alert('답변이 등록되었습니다')
      } else {
        alert(data.error || '답변 등록에 실패했습니다')
      }
    } catch (error) {
      console.error('Failed to submit reply:', error)
      alert('답변 등록 중 오류가 발생했습니다')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const getStatusBadge = (status: string) => {
    if (status === 'ANSWERED') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
          <CheckCircle size={16} />
          답변완료
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700">
        <Clock size={16} />
        답변대기
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-6">
          <Link
            href="/cs/inquiry"
            className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeft size={20} />
            목록으로 돌아가기
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">문의 상세</h1>
            {getStatusBadge(inquiry.status)}
          </div>
        </div>

        {/* 문의 정보 카드 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          {/* 고객 정보 */}
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">고객 정보</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <User size={20} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">이름</p>
                  <p className="font-medium text-gray-900">{inquiry.user.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Mail size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">이메일</p>
                  <p className="font-medium text-gray-900">{inquiry.user.email}</p>
                </div>
              </div>
              {inquiry.user.phone && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <Phone size={20} className="text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">연락처</p>
                    <p className="font-medium text-gray-900">{inquiry.user.phone}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 문의 내용 */}
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="inline-flex px-2.5 py-1 rounded text-sm font-medium bg-blue-100 text-blue-700">
                {inquiryTypes[inquiry.inquiryType] || inquiry.inquiryType}
              </span>
              <span className="text-sm text-gray-500">
                {formatDate(inquiry.createdAt)}
              </span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">{inquiry.title}</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-700 whitespace-pre-line">{inquiry.content}</p>
            </div>

            {/* 관련 상품 */}
            {inquiry.product && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-2">관련 상품</p>
                <div className="flex items-center gap-3">
                  {inquiry.product.thumbnailUrl && (
                    <img
                      src={inquiry.product.thumbnailUrl}
                      alt={inquiry.product.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  )}
                  <span className="font-medium text-gray-900">{inquiry.product.name}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 답변 목록 (게시판 스타일) */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              답변 내역 ({getAllReplies().length}건)
            </h2>
          </div>

          {getAllReplies().length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              아직 답변이 없습니다
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {getAllReplies().map((reply, index) => (
                <div key={reply.id} className={`p-6 ${reply.isAdmin ? 'bg-blue-50' : 'bg-white'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        reply.isAdmin
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700'
                      }`}>
                        {reply.isAdmin ? '관리자' : '고객'}
                      </span>
                      <span className="text-sm text-gray-500">#{index + 1}</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {formatDate(reply.createdAt)}
                    </span>
                  </div>
                  <p className="text-gray-700 whitespace-pre-line">{reply.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 답변 작성 폼 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
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
  )
}
