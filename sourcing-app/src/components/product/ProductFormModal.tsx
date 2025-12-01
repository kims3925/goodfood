'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Save, X, Plus, Trash2, AlertCircle, ExternalLink, RefreshCw, ImageIcon } from 'lucide-react'
import Modal, { ModalFooter } from '../ui/Modal'
import Button from '../ui/Button'
import Input from '../ui/Input'
import { ProductDraft, OptionGroup, GeneratedVariant } from '@/modules/transformation'
import ImageSortable, { SortableImage } from './ImageSortable'

interface DraftWithPostId {
  postId: number
  draft: ProductDraft
  error?: string
}

interface ProductFormModalProps {
  isOpen: boolean
  onClose: () => void
  postId: number
  productId?: number // Optional - if provided, we're in edit mode
  initialData: ProductDraft
  initialDrafts?: DraftWithPostId[] // 다중 게시물 AI 결과
  onSaved: () => void
  onAddMorePosts?: () => void // 추가 게시물 선택 콜백
  onRetry?: (postId: number) => void // AI 재시도 콜백
}

type TabType = 'basic' | 'images' | 'options' | 'variants'

// 개별 상품 데이터 타입
interface ProductFormData {
  id: string
  name: string
  description: string
  categoryId: string
  price: number | ''
  options: OptionGroup[]
  variants: GeneratedVariant[]
  images: SortableImage[] // 이미지 목록
  error?: string // AI 생성 실패 여부
}

// 기본 상품 데이터 생성 함수
const createEmptyProductData = (id: string): ProductFormData => ({
  id,
  name: '',
  description: '',
  categoryId: '',
  price: '',
  options: [],
  variants: [],
  images: [],
})

