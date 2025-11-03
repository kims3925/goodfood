'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Edit3, Trash2, Copy, LogIn, RefreshCw, Eye, Package, Shield, Calendar, CheckCircle } from 'lucide-react'
import ProgressModal from '@/components/ProgressModal'

interface WholesaleBand {
  id: string
  name: string
  bandKey: string
  description?: string | null
  memberCount?: number | null
  isActive: boolean
  collectComments?: boolean
  // 가격정책
  pricingPolicy?: string | null
  createdAt: string
  updatedAt: string
}

export default function BandsPage() {
  const [wholesaleBands, setWholesaleBands] = useState<WholesaleBand[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [isCollecting, setIsCollecting] = useState<string | null>(null)
  const [selectedBandIds, setSelectedBandIds] = useState<string[]>([])
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' })
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [showPolicyModal, setShowPolicyModal] = useState(false)
  const [selectedBandForPolicy, setSelectedBandForPolicy] = useState<WholesaleBand | null>(null)
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [selectedBandForCollection, setSelectedBandForCollection] = useState<WholesaleBand | null>(null)
  const [showBulkCompletionModal, setShowBulkCompletionModal] = useState(false)
  const [bulkStartTime, setBulkStartTime] = useState<Date | null>(null)
  const [bulkEndTime, setBulkEndTime] = useState<Date | null>(null)
  const [bulkSummary, setBulkSummary] = useState<any>(null)
  const [showSourcingSiteModal, setShowSourcingSiteModal] = useState(false)

  // 새로운 전체 수집 상태 관리
  const [isInBulkMode, setIsInBulkMode] = useState(false)
  const [currentBulkIndex, setCurrentBulkIndex] = useState(0)
  const [bulkCollectionSummary, setBulkCollectionSummary] = useState<{
    totalBands: number
    processedBands: number
    totalFound: number
    totalNewPosts: number
    totalAiAnalyzed: number
    totalComments: number
    startTime: Date
  } | null>(null)

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
    setSelectedBandForCollection(band)
    setShowProgressModal(true)
  }


  // 체크박스 관리 함수들
  const handleBandToggle = (bandId: string) => {
    setSelectedBandIds(prev =>
      prev.includes(bandId)
        ? prev.filter(id => id !== bandId)
        : [...prev, bandId]
    )
  }

  const handleSelectAllBands = () => {
    const filteredBandIds = paginatedBands.map(band => band.id)
    setSelectedBandIds(prev =>
      prev.length === filteredBandIds.length
        ? []
        : filteredBandIds
    )
  }

  const handleSelectedBandsCollection = async () => {
    if (selectedBandIds.length === 0) {
      alert('수집할 도매밴드를 선택해주세요.')
      return
    }

    if (!confirm(`${selectedBandIds.length}개의 선택된 밴드에 대한 상품 수집을 시작하시겠습니까?`)) {
      return
    }

    // 선택된 밴드들로 순차적으로 수집 진행
    setCurrentBulkIndex(0)
    setIsInBulkMode(true)

    const selectedBands = wholesaleBands.filter(band => selectedBandIds.includes(band.id))

    setBulkCollectionSummary({
      totalBands: selectedBands.length,
      processedBands: 0,
      totalFound: 0,
      totalNewPosts: 0,
      totalAiAnalyzed: 0,
      totalComments: 0,
      startTime: new Date()
    })

    // 첫 번째 선택된 밴드부터 시작
    setSelectedBandForCollection(selectedBands[0])
    setShowProgressModal(true)
  }

  const handleCollectionComplete = (summary: any) => {
    setShowProgressModal(false)
    setSelectedBandForCollection(null)

    if (isInBulkMode && bulkCollectionSummary) {
      // 벌크 모드인 경우: 누적 합계 업데이트
      const updatedSummary = {
        ...bulkCollectionSummary,
        processedBands: bulkCollectionSummary.processedBands + 1,
        totalFound: bulkCollectionSummary.totalFound + (summary?.totalFound || 0),
        totalNewPosts: bulkCollectionSummary.totalNewPosts + (summary?.newPosts || 0),
        totalAiAnalyzed: bulkCollectionSummary.totalAiAnalyzed + (summary?.aiAnalyzed || 0),
        totalComments: bulkCollectionSummary.totalComments + (summary?.commentsCollected || 0)
      }
      setBulkCollectionSummary(updatedSummary)

      // 다음 밴드가 있는지 확인 (선택된 밴드들이 있으면 해당 리스트 사용)
      const targetBands = selectedBandIds.length > 0
        ? wholesaleBands.filter(band => selectedBandIds.includes(band.id))
        : wholesaleBands

      const nextIndex = currentBulkIndex + 1
      if (nextIndex < targetBands.length) {
        // 다음 밴드로 진행
        setCurrentBulkIndex(nextIndex)
        setTimeout(() => {
          setSelectedBandForCollection(targetBands[nextIndex])
          setShowProgressModal(true)
        }, 1000) // 1초 대기 후 다음 밴드 시작
      } else {
        // 전체 수집 완료
        setIsInBulkMode(false)
        setBulkEndTime(new Date())
        setBulkSummary({
          totalFound: updatedSummary.totalFound,
          newPosts: updatedSummary.totalNewPosts,
          aiAnalyzed: updatedSummary.totalAiAnalyzed,
          commentsCollected: updatedSummary.totalComments,
          bandsProcessed: updatedSummary.totalBands,
          processingMethod: 'Ultra 병렬 배치 처리 (개별 Progress 기반 전체 수집)'
        })
        setBulkStartTime(updatedSummary.startTime)
        setShowBulkCompletionModal(true)
      }
    } else {
      // 개별 수집 모드인 경우: 기존 로직
      if (summary) {
        setTimeout(() => {
          alert(`수집 완료!\n총 ${summary.totalFound}개 게시물 중 ${summary.newPosts}개의 새로운 게시물을 수집했습니다.\nAI 분석: ${summary.aiAnalyzed}개, 댓글 수집: ${summary.commentsCollected}개`)

          // 수집 완료 후 게시물 수집 페이지로 이동
          window.location.href = '/automation/bands/collect'
        }, 500)
      }
    }
  }

  // 개별 밴드 삭제
  const handleDeleteBand = async (band: WholesaleBand) => {
    if (!confirm(`"${band.name}" 밴드를 삭제하시겠습니까?\n\n⚠️ 이 밴드와 관련된 모든 수집 게시물도 함께 삭제됩니다.`)) {
      return
    }

    try {
      const response = await fetch(`/api/wholesale/bands/${band.id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        alert(`✅ ${data.message}\n삭제된 게시물: ${data.deletedPostsCount}개`)
        await loadWholesaleBands()
      } else {
        alert('❌ 삭제 실패: ' + data.error)
      }
    } catch (error) {
      console.error('밴드 삭제 오류:', error)
      alert('밴드 삭제 중 오류가 발생했습니다.')
    }
  }

  // 선택된 밴드 일괄 삭제
  const handleDeleteSelectedBands = async () => {
    if (selectedBandIds.length === 0) {
      alert('삭제할 밴드를 선택해주세요.')
      return
    }

    const selectedBands = wholesaleBands.filter(band => selectedBandIds.includes(band.id))
    const bandNames = selectedBands.map(b => b.name).join(', ')

    if (!confirm(`선택한 ${selectedBandIds.length}개의 밴드를 삭제하시겠습니까?\n\n밴드: ${bandNames}\n\n⚠️ 이 밴드들과 관련된 모든 수집 게시물도 함께 삭제됩니다.`)) {
      return
    }

    try {
      const response = await fetch('/api/wholesale/bands', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bandIds: selectedBandIds
        })
      })

      const data = await response.json()

      if (data.success) {
        alert(`✅ ${data.message}\n삭제된 게시물: ${data.deletedPostsCount}개`)
        setSelectedBandIds([])
        await loadWholesaleBands()
      } else {
        alert('❌ 삭제 실패: ' + data.error)
      }
    } catch (error) {
      console.error('밴드 일괄 삭제 오류:', error)
      alert('밴드 삭제 중 오류가 발생했습니다.')
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

    if (wholesaleBands.length === 0) {
      alert('등록된 소싱처가 없습니다.')
      return
    }

    // 첫 번째 밴드부터 시작하여 순차적으로 개별 수집 모드로 진행
    setCurrentBulkIndex(0)
    setIsInBulkMode(true)
    setBulkCollectionSummary({
      totalBands: wholesaleBands.length,
      processedBands: 0,
      totalFound: 0,
      totalNewPosts: 0,
      totalAiAnalyzed: 0,
      totalComments: 0,
      startTime: new Date()
    })

    // 첫 번째 밴드의 ProgressModal 표시
    setSelectedBandForCollection(wholesaleBands[0])
    setShowProgressModal(true)
  }

  const handleBulkCompletionModalClose = () => {
    setShowBulkCompletionModal(false)
    setBulkStartTime(null)
    setBulkEndTime(null)
    setBulkSummary(null)
    setBulkCollectionSummary(null)
    setCurrentBulkIndex(0)

    // 완료 모달을 닫은 후 페이지 이동
    window.location.href = '/automation/bands/collect'
  }

  const filteredBands = wholesaleBands.filter(band =>
    band.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    band.bandKey.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.ceil(filteredBands.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedBands = filteredBands.slice(startIndex, startIndex + itemsPerPage)

  // 정책 설정 관련 함수들
  const handlePolicySetup = (band: WholesaleBand) => {
    setSelectedBandForPolicy(band)
    setShowPolicyModal(true)
  }

  const savePricingPolicy = async (policyData: any) => {
    try {
      const response = await fetch(`/api/wholesale/bands/${selectedBandForPolicy?.id}/policy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policyData)
      })

      const result = await response.json()

      if (result.success) {
        // 성공 시 밴드 목록 새로고침
        await loadWholesaleBands()
        setShowPolicyModal(false)
        setSelectedBandForPolicy(null)
        alert('가격정책이 성공적으로 저장되었습니다.')
      } else {
        alert('정책 저장에 실패했습니다: ' + result.error)
      }
    } catch (error) {
      console.error('정책 저장 오류:', error)
      alert('정책 저장 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">밴드관리</h1>
          <p className="text-gray-600">도매 밴드, 쇼핑몰 등 상품을 가져올 소싱 사이트를 관리합니다.</p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              {/* Left side controls */}
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
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
                {/* 선택된 밴드들 수집 버튼 */}
                <button
                  onClick={handleSelectedBandsCollection}
                  disabled={selectedBandIds.length === 0 || isInBulkMode}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Package className="h-4 w-4" />
                  선택 수집 ({selectedBandIds.length})
                </button>

                {/* 선택된 밴드들 삭제 버튼 */}
                <button
                  onClick={handleDeleteSelectedBands}
                  disabled={selectedBandIds.length === 0}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-4 w-4" />
                  선택 삭제 ({selectedBandIds.length})
                </button>

                <button
                  onClick={handleBulkCollection}
                  disabled={isInBulkMode}
                  className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isInBulkMode ? (
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
                <button
                  onClick={() => setShowSourcingSiteModal(true)}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  신규 소싱 사이트 추가
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
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={selectedBandIds.length === paginatedBands.length && paginatedBands.length > 0}
                      onChange={handleSelectAllBands}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">번호</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">밴드명</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">밴드키</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">멤버수</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">댓글 수집</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">상품수집</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">정책 설정</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">상태</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">액션</th>
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
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedBandIds.includes(band.id)}
                          onChange={() => handleBandToggle(band.id)}
                          className="rounded border-gray-300"
                        />
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
                          disabled={isCollecting === band.id || isInBulkMode}
                          className="text-green-600 hover:text-green-800 p-1 rounded bg-green-50 hover:bg-green-100 px-3 py-1 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          {isCollecting === band.id ? (
                            <>
                              <RefreshCw className="h-3 w-3 animate-spin" />
                              수집 중...
                            </>
                          ) : isInBulkMode ? (
                            '전체 수집 중...'
                          ) : (
                            '상품수집'
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handlePolicySetup(band)}
                          className="text-blue-600 hover:text-blue-800 p-1 rounded bg-blue-50 hover:bg-blue-100 px-3 py-1 text-xs font-medium flex items-center gap-1"
                          title={band.pricingPolicy ? '정책 수정' : '정책 설정'}
                        >
                          <Shield className="h-3 w-3" />
                          {band.pricingPolicy ? '정책 수정' : '정책 설정'}
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
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDeleteBand(band)}
                          className="text-red-600 hover:text-red-800 p-1 rounded bg-red-50 hover:bg-red-100 transition-colors"
                          title="밴드 삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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

        {/* Policy Settings Modal */}
        {showPolicyModal && selectedBandForPolicy && (
          <PolicyModal
            isOpen={showPolicyModal}
            onClose={() => {
              setShowPolicyModal(false)
              setSelectedBandForPolicy(null)
            }}
            band={selectedBandForPolicy}
            onSave={savePricingPolicy}
          />
        )}

        {/* Progress Modal */}
        {showProgressModal && selectedBandForCollection && (
          <ProgressModal
            isOpen={showProgressModal}
            onClose={() => {
              // 일반 모드 또는 사용자가 명시적으로 취소한 경우 모달 닫기
              setShowProgressModal(false)
              setSelectedBandForCollection(null)

              // Bulk 모드인 경우 전체 수집 중단
              if (isInBulkMode) {
                setIsInBulkMode(false)
                setCurrentBulkIndex(0)
                setBulkCollectionSummary(null)
                console.log('✋ 전체 수집이 사용자에 의해 취소되었습니다.')
              }
            }}
            bandId={selectedBandForCollection.id}
            bandName={selectedBandForCollection.name}
            dateRange={dateRange.startDate && dateRange.endDate ? dateRange : undefined}
            onComplete={handleCollectionComplete}
            bulkMode={isInBulkMode ? {
              currentIndex: currentBulkIndex + 1,
              totalBands: wholesaleBands.length,
              currentBandName: selectedBandForCollection.name
            } : undefined}
          />
        )}

        {/* 전체 수집 완료 모달 */}
        {showBulkCompletionModal && bulkStartTime && bulkEndTime && bulkSummary && (
          <BulkCompletionModal
            isOpen={showBulkCompletionModal}
            onClose={handleBulkCompletionModalClose}
            startTime={bulkStartTime}
            endTime={bulkEndTime}
            summary={bulkSummary}
          />
        )}

        {/* 신규 소싱 사이트 추가 모달 */}
        {showSourcingSiteModal && (
          <SourcingSiteModal
            isOpen={showSourcingSiteModal}
            onClose={() => setShowSourcingSiteModal(false)}
            onSubmit={async (siteData) => {
              try {
                const response = await fetch('/api/sourcing/sites', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(siteData)
                })

                const data = await response.json()

                if (data.success) {
                  setShowSourcingSiteModal(false)
                  alert('소싱 사이트가 성공적으로 등록되었습니다!')
                  // 필요시 목록 새로고침 로직 추가
                } else {
                  alert('등록 실패: ' + data.error)
                }
              } catch (error) {
                console.error('소싱 사이트 등록 오류:', error)
                alert('등록 중 오류가 발생했습니다.')
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
        setNeedsSetup(false)
      } else {
        // API 호출이 실패해도 테스트 밴드 목록이 반환되므로 needsSetup을 false로 설정
        setUserBands(data.bands || [])
        setNeedsSetup(false)
      }
    } catch (error) {
      console.error('밴드 목록 로드 실패:', error)
      // 네트워크 오류 등의 경우에도 빈 배열로 처리하고 needsSetup을 false로 설정
      setUserBands([])
      setNeedsSetup(false)
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
                  onClick={() => window.open('/dashboard/settings/band', '_blank')}
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

// 전체 수집 완료 모달 컴포넌트
interface BulkCompletionModalProps {
  isOpen: boolean
  onClose: () => void
  startTime: Date
  endTime: Date
  summary: any
}

function BulkCompletionModal({ isOpen, onClose, startTime, endTime, summary }: BulkCompletionModalProps) {
  if (!isOpen || !summary) return null

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const totalTime = endTime.getTime() - startTime.getTime()
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60

    if (minutes > 0) {
      return `${minutes}분 ${remainingSeconds}초`
    } else {
      return `${remainingSeconds}초`
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-green-50 rounded-t-lg">
          <div className="flex items-center gap-3">
            <Package className="h-8 w-8 text-green-600" />
            <div>
              <h2 className="text-xl font-semibold text-green-800">전체 상품 수집 완료!</h2>
              <p className="text-sm text-green-600">{summary.bandsProcessed}개 소싱처에서 수집</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {/* 시간 정보 */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">처리 시간</h3>
            <div className="space-y-3 bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">시작 시간:</span>
                <span className="font-medium text-gray-900">{formatDateTime(startTime)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">완료 시간:</span>
                <span className="font-medium text-gray-900">{formatDateTime(endTime)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-gray-200 pt-3">
                <span className="text-sm font-medium text-gray-700">총 소요 시간:</span>
                <span className="font-bold text-green-600 text-lg">{formatDuration(totalTime)}</span>
              </div>
            </div>
          </div>

          {/* 수집 결과 */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">수집 결과</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{summary.totalFound}</div>
                <div className="text-xs text-blue-700">총 발견 게시물</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{summary.newPosts}</div>
                <div className="text-xs text-green-700">새로운 게시물</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-purple-600">{summary.aiAnalyzed}</div>
                <div className="text-xs text-purple-700">AI 분석 완료</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-600">{summary.commentsCollected}</div>
                <div className="text-xs text-orange-700">댓글 수집</div>
              </div>
            </div>
          </div>

          {/* 성능 정보 */}
          {summary.newPosts > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">성능 정보</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">처리한 소싱처:</span>
                  <span className="font-medium">{summary.bandsProcessed}개</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">평균 처리 시간:</span>
                  <span className="font-medium">{(totalTime / summary.newPosts).toFixed(1)}ms/개</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">처리량:</span>
                  <span className="font-medium">{(summary.newPosts / (totalTime / 1000)).toFixed(2)} 상품/초</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">처리 방식:</span>
                  <span className="font-medium text-purple-600">{summary.processingMethod}</span>
                </div>
              </div>
            </div>
          )}

          {/* 메시지 */}
          <div className="text-center text-sm text-gray-600 mb-4">
            수집된 모든 상품은 <strong>게시물 수집 페이지</strong>에서 확인하고 소싱을 진행하세요.
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-green-500 hover:bg-green-600 text-white text-base font-medium rounded-md transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle className="h-5 w-5" />
            확인 및 수집 페이지로 이동
          </button>
        </div>
      </div>
    </div>
  )
}

// Policy Settings Modal Component
interface PolicyModalProps {
  isOpen: boolean
  onClose: () => void
  band: WholesaleBand
  onSave: (policyData: any) => Promise<void>
}

function PolicyModal({ isOpen, onClose, band, onSave }: PolicyModalProps) {
  const [pricingPolicy, setPricingPolicy] = useState(band.pricingPolicy || '')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    try {
      setIsSaving(true)
      await onSave({
        pricingPolicy
      })
    } catch (error) {
      console.error('정책 저장 오류:', error)
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            <Shield className="inline h-5 w-5 mr-2" />
            가격정책 설정 - {band.name}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            이 소싱처의 가격 정책을 설정하세요. AI가 상품 수집 시 이 정책을 참조하여 적절한 판매가격을 계산합니다.
          </p>
        </div>

        <div className="px-6 py-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              가격정책
            </label>
            <textarea
              value={pricingPolicy}
              onChange={(e) => setPricingPolicy(e.target.value)}
              placeholder="예시: 모든 상품은 원가의 30% 마진을 적용하며, 최소 마진은 1,000원 이상으로 설정합니다. 5만원 이상 구매 시 무료배송, 그 이하는 배송비 3,000원입니다. 냉장/냉동 제품은 추가 포장비 1,000원이 있으며, 제주/도서산간 지역은 추가 배송비 3,000원이 발생합니다. 대량 주문(10개 이상) 시 5% 할인을 적용하고, 계절 상품(수산물)은 시세 변동에 따라 마진을 10-40% 범위에서 조정합니다."
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
            />
            <p className="text-xs text-gray-500 mt-2">
              💡 <strong>포함할 내용:</strong> 마진율, 최소/최대 마진, 배송비, 무료배송 조건, 지역별 추가비용, 할인 정책, 특수 상품 조건 등을 자세히 적어주세요.
            </p>
            <p className="text-xs text-blue-600 mt-1">
              AI가 이 내용을 분석하여 각 상품에 맞는 최적의 가격을 자동으로 계산합니다.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-md transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                저장 중...
              </>
            ) : (
              '정책 저장'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// 소싱 사이트 추가 모달 컴포넌트
interface SourcingSiteModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (siteData: any) => Promise<void>
}

function SourcingSiteModal({ isOpen, onClose, onSubmit }: SourcingSiteModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'marketplace',
    category: '',
    url: '',
    customsBaseAmount: '',
    shippingCost: '',
    bandKey: '',
    bandAccessToken: '',
    apiKey: '',
    secretKey: '',
    sellerId: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async () => {
    if (!formData.name || !formData.type) {
      alert('사이트명과 타입은 필수입니다.')
      return
    }

    try {
      setIsSubmitting(true)
      await onSubmit(formData)
      // 성공 시 폼 초기화
      setFormData({
        name: '',
        type: 'marketplace',
        category: '',
        url: '',
        customsBaseAmount: '',
        shippingCost: '',
        bandKey: '',
        bandAccessToken: '',
        apiKey: '',
        secretKey: '',
        sellerId: ''
      })
    } catch (error) {
      console.error('소싱 사이트 등록 오류:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">신규 소싱 사이트 추가</h2>
          <p className="text-sm text-gray-600 mt-1">
            새로운 소싱 사이트를 등록하여 상품을 수집할 수 있습니다.
          </p>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* 기본 정보 섹션 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">기본 정보</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  사이트명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="예: 네이버 스마트스토어"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  사이트 타입 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="marketplace">마켓플레이스</option>
                  <option value="shopping_mall">쇼핑몰</option>
                  <option value="band">밴드</option>
                  <option value="api">API</option>
                  <option value="crawler">크롤러</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  카테고리
                </label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  placeholder="예: 식품, 의류, 전자제품"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  사이트 URL
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => handleInputChange('url', e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* 비용 정보 섹션 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">비용 정보</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  관세 기준 금액
                </label>
                <input
                  type="number"
                  value={formData.customsBaseAmount}
                  onChange={(e) => handleInputChange('customsBaseAmount', e.target.value)}
                  placeholder="150000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">단위: 원</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  기본 배송비
                </label>
                <input
                  type="number"
                  value={formData.shippingCost}
                  onChange={(e) => handleInputChange('shippingCost', e.target.value)}
                  placeholder="3000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">단위: 원</p>
              </div>
            </div>
          </div>

          {/* 밴드 API 정보 섹션 (타입이 band인 경우) */}
          {formData.type === 'band' && (
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">밴드 API 정보</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    밴드 키
                  </label>
                  <input
                    type="text"
                    value={formData.bandKey}
                    onChange={(e) => handleInputChange('bandKey', e.target.value)}
                    placeholder="band_key_example"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    액세스 토큰
                  </label>
                  <input
                    type="text"
                    value={formData.bandAccessToken}
                    onChange={(e) => handleInputChange('bandAccessToken', e.target.value)}
                    placeholder="access_token_example"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 일반 API 정보 섹션 (타입이 api인 경우) */}
          {formData.type === 'api' && (
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">API 정보</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API 키
                  </label>
                  <input
                    type="text"
                    value={formData.apiKey}
                    onChange={(e) => handleInputChange('apiKey', e.target.value)}
                    placeholder="api_key_example"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    시크릿 키
                  </label>
                  <input
                    type="password"
                    value={formData.secretKey}
                    onChange={(e) => handleInputChange('secretKey', e.target.value)}
                    placeholder="secret_key_example"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    판매자 ID
                  </label>
                  <input
                    type="text"
                    value={formData.sellerId}
                    onChange={(e) => handleInputChange('sellerId', e.target.value)}
                    placeholder="seller_id_example"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-md transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.name || !formData.type}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                등록 중...
              </>
            ) : (
              '소싱 사이트 등록'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}