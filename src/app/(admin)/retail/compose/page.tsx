'use client'

import { useState } from 'react'
import { FileText, Image, Link2, Hash, Eye, Save, Send } from 'lucide-react'

export default function RetailComposePage() {
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [postContent, setPostContent] = useState({
    title: '',
    description: '',
    hashtags: '',
    paymentLink: '',
    images: [] as string[],
  })

  // 임시 데이터 - 결제링크가 있는 상품들
  const availableProducts = [
    {
      id: '1',
      name: '프리미엄 한우 세트',
      price: 65000,
      paymentLink: 'https://strk.pay/abc123',
      aiDescription: '최고급 1++ 한우로 구성된 프리미엄 선물세트입니다. 명절 선물이나 특별한 날에 어울리는 고급 상품입니다.',
      images: ['/api/placeholder/400/400'],
      hashtags: '#한우 #프리미엄 #선물세트 #명절선물',
    },
    {
      id: '2',
      name: '유기농 과일 선물세트',
      price: 39000,
      paymentLink: 'https://strk.pay/def456',
      aiDescription: '100% 유기농 인증을 받은 신선한 과일로 구성된 건강한 선물세트입니다.',
      images: ['/api/placeholder/400/400'],
      hashtags: '#유기농 #과일 #선물세트 #건강',
    },
  ]

  const handleProductSelect = (product: any) => {
    setSelectedProduct(product)
    setPostContent({
      title: `🎁 ${product.name} 특가 판매! 🎁`,
      description: product.aiDescription,
      hashtags: product.hashtags,
      paymentLink: product.paymentLink,
      images: product.images,
    })
  }

  const handleSaveDraft = () => {
    console.log('Draft saved:', postContent)
    alert('초안이 저장되었습니다.')
  }

  const handlePublish = () => {
    console.log('Publishing:', postContent)
    alert('소매밴드에 발행을 시작합니다.')
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-purple-600" />
          소매밴드 포스팅 작성
        </h1>
        <p className="mt-2 text-gray-600">결제링크가 포함된 상품 포스팅을 작성하고 소매밴드에 발행합니다</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Product Selection and Editor */}
        <div className="space-y-6">
          {/* Product Selection */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">상품 선택</h2>
            <div className="space-y-3">
              {availableProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => handleProductSelect(product)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    selectedProduct?.id === product.id
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {product.price.toLocaleString()}원
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                        링크 준비
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Post Editor */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">포스팅 내용</h2>
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  제목
                </label>
                <input
                  type="text"
                  value={postContent.title}
                  onChange={(e) => setPostContent({ ...postContent, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="눈길을 끄는 제목을 작성하세요"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  상품 설명
                </label>
                <textarea
                  value={postContent.description}
                  onChange={(e) => setPostContent({ ...postContent, description: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="상품의 매력적인 설명을 작성하세요"
                />
              </div>

              {/* Payment Link */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  결제 링크
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={postContent.paymentLink}
                    onChange={(e) => setPostContent({ ...postContent, paymentLink: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    placeholder="결제 링크"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(postContent.paymentLink)}
                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    복사
                  </button>
                </div>
              </div>

              {/* Hashtags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  해시태그
                </label>
                <input
                  type="text"
                  value={postContent.hashtags}
                  onChange={(e) => setPostContent({ ...postContent, hashtags: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="#상품 #특가 #한정판매"
                />
              </div>

              {/* Images */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  이미지 ({postContent.images.length}개)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {postContent.images.map((image, index) => (
                    <div key={index} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                      <img src={image} alt={`상품 이미지 ${index + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                  <button className="aspect-square border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors flex items-center justify-center">
                    <span className="text-gray-400">+</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="space-y-6">
          {/* Preview */}
          <div className="bg-white rounded-lg shadow-sm p-6 sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Eye className="w-5 h-5" />
                미리보기
              </h2>
              <span className="text-xs text-gray-500">밴드 포스트 형식</span>
            </div>

            {/* Band Post Preview */}
            <div className="border border-gray-200 rounded-lg p-4">
              {/* Post Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 font-semibold">판매</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">BandAuto Shop</p>
                  <p className="text-xs text-gray-500">방금 전</p>
                </div>
              </div>

              {/* Post Content */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900">{postContent.title || '제목을 입력하세요'}</h3>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {postContent.description || '상품 설명을 입력하세요'}
                </p>

                {/* Payment Button */}
                {postContent.paymentLink && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <p className="text-sm text-purple-900 mb-2">💳 간편 결제하기</p>
                    <a
                      href={postContent.paymentLink}
                      className="inline-block px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      구매하기
                    </a>
                  </div>
                )}

                {/* Images */}
                {postContent.images.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {postContent.images.map((image, index) => (
                      <img
                        key={index}
                        src={image}
                        alt={`상품 이미지 ${index + 1}`}
                        className="w-full rounded-lg"
                      />
                    ))}
                  </div>
                )}

                {/* Hashtags */}
                {postContent.hashtags && (
                  <p className="text-blue-600 text-sm">{postContent.hashtags}</p>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex gap-3">
              <button
                onClick={handleSaveDraft}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                초안 저장
              </button>
              <button
                onClick={handlePublish}
                disabled={!selectedProduct}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                밴드에 발행
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}