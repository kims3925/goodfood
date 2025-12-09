'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { ChevronLeft, Send, MessageSquare, Clock, CheckCircle } from 'lucide-react'

interface Reply {
  id: number
  content: string
  isAdmin: boolean
  createdAt: string
}

interface Inquiry {
  id: number
  inquiryType: string
  title: string
  content: string
  status: 'PENDING' | 'ANSWERED'
  adminReply?: string
  repliedAt?: string
  createdAt: string
  replies: Reply[]
}

const inquiryTypes = [
  { value: 'PRODUCT', label: '상품 문의' },
  { value: 'DELIVERY', label: '배송 문의' },
  { value: 'ORDER', label: '주문/결제 문의' },
  { value: 'PAYMENT', label: '환불 문의' },
  { value: 'RETURN', label: '교환/반품 문의' },
  { value: 'GENERAL', label: '기타 문의' },
]

export default function InquiryPage() {
  const { data: session, status } = useSession()
  const [activeTab, setActiveTab] = useState<'write' | 'list'>('write')
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    inquiryType: 'GENERAL',
    title: '',
    content: '',
  })

  useEffect(() => {
    if (session && activeTab === 'list') {
      loadInquiries()
    }
  }, [session, activeTab])

  const loadInquiries = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/cs/inquiry')
      const data = await response.json()
      if (data.success) {
        setInquiries(data.inquiries)
      }
    } catch (error) {
      console.error('Failed to load inquiries:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!session) {
      window.location.href = '/auth/login'
      return
    }

    if (!formData.title.trim() || !formData.content.trim()) {
      return
    }

    try {
      setIsSubmitting(true)
      const response = await fetch('/api/cs/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        setFormData({ inquiryType: 'GENERAL', title: '', content: '' })
        setActiveTab('list')
        loadInquiries()
      }
    } catch (error) {
      console.error('Failed to submit inquiry:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
  }

  const getTypeLabel = (type: string) => {
    return inquiryTypes.find((t) => t.value === type)?.label || type
  }

  if (status === 'loading') {
    return (
      <div className="kurly-container py-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF6B6B]"></div>
      </div>
    )
  }

  return (
    <div className="kurly-container py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/cs" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">1:1 문의</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('write')}
          className={`flex-1 py-3 text-center font-medium transition-colors ${
            activeTab === 'write'
              ? 'text-[#FF6B6B] border-b-2 border-[#FF6B6B]'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          문의하기
        </button>
        <button
          onClick={() => setActiveTab('list')}
          className={`flex-1 py-3 text-center font-medium transition-colors ${
            activeTab === 'list'
              ? 'text-[#FF6B6B] border-b-2 border-[#FF6B6B]'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          내 문의내역
        </button>
      </div>

      {/* Write Form */}
      {activeTab === 'write' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {!session && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
              로그인 후 문의하실 수 있습니다.{' '}
              <Link href="/auth/login" className="underline font-medium">
                로그인하기
              </Link>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              문의 유형
            </label>
            <select
              value={formData.inquiryType}
              onChange={(e) => setFormData({ ...formData, inquiryType: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#FF6B6B]"
            >
              {inquiryTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              제목
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="문의 제목을 입력해 주세요"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#FF6B6B]"
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              문의 내용
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="문의 내용을 상세히 입력해 주세요"
              rows={8}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#FF6B6B] resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={!session || isSubmitting}
            className="w-full py-4 bg-[#FF6B6B] text-white font-medium rounded-lg hover:bg-[#FF5252] transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Send className="w-5 h-5" />
            {isSubmitting ? '등록 중...' : '문의 등록'}
          </button>
        </form>
      )}

      {/* Inquiry List */}
      {activeTab === 'list' && (
        <div>
          {!session ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">로그인 후 문의내역을 확인할 수 있습니다</p>
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#FF6B6B] text-white font-medium rounded-lg hover:bg-[#FF5252] transition-colors"
              >
                로그인하기
              </Link>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF6B6B]"></div>
            </div>
          ) : inquiries.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">문의 내역이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {inquiries.map((inquiry) => (
                <div
                  key={inquiry.id}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedId(expandedId === inquiry.id ? null : inquiry.id)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-[#FF6B6B] bg-[#FFF5F5] px-2 py-1 rounded">
                          {getTypeLabel(inquiry.inquiryType)}
                        </span>
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded flex items-center gap-1 ${
                            inquiry.status === 'ANSWERED'
                              ? 'text-green-600 bg-green-50'
                              : 'text-yellow-600 bg-yellow-50'
                          }`}
                        >
                          {inquiry.status === 'ANSWERED' ? (
                            <>
                              <CheckCircle className="w-3 h-3" /> 답변완료
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" /> 답변대기
                            </>
                          )}
                        </span>
                      </div>
                      <p className="font-medium text-gray-900">{inquiry.title}</p>
                      <p className="text-sm text-gray-500 mt-1">{formatDate(inquiry.createdAt)}</p>
                    </div>
                  </button>

                  {expandedId === inquiry.id && (
                    <div className="border-t border-gray-200">
                      <div className="px-5 py-4 bg-gray-50">
                        <p className="text-sm font-medium text-gray-700 mb-2">문의 내용</p>
                        <p className="text-gray-700 whitespace-pre-line">{inquiry.content}</p>
                      </div>

                      {/* 다중 답변 표시 */}
                      {inquiry.replies && inquiry.replies.length > 0 ? (
                        <div className="border-t border-gray-200">
                          <div className="px-5 py-3 bg-gray-100">
                            <p className="text-sm font-medium text-gray-700">답변 내역 ({inquiry.replies.length}건)</p>
                          </div>
                          {inquiry.replies.map((reply, index) => (
                            <div
                              key={reply.id}
                              className={`px-5 py-4 border-t border-gray-200 ${reply.isAdmin ? 'bg-blue-50' : 'bg-white'}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                  reply.isAdmin
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 text-gray-700'
                                }`}>
                                  {reply.isAdmin ? '관리자' : '나'}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {formatDate(reply.createdAt)}
                                </span>
                              </div>
                              <p className="text-gray-700 whitespace-pre-line">{reply.content}</p>
                            </div>
                          ))}
                        </div>
                      ) : inquiry.adminReply ? (
                        // 레거시 단일 답변 표시 (기존 adminReply 필드)
                        <div className="px-5 py-4 bg-blue-50 border-t border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-600 text-white">
                              관리자
                            </span>
                            {inquiry.repliedAt && (
                              <span className="text-xs text-gray-500">
                                {formatDate(inquiry.repliedAt)}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-700 whitespace-pre-line">{inquiry.adminReply}</p>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
