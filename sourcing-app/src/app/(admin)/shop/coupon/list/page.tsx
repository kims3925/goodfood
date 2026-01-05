'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Search,
  Trash2,
  Ticket,
  CheckCircle,
  XCircle,
  Calendar,
  Percent,
  DollarSign,
  Truck,
} from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/Table'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import Pagination from '@/components/ui/Pagination'
import { useToast } from '@/components/ui/Toast'

interface Coupon {
  id: number
  code: string
  name: string
  description: string | null
  discountType: 'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING'
  discountValue: number
  minPurchaseAmount: number | null
  maxDiscountAmount: number | null
  issuedCount: number
  maxIssueCount: number | null
  validFrom: string
  validUntil: string
  isActive: boolean
  createdAt: string
}

const discountTypeOptions = [
  { value: 'ALL', label: '전체', icon: Ticket, color: 'text-gray-600' },
  { value: 'PERCENTAGE', label: '정률', icon: Percent, color: 'text-blue-600' },
  { value: 'FIXED', label: '정액', icon: DollarSign, color: 'text-green-600' },
  { value: 'FREE_SHIPPING', label: '무료배송', icon: Truck, color: 'text-purple-600' },
]

const statusOptions = [
  { value: 'ALL', label: '전체' },
  { value: 'ACTIVE', label: '활성' },
  { value: 'INACTIVE', label: '비활성' },
]

