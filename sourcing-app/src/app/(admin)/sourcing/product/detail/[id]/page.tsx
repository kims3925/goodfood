'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Edit, Save, X, Package, FileText, Trash2, AlertCircle, ChevronLeft, ChevronRight, Store, Calendar, ExternalLink, ImageIcon, Tag, Layers, History, Plus, Minus, Upload, Info, Truck, Send, ToggleLeft, ToggleRight } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import Link from 'next/link'
import ImageSortable, { SortableImage } from '@/components/product/ImageSortable'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/Toast'

interface ProductImage {
  id: number
  url: string
  sortOrder: number
}

interface Product {
  id: number
  channelId: number | null
  name: string
  description: string | null
  thumbnailUrl: string | null
  categoryId: string | null
  wholesalePrice: number | null
  price: number | null
  currency: string
  isActive: boolean // 쇼핑몰 노출 여부
  shippingFee: number | null
  shippingInfo: string | null
  bundleMaxQty: number | null
  bundleUnit: string | null
  bundleShippingType: 'NONE' | 'INCLUDED' | 'SEPARATE'
  createdAt: string
  updatedAt: string
  images: ProductImage[]
  channel?: {
    id: number
    name: string
    coverUrl: string | null
    platform?: string
  } | null
  options: Array<{
    id: number
    groupName: string
    value: string
    sortOrder: number
  }>
  variants: Array<{
    id: number
    optionSummary: string | null
    price: number
    wholesalePrice: number | null
  }>
  shopProducts?: ShopProductItem[]
  channelProducts?: ChannelProductItem[]
}

interface ShopProductItem {
  id: number
  shopId: number
  publishedAt: string | null
  createdAt: string
  shop: {
    id: number
    name: string
    subdomain: string
  }
}

interface ChannelProductItem {
  id: number
  channelId: number
  publishedAt: string | null
  createdAt: string
  channel: {
    id: number
    name: string
    channelKey: string
    coverUrl: string | null
    kind: string
  }
}

