'use client'

import { useState, useEffect } from 'react'
import { Loader2, FileText } from 'lucide-react'
import { useShop } from '@/contexts/ShopContext'
import { useShopUrl } from '@/hooks/useShopUrl'

interface Policy {
  id: number
  name: string
  content: string
  main: number
  sub: number
  updatedAt?: string
}

export default function TermsPage() {
  const { shop } = useShop()
  const { getApiPath } = useShopUrl()
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [loading, setLoading] = useState(true)

  const primaryColor = shop?.theme?.primaryColor || '#FF6B6B'

  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        const response = await fetch(getApiPath('/api/policies'))
        const data = await response.json()

        if (data.success && data.terms) {
          setPolicy(data.terms)
        }
      } catch (error) {
        console.error('Failed to fetch terms policy:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPolicy()
  }, [getApiPath])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: primaryColor }} />
      </div>
    )
  }

  return (
    <div className="bg-gray-50 flex-1">
      <div className="kurly-container py-8 md:py-12">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-8 h-8" style={{ color: primaryColor }} />
          <h1 className="text-2xl md:text-3xl font-bold">이용약관</h1>
        </div>

        {/* 내용 */}
        <div className="bg-white rounded-lg shadow-sm p-6 md:p-8">
          {policy ? (
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                {policy.content}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>등록된 이용약관이 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
