'use client'

import { useState, useEffect } from 'react'
import { Package, Copy, ExternalLink, Search, Filter, CheckCircle, Clock, RefreshCw, Globe, Store, GripVertical, AlertCircle, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, Trash2 } from 'lucide-react'

export default function ShopProductListPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'soldout' | 'draft'>('all')
  const [products, setProducts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [draggedProduct, setDraggedProduct] = useState<string | null>(null)
  const [draggedOver, setDraggedOver] = useState<string | null>(null)
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/shop/products')
      const data = await response.json()
      
      if (data.success) {
        setProducts(data.products || [])
        setLastSync(new Date())
      } else {
        // 에러 시 임시 데이터 사용
        setProducts(getMockData())
      }
    } catch (error) {
      console.error('Failed to load products:', error)
      // 에러 시 임시 데이터 사용
      setProducts(getMockData())
    } finally {
      setIsLoading(false)
    }
  }

  const getMockData = () => [
    {
      id: '1',
      title: '프리미엄 한우 세트',
      productCode: 'SHOP-2025-001',
      link: `${window.location.origin}/shop/product/abc123`,
      shortLink: 'shop/abc123',
      originalPrice: 50000,
      salePrice: 65000,
      status: 'active',
      createdAt: '2025-01-19 10:30',
      views: 150,
      orders: 3,
      stock: 47,
      category: '식품>육류',
      images: ['https://example.com/image1.jpg'],
    },
    {
      id: '2',
      title: '유기농 과일 선물세트',
      productCode: 'SHOP-2025-002',
      link: `${window.location.origin}/shop/product/def456`,
      shortLink: 'shop/def456',
      originalPrice: 30000,
      salePrice: 39000,
      status: 'active',
      createdAt: '2025-01-19 11:00',
      views: 89,
      orders: 5,
      stock: 95,
      category: '식품>과일',
      images: ['https://example.com/image2.jpg'],
    },
    {
      id: '3',
      title: '수제 마카롱 세트',
      productCode: 'SHOP-2025-003',
      link: `${window.location.origin}/shop/product/ghi789`,
      shortLink: 'shop/ghi789',
      originalPrice: 25000,
      salePrice: 32000,
      status: 'soldout',
      createdAt: '2025-01-19 12:00',
      views: 234,
      orders: 30,
      stock: 0,
      category: '식품>디저트',
      images: ['https://example.com/image3.jpg'],
    },
  ]

  const syncProducts = async () => {
    setIsLoading(true)
    try {
      await loadProducts()
      alert('상품 목록이 동기화되었습니다.')
    } catch (error) {
      console.error('Sync error:', error)
      alert('동기화 중 오류가 발생했습니다.')
    }
  }

  const copyToClipboard = (text: string, isShort: boolean = false) => {
    navigator.clipboard.writeText(text)
    
    // 토스트 메시지 표시
    const message = document.createElement('div')
    message.className = 'fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50'
    message.textContent = `${isShort ? '상품 ' : ''}링크가 복사되었습니다!`
    document.body.appendChild(message)
    setTimeout(() => message.remove(), 2000)
  }

  const openShop = () => {
    window.open('/shop', '_blank')
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            판매중
          </span>
        )
      case 'soldout':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3" />
            품절
          </span>
        )
      case 'draft':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3" />
            준비중
          </span>
        )
      default:
        return null
    }
  }

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          product.productCode.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filterStatus === 'all' || product.status === filterStatus
    return matchesSearch && matchesFilter
  })

  const stats = {
    total: products.length,
    active: products.filter(p => p.status === 'active').length,
    soldout: products.filter(p => p.status === 'soldout').length,
    draft: products.filter(p => p.status === 'draft').length,
  }

  const createProductLinkText = (product: any) => {
    return `🎁 ${product.title}\n💰 ${product.salePrice.toLocaleString()}원\n🔗 구매링크: ${product.link}\n\n지금 바로 구매하세요!`
  }

  const formatPrice = (price: number) => {
    return price.toLocaleString()
  }

  // 드래그 앤 드롭 함수들
  const handleDragStart = (e: React.DragEvent, productId: string) => {
    setDraggedProduct(productId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, productId: string) => {
    e.preventDefault()
    setDraggedOver(productId)
  }

  const handleDragLeave = () => {
    setDraggedOver(null)
  }

  const handleDrop = async (e: React.DragEvent, targetProductId: string) => {
    e.preventDefault()

    if (!draggedProduct || draggedProduct === targetProductId) {
      setDraggedProduct(null)
      setDraggedOver(null)
      return
    }

    const draggedIndex = products.findIndex(p => p.id === draggedProduct)
    const targetIndex = products.findIndex(p => p.id === targetProductId)

    if (draggedIndex === -1 || targetIndex === -1) return

    // 로컬에서 순서 변경
    const newProducts = [...products]
    const [movedProduct] = newProducts.splice(draggedIndex, 1)
    newProducts.splice(targetIndex, 0, movedProduct)

    // 순서 번호 업데이트
    const updatedProducts = newProducts.map((product, index) => ({
      ...product,
      order: index + 1
    }))

    setProducts(updatedProducts)

    // 서버에 순서 변경 저장
    try {
      const response = await fetch('/api/shop/products/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          products: updatedProducts.map(p => ({ id: p.id, order: p.order }))
        })
      })

      if (!response.ok) {
        throw new Error('순서 변경 실패')
      }
    } catch (error) {
      console.error('Error updating order:', error)
      // 실패시 원래 순서로 복원
      loadProducts()
    }

    setDraggedProduct(null)
    setDraggedOver(null)
  }

  // 상품 순서 이동 함수들
  const moveProductUp = async (productId: string) => {
    const currentIndex = products.findIndex(p => p.id === productId)
    if (currentIndex > 0) {
      const newProducts = [...products]
      const temp = newProducts[currentIndex]
      newProducts[currentIndex] = newProducts[currentIndex - 1]
      newProducts[currentIndex - 1] = temp

      // 순서 번호 업데이트
      const updatedProducts = newProducts.map((product, index) => ({
        ...product,
        order: index + 1
      }))

      setProducts(updatedProducts)
      await updateProductOrder(updatedProducts)
    }
  }

  const moveProductDown = async (productId: string) => {
    const currentIndex = products.findIndex(p => p.id === productId)
    if (currentIndex < products.length - 1) {
      const newProducts = [...products]
      const temp = newProducts[currentIndex]
      newProducts[currentIndex] = newProducts[currentIndex + 1]
      newProducts[currentIndex + 1] = temp

      // 순서 번호 업데이트
      const updatedProducts = newProducts.map((product, index) => ({
        ...product,
        order: index + 1
      }))

      setProducts(updatedProducts)
      await updateProductOrder(updatedProducts)
    }
  }

  const moveProductToTop = async (productId: string) => {
    const currentIndex = products.findIndex(p => p.id === productId)
    if (currentIndex > 0) {
      const newProducts = [...products]
      const productToMove = newProducts.splice(currentIndex, 1)[0]
      newProducts.unshift(productToMove)

      // 순서 번호 업데이트
      const updatedProducts = newProducts.map((product, index) => ({
        ...product,
        order: index + 1
      }))

      setProducts(updatedProducts)
      await updateProductOrder(updatedProducts)
    }
  }

  const moveProductToBottom = async (productId: string) => {
    const currentIndex = products.findIndex(p => p.id === productId)
    if (currentIndex < products.length - 1) {
      const newProducts = [...products]
      const productToMove = newProducts.splice(currentIndex, 1)[0]
      newProducts.push(productToMove)

      // 순서 번호 업데이트
      const updatedProducts = newProducts.map((product, index) => ({
        ...product,
        order: index + 1
      }))

      setProducts(updatedProducts)
      await updateProductOrder(updatedProducts)
    }
  }

  // 서버에 순서 업데이트 요청
  const updateProductOrder = async (updatedProducts: any[]) => {
    try {
      const response = await fetch('/api/shop/products/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          products: updatedProducts.map(p => ({ id: p.id, order: p.order }))
        })
      })

      if (!response.ok) {
        throw new Error('순서 변경 실패')
      }
    } catch (error) {
      console.error('Error updating order:', error)
      // 실패시 원래 순서로 복원
      loadProducts()
    }
  }

  // SOLD OUT 토글 함수
  const toggleSoldOut = async (productId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'soldout' ? 'active' : 'soldout'

    try {
      const response = await fetch('/api/shop/products/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
          status: newStatus
        })
      })

      if (!response.ok) {
        throw new Error('상태 변경 실패')
      }

      // 로컬 상태 업데이트
      setProducts(prev => prev.map(product =>
        product.id === productId
          ? { ...product, status: newStatus, stock: newStatus === 'soldout' ? 0 : product.stock }
          : product
      ))

      alert(`상품이 ${newStatus === 'soldout' ? '품절' : '판매중'} 상태로 변경되었습니다.`)
    } catch (error) {
      console.error('Error updating status:', error)
      alert('상태 변경 중 오류가 발생했습니다.')
    }
  }

  // 선택 관련 함수들
  const toggleSelectProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts)
    if (newSelected.has(productId)) {
      newSelected.delete(productId)
    } else {
      newSelected.add(productId)
    }
    setSelectedProducts(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set())
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)))
    }
  }

  const deleteSelectedProducts = async () => {
    if (selectedProducts.size === 0) return

    const confirmDelete = confirm(`선택된 ${selectedProducts.size}개 상품을 삭제하시겠습니까?`)
    if (!confirmDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch('/api/shop/products/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productIds: Array.from(selectedProducts)
        })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || '상품 삭제 실패')
      }

      // 로컬 상태에서 삭제된 상품들 제거
      setProducts(prev => prev.filter(product => !selectedProducts.has(product.id)))
      setSelectedProducts(new Set())
      alert(result.message || `${selectedProducts.size}개 상품이 삭제되었습니다.`)
    } catch (error) {
      console.error('Error deleting products:', error)
      const errorMessage = error instanceof Error ? error.message : '상품 삭제 중 오류가 발생했습니다.'
      alert(errorMessage)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Store className="w-6 h-6 text-blue-600" />
              쇼핑몰 상품목록
            </h1>
            <p className="mt-2 text-gray-600">쇼핑몰에 등록된 상품을 관리하고 링크를 복사하여 소매밴드에 포스팅합니다</p>
          </div>
          <div className="flex items-center gap-2">
            {lastSync && (
              <span className="text-xs text-gray-500">
                마지막 동기화: {lastSync.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={syncProducts}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  동기화 중...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  새로고침
                </>
              )}
            </button>
            <button
              onClick={openShop}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Globe className="w-4 h-4" />
              쇼핑몰 보기
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">전체 상품</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="p-3 bg-gray-100 rounded-full">
              <Package className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">판매중</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">품절</p>
              <p className="text-2xl font-bold text-red-600">{stats.soldout}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <Clock className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">준비중</p>
              <p className="text-2xl font-bold text-gray-600">{stats.draft}</p>
            </div>
            <div className="p-3 bg-gray-100 rounded-full">
              <Clock className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="상품명 또는 코드로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          {selectedProducts.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                {selectedProducts.size}개 선택됨
              </span>
              <button
                onClick={deleteSelectedProducts}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    삭제 중...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    선택 삭제
                  </>
                )}
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterStatus === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              전체 ({stats.total})
            </button>
            <button
              onClick={() => setFilterStatus('active')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterStatus === 'active'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              판매중 ({stats.active})
            </button>
            <button
              onClick={() => setFilterStatus('soldout')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterStatus === 'soldout'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              품절 ({stats.soldout})
            </button>
            <button
              onClick={() => setFilterStatus('draft')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterStatus === 'draft'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              준비중 ({stats.draft})
            </button>
          </div>
        </div>
      </div>

      {/* Product List Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filteredProducts.length > 0 && selectedProducts.size === filteredProducts.length}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>선택</span>
                    </div>
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    순서
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상품정보
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    카테고리
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    가격
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    재고/판매
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상품링크
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    액션
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((product, index) => {
                    const marginRate = ((product.salePrice - product.originalPrice) / product.originalPrice * 100).toFixed(1)
                    const isDraggedOver = draggedOver === product.id
                    const isDragging = draggedProduct === product.id
                    return (
                      <tr
                        key={product.id}
                        className={`hover:bg-gray-50 transition-all ${
                          isDraggedOver ? 'border-t-2 border-blue-500 bg-blue-50' : ''
                        } ${isDragging ? 'opacity-50' : ''}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, product.id)}
                        onDragOver={(e) => handleDragOver(e, product.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, product.id)}
                      >
                        <td className="px-3 py-4">
                          <input
                            type="checkbox"
                            checked={selectedProducts.has(product.id)}
                            onChange={() => toggleSelectProduct(product.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-2 py-4">
                          <div className="flex items-center gap-2">
                            <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                            {/* 순서 이동 버튼들 */}
                            <div className="flex items-center gap-1">
                              <div className="flex flex-col gap-1">
                                <button
                                  onClick={() => moveProductToTop(product.id)}
                                  disabled={products.findIndex(p => p.id === product.id) === 0}
                                  className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="최상단으로 이동"
                                >
                                  <ChevronsUp className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => moveProductUp(product.id)}
                                  disabled={products.findIndex(p => p.id === product.id) === 0}
                                  className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="위로 이동"
                                >
                                  <ChevronUp className="w-3 h-3" />
                                </button>
                              </div>
                              <div className="flex flex-col gap-1">
                                <button
                                  onClick={() => moveProductDown(product.id)}
                                  disabled={products.findIndex(p => p.id === product.id) === products.length - 1}
                                  className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="아래로 이동"
                                >
                                  <ChevronDown className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => moveProductToBottom(product.id)}
                                  disabled={products.findIndex(p => p.id === product.id) === products.length - 1}
                                  className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="최하단으로 이동"
                                >
                                  <ChevronsDown className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <span className="text-sm font-medium text-gray-600">{index + 1}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {product.images && product.images[0] && (
                              <img 
                                src={product.images[0]} 
                                alt={product.title}
                                className="w-12 h-12 object-cover rounded border"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.style.display = 'none'
                                }}
                              />
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-900">{product.title}</p>
                              <p className="text-xs text-gray-500">{product.productCode}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                            {product.category}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {formatPrice(product.salePrice)}원
                            </p>
                            <p className="text-xs text-gray-500 line-through">
                              {formatPrice(product.originalPrice)}원
                            </p>
                            <p className="text-xs text-green-600 font-medium">
                              +{marginRate}%
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <p>재고: <span className="font-medium">{product.stock}</span></p>
                            <p>판매: <span className="font-medium text-blue-600">{product.orders}</span></p>
                            <p className="text-xs text-gray-500">조회: {product.views}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(product.status)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <p className="text-sm text-blue-600 font-mono truncate max-w-xs">
                              {product.shortLink}
                            </p>
                            <p className="text-xs text-gray-500 truncate max-w-xs">
                              {product.link}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => toggleSoldOut(product.id, product.status)}
                              className={`p-1.5 rounded transition-colors ${
                                product.status === 'soldout'
                                  ? 'text-green-600 hover:text-green-700 hover:bg-green-50'
                                  : 'text-red-600 hover:text-red-700 hover:bg-red-50'
                              }`}
                              title={product.status === 'soldout' ? '판매중으로 변경' : '품절로 변경'}
                            >
                              <AlertCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => copyToClipboard(product.link)}
                              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                              title="링크 복사"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => copyToClipboard(createProductLinkText(product))}
                              className="p-1.5 text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded transition-colors"
                              title="포스팅용 텍스트 복사"
                            >
                              <Store className="w-4 h-4" />
                            </button>
                            <a
                              href={product.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                              title="상품 페이지 열기"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center">
                      <p className="text-gray-500">
                        {searchQuery || filterStatus !== 'all' 
                          ? '검색 결과가 없습니다.' 
                          : '등록된 상품이 없습니다.'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
