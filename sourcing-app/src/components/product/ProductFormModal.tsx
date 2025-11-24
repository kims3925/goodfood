'use client'

import { useState, useEffect } from 'react'
import { Save, X, Plus, Trash2, AlertCircle } from 'lucide-react'
import Modal, { ModalFooter } from '../ui/Modal'
import Button from '../ui/Button'
import Input from '../ui/Input'
import { ProductDraft, OptionGroup, GeneratedVariant } from '@/modules/transformation'
import { generateVariants, calculateVariantCount } from '@/modules/transformation'

interface ProductFormModalProps {
  isOpen: boolean
  onClose: () => void
  postId: number
  productId?: number // Optional - if provided, we're in edit mode
  initialData: ProductDraft
  onSaved: () => void
}

type TabType = 'basic' | 'options' | 'variants'

export default function ProductFormModal({
  isOpen,
  onClose,
  postId,
  productId,
  initialData,
  onSaved,
}: ProductFormModalProps) {
  const isEditMode = !!productId
  const [activeTab, setActiveTab] = useState<TabType>('basic')
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [price, setPrice] = useState<number | ''>('')
  const [wholesalePrice, setWholesalePrice] = useState<number | ''>('')

  // Options state
  const [options, setOptions] = useState<OptionGroup[]>([])
  const [newOptionGroup, setNewOptionGroup] = useState('')
  const [newOptionValues, setNewOptionValues] = useState('')

  // Variants state
  const [variants, setVariants] = useState<GeneratedVariant[]>([])

  // Initialize form with AI-generated data
  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '')
      setDescription(initialData.description || '')
      setCategoryId(initialData.categoryId || '')
      setPrice(initialData.price || '')
      setWholesalePrice(initialData.wholesalePrice || '')
      setOptions(initialData.options || [])
      setVariants(initialData.variants || [])
    }
  }, [initialData])

  // Regenerate variants when options change
  useEffect(() => {
    if (options.length > 0) {
      const generated = generateVariants(options)
      // Preserve prices from existing variants if they match
      const variantsWithPrices = generated.map((v) => {
        const existing = variants.find((ev) => ev.optionSummary === v.optionSummary)
        return {
          ...v,
          price: existing?.price || price || 0,
          wholesalePrice: existing?.wholesalePrice || wholesalePrice || undefined,
          stock: existing?.stock || 0,
        }
      })
      setVariants(variantsWithPrices)
    } else {
      setVariants([])
    }
  }, [options])

  const handleAddOption = () => {
    if (!newOptionGroup.trim() || !newOptionValues.trim()) {
      alert('옵션 그룹명과 값을 모두 입력해주세요.')
      return
    }

    const values = newOptionValues.split(',').map((v) => v.trim()).filter((v) => v)
    if (values.length === 0) {
      alert('옵션 값을 입력해주세요.')
      return
    }

    setOptions([...options, { groupName: newOptionGroup.trim(), values }])
    setNewOptionGroup('')
    setNewOptionValues('')
  }

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index))
  }

  const handleUpdateVariant = (index: number, field: 'price' | 'wholesalePrice' | 'stock', value: number) => {
    const updated = [...variants]
    updated[index] = { ...updated[index], [field]: value }
    setVariants(updated)
  }

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      alert('상품명을 입력해주세요.')
      setActiveTab('basic')
      return
    }

    if (variants.length > 0) {
      const hasInvalidPrice = variants.some((v) => !v.price || v.price <= 0)
      if (hasInvalidPrice) {
        alert('모든 변형의 가격을 입력해주세요.')
        setActiveTab('variants')
        return
      }
    }

    try {
      setIsSaving(true)

      // Prepare options data
      const optionsData = options.flatMap((group) =>
        group.values.map((value, index) => ({
          groupName: group.groupName,
          value,
          sortOrder: index,
        }))
      )

      // Prepare variants data
      const variantsData = variants.map((variant) => ({
        optionSummary: variant.optionSummary,
        price: variant.price || 0,
        wholesalePrice: variant.wholesalePrice,
        stock: variant.stock || 0,
      }))

      // Calculate price from variants
      const calculatedPrice = variants.length > 0
        ? Math.min(...variants.map((v) => v.price || 0))
        : (typeof price === 'number' ? price : 0)

      // Create or update product
      const response = await fetch('/api/product', {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isEditMode && { id: productId }),
          postId,
          name: name.trim(),
          description: description.trim() || null,
          categoryId: categoryId.trim() || null,
          currency: 'KRW',
          price: calculatedPrice,
          wholesalePrice: typeof wholesalePrice === 'number' ? wholesalePrice : null,
          options: optionsData,
          variants: variantsData,
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert(isEditMode ? '상품이 수정되었습니다!' : '상품이 등록되었습니다!')
        onSaved()
      } else {
        alert(data.error || (isEditMode ? '상품 수정에 실패했습니다.' : '상품 등록에 실패했습니다.'))
      }
    } catch (error) {
      console.error('상품 등록 실패:', error)
      alert('상품 등록 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const variantCount = calculateVariantCount(options)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? '상품 정보 수정' : '상품 등록'}
      size="2xl"
    >
      <div className="flex flex-col h-[calc(80vh-8rem)]">
        {/* AI 생성 안내 */}
        <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-start gap-2">
          <AlertCircle size={20} className="text-purple-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-purple-800">
            AI가 생성한 정보입니다. 내용을 확인하고 수정한 후 저장해주세요.
          </p>
        </div>

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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    도매가 (원)
                  </label>
                  <Input
                    type="number"
                    value={wholesalePrice}
                    onChange={(e) => setWholesalePrice(e.target.value ? parseInt(e.target.value) : '')}
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    원가 또는 도매가 (선택사항)
                  </p>
                </div>
              </div>
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
                            정상가 (원)
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
                                value={variant.wholesalePrice || ''}
                                onChange={(e) =>
                                  handleUpdateVariant(
                                    index,
                                    'wholesalePrice',
                                    e.target.value ? parseInt(e.target.value) : 0
                                  )
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
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            <X size={16} />
            취소
          </Button>
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
        </ModalFooter>
      </div>
    </Modal>
  )
}
