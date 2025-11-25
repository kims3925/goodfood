'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Trash2, RefreshCw, Package, Sparkles } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/Table'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import PostSelectionModal from '@/components/product/PostSelectionModal'
import PolicySelectionModal from '@/components/product/PolicySelectionModal'
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
  const [showPolicyModal, setShowPolicyModal] = useState(false)
  const [showProductFormModal, setShowProductFormModal] = useState(false)
  const [selectedPostIds, setSelectedPostIds] = useState<number[]>([]) // 다중 선택 지원
  const [pendingPostIds, setPendingPostIds] = useState<number[]>([]) // 정책 선택 대기 중인 게시물
  const [productDrafts, setProductDrafts] = useState<any[]>([]) // 다중 AI 결과
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatingProgress, setGeneratingProgress] = useState({ current: 0, total: 0 })

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

  // 단일 게시물 선택 (하위 호환성)
  const handlePostSelected = async (postId: number) => {
    await handleMultiplePostsSelected([postId])
  }

  // 다중 게시물 선택 처리 - 정책 선택 모달로 이동
  const handleMultiplePostsSelected = async (postIds: number[]) => {
    setPendingPostIds(postIds)
    setShowPostSelectionModal(false)
    setShowPolicyModal(true)
  }

  // 정책 선택 후 AI 변환 시작
  const handlePolicySelected = async (policyId: number | null, policyContent: string | null) => {
    setShowPolicyModal(false)
    setSelectedPostIds(pendingPostIds)
    setIsGenerating(true)
    setGeneratingProgress({ current: 0, total: pendingPostIds.length })

    try {
      const drafts: any[] = []

      // 각 게시물에 대해 AI 상품 생성
      for (let i = 0; i < pendingPostIds.length; i++) {
        const postId = pendingPostIds[i]
        setGeneratingProgress({ current: i + 1, total: pendingPostIds.length })

        try {
          const response = await fetch('/api/product/ai-generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId, policyContent }),
          })

          const data = await response.json()

          if (data.success) {
            drafts.push({
              postId,
              draft: data.draft,
            })
          } else {
            console.error(`게시물 ${postId} AI 생성 실패:`, data.error)
            // 실패한 게시물도 빈 draft로 추가 (사용자가 직접 입력 가능)
            drafts.push({
              postId,
              draft: {
                name: `게시물 ${postId} (AI 생성 실패)`,
                description: '',
                categoryId: '',
                price: '',
                wholesalePrice: '',
                options: [],
                variants: [],
              },
              error: data.error,
            })
          }
        } catch (error) {
          console.error(`게시물 ${postId} AI 생성 오류:`, error)
          drafts.push({
            postId,
            draft: {
              name: `게시물 ${postId} (AI 생성 오류)`,
              description: '',
              categoryId: '',
              price: '',
              wholesalePrice: '',
              options: [],
              variants: [],
            },
            error: '네트워크 오류',
          })
        }
      }

      if (drafts.length > 0) {
        setProductDrafts(drafts)
        setShowProductFormModal(true)
      }
    } catch (error) {
      console.error('AI 상품 생성 실패:', error)
    } finally {
      setIsGenerating(false)
      setGeneratingProgress({ current: 0, total: 0 })
      setPendingPostIds([])
    }
  }

  const handleProductSaved = () => {
    setShowProductFormModal(false)
    setProductDrafts([])
    setSelectedPostIds([])
    loadProducts()
  }

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/product?id=${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        loadProducts()
      }
    } catch (error) {
      console.error('상품 삭제 실패:', error)
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

  const handleToggleSelection = (id: number) => {
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

      setSelectedProductIds([])
      setSelectAll(false)
      loadProducts()
    } catch (error) {
      console.error('상품 일괄 삭제 실패:', error)
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
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                  <TableHead className="w-[15%]">이미지</TableHead>
                  <TableHead className="w-[25%]">상품명</TableHead>
                  <TableHead className="w-[15%]">출처 밴드</TableHead>
                  <TableHead className="w-[10%]">도매가</TableHead>
                  <TableHead className="w-[10%]">판매가</TableHead>
                  <TableHead className="w-[12%]">상태</TableHead>
                  <TableHead className="w-[13%]">생성일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableEmpty message="등록된 상품이 없습니다." colSpan={8} />
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
                            className="w-20 h-20 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-lg bg-gray-200 flex items-center justify-center">
                            <Package size={28} className="text-gray-400" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 truncate text-base">{product.name}</div>
                          {product.description && (
                            <div className="text-sm text-gray-500 truncate mt-1">
                              {product.description.substring(0, 60)}...
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-gray-600 truncate">
                          {product.post?.wholesaleBand?.name || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-gray-900">
                          {formatPrice(product.wholesalePrice)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-gray-900">
                          {formatPrice(product.price)}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(product.status)}</TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {new Date(product.createdAt).toLocaleDateString('ko-KR')}
                        </span>
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
                {generatingProgress.total > 1 && (
                  <div className="mb-3">
                    <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 transition-all duration-300"
                        style={{ width: `${(generatingProgress.current / generatingProgress.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-sm text-purple-600 mt-2 font-medium">
                      {generatingProgress.current} / {generatingProgress.total} 게시물 처리 중
                    </p>
                  </div>
                )}
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
        onMultiplePostsSelected={handleMultiplePostsSelected}
      />

      {/* 정책 선택 모달 */}
      <PolicySelectionModal
        isOpen={showPolicyModal}
        onClose={() => {
          setShowPolicyModal(false)
          setPendingPostIds([])
        }}
        onPolicySelected={handlePolicySelected}
        selectedPostCount={pendingPostIds.length}
      />

      {/* 상품 정보 수정 모달 */}
      {productDrafts.length > 0 && (
        <ProductFormModal
          isOpen={showProductFormModal}
          onClose={() => {
            setShowProductFormModal(false)
            setProductDrafts([])
            setSelectedPostIds([])
          }}
          postId={selectedPostIds[0]}
          initialData={productDrafts[0]?.draft}
          initialDrafts={productDrafts}
          onSaved={handleProductSaved}
        />
      )}
    </div>
  )
}
