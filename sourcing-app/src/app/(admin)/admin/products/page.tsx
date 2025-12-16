'use client'

import { useState, useEffect, useMemo } from 'react'
import { Package, Search, Edit3, Trash2, DollarSign, Calendar, Tag, Download, ChevronLeft, ChevronRight, CheckCircle, Plus } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import Modal, { ModalFooter } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

interface Product {
  id: number
  title: string
  salePrice: number
  description: string
  sourceType?: string | null
  sourceId?: string | null
  createdAt: string
  updatedAt: string

  // AI 분석 결과 및 추가 정보
  images?: string
  hookingTitle?: string | null
  hookingContent?: string | null
  detailedContent?: string | null
  productCategory?: string | null

  // 가격 관련 정보
  shippingFee?: number | null
  priceInfo?: string | null

  // 특이사항 및 메타데이터
  specialNotes?: string | null
  hasDeadline?: boolean
  deadlineInfo?: string | null
  isAvailable?: boolean
  unavailableReason?: string | null

  // 소싱 정보
  wholesaleBandName?: string | null
  author?: string | null
  originalCreatedAt?: string | null
}

interface CollectedProduct {
  id: number
  userId: number
  postId: number
  name: string | null
  description: string | null
  currency: string
  price: number | null
  wholesalePrice: number | null
  createdAt: string
  rawMetadata: string | null  // JSON string containing options, variants, shipping info
  post: {
    id: number
    title: string
    channel: {
      id: number
      name: string
      coverUrl: string | null
    }
    images: Array<{
      id: number
      imageUrl: string
    }>
  }
  products: Array<{
    id: number
    name: string
  }>
}

