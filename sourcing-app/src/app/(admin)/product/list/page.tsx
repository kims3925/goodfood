'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Trash2, RefreshCw, Package, Sparkles } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/Table'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import PostSelectionModal from '@/components/product/PostSelectionModal'
import ProductFormModal from '@/components/product/ProductFormModal'

interface Product {
  id: number
  postId: number
  name: string
  description: string | null
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'SOLDOUT'
  thumbnailUrl: string | null
  price: number | null
  wholesalePrice: number | null
  currency: string
  createdAt: string
  post: {
    title: string
    wholesaleBand: {
      name: string
      coverUrl: string | null
    }
    images: Array<{
      imageUrl: string
    }>
  }
  variants: Array<{
    id: number
    price: number
    stock: number
  }>
}

export default function ProductListPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Modal states
  const [showPostSelectionModal, setShowPostSelectionModal] = useState(false)
  const [showProductFormModal, setShowProductFormModal] = useState(false)
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null)
  const [productDraft, setProductDraft] = useState<any>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // Selection states
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])
  const [selectAll, setSelectAll] = useState(false)

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/product?search=${searchTerm}`)
      const data = await response.json()

      if (data.success) {
        setProducts(data.data)
      }
    } catch (error) {
      console.error('상품 목록 조회 실패:', error)
      alert('상품 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = () => {
    loadProducts()
  }

  const handleOpenAddProductFlow = () => {
    setShowPostSelectionModal(true)
  }

  const handlePostSelected = async (postId: number) => {
    setSelectedPostId(postId)
    setShowPostSelectionModal(false)
    setIsGenerating(true)

    try {
      // AI 상품 생성 API 호출
      const response = await fetch('/api/product/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      })

      const data = await response.json()

      if (data.success) {
        setProductDraft(data.draft)
        setShowProductFormModal(true)
      } else {
        alert(data.error || 'AI 상품 생성에 실패했습니다.')
      }
    } catch (error) {
      console.error('AI 상품 생성 실패:', error)
      alert('AI 상품 생성 중 오류가 발생했습니다.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleProductSaved = () => {
    setShowProductFormModal(false)
    setProductDraft(null)
    setSelectedPostId(null)
    loadProducts()
  }

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/product?id=${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        alert('상품이 삭제되었습니다.')
        loadProducts()
      } else {
        alert(data.error || '삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('상품 삭제 실패:', error)
      alert('상품 삭제에 실패했습니다.')
    }
  }

  const handleToggleSelectAll = () => {
    if (selectAll) {
      setSelectedProductIds([])
      setSelectAll(false)
    } else {
      const allIds = products.map((p) => p.id)
      setSelectedProductIds(allIds)
      setSelectAll(true)
    }
  }

  const handleToggleSelection = (id: string) => {
    setSelectedProductIds((prev) => {
      const newSelection = prev.includes(id)
        ? prev.filter((pid) => pid !== id)
        : [...prev, id]
      setSelectAll(newSelection.length === products.length)
      return newSelection
    })
  }

  const handleDeleteSelected = async () => {
    if (selectedProductIds.length === 0) {
      alert('삭제할 상품을 선택해주세요.')
      return
    }

    if (!confirm(`선택한 ${selectedProductIds.length}개의 상품을 삭제하시겠습니까?`)) {
      return
    }

    try {
      let successCount = 0
      for (const id of selectedProductIds) {
        try {
          const response = await fetch(`/api/product?id=${id}`, {
            method: 'DELETE',
          })
          const data = await response.json()
          if (data.success) successCount++
        } catch (error) {
          console.error(`상품 삭제 실패 (ID: ${id}):`, error)
        }
      }

      alert(`${successCount}개의 상품이 삭제되었습니다.`)
      setSelectedProductIds([])
      setSelectAll(false)
      loadProducts()
    } catch (error) {
      console.error('상품 일괄 삭제 실패:', error)
      alert('상품 삭제에 실패했습니다.')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; color: string } } = {
      DRAFT: { label: '임시저장', color: 'bg-gray-100 text-gray-800' },
      ACTIVE: { label: '판매중', color: 'bg-green-100 text-green-800' },
      INACTIVE: { label: '판매중지', color: 'bg-yellow-100 text-yellow-800' },
      SOLDOUT: { label: '품절', color: 'bg-red-100 text-red-800' },
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">상품 관리</h1>
          <p className="text-gray-600">
            게시물에서 AI로 생성한 상품을 관리합니다. 상품 정보를 수정하고 판매 상태를 관리할 수 있습니다.
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
                <Button variant="primary" onClick={handleOpenAddProductFlow}>
                  <Sparkles size={16} />
                  상품 등록
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDeleteSelected}
                  disabled={selectedProductIds.length === 0}
                >
                  <Trash2 size={16} />
                  선택 삭제 ({selectedProductIds.length})
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
                  <TableHead className="w-[10%]">이미지</TableHead>
                  <TableHead className="w-[25%]">상품명</TableHead>
                  <TableHead className="w-[15%]">출처 밴드</TableHead>
                  <TableHead className="w-[10%]">가격</TableHead>
                  <TableHead className="w-[8%]">변형</TableHead>
                  <TableHead className="w-[10%]">상태</TableHead>
                  <TableHead className="w-[12%]">생성일</TableHead>
                  <TableHead className="w-[5%]">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableEmpty message="등록된 상품이 없습니다." colSpan={9} />
                ) : (
                  products.map((product) => (
                    <TableRow
                      key={product.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/product/detail/${product.id}`)}
                    >
                      <TableCell
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedProductIds.includes(product.id)}
                          onChange={() => handleToggleSelection(product.id)}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell>
                        {product.thumbnailUrl ? (
                          <img
                            src={product.thumbnailUrl}
                            alt={product.name}
                            className="w-16 h-16 rounded object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded bg-gray-200 flex items-center justify-center">
                            <Package size={24} className="text-gray-400" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate">{product.name}</div>
                          {product.description && (
                            <div className="text-sm text-gray-500 truncate">
                              {product.description.substring(0, 50)}...
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-600 truncate">
                          {product.post?.wholesaleBand?.name || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">{formatPrice(product.price)}</div>
                          {product.wholesalePrice && (
                            <div className="text-xs text-gray-500 line-through">
                              {formatPrice(product.wholesalePrice)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {product.variants.length}개
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(product.status)}</TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {new Date(product.createdAt).toLocaleDateString('ko-KR')}
                        </span>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteProduct(product.id)}
                        >
                          <Trash2 size={16} className="text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* AI 상품 생성 중 로딩 오버레이 */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  AI가 상품 정보를 생성하고 있습니다...
                </h3>
                <p className="text-sm text-gray-600">
                  게시물을 분석하여 상품명, 옵션, 가격 등을 추출 중입니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 게시물 선택 모달 */}
      <PostSelectionModal
        isOpen={showPostSelectionModal}
        onClose={() => setShowPostSelectionModal(false)}
        onPostSelected={handlePostSelected}
      />

      {/* 상품 정보 수정 모달 */}
      {productDraft && (
        <ProductFormModal
          isOpen={showProductFormModal}
          onClose={() => {
            setShowProductFormModal(false)
            setProductDraft(null)
            setSelectedPostId(null)
          }}
          postId={selectedPostId!}
          initialData={productDraft}
          onSaved={handleProductSaved}
        />
      )}
    </div>
  )
}
