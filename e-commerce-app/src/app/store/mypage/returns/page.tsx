'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { RotateCcw } from 'lucide-react'

interface ReturnRequest {
  id: number
  orderId: number
  requestType: string
  reason: string
  reasonDetail: string | null
  refundAmount: number
  refundMethod: string
  status: string
  requestedAt: string
  processedAt: string | null
  completedAt: string | null
}

const returnTypeLabels: Record<string, string> = {
  CANCEL: '취소',
  RETURN: '반품',
  EXCHANGE: '교환',
}

const statusLabels: Record<string, string> = {
  REQUESTED: '요청됨',
  REVIEWING: '검토중',
  APPROVED: '승인됨',
  REJECTED: '거부됨',
  PROCESSING: '처리중',
  COMPLETED: '완료됨',
}

const statusColors: Record<string, string> = {
  REQUESTED: 'text-blue-600 bg-blue-50',
  REVIEWING: 'text-yellow-600 bg-yellow-50',
  APPROVED: 'text-green-600 bg-green-50',
  REJECTED: 'text-red-600 bg-red-50',
  PROCESSING: 'text-purple-600 bg-purple-50',
  COMPLETED: 'text-gray-600 bg-gray-50',
}

export default function ReturnsPage() {
  const { data: session } = useSession()
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session) {
      fetchReturnRequests()
    }
  }, [session])

  const fetchReturnRequests = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/mypage/returns')
      const data = await response.json()

      if (data.success) {
        setReturnRequests(data.returnRequests)
      }
    } catch (error) {
      console.error('Failed to fetch return requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR').format(Number(price)) + '원'
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
    <div className="kurly-container py-12">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">취소/반품 내역</h1>
        <p className="text-gray-600">취소 및 반품 요청 내역을 확인하세요</p>
      </div>

      {/* 취소/반품 목록 */}
      {returnRequests.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-lg">
          <RotateCcw className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">취소/반품 내역이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {returnRequests.map((request) => (
            <div
              key={request.id}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden"
            >
              {/* 헤더 */}
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full font-medium">
                    {returnTypeLabels[request.requestType]}
                  </span>
                  <span className="text-sm text-gray-600">
                    요청일: {formatDate(request.requestedAt)}
                  </span>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    statusColors[request.status] || 'text-gray-600 bg-gray-50'
                  }`}
                >
                  {statusLabels[request.status] || request.status}
                </span>
              </div>

              {/* 내용 */}
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 좌측: 요청 정보 */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">사유</h4>
                      <p className="text-gray-900">{request.reason}</p>
                      {request.reasonDetail && (
                        <p className="text-sm text-gray-600 mt-1">
                          {request.reasonDetail}
                        </p>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">환불 금액</h4>
                      <p className="text-lg font-bold text-[#FF6B6B]">
                        {formatPrice(request.refundAmount)}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">환불 방법</h4>
                      <p className="text-gray-900">
                        {request.refundMethod === 'CREDIT_CARD' && '신용카드'}
                        {request.refundMethod === 'BANK_TRANSFER' && '계좌이체'}
                        {request.refundMethod === 'POINTS' && '포인트'}
                      </p>
                    </div>
                  </div>

                  {/* 우측: 처리 현황 */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">처리 현황</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="text-sm text-gray-700">
                            요청: {formatDate(request.requestedAt)}
                          </span>
                        </div>
                        {request.processedAt && (
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-sm text-gray-700">
                              처리: {formatDate(request.processedAt)}
                            </span>
                          </div>
                        )}
                        {request.completedAt && (
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                            <span className="text-sm text-gray-700">
                              완료: {formatDate(request.completedAt)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {request.status === 'REJECTED' && (
                      <div className="bg-red-50 border border-red-200 rounded-md p-4">
                        <p className="text-sm text-red-700 font-medium">
                          요청이 거부되었습니다
                        </p>
                        <p className="text-sm text-red-600 mt-1">
                          자세한 내용은 고객센터로 문의해주세요
                        </p>
                      </div>
                    )}

                    {request.status === 'COMPLETED' && (
                      <div className="bg-green-50 border border-green-200 rounded-md p-4">
                        <p className="text-sm text-green-700 font-medium">
                          처리가 완료되었습니다
                        </p>
                        <p className="text-sm text-green-600 mt-1">
                          환불은 3-5 영업일 소요됩니다
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
