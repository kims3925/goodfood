'use client'

import { useState, useEffect } from 'react'
import { Save, ShoppingCart, Globe, CreditCard, Package, AlertCircle, Image, Plus, Trash2, Edit2, GripVertical, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, Upload, X, Eye, EyeOff } from 'lucide-react'

export default function ShopSettingsPage() {
  const [settings, setSettings] = useState({
    shopName: 'Band Auto Shop',
    shopUrl: 'https://bandauto.shop',
    shopDescription: '도매 상품을 합리적인 가격에 판매하는 온라인 쇼핑몰',

    // 배너 이미지 설정
    bannerImages: [
      { id: 1, url: '', link: '', title: '배너 1' },
      { id: 2, url: '', link: '', title: '배너 2' }
    ],

    // 카테고리 설정
    categories: [
      { id: 1, name: '육류', icon: '🥩', color: 'bg-red-50', enabled: true },
      { id: 2, name: '수산물', icon: '🐟', color: 'bg-blue-50', enabled: true },
      { id: 3, name: '채소', icon: '🥬', color: 'bg-green-50', enabled: true },
      { id: 4, name: '과일', icon: '🍎', color: 'bg-orange-50', enabled: true },
      { id: 5, name: '김치', icon: '🥢', color: 'bg-yellow-50', enabled: true },
      { id: 6, name: '가공품', icon: '📦', color: 'bg-purple-50', enabled: true },
      { id: 7, name: '특가', icon: '⚡', color: 'bg-pink-50', enabled: true },
      { id: 8, name: '더보기', icon: '➕', color: 'bg-gray-50', enabled: true }
    ],

    // 섹션 표시 설정
    showTimeSale: false,
    showBestProducts: false,

    // 결제 설정
    paymentGateway: 'toss',
    tossClientKey: '',
    tossSecretKey: '',

    // 배송 설정
    defaultShippingFee: 3000,
    freeShippingAmount: 50000,
    shippingPolicy: '50,000원 이상 무료배송',

    // 마진 설정
    defaultMarginType: 'percentage',
    defaultMarginValue: 30,

    // 자동화 설정
    autoPublish: true,
    autoUpdateStock: true,
    autoUpdatePrice: false,
  })

  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [draggedCategory, setDraggedCategory] = useState<number | null>(null)
  const [draggedOver, setDraggedOver] = useState<number | null>(null)
  const [showSecretKey, setShowSecretKey] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/shop/settings')
      const data = await response.json()
      
      if (data.success && data.settings) {
        setSettings(prev => ({ ...prev, ...data.settings }))
      }
    } catch (error) {
      console.error('Failed to load shop settings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true)
      
      const response = await fetch('/api/shop/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      })
      
      const data = await response.json()
      
      if (data.success) {
        alert('🎉 쇼핑몰 설정이 성공적으로 저장되었습니다!')
        // 저장 후 설정 다시 로드하여 최신 상태 반영
        await loadSettings()
      } else {
        alert('❌ 설정 저장에 실패했습니다: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      alert('설정 저장 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestConnection = async () => {
    try {
      const response = await fetch('/api/shop/settings/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tossClientKey: settings.tossClientKey,
          tossSecretKey: settings.tossSecretKey,
        }),
      })
      
      const data = await response.json()
      setTestResult(data)
      
      if (data.success) {
        alert('토스페이먼츠 연결 테스트 성공!')
      } else {
        alert('연결 테스트 실패: ' + data.error)
      }
    } catch (error) {
      console.error('Connection test failed:', error)
      alert('연결 테스트 중 오류가 발생했습니다.')
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  // 배너 이미지 관리 함수들
  const handleBannerUpdate = (index: number, field: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      bannerImages: prev.bannerImages.map((banner, i) =>
        i === index ? { ...banner, [field]: value } : banner
      )
    }))
  }

  // 카테고리 관리 함수들
  const handleCategoryUpdate = (id: number, field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      categories: prev.categories.map(cat =>
        cat.id === id ? { ...cat, [field]: value } : cat
      )
    }))
  }

  const handleAddCategory = () => {
    const newId = Math.max(...settings.categories.map(c => c.id)) + 1
    setSettings(prev => ({
      ...prev,
      categories: [...prev.categories, {
        id: newId,
        name: '새 카테고리',
        icon: '📦',
        color: 'bg-gray-50',
        enabled: true
      }]
    }))
  }

  const handleDeleteCategory = (id: number) => {
    if (settings.categories.length <= 1) {
      alert('최소 1개의 카테고리는 유지되어야 합니다.')
      return
    }
    setSettings(prev => ({
      ...prev,
      categories: prev.categories.filter(cat => cat.id !== id)
    }))
  }

  // 카테고리 드래그 앤 드롭 함수들
  const handleCategoryDragStart = (e: React.DragEvent, categoryId: number) => {
    setDraggedCategory(categoryId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleCategoryDragOver = (e: React.DragEvent, categoryId: number) => {
    e.preventDefault()
    setDraggedOver(categoryId)
  }

  const handleCategoryDragLeave = () => {
    setDraggedOver(null)
  }

  const handleCategoryDrop = (e: React.DragEvent, targetCategoryId: number) => {
    e.preventDefault()

    if (!draggedCategory || draggedCategory === targetCategoryId) {
      setDraggedCategory(null)
      setDraggedOver(null)
      return
    }

    const draggedIndex = settings.categories.findIndex(c => c.id === draggedCategory)
    const targetIndex = settings.categories.findIndex(c => c.id === targetCategoryId)

    if (draggedIndex === -1 || targetIndex === -1) return

    // 카테고리 순서 변경
    const newCategories = [...settings.categories]
    const [movedCategory] = newCategories.splice(draggedIndex, 1)
    newCategories.splice(targetIndex, 0, movedCategory)

    setSettings(prev => ({
      ...prev,
      categories: newCategories
    }))

    setDraggedCategory(null)
    setDraggedOver(null)
  }

  // 카테고리 순서 이동 함수들
  const moveCategoryUp = (categoryId: number) => {
    const currentIndex = settings.categories.findIndex(cat => cat.id === categoryId)
    if (currentIndex > 0) {
      const newCategories = [...settings.categories]
      const temp = newCategories[currentIndex]
      newCategories[currentIndex] = newCategories[currentIndex - 1]
      newCategories[currentIndex - 1] = temp

      setSettings(prev => ({
        ...prev,
        categories: newCategories
      }))
    }
  }

  const moveCategoryDown = (categoryId: number) => {
    const currentIndex = settings.categories.findIndex(cat => cat.id === categoryId)
    if (currentIndex < settings.categories.length - 1) {
      const newCategories = [...settings.categories]
      const temp = newCategories[currentIndex]
      newCategories[currentIndex] = newCategories[currentIndex + 1]
      newCategories[currentIndex + 1] = temp

      setSettings(prev => ({
        ...prev,
        categories: newCategories
      }))
    }
  }

  const moveCategoryToTop = (categoryId: number) => {
    const currentIndex = settings.categories.findIndex(cat => cat.id === categoryId)
    if (currentIndex > 0) {
      const newCategories = [...settings.categories]
      const categoryToMove = newCategories.splice(currentIndex, 1)[0]
      newCategories.unshift(categoryToMove)

      setSettings(prev => ({
        ...prev,
        categories: newCategories
      }))
    }
  }

  const moveCategoryToBottom = (categoryId: number) => {
    const currentIndex = settings.categories.findIndex(cat => cat.id === categoryId)
    if (currentIndex < settings.categories.length - 1) {
      const newCategories = [...settings.categories]
      const categoryToMove = newCategories.splice(currentIndex, 1)[0]
      newCategories.push(categoryToMove)

      setSettings(prev => ({
        ...prev,
        categories: newCategories
      }))
    }
  }

  // 이미지 업로드 함수
  const handleImageUpload = async (bannerIndex: number, file: File) => {
    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('type', 'banner')

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('이미지 업로드 실패')
      }

      const data = await response.json()

      // 업로드된 이미지 URL로 배너 업데이트
      handleBannerUpdate(bannerIndex, 'url', data.url)
    } catch (error) {
      console.error('이미지 업로드 오류:', error)
      alert('이미지 업로드에 실패했습니다.')
    }
  }

  // 파일 선택 핸들러
  const handleFileSelect = (bannerIndex: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // 이미지 파일인지 확인
      if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드 가능합니다.')
        return
      }

      // 파일 크기 확인 (5MB 제한)
      if (file.size > 5 * 1024 * 1024) {
        alert('파일 크기는 5MB 이하여야 합니다.')
        return
      }

      handleImageUpload(bannerIndex, file)
    }
  }

  // 배너 이미지 리사이즈 함수 (5:2 비율로 조정)
  const handleBannerResize = async (bannerIndex: number) => {
    const banner = settings.bannerImages[bannerIndex]
    if (!banner.url) {
      alert('먼저 이미지를 업로드해주세요.')
      return
    }

    try {
      // 이미지 로드
      const img = new window.Image()
      img.crossOrigin = 'anonymous'

      img.onload = () => {
        // Canvas 생성
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          alert('Canvas를 지원하지 않는 브라우저입니다.')
          return
        }

        // 5:2 비율 계산 (가로 800px, 세로 320px)
        const targetWidth = 800
        const targetHeight = 320

        canvas.width = targetWidth
        canvas.height = targetHeight

        // 이미지 크롭 및 리사이즈
        const sourceRatio = img.width / img.height
        const targetRatio = targetWidth / targetHeight

        let sourceX = 0, sourceY = 0, sourceWidth = img.width, sourceHeight = img.height

        if (sourceRatio > targetRatio) {
          // 원본이 더 가로로 긴 경우 - 세로를 기준으로 가로를 크롭
          sourceWidth = img.height * targetRatio
          sourceX = (img.width - sourceWidth) / 2
        } else {
          // 원본이 더 세로로 긴 경우 - 가로를 기준으로 세로를 크롭
          sourceHeight = img.width / targetRatio
          sourceY = (img.height - sourceHeight) / 2
        }

        // 이미지 그리기
        ctx.drawImage(
          img,
          sourceX, sourceY, sourceWidth, sourceHeight,
          0, 0, targetWidth, targetHeight
        )

        // Canvas를 Blob으로 변환
        canvas.toBlob(async (blob) => {
          if (!blob) {
            alert('이미지 변환에 실패했습니다.')
            return
          }

          // 새로운 파일 객체 생성
          const resizedFile = new File([blob], `banner_${bannerIndex + 1}_resized.jpg`, {
            type: 'image/jpeg'
          })

          // 리사이즈된 이미지 업로드
          await handleImageUpload(bannerIndex, resizedFile)
          alert('이미지가 쇼핑몰 배너 사이즈(5:2 비율)로 조정되었습니다.')
        }, 'image/jpeg', 0.9)
      }

      img.onerror = () => {
        alert('이미지 로드에 실패했습니다.')
      }

      img.src = banner.url
    } catch (error) {
      console.error('이미지 리사이즈 오류:', error)
      alert('이미지 리사이즈 중 오류가 발생했습니다.')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
              쇼핑몰 설정
            </h1>
            <p className="mt-2 text-gray-600">자체 쇼핑몰 운영을 위한 기본 설정을 관리합니다</p>
          </div>
          <button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                저장 중...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                설정 저장
              </>
            )}
          </button>
        </div>
      </div>

      {/* Basic Settings */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-gray-600" />
          기본 설정
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              쇼핑몰 이름
            </label>
            <input
              type="text"
              value={settings.shopName}
              onChange={(e) => handleInputChange('shopName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="쇼핑몰 이름을 입력하세요"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              쇼핑몰 URL
            </label>
            <input
              type="url"
              value={settings.shopUrl}
              onChange={(e) => handleInputChange('shopUrl', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              쇼핑몰 설명
            </label>
            <textarea
              value={settings.shopDescription}
              onChange={(e) => handleInputChange('shopDescription', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="쇼핑몰 소개 문구를 입력하세요"
            />
          </div>
        </div>
      </div>

      {/* Banner Images Settings */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Image className="w-5 h-5 text-gray-600" />
          배너 이미지 설정
        </h2>
        <div className="space-y-6">
          {settings.bannerImages.map((banner, index) => (
            <div key={banner.id} className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">배너 {index + 1}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    배너 이미지
                  </label>
                  <div className="space-y-3">
                    {/* 이미지 업로드 버튼 */}
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor={`banner-upload-${index}`}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors text-sm"
                      >
                        <Upload className="w-4 h-4" />
                        이미지 업로드
                      </label>
                      <input
                        id={`banner-upload-${index}`}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileSelect(index, e)}
                        className="hidden"
                      />
                      {banner.url && (
                        <button
                          onClick={() => handleBannerUpdate(index, 'url', '')}
                          className="inline-flex items-center gap-1 px-2 py-1 text-red-600 hover:bg-red-50 rounded transition-colors text-sm"
                          title="이미지 제거"
                        >
                          <X className="w-3 h-3" />
                          제거
                        </button>
                      )}
                    </div>

                    {/* URL 직접 입력 옵션 */}
                    <div>
                      <input
                        type="url"
                        value={banner.url}
                        onChange={(e) => handleBannerUpdate(index, 'url', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="또는 이미지 URL을 직접 입력하세요"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    링크 URL
                  </label>
                  <input
                    type="url"
                    value={banner.link}
                    onChange={(e) => handleBannerUpdate(index, 'link', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://example.com/sale"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    배너 제목
                  </label>
                  <input
                    type="text"
                    value={banner.title}
                    onChange={(e) => handleBannerUpdate(index, 'title', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="배너 제목"
                  />
                </div>
              </div>
              {banner.url && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-500">미리보기:</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">쇼핑몰 상단 사이즈 (가로:세로 = 5:2)</span>
                      <button
                        onClick={() => handleBannerResize(index)}
                        className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                        title="이미지를 쇼핑몰 배너 최적 사이즈로 조정"
                      >
                        사이즈 맞추기
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {/* 쇼핑몰 상단 비율 미리보기 */}
                    <div className="bg-gray-50 p-2 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">쇼핑몰 상단 배너 비율 (5:2)</p>
                      <img
                        src={banner.url}
                        alt={`${banner.title} - 쇼핑몰 배너 비율`}
                        className="w-full h-24 object-cover rounded border bg-white"
                        style={{ aspectRatio: '5/2' }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0zNSA2NUw1MCA0NUw2NSA2NUgzNVoiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+'
                        }}
                      />
                    </div>

                    {/* 원본 이미지 미리보기 */}
                    <div className="bg-gray-50 p-2 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">원본 이미지</p>
                      <img
                        src={banner.url}
                        alt={banner.title}
                        className="w-full h-32 object-cover rounded border bg-white"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0zNSA2NUw1MCA0NUw2NSA2NUgzNVoiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Category Management */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Package className="w-5 h-5 text-gray-600" />
              카테고리 관리
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              드래그하여 카테고리 순서를 변경할 수 있습니다
            </p>
          </div>
          <button
            onClick={handleAddCategory}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            카테고리 추가
          </button>
        </div>
        <div className="space-y-3">
          {settings.categories.map((category) => {
            const isDraggedOver = draggedOver === category.id
            const isDragging = draggedCategory === category.id
            return (
            <div
              key={category.id}
              className={`flex items-center gap-4 p-3 border border-gray-200 rounded-lg transition-all cursor-move ${
                isDraggedOver ? 'border-t-2 border-blue-500 bg-blue-50' : ''
              } ${isDragging ? 'opacity-50' : ''}`}
              draggable
              onDragStart={(e) => handleCategoryDragStart(e, category.id)}
              onDragOver={(e) => handleCategoryDragOver(e, category.id)}
              onDragLeave={handleCategoryDragLeave}
              onDrop={(e) => handleCategoryDrop(e, category.id)}
            >
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
              </div>
              <div className="flex items-center gap-3 flex-1">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={category.enabled}
                    onChange={(e) => handleCategoryUpdate(category.id, 'enabled', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600">사용</span>
                </label>
                <div className={`w-8 h-8 ${category.color} rounded-full flex items-center justify-center text-lg`}>
                  {category.icon}
                </div>
                <input
                  type="text"
                  value={category.name}
                  onChange={(e) => handleCategoryUpdate(category.id, 'name', e.target.value)}
                  className="flex-1 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="text"
                  value={category.icon}
                  onChange={(e) => handleCategoryUpdate(category.id, 'icon', e.target.value)}
                  className="w-16 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
                  placeholder="이모지"
                />
                <select
                  value={category.color}
                  onChange={(e) => handleCategoryUpdate(category.id, 'color', e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="bg-red-50">빨강</option>
                  <option value="bg-blue-50">파랑</option>
                  <option value="bg-green-50">초록</option>
                  <option value="bg-yellow-50">노랑</option>
                  <option value="bg-purple-50">보라</option>
                  <option value="bg-pink-50">분홍</option>
                  <option value="bg-orange-50">주황</option>
                  <option value="bg-gray-50">회색</option>
                </select>
              </div>
              {/* 순서 이동 버튼들 */}
              <div className="flex items-center gap-1">
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => moveCategoryToTop(category.id)}
                    disabled={settings.categories.findIndex(cat => cat.id === category.id) === 0}
                    className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="최상단으로 이동"
                  >
                    <ChevronsUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => moveCategoryUp(category.id)}
                    disabled={settings.categories.findIndex(cat => cat.id === category.id) === 0}
                    className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="위로 이동"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => moveCategoryDown(category.id)}
                    disabled={settings.categories.findIndex(cat => cat.id === category.id) === settings.categories.length - 1}
                    className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="아래로 이동"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => moveCategoryToBottom(category.id)}
                    disabled={settings.categories.findIndex(cat => cat.id === category.id) === settings.categories.length - 1}
                    className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="최하단으로 이동"
                  >
                    <ChevronsDown className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <button
                onClick={() => handleDeleteCategory(category.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                title="카테고리 삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            )
          })}
        </div>
      </div>

      {/* Section Display Settings */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">섹션 표시 설정</h2>
        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.showTimeSale}
              onChange={(e) => handleInputChange('showTimeSale', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">
                타임특가 섹션 표시
              </span>
              <p className="text-xs text-gray-500">
                스토어 메인페이지에 빨간색 타임특가 섹션을 표시합니다
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.showBestProducts}
              onChange={(e) => handleInputChange('showBestProducts', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">
                베스트 상품 섹션 표시
              </span>
              <p className="text-xs text-gray-500">
                스토어 메인페이지에 베스트 상품 섹션을 표시합니다
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Payment Settings */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-gray-600" />
          결제 설정 (토스페이먼츠)
        </h2>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">토스페이먼츠 결제위젯 연동 안내</p>
              <p className="mb-2">토스페이먼츠 대시보드에서 <strong>결제위젯 API 키</strong>를 발급받아 입력해주세요.</p>
              <div className="text-xs bg-blue-100 rounded p-2 mb-2">
                <p><strong>Client Key:</strong> test_gck_로 시작 (테스트) / live_gck_로 시작 (실제)</p>
                <p><strong>Secret Key:</strong> test_gsk_로 시작 (테스트) / live_gsk_로 시작 (실제)</p>
              </div>
              <a
                href="https://developers.tosspayments.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline mt-1 inline-block"
              >
                토스페이먼츠 개발자센터 →
              </a>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              결제 게이트웨이
            </label>
            <select
              value={settings.paymentGateway}
              onChange={(e) => handleInputChange('paymentGateway', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="toss">토스페이먼츠</option>
              <option value="none">사용안함</option>
            </select>
          </div>

          {settings.paymentGateway === 'toss' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  결제위젯 Client Key <span className="text-xs text-gray-500">(test_gck_ / live_gck_)</span>
                </label>
                <input
                  type="text"
                  value={settings.tossClientKey}
                  onChange={(e) => handleInputChange('tossClientKey', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  placeholder="test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  결제위젯 Secret Key <span className="text-xs text-gray-500">(test_gsk_ / live_gsk_)</span>
                </label>
                <div className="relative">
                  <input
                    type={showSecretKey ? "text" : "password"}
                    value={settings.tossSecretKey}
                    onChange={(e) => handleInputChange('tossSecretKey', e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    placeholder="test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecretKey(!showSecretKey)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    title={showSecretKey ? "비밀번호 숨기기" : "비밀번호 보기"}
                  >
                    {showSecretKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <button
                  onClick={handleTestConnection}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  연결 테스트
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Shipping Settings */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-gray-600" />
          배송 설정
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                기본 배송비
              </label>
              <input
                type="number"
                value={settings.defaultShippingFee}
                onChange={(e) => handleInputChange('defaultShippingFee', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="3000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                무료배송 기준금액
              </label>
              <input
                type="number"
                value={settings.freeShippingAmount}
                onChange={(e) => handleInputChange('freeShippingAmount', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="50000"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              배송 정책 설명
            </label>
            <input
              type="text"
              value={settings.shippingPolicy}
              onChange={(e) => handleInputChange('shippingPolicy', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="50,000원 이상 무료배송"
            />
          </div>
        </div>
      </div>

      {/* Margin Settings */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">마진 설정</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                기본 마진 방식
              </label>
              <select
                value={settings.defaultMarginType}
                onChange={(e) => handleInputChange('defaultMarginType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="percentage">퍼센트(%)</option>
                <option value="fixed">고정금액(원)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                기본 마진 값
              </label>
              <input
                type="number"
                value={settings.defaultMarginValue}
                onChange={(e) => handleInputChange('defaultMarginValue', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={settings.defaultMarginType === 'percentage' ? '30' : '5000'}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Automation Settings */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">자동화 설정</h2>
        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.autoPublish}
              onChange={(e) => handleInputChange('autoPublish', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">
                상품 자동 게시
              </span>
              <p className="text-xs text-gray-500">
                소싱 확정된 상품을 자동으로 쇼핑몰에 게시합니다
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.autoUpdateStock}
              onChange={(e) => handleInputChange('autoUpdateStock', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">
                재고 자동 업데이트
              </span>
              <p className="text-xs text-gray-500">
                도매처의 재고 정보를 자동으로 동기화합니다
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.autoUpdatePrice}
              onChange={(e) => handleInputChange('autoUpdatePrice', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">
                가격 자동 업데이트
              </span>
              <p className="text-xs text-gray-500">
                도매처의 가격 변동을 자동으로 반영합니다
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Test Result */}
      {testResult && (
        <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <h3 className={`font-semibold ${testResult.success ? 'text-green-900' : 'text-red-900'}`}>
            연결 테스트 결과
          </h3>
          <p className={`mt-1 text-sm ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
            {testResult.message || (testResult.success ? '정상적으로 연결되었습니다.' : '연결에 실패했습니다.')}
          </p>
        </div>
      )}
    </div>
  )
}
