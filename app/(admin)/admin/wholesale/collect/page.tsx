'use client'

import React, { useState, useEffect } from 'react'
import { ArrowLeft, Check, Package, Search, Filter, RefreshCw, Eye, Calendar, User, Image as ImageIcon, Grid3X3, List, Building2, Trash2, BarChart3, ChevronLeft, ChevronRight, X, XCircle } from 'lucide-react'
import Link from 'next/link'

interface CollectedPost {
  id: string
  bandPostId: string
  title: string
  content: string
  author?: string | null
  images: string[]
  originalPrice?: number | null
  adjustedPrice?: number | null
  policyApplied?: boolean
  priceCalculation?: string | null
  status: string
  isSelected: boolean
  bandCreatedAt: string
  // AI Analysis Results
  aiAnalyzed?: boolean
  extractedPrice?: number | null
  salesUnit?: string | null
  shippingFee?: number | null
  hookingTitle?: string | null
  hookingContent?: string | null
  detailedContent?: string | null
  // Product Category (AI classified)
  productCategory?: 'SEAFOOD' | 'MEAT' | 'AGRICULTURE' | 'PROCESSED' | 'OTHER' | null
  // Monitoring Results  
  hasDeadline?: boolean
  deadlineInfo?: string | null
  isAvailable?: boolean
  unavailableReason?: string | null
  lastCheckedAt?: string | null
  // New AI analysis fields
  priceOptions?: Array<{
    option: string
    price: number
  }> | null
  shippingPolicy?: string | null
  wholesaleBand: {
    id: string
    name: string
    bandKey: string
    pricingPolicy?: string
  }
}