export default function ProductFormModal({
  isOpen,
  onClose,
  postId,
  productId,
  initialData,
  initialDrafts,
  onSaved,
  onAddMorePosts,
  onRetry,
}: ProductFormModalProps) {
  const isEditMode = !!productId
  const [activeTab, setActiveTab] = useState<TabType>('basic')
  const [isSaving, setIsSaving] = useState(false)

  // 다중 상품 탭 관리
  const [productTabs, setProductTabs] = useState<(ProductFormData & { postId?: number })[]>([])
  const [activeProductIndex, setActiveProductIndex] = useState(0)

  // 현재 활성 상품 데이터 getter
  const currentProduct = productTabs[activeProductIndex] || createEmptyProductData('1')

  // Options state (for new option input)
  const [newOptionGroup, setNewOptionGroup] = useState('')
  const [newOptionValues, setNewOptionValues] = useState('')

  // 이미지 순서 변경 상태
  const [isReorderingSaving, setIsReorderingSaving] = useState(false)
  const [imageOrderChanged, setImageOrderChanged] = useState(false)

  // 이미지 로드 함수
  const loadImagesForPost = async (targetPostId: number): Promise<SortableImage[]> => {
    try {
      const response = await fetch(`/api/post/${targetPostId}`)
      const data = await response.json()
      if (data.success && data.data?.images) {
        return data.data.images.map((img: any) => ({
          id: img.id,
          imageUrl: img.imageUrl,
          name: img.name,
          sortOrder: img.sortOrder,
        }))
      }
    } catch (error) {
      console.error('이미지 로드 실패:', error)
    }
    return []
  }

  // Initialize form with AI-generated data (다중 게시물 지원)
  useEffect(() => {
    if (!isOpen) return

    const initializeForm = async () => {
      // 다중 게시물 AI 결과가 있으면 사용
      if (initialDrafts && initialDrafts.length > 0) {
        const tabs: (ProductFormData & { postId?: number })[] = await Promise.all(
          initialDrafts.map(async (item, index) => {
            const images = await loadImagesForPost(item.postId)
            return {
              id: String(index + 1),
              postId: item.postId,
              name: item.draft?.name || '',
              description: item.draft?.description || '',
              categoryId: item.draft?.categoryId || '',
              price: item.draft?.price || '' as number | '',
              options: item.draft?.options || [],
              variants: item.draft?.variants || [],
              images,
              error: item.error,
            }
          })
        )
        setProductTabs(tabs)
        setActiveProductIndex(0)
      } else if (initialData) {
        // 단일 게시물 (기존 로직)
        const images = await loadImagesForPost(postId)
        const initialProduct: ProductFormData & { postId?: number } = {
          id: '1',
          postId: postId,
          name: initialData.name || '',
          description: initialData.description || '',
          categoryId: initialData.categoryId || '',
          price: initialData.price || '',
          options: initialData.options || [],
          variants: initialData.variants || [],
          images,
        }
        setProductTabs([initialProduct])
        setActiveProductIndex(0)
      }
      setImageOrderChanged(false)
    }

    initializeForm()
  }, [initialData, initialDrafts, isOpen, postId])

  // 현재 상품 데이터 업데이트 함수
  const updateCurrentProduct = (updates: Partial<ProductFormData>) => {
    setProductTabs(prev => {
      const newTabs = [...prev]
      newTabs[activeProductIndex] = { ...newTabs[activeProductIndex], ...updates }
      return newTabs
    })
  }

  // 새 상품 탭 추가 - 추가 게시물 선택으로 변경
  const addProductTab = () => {
    if (onAddMorePosts) {
      // 추가 게시물 선택 모달 열기
      onAddMorePosts()
    }
  }

  // 상품 탭 삭제
  const removeProductTab = (index: number) => {
    if (productTabs.length <= 1) {
      return
    }
    setProductTabs(prev => prev.filter((_, i) => i !== index))
    if (activeProductIndex >= index && activeProductIndex > 0) {
      setActiveProductIndex(activeProductIndex - 1)
    }
  }

  // Getter/Setter shortcuts for current product
  const name = currentProduct.name
  const setName = (value: string) => updateCurrentProduct({ name: value })
  const description = currentProduct.description
  const setDescription = (value: string) => updateCurrentProduct({ description: value })
  const categoryId = currentProduct.categoryId
  const setCategoryId = (value: string) => updateCurrentProduct({ categoryId: value })
  const price = currentProduct.price
  const setPrice = (value: number | '') => updateCurrentProduct({ price: value })
  const options = currentProduct.options
  const setOptions = (value: OptionGroup[]) => updateCurrentProduct({ options: value })
  const variants = currentProduct.variants
  const setVariants = (value: GeneratedVariant[]) => updateCurrentProduct({ variants: value })
  const images = currentProduct.images || []

  // 이미지 순서 변경 핸들러
  const handleImageReorder = (newOrder: SortableImage[]) => {
    updateCurrentProduct({ images: newOrder })
    setImageOrderChanged(true)
  }

  // 이미지 순서 저장
  const handleSaveImageOrder = async () => {
    const targetPostId = currentProduct.postId || postId
    if (!targetPostId || images.length === 0) return

    try {
      setIsReorderingSaving(true)
      const response = await fetch('/api/post-image/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: targetPostId,
          imageIds: images.map((img) => img.id),
        }),
      })

      const data = await response.json()
      if (data.success) {
        setImageOrderChanged(false)
      } else {
        console.error('이미지 순서 저장 실패:', data.error)
      }
    } catch (error) {
      console.error('이미지 순서 저장 실패:', error)
    } finally {
      setIsReorderingSaving(false)
    }
  }

  const handleAddOption = () => {
    if (!newOptionGroup.trim() || !newOptionValues.trim()) {
      return
    }

    const values = newOptionValues.split(',').map((v) => v.trim()).filter((v) => v)
    if (values.length === 0) {
      return
    }

    setOptions([...options, { groupName: newOptionGroup.trim(), values }])
    setNewOptionGroup('')
    setNewOptionValues('')
  }

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index))
  }

  const handleUpdateVariant = (index: number, field: 'price' | 'stock', value: number) => {
    const updated = [...variants]
    updated[index] = { ...updated[index], [field]: value }
    setVariants(updated)
  }

  // 현재 상품만 개별 등록
  const handleSaveCurrentProduct = async () => {
    const product = currentProduct

    // 유효성 검사
    if (!product.name.trim()) {
      setActiveTab('basic')
      return
    }

    try {
      setIsSaving(true)
      const success = await saveSingleProduct(product, true)

      if (success) {
        // 등록 성공 시 해당 탭 제거
        if (productTabs.length === 1) {
          // 마지막 상품이면 모달 닫기
          onSaved()
        } else {
          // 탭에서 제거하고 다음 탭으로 이동
          const newTabs = productTabs.filter((_, i) => i !== activeProductIndex)
          setProductTabs(newTabs)
          // 현재 인덱스가 마지막이었으면 이전 탭으로, 아니면 현재 위치 유지
          if (activeProductIndex >= newTabs.length) {
            setActiveProductIndex(newTabs.length - 1)
          }
        }
      }
    } catch (error) {
      console.error('상품 등록 실패:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // 편집 모드 또는 단일 상품 저장
  const handleSave = async () => {
    // 편집 모드일 때는 단일 상품 저장
    if (isEditMode) {
      setIsSaving(true)
      try {
        const success = await saveSingleProduct(currentProduct)
        if (success) {
          onSaved()
        }
      } finally {
        setIsSaving(false)
      }
      return
    }

    // 다중 상품일 때는 개별 등록 사용
    await handleSaveCurrentProduct()
  }

  // 단일 상품 저장 함수
  const saveSingleProduct = async (product: ProductFormData & { postId?: number }, silent = false): Promise<boolean> => {
    try {
      // 가격 계산
      const calculatedPrice = typeof product.price === 'number' ? product.price : 0

      // 각 상품의 postId 사용 (없으면 props의 postId 사용)
      const targetPostId = product.postId || postId

      // Create or update product
      const response = await fetch('/api/product', {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isEditMode && { id: productId }),
          postId: targetPostId,
          name: product.name.trim(),
          description: product.description.trim() || null,
          categoryId: product.categoryId.trim() || null,
          currency: 'KRW',
          price: calculatedPrice,
        }),
      })

      const data = await response.json()

      if (data.success) {
        if (!silent) {
          onSaved()
        }
        return true
      } else {
        if (!silent) {
        }
        return false
      }
    } catch (error) {
      console.error('상품 저장 실패:', error)
      if (!silent) {
      }
      return false
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? '상품 정보 수정' : '상품 등록'}
      size="2xl"
    >
      <div className="flex flex-col h-[calc(80vh-8rem)]">
        {/* 다중 상품 탭 - 편집 모드가 아닐 때만 표시 */}
        {!isEditMode && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-gray-700">상품 목록</span>
              <span className="text-xs text-gray-500">({productTabs.length}개)</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {productTabs.map((product, index) => {
                const hasError = !!product.error
                return (
                  <div
                    key={product.id}
                    className={`flex items-center gap-1 px-3 py-2 rounded-lg border-2 transition-all cursor-pointer min-w-fit ${
                      hasError
                        ? activeProductIndex === index
                          ? 'border-red-500 bg-red-50'
                          : 'border-red-300 bg-red-50 hover:border-red-400'
                        : activeProductIndex === index
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                    onClick={() => setActiveProductIndex(index)}
                  >
                    {hasError && <AlertCircle size={14} className="text-red-500 flex-shrink-0" />}
                    <span className={`text-sm font-medium ${
                      hasError
                        ? 'text-red-700'
                        : activeProductIndex === index ? 'text-purple-700' : 'text-gray-700'
                    }`}>
                      {product.name || `상품 ${index + 1}`}
                    </span>
                    {productTabs.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeProductTab(index)
                        }}
                        className="ml-1 p-0.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors"
                        title="상품 삭제"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                )
              })}
              {onAddMorePosts && (
                <button
                  onClick={addProductTab}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50 transition-all min-w-fit"
                  title="게시물 선택하여 상품 추가"
                >
                  <Plus size={16} />
                  <span className="text-sm">추가</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* AI 생성 안내 */}
        {currentProduct.error ? (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">
              <p className="font-medium mb-1">AI 상품 생성에 실패했습니다.</p>
              <p className="mb-2 text-red-700">사유: {currentProduct.error}</p>
              <p className="mb-2 text-red-600">게시물 내용을 확인하고 직접 상품 정보를 입력해주세요.</p>
              <Link
                href={`/post/detail/${currentProduct.postId}`}
                target="_blank"
                className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 underline"
              >
                <ExternalLink size={14} />
                게시물 상세 보기
              </Link>
            </div>
          </div>
        ) : (
          <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-start gap-2">
            <AlertCircle size={20} className="text-purple-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-purple-800">
              AI가 생성한 정보입니다. 내용을 확인하고 수정한 후 저장해주세요.
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          <button
            onClick={() => setActiveTab('basic')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'basic'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            기본 정보
          </button>
          <button
            onClick={() => setActiveTab('images')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-1 ${
              activeTab === 'images'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <ImageIcon size={16} />
            이미지 {images.length > 0 && `(${images.length})`}
            {imageOrderChanged && (
              <span className="w-2 h-2 bg-orange-500 rounded-full" title="저장되지 않은 변경사항" />
            )}
          </button>
          {/* 옵션 설정 탭 - 나중에 사용 */}
          {/* <button
            onClick={() => setActiveTab('options')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'options'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            옵션 설정 {options.length > 0 && `(${options.length})`}
          </button> */}
          {/* 변형 관리 탭 - 나중에 사용 */}
          {/* <button
            onClick={() => setActiveTab('variants')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'variants'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            변형 관리 {variants.length > 0 && `(${variants.length})`}
          </button> */}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  상품명 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="상품명을 입력하세요"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  상품 설명
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="상품에 대한 자세한 설명을 입력하세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={5}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  카테고리
                </label>
                <Input
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  placeholder="카테고리"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    판매가 (원)
                  </label>
                  <Input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value ? parseInt(e.target.value) : '')}
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    변형이 있으면 최소 변형 가격이 자동 설정됩니다
                  </p>
                </div>

              </div>
            </div>
          )}

          {/* Images Tab */}
          {activeTab === 'images' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">이미지 순서 변경</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    드래그하여 이미지 순서를 변경하세요. 첫 번째 이미지가 대표 이미지가 됩니다.
                  </p>
                </div>
                {imageOrderChanged && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveImageOrder}
                    disabled={isReorderingSaving}
                  >
                    {isReorderingSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        저장 중...
                      </>
                    ) : (
                      <>
                        <Save size={14} />
                        순서 저장
                      </>
                    )}
                  </Button>
                )}
              </div>

              <ImageSortable
                images={images}
                onReorder={handleImageReorder}
              />

              {imageOrderChanged && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm text-orange-800">
                    이미지 순서가 변경되었습니다. &quot;순서 저장&quot; 버튼을 눌러 변경사항을 저장하세요.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Options Tab - 나중에 사용 */}
          {/* {activeTab === 'options' && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">옵션 추가</h3>
                <div className="space-y-3">
                  <div>
                    <Input
                      value={newOptionGroup}
                      onChange={(e) => setNewOptionGroup(e.target.value)}
                      placeholder="옵션 그룹명 (예: 색상, 사이즈)"
                    />
                  </div>
                  <div>
                    <Input
                      value={newOptionValues}
                      onChange={(e) => setNewOptionValues(e.target.value)}
                      placeholder="옵션 값들 (쉼표로 구분, 예: 빨강,파랑,초록)"
                    />
                  </div>
                  <Button
                    variant="secondary"
                    onClick={handleAddOption}
                    className="w-full"
                  >
                    <Plus size={16} />
                    옵션 추가
                  </Button>
                </div>
              </div>

              {options.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">현재 옵션</h3>
                    <span className="text-sm text-gray-600">
                      {variantCount}개 변형 생성 예정
                    </span>
                  </div>
                  {options.map((option, index) => (
                    <div
                      key={index}
                      className="p-4 bg-white border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="font-medium text-gray-900">{option.groupName}</span>
                          <span className="text-sm text-gray-500 ml-2">
                            ({option.values.length}개)
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveOption(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {option.values.map((value, vIdx) => (
                          <span
                            key={vIdx}
                            className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                          >
                            {value}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {options.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">옵션이 없습니다.</p>
                  <p className="text-xs mt-1">위에서 옵션을 추가해주세요.</p>
                </div>
              )}
            </div>
          )} */}

          {/* Variants Tab - 나중에 사용 */}
          {/* {activeTab === 'variants' && (
            <div className="space-y-4">
              {variants.length > 0 ? (
                <>
                  <div className="text-sm text-gray-600">
                    옵션 조합으로 {variants.length}개의 변형이 생성되었습니다.
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">
                            옵션 조합
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">
                            판매가 (원) <span className="text-red-500">*</span>
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">
                            재고
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {variants.map((variant, index) => (
                          <tr key={index}>
                            <td className="px-3 py-2 text-gray-900">
                              {variant.optionSummary}
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                value={variant.price || ''}
                                onChange={(e) =>
                                  handleUpdateVariant(index, 'price', parseInt(e.target.value) || 0)
                                }
                                className="w-24"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                value={variant.stock || 0}
                                onChange={(e) =>
                                  handleUpdateVariant(index, 'stock', parseInt(e.target.value) || 0)
                                }
                                className="w-20"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">변형이 없습니다.</p>
                  <p className="text-xs mt-1">옵션을 추가하면 자동으로 변형이 생성됩니다.</p>
                </div>
              )}
            </div>
          )} */}
        </div>

        {/* Footer */}
        <ModalFooter className="mt-4">
          <div className="flex items-center justify-end w-full gap-2">
            {currentProduct.error ? (
              <>
                {onRetry && currentProduct.postId && (
                  <Button
                    variant="secondary"
                    onClick={() => onRetry(currentProduct.postId!)}
                    className="bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100"
                  >
                    <RefreshCw size={16} />
                    AI 다시 시도
                  </Button>
                )}
                <Button variant="primary" disabled>
                  <Save size={16} />
                  상품 등록 불가
                </Button>
              </>
            ) : (
              <Button variant="primary" onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    {isEditMode ? '상품 수정' : '상품 등록'}
                  </>
                )}
              </Button>
            )}
          </div>
        </ModalFooter>
      </div>
    </Modal>
  )
}
