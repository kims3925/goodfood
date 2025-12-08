'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Search,
  Trash2,
  FileText,
  CheckCircle,
  XCircle,
  Calendar,
} from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/Table'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import Pagination from '@/components/ui/Pagination'
import { useToast } from '@/components/ui/Toast'

interface PricingPolicy {
  id: number
  userId: number
  name: string
  description: string | null
  content: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const statusOptions = [
  { value: 'ALL', label: '전체', icon: FileText, color: 'text-gray-600' },
  { value: 'ACTIVE', label: '활성', icon: CheckCircle, color: 'text-green-600' },
  { value: 'INACTIVE', label: '비활성', icon: XCircle, color: 'text-gray-500' },
]

export default function PolicyManagePage() {
  const router = useRouter()
  const toast = useToast()
  const [policies, setPolicies] = useState<PricingPolicy[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
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

  useEffect(() => {
    loadPolicies()
  }, [currentPage, statusFilter, searchTerm])

  const loadPolicies = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      })
      if (searchTerm) params.set('search', searchTerm)
      if (statusFilter !== 'ALL') {
        params.set('isActive', statusFilter === 'ACTIVE' ? 'true' : 'false')
      }

      const response = await fetch(`/api/policy?${params}`)
      const data = await response.json()

      if (data.success) {
        setPolicies(data.data)
        setTotalItems(data.pagination?.total || 0)
        setTotalPages(data.pagination?.totalPages || 1)

        // 통계 계산
        const allPolicies = data.data
        setStats({
          total: data.pagination?.total || allPolicies.length,
          active: allPolicies.filter((p: PricingPolicy) => p.isActive).length,
          inactive: allPolicies.filter((p: PricingPolicy) => !p.isActive).length,
        })
      } else {
        toast.error('정책 목록을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('정책 목록 조회 실패:', error)
      toast.error('정책 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  // 전체 선택/해제
  const handleToggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds([])
      setSelectAll(false)
    } else {
      const allIds = policies.map(policy => policy.id)
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

      setSelectAll(newSelection.length === policies.length)
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
          const response = await fetch(`/api/policy?id=${id}`, {
            method: 'DELETE',
          })
          const data = await response.json()
          if (data.success) successCount++
        } catch (error) {
          console.error(`정책 삭제 실패 (ID: ${id}):`, error)
        }
      }

      setSelectedIds([])
      setSelectAll(false)
      setShowDeleteConfirm(false)
      loadPolicies()

      if (successCount > 0) {
        toast.success(`${successCount}개의 정책이 삭제되었습니다.`)
      } else {
        toast.error('정책 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('정책 일괄 삭제 실패:', error)
      toast.error('정책 삭제에 실패했습니다.')
    } finally {
      setIsDeleting(false)
    }
  }

  // 행 클릭 시 상세 페이지로 이동
  const handleRowClick = (id: number) => {
    router.push(`/policy/detail/${id}`)
  }

  const truncateText = (text: string, maxLength: number = 50) => {
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + '...'
    }
    return text
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
    }).replace(/\. /g, '.').replace(/\.$/, '')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">정책 관리</h1>
          <p className="text-gray-600">
            AI가 게시물을 상품으로 변환할 때 참조하는 가격 정책을 관리합니다.
          </p>
        </div>

        {/* 통계 및 액션 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gray-100 rounded-lg">
                <FileText size={24} className="text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">전체 정책</p>
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
                <p className="text-sm text-gray-500">활성 정책</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gray-100 rounded-lg">
                <XCircle size={24} className="text-gray-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">비활성 정책</p>
                <p className="text-2xl font-bold text-gray-500">{stats.inactive}</p>
              </div>
            </div>
          </div>
          {/* 정책 추가 카드 */}
          <button
            onClick={() => router.push('/policy/new')}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Plus size={24} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">정책</p>
                <p className="text-lg font-bold text-blue-600">추가하기</p>
              </div>
            </div>
          </button>
          {/* 정책 삭제 카드 */}
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
              {/* 왼쪽: 상태 필터 */}
              <div className="flex items-center gap-1">
                {statusOptions.map((status) => {
                  const Icon = status.icon
                  return (
                    <button
                      key={status.value}
                      onClick={() => { setStatusFilter(status.value); setCurrentPage(1) }}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                        statusFilter === status.value
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <Icon size={14} />
                      {status.label}
                    </button>
                  )
                })}
              </div>

              {/* 오른쪽: 검색 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <Input
                  type="text"
                  placeholder="정책 이름으로 검색..."
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
                  <TableHead className="w-[5%]">순서</TableHead>
                  <TableHead className="w-[20%]">이름</TableHead>
                  <TableHead className="w-[30%]">설명</TableHead>
                  <TableHead className="w-[20%]">정책 내용</TableHead>
                  <TableHead className="w-[10%]">상태</TableHead>
                  <TableHead className="w-[10%]">생성일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.length === 0 ? (
                  <TableEmpty message="등록된 정책이 없습니다." />
                ) : (
                  policies.map((policy, index) => (
                    <TableRow
                      key={policy.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleRowClick(policy.id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(policy.id)}
                          onChange={(e) => handleToggleSelection(policy.id, e as unknown as React.MouseEvent)}
                          className="w-4 h-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-500 text-sm">
                          {(currentPage - 1) * itemsPerPage + index + 1}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-gray-900">{policy.name}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600">
                          {policy.description ? truncateText(policy.description, 50) : '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-500 text-sm">
                          {truncateText(policy.content, 30)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(policy.isActive)}
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-500 text-sm flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDate(policy.createdAt)}
                        </span>
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
        title="정책 삭제"
        message={`선택한 ${selectedIds.length}개의 정책을 삭제하시겠습니까?`}
        confirmText="삭제"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}
