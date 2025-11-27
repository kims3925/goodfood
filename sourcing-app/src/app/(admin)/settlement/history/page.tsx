'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  ArrowLeft,
  Store,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Filter,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Loading from '@/components/ui/Loading'

interface Settlement {
  id: number
  retailBand: {
    id: number
    name: string
    coverUrl: string | null
  }
  periodStart: string
  periodEnd: string
  totalOrders: number
  totalAmount: number
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED'
  memo: string | null
  settledAt: string | null
  createdAt: string
  orderCount: number
}

interface Stats {
  PENDING: { count: number; totalAmount: number; totalOrders: number }
  COMPLETED: { count: number; totalAmount: number; totalOrders: number }
  CANCELLED: { count: number; totalAmount: number; totalOrders: number }
}

export default function SettlementHistoryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  })

  // 필터
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [updating, setUpdating] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', pagination.page.toString())
      params.set('limit', pagination.limit.toString())
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/settlement/history?${params}`)
      const result = await res.json()

      if (result.success) {
        setSettlements(result.data.settlements)
        setPagination(prev => ({
          ...prev,
          ...result.data.pagination,
        }))
        setStats(result.data.stats)
      }
    } catch (error) {
      console.error('정산 이력 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, statusFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const formatPrice = (price: number) => {
    return `${price.toLocaleString()}원`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
            <Clock size={12} />
            대기중
          </span>
        )
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            <CheckCircle size={12} />
            완료
          </span>
        )
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
            <XCircle size={12} />
            취소
          </span>
        )
      default:
        return null
    }
  }

  const handleStatusChange = async (settlementId: number, newStatus: string) => {
    if (!confirm(`정산 상태를 ${newStatus === 'COMPLETED' ? '완료' : '취소'}로 변경하시겠습니까?`)) return

    setUpdating(settlementId)
    try {
      const res = await fetch(`/api/settlement/${settlementId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      const result = await res.json()

      if (result.success) {
        fetchData()
      } else {
        alert(result.error || '상태 변경에 실패했습니다.')
      }
    } catch (error) {
      alert('상태 변경에 실패했습니다.')
    } finally {
      setUpdating(null)
    }
  }

  const handleDelete = async (settlementId: number) => {
    if (!confirm('이 정산을 삭제하시겠습니까?')) return

    setUpdating(settlementId)
    try {
      const res = await fetch(`/api/settlement/${settlementId}`, {
        method: 'DELETE',
      })

      const result = await res.json()

      if (result.success) {
        fetchData()
      } else {
        alert(result.error || '삭제에 실패했습니다.')
      }
    } catch (error) {
      alert('삭제에 실패했습니다.')
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/settlement/list')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft size={20} />
            정산 관리로 돌아가기
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">정산 이력</h1>
          <p className="text-gray-600">
            생성된 정산 내역을 확인하고 상태를 관리합니다.
          </p>
        </div>

        {/* 통계 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                  <Clock className="text-yellow-600" size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">대기중</p>
                  <p className="text-xl font-bold text-gray-900">
                    {stats.PENDING.count}건 / {formatPrice(stats.PENDING.totalAmount)}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <CheckCircle className="text-green-600" size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">완료</p>
                  <p className="text-xl font-bold text-gray-900">
                    {stats.COMPLETED.count}건 / {formatPrice(stats.COMPLETED.totalAmount)}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <XCircle className="text-red-600" size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">취소</p>
                  <p className="text-xl font-bold text-gray-900">
                    {stats.CANCELLED.count}건 / {formatPrice(stats.CANCELLED.totalAmount)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 필터 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPagination(prev => ({ ...prev, page: 1 }))
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">전체 상태</option>
                <option value="PENDING">대기중</option>
                <option value="COMPLETED">완료</option>
                <option value="CANCELLED">취소</option>
              </select>
            </div>
            <Button variant="secondary" onClick={fetchData} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              새로고침
            </Button>
          </div>
        </div>

        {/* 목록 */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
            <Loading />
          </div>
        ) : settlements.length > 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      소매밴드
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      정산 기간
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      주문 수
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      정산 금액
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      생성일
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      관리
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {settlements.map((settlement) => (
                    <tr key={settlement.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          {settlement.retailBand.coverUrl ? (
                            <Image
                              src={settlement.retailBand.coverUrl}
                              alt={settlement.retailBand.name}
                              width={40}
                              height={40}
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                              <Store size={16} className="text-white" />
                            </div>
                          )}
                          <span className="font-medium text-gray-900">
                            {settlement.retailBand.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar size={14} className="text-gray-400" />
                          {formatDate(settlement.periodStart)} ~ {formatDate(settlement.periodEnd)}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900 font-medium">
                        {settlement.totalOrders}건
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900 font-bold">
                        {formatPrice(settlement.totalAmount)}
                      </td>
                      <td className="px-4 py-4">
                        {getStatusBadge(settlement.status)}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {formatDate(settlement.createdAt)}
                      </td>
                      <td className="px-4 py-4">
                        {settlement.status === 'PENDING' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleStatusChange(settlement.id, 'COMPLETED')}
                              disabled={updating === settlement.id}
                              className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                            >
                              완료
                            </button>
                            <button
                              onClick={() => handleDelete(settlement.id)}
                              disabled={updating === settlement.id}
                              className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                            >
                              삭제
                            </button>
                          </div>
                        )}
                        {settlement.status === 'COMPLETED' && settlement.settledAt && (
                          <span className="text-xs text-gray-500">
                            {formatDate(settlement.settledAt)} 완료
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            {pagination.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  총 {pagination.total}건 중 {(pagination.page - 1) * pagination.limit + 1}-
                  {Math.min(pagination.page * pagination.limit, pagination.total)}건
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="px-3 py-2 text-sm">
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.totalPages}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">정산 이력이 없습니다</h3>
            <p className="text-gray-500 mb-4">
              정산 관리 페이지에서 정산을 생성해보세요.
            </p>
            <Button variant="primary" onClick={() => router.push('/settlement/list')}>
              정산 관리로 이동
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
