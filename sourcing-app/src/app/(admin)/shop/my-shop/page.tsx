'use client'

import { useState, useEffect } from 'react'
import { ExternalLink, Store, Loader2 } from 'lucide-react'

interface Shop {
  id: number
  name: string
  subdomain: string
  isActive: boolean
}

export default function MyShopPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/shop')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setShops(data.data || [])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const shopBaseUrl = process.env.NEXT_PUBLIC_SHOP_BASE_URL || 'https://shop.abcpharm.net'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (shops.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <Store className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-700 mb-2">등록된 쇼핑몰이 없습니다</h2>
        <p className="text-gray-500 mb-4">쇼핑몰 관리에서 쇼핑몰을 먼저 등록해주세요.</p>
        <a href="/shop/store/list" className="text-blue-600 hover:underline text-sm">
          쇼핑몰 관리로 이동 →
        </a>
      </div>
    )
  }

  // 쇼핑몰이 1개면 바로 이동
  if (shops.length === 1) {
    const url = `${shopBaseUrl}/${shops[0].subdomain}`
    if (typeof window !== 'undefined') {
      window.open(url, '_blank')
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">내 쇼핑몰</h1>
        <p className="text-gray-500 text-sm mt-1">운영 중인 쇼핑몰을 선택하면 고객 화면으로 이동합니다.</p>
      </div>

      <div className="grid gap-4">
        {shops.map(shop => {
          const url = `${shopBaseUrl}/${shop.subdomain}`
          return (
            <a
              key={shop.id}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Store className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{shop.name}</h3>
                  <p className="text-sm text-gray-400">{url}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  shop.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {shop.isActive ? '운영중' : '비활성'}
                </span>
                <ExternalLink size={16} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}