export default function CouponListPage() {
  const router = useRouter()
  const toast = useToast()
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    percentage: 0,
    fixed: 0,
    freeShipping: 0,
  })

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 20

  // 선택 삭제 관련 상태
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadCoupons = useCallback(async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      })
      if (searchTerm) params.set('search', searchTerm)
      if (typeFilter !== 'ALL') params.set('discountType', typeFilter)
      if (statusFilter !== 'ALL') {
        params.set('isActive', statusFilter === 'ACTIVE' ? 'true' : 'false')
      }

      const response = await fetch(`/api/coupon?${params}`)
      const data = await response.json()

      if (data.success) {
        setCoupons(data.data)
        setTotalItems(data.pagination?.total || 0)
        setTotalPages(data.pagination?.totalPages || 1)
        setStats(data.stats || {
          total: 0,
          active: 0,
          inactive: 0,
          percentage: 0,
          fixed: 0,
          freeShipping: 0,
        })
      } else {
        toast.error('쿠폰 목록을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('쿠폰 목록 조회 실패:', error)
      toast.error('쿠폰 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [currentPage, itemsPerPage, searchTerm, typeFilter, statusFilter, toast])

  useEffect(() => {
    loadCoupons()
  }, [loadCoupons])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  // 전체 선택/해제
  const handleToggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds([])
      setSelectAll(false)
    } else {
      const allIds = coupons.map(coupon => coupon.id)
      setSelectedIds(allIds)
      setSelectAll(true)
    }
  }

  // 개별 선택/해제
  const handleToggleSelection = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds((prev) => {
      const newSelection = prev.includes(id)
        ? prev.filter((i) => i !== id)
        : [...prev, id]

      setSelectAll(newSelection.length === coupons.length)
      return newSelection
    })
  }

  // 선택 삭제
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) {
      return
    }
    setShowDeleteConfirm(true)
  }

  const confirmDeleteSelected = async () => {
    setIsDeleting(true)
    try {
      let successCount = 0
      for (const id of selectedIds) {
        try {
          const response = await fetch(`/api/coupon/${id}`, {
            method: 'DELETE',
          })
          const data = await response.json()
          if (data.success) successCount++
        } catch (error) {
          console.error(`쿠폰 삭제 실패 (ID: ${id}):`, error)
        }
      }

      setSelectedIds([])
      setSelectAll(false)
      setShowDeleteConfirm(false)
      loadCoupons()

      if (successCount > 0) {
        toast.success(`${successCount}개의 쿠폰이 삭제되었습니다.`)
      } else {
        toast.error('쿠폰 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('쿠폰 일괄 삭제 실패:', error)
      toast.error('쿠폰 삭제에 실패했습니다.')
    } finally {
      setIsDeleting(false)
    }
  }

  // 행 클릭 시 상세 페이지로 이동
  const handleRowClick = (id: number) => {
    router.push(`/shop/coupon/detail/${id}`)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
    }).replace(/\. /g, '.').replace(/\.$/, '')
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ko-KR').format(num)
  }

  const getDiscountTypeBadge = (type: Coupon['discountType']) => {
    switch (type) {
      case 'PERCENTAGE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            <Percent size={12} />
            정률
          </span>
        )
      case 'FIXED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <DollarSign size={12} />
            정액
          </span>
        )
      case 'FREE_SHIPPING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
            <Truck size={12} />
            무료배송
          </span>
        )
      default:
        return null
    }
  }

  const getDiscountText = (coupon: Coupon) => {
    switch (coupon.discountType) {
      case 'PERCENTAGE':
        return `${coupon.discountValue}%`
      case 'FIXED':
        return `${formatNumber(coupon.discountValue)}원`
      case 'FREE_SHIPPING':
        return '무료배송'
      default:
        return '-'
    }
  }

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <CheckCircle size={12} />
        활성
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        <XCircle size={12} />
        비활성
      </span>
    )
  }

  const isExpired = (validUntil: string) => {
    return new Date(validUntil) < new Date()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">쿠폰 관리</h1>
          <p className="text-gray-600">
            쿠폰을 생성하고 관리합니다. 정액, 정률, 무료배송 할인을 지원합니다.
          </p>
        </div>

        {/* 통계 및 액션 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gray-100 rounded-lg">
                <Ticket size={24} className="text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">전체 쿠폰</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle size={24} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">활성</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Percent size={24} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">정률</p>
                <p className="text-2xl font-bold text-blue-600">{stats.percentage}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign size={24} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">정액</p>
                <p className="text-2xl font-bold text-green-600">{stats.fixed}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Truck size={24} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">무료배송</p>
                <p className="text-2xl font-bold text-purple-600">{stats.freeShipping}</p>
              </div>
            </div>
          </div>
          {/* 쿠폰 추가 카드 */}
          <button
            onClick={() => router.push('/shop/coupon/new')}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Plus size={24} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">쿠폰</p>
                <p className="text-lg font-bold text-blue-600">추가하기</p>
              </div>
            </div>
          </button>
          {/* 쿠폰 삭제 카드 */}
          <button
            onClick={handleDeleteSelected}
            disabled={selectedIds.length === 0}
            className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-left transition-colors ${
              selectedIds.length > 0
                ? 'hover:border-red-300 hover:bg-red-50 cursor-pointer'
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${selectedIds.length > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                <Trash2 size={24} className={selectedIds.length > 0 ? 'text-red-600' : 'text-gray-400'} />
              </div>
              <div>
                <p className="text-sm text-gray-500">선택 삭제</p>
                <p className={`text-lg font-bold ${selectedIds.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {selectedIds.length}개 선택됨
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* 컨트롤 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              {/* 왼쪽: 필터 */}
              <div className="flex flex-wrap items-center gap-4">
                {/* 할인 유형 필터 */}
                <div className="flex items-center gap-1">
                  {discountTypeOptions.map((type) => {
                    const Icon = type.icon
                    return (
                      <button
                        key={type.value}
                        onClick={() => { setTypeFilter(type.value); setCurrentPage(1) }}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                          typeFilter === type.value
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        <Icon size={14} />
                        {type.label}
                      </button>
                    )
                  })}
                </div>

                {/* 상태 필터 */}
                <div className="flex items-center gap-1 border-l border-gray-200 pl-4">
                  {statusOptions.map((status) => (
                    <button
                      key={status.value}
                      onClick={() => { setStatusFilter(status.value); setCurrentPage(1) }}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        statusFilter === status.value
                          ? 'bg-gray-200 text-gray-900'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 오른쪽: 검색 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <Input
                  type="text"
                  placeholder="쿠폰 이름 또는 코드로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>
          </div>

          {/* 테이블 */}
          {isLoading ? (
            <div className="p-12">
              <Loading />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </TableHead>
                  <TableHead className="w-[15%]">쿠폰 코드</TableHead>
                  <TableHead className="w-[20%]">쿠폰명</TableHead>
                  <TableHead className="w-[10%]">유형</TableHead>
                  <TableHead className="w-[10%]">할인</TableHead>
                  <TableHead className="w-[10%]">발급</TableHead>
                  <TableHead className="w-[15%]">유효기간</TableHead>
                  <TableHead className="w-[10%]">상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.length === 0 ? (
                  <TableEmpty message="등록된 쿠폰이 없습니다." />
                ) : (
                  coupons.map((coupon) => (
                    <TableRow
                      key={coupon.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleRowClick(coupon.id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(coupon.id)}
                          onChange={(e) => handleToggleSelection(coupon.id, e as unknown as React.MouseEvent)}
                          className="w-4 h-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                          {coupon.code}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-gray-900">{coupon.name}</span>
                        {coupon.description && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">
                            {coupon.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {getDiscountTypeBadge(coupon.discountType)}
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-primary-color">
                          {getDiscountText(coupon)}
                        </span>
                        {coupon.maxDiscountAmount && coupon.discountType === 'PERCENTAGE' && (
                          <p className="text-xs text-gray-500">
                            최대 {formatNumber(coupon.maxDiscountAmount)}원
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600">
                          {formatNumber(coupon.issuedCount)}
                          {coupon.maxIssueCount && (
                            <span className="text-gray-400">
                              /{formatNumber(coupon.maxIssueCount)}
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="flex items-center gap-1 text-gray-500">
                            <Calendar size={12} />
                            {formatDate(coupon.validFrom)} ~ {formatDate(coupon.validUntil)}
                          </div>
                          {isExpired(coupon.validUntil) && (
                            <span className="text-xs text-red-500">만료됨</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(coupon.isActive)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
          />
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDeleteSelected}
        title="쿠폰 삭제"
        message={`선택한 ${selectedIds.length}개의 쿠폰을 삭제하시겠습니까? 이미 발급된 사용자 쿠폰도 함께 삭제됩니다.`}
        confirmText="삭제"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}
