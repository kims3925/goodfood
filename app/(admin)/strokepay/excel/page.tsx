'use client'

import { useState, useEffect } from 'react'
import { FileSpreadsheet, Download, Check, AlertCircle, RefreshCw, Database } from 'lucide-react'

export default function StrokePayExcelPage() {
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedFile, setGeneratedFile] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 컴포넌트 마운트 시 상품 데이터 로드
  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    try {
      // 실제로는 API에서 AI 처리 완료된 상품들을 가져옴
      // 임시 데이터 사용
      const mockProducts = [
        {
          id: '1',
          title: '프리미엄 한우 세트 1++ 등급',
          originalPrice: 50000,
          salePrice: 65000,
          category: '식품>육류',
          status: 'ai_completed',
          hasImage: true,
          images: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
          aiContent: '최고급 1++ 한우로 구성된 프리미엄 선물세트입니다. 엄선된 한우만을 사용하여 최상의 맛을 보장합니다.',
          summary: '명절 선물로 최고! 1++ 한우 세트',
          stock: 50,
          shippingType: '무료배송',
          shippingFee: 0,
          hasOptions: true,
          options: [
            { name: '1kg 세트', supplyPrice: 50000, salePrice: 65000 },
            { name: '2kg 세트', supplyPrice: 95000, salePrice: 125000 },
          ]
        },
        {
          id: '2',
          title: '유기농 과일 선물세트',
          originalPrice: 30000,
          salePrice: 39000,
          category: '식품>과일',
          status: 'ai_completed',
          hasImage: true,
          images: ['https://example.com/fruit1.jpg'],
          aiContent: '100% 유기농 인증을 받은 신선한 과일로 구성된 건강한 선물세트입니다.',
          summary: '건강한 유기농 과일 모음',
          stock: 100,
          shippingType: '유료배송',
          shippingFee: 3000,
          hasOptions: false,
          options: []
        },
        {
          id: '3',
          title: '수제 마카롱 세트',
          originalPrice: 25000,
          salePrice: 32000,
          category: '식품>디저트',
          status: 'ai_completed',
          hasImage: true,
          images: ['https://example.com/macaron1.jpg', 'https://example.com/macaron2.jpg', 'https://example.com/macaron3.jpg'],
          aiContent: '파티시에가 직접 만든 수제 마카롱 12구 세트. 다양한 맛으로 구성되어 있습니다.',
          summary: '달콤한 수제 마카롱 12구',
          stock: 30,
          shippingType: '조건부무료',
          shippingFee: 3000,
          hasOptions: true,
          options: [
            { name: '12구 세트', supplyPrice: 25000, salePrice: 32000 },
            { name: '24구 세트', supplyPrice: 48000, salePrice: 60000 },
          ]
        },
      ]
      
      setProducts(mockProducts)
      setIsLoading(false)
    } catch (error) {
      console.error('Failed to load products:', error)
      setIsLoading(false)
    }
  }

  const handleSelectAll = () => {
    if (selectedProducts.length === products.length) {
      setSelectedProducts([])
    } else {
      setSelectedProducts(products.map(p => p.id))
    }
  }

  const handleSelectProduct = (productId: string) => {
    if (selectedProducts.includes(productId)) {
      setSelectedProducts(prev => prev.filter(id => id !== productId))
    } else {
      setSelectedProducts(prev => [...prev, productId])
    }
  }

  const handleGenerateExcel = async () => {
    if (selectedProducts.length === 0) return

    setIsGenerating(true)
    
    try {
      // 선택된 상품들 필터링
      const selectedProductData = products.filter(p => selectedProducts.includes(p.id))
      
      // API 호출하여 엑셀 생성
      const response = await fetch('/api/strokepay/excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ products: selectedProductData })
      })

      const result = await response.json()

      if (result.success) {
        setGeneratedFile(result)
      } else {
        alert('엑셀 생성에 실패했습니다.')
      }
    } catch (error) {
      console.error('Excel generation error:', error)
      alert('엑셀 생성 중 오류가 발생했습니다.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = () => {
    if (generatedFile && generatedFile.downloadUrl) {
      // 파일 다운로드
      const link = document.createElement('a')
      link.href = generatedFile.downloadUrl
      link.download = generatedFile.fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
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
              <FileSpreadsheet className="w-6 h-6 text-blue-600" />
              스룩페이 엑셀 생성
            </h1>
            <p className="mt-2 text-gray-600">AI 처리가 완료된 상품을 선택하여 스룩페이 대량등록용 엑셀을 생성합니다</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadProducts}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Database className="w-4 h-4" />
              새로고침
            </button>
            <button
              onClick={handleSelectAll}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {selectedProducts.length === products.length ? '전체 해제' : '전체 선택'}
            </button>
            <button
              onClick={handleGenerateExcel}
              disabled={selectedProducts.length === 0 || isGenerating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  생성 중...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  엑셀 생성 ({selectedProducts.length}개)
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Excel Template Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">스룩페이 엑셀 양식 자동 매핑</p>
            <p>생성되는 엑셀 파일은 스룩페이 공식 양식에 맞춰 자동으로 포맷됩니다.</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="bg-white/70 rounded p-2">
                <p className="font-medium mb-1">기본 정보</p>
                <ul className="space-y-0.5 text-xs">
                  <li>• 순번, 카테고리</li>
                  <li>• 상품명, 요약정보</li>
                  <li>• 판매상태, 재고수량</li>
                  <li>• 공급가, 판매가</li>
                </ul>
              </div>
              <div className="bg-white/70 rounded p-2">
                <p className="font-medium mb-1">추가 정보</p>
                <ul className="space-y-0.5 text-xs">
                  <li>• 배송비 타입 및 금액</li>
                  <li>• 옵션 정보 (옵션명/공급가/판매가)</li>
                  <li>• 상품 이미지 URL (다중 지원)</li>
                  <li>• AI 생성 상세설명</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Generated File */}
      {generatedFile && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-semibold text-green-900">엑셀 파일 생성 완료!</p>
                <p className="text-sm text-green-700 mt-1">
                  {generatedFile.fileName} ({generatedFile.productCount}개 상품)
                </p>
              </div>
            </div>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              다운로드
            </button>
          </div>
        </div>
      )}

      {/* Product List */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold">AI 처리 완료 상품 ({products.length}개)</h2>
          <p className="text-sm text-gray-600 mt-1">엑셀에 포함할 상품을 선택하세요</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedProducts.length === products.length && products.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상품명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  카테고리
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  공급가
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  판매가
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  마진율
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  옵션/배송
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => {
                const marginRate = ((product.salePrice - product.originalPrice) / product.originalPrice * 100).toFixed(1)
                return (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.id)}
                        onChange={() => handleSelectProduct(product.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{product.title}</p>
                        <p className="text-xs text-gray-500 mt-1">{product.summary}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                        {product.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {product.originalPrice.toLocaleString()}원
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {product.salePrice.toLocaleString()}원
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="text-green-600 font-medium">+{marginRate}%</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {product.hasOptions && (
                          <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                            옵션 {product.options.length}개
                          </span>
                        )}
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          {product.shippingType}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                          AI 완료
                        </span>
                        {product.images && product.images.length > 0 && (
                          <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                            이미지 {product.images.length}개
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}