export default function ProductsPage() {
  const toast = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editedProduct, setEditedProduct] = useState<Product | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<number[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [currentDetailIndex, setCurrentDetailIndex] = useState(0)
  const [isIndividualProcessing, setIsIndividualProcessing] = useState(false)

  // ConfirmModal states
  const [showOptionDeleteConfirm, setShowOptionDeleteConfirm] = useState(false)
  const [pendingOptionIndex, setPendingOptionIndex] = useState<number | null>(null)
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false)
  const [showSingleDeleteConfirm, setShowSingleDeleteConfirm] = useState(false)
  const [pendingDeleteProductId, setPendingDeleteProductId] = useState<number | null>(null)
  const [pendingDeleteProductTitle, setPendingDeleteProductTitle] = useState<string>('')

  // 상품 등록 모달 states
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [collectedProducts, setCollectedProducts] = useState<CollectedProduct[]>([])
  const [isLoadingCollected, setIsLoadingCollected] = useState(false)
  const [selectedCollectedId, setSelectedCollectedId] = useState<number | null>(null)
  const [isConverting, setIsConverting] = useState(false)

  useEffect(() => {
    loadProducts()
  }, [])

  // 키보드 네비게이션
  useEffect(() => {
    if (!showDetailModal) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        navigateToProduct('prev')
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        navigateToProduct('next')
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setShowDetailModal(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showDetailModal, currentDetailIndex])

  const loadProducts = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/product')
      const data = await response.json()

      if (data.success) {
        // API 응답을 페이지 인터페이스에 맞게 매핑
        const mappedProducts = (data.data || []).map((p: any) => ({
          id: p.id,
          title: p.name || '',
          salePrice: p.price || 0,
          description: p.description || '',
          productCategory: p.categoryId || null,
          images: p.thumbnailUrl ? JSON.stringify([p.thumbnailUrl]) : undefined,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          wholesaleBandName: p.collectedProduct?.post?.channel?.name || null,
        }))
        setProducts(mappedProducts)
      } else {
        console.error('상품 로드 실패:', data.error)
        setProducts([])
      }
    } catch (error) {
      console.error('상품 로드 오류:', error)
      setProducts([])
    } finally {
      setIsLoading(false)
    }
  }

  // 상품 등록 모달 관련 함수들
  const handleOpenRegisterModal = async () => {
    setShowRegisterModal(true)
    setSelectedCollectedId(null)
    await loadCollectedProducts()
  }

  const loadCollectedProducts = async () => {
    setIsLoadingCollected(true)
    try {
      const response = await fetch('/api/collected-product?limit=1000')
      const data = await response.json()

      if (data.success) {
        // Product로 변환되지 않은 CollectedProduct만 필터링
        const unconverted = data.data.filter(
          (cp: CollectedProduct) => !cp.products || cp.products.length === 0
        )
        setCollectedProducts(unconverted)
      }
    } catch (error) {
      console.error('수집상품 목록 조회 실패:', error)
      toast.error('수집상품 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoadingCollected(false)
    }
  }

  const handleConvertToProduct = async () => {
    if (!selectedCollectedId) {
      toast.warning('수집상품을 선택해주세요.')
      return
    }

    const selectedCP = collectedProducts.find(cp => cp.id === selectedCollectedId)
    if (!selectedCP) {
      toast.error('선택한 수집상품을 찾을 수 없습니다.')
      return
    }

    setIsConverting(true)
    try {
      // 서비스에서 rawMetadata를 자동으로 파싱하므로, 기본 정보만 전달
      const response = await fetch('/api/product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectedProductId: selectedCollectedId,
          name: selectedCP.name || selectedCP.post.title || '상품명 미지정',
          description: selectedCP.description || '',
          currency: selectedCP.currency || 'KRW',
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('상품이 등록되었습니다.')
        setShowRegisterModal(false)
        loadProducts()
      } else {
        toast.error(data.error || '상품 등록에 실패했습니다.')
      }
    } catch {
      toast.error('상품 등록 중 오류가 발생했습니다.')
    } finally {
      setIsConverting(false)
    }
  }

  const handleCloseRegisterModal = () => {
    setShowRegisterModal(false)
    setSelectedCollectedId(null)
  }

  // 체크박스 관련 함수들
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked)
    if (checked) {
      setSelectedProducts(paginatedProducts.map(p => p.id))
    } else {
      setSelectedProducts([])
    }
  }

  const handleProductSelect = (productId: number, checked: boolean) => {
    if (checked) {
      setSelectedProducts(prev => [...prev, productId])
    } else {
      setSelectedProducts(prev => prev.filter(id => id !== productId))
    }
    
    // 전체 선택 체크박스 업데이트
    const newSelectedCount = checked ? selectedProducts.length + 1 : selectedProducts.length - 1
    setSelectAll(newSelectedCount === paginatedProducts.length)
  }

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (product.hookingTitle && product.hookingTitle.toLowerCase().includes(searchTerm.toLowerCase())) ||
                           (product.wholesaleBandName && product.wholesaleBandName.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesCategory = categoryFilter === 'all' || product.productCategory === categoryFilter

      return matchesSearch && matchesCategory
    })
  }, [products, searchTerm, categoryFilter])

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  
  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredProducts, startIndex, itemsPerPage])

  const formatPrice = (price: number) => {
    return price.toLocaleString()
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getCategoryLabel = (category: string | null) => {
    const labels = {
      'SEAFOOD': '수산',
      'MEAT': '축산',
      'AGRICULTURE': '농산',
      'PROCESSED': '가공품',
      'OTHER': '기타'
    }
    return category ? labels[category as keyof typeof labels] || '미분류' : '미분류'
  }

  const getCategoryColor = (category: string | null) => {
    const colors = {
      'SEAFOOD': 'bg-blue-100 text-blue-700',
      'MEAT': 'bg-red-100 text-red-700',
      'AGRICULTURE': 'bg-green-100 text-green-700',
      'PROCESSED': 'bg-purple-100 text-purple-700',
      'OTHER': 'bg-gray-100 text-gray-700'
    }
    return category ? colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-700' : 'bg-gray-100 text-gray-700'
  }

  const safeParseImages = (images: string | undefined) => {
    if (!images) return []
    try {
      const parsed = JSON.parse(images)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  // 판매가 추출
  const getSellingPrice = (product: Product) => {
    return product.salePrice || 0
  }

  // 도매밴드명으로 가격정책 조회
  const getPricingPolicyByBandName = (bandName: string) => {
    const name = bandName.toLowerCase()

    if (name.includes('가족도매')) {
      return '원가 그대로'
    }
    if (name.includes('요한이네') || name.includes('초록이네')) {
      return '수집가격 기준 구간별 마진 적용'
    }
    if (name.includes('나은') && name.includes('공급')) {
      return '공급가와 배송비를 분리, 공급가에만 마진 적용'
    }
    if (name.includes('sd') || name.includes('푸드')) {
      return '공급가와 배송비를 분리, 공급가에만 마진 적용'
    }
    if (name.includes('폐쇄몰') && name.includes('vip')) {
      return '공급가와 배송비를 분리, 공급가에만 마진 적용'
    }

    return '' // 기본값: 정책 없음
  }

  // 도매밴드별 색상 아이콘 가져오기
  const getWholesaleBandColor = (bandName: string | null | undefined) => {
    if (!bandName) return 'bg-gray-400'

    const name = bandName.toLowerCase()

    if (name.includes('나은') && name.includes('공급')) return 'bg-red-500'      // 빨간색: 나은 상품 공급방
    if (name.includes('초록이네')) return 'bg-green-500'                        // 초록색: 초록이네
    if (name.includes('가족도매')) return 'bg-blue-500'                         // 파랑색: 가족도매방
    if (name.includes('요한이네')) return 'bg-yellow-500'                       // 노랑색: 요한이네
    if (name.includes('sd') || name.includes('푸드')) return 'bg-pink-500'      // 분홍색: SD푸드
    if (name.includes('폐쇄몰') && name.includes('vip')) return 'bg-orange-500' // 주황색: 폐쇄몰VIP

    return 'bg-gray-400' // 기본색상
  }

  const handleShowDetail = (product: Product) => {
    const productIndex = paginatedProducts.findIndex(p => p.id === product.id)
    setCurrentDetailIndex(productIndex >= 0 ? productIndex : 0)
    setSelectedProduct(product)
    setEditedProduct({ ...product })
    setShowDetailModal(true)
    setIsEditing(false)
  }

  const handleStartEdit = () => {
    if (selectedProduct) {
      setEditedProduct({ ...selectedProduct })
      setIsEditing(true)
    }
  }

  const handleCancelEdit = () => {
    setEditedProduct(selectedProduct ? { ...selectedProduct } : null)
    setIsEditing(false)
  }

  const handleSaveEdit = async () => {
    if (!editedProduct) return

    try {
      setIsSaving(true)
      const response = await fetch('/api/product', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editedProduct.id,
          name: editedProduct.title,
          description: editedProduct.description,
          price: editedProduct.salePrice,
          categoryId: editedProduct.productCategory,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // 로컬 상태 업데이트
        setSelectedProduct(editedProduct)
        setProducts(products.map(p => p.id === editedProduct.id ? editedProduct : p))
        setIsEditing(false)
        console.log('상품 업데이트 성공')
      } else {
        console.error('상품 업데이트 실패:', data.error)
      }
    } catch (error) {
      console.error('상품 업데이트 오류:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditChange = (field: keyof Product, value: any) => {
    if (!editedProduct) return
    setEditedProduct({
      ...editedProduct,
      [field]: value,
    })
  }

  // 옵션 수정 핸들러
  const handleOptionChange = (optionIndex: number, field: string, value: any) => {
    if (!editedProduct || !editedProduct.priceInfo) return
    
    try {
      const priceData = JSON.parse(editedProduct.priceInfo)
      if (!priceData.processedPriceOptions) return
      
      const updatedOptions = [...priceData.processedPriceOptions]
      updatedOptions[optionIndex] = {
        ...updatedOptions[optionIndex],
        [field]: field === 'salePrice' ? (parseFloat(value) || 0) : value
      }
      
      const updatedPriceData = {
        ...priceData,
        processedPriceOptions: updatedOptions
      }
      
      setEditedProduct({
        ...editedProduct,
        priceInfo: JSON.stringify(updatedPriceData)
      })
    } catch (error) {
      console.error('옵션 수정 오류:', error)
    }
  }

  // 옵션 삭제 핸들러
  const handleDeleteOption = (optionIndex: number) => {
    if (!editedProduct || !editedProduct.priceInfo) return
    setPendingOptionIndex(optionIndex)
    setShowOptionDeleteConfirm(true)
  }

  const confirmDeleteOption = () => {
    if (!editedProduct || !editedProduct.priceInfo || pendingOptionIndex === null) return

    try {
      const priceData = JSON.parse(editedProduct.priceInfo)
      if (!priceData.processedPriceOptions) return

      const updatedOptions = [...priceData.processedPriceOptions]
      updatedOptions.splice(pendingOptionIndex, 1) // 해당 인덱스의 옵션 삭제

      const updatedPriceData = {
        ...priceData,
        processedPriceOptions: updatedOptions
      }

      setEditedProduct({
        ...editedProduct,
        priceInfo: JSON.stringify(updatedPriceData)
      })
    } catch (error) {
      console.error('옵션 삭제 오류:', error)
    } finally {
      setShowOptionDeleteConfirm(false)
      setPendingOptionIndex(null)
    }
  }

  // 선택된 상품 일괄 삭제
  const handleSelectedDelete = () => {
    if (selectedProducts.length === 0) {
      return
    }
    setShowBatchDeleteConfirm(true)
  }

  const confirmBatchDelete = async () => {
    try {
      // 병렬로 모든 선택된 상품 삭제 요청
      const deletePromises = selectedProducts.map(productId =>
        fetch(`/api/product?id=${productId}`, {
          method: 'DELETE',
        }).then(response => response.json())
      )

      const results = await Promise.all(deletePromises)

      // 성공한 삭제들만 필터링
      const successfulDeletes = selectedProducts.filter((_, index) => results[index].success)
      const failedDeletes = selectedProducts.filter((_, index) => !results[index].success)

      if (successfulDeletes.length > 0) {
        // 로컬 상태에서 성공적으로 삭제된 상품들 제거
        setProducts(products.filter(p => !successfulDeletes.includes(p.id)))

        // 선택된 상품 목록 초기화
        setSelectedProducts([])
        setSelectAll(false)

        // 모달이 열려있고 삭제된 상품이면 모달 닫기
        if (selectedProduct && successfulDeletes.includes(selectedProduct.id)) {
          setShowDetailModal(false)
          setSelectedProduct(null)
          setEditedProduct(null)
          setIsEditing(false)
        }

        console.log(`${successfulDeletes.length}개 상품 삭제 성공`)
      }

      if (failedDeletes.length > 0) {
        console.error(`${failedDeletes.length}개 상품 삭제 실패`)
      }

    } catch (error) {
      console.error('일괄 삭제 오류:', error)
    } finally {
      setShowBatchDeleteConfirm(false)
    }
  }

  // 네비게이션 함수들
  const navigateToProduct = (direction: 'prev' | 'next') => {
    if (paginatedProducts.length === 0) return
    
    let newIndex = currentDetailIndex
    if (direction === 'prev') {
      newIndex = currentDetailIndex > 0 ? currentDetailIndex - 1 : paginatedProducts.length - 1
    } else {
      newIndex = currentDetailIndex < paginatedProducts.length - 1 ? currentDetailIndex + 1 : 0
    }
    
    const newProduct = paginatedProducts[newIndex]
    if (newProduct) {
      setCurrentDetailIndex(newIndex)
      setSelectedProduct(newProduct)
      setEditedProduct({ ...newProduct })
      setIsEditing(false)
    }
  }

  // 개별 소싱 확정 처리
  const handleIndividualSourceConfirm = async () => {
    if (!selectedProduct) return

    try {
      setIsIndividualProcessing(true)
      
      const response = await fetch('/api/wholesale/post/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postIds: [selectedProduct.id]
        })
      })

      const data = await response.json()

      if (data.success) {
        // 상품 상태를 ACTIVE로 변경
        const updatedProduct = { ...selectedProduct, status: 'ACTIVE' }
        setSelectedProduct(updatedProduct)
        setEditedProduct(updatedProduct)
        setProducts(products.map(p => p.id === selectedProduct.id ? updatedProduct : p))
        
        // 1초 대기 후 다음 상품으로 이동
        setTimeout(() => {
          navigateToProduct('next')
        }, 1000)
      } else {
      }
    } catch (error) {
      console.error('소싱 확정 오류:', error)
    } finally {
      setIsIndividualProcessing(false)
    }
  }

  const handleDeleteProduct = (productId: number, productTitle: string) => {
    setPendingDeleteProductId(productId)
    setPendingDeleteProductTitle(productTitle)
    setShowSingleDeleteConfirm(true)
  }

  const confirmSingleDelete = async () => {
    if (!pendingDeleteProductId) return

    try {
      const response = await fetch(`/api/product?id=${pendingDeleteProductId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        // 로컬 상태에서 상품 제거
        setProducts(products.filter(p => p.id !== pendingDeleteProductId))
        console.log('상품 삭제 성공')

        // 모달이 열려있고 삭제된 상품이면 모달 닫기
        if (selectedProduct?.id === pendingDeleteProductId) {
          setShowDetailModal(false)
          setSelectedProduct(null)
          setEditedProduct(null)
          setIsEditing(false)
        }
      } else {
        console.error('상품 삭제 실패:', data.error)
      }
    } catch (error) {
      console.error('상품 삭제 오류:', error)
    } finally {
      setShowSingleDeleteConfirm(false)
      setPendingDeleteProductId(null)
      setPendingDeleteProductTitle('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">상품 관리</h1>
              <p className="text-gray-600">수집된 게시물에서 생성된 상품들을 관리합니다.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleOpenRegisterModal}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                상품 등록
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Package className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">전체 상품</p>
                <p className="text-2xl font-semibold text-gray-900">{products.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <DollarSign className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">총 상품 가치</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {products.reduce((acc, p) => acc + p.salePrice, 0).toLocaleString()}원
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="상품명, 설명으로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="border border-gray-300 rounded-md pl-4 pr-10 py-2 text-sm w-80 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
                </div>
                
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">전체 분류</option>
                  <option value="SEAFOOD">수산</option>
                  <option value="MEAT">축산</option>
                  <option value="AGRICULTURE">농산</option>
                  <option value="PROCESSED">가공품</option>
                  <option value="OTHER">기타</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleSelectedDelete}
                  disabled={selectedProducts.length === 0}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-4 w-4" />
                  선택삭제 ({selectedProducts.length})
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={selectAll}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">상품명</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">소싱처</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">판매가</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">수집일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      <Package className="h-6 w-6 mx-auto mb-2 animate-pulse" />
                      상품을 불러오는 중...
                    </td>
                  </tr>
                ) : paginatedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-lg font-medium text-gray-900 mb-2">등록된 상품이 없습니다</p>
                      <p className="text-gray-500">도매 밴드에서 게시물을 수집하여 상품을 생성해보세요.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((product, index) => (
                    <tr key={product.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleShowDetail(product)}>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={selectedProducts.includes(product.id)}
                          onChange={(e) => handleProductSelect(product.id, e.target.checked)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          {/* 이미지 썸네일 */}
                          <div className="w-12 h-12 flex-shrink-0">
                            {safeParseImages(product.images).length > 0 ? (
                              <img
                                src={safeParseImages(product.images)[0]}
                                alt="상품 이미지"
                                className="w-full h-full object-cover rounded border"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0zNSA2NUw1MCA0NUw2NSA2NUgzNVoiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+'
                                }}
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-100 border rounded flex items-center justify-center">
                                <Package className="h-6 w-6 text-gray-400" />
                              </div>
                            )}
                          </div>
                          {/* 상품 정보 */}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 line-clamp-2">
                              {product.hookingTitle || product.title}
                            </div>
                            <div className="text-xs text-gray-500 line-clamp-1 mt-1">
                              {(product.hookingContent || product.description).substring(0, 100)}...
                            </div>
                            {(product.hasDeadline || product.shippingFee) && (
                              <div className="flex gap-2 mt-1">
                                {product.hasDeadline && (
                                  <span className="text-xs bg-orange-100 text-orange-700 px-1 py-0.5 rounded">
                                    ⏰ 마감있음
                                  </span>
                                )}
                                {product.shippingFee && (
                                  <span className="text-xs bg-blue-100 text-blue-700 px-1 py-0.5 rounded">
                                    배송 {formatPrice(product.shippingFee)}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-blue-600 font-medium">
                          {product.wholesaleBandName || '직접 입력'}
                        </div>
                        {product.author && (
                          <div className="text-xs text-gray-500">
                            by {product.author}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-gray-900">
                          {formatPrice(product.salePrice)}원
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(product.createdAt)}
                        </div>
                        {product.originalCreatedAt && (
                          <div className="text-xs text-gray-400">
                            원본: {formatDate(product.originalCreatedAt)}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                총 {filteredProducts.length}개 중 {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredProducts.length)}개 표시
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  이전
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 text-sm border rounded ${
                      currentPage === page
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button 
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  다음
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Product Detail Modal */}
        {showDetailModal && selectedProduct && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Navigation Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigateToProduct('prev')}
                      disabled={paginatedProducts.length <= 1}
                      className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="이전 상품"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <span className="text-sm text-gray-500 min-w-[80px] text-center">
                      {currentDetailIndex + 1} / {paginatedProducts.length}
                    </span>
                    <button
                      onClick={() => navigateToProduct('next')}
                      disabled={paginatedProducts.length <= 1}
                      className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="다음 상품"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="h-6 w-px bg-gray-300"></div>

                  <h2 className="text-xl font-bold text-gray-900">상품 상세보기</h2>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(selectedProduct.productCategory || null)}`}>
                      {getCategoryLabel(selectedProduct.productCategory || null)}
                    </span>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 rounded-lg hover:bg-gray-100"
                  title="닫기"
                >
                  <Package className="h-5 w-5 rotate-45" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Left: Basic Info */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                      기본 정보
                    </h3>
                    
                    <div className="bg-blue-50 p-4 rounded-lg space-y-3">
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-1">상품명</h4>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editedProduct?.title || ''}
                            onChange={(e) => handleEditChange('title', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        ) : (
                          <p className="text-gray-900 font-medium">{selectedProduct.title}</p>
                        )}
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-1">설명</h4>
                        {isEditing ? (
                          <textarea
                            value={editedProduct?.description || ''}
                            onChange={(e) => handleEditChange('description', e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        ) : (
                          <div className="text-gray-900 whitespace-pre-wrap">
                            {selectedProduct.description}
                          </div>
                        )}
                      </div>

                      {/* 공급가 */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-1">판매가</h4>
                        {isEditing ? (
                          <input
                            type="number"
                            value={editedProduct?.salePrice || 0}
                            onChange={(e) => handleEditChange('salePrice', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-orange-600 font-semibold focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          />
                        ) : (
                          <p className="text-orange-600 font-semibold">
                            {formatPrice(selectedProduct.salePrice)}원
                          </p>
                        )}
                      </div>

                      {(selectedProduct.shippingFee || isEditing) && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-1">배송비</h4>
                          {isEditing ? (
                            <input
                              type="number"
                              value={editedProduct?.shippingFee || 0}
                              onChange={(e) => handleEditChange('shippingFee', parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-blue-600 font-semibold focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          ) : (
                            selectedProduct.shippingFee && (
                              <p className="text-blue-600 font-semibold">
                                {formatPrice(selectedProduct.shippingFee)}원
                              </p>
                            )
                          )}
                        </div>
                      )}

                      {/* 분류 편집 */}
                      {isEditing && (
                        <div className="pt-2 border-t border-blue-200">
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-1">분류</h4>
                            <select
                              value={editedProduct?.productCategory || 'OTHER'}
                              onChange={(e) => handleEditChange('productCategory', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="SEAFOOD">수산</option>
                              <option value="MEAT">축산</option>
                              <option value="AGRICULTURE">농산</option>
                              <option value="PROCESSED">가공품</option>
                              <option value="OTHER">기타</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: AI Enhanced Content */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                      AI 개선 내용
                    </h3>
                    
                    <div className="bg-green-50 p-4 rounded-lg space-y-3">
                      {(selectedProduct.hookingTitle || isEditing) && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-1">후킹 제목</h4>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editedProduct?.hookingTitle || ''}
                              onChange={(e) => handleEditChange('hookingTitle', e.target.value)}
                              placeholder="매력적인 제목을 입력하세요"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 font-medium focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                          ) : (
                            selectedProduct.hookingTitle && (
                              <p className="text-gray-900 font-medium">
                                {selectedProduct.hookingTitle}
                              </p>
                            )
                          )}
                        </div>
                      )}
                      
                      {(selectedProduct.hookingContent || isEditing) && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-1">후킹 내용</h4>
                          {isEditing ? (
                            <textarea
                              value={editedProduct?.hookingContent || ''}
                              onChange={(e) => handleEditChange('hookingContent', e.target.value)}
                              rows={4}
                              placeholder="매력적인 판매 문구를 입력하세요"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                          ) : (
                            selectedProduct.hookingContent && (
                              <div className="text-gray-900 whitespace-pre-wrap">
                                {selectedProduct.hookingContent}
                              </div>
                            )
                          )}
                        </div>
                      )}

                      {(selectedProduct.detailedContent && selectedProduct.detailedContent !== selectedProduct.hookingContent) || isEditing ? (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-1">상세 설명</h4>
                          {isEditing ? (
                            <textarea
                              value={editedProduct?.detailedContent || ''}
                              onChange={(e) => handleEditChange('detailedContent', e.target.value)}
                              rows={4}
                              placeholder="상품의 상세 설명을 입력하세요"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                          ) : (
                            selectedProduct.detailedContent && selectedProduct.detailedContent !== selectedProduct.hookingContent && (
                              <div className="text-gray-900 whitespace-pre-wrap">
                                {selectedProduct.detailedContent}
                              </div>
                            )
                          )}
                        </div>
                      ) : null}

                      {/* 추출된 옵션 정보 */}
                      {(isEditing ? editedProduct?.priceInfo : selectedProduct.priceInfo) && (() => {
                        try {
                          const priceData = JSON.parse(isEditing ? editedProduct?.priceInfo || '{}' : selectedProduct.priceInfo || '{}')
                          if (priceData.processedPriceOptions && priceData.processedPriceOptions.length > 0) {
                            return (
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-3">추출된 옵션</h4>
                                <div className="space-y-2">
                                  {priceData.processedPriceOptions.map((option: any, index: number) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-white rounded-md border border-green-200">
                                      {isEditing ? (
                                        <>
                                          <div className="flex-1">
                                            <input
                                              type="text"
                                              value={option.option || option.name || `옵션${index + 1}`}
                                              onChange={(e) => handleOptionChange(index, 'option', e.target.value)}
                                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-green-500"
                                            />
                                          </div>
                                          <div className="ml-4 text-right flex items-center gap-2">
                                            <div>
                                              <input
                                                type="number"
                                                value={option.salePrice || 0}
                                                onChange={(e) => handleOptionChange(index, 'salePrice', e.target.value)}
                                                className="w-20 px-2 py-1 text-sm text-green-600 font-semibold border border-gray-300 rounded focus:ring-1 focus:ring-green-500"
                                              />
                                              <div className="text-xs text-gray-500 mt-1">
                                                <span className="mr-1">원가:</span>
                                                <input
                                                  type="number"
                                                  value={option.originalPrice || 0}
                                                  onChange={(e) => handleOptionChange(index, 'originalPrice', e.target.value)}
                                                  className="w-16 px-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-green-500"
                                                />
                                                <span>원</span>
                                              </div>
                                            </div>
                                            <button
                                              onClick={() => handleDeleteOption(index)}
                                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                              title="옵션 삭제"
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </button>
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          <div className="flex-1">
                                            <div className="font-medium text-gray-900 text-sm">
                                              옵션 {index + 1}: {option.option || option.name || `옵션${index + 1}`}
                                            </div>
                                            {option.description && (
                                              <div className="text-xs text-gray-500 mt-1">
                                                {option.description}
                                              </div>
                                            )}
                                          </div>
                                          <div className="text-right">
                                            <div className="text-sm font-semibold text-green-600">
                                              {formatPrice(option.salePrice || 0)}원
                                            </div>
                                            <div className="text-xs text-gray-500">
                                              원가: {formatPrice(option.originalPrice || 0)}원
                                            </div>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          }
                          return null
                        } catch (error) {
                          return null
                        }
                      })()}

                      {(selectedProduct.specialNotes || isEditing) && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-1">특이사항</h4>
                          {isEditing ? (
                            <textarea
                              value={editedProduct?.specialNotes || ''}
                              onChange={(e) => handleEditChange('specialNotes', e.target.value)}
                              rows={3}
                              placeholder="특별한 주의사항이나 메모를 입력하세요"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                          ) : (
                            selectedProduct.specialNotes && (
                              <div className="bg-yellow-100 text-yellow-800 px-3 py-2 rounded text-sm">
                                {selectedProduct.specialNotes}
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Images */}
                {safeParseImages(selectedProduct.images).length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">상품 이미지</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {safeParseImages(selectedProduct.images).map((imageUrl: string, index: number) => (
                        <div key={index} className="aspect-square">
                          <img
                            src={imageUrl}
                            alt={`상품 이미지 ${index + 1}`}
                            className="w-full h-full object-cover rounded-lg border border-gray-200"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0zNSA2NUw1MCA0NUw2NSA2NUgzNVoiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+'
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}


                {/* 가격 옵션 및 정책 적용 결과 */}
                {selectedProduct.priceInfo && (() => {
                  try {
                    const priceData = JSON.parse(selectedProduct.priceInfo)
                    return (
                      <div className="mt-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">가격 정책 적용 결과</h3>
                        
                        {/* 적용된 가격정책 */}
                        {priceData.appliedPolicy && (
                          <div className="bg-purple-50 p-4 rounded-lg mb-4">
                            <h4 className="text-sm font-semibold text-purple-700 mb-2">적용된 가격정책</h4>
                            <div className="text-sm text-gray-900">
                              <span className="font-medium">방식:</span> {
                                priceData.appliedPolicy.method === 'PERCENTAGE' ? '퍼센트 마진' :
                                priceData.appliedPolicy.method === 'FIXED_AMOUNT' ? '고정 금액 추가' :
                                priceData.appliedPolicy.method === 'MULTIPLY' ? '배수 적용' : '기본 정책'
                              }
                              <br />
                              <span className="font-medium">값:</span> {
                                priceData.appliedPolicy.method === 'PERCENTAGE' ? `${priceData.appliedPolicy.value}%` :
                                priceData.appliedPolicy.method === 'FIXED_AMOUNT' ? `${priceData.appliedPolicy.value}원` :
                                priceData.appliedPolicy.method === 'MULTIPLY' ? `×${priceData.appliedPolicy.value}` :
                                '기본 50% 마진'
                              }
                            </div>
                          </div>
                        )}


                        {/* 기타 정보 */}
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <h4 className="text-sm font-semibold text-blue-700 mb-2">추가 정보</h4>
                          <div className="space-y-2 text-sm text-gray-900">
                            {priceData.shippingFee > 0 && (
                              <div>
                                <span className="font-medium">배송비:</span> {formatPrice(priceData.shippingFee)}
                              </div>
                            )}
                            {priceData.baseInfo && (
                              <div>
                                <span className="font-medium">원본 가격 정보:</span>
                                <div className="mt-1 p-2 bg-white rounded text-xs whitespace-pre-wrap">
                                  {priceData.baseInfo}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  } catch (error) {
                    // JSON 파싱 실패 시 원본 텍스트 표시
                    return (
                      <div className="mt-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">가격 및 배송정책 (원본)</h3>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-gray-900 whitespace-pre-wrap text-sm">
                            {selectedProduct.priceInfo}
                          </div>
                        </div>
                      </div>
                    )
                  }
                })()}

                {/* Sourcing Info */}
                <div className="mt-6 bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">소싱 정보</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">소싱처:</span>
                      <p className="font-medium text-blue-600">{selectedProduct.wholesaleBandName || '직접 입력'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">작성자:</span>
                      <p className="font-medium">{selectedProduct.author || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">생성일:</span>
                      <p className="font-medium">{formatDate(selectedProduct.createdAt)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">원본 작성일:</span>
                      <p className="font-medium">
                        {selectedProduct.originalCreatedAt ? formatDate(selectedProduct.originalCreatedAt) : '-'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">
                    상품 ID: {selectedProduct.id}
                  </span>
                  {selectedProduct.sourceId && (
                    <span className="text-sm text-gray-500">
                      소스 ID: {selectedProduct.sourceId}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                    disabled={isSaving}
                  >
                    닫기
                  </button>
                  
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleCancelEdit}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                        disabled={isSaving}
                      >
                        취소
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={isSaving}
                        className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                      >
                        {isSaving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            저장 중...
                          </>
                        ) : (
                          <>
                            <Package className="h-4 w-4" />
                            저장하기
                          </>
                        )}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => selectedProduct && handleDeleteProduct(selectedProduct.id, selectedProduct.title)}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        삭제
                      </button>
                      <button
                        onClick={handleStartEdit}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                      >
                        <Edit3 className="h-4 w-4" />
                        편집
                      </button>
                      <button
                        onClick={handleIndividualSourceConfirm}
                        disabled={isIndividualProcessing}
                        className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                      >
                        {isIndividualProcessing ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            소싱확정 중...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4" />
                            소싱확정
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 옵션 삭제 확인 모달 */}
        <ConfirmModal
          isOpen={showOptionDeleteConfirm}
          onClose={() => {
            setShowOptionDeleteConfirm(false)
            setPendingOptionIndex(null)
          }}
          onConfirm={confirmDeleteOption}
          title="옵션 삭제"
          message="이 옵션을 삭제하시겠습니까?"
          confirmText="삭제"
          variant="danger"
        />

        {/* 일괄 삭제 확인 모달 */}
        <ConfirmModal
          isOpen={showBatchDeleteConfirm}
          onClose={() => setShowBatchDeleteConfirm(false)}
          onConfirm={confirmBatchDelete}
          title="상품 일괄 삭제"
          message={`선택된 ${selectedProducts.length}개 상품을 삭제하시겠습니까?`}
          confirmText="삭제"
          variant="danger"
        />

        {/* 개별 삭제 확인 모달 */}
        <ConfirmModal
          isOpen={showSingleDeleteConfirm}
          onClose={() => {
            setShowSingleDeleteConfirm(false)
            setPendingDeleteProductId(null)
            setPendingDeleteProductTitle('')
          }}
          onConfirm={confirmSingleDelete}
          title="상품 삭제"
          message={`"${pendingDeleteProductTitle}" 상품을 삭제하시겠습니까?`}
          confirmText="삭제"
          variant="danger"
        />

        {/* 상품 등록 모달 */}
        <Modal
          isOpen={showRegisterModal}
          onClose={handleCloseRegisterModal}
          title="상품 등록 - 수집상품 선택"
          size="2xl"
        >
          <div className="flex flex-col h-[calc(70vh-8rem)]">
            {isLoadingCollected ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : collectedProducts.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                <Package size={48} className="mb-4 text-gray-300" />
                <p>변환 가능한 수집상품이 없습니다.</p>
                <p className="text-sm mt-2">수집상품 관리에서 먼저 수집상품을 추가해주세요.</p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto space-y-2">
                  {collectedProducts.map((cp) => (
                    <div
                      key={cp.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedCollectedId === cp.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedCollectedId(cp.id)}
                    >
                      <div className="flex items-start gap-3">
                        {cp.post?.images?.[0]?.imageUrl ? (
                          <img
                            src={cp.post.images[0].imageUrl}
                            alt={cp.name || cp.post.title}
                            className="w-20 h-20 rounded object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <Package size={24} className="text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 truncate">
                            {cp.name || '(상품명 미추출)'}
                          </h4>
                          <p className="text-sm text-gray-500 truncate">
                            {cp.post?.title}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-sm text-gray-600">
                              {cp.post?.channel?.name}
                            </span>
                            {cp.price && (
                              <span className="text-sm font-medium text-gray-900">
                                ₩{cp.price.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <ModalFooter>
                  <Button variant="secondary" onClick={handleCloseRegisterModal}>
                    취소
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleConvertToProduct}
                    disabled={!selectedCollectedId || isConverting}
                  >
                    {isConverting ? '등록 중...' : '상품 등록'}
                  </Button>
                </ModalFooter>
              </>
            )}
          </div>
        </Modal>
      </div>
    </div>
  )
}