export default function ProductDetailPage() {
  const router = useRouter()
  const params = useParams()
  const toast = useToast()
  const productId = parseInt(params.id as string)

  const [product, setProduct] = useState<Product | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  // 편집 모드 상태 (카드별 분리)
  const [isEditingInfo, setIsEditingInfo] = useState(false)
  const [isEditingImages, setIsEditingImages] = useState(false)
  const [isSavingInfo, setIsSavingInfo] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categoryId: '',
  })

  // 이미지 관련 상태
  const [images, setImages] = useState<SortableImage[]>([])
  const [imageOrderChanged, setImageOrderChanged] = useState(false)
  const [deletingImageId, setDeletingImageId] = useState<number | null>(null)

  // 삭제 확인 모달 상태
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Product 활성화 상태 토글
  const [isTogglingActive, setIsTogglingActive] = useState(false)


  // 옵션 편집 상태
  const [isEditingOptions, setIsEditingOptions] = useState(false)
  const [editingOptions, setEditingOptions] = useState<Array<{ groupName: string; values: string[] }>>([])
  const [isSavingOptions, setIsSavingOptions] = useState(false)

  // 변형상품 편집 상태
  const [isEditingVariants, setIsEditingVariants] = useState(false)
  const [editingVariants, setEditingVariants] = useState<Array<{ id?: number; selectedOptions: Record<string, string>; price: number; wholesalePrice: number | null }>>([])
  const [isSavingVariants, setIsSavingVariants] = useState(false)

  // 이미지 업로드 상태
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 배송비 편집 상태
  const [isEditingShipping, setIsEditingShipping] = useState(false)
  const [isSavingShipping, setIsSavingShipping] = useState(false)
  const [shippingFormData, setShippingFormData] = useState({
    shippingFee: 0,
    shippingInfo: '',
    bundleMaxQty: 1,
    bundleUnit: '개',
    bundleShippingType: 'NONE' as 'NONE' | 'INCLUDED' | 'SEPARATE',
  })
  const [originalShippingData, setOriginalShippingData] = useState({
    shippingFee: 0,
    shippingInfo: '',
    bundleMaxQty: 1,
    bundleUnit: '개',
    bundleShippingType: 'NONE' as 'NONE' | 'INCLUDED' | 'SEPARATE',
  })

  const loadProduct = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/product/${productId}`)
      const data = await response.json()

      if (data.success) {
        setProduct(data.data)
        setFormData({
          name: data.data.name || '',
          description: data.data.description || '',
          categoryId: data.data.categoryId || '',
        })
        // 배송비 데이터 초기화
        const shippingData = {
          shippingFee: data.data.shippingFee || 0,
          shippingInfo: data.data.shippingInfo || '',
          bundleMaxQty: data.data.bundleMaxQty || 1,
          bundleUnit: data.data.bundleUnit || '개',
          bundleShippingType: (data.data.bundleShippingType || 'NONE') as 'NONE' | 'INCLUDED' | 'SEPARATE',
        }
        setShippingFormData(shippingData)
        setOriginalShippingData(shippingData)

        if (data.data.images) {
          setImages(data.data.images.map((img: any) => ({
            id: img.id,
            url: img.url,
            sortOrder: img.sortOrder,
          })))
        }
        setImageOrderChanged(false)
      } else {
        setError(data.error || '상품을 불러오는데 실패했습니다.')
      }
    } catch (err) {
      console.error('상품 로드 실패:', err)
      setError('상품을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [productId])

  useEffect(() => {
    if (productId) {
      loadProduct()
    }
  }, [productId, loadProduct])

  const handleSaveInfo = async () => {
    if (!product || !formData.name.trim()) return

    setIsSavingInfo(true)
    try {
      const response = await fetch('/api/product', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: product.id,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          categoryId: formData.categoryId.trim() || null,
        }),
      })

      const data = await response.json()
      if (data.success) {
        toast.success('상품 정보가 저장되었습니다.')
        loadProduct()
        setIsEditingInfo(false)
      } else {
        toast.error('상품 저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('상품 저장 실패:', error)
      toast.error('상품 저장에 실패했습니다.')
    } finally {
      setIsSavingInfo(false)
    }
  }

  // 배송비 저장
  const handleSaveShipping = async () => {
    if (!product) return

    setIsSavingShipping(true)
    try {
      const response = await fetch('/api/product', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: product.id,
          shippingFee: shippingFormData.shippingFee,
          shippingInfo: shippingFormData.shippingInfo.trim() || null,
          bundleMaxQty: shippingFormData.bundleMaxQty,
          bundleUnit: shippingFormData.bundleUnit.trim() || '개',
        }),
      })

      const data = await response.json()
      if (data.success) {
        toast.success('배송 정보가 저장되었습니다.')
        // 저장 후 원래 데이터 업데이트
        setOriginalShippingData({ ...shippingFormData })
        loadProduct()
        setIsEditingShipping(false)
      } else {
        toast.error('배송 정보 저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('배송 정보 저장 실패:', error)
      toast.error('배송 정보 저장에 실패했습니다.')
    } finally {
      setIsSavingShipping(false)
    }
  }

  // 배송비 원래 값으로 되돌리기
  const handleResetShipping = () => {
    setShippingFormData({ ...originalShippingData })
  }

  // 옵션 편집 시작
  const handleStartEditOptions = () => {
    const grouped = (product?.options || []).reduce((acc, option) => {
      const existing = acc.find(g => g.groupName === option.groupName)
      if (existing) {
        existing.values.push(option.value)
      } else {
        acc.push({ groupName: option.groupName, values: [option.value] })
      }
      return acc
    }, [] as Array<{ groupName: string; values: string[] }>)
    setEditingOptions(grouped.length > 0 ? grouped : [{ groupName: '', values: [''] }])
    setIsEditingOptions(true)
  }

  // 옵션 저장
  const handleSaveOptions = async () => {
    if (!product) return

    setIsSavingOptions(true)
    try {
      // 옵션을 flat 구조로 변환
      const options = editingOptions
        .filter(g => g.groupName.trim())
        .flatMap((group, gIdx) =>
          group.values
            .filter(v => v.trim())
            .map((value, vIdx) => ({
              groupName: group.groupName.trim(),
              value: value.trim(),
              sortOrder: gIdx * 100 + vIdx,
            }))
        )

      const response = await fetch('/api/product', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: product.id,
          options,
        }),
      })

      const data = await response.json()
      if (data.success) {
        toast.success('옵션이 저장되었습니다.')
        loadProduct()
        setIsEditingOptions(false)
      } else {
        toast.error('옵션 저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('옵션 저장 실패:', error)
      toast.error('옵션 저장에 실패했습니다.')
    } finally {
      setIsSavingOptions(false)
    }
  }

  // 옵션 요약 문자열 파싱 (예: "빨강/L" → { 색상: "빨강", 사이즈: "L" })
  const parseOptionSummary = (summary: string | null): Record<string, string> => {
    if (!summary) return {}
    const values = summary.split('/')
    const result: Record<string, string> = {}
    const optionGroups = Object.keys(groupedOptions)
    values.forEach((value, idx) => {
      if (optionGroups[idx]) {
        result[optionGroups[idx]] = value.trim()
      }
    })
    return result
  }

  // selectedOptions를 옵션 요약 문자열로 변환
  const buildOptionSummary = (selectedOptions: Record<string, string>): string => {
    const optionGroups = Object.keys(groupedOptions)
    return optionGroups
      .map(group => selectedOptions[group] || '')
      .filter(v => v)
      .join('/')
  }

  // 변형상품 편집 시작
  const handleStartEditVariants = () => {
    const variants = (product?.variants || []).map(v => ({
      id: v.id,
      selectedOptions: parseOptionSummary(v.optionSummary),
      price: v.price,
      wholesalePrice: v.wholesalePrice,
    }))
    setEditingVariants(variants.length > 0 ? variants : [{ selectedOptions: {}, price: 0, wholesalePrice: null }])
    setIsEditingVariants(true)
  }

  // 모든 옵션 조합 자동 생성
  const handleGenerateAllVariants = () => {
    const optionGroups = Object.entries(groupedOptions)
    if (optionGroups.length === 0) {
      toast.error('먼저 옵션을 추가해주세요.')
      return
    }

    // 모든 조합 생성
    const generateCombinations = (groups: [string, string[]][], current: Record<string, string> = {}): Record<string, string>[] => {
      if (groups.length === 0) return [current]
      const [groupName, values] = groups[0]
      const remaining = groups.slice(1)
      return values.flatMap(value =>
        generateCombinations(remaining, { ...current, [groupName]: value })
      )
    }

    const combinations = generateCombinations(optionGroups)
    const newVariants = combinations.map(selectedOptions => ({
      selectedOptions,
      price: 0,
      wholesalePrice: null,
    }))

    setEditingVariants(newVariants)
    toast.success(`${newVariants.length}개의 변형상품이 생성되었습니다.`)
  }

  // 변형상품 저장
  const handleSaveVariants = async () => {
    if (!product) return

    setIsSavingVariants(true)
    try {
      const variants = editingVariants
        .filter(v => Object.keys(v.selectedOptions).length > 0 || v.price > 0)
        .map(v => ({
          id: v.id,
          optionSummary: buildOptionSummary(v.selectedOptions) || null,
          price: v.price,
          wholesalePrice: v.wholesalePrice,
        }))

      const response = await fetch('/api/product', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: product.id,
          variants,
        }),
      })

      const data = await response.json()
      if (data.success) {
        toast.success('변형상품이 저장되었습니다.')
        loadProduct()
        setIsEditingVariants(false)
      } else {
        toast.error('변형상품 저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('변형상품 저장 실패:', error)
      toast.error('변형상품 저장에 실패했습니다.')
    } finally {
      setIsSavingVariants(false)
    }
  }

  // Product 활성화 상태 토글 핸들러
  const handleToggleProductActive = async () => {
    if (!product) return
    setIsTogglingActive(true)
    try {
      const response = await fetch(`/api/product/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive: !product.isActive,
        }),
      })

      const data = await response.json()
      if (data.success) {
        toast.success(data.message)
        loadProduct() // 상품 정보 새로고침
      } else {
        toast.error(data.error || '상태 변경에 실패했습니다.')
      }
    } catch (error) {
      console.error('Product 상태 변경 실패:', error)
      toast.error('상태 변경에 실패했습니다.')
    } finally {
      setIsTogglingActive(false)
    }
  }

  const handleDelete = () => {
    if (!product) return
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    if (!product) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/product?id=${product.id}`, { method: 'DELETE' })
      const data = await response.json()
      if (data.success) {
        toast.success('상품이 삭제되었습니다.')
        router.push('/product/list')
      } else {
        toast.error('상품 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('상품 삭제 실패:', error)
      toast.error('상품 삭제에 실패했습니다.')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleImageReorder = (newOrder: SortableImage[]) => {
    setImages(newOrder)
    setImageOrderChanged(true)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!product || !e.target.files || e.target.files.length === 0) return

    const files = Array.from(e.target.files)
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('productId', product.id.toString())
      files.forEach((file) => {
        formData.append('files', file)
      })

      const response = await fetch('/api/images/product', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      if (data.success) {
        toast.success(`${files.length}개의 이미지가 업로드되었습니다.`)
        loadProduct()
      } else {
        toast.error(data.error || '이미지 업로드에 실패했습니다.')
      }
    } catch (error) {
      console.error('이미지 업로드 실패:', error)
      toast.error('이미지 업로드에 실패했습니다.')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSaveImageOrder = async () => {
    if (!product || images.length === 0) return

    try {
      const response = await fetch('/api/images/product/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          imageIds: images.map((img) => img.id),
        }),
      })

      const data = await response.json()
      if (data.success) {
        loadProduct()
        toast.success('이미지 순서가 변경되었습니다.')
      } else {
        toast.error('이미지 순서 변경에 실패했습니다.')
      }
    } catch (error) {
      console.error('이미지 순서 저장 실패:', error)
    }
  }

  const handleDeleteImage = async (imageId: number) => {
    if (!product) return

    setDeletingImageId(imageId)
    try {
      const response = await fetch(`/api/images/product/${imageId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        loadProduct()
        toast.success('이미지가 삭제되었습니다.')
        if (selectedImageIndex >= images.length - 1) {
          setSelectedImageIndex(Math.max(0, images.length - 2))
        }
      } else {
        toast.error(data.error || '이미지 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('이미지 삭제 실패:', error)
      toast.error('이미지 삭제에 실패했습니다.')
    } finally {
      setDeletingImageId(null)
    }
  }

  const getChannelKindBadge = (kind: string) => {
    const kindMap: { [key: string]: { label: string; bgColor: string; textColor: string } } = {
      RETAIL: { label: '소매밴드', bgColor: 'bg-violet-50', textColor: 'text-violet-700' },
      WHOLESALE: { label: '도매밴드', bgColor: 'bg-amber-50', textColor: 'text-amber-700' },
    }
    const kindInfo = kindMap[kind] || { label: kind, bgColor: 'bg-slate-100', textColor: 'text-slate-700' }
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${kindInfo.bgColor} ${kindInfo.textColor}`}>
        {kindInfo.label}
      </span>
    )
  }

  const formatPrice = (price: number | null) => {
    if (!price) return '-'
    return `₩${price.toLocaleString()}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handlePrevImage = () => {
    setSelectedImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }

  const handleNextImage = () => {
    setSelectedImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }

  const groupedOptions = (product?.options || []).reduce((acc, option) => {
    if (!acc[option.groupName]) {
      acc[option.groupName] = []
    }
    acc[option.groupName].push(option.value)
    return acc
  }, {} as Record<string, string[]>)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-2xl flex items-center justify-center">
            <AlertCircle className="text-red-500" size={32} />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-slate-900">상품을 찾을 수 없습니다</h3>
          <p className="text-slate-500 mb-6">{error}</p>
          <Button variant="primary" onClick={() => router.push('/product/list')}>
            상품 목록으로 돌아가기
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* 상단 네비게이션 바 */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/product/list')}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft size={20} />
                <span className="font-medium">목록</span>
              </button>
              <div className="hidden sm:block h-6 w-px bg-slate-200"></div>
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-slate-400 text-sm">상품</span>
                <span className="text-slate-300">/</span>
                <span className="text-slate-700 text-sm font-medium truncate max-w-[200px]">
                  {product.name}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="danger"
                onClick={handleDelete}
                className="!px-4 !py-2"
              >
                <Trash2 size={16} />
                <span className="hidden sm:inline">삭제</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 안내 문구 */}
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
              <Info size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-900">
                상품 정보 수정 시 쇼핑몰에만 자동으로 반영됩니다.
              </p>
              <p className="text-sm text-amber-700 mt-1">
                밴드, 알리익스프레스 등 외부 플랫폼에 발행된 상품은 재발행이 필요합니다.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* 왼쪽: 이미지 갤러리 */}
          <div className="xl:col-span-5 2xl:col-span-4">
            <div className="xl:sticky xl:top-32">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  {isEditingImages ? (
                    <>
                      <div className="p-4 border-b border-slate-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-slate-100 rounded-lg">
                              <ImageIcon size={18} className="text-slate-600" />
                            </div>
                            <span className="font-semibold text-slate-900">이미지 관리</span>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setIsEditingImages(false)}
                          >
                            <X size={14} className="mr-1" />
                            닫기
                          </Button>
                        </div>
                        <p className="text-sm text-slate-500 mt-2">드래그하여 순서를 변경하거나, 호버하여 삭제할 수 있습니다.</p>
                      </div>
                      <div className="p-4">
                        {/* 이미지 업로드 영역 */}
                        <div className="mb-4">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleImageUpload}
                            className="hidden"
                            id="image-upload"
                          />
                          <label
                            htmlFor="image-upload"
                            className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                              isUploading
                                ? 'border-blue-300 bg-blue-50'
                                : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50'
                            }`}
                          >
                            {isUploading ? (
                              <div className="flex flex-col items-center gap-2">
                                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                <span className="text-sm text-blue-600 font-medium">업로드 중...</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-2">
                                <Upload size={24} className="text-slate-400" />
                                <span className="text-sm text-slate-600 font-medium">클릭하여 이미지 업로드</span>
                                <span className="text-xs text-slate-400">여러 이미지를 한 번에 선택할 수 있습니다</span>
                              </div>
                            )}
                          </label>
                        </div>

                        {images.length > 0 ? (
                          <>
                            <ImageSortable
                              images={images}
                              onReorder={handleImageReorder}
                              onDelete={handleDeleteImage}
                              deletingImageId={deletingImageId ?? undefined}
                            />
                            {imageOrderChanged && (
                              <div className="mt-4 flex justify-end">
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={handleSaveImageOrder}
                                >
                                  <Save size={14} className="mr-1" />
                                  이미지 순서 저장
                                </Button>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center justify-center h-24 bg-slate-50 rounded-xl border border-slate-200">
                            <p className="text-sm text-slate-400">업로드된 이미지가 없습니다</p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      {images.length > 0 ? (
                        <>
                          <div className="p-4 border-b border-slate-100">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="p-2 bg-slate-100 rounded-lg">
                                  <ImageIcon size={18} className="text-slate-600" />
                                </div>
                                <span className="font-semibold text-slate-900">상품 이미지</span>
                                <span className="text-sm text-slate-500">({images.length}개)</span>
                              </div>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setIsEditingImages(true)}
                              >
                                <Edit size={14} className="mr-1" />
                                수정
                              </Button>
                            </div>
                          </div>
                          <div className="relative aspect-square bg-slate-50">
                            <img
                              src={images[selectedImageIndex]?.url}
                              alt={`상품 이미지 ${selectedImageIndex + 1}`}
                              className="w-full h-full object-contain"
                            />
                            {images.length > 1 && (
                              <>
                                <button
                                  onClick={handlePrevImage}
                                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                                >
                                  <ChevronLeft size={20} />
                                </button>
                                <button
                                  onClick={handleNextImage}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                                >
                                  <ChevronRight size={20} />
                                </button>
                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/50 text-white text-sm rounded-full">
                                  {selectedImageIndex + 1} / {images.length}
                                </div>
                              </>
                            )}
                          </div>
                          {images.length > 1 && (
                            <div className="p-4 flex gap-2 overflow-x-auto">
                              {images.map((image, index) => (
                                <button
                                  key={image.id}
                                  onClick={() => setSelectedImageIndex(index)}
                                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                                    selectedImageIndex === index ? 'border-blue-500' : 'border-transparent hover:border-slate-300'
                                  }`}
                                >
                                  <img src={image.url} alt="" className="w-full h-full object-cover" />
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="p-6">
                          <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                            <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
                              <ImageIcon size={32} className="text-slate-400" />
                            </div>
                            <p className="text-slate-500 font-medium mb-4">이미지가 없습니다</p>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => setIsEditingImages(true)}
                            >
                              <Upload size={14} className="mr-1" />
                              이미지 업로드
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 오른쪽: 상품 정보 */}
            <div className="xl:col-span-7 2xl:col-span-8 space-y-6">
              {/* 쇼핑몰 노출 상태 카드 */}
              <div className={`rounded-2xl shadow-sm border overflow-hidden transition-colors ${
                product.isActive
                  ? 'bg-green-50 border-green-200'
                  : 'bg-amber-50 border-amber-200'
              }`}>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${product.isActive ? 'bg-green-100' : 'bg-amber-100'}`}>
                        {product.isActive ? (
                          <ToggleRight size={20} className="text-green-600" />
                        ) : (
                          <ToggleLeft size={20} className="text-amber-600" />
                        )}
                      </div>
                      <div>
                        <p className={`font-semibold ${product.isActive ? 'text-green-800' : 'text-amber-800'}`}>
                          {product.isActive ? '쇼핑몰 노출 중' : '쇼핑몰 숨김'}
                        </p>
                        <p className={`text-sm ${product.isActive ? 'text-green-600' : 'text-amber-600'}`}>
                          {product.isActive
                            ? '모든 쇼핑몰에서 이 상품이 노출됩니다'
                            : '모든 쇼핑몰에서 이 상품이 숨겨집니다'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleToggleProductActive}
                      disabled={isTogglingActive}
                      className={`px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
                        isTogglingActive
                          ? 'opacity-50 cursor-not-allowed'
                          : product.isActive
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {isTogglingActive ? (
                        <span className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          변경 중...
                        </span>
                      ) : product.isActive ? (
                        '숨기기'
                      ) : (
                        '노출하기'
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* 기본 정보 카드 */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Package size={18} className="text-blue-600" />
                      </div>
                      <span className="font-semibold text-slate-900">기본 정보</span>
                    </div>
                    {isEditingInfo ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setIsEditingInfo(false)
                            setFormData({
                              name: product?.name || '',
                              description: product?.description || '',
                              categoryId: product?.categoryId || '',
                            })
                          }}
                        >
                          <X size={14} className="mr-1" />
                          취소
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleSaveInfo}
                          disabled={isSavingInfo}
                        >
                          <Save size={14} className="mr-1" />
                          {isSavingInfo ? '저장중...' : '저장'}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsEditingInfo(true)}
                      >
                        <Edit size={14} className="mr-1" />
                        수정
                      </Button>
                    )}
                  </div>
                </div>

                <div className="p-6">
                  {isEditingInfo ? (
                    <div className="space-y-5">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">상품명</label>
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="!rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">설명</label>
                        <textarea
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          rows={6}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">상품명</label>
                        <h1 className="text-xl font-bold text-slate-900">{product.name}</h1>
                      </div>

                      {product.description && (
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">설명</label>
                          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
                              {product.description}
                            </p>
                          </div>
                        </div>
                      )}

                      {product.categoryId && (
                        <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                          <div className="flex items-center justify-center w-10 h-10 bg-slate-100 rounded-xl">
                            <Tag size={18} className="text-slate-500" />
                          </div>
                          <div>
                            <p className="text-slate-500 text-xs">카테고리</p>
                            <p className="font-medium text-slate-900">{product.categoryId}</p>
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </div>
              </div>

              {/* 옵션 정보 */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-violet-100 rounded-lg">
                        <Layers size={18} className="text-violet-600" />
                      </div>
                      <span className="font-semibold text-slate-900">옵션</span>
                    </div>
                    {isEditingOptions ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setIsEditingOptions(false)}
                        >
                          <X size={14} className="mr-1" />
                          취소
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleSaveOptions}
                          disabled={isSavingOptions}
                        >
                          <Save size={14} className="mr-1" />
                          {isSavingOptions ? '저장중...' : '저장'}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleStartEditOptions}
                      >
                        <Edit size={14} className="mr-1" />
                        수정
                      </Button>
                    )}
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {isEditingOptions ? (
                    <div className="space-y-4">
                      {editingOptions.map((group, gIdx) => (
                        <div key={gIdx} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <div className="flex items-center gap-2 mb-3">
                            <Input
                              value={group.groupName}
                              onChange={(e) => {
                                const newOptions = [...editingOptions]
                                newOptions[gIdx].groupName = e.target.value
                                setEditingOptions(newOptions)
                              }}
                              placeholder="옵션 그룹명 (예: 색상, 사이즈)"
                              className="flex-1 !rounded-lg"
                            />
                            <button
                              onClick={() => {
                                const newOptions = editingOptions.filter((_, i) => i !== gIdx)
                                setEditingOptions(newOptions.length > 0 ? newOptions : [{ groupName: '', values: [''] }])
                              }}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <div className="space-y-2">
                            {group.values.map((value, vIdx) => (
                              <div key={vIdx} className="flex items-center gap-2">
                                <Input
                                  value={value}
                                  onChange={(e) => {
                                    const newOptions = [...editingOptions]
                                    newOptions[gIdx].values[vIdx] = e.target.value
                                    setEditingOptions(newOptions)
                                  }}
                                  placeholder="옵션 값"
                                  className="flex-1 !rounded-lg"
                                />
                                <button
                                  onClick={() => {
                                    const newOptions = [...editingOptions]
                                    newOptions[gIdx].values = newOptions[gIdx].values.filter((_, i) => i !== vIdx)
                                    if (newOptions[gIdx].values.length === 0) {
                                      newOptions[gIdx].values = ['']
                                    }
                                    setEditingOptions(newOptions)
                                  }}
                                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Minus size={16} />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => {
                                const newOptions = [...editingOptions]
                                newOptions[gIdx].values.push('')
                                setEditingOptions(newOptions)
                              }}
                              className="flex items-center gap-1 text-sm text-violet-600 hover:text-violet-700 font-medium"
                            >
                              <Plus size={14} />
                              옵션 값 추가
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => setEditingOptions([...editingOptions, { groupName: '', values: [''] }])}
                        className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 hover:border-violet-300 hover:text-violet-600 transition-colors"
                      >
                        <Plus size={18} />
                        옵션 그룹 추가
                      </button>
                    </div>
                  ) : Object.keys(groupedOptions).length > 0 ? (
                    Object.entries(groupedOptions).map(([groupName, values]) => (
                      <div key={groupName}>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{groupName}</label>
                        <div className="flex flex-wrap gap-2">
                          {values.map((value, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-full text-sm font-medium"
                            >
                              {value}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">옵션 없음</p>
                  )}
                </div>
              </div>

              {/* 변형상품 (Variants) */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-emerald-100 rounded-lg">
                        <Layers size={18} className="text-emerald-600" />
                      </div>
                      <span className="font-semibold text-slate-900">변형상품</span>
                      {!isEditingVariants && product.variants && product.variants.length > 0 && (
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          {product.variants.length}개
                        </span>
                      )}
                    </div>
                    {isEditingVariants ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setIsEditingVariants(false)}
                        >
                          <X size={14} className="mr-1" />
                          취소
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleSaveVariants}
                          disabled={isSavingVariants}
                        >
                          <Save size={14} className="mr-1" />
                          {isSavingVariants ? '저장중...' : '저장'}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleStartEditVariants}
                      >
                        <Edit size={14} className="mr-1" />
                        수정
                      </Button>
                    )}
                  </div>
                </div>

                <div className="p-4">
                  {isEditingVariants ? (
                    <div className="space-y-4">
                      {/* 자동 생성 버튼 */}
                      {Object.keys(groupedOptions).length > 0 && (
                        <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                          <div className="text-sm text-emerald-700">
                            <span className="font-medium">옵션 조합 자동 생성</span>
                            <span className="text-emerald-600 ml-2">
                              ({Object.values(groupedOptions).reduce((acc, vals) => acc * vals.length, 1)}개 조합 가능)
                            </span>
                          </div>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={handleGenerateAllVariants}
                            className="!bg-emerald-600 hover:!bg-emerald-700"
                          >
                            <Layers size={14} className="mr-1" />
                            모든 조합 생성
                          </Button>
                        </div>
                      )}

                      {/* 변형 목록 */}
                      <div className="space-y-3">
                        {editingVariants.map((variant, idx) => (
                          <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <div className="flex items-start gap-3">
                              <div className="flex-1 space-y-3">
                                {/* 옵션 선택 드롭다운 */}
                                {Object.keys(groupedOptions).length > 0 ? (
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {Object.entries(groupedOptions).map(([groupName, values]) => (
                                      <div key={groupName}>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">{groupName}</label>
                                        <select
                                          value={variant.selectedOptions[groupName] || ''}
                                          onChange={(e) => {
                                            const newVariants = [...editingVariants]
                                            newVariants[idx].selectedOptions = {
                                              ...newVariants[idx].selectedOptions,
                                              [groupName]: e.target.value,
                                            }
                                            setEditingVariants(newVariants)
                                          }}
                                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
                                        >
                                          <option value="">선택</option>
                                          {values.map((value) => (
                                            <option key={value} value={value}>{value}</option>
                                          ))}
                                        </select>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-slate-400">먼저 옵션을 추가해주세요</p>
                                )}

                                {/* 가격 */}
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">도매가</label>
                                    <Input
                                      type="number"
                                      value={variant.wholesalePrice ?? ''}
                                      onChange={(e) => {
                                        const newVariants = [...editingVariants]
                                        const value = e.target.value
                                        newVariants[idx].wholesalePrice = value === '' ? null : parseInt(value) || 0
                                        setEditingVariants(newVariants)
                                      }}
                                      placeholder="0"
                                      className="!rounded-lg"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">판매가</label>
                                    <Input
                                      type="number"
                                      value={variant.price || ''}
                                      onChange={(e) => {
                                        const newVariants = [...editingVariants]
                                        newVariants[idx].price = parseInt(e.target.value) || 0
                                        setEditingVariants(newVariants)
                                      }}
                                      placeholder="0"
                                      className="!rounded-lg"
                                    />
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  const newVariants = editingVariants.filter((_, i) => i !== idx)
                                  setEditingVariants(newVariants.length > 0 ? newVariants : [{ selectedOptions: {}, price: 0, wholesalePrice: null }])
                                }}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-4"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() => setEditingVariants([...editingVariants, { selectedOptions: {}, price: 0, wholesalePrice: null }])}
                        className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 hover:border-emerald-300 hover:text-emerald-600 transition-colors"
                      >
                        <Plus size={18} />
                        변형상품 추가
                      </button>
                    </div>
                  ) : product.variants && product.variants.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="text-left py-2.5 px-3 font-medium text-slate-600 border-b border-slate-200">옵션</th>
                            <th className="text-right py-2.5 px-3 font-medium text-slate-600 border-b border-slate-200 w-24">도매원가</th>
                            <th className="text-right py-2.5 px-3 font-medium text-slate-600 border-b border-slate-200 w-24">마진조정가</th>
                            <th className="text-right py-2.5 px-3 font-medium text-slate-600 border-b border-slate-200 w-24">배송비</th>
                            <th className="text-right py-2.5 px-3 font-medium text-slate-600 border-b border-slate-200 w-28">판매가</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {product.variants.map((variant) => {
                            // 배송비: SEPARATE 면 product.shippingFee 가산, INCLUDED 면 0, 그 외 0
                            const shippingFee = product.shippingFee || 0
                            const isIncluded = product.bundleShippingType === 'INCLUDED'
                            const shippingForRow = isIncluded ? 0 : shippingFee
                            const finalPrice = (variant.price || 0) + shippingForRow
                            return (
                              <tr key={variant.id} className="hover:bg-slate-50/50">
                                <td className="py-2 px-3 text-slate-900">
                                  {variant.optionSummary || '-'}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-500 tabular-nums">
                                  {formatPrice(variant.wholesalePrice)}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-700 tabular-nums">
                                  {formatPrice(variant.price)}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-500 tabular-nums">
                                  {isIncluded ? (
                                    <span className="text-emerald-600 text-xs">포함</span>
                                  ) : shippingForRow > 0 ? (
                                    `+${formatPrice(shippingForRow)}`
                                  ) : (
                                    formatPrice(0)
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right text-blue-700 font-semibold tabular-nums">
                                  {formatPrice(finalPrice)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 px-2">변형상품 없음</p>
                  )}
                </div>
              </div>

              {/* 배송비 정보 */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-sky-100 rounded-lg">
                        <Truck size={18} className="text-sky-600" />
                      </div>
                      <span className="font-semibold text-slate-900">배송 정보</span>
                    </div>
                    {isEditingShipping ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setIsEditingShipping(false)
                            setShippingFormData({ ...originalShippingData })
                          }}
                        >
                          <X size={14} className="mr-1" />
                          취소
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleSaveShipping}
                          disabled={isSavingShipping}
                        >
                          <Save size={14} className="mr-1" />
                          {isSavingShipping ? '저장중...' : '저장'}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsEditingShipping(true)}
                      >
                        <Edit size={14} className="mr-1" />
                        수정
                      </Button>
                    )}
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {isEditingShipping ? (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">배송비</label>
                        <div className="flex items-center gap-2 flex-nowrap">
                          <Input
                            type="number"
                            value={shippingFormData.shippingFee || ''}
                            onChange={(e) => setShippingFormData({ ...shippingFormData, shippingFee: parseInt(e.target.value) || 0 })}
                            placeholder="0"
                            className="!rounded-xl w-24"
                          />
                          <span className="text-slate-500 text-sm whitespace-nowrap">원</span>
                          <button
                            onClick={handleResetShipping}
                            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                          >
                            복구
                          </button>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">0원 입력 시 무료배송으로 표시됩니다</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">최대 합배송</label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={shippingFormData.bundleMaxQty || ''}
                            onChange={(e) => setShippingFormData({ ...shippingFormData, bundleMaxQty: parseInt(e.target.value) || 1 })}
                            placeholder="1"
                            min={1}
                            className="!rounded-xl w-16"
                          />
                          <select
                            value={shippingFormData.bundleUnit}
                            onChange={(e) => setShippingFormData({ ...shippingFormData, bundleUnit: e.target.value })}
                            className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                          >
                            <option value="개">개</option>
                            <option value="박스">박스</option>
                            <option value="kg">kg</option>
                            <option value="세트">세트</option>
                            <option value="팩">팩</option>
                          </select>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">1 입력 시 합배송 불가로 표시됩니다</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">배송 안내</label>
                        <textarea
                          value={shippingFormData.shippingInfo}
                          onChange={(e) => setShippingFormData({ ...shippingFormData, shippingInfo: e.target.value })}
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none"
                          rows={4}
                          placeholder="배송 안내 문구를 입력하세요"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 bg-slate-100 rounded-xl">
                            <Truck size={18} className="text-slate-500" />
                          </div>
                          <div>
                            <p className="text-slate-500 text-xs">배송비</p>
                            <p className="font-medium text-slate-900">
                              {product.shippingFee === 0 ? '무료배송' : product.shippingFee ? `₩${product.shippingFee.toLocaleString()}` : '정보 없음'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 bg-sky-50 rounded-xl">
                            <Package size={18} className="text-sky-500" />
                          </div>
                          <div>
                            <p className="text-slate-500 text-xs">최대 합배송</p>
                            <p className="font-medium text-slate-900">
                              {product.bundleMaxQty && product.bundleMaxQty > 1
                                ? `${product.bundleMaxQty}${product.bundleUnit || '개'}`
                                : '합배송 불가'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 bg-purple-50 rounded-xl">
                            <Tag size={18} className="text-purple-500" />
                          </div>
                          <div>
                            <p className="text-slate-500 text-xs">합배송 타입</p>
                            <p className="font-medium text-slate-900">
                              {product.bundleShippingType === 'INCLUDED' && (
                                <span className="text-green-600">배송비 포함형</span>
                              )}
                              {product.bundleShippingType === 'SEPARATE' && (
                                <span className="text-blue-600">배송비 별도형</span>
                              )}
                              {product.bundleShippingType === 'NONE' && (
                                <span className="text-slate-400">합배송 없음</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      {product.shippingInfo && (
                        <div className="pt-4 border-t border-slate-100">
                          <p className="text-slate-500 text-xs mb-2">배송 안내</p>
                          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">
                              {product.shippingInfo}
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* 출처 채널 정보 */}
              {product.channel && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-amber-100 rounded-lg">
                        <FileText size={18} className="text-amber-600" />
                      </div>
                      <span className="font-semibold text-slate-900">출처 채널 정보</span>
                    </div>
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      {product.channel.coverUrl ? (
                        <img
                          src={product.channel.coverUrl}
                          alt={product.channel.name}
                          className="w-10 h-10 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center">
                          <Store size={18} className="text-slate-400" />
                        </div>
                      )}
                      <div>
                        <p className="text-slate-500 text-xs">출처 채널</p>
                        <p className="font-medium text-slate-900">{product.channel.name}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 발행 현황 카드 */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-blue-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-emerald-100 rounded-lg">
                        <Send size={18} className="text-emerald-600" />
                      </div>
                      <span className="font-semibold text-slate-900">발행 현황</span>
                      {((product.shopProducts?.length || 0) + (product.channelProducts?.length || 0)) > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 font-medium">
                          {(product.shopProducts?.length || 0) + (product.channelProducts?.length || 0)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  {((product.shopProducts?.length || 0) + (product.channelProducts?.length || 0)) > 0 ? (
                    <div className="space-y-4">
                      {/* 쇼핑몰 발행 */}
                      {product.shopProducts && product.shopProducts.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <Store size={14} className="text-blue-500" />
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">쇼핑몰</span>
                          </div>
                          <div className="space-y-2">
                            {product.shopProducts.map((sp) => (
                              <div
                                key={sp.id}
                                className="flex items-center justify-between p-3 bg-blue-50/50 rounded-xl border border-blue-100 hover:bg-blue-50 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <Store size={14} className="text-blue-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-slate-900 text-sm">{sp.shop.name}</p>
                                    <p className="text-xs text-slate-500">{formatDate(sp.publishedAt || sp.createdAt)}</p>
                                  </div>
                                </div>
                                <a
                                  href={`${process.env.NEXT_PUBLIC_SHOP_BASE_URL || 'http://localhost:3000'}/${sp.shop.subdomain}/product/${sp.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 text-blue-500 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                >
                                  <ExternalLink size={14} />
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 밴드 채널 발행 */}
                      {product.channelProducts && product.channelProducts.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <History size={14} className="text-violet-500" />
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">밴드 채널</span>
                          </div>
                          <div className="space-y-2">
                            {product.channelProducts.map((cp) => (
                              <div
                                key={cp.id}
                                className="flex items-center justify-between p-3 bg-violet-50/50 rounded-xl border border-violet-100 hover:bg-violet-50 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  {cp.channel.coverUrl ? (
                                    <img
                                      src={cp.channel.coverUrl}
                                      alt={cp.channel.name}
                                      className="w-8 h-8 rounded-lg object-cover"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                                      <Store size={14} className="text-violet-600" />
                                    </div>
                                  )}
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-slate-900 text-sm">{cp.channel.name}</p>
                                      {getChannelKindBadge(cp.channel.kind)}
                                    </div>
                                    <p className="text-xs text-slate-500">{formatDate(cp.publishedAt || cp.createdAt)}</p>
                                  </div>
                                </div>
                                <a
                                  href={`https://band.us/band/${cp.channel.channelKey}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 text-violet-500 hover:text-violet-600 hover:bg-violet-100 rounded-lg transition-colors"
                                >
                                  <ExternalLink size={14} />
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <div className="w-12 h-12 mx-auto mb-3 bg-slate-100 rounded-xl flex items-center justify-center">
                        <Send size={20} className="text-slate-400" />
                      </div>
                      <p className="text-slate-500 text-sm font-medium">아직 발행되지 않았습니다</p>
                      <p className="text-xs text-slate-400 mt-1">가공상품 발행 메뉴에서 발행할 수 있습니다</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="상품 삭제"
        message="정말 이 상품을 삭제하시겠습니까? 삭제된 상품은 복구할 수 없습니다."
        confirmText="삭제"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}