export default function CollectPage() {
  const [collectedPosts, setCollectedPosts] = useState<CollectedPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [bandFilter, setBandFilter] = useState('all')
  const [viewType, setViewType] = useState<'card' | 'list' | 'summary'>('summary')
  const [selectedPosts, setSelectedPosts] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedPostForDetail, setSelectedPostForDetail] = useState<CollectedPost | null>(null)
  const [currentDetailIndex, setCurrentDetailIndex] = useState(0)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [isIndividualProcessing, setIsIndividualProcessing] = useState<string | null>(null)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>('')
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [currentImages, setCurrentImages] = useState<string[]>([])

  useEffect(() => {
    loadCollectedPosts()
  }, [])

  // 키보드 네비게이션
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (showImageModal) {
        switch (event.key) {
          case 'Escape':
            setShowImageModal(false)
            break
          case 'ArrowLeft':
            if (selectedImageIndex > 0) {
              handlePrevImage()
            }
            break
          case 'ArrowRight':
            if (selectedImageIndex < currentImages.length - 1) {
              handleNextImage()
            }
            break
        }
      }
    }

    if (showImageModal) {
      document.addEventListener('keydown', handleKeyDown)
      // 스크롤 방지
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [showImageModal, selectedImageIndex, currentImages.length])

  const loadCollectedPosts = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/wholesale/posts')
      const data = await response.json()
      
      if (data.success) {
        const postsWithParsedData = data.posts.map((post: any) => ({
          ...post,
          images: safeParseImages(post.images),
          priceOptions: safeParsePriceOptions(post.priceOptions)
        }))
        setCollectedPosts(postsWithParsedData)
      } else {
        console.error('게시물 로드 실패:', data.error)
        setCollectedPosts([])
      }
    } catch (error) {
      console.error('게시물 로드 오류:', error)
      setCollectedPosts([])
    } finally {
      setIsLoading(false)
    }
  }

  const handlePostToggle = (postId: string) => {
    setSelectedPosts(prev => 
      prev.includes(postId)
        ? prev.filter(id => id !== postId)
        : [...prev, postId]
    )
  }

  const handleDeletePost = async (postId: string, postTitle: string) => {
    if (!confirm(`"${postTitle}" 게시물을 삭제하시겠습니까?`)) {
      return
    }

    try {
      const response = await fetch(`/api/wholesale/posts/delete?id=${postId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.success) {
        setCollectedPosts(prev => prev.filter(post => post.id !== postId))
        setSelectedPosts(prev => prev.filter(id => id !== postId))
      } else {
        alert('게시물 삭제 실패: ' + data.error)
      }
    } catch (error) {
      console.error('게시물 삭제 오류:', error)
      alert('게시물 삭제 중 오류가 발생했습니다.')
    }
  }

  // Filter posts based on search and filters
  const filteredPosts = collectedPosts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         post.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         post.wholesaleBand.name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || post.status.toLowerCase() === statusFilter.toLowerCase()
    
    const matchesBand = bandFilter === 'all' || post.wholesaleBand.id === bandFilter
    
    const matchesCategory = categoryFilter === 'all' || post.productCategory === categoryFilter
    
    return matchesSearch && matchesStatus && matchesBand && matchesCategory
  })

  const handleSelectAll = () => {
    const filteredPostIds = filteredPosts.map(post => post.id)
    setSelectedPosts(prev => 
      prev.length === filteredPostIds.length 
        ? [] 
        : filteredPostIds
    )
  }

  const handleBulkDelete = async () => {
    if (selectedPosts.length === 0) {
      alert('선택된 게시물이 없습니다.')
      return
    }

    if (!confirm(`${selectedPosts.length}개의 게시물을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      return
    }

    try {
      setIsBulkDeleting(true)
      
      // 모든 선택된 게시물 삭제
      const deletePromises = selectedPosts.map(postId => 
        fetch(`/api/wholesale/posts/delete?id=${postId}`, {
          method: 'DELETE'
        })
      )
      
      const responses = await Promise.all(deletePromises)
      const results = await Promise.all(responses.map(res => res.json()))
      
      const successCount = results.filter(result => result.success).length
      const failCount = results.length - successCount
      
      if (successCount > 0) {
        alert(`${successCount}개의 게시물이 삭제되었습니다.${failCount > 0 ? ` (${failCount}개 삭제 실패)` : ''}`)
        setSelectedPosts([])
        await loadCollectedPosts()
      } else {
        alert('게시물 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('일괄 삭제 오류:', error)
      alert('게시물 삭제 중 오류가 발생했습니다.')
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const handleSourcingConfirm = async (postIds?: string[]) => {
    const targetPostIds = postIds || selectedPosts
    
    if (targetPostIds.length === 0) {
      alert('선택된 게시물이 없습니다.')
      return
    }

    if (!confirm(`${targetPostIds.length}개의 게시물을 상품으로 등록하시겠습니까?`)) {
      return
    }

    try {
      if (postIds) {
        setIsIndividualProcessing(postIds[0])
      } else {
        setIsProcessing(true)
      }
      
      const response = await fetch('/api/wholesale/posts/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          postIds: targetPostIds
        })
      })

      const data = await response.json()
      
      if (data.success) {
        alert(`${data.createdProducts}개의 상품이 생성되었습니다!`)
        if (!postIds) {
          setSelectedPosts([])
        }
        await loadCollectedPosts()
        
        // 개별 처리 시에는 페이지 이동하지 않고, 다음 상품으로 이동
        if (postIds && showDetailModal) {
          handleNextPost()
        } else if (!postIds) {
          // 일괄 처리 시에만 상품 목록 페이지로 이동
          window.location.href = '/dashboard/products'
        }
      } else {
        alert('소싱 확정 실패: ' + data.error)
      }
    } catch (error) {
      console.error('소싱 확정 오류:', error)
      alert('소싱 확정 중 오류가 발생했습니다.')
    } finally {
      if (postIds) {
        setIsIndividualProcessing(null)
      } else {
        setIsProcessing(false)
      }
    }
  }

  // 고유한 밴드 목록 생성 (필터용)
  const uniqueBands = collectedPosts.reduce((bands, post) => {
    const existingBand = bands.find(band => band.id === post.wholesaleBand.id)
    if (!existingBand) {
      bands.push(post.wholesaleBand)
    }
    return bands
  }, [] as Array<{id: string, name: string, bandKey: string}>)

  const formatPrice = (price: number | null | string) => {
    if (!price) return '-'
    
    // 문자열인 경우 (이미 포맷된 가격)
    if (typeof price === 'string') {
      // 이미 "원"으로 끝나는 경우 그대로 반환
      if (price.endsWith('원')) {
        return price
      }
      // 숫자 문자열인 경우 숫자로 변환 후 처리
      const numPrice = parseFloat(price.replace(/[^0-9.-]/g, ''))
      if (!isNaN(numPrice)) {
        return `${numPrice.toLocaleString()}원`
      }
      return price
    }
    
    // 숫자인 경우
    const formatted = price.toLocaleString()
    return `${formatted}원`
  }

  // 공급가 추출 - 실제 원가/공급가만 반환
  const getSupplyPrice = (post: CollectedPost) => {
    // 다중 가격 옵션이 있는 경우 첫 번째 옵션의 가격
    if (post.priceOptions && post.priceOptions.length > 0) {
      return post.priceOptions[0].price
    }
    // AI가 추출한 가격이나 원가 (정책 적용 전 가격)
    return post.extractedPrice || post.originalPrice
  }

  // 판매가 추출 - 정책이 적용된 최종 판매가격 (실시간 계산)
  const getSellingPrice = (post: CollectedPost) => {
    // 가격정책이 적용되어 조정된 가격이 있으면 우선 사용
    if (post.adjustedPrice && post.policyApplied) {
      return post.adjustedPrice
    }

    // 실시간 가격정책 적용 계산
    const policyText = post.wholesaleBand.pricingPolicy || ''
    if (!policyText) {
      return null // 가격정책이 없으면 null 반환
    }

    const originalPrice = getSupplyPrice(post)
    const shippingFee = post.shippingFee || 0

    if (!originalPrice) {
      return null
    }

    // 가격 파싱 함수
    const parsePrice = (priceStr: any) => {
      if (!priceStr) return 10000
      if (typeof priceStr === 'number' && !isNaN(priceStr)) return Math.floor(priceStr)

      let cleanStr = String(priceStr)
      const priceMatch = cleanStr.match(/([0-9,]+)원/)
      if (priceMatch) {
        const priceOnly = priceMatch[1].replace(/,/g, '')
        const parsed = parseInt(priceOnly)
        return !isNaN(parsed) && parsed > 0 ? parsed : 10000
      }

      const numberMatch = cleanStr.match(/^[0-9,]+/)
      if (numberMatch) {
        const cleanPrice = numberMatch[0].replace(/,/g, '')
        const parsed = parseInt(cleanPrice)
        return !isNaN(parsed) && parsed > 0 ? parsed : 10000
      }

      const allNumbers = cleanStr.replace(/[^0-9]/g, '')
      if (allNumbers) {
        const limitedNumbers = allNumbers.substring(0, 6)
        const parsed = parseInt(limitedNumbers)
        return !isNaN(parsed) && parsed > 0 ? parsed : 10000
      }

      return 10000
    }

    const parsedPrice = parsePrice(originalPrice)

    // 자연어 가격정책 해석 및 적용
    let result = parsedPrice

    // 1. 가족도매방: 판매가는 원가 그대로
    if (policyText.includes('원가 그대로')) {
      return parsedPrice
    }

    // 2. 요한이네♧소매방 & 초록이네: 수집가격 기준 구간별 마진 적용
    if (policyText.includes('수집가격 기준 구간별 마진 적용')) {
      if (parsedPrice <= 19900) {
        result = parsedPrice + 1000
      } else if (parsedPrice >= 20000 && parsedPrice <= 29900) {
        result = parsedPrice + 2000
      } else if (parsedPrice >= 30000 && parsedPrice <= 39900) {
        result = parsedPrice + 3000
      } else if (parsedPrice >= 40000 && parsedPrice <= 49900) {
        result = parsedPrice + 4000
      } else if (parsedPrice >= 50000 && parsedPrice <= 59900) {
        result = parsedPrice + 5000
      } else if (parsedPrice >= 60000) {
        result = parsedPrice + 6000
      }
      return result
    }

    // 3. 나은 상품 공급방, S D 푸드, 폐쇄몰VIP도매: 공급가에만 마진 적용, 배송비 별도
    if (policyText.includes('공급가와 배송비를 분리, 공급가에만 마진 적용')) {
      if (parsedPrice <= 19900) {
        result = parsedPrice + 4000 // 공급가 + 4,000원 마진
      } else {
        const excess = parsedPrice - 19900
        const additionalSections = Math.ceil(excess / 10000)
        const additionalMargin = additionalSections * 1000
        result = parsedPrice + 4000 + additionalMargin
      }
      return result // 배송비는 별도 표시
    }

    // 기본값: 원가 그대로
    return parsedPrice
  }

  // 배송비 추출
  const getShippingFee = (post: CollectedPost) => {
    if (post.shippingPolicy) {
      return post.shippingPolicy
    }
    if (post.shippingFee === null || post.shippingFee === undefined) {
      return '-'
    }
    if (post.shippingFee === 0) {
      return '무료배송'
    }
    return formatPrice(post.shippingFee || 0)
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  const safeParseImages = (images: string | string[]) => {
    if (Array.isArray(images)) return images
    if (typeof images === 'string') {
      try {
        const parsed = JSON.parse(images)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
    return []
  }

  const safeParsePriceOptions = (priceOptions: string | Array<{option: string, price: number}>) => {
    if (Array.isArray(priceOptions)) return priceOptions
    if (typeof priceOptions === 'string') {
      try {
        const parsed = JSON.parse(priceOptions)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
    return []
  }

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  const handleShowDetail = (post: CollectedPost) => {
    const index = filteredPosts.findIndex(p => p.id === post.id)
    setSelectedPostForDetail(post)
    setCurrentDetailIndex(index)
    setShowDetailModal(true)
  }

  const handlePrevPost = () => {
    if (currentDetailIndex > 0) {
      const newIndex = currentDetailIndex - 1
      setCurrentDetailIndex(newIndex)
      setSelectedPostForDetail(filteredPosts[newIndex])
    }
  }

  const handleNextPost = () => {
    if (currentDetailIndex < filteredPosts.length - 1) {
      const newIndex = currentDetailIndex + 1
      setCurrentDetailIndex(newIndex)
      setSelectedPostForDetail(filteredPosts[newIndex])
    }
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

  // 이미지 확대 기능
  const handleImageClick = (imageUrl: string, images: string[], index: number) => {
    setSelectedImageUrl(imageUrl)
    setCurrentImages(images)
    setSelectedImageIndex(index)
    setShowImageModal(true)
  }

  const handlePrevImage = () => {
    if (selectedImageIndex > 0) {
      const newIndex = selectedImageIndex - 1
      setSelectedImageIndex(newIndex)
      setSelectedImageUrl(currentImages[newIndex])
    }
  }

  const handleNextImage = () => {
    if (selectedImageIndex < currentImages.length - 1) {
      const newIndex = selectedImageIndex + 1
      setSelectedImageIndex(newIndex)
      setSelectedImageUrl(currentImages[newIndex])
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Link
              href="/dashboard/wholesale"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              도매 밴드 관리
            </Link>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">게시물 수집</h1>
              <p className="text-gray-600">수집된 게시물을 확인하고 상품으로 등록할 게시물을 선택하세요.</p>
            </div>
            <div className="text-sm text-gray-500">
              총 {collectedPosts.length}개 게시물 수집됨
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="게시물 제목, 내용, 밴드명으로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="border border-gray-300 rounded-md pl-4 pr-10 py-2 text-sm w-80 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
                </div>
                
                {/* Status Filter */}
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">전체 상태</option>
                  <option value="pending">대기중</option>
                  <option value="selected">선택됨</option>
                  <option value="processed">처리완료</option>
                </select>

                {/* Band Filter */}
                <select 
                  value={bandFilter}
                  onChange={(e) => setBandFilter(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">전체 소싱처</option>
                  {uniqueBands.map(band => (
                    <option key={band.id} value={band.id}>{band.name}</option>
                  ))}
                </select>

                {/* Category Filter */}
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

                {/* View Toggle */}
                <div className="flex bg-gray-100 rounded-md p-1">
                  <button
                    onClick={() => setViewType('card')}
                    className={`px-3 py-1.5 text-sm font-medium rounded transition-colors duration-200 flex items-center gap-1 ${
                      viewType === 'card'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Grid3X3 className="h-4 w-4" />
                    카드
                  </button>
                  <button
                    onClick={() => setViewType('list')}
                    className={`px-3 py-1.5 text-sm font-medium rounded transition-colors duration-200 flex items-center gap-1 ${
                      viewType === 'list'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <List className="h-4 w-4" />
                    리스트
                  </button>
                  <button
                    onClick={() => setViewType('summary')}
                    className={`px-3 py-1.5 text-sm font-medium rounded transition-colors duration-200 flex items-center gap-1 ${
                      viewType === 'summary'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <BarChart3 className="h-4 w-4" />
                    요약리스트
                  </button>
                </div>

                <button 
                  onClick={loadCollectedPosts}
                  disabled={isLoading}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  새로고침
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSelectAll}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200"
                >
                  {selectedPosts.length === filteredPosts.length ? '전체 해제' : '전체 선택'}
                </button>
                
                <button
                  onClick={() => handleSourcingConfirm()}
                  disabled={selectedPosts.length === 0 || isProcessing}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      처리 중...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      소싱 확정 ({selectedPosts.length})
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleBulkDelete}
                  disabled={selectedPosts.length === 0 || isBulkDeleting}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isBulkDeleting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      삭제 중...
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4" />
                      선택 삭제 ({selectedPosts.length})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Posts Grid */}
          <div className="p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-3 text-gray-600">게시물을 불러오는 중...</span>
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">수집된 게시물이 없습니다</h3>
                <p className="text-gray-500">도매 밴드에서 게시물을 먼저 수집해주세요.</p>
              </div>
            ) : viewType === 'card' ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredPosts.map((post) => (
                  <div
                    key={post.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                      selectedPosts.includes(post.id)
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
                    onClick={() => handlePostToggle(post.id)}
                  >
                    {/* Header with checkbox */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedPosts.includes(post.id)}
                          onChange={() => handlePostToggle(post.id)}
                          className="rounded border-gray-300"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          post.status === 'PROCESSED' 
                            ? 'bg-green-100 text-green-700'
                            : post.status === 'SELECTED'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {post.status === 'PROCESSED' ? '처리완료' : post.status === 'SELECTED' ? '선택됨' : '대기중'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {(post.originalPrice || post.extractedPrice || post.adjustedPrice) && (
                          <div className="flex items-center gap-2">
                            {/* 기존가격 (원가) */}
                            {(post.originalPrice || post.extractedPrice) && (
                              <span className="text-xs text-gray-500">
                                원가: {formatPrice(post.originalPrice || post.extractedPrice || 0)}
                              </span>
                            )}
                            
                            {/* 판매가 (정책 적용) */}
                            {getSellingPrice(post) ? (
                              <>
                                <span className="text-xs text-gray-300">→</span>
                                <span className="text-sm font-semibold text-blue-600">
                                  판매가: {formatPrice(getSellingPrice(post) || 0)}
                                </span>
                              </>
                            ) : (
                              <span className="text-xs text-gray-400">
                                → 정책 미적용
                              </span>
                            )}
                            
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeletePost(post.id, post.hookingTitle || post.title)
                          }}
                          className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                          title="삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Images */}
                    {post.images && post.images.length > 0 && (
                      <div className="mb-3">
                        <div className="grid grid-cols-3 gap-2">
                          {post.images.slice(0, 3).map((imageUrl, index) => (
                            <div key={index} className="relative">
                              <img
                                src={imageUrl}
                                alt={`게시물 이미지 ${index + 1}`}
                                className="w-full h-20 object-cover rounded"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0zNSA2NUw1MCA0NUw2NSA2NUgzNVoiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+'
                                }}
                              />
                              {post.images.length > 3 && index === 2 && (
                                <div className="absolute inset-0 bg-black bg-opacity-50 rounded flex items-center justify-center">
                                  <span className="text-white text-xs font-medium">
                                    +{post.images.length - 3}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Content */}
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-2">
                        {truncateText(post.hookingTitle || post.title, 80)}
                      </h3>
                      <p className="text-xs text-gray-600 line-clamp-3">
                        {truncateText(post.detailedContent || post.content, 120)}
                      </p>
                      {post.aiAnalyzed && (
                        <div className="mt-2 text-xs space-y-1">
                          <div className="flex flex-wrap gap-1">
                            {post.productCategory && (
                              <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(post.productCategory)}`}>
                                {getCategoryLabel(post.productCategory || 'OTHER')}
                              </span>
                            )}
                            {post.extractedPrice && (
                              <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                                {formatPrice(post.extractedPrice)}{post.salesUnit ? `/${post.salesUnit}` : ''}
                              </span>
                            )}
                            {post.shippingFee && (
                              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                배송비 {formatPrice(post.shippingFee || 0)}
                              </span>
                            )}
                          </div>
                          {post.hasDeadline && (
                            <div className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs">
                              ⏰ {post.deadlineInfo || '마감시간 있음'}
                            </div>
                          )}
                          {!post.isAvailable && (
                            <div className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">
                              ❌ {post.unavailableReason || '이용 불가'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="mb-3 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleShowDetail(post)
                        }}
                        className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded text-xs font-medium transition-colors duration-200 flex items-center justify-center gap-1"
                      >
                        <Eye className="h-3 w-3" />
                        상세보기
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSourcingConfirm([post.id])
                        }}
                        disabled={post.status === 'PROCESSED' || isIndividualProcessing === post.id}
                        className="flex-1 bg-green-50 hover:bg-green-100 text-green-600 px-3 py-1.5 rounded text-xs font-medium transition-colors duration-200 flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isIndividualProcessing === post.id ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        {post.status === 'PROCESSED' ? '완료됨' : '소싱확정'}
                      </button>
                    </div>

                    {/* Metadata */}
                    <div className="space-y-1 text-xs text-gray-500">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(post.bandCreatedAt)}
                        </div>
                        {post.author && (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {post.author}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-blue-600">
                          {post.wholesaleBand.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <ImageIcon className="h-3 w-3" />
                          {post.images.length}개
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : viewType === 'list' ? (
              /* List View */
              <div className="space-y-4">
                {filteredPosts.map((post) => (
                  <div
                    key={post.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                      selectedPosts.includes(post.id)
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
                    onClick={() => handlePostToggle(post.id)}
                  >
                    <div className="flex gap-4">
                      {/* Left: Checkbox and Images */}
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedPosts.includes(post.id)}
                          onChange={() => handlePostToggle(post.id)}
                          className="rounded border-gray-300 mt-1"
                          onClick={(e) => e.stopPropagation()}
                        />
                        
                        {/* Image thumbnail */}
                        <div className="w-20 h-20 flex-shrink-0">
                          {post.images && post.images.length > 0 ? (
                            <div className="relative">
                              <img
                                src={post.images[0]}
                                alt="게시물 이미지"
                                className="w-full h-full object-cover rounded"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0zNSA2NUw1MCA0NUw2NSA2NUgzNVoiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+'
                                }}
                              />
                              {post.images.length > 1 && (
                                <div className="absolute top-1 right-1 bg-black bg-opacity-60 text-white text-xs px-1 rounded">
                                  +{post.images.length - 1}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="w-full h-full bg-gray-100 rounded flex items-center justify-center">
                              <ImageIcon className="h-8 w-8 text-gray-400" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Center: Content */}
                      <div className="flex-1 min-w-0">
                        {/* Header with status and price */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 text-xs font-medium rounded ${
                              post.status === 'PROCESSED' 
                                ? 'bg-green-100 text-green-700'
                                : post.status === 'SELECTED'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {post.status === 'PROCESSED' ? '처리완료' : post.status === 'SELECTED' ? '선택됨' : '대기중'}
                            </span>
                          </div>
                          {(post.originalPrice || post.extractedPrice || post.adjustedPrice) && (
                            <div className="flex items-center gap-2">
                              {/* 기존가격 */}
                              {(post.originalPrice || post.extractedPrice) && (
                                <span className="text-sm text-gray-500">
                                  원가: {formatPrice(post.originalPrice || post.extractedPrice || 0)}
                                </span>
                              )}
                              
                              {/* 판매가 (정책 적용) */}
                              {getSellingPrice(post) ? (
                                <>
                                  <span className="text-sm text-gray-300">→</span>
                                  <span className="text-lg font-semibold text-blue-600">
                                    {formatPrice(getSellingPrice(post) || 0)}
                                  </span>
                                </>
                              ) : (
                                <span className="text-sm text-gray-400">
                                  → 정책 미적용
                                </span>
                              )}
                              
                            </div>
                          )}
                        </div>

                        {/* Title and Content */}
                        <div className="mb-3">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                            {post.hookingTitle || post.title}
                          </h3>
                          <p className="text-sm text-gray-600 line-clamp-3">
                            {post.detailedContent || post.content}
                          </p>
                          {post.aiAnalyzed && (
                            <div className="mt-2 space-y-2">
                              <div className="flex flex-wrap gap-2 text-sm">
                                {post.extractedPrice && (
                                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                                    {formatPrice(post.extractedPrice)}{post.salesUnit ? `/${post.salesUnit}` : ''}
                                  </span>
                                )}
                                {post.shippingFee && (
                                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                    배송비 {formatPrice(post.shippingFee || 0)}
                                  </span>
                                )}
                              </div>
                              {post.hasDeadline && (
                                <div className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-sm">
                                  ⏰ {post.deadlineInfo || '마감시간 있음'}
                                </div>
                              )}
                              {!post.isAvailable && (
                                <div className="bg-red-100 text-red-700 px-2 py-1 rounded text-sm">
                                  ❌ {post.unavailableReason || '이용 불가'}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="mb-3 flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleShowDetail(post)
                            }}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-4 py-2 rounded text-sm font-medium transition-colors duration-200 flex items-center gap-2"
                          >
                            <Eye className="h-4 w-4" />
                            상세보기
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSourcingConfirm([post.id])
                            }}
                            disabled={post.status === 'PROCESSED' || isIndividualProcessing === post.id}
                            className="bg-green-50 hover:bg-green-100 text-green-600 px-4 py-2 rounded text-sm font-medium transition-colors duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isIndividualProcessing === post.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                            {post.status === 'PROCESSED' ? '완료됨' : '소싱확정'}
                          </button>
                        </div>

                        {/* Metadata */}
                        <div className="flex items-center justify-between text-sm text-gray-500">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                              <Building2 className="h-4 w-4" />
                              <span className="font-medium text-blue-600">
                                {post.wholesaleBand.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {formatDate(post.bandCreatedAt)}
                            </div>
                            {post.author && (
                              <div className="flex items-center gap-1">
                                <User className="h-4 w-4" />
                                {post.author}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              <ImageIcon className="h-4 w-4" />
                              {post.images.length}개
                            </div>
                            {post.originalPrice && (
                              <span className="text-sm font-semibold text-green-600">
                                {formatPrice(post.originalPrice)}
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeletePost(post.id, post.hookingTitle || post.title)
                              }}
                              className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                              title="삭제"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : viewType === 'summary' ? (
              <div className="bg-white rounded-lg shadow">
                <div className="overflow-x-auto">
                  <table className="w-full divide-y divide-gray-200" style={{ minWidth: '1150px' }}>
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-1 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '35px' }}>
                          선택
                        </th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '160px' }}>
                          제목
                        </th>
                        <th className="px-1 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '50px' }}>
                          분류
                        </th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '110px' }}>
                          공급가
                        </th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '110px' }}>
                          판매가
                        </th>
                        <th className="px-1 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '70px' }}>
                          배송비
                        </th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '100px' }}>
                          소싱처
                        </th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '160px' }}>
                          상태
                        </th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '100px' }}>
                          작업
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredPosts.map((post) => (
                        <tr key={post.id} className={`hover:bg-gray-50 ${
                          selectedPosts.includes(post.id) ? 'bg-blue-50' : ''
                        }`}>
                          <td className="px-1 py-4 whitespace-nowrap" style={{ width: '35px' }}>
                            <input
                              type="checkbox"
                              checked={selectedPosts.includes(post.id)}
                              onChange={() => handlePostToggle(post.id)}
                              className="rounded border-gray-300"
                            />
                          </td>
                          <td className="px-2 py-4" style={{ width: '160px' }}>
                            <div className="text-sm font-medium text-gray-900">
                              {truncateText(post.hookingTitle || post.title, 28)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {truncateText(post.hookingContent || post.detailedContent || post.content, 30)}
                            </div>
                          </td>
                          <td className="px-1 py-4 whitespace-nowrap" style={{ width: '50px' }}>
                            <span className={`px-1 py-1 text-xs font-medium rounded ${getCategoryColor(post.productCategory || 'OTHER')}`}>
                              {getCategoryLabel(post.productCategory || 'OTHER')}
                            </span>
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap" style={{ width: '110px' }}>
                            <div className="text-sm font-semibold text-green-600">
                              {formatPrice(getSupplyPrice(post) || 0)}
                              {post.salesUnit && (
                                <span className="text-xs text-gray-500 ml-1">/{post.salesUnit}</span>
                              )}
                              {post.priceOptions && post.priceOptions.length > 0 && (
                                <div className="text-xs text-gray-500 mt-1">
                                  +{post.priceOptions.length - 1}옵션
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap" style={{ width: '110px' }}>
                            <div className="text-sm font-semibold">
                              {getSellingPrice(post) ? (
                                <span className="text-blue-600">
                                  {formatPrice(getSellingPrice(post) || 0)}
                                  <div className="text-xs text-gray-500 mt-1">정책적용</div>
                                </span>
                              ) : (
                                <span className="text-gray-500">
                                  미적용
                                  <div className="text-xs text-gray-400 mt-1">정책없음</div>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-1 py-4 whitespace-nowrap" style={{ width: '70px' }}>
                            <div className="text-xs text-gray-600">
                              {getShippingFee(post)}
                            </div>
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap" style={{ width: '100px' }}>
                            <div className="text-sm text-blue-600 font-medium">
                              {truncateText(post.wholesaleBand.name, 8)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatDate(post.bandCreatedAt).split(' ')[0]}
                            </div>
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap" style={{ width: '160px' }}>
                            <div className="space-y-1">
                              <span className={`inline-flex px-1 py-1 text-xs font-semibold rounded ${
                                post.status === 'PROCESSED'
                                  ? 'bg-green-100 text-green-800'
                                  : post.status === 'SELECTED'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {post.status === 'PROCESSED' ? '처리완료' : post.status === 'SELECTED' ? '선택됨' : '대기중'}
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {post.aiAnalyzed && (
                                  <span className="inline-flex px-1 py-1 text-xs font-semibold rounded bg-purple-100 text-purple-800">
                                    AI완료
                                  </span>
                                )}
                                {post.hasDeadline && (
                                  <span className="inline-flex px-1 py-1 text-xs font-semibold rounded bg-orange-100 text-orange-800">
                                    ⏰
                                  </span>
                                )}
                                {!post.isAvailable && (
                                  <span className="inline-flex px-1 py-1 text-xs font-semibold rounded bg-red-100 text-red-800">
                                    ❌
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap" style={{ width: '100px' }}>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleShowDetail(post)}
                                className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50"
                                title="상세보기"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleSourcingConfirm([post.id])}
                                disabled={post.status === 'PROCESSED' || isIndividualProcessing === post.id}
                                className="text-green-500 hover:text-green-700 p-1 rounded hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                title={post.status === 'PROCESSED' ? '완료됨' : '소싱확정'}
                              >
                                {isIndividualProcessing === post.id ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                onClick={() => handleDeletePost(post.id, post.hookingTitle || post.title)}
                                className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                                title="삭제"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Detail Modal */}
        {showDetailModal && selectedPostForDetail && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-bold text-gray-900">상세보기</h2>
                  <div className="flex items-center gap-2">
                    {selectedPostForDetail.productCategory && (
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(selectedPostForDetail.productCategory)}`}>
                        {getCategoryLabel(selectedPostForDetail.productCategory)}
                      </span>
                    )}
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      selectedPostForDetail.status === 'PROCESSED' 
                        ? 'bg-green-100 text-green-700'
                        : selectedPostForDetail.status === 'SELECTED'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {selectedPostForDetail.status === 'PROCESSED' ? '처리완료' : selectedPostForDetail.status === 'SELECTED' ? '선택됨' : '대기중'}
                    </span>
                  </div>
                </div>
                
                {/* Navigation and Close */}
                <div className="flex items-center gap-2">
                  <div className="text-sm text-gray-500">
                    {currentDetailIndex + 1} / {filteredPosts.length}
                  </div>
                  <button
                    onClick={handlePrevPost}
                    disabled={currentDetailIndex === 0}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="이전 상품"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={handleNextPost}
                    disabled={currentDetailIndex === filteredPosts.length - 1}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="다음 상품"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="p-2 rounded-lg hover:bg-gray-100"
                    title="닫기"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Modal Content - 상하 구조 */}
              <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-120px)]">
                {/* 상단 영역 - 좌우 구조 (원본 vs AI 개선) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  {/* 좌측: 원본 내용 */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                      원본 내용
                    </h3>
                    
                    <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-500">
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">제목</h4>
                        <p className="text-gray-900 font-medium text-base">{selectedPostForDetail.title}</p>
                      </div>
                      
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">내용</h4>
                        <div className="text-gray-900 whitespace-pre-wrap text-sm leading-relaxed bg-white p-3 rounded border">
                          {selectedPostForDetail.content}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">댓글</h4>
                        <div className="bg-white p-3 rounded border">
                          {/* 댓글이 있다면 표시, 없으면 "댓글 없음" 표시 */}
                          <p className="text-gray-500 text-sm italic">댓글 정보는 수집 시 포함됩니다.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 우측: AI 개선 내용 */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                      AI 개선 및 추출 내용
                      {!selectedPostForDetail.aiAnalyzed && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                          분석 대기중
                        </span>
                      )}
                    </h3>
                    
                    <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                      {selectedPostForDetail.aiAnalyzed ? (
                        <>
                          {/* 업로드용 제목 섹션 */}
                          <div className="mb-4 p-3 bg-white rounded border border-green-200">
                            <h4 className="text-sm font-semibold text-green-800 mb-2">📝 업로드용 제목</h4>
                            <p className="text-gray-900 font-semibold text-base bg-yellow-50 p-2 rounded">
                              {selectedPostForDetail.hookingTitle || '미생성'}
                            </p>
                          </div>
                          
                          {/* 핵심 포인트 내용 */}
                          <div className="mb-4 p-3 bg-white rounded border border-green-200">
                            <h4 className="text-sm font-semibold text-green-800 mb-2">🎯 핵심 포인트 (100자)</h4>
                            <div className="text-gray-900 text-sm leading-relaxed">
                              {selectedPostForDetail.hookingContent || '미생성'}
                            </div>
                          </div>

                          {/* 하단 정보 섹션 */}
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-green-800">📊 추출된 정보</h4>
                            
                            {/* 가격 옵션 정보 */}
                            <div className="grid grid-cols-1 gap-3">
                              {/* 다중 가격 옵션 표시 */}
                              {selectedPostForDetail.priceOptions && selectedPostForDetail.priceOptions.length > 0 && (
                                <div className="bg-white p-3 rounded border">
                                  <h5 className="text-sm font-semibold text-green-800 mb-3">💰 추출된 옵션</h5>
                                  <div className="space-y-2">
                                    {selectedPostForDetail.priceOptions.map((option, index) => (
                                      <div key={index} className="flex justify-between items-center py-2 px-3 bg-green-50 rounded-lg">
                                        <span className="text-sm font-medium text-gray-700">
                                          옵션 {index + 1}: {option.option}
                                        </span>
                                        <span className="text-base font-bold text-green-600">
                                          {formatPrice(option.price)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* 기본 가격 (옵션이 없을 때만 표시) */}
                              {selectedPostForDetail.extractedPrice && (!selectedPostForDetail.priceOptions || selectedPostForDetail.priceOptions.length === 0) && (
                                <div className="bg-white p-3 rounded border">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">추출된 가격</span>
                                    <span className="text-lg font-bold text-green-600">
                                      {formatPrice(selectedPostForDetail.extractedPrice)}
                                      {selectedPostForDetail.salesUnit && (
                                        <span className="text-sm text-gray-500 ml-1">/{selectedPostForDetail.salesUnit}</span>
                                      )}
                                    </span>
                                  </div>
                                </div>
                              )}
                              
                              {/* 배송 정책 섹션 */}
                              {selectedPostForDetail.shippingPolicy && (
                                <div className="bg-white p-3 rounded border">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">배송 정책</span>
                                    <span className="text-base font-semibold text-blue-600">
                                      {selectedPostForDetail.shippingPolicy}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* 개별 배송비 (기존 호환성) */}
                              {!selectedPostForDetail.shippingPolicy && selectedPostForDetail.shippingFee !== null && (
                                <div className="bg-white p-3 rounded border">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">배송비</span>
                                    <span className="text-base font-semibold text-blue-600">
                                      {selectedPostForDetail.shippingFee === 0 ? '무료배송' : formatPrice(selectedPostForDetail.shippingFee || 0)}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {selectedPostForDetail.productCategory && (
                                <div className="bg-white p-3 rounded border">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">상품 분류</span>
                                    <span className={`px-2 py-1 rounded text-sm font-medium ${getCategoryColor(selectedPostForDetail.productCategory)}`}>
                                      {getCategoryLabel(selectedPostForDetail.productCategory)}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* 특이사항 */}
                            {(selectedPostForDetail.hasDeadline || !selectedPostForDetail.isAvailable) && (
                              <div className="space-y-2">
                                <h5 className="text-sm font-semibold text-gray-700">⚠️ 특이사항</h5>
                                {selectedPostForDetail.hasDeadline && (
                                  <div className="bg-orange-100 text-orange-700 px-3 py-2 rounded text-sm">
                                    ⏰ {selectedPostForDetail.deadlineInfo || '마감시간 있음'}
                                  </div>
                                )}
                                {!selectedPostForDetail.isAvailable && (
                                  <div className="bg-red-100 text-red-700 px-3 py-2 rounded text-sm">
                                    ❌ {selectedPostForDetail.unavailableReason || '이용 불가'}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin" />
                          <p>AI 분석이 완료되지 않았습니다.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 중앙 영역 - 스룩페이/소매밴드 최종 게시 내용 */}
                {selectedPostForDetail.aiAnalyzed && (
                  <div className="mt-8">
                    <div className="border-t-2 border-green-300 pt-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                        📱 스룩페이/소매밴드 최종 게시 내용
                        <span className="text-xs bg-green-200 text-green-700 px-2 py-1 rounded-full">
                          실제 업로드 내용
                        </span>
                      </h3>

                      <div className="bg-white border-2 border-green-300 rounded-lg p-6 space-y-6">
                        {/* 최종 제목 */}
                        <div>
                          <div className="text-sm font-medium text-green-600 mb-2">📌 게시 제목</div>
                          <div className="text-xl font-bold text-gray-900 bg-gray-50 p-4 rounded border">
                            {selectedPostForDetail.hookingTitle || selectedPostForDetail.title}
                          </div>
                        </div>

                        {/* 최종 내용 */}
                        <div>
                          <div className="text-sm font-medium text-green-600 mb-2">📝 게시 내용</div>
                          <div className="bg-gray-50 p-4 rounded border">
                            <div className="whitespace-pre-wrap text-gray-900 text-base leading-relaxed">
                              {(() => {
                                // 최종 게시 내용 조합
                                const finalContent = []

                                // 후킹 내용이 있으면 사용, 없으면 상세 내용 사용
                                const mainContent = selectedPostForDetail.hookingContent || selectedPostForDetail.detailedContent || selectedPostForDetail.content
                                if (mainContent) {
                                  finalContent.push(mainContent)
                                }

                                // 가격 정보 표시 (고객용 최종 게시 내용 - 공급가격 제외)
                                let priceAdded = false

                                // 판매가만 표시 (고객이 실제 구매할 가격)
                                const sellingPrice = getSellingPrice(selectedPostForDetail)
                                if (sellingPrice) {
                                  finalContent.push('')
                                  finalContent.push('💰 판매가격:')
                                  finalContent.push(`${sellingPrice.toLocaleString()}원`)
                                  priceAdded = true
                                }

                                // 가격 옵션 표시 (고객용 - 판매가격으로)
                                if (selectedPostForDetail.priceOptions && selectedPostForDetail.priceOptions.length > 0) {
                                  finalContent.push('')
                                  finalContent.push('📋 가격 옵션:')
                                  selectedPostForDetail.priceOptions.forEach((option: any, index: number) => {
                                    const optionName = option.option || `옵션${index + 1}`
                                    const price = option.price || 0
                                    finalContent.push(`${index + 1}. ${optionName}: ${price.toLocaleString()}원`)
                                  })
                                  priceAdded = true
                                }

                                // 판매가가 없으면 기본 가격 표시 (공급가가 아닌 판매 예정가)
                                if (!priceAdded) {
                                  const basePrice = selectedPostForDetail.extractedPrice || selectedPostForDetail.originalPrice
                                  if (basePrice) {
                                    finalContent.push('')
                                    finalContent.push('💰 판매가격:')
                                    finalContent.push(`${basePrice.toLocaleString()}원`)
                                  }
                                }

                                // 배송 정보 추가
                                if (selectedPostForDetail.shippingPolicy) {
                                  finalContent.push('')
                                  finalContent.push(`🚚 배송: ${selectedPostForDetail.shippingPolicy}`)
                                } else if (selectedPostForDetail.shippingFee !== null && selectedPostForDetail.shippingFee !== undefined) {
                                  finalContent.push('')
                                  if (selectedPostForDetail.shippingFee === 0) {
                                    finalContent.push('🚚 배송비: 무료배송')
                                  } else {
                                    finalContent.push(`🚚 배송비: ${selectedPostForDetail.shippingFee.toLocaleString()}원`)
                                  }
                                }


                                // 마감 정보 추가
                                if (selectedPostForDetail.hasDeadline && selectedPostForDetail.deadlineInfo) {
                                  finalContent.push('')
                                  finalContent.push('⏰ 주문 마감:')
                                  finalContent.push(selectedPostForDetail.deadlineInfo)
                                }

                                return finalContent.join('\n')
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* 미리보기 정보 */}
                        <div className="text-sm text-green-600 bg-green-50 p-3 rounded">
                          💡 이 내용이 스룩페이와 소매밴드에 실제로 게시됩니다.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 하단 영역 - 이미지 갤러리 */}
                {selectedPostForDetail.images.length > 0 && (
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                      이미지 갤러리 ({safeParseImages(selectedPostForDetail.images).length}개)
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {safeParseImages(selectedPostForDetail.images).map((imageUrl: string, index: number) => (
                        <div key={index} className="aspect-square group relative">
                          <img
                            src={imageUrl}
                            alt={`게시물 이미지 ${index + 1}`}
                            className="w-full h-full object-cover rounded-lg border border-gray-200 cursor-pointer hover:shadow-lg transition-all duration-200 group-hover:scale-105"
                            onClick={(e) => {
                              e.stopPropagation()
                              const allImages = safeParseImages(selectedPostForDetail.images)
                              handleImageClick(imageUrl, allImages, index)
                            }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0zNSA2NUw1MCA0NUw2NSA2NUgzNVoiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+'
                            }}
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white">
                              <Eye className="h-6 w-6" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 게시물 메타 정보 */}
                <div className="mt-6 bg-gray-50 p-4 rounded-lg border-t">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">📝 게시물 정보</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 block">소싱처</span>
                      <p className="font-medium text-blue-600">{selectedPostForDetail.wholesaleBand.name}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 block">작성자</span>
                      <p className="font-medium">{selectedPostForDetail.author || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 block">작성일</span>
                      <p className="font-medium">{formatDate(selectedPostForDetail.bandCreatedAt)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 block">수집 이미지</span>
                      <p className="font-medium">{safeParseImages(selectedPostForDetail.images).length}개</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={handlePrevPost}
                    disabled={currentDetailIndex === 0}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    이전 상품
                  </button>
                  <button
                    onClick={handleNextPost}
                    disabled={currentDetailIndex === filteredPosts.length - 1}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    다음 상품
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                  >
                    닫기
                  </button>
                  <button
                    onClick={() => handleSourcingConfirm([selectedPostForDetail.id])}
                    disabled={selectedPostForDetail.status === 'PROCESSED' || isIndividualProcessing === selectedPostForDetail.id}
                    className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isIndividualProcessing === selectedPostForDetail.id ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        처리 중...
                      </>
                    ) : selectedPostForDetail.status === 'PROCESSED' ? (
                      '이미 처리됨'
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        소싱 확정
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Image Modal - 이미지 확대 모달 */}
        {showImageModal && selectedImageUrl && (
          <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60] p-4">
            <div className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center">
              {/* Close Button */}
              <button
                onClick={() => setShowImageModal(false)}
                className="absolute top-4 right-4 p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full text-white transition-all duration-200 z-10"
                title="닫기"
              >
                <X className="h-6 w-6" />
              </button>

              {/* Navigation Buttons */}
              {currentImages.length > 1 && (
                <>
                  <button
                    onClick={handlePrevImage}
                    disabled={selectedImageIndex === 0}
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 p-3 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed z-10"
                    title="이전 이미지"
                  >
                    <ChevronLeft className="h-8 w-8" />
                  </button>
                  <button
                    onClick={handleNextImage}
                    disabled={selectedImageIndex === currentImages.length - 1}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 p-3 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed z-10"
                    title="다음 이미지"
                  >
                    <ChevronRight className="h-8 w-8" />
                  </button>
                </>
              )}

              {/* Image Counter */}
              {currentImages.length > 1 && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-4 py-2 rounded-full text-sm z-10">
                  {selectedImageIndex + 1} / {currentImages.length}
                </div>
              )}

              {/* Main Image */}
              <div className="flex items-center justify-center w-full h-full">
                <img
                  src={selectedImageUrl}
                  alt={`이미지 ${selectedImageIndex + 1}`}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0zNSA2NUw1MCA0NUw2NSA2NUgzNVoiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+'
                  }}
                />
              </div>

              {/* Image Info */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-4 py-2 rounded-full text-sm z-10">
                게시물 이미지
              </div>

              {/* Keyboard Navigation Hint */}
              {currentImages.length > 1 && (
                <div className="absolute bottom-4 right-4 bg-black bg-opacity-50 text-white px-3 py-2 rounded text-xs z-10">
                  ← → 키로 이동 가능
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}