'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Trash2, RefreshCw } from 'lucide-react'
import Button from '@/components/ui/Button'
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

export default function PolicyManagePage() {
  const router = useRouter()
  const toast = useToast()
  const [policies, setPolicies] = useState<PricingPolicy[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 10

  // 선택 삭제 관련 상태
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [selectAll, setSelectAll] = useState(false)

  useEffect(() => {
    loadPolicies()
  }, [currentPage])

  const loadPolicies = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/policy?search=${searchTerm}&page=${currentPage}&limit=${itemsPerPage}`)
      const data = await response.json()

      if (data.success) {
        setPolicies(data.data)
        setTotalItems(data.pagination?.total || 0)
        setTotalPages(data.pagination?.totalPages || 1)
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

  const handleSearch = () => {
    setCurrentPage(1)
    loadPolicies()
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
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) {
      return
    }

    if (!confirm(`선택한 ${selectedIds.length}개의 정책을 삭제하시겠습니까?`)) {
      return
    }

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
      loadPolicies()

      if (successCount > 0) {
        toast.success(`${successCount}개의 정책이 삭제되었습니다.`)
      } else {
        toast.error('정책 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('정책 일괄 삭제 실패:', error)
      toast.error('정책 삭제에 실패했습니다.')
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
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        활성
      </span>
    ) : (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        비활성
      </span>
    )
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

        {/* 컨트롤 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex gap-2 flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <Input
                    type="text"
                    placeholder="정책 이름으로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10"
                  />
                </div>
                <Button variant="secondary" onClick={handleSearch}>
                  검색
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={loadPolicies}
                  disabled={isLoading}
                >
                  <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                  새로고침
                </Button>
                <Button variant="primary" onClick={() => router.push('/policy/new')}>
                  <Plus size={16} />
                  정책 추가
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDeleteSelected}
                  disabled={selectedIds.length === 0}
                >
                  <Trash2 size={16} />
                  선택 삭제 ({selectedIds.length})
                </Button>
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
                      className="w-4 h-4 cursor-pointer"
                    />
                  </TableHead>
                  <TableHead className="w-[20%]">이름</TableHead>
                  <TableHead className="w-[30%]">설명</TableHead>
                  <TableHead className="w-[20%]">정책 내용</TableHead>
                  <TableHead className="w-[10%]">상태</TableHead>
                  <TableHead className="w-[15%]">생성일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.length === 0 ? (
                  <TableEmpty message="등록된 정책이 없습니다." />
                ) : (
                  policies.map((policy) => (
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
                          className="w-4 h-4 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-gray-900 text-base">{policy.name}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600">
                          {policy.description ? truncateText(policy.description, 50) : '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600 text-sm">
                          {truncateText(policy.content, 30)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(policy.isActive)}
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600 text-sm">
                          {new Date(policy.createdAt).toLocaleDateString('ko-KR')}
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
    </div>
  )
}
