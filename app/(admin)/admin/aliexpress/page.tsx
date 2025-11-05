'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Edit3, Trash2, Package, RefreshCw, DollarSign, TrendingUp, Globe } from 'lucide-react'
import Link from 'next/link'

interface AliExpressSourcing {
  id: string
  searchType: string
  searchValue: string
  pricingPolicy?: string | null
  collectReviews: boolean
  createdAt: string
  productCount?: number
}

export default function AliExpressPage() {
  const [sourcings, setSourcings] = useState<AliExpressSourcing[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [isCollecting, setIsCollecting] = useState<string | null>(null)

  // 모달 폼 상태
  const [formData, setFormData] = useState({
    searchType: 'keyword',
    searchValue: '',
    pricingPolicy: '환율 1300원, 배송비 0원, 관세 0%, 30% 마진',
    collectReviews: false
  })

  useEffect(() => {
    loadSourcings()
  }, [])

  const loadSourcings = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/aliexpress/sourcings')
      const data = await response.json()

      if (data.success) {
        setSourcings(data.sourcings || [])
      } else {
        console.error('소싱 설정 로드 실패:', data.error)
        setSourcings([])
      }
    } catch (error) {
      console.error('소싱 설정 로드 실패:', error)
      setSourcings([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddSourcing = async () => {
    if (!formData.searchValue.trim()) {
      alert('검색어 또는 카테고리 ID를 입력하세요.')
      return
    }

    try {
      const response = await fetch('/api/aliexpress/sourcings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.success) {
        alert('✅ AliExpress 소싱 설정이 생성되었습니다!')
        setShowAddModal(false)
        setFormData({
          searchType: 'keyword',
          searchValue: '',
          pricingPolicy: '환율 1300원, 배송비 0원, 관세 0%, 30% 마진',
          collectReviews: false
        })
        loadSourcings()
      } else {
        alert(`❌ 오류: ${data.error}`)
      }
    } catch (error) {
      console.error('소싱 설정 생성 실패:', error)
      alert('❌ 소싱 설정 생성 중 오류가 발생했습니다.')
    }
  }

  const handleCollect = async (sourcing: AliExpressSourcing) => {
    if (isCollecting) {
      alert('⏳ 다른 소싱이 진행 중입니다. 잠시 후 다시 시도하세요.')
      return
    }

    const confirmMsg = `"${sourcing.searchValue}" 키워드로 AliExpress 상품을 수집하시겠습니까?`
    if (!confirm(confirmMsg)) return

    setIsCollecting(sourcing.id)

    try {
      const response = await fetch('/api/aliexpress/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcingId: sourcing.id,
          keyword: sourcing.searchValue,
          maxProducts: 20
        })
      })

      const data = await response.json()

      if (data.success) {
        alert(`✅ ${data.message}\n\n총 발견: ${data.totalFound}개\n새로 저장: ${data.newPosts}개\n중복 제거: ${data.duplicatesRemoved}개\n환율: ${data.exchangeRate} KRW/USD`)
        loadSourcings()
      } else {
        alert(`❌ 오류: ${data.error}\n\n${data.detail || ''}`)
      }
    } catch (error) {
      console.error('AliExpress 수집 실패:', error)
      alert('❌ 상품 수집 중 오류가 발생했습니다.')
    } finally {
      setIsCollecting(null)
    }
  }

  const handleDelete = async (sourcing: AliExpressSourcing) => {
    const confirmMsg = `"${sourcing.searchValue}" 소싱 설정을 삭제하시겠습니까?\n\n⚠️ 연결된 상품 ${sourcing.productCount || 0}개도 함께 삭제됩니다.`
    if (!confirm(confirmMsg)) return

    try {
      const response = await fetch(`/api/aliexpress/sourcings/${sourcing.id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        alert(`✅ ${data.message}`)
        loadSourcings()
      } else {
        alert(`❌ 오류: ${data.error}`)
      }
    } catch (error) {
      console.error('소싱 설정 삭제 실패:', error)
      alert('❌ 삭제 중 오류가 발생했습니다.')
    }
  }

  // 필터링된 소싱 목록
  const filteredSourcings = sourcings.filter(sourcing =>
    sourcing.searchValue.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <Globe className="w-8 h-8 text-orange-500" />
              AliExpress 소싱 관리
            </h1>
            <p className="text-gray-600 mt-2">글로벌 도매 플랫폼 AliExpress에서 상품을 자동 수집하고 관리합니다.</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors shadow-md"
          >
            <Plus className="w-5 h-5" />
            새 소싱 추가
          </button>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">총 소싱 설정</p>
                <p className="text-2xl font-bold text-gray-800">{sourcings.length}</p>
              </div>
              <Package className="w-8 h-8 text-orange-500" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">수집된 상품</p>
                <p className="text-2xl font-bold text-gray-800">
                  {sourcings.reduce((sum, s) => sum + (s.productCount || 0), 0)}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">활성 소싱</p>
                <p className="text-2xl font-bold text-gray-800">
                  {sourcings.filter(s => (s.productCount || 0) > 0).length}
                </p>
              </div>
              <RefreshCw className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">평균 상품/소싱</p>
                <p className="text-2xl font-bold text-gray-800">
                  {sourcings.length > 0
                    ? Math.round(sourcings.reduce((sum, s) => sum + (s.productCount || 0), 0) / sourcings.length)
                    : 0
                  }
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* 검색바 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="소싱 검색 (키워드, 카테고리...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* 소싱 목록 테이블 */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" />
            로딩 중...
          </div>
        ) : filteredSourcings.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            {searchTerm ? '검색 결과가 없습니다.' : 'AliExpress 소싱 설정이 없습니다. 새로 추가해보세요!'}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">검색 타입</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">검색값</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">수집 상품</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">가격정책</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">리뷰 수집</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">등록일</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredSourcings.map((sourcing) => (
                <tr key={sourcing.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-700">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      sourcing.searchType === 'keyword'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {sourcing.searchType === 'keyword' ? '키워드' : '카테고리'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">
                    {sourcing.searchValue}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    <Link
                      href={`/admin/aliexpress/products?sourcingId=${sourcing.id}`}
                      className="text-orange-600 hover:text-orange-700 font-medium"
                    >
                      {sourcing.productCount || 0}개
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {sourcing.pricingPolicy
                      ? <span className="text-xs text-gray-600">{sourcing.pricingPolicy.slice(0, 30)}...</span>
                      : <span className="text-gray-400">-</span>
                    }
                  </td>
                  <td className="px-6 py-4 text-sm text-center">
                    {sourcing.collectReviews
                      ? <span className="text-green-600 font-medium">O</span>
                      : <span className="text-gray-400">X</span>
                    }
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(sourcing.createdAt).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleCollect(sourcing)}
                        disabled={isCollecting === sourcing.id}
                        className={`p-2 rounded-lg transition-colors ${
                          isCollecting === sourcing.id
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                        }`}
                        title="상품 수집"
                      >
                        {isCollecting === sourcing.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Package className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(sourcing)}
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                        title="삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-xl w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">새 AliExpress 소싱 추가</h2>
              <p className="text-sm text-gray-600 mt-1">키워드 또는 카테고리 ID로 상품을 수집합니다.</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  검색 타입 *
                </label>
                <select
                  value={formData.searchType}
                  onChange={(e) => setFormData({ ...formData, searchType: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="keyword">키워드 검색</option>
                  <option value="category">카테고리 ID</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {formData.searchType === 'keyword' ? '검색 키워드' : '카테고리 ID'} *
                </label>
                <input
                  type="text"
                  value={formData.searchValue}
                  onChange={(e) => setFormData({ ...formData, searchValue: e.target.value })}
                  placeholder={formData.searchType === 'keyword' ? '예: wireless earbuds' : '예: 509'}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  가격정책 (선택사항)
                </label>
                <textarea
                  value={formData.pricingPolicy}
                  onChange={(e) => setFormData({ ...formData, pricingPolicy: e.target.value })}
                  placeholder="예: 환율 1300원, 배송비 0원, 관세 5%, 30% 마진"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 h-24"
                />
                <p className="text-xs text-gray-500 mt-1">
                  AI가 자동으로 해석합니다. 환율, 배송비, 관세율, 마진율을 자유롭게 입력하세요.
                </p>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="collectReviews"
                  checked={formData.collectReviews}
                  onChange={(e) => setFormData({ ...formData, collectReviews: e.target.checked })}
                  className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500"
                />
                <label htmlFor="collectReviews" className="ml-2 text-sm text-gray-700">
                  상품 리뷰도 함께 수집 (선택사항)
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleAddSourcing}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
