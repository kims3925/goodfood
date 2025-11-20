'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Edit3, Trash2, Copy, LogIn, RefreshCw, Eye, Package, Shield, Calendar } from 'lucide-react'

interface WholesaleBand {
  id: string
  name: string
  bandKey: string
  description?: string | null
  memberCount?: number | null
  isActive: boolean
  collectComments?: boolean
  createdAt: string
  updatedAt: string
}

export default function WholesalePage() {
  const [wholesaleBands, setWholesaleBands] = useState<WholesaleBand[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [isCollecting, setIsCollecting] = useState<string | null>(null)
  const [isBulkCollecting, setIsBulkCollecting] = useState(false)
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, currentBand: '' })
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' })
  const [showDateFilter, setShowDateFilter] = useState(false)

  // Load wholesale bands from API
  useEffect(() => {
    loadWholesaleBands()
  }, [])

  const loadWholesaleBands = async () => {
    try {
      setIsLoading(true)
      
      const response = await fetch('/api/wholesale/bands')
      const data = await response.json()
      
      if (data.success) {
        setWholesaleBands(data.bands || [])
      } else {
        console.error('도매 밴드 로드 실패:', data.error)
        setWholesaleBands([])
      }
      
    } catch (error) {
      console.error('도매 밴드 로드 실패:', error)
      setWholesaleBands([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleProductCollection = async (band: WholesaleBand) => {
    try {
      setIsCollecting(band.id)
      
      const response = await fetch('/api/wholesale/collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bandId: band.id
        })
      })

      const data = await response.json()
      
      if (data.success) {
        alert(`${data.message}\n총 ${data.totalFound}개 게시물 중 ${data.newPosts}개의 새로운 게시물을 수집했습니다.`)
        
        // 수집 완료 후 게시물 수집 페이지로 이동
        window.location.href = '/dashboard/wholesale/collect'
      } else if (data.needsSetup) {
        if (confirm('Band API 설정이 필요합니다. 설정 페이지로 이동하시겠습니까?')) {
          window.open('/dashboard/settings/band', '_blank')
        }
      } else {
        alert('상품 수집 실패: ' + data.error)
      }
    } catch (error) {
      console.error('상품 수집 오류:', error)
      alert('상품 수집 중 오류가 발생했습니다.')
    } finally {
      setIsCollecting(null)
    }
  }

  const handleCommentToggle = async (bandId: string, collectComments: boolean) => {
    try {
      const response = await fetch('/api/wholesale/bands/comment-toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bandId,
          collectComments
        })
      })

      const data = await response.json()
      
      if (data.success) {
        // Update local state
        setWholesaleBands(prev => 
          prev.map(band => 
            band.id === bandId 
              ? { ...band, collectComments }
              : band
          )
        )
      } else {
        alert('댓글 수집 설정 변경 실패: ' + data.error)
      }
    } catch (error) {
      console.error('댓글 수집 설정 변경 오류:', error)
      alert('댓글 수집 설정 변경 중 오류가 발생했습니다.')
    }
  }

  const handleProductMonitoring = async () => {
    if (!confirm('모든 처리된 상품의 상태를 확인하시겠습니까? 시간이 오래 걸릴 수 있습니다.')) {
      return
    }

    setIsMonitoring(true)

    try {
      const response = await fetch('/api/monitoring/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'schedule_all'
        })
      })

      const data = await response.json()

      if (data.success) {
        alert('상품 모니터링이 시작되었습니다. 백그라운드에서 진행됩니다.')
      } else {
        alert('상품 모니터링 시작 실패: ' + data.error)
      }

    } catch (error) {
      console.error('상품 모니터링 오류:', error)
      alert('상품 모니터링 중 오류가 발생했습니다.')
    } finally {
      setIsMonitoring(false)
    }
  }

  const handleBulkCollection = async () => {
    if (!confirm('전체 소싱처에 대한 상품 수집을 시작하시겠습니까? 시간이 오래 걸릴 수 있습니다.')) {
      return
    }

    setIsBulkCollecting(true)
    setBulkProgress({ current: 0, total: wholesaleBands.length, currentBand: '' })

    try {
      for (let i = 0; i < wholesaleBands.length; i++) {
        const band = wholesaleBands[i]
        setBulkProgress(prev => ({ 
          ...prev, 
          current: i + 1, 
          currentBand: band.name 
        }))

        const response = await fetch('/api/wholesale/collect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            bandId: band.id
          })
        })

        const data = await response.json()
        
        if (!data.success) {
          console.error(`밴드 ${band.name} 수집 실패:`, data.error)
        }

        // 각 밴드 간 1초 대기 (API 과부하 방지)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      alert(`전체 밴드 수집이 완료되었습니다!`)
      window.location.href = '/dashboard/wholesale/collect'

    } catch (error) {
      console.error('전체 수집 오류:', error)
      alert('전체 수집 중 오류가 발생했습니다.')
    } finally {
      setIsBulkCollecting(false)
      setBulkProgress({ current: 0, total: 0, currentBand: '' })
    }
  }

  const filteredBands = wholesaleBands.filter(band =>
    band.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    band.bandKey.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.ceil(filteredBands.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedBands = filteredBands.slice(startIndex, startIndex + itemsPerPage)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">도매 소싱 사이트 관리</h1>
          <p className="text-gray-600">도매 밴드, 쇼핑몰 등 상품을 가져올 소싱 사이트를 관리합니다.</p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              {/* Left side controls */}
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="flex items-center gap-2">
                  <select 
                    value={itemsPerPage} 
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={10}>1,000건</option>
                    <option value={20}>2,000건</option>
                    <option value={50}>5,000건</option>
                  </select>
                  <select className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option>전체</option>
                    <option>BAND</option>
                    <option>ALIEXPRESS</option>
                    <option>TAOBAO</option>
                    <option>AMAZON</option>
                  </select>
                </div>
                
                <div className="relative">
                  <input
                    type="text"
                    placeholder="검색어를 입력하세요"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="border border-gray-300 rounded-md pl-4 pr-10 py-2 text-sm w-64 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
                </div>
                
                <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  검색
                </button>
                
                {/* Date Filter Toggle */}
                <button 
                  onClick={() => setShowDateFilter(!showDateFilter)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2 ${
                    showDateFilter || (dateRange.startDate && dateRange.endDate)
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-gray-100 text-gray-700 border border-gray-300'
                  }`}
                >
                  <Calendar className="h-4 w-4" />
                  날짜 설정
                  {(dateRange.startDate && dateRange.endDate) && (
                    <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded">
                      설정됨
                    </span>
                  )}
                </button>
              </div>

              {/* Right side buttons */}
              <div className="flex gap-2">
                <button 
                  onClick={handleBulkCollection}
                  disabled={isBulkCollecting}
                  className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isBulkCollecting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      전체 수집 중...
                    </>
                  ) : (
                    <>
                      <Package className="h-4 w-4" />
                      전체 상품 수집
                    </>
                  )}
                </button>
                <button 
                  onClick={handleProductMonitoring}
                  disabled={isMonitoring}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isMonitoring ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      모니터링 중...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4" />
                      상품 상태 확인
                    </>
                  )}
                </button>
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  새 밴드 등록
                </button>
                <button className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  신규 소싱 사이트 추가
                </button>
                <button className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  신규 소싱 사이트 일괄 삭제
                </button>
              </div>
            </div>
            
            {/* Date Range Filter */}
            {showDateFilter && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-3">수집 기간 설정</h4>
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">시작일:</label>
                    <input
                      type="date"
                      value={dateRange.startDate}
                      onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                      className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">종료일:</label>
                    <input
                      type="date"
                      value={dateRange.endDate}
                      onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                      className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const today = new Date()
                        const yesterday = new Date(today)
                        yesterday.setDate(yesterday.getDate() - 1)
                        
                        setDateRange({
                          startDate: yesterday.toISOString().split('T')[0],
                          endDate: today.toISOString().split('T')[0]
                        })
                      }}
                      className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                    >
                      최근 2일
                    </button>
                    <button
                      onClick={() => {
                        const today = new Date()
                        const weekAgo = new Date(today)
                        weekAgo.setDate(weekAgo.getDate() - 7)
                        
                        setDateRange({
                          startDate: weekAgo.toISOString().split('T')[0],
                          endDate: today.toISOString().split('T')[0]
                        })
                      }}
                      className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                    >
                      최근 1주일
                    </button>
                    <button
                      onClick={() => setDateRange({ startDate: '', endDate: '' })}
                      className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
                    >
                      초기화
                    </button>
                  </div>
                </div>
                {(dateRange.startDate && dateRange.endDate) && (
                  <div className="mt-2 text-sm text-gray-600">
                    <span className="font-medium">설정된 기간:</span> {dateRange.startDate} ~ {dateRange.endDate}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input type="checkbox" className="rounded border-gray-300" />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">번호</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">밴드명</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">밴드키</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">멤버수</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">댓글 수집</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">상품수집</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">수정</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">삭제</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      밴드 정보를 불러오는 중...
                    </td>
                  </tr>
                ) : paginatedBands.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                      등록된 밴드가 없습니다.
                    </td>
                  </tr>
                ) : (
                  paginatedBands.map((band, index) => (
                    <tr key={band.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input type="checkbox" className="rounded border-gray-300" />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {startIndex + index + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 bg-blue-100 rounded flex items-center justify-center">
                            <span className="text-xs font-medium text-blue-600">B</span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {band.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              밴드
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                        <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                          {band.bandKey}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {band.memberCount ? `${band.memberCount.toLocaleString()}명` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <label className="inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={band.collectComments || false}
                            onChange={(e) => handleCommentToggle(band.id, e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-1 text-xs text-gray-500">
                            {band.collectComments ? '활성' : '비활성'}
                          </span>
                        </label>
                      </td>
                      <td className="px-4 py-3">
                        <button 
                          onClick={() => handleProductCollection(band)}
                          disabled={isCollecting === band.id}
                          className="text-green-600 hover:text-green-800 p-1 rounded bg-green-50 hover:bg-green-100 px-3 py-1 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          {isCollecting === band.id ? (
                            <>
                              <RefreshCw className="h-3 w-3 animate-spin" />
                              수집 중...
                            </>
                          ) : (
                            '상품수집'
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-blue-500 hover:text-blue-700 p-1 rounded">
                          <Edit3 className="h-4 w-4" />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-red-500 hover:text-red-700 p-1 rounded">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                          band.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {band.isActive ? '정상' : '오류'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              총 {filteredBands.length}개 중 {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredBands.length)}개 표시
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                이전
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1 text-sm border rounded ${
                    currentPage === page
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button 
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                다음
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Collection Progress Overlay */}
        {isBulkCollecting && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-xl">
              <div className="text-center">
                <div className="mb-4">
                  <RefreshCw className="h-12 w-12 animate-spin mx-auto text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">전체 상품 수집 진행 중</h3>
                <p className="text-sm text-gray-600 mb-4">
                  {bulkProgress.currentBand && `현재: ${bulkProgress.currentBand}`}
                </p>
                
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                  <div 
                    className="bg-purple-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500">
                  {bulkProgress.current} / {bulkProgress.total} 완료
                </p>
                
                <div className="mt-6 text-xs text-gray-400">
                  <p>AI 분석으로 인해 시간이 오래 걸릴 수 있습니다.</p>
                  <p>브라우저를 닫지 마세요.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Modal */}
        {showAddModal && (
          <NewBandModal 
            isOpen={showAddModal} 
            onClose={() => setShowAddModal(false)}
            onSubmit={async (selectedBands) => {
              try {
                const response = await fetch('/api/wholesale/bands', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    selectedBands
                  })
                })

                const data = await response.json()
                
                if (data.success) {
                  setShowAddModal(false)
                  await loadWholesaleBands() // 목록 새로고침
                  alert(data.message)
                } else {
                  alert('밴드 등록 실패: ' + data.error)
                }
              } catch (error) {
                console.error('밴드 등록 오류:', error)
                alert('밴드 등록 중 오류가 발생했습니다.')
              }
            }}
          />
        )}
      </div>
    </div>
  )
}

// New Band Registration Modal Component
interface NewBandModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (selectedBands: UserBand[]) => void
}

interface UserBand {
  band_key: string
  name: string
  description: string
  member_count: number
  cover: string | null
  is_public: boolean
}

function NewBandModal({ isOpen, onClose, onSubmit }: NewBandModalProps) {
  const [userBands, setUserBands] = useState<UserBand[]>([])
  const [selectedBands, setSelectedBands] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadUserBands()
    }
  }, [isOpen])

  const loadUserBands = async () => {
    try {
      setIsLoading(true)
      setNeedsSetup(false)
      
      const response = await fetch('/api/user/bands')
      const data = await response.json()
      
      if (data.success) {
        setUserBands(data.bands || [])
      } else if (data.needsSetup) {
        setNeedsSetup(true)
      } else {
        alert('밴드 목록 조회 실패: ' + data.error)
      }
    } catch (error) {
      console.error('밴드 목록 로드 실패:', error)
      alert('밴드 목록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBandToggle = (bandKey: string) => {
    setSelectedBands(prev => 
      prev.includes(bandKey) 
        ? prev.filter(key => key !== bandKey)
        : [...prev, bandKey]
    )
  }

  const handleSubmit = () => {
    if (selectedBands.length === 0) {
      alert('등록할 밴드를 선택해주세요.')
      return
    }
    
    const selectedBandData = userBands.filter(band => 
      selectedBands.includes(band.band_key)
    )
    
    onSubmit(selectedBandData)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">내 밴드에서 선택</h2>
          <p className="text-sm text-gray-500 mt-1">
            가입되어 있는 밴드 중에서 등록할 밴드를 선택하세요.
          </p>
        </div>
        
        <div className="px-6 py-4 overflow-y-auto max-h-96">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">밴드 목록을 불러오는 중...</span>
            </div>
          ) : needsSetup ? (
            <div className="text-center py-8">
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <h3 className="text-sm font-medium text-yellow-800 mb-2">⚙️ API 설정 필요</h3>
                <p className="text-xs text-yellow-700 mb-3">
                  밴드 목록을 가져오려면 먼저 밴드 API 설정을 완료해야 합니다.
                </p>
                <button
                  onClick={() => window.open('/dashboard/settings', '_blank')}
                  className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded text-xs hover:bg-yellow-200 transition-colors"
                >
                  설정 페이지로 이동
                </button>
              </div>
            </div>
          ) : userBands.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              접근 가능한 밴드가 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {userBands.map((band) => (
                <div 
                  key={band.band_key}
                  className={`border rounded-md p-3 cursor-pointer transition-colors ${
                    selectedBands.includes(band.band_key)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleBandToggle(band.band_key)}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedBands.includes(band.band_key)}
                      onChange={() => handleBandToggle(band.band_key)}
                      className="rounded border-gray-300"
                      onClick={(e) => e.stopPropagation()}
                    />
                    
                    {band.cover && (
                      <img 
                        src={band.cover} 
                        alt={band.name}
                        className="w-10 h-10 rounded object-cover"
                      />
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {band.name}
                        </h4>
                        <span className={`px-2 py-0.5 text-xs rounded ${
                          band.is_public 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {band.is_public ? '공개' : '비공개'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs text-gray-500">
                          멤버 {band.member_count.toLocaleString()}명
                        </span>
                        <span className="text-xs text-gray-400 font-mono">
                          {band.band_key}
                        </span>
                      </div>
                      
                      {band.description && (
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {band.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-between">
          <div className="text-sm text-gray-500">
            {selectedBands.length}개 밴드 선택됨
          </div>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={selectedBands.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
            >
              선택한 밴드 등록
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}