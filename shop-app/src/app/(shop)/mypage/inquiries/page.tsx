'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { MessageSquare, CheckCircle, Clock } from 'lucide-react'
import Image from 'next/image'
import { useShopUrl } from '@/hooks/useShopUrl'
import { useShop } from '@/contexts/ShopContext'

interface InquiryReply {
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
  isPrivate: boolean
  status: string
  adminReply: string | null
  repliedAt: string | null
  createdAt: string
  publishedProduct: {
    id: number
    product: {
      id: number
      name: string
      thumbnailUrl: string | null
    } | null
  } | null
  replies: InquiryReply[]
}

const inquiryTypeLabels: Record<string, string> = {
  PRODUCT: '상품문의',
  DELIVERY: '배송문의',
  ORDER: '주문문의',
  PAYMENT: '결제문의',
  RETURN: '반품문의',
  EXCHANGE: '교환문의',
  GENERAL: '일반문의',
}

export default function InquiriesPage() {
  const { data: session } = useSession()
  const { getApiPath } = useShopUrl()
  const { shop } = useShop()
  const primaryColor = shop?.theme?.primaryColor || '#FF6B6B'
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchInquiries = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(getApiPath('/api/mypage/inquiries'))
      const data = await response.json()

      if (data.success) {
        setInquiries(data.inquiries)
      }
    } catch (error) {
      console.error('Failed to fetch inquiries:', error)
    } finally {
      setLoading(false)
    }
  }, [getApiPath])

  useEffect(() => {
    if (session) {
      fetchInquiries()
    }
  }, [session, fetchInquiries])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
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
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">상품 문의</h1>
        <p className="text-gray-600">문의하신 내역과 답변을 확인하세요</p>
      </div>

      {/* 문의 목록 */}
      {inquiries.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-lg w-full">
          <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">문의 내역이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {inquiries.map((inquiry) => (
            <div
              key={inquiry.id}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden"
            >
              {/* 문의 헤더 */}
              <div className="bg-gray-50 px-4 lg:px-6 py-3 lg:py-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                    {inquiryTypeLabels[inquiry.inquiryType]}
                  </span>
                  <span className="text-sm text-gray-600">
                    {formatDate(inquiry.createdAt)}
                  </span>
                  {inquiry.isPrivate && (
                    <span className="text-sm text-gray-500">비밀글</span>
                  )}
                </div>
                {inquiry.status === 'ANSWERED' ? (
                  <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                    <CheckCircle className="w-4 h-4" />
                    답변완료
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-yellow-600 text-sm font-medium">
                    <Clock className="w-4 h-4" />
                    답변대기
                  </span>
                )}
              </div>

              {/* 문의 내용 */}
              <div className="p-4 lg:p-6">
                {inquiry.publishedProduct?.product && (
                  <div className="flex gap-3 mb-4 pb-4 border-b border-gray-100">
                    <div className="relative w-10 h-10 lg:w-12 lg:h-12 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                      {inquiry.publishedProduct.product.thumbnailUrl ? (
                        <Image
                          src={inquiry.publishedProduct.product.thumbnailUrl}
                          alt={inquiry.publishedProduct.product.name}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <MessageSquare className="w-5 h-5 text-gray-300" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {inquiry.publishedProduct.product.name}
                      </p>
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900 mb-2">{inquiry.title}</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{inquiry.content}</p>
                </div>

                {/* 관리자 답변 */}
                {inquiry.status === 'ANSWERED' && (
                  <div className="mt-4 pt-4 border-t border-gray-200 -mx-4 lg:-mx-6 -mb-4 lg:-mb-6">
                    {/* 기존 adminReply 필드 (replies가 없는 경우) */}
                    {inquiry.adminReply && (!inquiry.replies || inquiry.replies.length === 0) && (
                      <div className="bg-blue-50 px-4 lg:px-6 py-4">
                        <div className="flex items-start gap-2 mb-2">
                          <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
                            답변
                          </span>
                          {inquiry.repliedAt && (
                            <span className="text-xs text-gray-500">
                              {formatDate(inquiry.repliedAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-700 whitespace-pre-wrap">
                          {inquiry.adminReply}
                        </p>
                      </div>
                    )}
                    {/* 새로운 replies 배열 */}
                    {inquiry.replies && inquiry.replies.length > 0 && (
                      <div className="divide-y divide-gray-100">
                        {inquiry.replies.filter(reply => reply.isAdmin).map((reply) => (
                          <div key={reply.id} className="bg-blue-50 px-4 lg:px-6 py-4">
                            <div className="flex items-start gap-2 mb-2">
                              <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
                                답변
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatDate(reply.createdAt)}
                              </span>
                            </div>
                            <p className="text-gray-700 whitespace-pre-wrap">
                              {reply.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
