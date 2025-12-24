'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Search,
  Trash2,
  Lock,
  RefreshCw,
} from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/Table'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import Pagination from '@/components/ui/Pagination'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

interface PrivacyPolicy {
  id: number
  name: string
  content: string
  main: number
  sub: number
  createdAt: string
  updatedAt: string
}

export default function PrivacyPolicyListPage() {
  const router = useRouter()
  const toast = useToast()
  const [items, setItems] = useState<PrivacyPolicy[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

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
    loadItems()
  }, [currentPage, searchTerm])

  const loadItems = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      })
      if (searchTerm) params.set('search', searchTerm)

      const response = await fetch(`/api/policy/privacy?${params}`)
      const data = await response.json()

      if (data.success) {
        setItems(data.data)
        setTotalItems(data.pagination?.total || 0)
        setTotalPages(data.pagination?.totalPages || 1)
      } else {
        toast.error(data.error || '목록을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('목록 조회 실패:', error)
      toast.error('목록을 불러오는데 실패했습니다.')
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
      const allIds = items.map(item => item.id)
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

      setSelectAll(newSelection.length === items.length)
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
          const response = await fetch(`/api/policy/privacy/${id}`, {
            method: 'DELETE',
          })
          const data = await response.json()
          if (data.success) successCount++
        } catch (error) {
          console.error(`삭제 실패 (ID: ${id}):`, error)
        }
      }

      setSelectedIds([])
      setSelectAll(false)
      setShowDeleteConfirm(false)
      loadItems()

      if (successCount > 0) {
        toast.success(`${successCount}개의 개인정보처리방침이 삭제되었습니다.`)
      } else {
        toast.error('삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('일괄 삭제 실패:', error)
      toast.error('삭제에 실패했습니다.')
    } finally {
      setIsDeleting(false)
    }
  }

  // 행 클릭 시 상세 페이지로 이동
  const handleRowClick = (id: number) => {
    router.push(`/shop/policy/privacy/detail/${id}`)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}`
  }

  const formatVersion = (main: number, sub: number) => {
    return `${main}.${sub}`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">개인정보처리방침 관리</h1>
          <p className="text-gray-600">
            개인정보처리방침을 관리합니다.
          </p>
        </div>

        {/* 통계 및 액션 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Lock size={24} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">전체</p>
                <p className="text-2xl font-bold text-gray-900">{totalItems}</p>
              </div>
            </div>
          </div>
          {/* 추가 카드 */}
          <button
            onClick={() => router.push('/shop/policy/privacy/new')}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-purple-300 hover:bg-purple-50 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Plus size={24} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">개인정보처리방침</p>
                <p className="text-lg font-bold text-purple-600">추가하기</p>
              </div>
            </div>
          </button>
          {/* 삭제 카드 */}
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
              {/* 왼쪽: 새로고침 */}
              <Button
                variant="secondary"
                onClick={loadItems}
                disabled={isLoading}
              >
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                새로고침
              </Button>

              {/* 오른쪽: 검색 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <Input
                  type="text"
                  placeholder="개인정보처리방침 이름으로 검색..."
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
                      className="w-4 h-4 cursor-pointer rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                  </TableHead>
                  <TableHead className="w-[10%]">버전</TableHead>
                  <TableHead className="w-[40%]">이름</TableHead>
                  <TableHead className="w-[20%]">생성일</TableHead>
                  <TableHead className="w-[20%]">수정일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableEmpty message="등록된 개인정보처리방침이 없습니다." />
                ) : (
                  items.map((item) => (
                    <TableRow
                      key={item.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleRowClick(item.id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={(e) => handleToggleSelection(item.id, e as unknown as React.MouseEvent)}
                          className="w-4 h-4 cursor-pointer rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                          v{formatVersion(item.main, item.sub)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-gray-900">{item.name}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600 text-sm">
                          {formatDate(item.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600 text-sm">
                          {formatDate(item.updatedAt)}
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
        title="개인정보처리방침 삭제"
        message={`선택한 ${selectedIds.length}개의 개인정보처리방침을 삭제하시겠습니까?`}
        confirmText="삭제"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}
