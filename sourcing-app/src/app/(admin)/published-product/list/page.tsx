'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, RefreshCw, Package, Trash2, Filter, X, Store } from 'lucide-react'
import Button from '@/components/ui/Button'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/Table'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import Pagination from '@/components/ui/Pagination'
import { useToast } from '@/components/ui/Toast'
import Image from 'next/image'

interface Channel {
  id: number
  name: string
  coverUrl: string | null
  platform: string
}

interface PublishedProduct {
  id: number
  userId: number
  productId: number
  channelId: number | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  product: {
    id: number
    name: string
    thumbnailUrl: string | null
    price: number | null
    wholesalePrice: number | null
    status: string
  }
  channel: {
    id: number
    name: string
    coverUrl: string | null
    platform: string
  } | null
}

export default function PublishedProductListPage() {
  const router = useRouter()
  const toast = useToast()
  const [products, setProducts] = useState<PublishedProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [query, setQuery] = useState('')

  // Filter states
  const [showFilters, setShowFilters] = useState(false)
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 10

  // Selection states
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [selectAll, setSelectAll] = useState(false)

  // Delete confirm modal states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    loadChannels()
  }, [])

  const loadChannels = async () => {
    try {
      const response = await fetch('/api/channel?kind=RETAIL&limit=100')
      const data = await response.json()
      if (data.success) {
        setChannels(data.data)
      }
    } catch (error) {
      console.error('채널 목록 조회 실패:', error)
    }
  }

  const loadProducts = useCallback(async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      })

      if (query) params.append('search', query)
      if (selectedChannelId) params.append('channelId', selectedChannelId)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await fetch(`/api/published-product?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setProducts(data.data)
        setTotalItems(data.total || 0)
        setTotalPages(Math.ceil((data.total || 0) / itemsPerPage))
      } else {
        toast.error('발행상품 목록을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('발행상품 목록 조회 실패:', error)
      toast.error('발행상품 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [currentPage, selectedChannelId, startDate, endDate, query, itemsPerPage, toast])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const handleClearFilters = () => {
    setSelectedChannelId('')
    setStartDate('')
    setEndDate('')
    setSearchTerm('')
    setQuery('')
    setCurrentPage(1)
  }

  const hasActiveFilters = selectedChannelId || startDate || endDate || Boolean(query)

  const handleSearch = () => {
    setCurrentPage(1)
    if (query === searchTerm) {
      loadProducts()
    } else {
      setQuery(searchTerm)
    }
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleToggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds([])
      setSelectAll(false)
    } else {
      const allIds = products.map((p) => p.id)
      setSelectedIds(allIds)
      setSelectAll(true)
    }
  }

  const handleToggleSelection = (id: number) => {
    setSelectedIds((prev) => {
      const newSelection = prev.includes(id)
        ? prev.filter((pid) => pid !== id)
        : [...prev, id]
      setSelectAll(newSelection.length === products.length)
      return newSelection
    })
  }

  const handleDeleteProduct = (id: number) => {
    setDeleteTargetId(id)
    setShowDeleteConfirm(true)
  }

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) {
      return
    }
    setDeleteTargetId(null)
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    setIsDeleting(true)
    try {
      if (deleteTargetId !== null) {
        // 단일 삭제
        const response = await fetch(`/api/published-product?id=${deleteTargetId}`, {
          method: 'DELETE',
        })
        const data = await response.json()

        if (data.success) {
          toast.success('발행상품이 삭제되었습니다.')
          loadProducts()
        } else {
          toast.error('발행상품 삭제에 실패했습니다.')
        }
      } else {
        // 일괄 삭제
        let successCount = 0
        for (const id of selectedIds) {
          try {
            const response = await fetch(`/api/published-product?id=${id}`, {
              method: 'DELETE',
            })
            const data = await response.json()
            if (data.success) successCount++
          } catch (error) {
            console.error(`발행상품 삭제 실패 (ID: ${id}):`, error)
          }
        }

        setSelectedIds([])
        setSelectAll(false)
        loadProducts()

        if (successCount > 0) {
          toast.success(`${successCount}개의 발행상품이 삭제되었습니다.`)
        } else {
          toast.error('발행상품 삭제에 실패했습니다.')
        }
      }
    } catch (error) {
      console.error('발행상품 삭제 실패:', error)
      toast.error('발행상품 삭제에 실패했습니다.')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
      setDeleteTargetId(null)
    }
  }

  const getChannelBadge = (product: PublishedProduct) => {
    if (product.channel) {
      return (
        <div className="flex items-center gap-2">
          <Store size={16} className="text-gray-400" />
          <span className="text-gray-600">{product.channel.name}</span>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-2">
        <Store size={16} className="text-blue-400" />
        <span className="text-blue-600">쇼핑몰</span>
      </div>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">발행상품 관리</h1>
          <p className="text-gray-600">
            소매 채널 또는 쇼핑몰에 발행된 상품 목록을 관리합니다. 발행 상태를 확인하고 재발행하거나 삭제할 수 있습니다.
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
                    placeholder="상품명으로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10"
                  />
                </div>
                <Button variant="secondary" onClick={handleSearch}>
                  검색
                </Button>
                <Button
                  variant={showFilters || hasActiveFilters ? 'primary' : 'secondary'}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter size={16} />
                  필터
                  {hasActiveFilters && (
                    <span className="ml-1 bg-white text-purple-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                      !
                    </span>
                  )}
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
                  disabled={selectedIds.length === 0}
                >
                  <Trash2 size={16} />
                  선택 삭제 ({selectedIds.length})
                </Button>
              </div>
            </div>
          </div>

          {/* 필터 영역 */}
          {showFilters && (
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <div className="flex flex-wrap gap-4 items-end">
                {/* 채널 필터 */}
                <div className="w-48">
                  <label className="block text-sm font-medium text-gray-700 mb-1">발행 채널</label>
                  <select
                    value={selectedChannelId}
                    onChange={(e) => {
                      setSelectedChannelId(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                  >
                    <option value="">전체 채널</option>
                    {channels.map((channel) => (
                      <option key={channel.id} value={channel.id.toString()}>
                        {channel.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 날짜 필터 */}
                <div className="w-40">
                  <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                  />
                </div>

                <div className="w-40">
                  <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                  />
                </div>

                {/* 필터 초기화 버튼 */}
                {hasActiveFilters && (
                  <Button variant="secondary" onClick={handleClearFilters}>
                    <X size={16} />
                    필터 초기화
                  </Button>
                )}
              </div>

              {/* 활성 필터 태그 */}
              {hasActiveFilters && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedChannelId && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                      채널: {channels.find(c => c.id.toString() === selectedChannelId)?.name}
                      <button
                        onClick={() => {
                          setSelectedChannelId('')
                          setCurrentPage(1)
                        }}
                        className="hover:text-purple-600"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  )}
                  {startDate && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                      시작일: {startDate}
                      <button
                        onClick={() => {
                          setStartDate('')
                          setCurrentPage(1)
                        }}
                        className="hover:text-purple-600"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  )}
                  {endDate && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                      종료일: {endDate}
                      <button
                        onClick={() => {
                          setEndDate('')
                          setCurrentPage(1)
                        }}
                        className="hover:text-purple-600"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 테이블 */}
          {isLoading ? (
            <div className="p-12">
              <Loading />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[4%]">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </TableHead>
                  <TableHead className="w-[28%]">상품명</TableHead>
                  <TableHead className="w-[15%]">발행 채널</TableHead>
                  <TableHead className="w-[9%]">도매가</TableHead>
                  <TableHead className="w-[9%]">판매가</TableHead>
                  <TableHead className="w-[10%]">발행일</TableHead>
                  <TableHead className="w-[15%]">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableEmpty message="발행된 상품이 없습니다." />
                ) : (
                  products.map((product) => (
                  <TableRow
                    key={product.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/published-product/${product.id}`)}
                  >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(product.id)}
                          onChange={() => handleToggleSelection(product.id)}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {product.product?.thumbnailUrl ? (
                            <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                              <Image
                                src={product.product.thumbnailUrl}
                                alt={product.product.name}
                                fill
                                sizes="56px"
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                              <Package size={24} className="text-gray-400" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-gray-900 text-base truncate">
                              {product.product?.name || '상품 정보 없음'}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getChannelBadge(product)}</TableCell>
                      <TableCell>
                        <div className="font-medium text-gray-900">
                          {formatPrice(product.product?.wholesalePrice)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-gray-900">
                          {formatPrice(product.product?.price)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600 whitespace-nowrap">
                          {product.publishedAt
                            ? new Date(product.publishedAt).toLocaleDateString('ko-KR', {
                                year: '2-digit',
                                month: '2-digit',
                                day: '2-digit',
                              }).replace(/\. /g, '.').replace(/\.$/, '')
                            : '-'}
                        </span>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteProduct(product.id)}
                            title="삭제"
                          >
                            <Trash2 size={14} />
                          </Button>
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
        onClose={() => {
          setShowDeleteConfirm(false)
          setDeleteTargetId(null)
        }}
        onConfirm={confirmDelete}
        title="발행상품 삭제"
        message={
          deleteTargetId !== null
            ? '이 발행상품을 삭제하시겠습니까? 외부 플랫폼에서는 수동으로 삭제해야 합니다.'
            : `선택한 ${selectedIds.length}개의 발행상품을 삭제하시겠습니까?`
        }
        confirmText="삭제"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}
