'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, RefreshCw, Package, Trash2, Send, Store } from 'lucide-react'
import Button from '@/components/ui/Button'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/Table'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import Pagination from '@/components/ui/Pagination'
import { useToast } from '@/components/ui/Toast'

interface PublishedProduct {
  id: number
  userId: number
  productId: number
  channelId: number | null
  createdAt: string
  updatedAt: string
  product: {
    id: number
    name: string
    thumbnailUrl: string | null
    price: number | null
    wholesalePrice: number | null
  }
  channel: {
    id: number
    name: string
    channelKey: string
  } | null
}

interface GroupedPublishedProduct {
  productId: number
  product: {
    id: number
    name: string
    thumbnailUrl: string | null
    price: number | null
    wholesalePrice: number | null
  }
  publishes: Array<{
    id: number
    channelId: number | null
    createdAt: string
    channel: {
      id: number
      name: string
      channelKey: string
    } | null
  }>
}

export default function PublishedProductListPage() {
  const router = useRouter()
  const toast = useToast()
  const [products, setProducts] = useState<PublishedProduct[]>([])
  const [groupedProducts, setGroupedProducts] = useState<GroupedPublishedProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 10

  // Selection states - productId 기준으로 변경
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])
  const [selectAll, setSelectAll] = useState(false)

  // Delete confirm modal states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // 상품별로 그룹화하는 함수
  const groupByProduct = (items: PublishedProduct[]): GroupedPublishedProduct[] => {
    const grouped = new Map<number, GroupedPublishedProduct>()

    items.forEach((item) => {
      if (!grouped.has(item.productId)) {
        grouped.set(item.productId, {
          productId: item.productId,
          product: item.product,
          publishes: [],
        })
      }
      grouped.get(item.productId)!.publishes.push({
        id: item.id,
        channelId: item.channelId,
        createdAt: item.createdAt,
        channel: item.channel,
      })
    })

    return Array.from(grouped.values())
  }

  useEffect(() => {
    loadProducts()
  }, [currentPage, statusFilter])

  const loadProducts = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        search: searchTerm,
        page: currentPage.toString(),
        limit: '100', // 그룹화를 위해 더 많은 데이터 조회
      })
      if (statusFilter !== 'ALL') {
        params.append('status', statusFilter)
      }

      const response = await fetch(`/api/product/publish?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setProducts(data.data)
        const grouped = groupByProduct(data.data)
        setGroupedProducts(grouped)
        setTotalItems(grouped.length)
        setTotalPages(Math.ceil(grouped.length / itemsPerPage))
      } else {
        toast.error('발행 상품 목록을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('발행 상품 목록 조회 실패:', error)
      toast.error('발행 상품 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 현재 페이지에 해당하는 그룹화된 상품 가져오기
  const getCurrentPageProducts = () => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return groupedProducts.slice(startIndex, endIndex)
  }

  const handleSearch = () => {
    setCurrentPage(1)
    loadProducts()
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleToggleSelectAll = () => {
    const currentProducts = getCurrentPageProducts()
    if (selectAll) {
      setSelectedProductIds([])
      setSelectAll(false)
    } else {
      const allProductIds = currentProducts.map((p) => p.productId)
      setSelectedProductIds(allProductIds)
      setSelectAll(true)
    }
  }

  const handleToggleSelection = (productId: number) => {
    const currentProducts = getCurrentPageProducts()
    setSelectedProductIds((prev) => {
      const newSelection = prev.includes(productId)
        ? prev.filter((pid) => pid !== productId)
        : [...prev, productId]
      setSelectAll(newSelection.length === currentProducts.length)
      return newSelection
    })
  }

  const handleDeleteSelected = () => {
    if (selectedProductIds.length === 0) {
      return
    }
    setShowDeleteConfirm(true)
  }

  // 선택된 상품들의 모든 발행 ID 가져오기
  const getSelectedPublishIds = (): number[] => {
    const publishIds: number[] = []
    selectedProductIds.forEach((productId) => {
      const grouped = groupedProducts.find((g) => g.productId === productId)
      if (grouped) {
        grouped.publishes.forEach((p) => publishIds.push(p.id))
      }
    })
    return publishIds
  }

  const confirmDeleteSelected = async () => {
    setIsDeleting(true)
    try {
      const publishIds = getSelectedPublishIds()
      let successCount = 0

      for (const id of publishIds) {
        try {
          const response = await fetch(`/api/product/publish?id=${id}`, {
            method: 'DELETE',
          })
          const data = await response.json()
          if (data.success) successCount++
        } catch (error) {
          console.error(`발행 상품 삭제 실패 (ID: ${id}):`, error)
        }
      }

      setSelectedProductIds([])
      setSelectAll(false)
      setShowDeleteConfirm(false)
      loadProducts()

      if (successCount > 0) {
        toast.success(`${successCount}개의 발행이 삭제되었습니다.`)
      } else {
        toast.error('발행 상품 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('발행 상품 일괄 삭제 실패:', error)
      toast.error('발행 상품 삭제에 실패했습니다.')
    } finally {
      setIsDeleting(false)
    }
  }

  // 선택된 상품의 총 발행 건수 계산
  const getSelectedPublishCount = (): number => {
    return getSelectedPublishIds().length
  }

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; color: string } } = {
      PENDING: { label: '대기중', color: 'bg-yellow-100 text-yellow-800' },
      SUCCESS: { label: '발행완료', color: 'bg-green-100 text-green-800' },
      FAILED: { label: '발행실패', color: 'bg-red-100 text-red-800' },
    }

    const statusInfo = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    )
  }

  const formatPrice = (price: number | null) => {
    if (!price) return '-'
    return `₩${price.toLocaleString()}`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">발행 상품 관리</h1>
          <p className="text-gray-600">
            소매밴드에 발행된 상품 목록을 관리합니다. 발행 상태를 확인하고 관리할 수 있습니다.
          </p>
        </div>

        {/* 컨트롤 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex gap-2 flex-1 max-w-lg">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <Input
                    type="text"
                    placeholder="상품명 또는 밴드명으로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-color"
                >
                  <option value="ALL">전체 상태</option>
                  <option value="PENDING">대기중</option>
                  <option value="SUCCESS">발행완료</option>
                  <option value="FAILED">발행실패</option>
                </select>
                <Button variant="secondary" onClick={handleSearch}>
                  검색
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={loadProducts}
                  disabled={isLoading}
                >
                  <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                  새로고침
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDeleteSelected}
                  disabled={selectedProductIds.length === 0}
                >
                  <Trash2 size={16} />
                  선택 삭제
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
                  <TableHead className="w-[5%]">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </TableHead>
                  <TableHead className="w-[30%]">상품명</TableHead>
                  <TableHead className="w-[10%]">도매가</TableHead>
                  <TableHead className="w-[10%]">판매가</TableHead>
                  <TableHead className="w-[45%]">소매밴드 발행 현황</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getCurrentPageProducts().length === 0 ? (
                  <TableEmpty message="발행된 상품이 없습니다." />
                ) : (
                  getCurrentPageProducts().map((item) => (
                    <TableRow
                      key={item.productId}
                      className="hover:bg-gray-50 cursor-pointer align-top"
                      onClick={() => router.push(`/product/detail/${item.productId}`)}
                    >
                      <TableCell
                        onClick={(e) => e.stopPropagation()}
                        className="align-top pt-4"
                      >
                        <input
                          type="checkbox"
                          checked={selectedProductIds.includes(item.productId)}
                          onChange={() => handleToggleSelection(item.productId)}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex items-start gap-3">
                          {item.product?.thumbnailUrl ? (
                            <img
                              src={item.product.thumbnailUrl}
                              alt={item.product.name}
                              className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                              <Package size={24} className="text-gray-400" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-gray-900 text-base">
                              {item.product?.name || '상품 정보 없음'}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {item.publishes.length}개 밴드에 발행
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top pt-4">
                        <div className="font-medium text-gray-900">
                          {formatPrice(item.product?.wholesalePrice)}
                        </div>
                      </TableCell>
                      <TableCell className="align-top pt-4">
                        <div className="font-medium text-gray-900">
                          {formatPrice(item.product?.price)}
                        </div>
                      </TableCell>
                      <TableCell className="align-top" onClick={(e) => e.stopPropagation()}>
                        <div className="space-y-2">
                          {item.publishes.map((publish) => (
                            <div
                              key={publish.id}
                              className="flex items-center justify-between gap-4 py-1.5 px-3 bg-gray-50 rounded-lg"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <Store size={14} className="text-gray-400 flex-shrink-0" />
                                <span className="text-sm text-gray-700 truncate">
                                  {publish.channel?.name || '-'}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                <span className="text-xs text-gray-500">
                                  {new Date(publish.createdAt).toLocaleDateString('ko-KR')}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
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
        title="발행 상품 삭제"
        message={`선택한 ${selectedProductIds.length}개 상품의 총 ${getSelectedPublishCount()}건의 발행을 삭제하시겠습니까?`}
        confirmText="삭제"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}
