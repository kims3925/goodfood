'use client'

import { useState, useEffect } from 'react'
import { Link2, Copy, ExternalLink, Search, Filter, CheckCircle, Clock, XCircle, RefreshCw, Globe } from 'lucide-react'

export default function PaymentLinksPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'used' | 'expired'>('all')
  const [paymentLinks, setPaymentLinks] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)

  useEffect(() => {
    loadPaymentLinks()
  }, [])

  const loadPaymentLinks = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/strokepay/links')
      const data = await response.json()
      
      if (data.success) {
        setPaymentLinks(data.links || [])
        setLastSync(new Date())
      } else {
        // 에러 시 임시 데이터 사용
        setPaymentLinks(getMockData())
      }
    } catch (error) {
      console.error('Failed to load payment links:', error)
      // 에러 시 임시 데이터 사용
      setPaymentLinks(getMockData())
    } finally {
      setIsLoading(false)
    }
  }

  const getMockData = () => [
    {
      id: '1',
      productName: '프리미엄 한우 세트',
      productCode: 'SP-2025-001',
      link: 'https://strokepay.com/pay/abc123',
      shortLink: 'strk.pay/abc123',
      price: 65000,
      status: 'active',
      createdAt: '2025-01-19 10:30',
      usedCount: 3,
      maxUse: 10,
      expiresAt: '2025-02-19',
    },
    {
      id: '2',
      productName: '유기농 과일 선물세트',
      productCode: 'SP-2025-002',
      link: 'https://strokepay.com/pay/def456',
      shortLink: 'strk.pay/def456',
      price: 39000,
      status: 'active',
      createdAt: '2025-01-19 11:00',
      usedCount: 5,
      maxUse: 20,
      expiresAt: '2025-02-19',
    },
  ]

  const syncWithStrokePay = async () => {
    setIsLoading(true)
    try {
      // 스룩페이와 동기화
      await loadPaymentLinks()
      alert('스룩페이와 동기화되었습니다.')
    } catch (error) {
      console.error('Sync error:', error)
      alert('동기화 중 오류가 발생했습니다.')
    }
  }

  const copyToClipboard = (text: string, isShort: boolean = false) => {
    navigator.clipboard.writeText(text)
    
    // 토스트 메시지 표시
    const message = document.createElement('div')
    message.className = 'fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50'
    message.textContent = `${isShort ? '단축 ' : ''}링크가 복사되었습니다!`
    document.body.appendChild(message)
    setTimeout(() => message.remove(), 2000)
  }

  const openStrokePay = () => {
    window.open('https://srookpay.com/newsrp/Main/Index', '_blank')
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            활성
          </span>
        )
      case 'used':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3" />
            사용완료
          </span>
        )
      case 'expired':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            만료
          </span>
        )
      default:
        return null
    }
  }

  const filteredLinks = paymentLinks.filter(link => {
    const matchesSearch = link.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          link.productCode.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filterStatus === 'all' || link.status === filterStatus
    return matchesSearch && matchesFilter
  })

  const stats = {
    total: paymentLinks.length,
    active: paymentLinks.filter(l => l.status === 'active').length,
    used: paymentLinks.filter(l => l.status === 'used').length,
    expired: paymentLinks.filter(l => l.status === 'expired').length,
  }

  const createPaymentLinkText = (link: any) => {
    return `🎁 ${link.productName}\n💰 ${link.price.toLocaleString()}원\n🔗 결제링크: ${link.shortLink}\n\n지금 바로 구매하세요!`
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Link2 className="w-6 h-6 text-blue-600" />
              결제 링크 관리
            </h1>
            <p className="mt-2 text-gray-600">스룩페이에서 생성된 결제 링크를 관리하고 소매밴드 포스팅에 활용합니다</p>
          </div>
          <div className="flex items-center gap-2">
            {lastSync && (
              <span className="text-xs text-gray-500">
                마지막 동기화: {lastSync.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={syncWithStrokePay}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  동기화 중...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  스룩페이 동기화
                </>
              )}
            </button>
            <button
              onClick={openStrokePay}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Globe className="w-4 h-4" />
              스룩페이 열기
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">전체 링크</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="p-3 bg-gray-100 rounded-full">
              <Link2 className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">활성 링크</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">사용완료</p>
              <p className="text-2xl font-bold text-blue-600">{stats.used}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">만료</p>
              <p className="text-2xl font-bold text-gray-600">{stats.expired}</p>
            </div>
            <div className="p-3 bg-gray-100 rounded-full">
              <XCircle className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="상품명 또는 코드로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterStatus === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              전체 ({stats.total})
            </button>
            <button
              onClick={() => setFilterStatus('active')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterStatus === 'active'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              활성 ({stats.active})
            </button>
            <button
              onClick={() => setFilterStatus('used')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterStatus === 'used'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              사용완료 ({stats.used})
            </button>
            <button
              onClick={() => setFilterStatus('expired')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterStatus === 'expired'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              만료 ({stats.expired})
            </button>
          </div>
        </div>
      </div>

      {/* Payment Links Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상품정보
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    결제링크
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    가격
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    사용현황
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    만료일
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    액션
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLinks.length > 0 ? (
                  filteredLinks.map((link) => (
                    <tr key={link.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{link.productName}</p>
                          <p className="text-xs text-gray-500">{link.productCode}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="text-sm text-gray-900 font-mono">{link.shortLink}</p>
                          <p className="text-xs text-gray-500 truncate max-w-xs">{link.link}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">
                          {link.price.toLocaleString()}원
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${(link.usedCount / link.maxUse) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-600 whitespace-nowrap">
                            {link.usedCount}/{link.maxUse}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(link.status)}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600">{link.expiresAt}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => copyToClipboard(link.shortLink, true)}
                            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                            title="단축링크 복사"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => copyToClipboard(createPaymentLinkText(link))}
                            className="p-1.5 text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded transition-colors"
                            title="포스팅용 텍스트 복사"
                          >
                            <Link2 className="w-4 h-4" />
                          </button>
                          <a
                            href={link.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                            title="링크 열기"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <p className="text-gray-500">
                        {searchQuery || filterStatus !== 'all' 
                          ? '검색 결과가 없습니다.' 
                          : '결제 링크가 없습니다. 상품을 업로드하여 링크를 생성하세요.'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Copy Section */}
      {filteredLinks.filter(l => l.status === 'active').length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">빠른 복사</h3>
          <p className="text-sm text-gray-600 mb-4">활성 상태의 결제 링크를 빠르게 복사하여 소매밴드에 포스팅하세요</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredLinks
              .filter(l => l.status === 'active')
              .slice(0, 4)
              .map((link) => (
                <div key={link.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-400 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{link.productName}</p>
                      <p className="text-sm text-gray-600 mt-1">{link.price.toLocaleString()}원</p>
                      <p className="text-xs text-gray-500 mt-2 font-mono">{link.shortLink}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(createPaymentLinkText(link))}
                      className="ml-2 px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      복사
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}