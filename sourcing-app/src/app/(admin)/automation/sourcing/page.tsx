'use client'

import { useState, useEffect, useMemo } from 'react'
import { Package, Search, Edit3, Trash2, Plus, Eye, DollarSign, Calendar, Tag, Download, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react'

interface Product {
  id: string
  title: string
  originalPrice: number
  salePrice: number
  description: string
  status: string
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

  // 쇼핑몰 등록 상태
  isRegisteredToShop?: boolean
}

export default function SourcingPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editedProduct, setEditedProduct] = useState<Product | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [currentDetailIndex, setCurrentDetailIndex] = useState(0)
  const [isIndividualProcessing, setIsIndividualProcessing] = useState(false)
  const [newImageUrl, setNewImageUrl] = useState('')

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
      const response = await fetch('/api/products')
      const data = await response.json()

      console.log('🔍 API 응답:', data)
      console.log('🔍 data.success:', data.success)
      console.log('🔍 data.data:', data.data)
      console.log('🔍 data.data.products:', data.data?.products)

      if (data.success) {
        const productsData = data.data?.products || data.products || []
        console.log('✅ 상품 설정:', productsData)
        setProducts(productsData)
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

  // 체크박스 관련 함수들
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked)
    if (checked) {
      // 쇼핑몰에 등록되지 않은 상품만 선택
      const selectableProducts = paginatedProducts.filter(p => !p.isRegisteredToShop)
      setSelectedProducts(selectableProducts.map(p => p.id))
    } else {
      setSelectedProducts([])
    }
  }

  const handleProductSelect = (productId: string, checked: boolean) => {
    if (checked) {
      setSelectedProducts(prev => [...prev, productId])
    } else {
      setSelectedProducts(prev => prev.filter(id => id !== productId))
    }

    // 전체 선택 체크박스 업데이트 - 선택 가능한 상품 기준으로 계산
    const selectableProducts = paginatedProducts.filter(p => !p.isRegisteredToShop)
    const newSelectedCount = checked ? selectedProducts.length + 1 : selectedProducts.length - 1
    setSelectAll(newSelectedCount === selectableProducts.length)
  }

  // 페이지당 항목 수 변경 함수
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1) // 첫 페이지로 리셋
    setSelectedProducts([]) // 선택된 상품 초기화
    setSelectAll(false) // 전체 선택 해제
  }

  // 쇼핑몰 등록 함수 (선택된 상품)
  const handleShopRegistration = async () => {
    if (selectedProducts.length === 0) {
      alert('등록할 상품을 선택해주세요.')
      return
    }

    // 이미 등록된 상품 제외
    const unregisteredProducts = selectedProducts.filter(productId => {
      const product = products.find(p => p.id === productId)
      return product && !product.isRegisteredToShop
    })

    if (unregisteredProducts.length === 0) {
      alert('선택된 상품이 모두 이미 쇼핑몰에 등록되어 있습니다.')
      return
    }

    await processShopRegistration(unregisteredProducts, `선택된 ${unregisteredProducts.length}개`)
  }

  // 전체 상품 쇼핑몰 등록 함수
  const handleAllProductsRegistration = async () => {
    if (products.length === 0) {
      alert('등록할 상품이 없습니다.')
      return
    }

    // 이미 등록되지 않은 상품만 필터링
    const unregisteredProducts = products.filter(p => !p.isRegisteredToShop)

    if (unregisteredProducts.length === 0) {
      alert('모든 상품이 이미 쇼핑몰에 등록되어 있습니다.')
      return
    }

    const unregisteredProductIds = unregisteredProducts.map(p => p.id)
    await processShopRegistration(unregisteredProductIds, `미등록 ${unregisteredProducts.length}개`)
  }

  // 공통 쇼핑몰 등록 처리 함수
  const processShopRegistration = async (productIds: string[], description: string) => {
    try {
      // 쇼핑몰 API로 상품 등록
      const response = await fetch('/api/shop/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productIds: productIds
        })
      })

      if (!response.ok) {
        throw new Error('쇼핑몰 등록에 실패했습니다.')
      }

      const result = await response.json()

      if (result.success) {
        alert(`${description} 상품이 쇼핑몰에 등록되었습니다.`)
        // 상태 업데이트
        await loadProducts()
      } else {
        alert('쇼핑몰 등록에 실패했습니다: ' + result.error)
      }

    } catch (error) {
      console.error('쇼핑몰 등록 오류:', error)
      alert('쇼핑몰 등록 중 오류가 발생했습니다.')
    }
  }

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (product.hookingTitle && product.hookingTitle.toLowerCase().includes(searchTerm.toLowerCase())) ||
                           (product.wholesaleBandName && product.wholesaleBandName.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesStatus = statusFilter === 'all' || product.status.toLowerCase() === statusFilter.toLowerCase()
      const matchesCategory = categoryFilter === 'all' || product.productCategory === categoryFilter

      return matchesSearch && matchesStatus && matchesCategory
    })
  }, [products, searchTerm, statusFilter, categoryFilter])

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

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; className: string } } = {
      DRAFT: { label: '초안', className: 'bg-gray-100 text-gray-800' },
      ACTIVE: { label: '소싱완료', className: 'bg-green-100 text-green-800' },
      SOLD_OUT: { label: '품절', className: 'bg-red-100 text-red-800' }
    }

    const statusInfo = statusMap[status] || { label: status, className: 'bg-gray-100 text-gray-800' }

    return (
      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${statusInfo.className}`}>
        {statusInfo.label}
      </span>
    )
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

  // 공급가 추출 (정책 적용 전 원가)
  const getSupplyPrice = (product: Product) => {
    return product.originalPrice
  }

  // 판매가 추출 - 정책이 적용된 최종 판매가격 (실시간 계산)
  const getSellingPrice = (product: Product) => {
    // 수동 조정된 가격이 있으면 우선 사용 (편집된 경우)
    if (product.salePrice && product.salePrice > 0) {
      return product.salePrice
    }

    // 실시간 가격정책 적용 계산
    if (!product.wholesaleBandName || !product.originalPrice || product.originalPrice <= 0) {
      return product.originalPrice // 기본값 반환
    }

    // parsePrice로 원가를 파싱한 후 가격정책 적용
    const parsedOriginalPrice = parsePrice(product.originalPrice)
    return applyPricingPolicy(parsedOriginalPrice, product.shippingFee || 0, product.wholesaleBandName)
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

  // 배송비 정보 조합 함수 (collect 페이지와 동일)
  const getShippingInfo = (product: Product) => {
    // shippingFee가 숫자인 경우
    if (typeof product.shippingFee === 'number') {
      if (product.shippingFee === 0) {
        return '(무료배송)'
      }
      return `(배송비 ${formatPrice(product.shippingFee)})`
    }

    // 배송비 정보가 없거나 null인 경우 기본값
    return '(무료배송)'
  }

  // 가격 파싱 함수 (공통) - price.md 파일 기준
  const parsePrice = (priceStr: any) => {
    if (!priceStr) return 10000
    if (typeof priceStr === 'number' && !isNaN(priceStr) && priceStr > 0) {
      return Math.floor(priceStr)
    }

    // 문자열 처리
    let cleanStr = String(priceStr)

    // 먼저 "원" 앞의 숫자만 추출 (콤마 포함)
    const priceMatch = cleanStr.match(/([0-9,]+)원/)
    if (priceMatch) {
      const priceOnly = priceMatch[1].replace(/,/g, '')
      const parsed = parseInt(priceOnly)
      return !isNaN(parsed) && parsed > 0 ? parsed : 10000
    }

    // "원"이 없는 경우 첫 번째 연속된 숫자 그룹만 추출
    const numberMatch = cleanStr.match(/^[0-9,]+/)
    if (numberMatch) {
      const cleanPrice = numberMatch[0].replace(/,/g, '')
      const parsed = parseInt(cleanPrice)
      return !isNaN(parsed) && parsed > 0 ? parsed : 10000
    }

    // 최후의 수단: 모든 숫자 추출 후 앞 6자리까지만
    const allNumbers = cleanStr.replace(/[^0-9]/g, '')
    if (allNumbers) {
      const limitedNumbers = allNumbers.substring(0, 6) // 최대 6자리
      const parsed = parseInt(limitedNumbers)
      return !isNaN(parsed) && parsed > 0 ? parsed : 10000
    }

    return 10000
  }

  // 가격정책 적용 함수 - price.md 파일 기준 정확한 가격정책 적용 함수
  const applyPricingPolicy = (originalPrice: number, shippingFee = 0, bandName: string) => {
    const policyText = getPricingPolicyByBandName(bandName)
    if (!policyText) {
      return originalPrice // 가격정책이 없으면 원가 그대로
    }

    let result = originalPrice

    // 1. 가족도매방: 판매가는 원가 그대로
    if (policyText.includes('원가 그대로')) {
      result = originalPrice
      return result
    }

    // 2. 요한이네♧소매방 & 초록이네: 수집가격 기준 구간별 마진 적용
    if (policyText.includes('수집가격 기준 구간별 마진 적용')) {
      const basePrice = originalPrice

      if (basePrice <= 19900) {
        result = basePrice + 1000
      } else if (basePrice >= 20000 && basePrice <= 29900) {
        result = basePrice + 2000
      } else if (basePrice >= 30000 && basePrice <= 39900) {
        result = basePrice + 3000
      } else if (basePrice >= 40000 && basePrice <= 49900) {
        result = basePrice + 4000
      } else if (basePrice >= 50000 && basePrice <= 59900) {
        result = basePrice + 5000
      } else if (basePrice >= 60000) {
        result = basePrice + 6000
      }

      return result
    }

    // 3. 나은 상품 공급방, S D 푸드, 폐쇄몰VIP도매: 공급가와 배송비를 분리, 공급가에만 마진 적용
    if (policyText.includes('공급가와 배송비를 분리, 공급가에만 마진 적용')) {
      const supplyPrice = originalPrice

      if (supplyPrice <= 19900) {
        result = supplyPrice + 4000 // 공급가 + 4,000원 마진
      } else {
        // 19,900원 초과시: 기본 4,000원 + 초과구간별(1만원마다) 1,000원
        const excess = supplyPrice - 19900
        const additionalSections = Math.ceil(excess / 10000)
        const additionalMargin = additionalSections * 1000
        result = supplyPrice + 4000 + additionalMargin
      }

      return result // 배송비는 별도 표시이므로 포함하지 않음
    }

    // 기본값: 원가 그대로
    return originalPrice
  }

  // 최종 게시 내용 생성 함수 (collect 페이지와 동일)
  const generateFinalPostingContent = (product: Product) => {
    const finalContent = []

    // 후킹 내용이 있으면 사용, 없으면 상세 내용 사용
    const mainContent = product.hookingContent || product.detailedContent || product.description
    if (mainContent) {
      finalContent.push(mainContent)
    }

    // 가격 정보 표시 (고객용 최종 게시 내용 - 정책 적용된 판매가격)
    let priceAdded = false

    // priceInfo에서 옵션 정보 추출
    let priceOptions = []
    if (product.priceInfo) {
      try {
        const priceData = JSON.parse(product.priceInfo)
        if (priceData.processedPriceOptions) {
          priceOptions = priceData.processedPriceOptions
        } else if (priceData.priceOptions) {
          priceOptions = priceData.priceOptions
        }
      } catch (e) {
        // JSON 파싱 실패시 무시
      }
    }

    // 가격 옵션이 2개 이상인 경우: 옵션 가격만 표시 (개별 판매가격 없음)
    if (priceOptions.length >= 2) {
      finalContent.push('')
      finalContent.push('📋 가격 옵션:')
      priceOptions.forEach((option: any, index: number) => {
        // 각 옵션에 가격정책 적용 (밴드명 기준)
        const finalPrice = applyPricingPolicy(parsePrice(option.price || option.originalPrice || 0), product.shippingFee || 0, product.wholesaleBandName || '')
        const optionName = option.option || option.name || `옵션${index + 1}`
        const shippingInfo = getShippingInfo(product)
        finalContent.push(`${index + 1}. ${optionName}: ${finalPrice.toLocaleString()}원 ${shippingInfo}`)
      })
      priceAdded = true
    } else {
      // 옵션이 1개 이하인 경우: 정책 적용된 쇼핑몰 판매가 사용
      const basePrice = product.originalPrice
      if (basePrice) {
        const finalPrice = applyPricingPolicy(parsePrice(basePrice), product.shippingFee || 0, product.wholesaleBandName || '')
        finalContent.push('')
        finalContent.push('💰 판매가격:')
        const shippingInfo = getShippingInfo(product)
        finalContent.push(`${finalPrice.toLocaleString()}원 ${shippingInfo}`)
        priceAdded = true
      }

      // 단일 옵션이 있는 경우에만 옵션으로 표시
      if (priceOptions.length === 1) {
        const option = priceOptions[0]
        // 옵션 가격에도 정책 적용 (밴드명 기준)
        const finalPrice = applyPricingPolicy(parsePrice(option.price || option.originalPrice || 0), product.shippingFee || 0, product.wholesaleBandName || '')
        finalContent.push('')
        const shippingInfo = getShippingInfo(product)
        finalContent.push(`📋 ${option.option || option.name}: ${finalPrice.toLocaleString()}원 ${shippingInfo}`)
        priceAdded = true
      }

      // 판매가가 없으면 기본 가격 표시 (정책 적용)
      if (!priceAdded) {
        const basePrice = product.originalPrice
        if (basePrice) {
          const finalPrice = applyPricingPolicy(parsePrice(basePrice), product.shippingFee || 0, product.wholesaleBandName || '')
          finalContent.push('')
          finalContent.push('💰 판매가격:')
          const shippingInfo = getShippingInfo(product)
          finalContent.push(`${finalPrice.toLocaleString()}원 ${shippingInfo}`)
        }
      }
    }

    // 배송 정보 추가 (별도 섹션으로)
    if (product.shippingFee !== null && product.shippingFee !== undefined) {
      finalContent.push('')
      if (product.shippingFee === 0) {
        finalContent.push('🚚 배송비: 무료배송')
      } else {
        finalContent.push(`🚚 배송비: ${product.shippingFee.toLocaleString()}원`)
      }
    }

    // 마감 정보 추가
    if (product.hasDeadline && product.deadlineInfo) {
      finalContent.push('')
      finalContent.push('⏰ 주문 마감:')
      finalContent.push(product.deadlineInfo)
    }

    return finalContent.join('\n')
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
    setNewImageUrl('') // 이미지 URL 입력 필드 초기화
  }

  const handleSaveEdit = async () => {
    if (!editedProduct) return

    try {
      setIsSaving(true)
      const response = await fetch(`/api/products/${editedProduct.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editedProduct.title,
          description: editedProduct.description,
          hookingTitle: editedProduct.hookingTitle,
          hookingContent: editedProduct.hookingContent,
          detailedContent: editedProduct.detailedContent,
          originalPrice: editedProduct.originalPrice,
          salePrice: editedProduct.salePrice,
          shippingFee: editedProduct.shippingFee,
          priceInfo: editedProduct.priceInfo,
          specialNotes: editedProduct.specialNotes,
          productCategory: editedProduct.productCategory,
          status: editedProduct.status,
          images: editedProduct.images,
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
        alert('상품 업데이트에 실패했습니다: ' + data.error)
      }
    } catch (error) {
      console.error('상품 업데이트 오류:', error)
      alert('상품 업데이트 중 오류가 발생했습니다.')
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
        [field]: field === 'salePrice' || field === 'originalPrice' ? (parseFloat(value) || 0) : value
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

    if (!confirm('이 옵션을 삭제하시겠습니까?')) {
      return
    }

    try {
      const priceData = JSON.parse(editedProduct.priceInfo)
      if (!priceData.processedPriceOptions) return

      const updatedOptions = [...priceData.processedPriceOptions]
      updatedOptions.splice(optionIndex, 1) // 해당 인덱스의 옵션 삭제

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
    }
  }

  // 이미지 추가 핸들러
  const handleAddImage = () => {
    if (!editedProduct || !newImageUrl.trim()) return

    try {
      const currentImages = safeParseImages(editedProduct.images)
      const updatedImages = [...currentImages, newImageUrl.trim()]

      setEditedProduct({
        ...editedProduct,
        images: JSON.stringify(updatedImages)
      })
      setNewImageUrl('') // 입력 필드 초기화
    } catch (error) {
      console.error('이미지 추가 오류:', error)
    }
  }

  // 이미지 삭제 핸들러
  const handleDeleteImage = (imageIndex: number) => {
    if (!editedProduct) return

    if (!confirm('이 이미지를 삭제하시겠습니까?')) {
      return
    }

    try {
      const currentImages = safeParseImages(editedProduct.images)
      const updatedImages = currentImages.filter((_, index) => index !== imageIndex)

      setEditedProduct({
        ...editedProduct,
        images: JSON.stringify(updatedImages)
      })
    } catch (error) {
      console.error('이미지 삭제 오류:', error)
    }
  }

  // 이미지 순서 변경 핸들러
  const handleMoveImage = (fromIndex: number, toIndex: number) => {
    if (!editedProduct) return

    try {
      const currentImages = safeParseImages(editedProduct.images)
      if (fromIndex < 0 || fromIndex >= currentImages.length || toIndex < 0 || toIndex >= currentImages.length) {
        return
      }

      const updatedImages = [...currentImages]
      const movedImage = updatedImages.splice(fromIndex, 1)[0]
      updatedImages.splice(toIndex, 0, movedImage)

      setEditedProduct({
        ...editedProduct,
        images: JSON.stringify(updatedImages)
      })
    } catch (error) {
      console.error('이미지 순서 변경 오류:', error)
    }
  }

  // 쇼핑몰 등록 핸들러 (개별)
  const handleShopExport = async () => {
    try {
      const response = await fetch('/api/products/generate-excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        // 파일 다운로드 처리
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url

        // 파일명 추출 (Content-Disposition 헤더에서)
        const contentDisposition = response.headers.get('Content-Disposition')
        let fileName = `shopping_mall_products_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`

        if (contentDisposition) {
          const fileNameMatch = contentDisposition.match(/filename="(.+)"/)
          if (fileNameMatch) {
            fileName = fileNameMatch[1]
          }
        }

        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)

        console.log('쇼핑몰 등록 완료')
      } else {
        const errorData = await response.json()
        console.error('엑셀 생성 실패:', errorData.error)
        alert('엑셀 파일 생성에 실패했습니다: ' + errorData.error)
      }
    } catch (error) {
      console.error('엑셀 다운로드 오류:', error)
      alert('엑셀 파일 다운로드 중 오류가 발생했습니다.')
    }
  }

  // 선택된 상품 일괄 삭제
  const handleSelectedDelete = async () => {
    if (selectedProducts.length === 0) {
      alert('삭제할 상품을 선택해주세요.')
      return
    }

    const selectedProductTitles = products
      .filter(p => selectedProducts.includes(p.id))
      .map(p => p.hookingTitle || p.title)

    if (!confirm(`정말로 선택된 ${selectedProducts.length}개 상품을 삭제하시겠습니까?\n\n${selectedProductTitles.slice(0, 3).join(', ')}${selectedProductTitles.length > 3 ? '...' : ''}`)) {
      return
    }

    try {
      // 병렬로 모든 선택된 상품 삭제 요청
      const deletePromises = selectedProducts.map(productId =>
        fetch(`/api/products/${productId}`, {
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
        alert(`${failedDeletes.length}개 상품 삭제에 실패했습니다.`)
      } else {
        alert(`${successfulDeletes.length}개 상품이 성공적으로 삭제되었습니다.`)
      }

    } catch (error) {
      console.error('일괄 삭제 오류:', error)
      alert('상품 삭제 중 오류가 발생했습니다.')
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
        alert('소싱 확정에 실패했습니다: ' + data.error)
      }
    } catch (error) {
      console.error('소싱 확정 오류:', error)
      alert('소싱 확정 중 오류가 발생했습니다.')
    } finally {
      setIsIndividualProcessing(false)
    }
  }

  const handleDeleteProduct = async (productId: string, productTitle: string) => {
    if (!confirm(`정말로 "${productTitle}" 상품을 삭제하시겠습니까?`)) {
      return
    }

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        // 로컬 상태에서 상품 제거
        setProducts(products.filter(p => p.id !== productId))
        console.log('상품 삭제 성공')

        // 모달이 열려있고 삭제된 상품이면 모달 닫기
        if (selectedProduct?.id === productId) {
          setShowDetailModal(false)
          setSelectedProduct(null)
          setEditedProduct(null)
          setIsEditing(false)
        }
      } else {
        console.error('상품 삭제 실패:', data.error)
        alert('상품 삭제에 실패했습니다: ' + data.error)
      }
    } catch (error) {
      console.error('상품 삭제 오류:', error)
      alert('상품 삭제 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">소싱확정</h1>
              <p className="text-gray-600">수집된 게시물에서 생성된 상품들을 관리합니다.</p>
            </div>
            <div className="flex gap-3">
              <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2">
                <Plus className="h-4 w-4" />
                상품 직접 추가
              </button>
              <button
                onClick={handleShopRegistration}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2"
                disabled={selectedProducts.length === 0}
              >
                <Download className="h-4 w-4" />
                쇼핑몰 등록 ({selectedProducts.length})
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
                <Tag className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">소싱완료</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {products.filter(p => p.status === 'ACTIVE').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Edit3 className="h-8 w-8 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">초안</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {products.filter(p => p.status === 'DRAFT').length}
                </p>
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
                  {products.reduce((acc, p) => acc + (getSellingPrice(p) || p.salePrice), 0).toLocaleString()}원
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
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">전체 상태</option>
                  <option value="draft">초안</option>
                  <option value="active">소싱완료</option>
                  <option value="sold_out">품절</option>
                </select>

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
                <select
                  value={itemsPerPage}
                  onChange={(e) => handleItemsPerPageChange(parseInt(e.target.value))}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={10}>10개씩 보기</option>
                  <option value={50}>50개씩 보기</option>
                  <option value={100}>100개씩 보기</option>
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
                <button
                  onClick={handleShopRegistration}
                  disabled={selectedProducts.length === 0}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="h-4 w-4" />
                  쇼핑몰 등록 ({selectedProducts.length})
                </button>
                <button
                  onClick={handleAllProductsRegistration}
                  disabled={products.length === 0}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Package className="h-4 w-4" />
                  전체 등록 ({products.length})
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
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">번호</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">상품명</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">분류</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">소싱처</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">상태</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">생성일</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      <Package className="h-6 w-6 mx-auto mb-2 animate-pulse" />
                      상품을 불러오는 중...
                    </td>
                  </tr>
                ) : paginatedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-lg font-medium text-gray-900 mb-2">소싱확정된 상품이 없습니다</p>
                      <p className="text-gray-500">도매 밴드에서 게시물을 수집하여 상품을 생성해보세요.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((product, index) => (
                    <tr key={product.id} className={`hover:bg-gray-50 ${product.isRegisteredToShop ? 'bg-green-50 opacity-75' : ''}`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          className={`rounded border-gray-300 ${product.isRegisteredToShop ? 'opacity-50 cursor-not-allowed' : ''}`}
                          checked={selectedProducts.includes(product.id)}
                          disabled={product.isRegisteredToShop}
                          onChange={(e) => handleProductSelect(product.id, e.target.checked)}
                          title={product.isRegisteredToShop ? '이미 쇼핑몰에 등록된 상품입니다' : ''}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {startIndex + index + 1}
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
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(product.productCategory || null)}`}>
                          {getCategoryLabel(product.productCategory || null)}
                        </span>
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
                        <div className="space-y-1">
                          {getStatusBadge(product.status)}
                          {product.isRegisteredToShop && (
                            <div>
                              <span className="inline-flex px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                                ✓ 쇼핑몰등록
                              </span>
                            </div>
                          )}
                          {!product.isAvailable && (
                            <div>
                              <span className="inline-flex px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                                이용불가
                              </span>
                            </div>
                          )}
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
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleShowDetail(product)}
                            className="text-blue-500 hover:text-blue-700 p-1 rounded"
                            title="상세보기"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleShowDetail(product)}
                            className="text-green-500 hover:text-green-700 p-1 rounded"
                            title="편집하기"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product.id, product.title)}
                            className="text-red-500 hover:text-red-700 p-1 rounded"
                            title="삭제하기"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
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
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      selectedProduct.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700'
                        : selectedProduct.status === 'DRAFT'
                        ? 'bg-gray-100 text-gray-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {selectedProduct.status === 'ACTIVE' ? '소싱완료' : selectedProduct.status === 'DRAFT' ? '초안' : '품절'}
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
                        <h4 className="text-sm font-medium text-gray-700 mb-1">공급가</h4>
                        {isEditing ? (
                          <input
                            type="number"
                            value={editedProduct?.originalPrice || 0}
                            onChange={(e) => handleEditChange('originalPrice', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-orange-600 font-semibold focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          />
                        ) : (
                          <p className="text-orange-600 font-semibold">
                            {formatPrice(selectedProduct.originalPrice)}
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
                                {formatPrice(selectedProduct.shippingFee)}
                              </p>
                            )
                          )}
                        </div>
                      )}

                      {/* 상태 및 분류 편집 */}
                      {isEditing && (
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-blue-200">
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-1">상태</h4>
                            <select
                              value={editedProduct?.status || 'DRAFT'}
                              onChange={(e) => handleEditChange('status', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="DRAFT">초안</option>
                              <option value="ACTIVE">소싱완료</option>
                              <option value="SOLD_OUT">품절</option>
                            </select>
                          </div>

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
                      AI 개선 및 추출 내용
                    </h3>

                    <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                      {/* 업로드용 제목 섹션 */}
                      <div className="mb-4 p-3 bg-white rounded border border-green-200">
                        <h4 className="text-sm font-semibold text-green-800 mb-2">📝 업로드용 제목</h4>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editedProduct?.hookingTitle || ''}
                            onChange={(e) => handleEditChange('hookingTitle', e.target.value)}
                            placeholder="매력적인 제목을 입력하세요"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 font-medium focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          />
                        ) : (
                          <p className="text-gray-900 font-semibold text-base bg-yellow-50 p-2 rounded">
                            {selectedProduct.hookingTitle || '미생성'}
                          </p>
                        )}
                      </div>

                      {/* 핵심 포인트 내용 */}
                      <div className="mb-4 p-3 bg-white rounded border border-green-200">
                        <h4 className="text-sm font-semibold text-green-800 mb-2">🎯 핵심 포인트 (100자)</h4>
                        {isEditing ? (
                          <textarea
                            value={editedProduct?.hookingContent || ''}
                            onChange={(e) => handleEditChange('hookingContent', e.target.value)}
                            rows={4}
                            placeholder="매력적인 판매 문구를 입력하세요"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          />
                        ) : (
                          <div className="text-gray-900 text-sm leading-relaxed">
                            {selectedProduct.hookingContent || '미생성'}
                          </div>
                        )}
                      </div>

                      {/* 하단 정보 섹션 */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-green-800">📊 추출된 정보</h4>

                        {/* 공급가 */}
                        <div className="bg-white p-3 rounded border">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">공급가 (원가)</span>
                            <span className="text-lg font-bold text-orange-600">
                              {formatPrice(selectedProduct.originalPrice)}원
                            </span>
                          </div>
                        </div>

                        {/* 판매가 */}
                        <div className="bg-white p-3 rounded border">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">판매가 (정책 적용)</span>
                            <span className="text-lg font-bold text-green-600">
                              {formatPrice(getSellingPrice(selectedProduct) || selectedProduct.salePrice)}원
                            </span>
                          </div>
                        </div>

                        {/* 배송비 */}
                        {(selectedProduct.shippingFee !== null && selectedProduct.shippingFee !== undefined) && (
                          <div className="bg-white p-3 rounded border">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">배송비</span>
                              <span className="text-base font-semibold text-blue-600">
                                {selectedProduct.shippingFee === 0 ? '무료배송' : formatPrice(selectedProduct.shippingFee) + '원'}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* 상품 분류 */}
                        {selectedProduct.productCategory && (
                          <div className="bg-white p-3 rounded border">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">상품 분류</span>
                              <span className={`px-2 py-1 rounded text-sm font-medium ${getCategoryColor(selectedProduct.productCategory)}`}>
                                {getCategoryLabel(selectedProduct.productCategory)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 특이사항 */}
                      {(selectedProduct.hasDeadline || !selectedProduct.isAvailable) && (
                        <div className="space-y-2 mt-4">
                          <h5 className="text-sm font-semibold text-gray-700">⚠️ 특이사항</h5>
                          {selectedProduct.hasDeadline && (
                            <div className="bg-orange-100 text-orange-700 px-3 py-2 rounded text-sm">
                              ⏰ {selectedProduct.deadlineInfo || '마감시간 있음'}
                            </div>
                          )}
                          {!selectedProduct.isAvailable && (
                            <div className="bg-red-100 text-red-700 px-3 py-2 rounded text-sm">
                              ❌ {selectedProduct.unavailableReason || '이용 불가'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 쇼핑몰/소매밴드 최종 게시 내용 */}
                <div className="mt-8">
                  <div className="border-t-2 border-green-300 pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                      📱 쇼핑몰/소매밴드 최종 게시 내용
                      <span className="text-xs bg-green-200 text-green-700 px-2 py-1 rounded-full">
                        실제 업로드 내용
                      </span>
                      {selectedProduct.wholesaleBandName && (
                        <span className="text-xs text-gray-600">
                          ({selectedProduct.wholesaleBandName})
                        </span>
                      )}
                    </h3>

                    <div className="bg-white border-2 border-green-300 rounded-lg p-6 space-y-6">
                      {/* 최종 제목 */}
                      <div>
                        <div className="text-sm font-medium text-green-600 mb-2">📌 게시 제목</div>
                        <div className="text-xl font-bold text-gray-900 bg-gray-50 p-4 rounded border flex items-center gap-2">
                          <span className={`w-4 h-4 ${getWholesaleBandColor(selectedProduct.wholesaleBandName)} rounded-sm flex-shrink-0`}></span>
                          {selectedProduct.hookingTitle || selectedProduct.title}
                        </div>
                      </div>

                      {/* 최종 내용 */}
                      <div>
                        <div className="text-sm font-medium text-green-600 mb-2">📝 게시 내용</div>
                        <div className="bg-gray-50 p-4 rounded border">
                          <div className="whitespace-pre-wrap text-gray-900 text-base leading-relaxed">
                            {generateFinalPostingContent(selectedProduct)}
                          </div>
                        </div>
                      </div>

                      {/* 미리보기 정보 */}
                      <div className="text-sm text-green-600 bg-green-50 p-3 rounded">
                        💡 이 내용이 쇼핑몰과 소매밴드에 실제로 게시됩니다.
                      </div>
                    </div>
                  </div>
                </div>

                {/* 추출된 옵션 정보 */}
                {(isEditing ? editedProduct?.priceInfo : selectedProduct.priceInfo) && (() => {
                  try {
                    const priceData = JSON.parse(isEditing ? editedProduct?.priceInfo || '{}' : selectedProduct.priceInfo || '{}')
                    if (priceData.processedPriceOptions && priceData.processedPriceOptions.length > 0) {
                      return (
                        <div className="mt-6">
                          <h4 className="text-lg font-semibold text-gray-900 mb-3">💰 추출된 옵션 관리</h4>
                          <div className="bg-blue-50 p-4 rounded-lg space-y-2">
                            {priceData.processedPriceOptions.map((option: any, index: number) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-white rounded-md border border-blue-200">
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
                                        {selectedProduct.wholesaleBandName && option.originalPrice && (
                                          <div className="text-xs text-blue-600 mt-1">
                                            정책가: {formatPrice(applyPricingPolicy(
                                              parsePrice(option.originalPrice || 0),
                                              selectedProduct.shippingFee || 0,
                                              selectedProduct.wholesaleBandName
                                            ))}원
                                          </div>
                                        )}
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
                                        {formatPrice(
                                          selectedProduct.wholesaleBandName
                                            ? applyPricingPolicy(
                                                parsePrice(option.originalPrice || option.price || 0),
                                                selectedProduct.shippingFee || 0,
                                                selectedProduct.wholesaleBandName
                                              )
                                            : (option.salePrice || option.originalPrice || 0)
                                        )}원
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
                  <div className="mt-6">
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
                {/* Images */}
                {(safeParseImages(isEditing ? editedProduct?.images : selectedProduct.images).length > 0 || isEditing) && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
                      상품 이미지
                      {isEditing && (
                        <span className="text-sm text-gray-500">
                          {safeParseImages(editedProduct?.images).length}개 이미지
                        </span>
                      )}
                    </h3>

                    {/* 이미지 추가 (편집 모드에서만) */}
                    {isEditing && (
                      <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h4 className="text-sm font-medium text-blue-700 mb-2">🖼️ 이미지 추가</h4>
                        <div className="flex gap-2">
                          <input
                            type="url"
                            placeholder="이미지 URL을 입력하세요"
                            value={newImageUrl}
                            onChange={(e) => setNewImageUrl(e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <button
                            onClick={handleAddImage}
                            disabled={!newImageUrl.trim()}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-md text-sm font-medium transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {safeParseImages(isEditing ? editedProduct?.images : selectedProduct.images).map((imageUrl: string, index: number) => (
                        <div key={index} className="aspect-square relative group">
                          <img
                            src={imageUrl}
                            alt={`상품 이미지 ${index + 1}`}
                            className="w-full h-full object-cover rounded-lg border border-gray-200"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0zNSA2NUw1MCA0NUw2NSA2NUgzNVoiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+'
                            }}
                          />

                          {/* 편집 모드에서만 컨트롤 버튼 표시 */}
                          {isEditing && (
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 rounded-lg flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-2">
                                {/* 순서 변경 버튼 */}
                                {index > 0 && (
                                  <button
                                    onClick={() => handleMoveImage(index, index - 1)}
                                    className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg transition-colors"
                                    title="앞으로 이동"
                                  >
                                    <ChevronLeft className="h-4 w-4" />
                                  </button>
                                )}
                                {index < safeParseImages(editedProduct?.images).length - 1 && (
                                  <button
                                    onClick={() => handleMoveImage(index, index + 1)}
                                    className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg transition-colors"
                                    title="뒤로 이동"
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </button>
                                )}
                                {/* 삭제 버튼 */}
                                <button
                                  onClick={() => handleDeleteImage(index)}
                                  className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors"
                                  title="이미지 삭제"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          )}

                          {/* 이미지 순서 표시 */}
                          <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                            {index + 1}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 편집 가이드 */}
                    {isEditing && (
                      <div className="mt-4 text-sm text-gray-600 bg-yellow-50 p-3 rounded border">
                        💡 이미지 위에 마우스를 올리면 편집 버튼이 나타납니다. 순서 변경과 삭제가 가능합니다.
                      </div>
                    )}
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
                      {selectedProduct.status !== 'ACTIVE' && (
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
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}