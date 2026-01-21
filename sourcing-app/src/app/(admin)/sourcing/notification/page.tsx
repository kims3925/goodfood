'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  Bell,
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Trash2,
  Filter,
  Mail,
  MailOpen,
  Package,
  Zap,
  Upload,
  AlertCircle,
  Info,
} from 'lucide-react'
import Loading from '@/components/ui/Loading'

// 알림 타입 (소싱용)
type NotificationType = 'COLLECT' | 'TRANSFORM' | 'PUBLISH' | 'ERROR' | 'INFO'

interface NotificationMetadata {
  overallStatus?: string
  duration?: string
  collection?: {
    successCount: number
    failedCount: number
    bandResults: Array<{ bandName: string; count: number }>
  }
  transform?: {
    successCount: number
    failedCount: number
    productNames: string[]
  }
  productCreate?: {
    successCount: number
    failedCount: number
    productNames: string[]
  }
  publish?: {
    successCount: number
    failedCount: number
    channelName?: string
    productNames: string[]
  }
}

interface Notification {
  id: number
  type: NotificationType
  title: string
  message: string
  metadata?: NotificationMetadata
  isRead: boolean
  createdAt: string
  link?: string
}

interface NotificationData {
  notifications: Notification[]
  stats: {
    total: number
    unread: number
    today: number
  }
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// 타입별 아이콘 및 색상
const typeConfig: Record<NotificationType, { icon: React.ReactNode; bg: string; text: string; label: string }> = {
  COLLECT: {
    icon: <Package size={16} />,
    bg: 'bg-green-100',
    text: 'text-green-600',
    label: '수집',
  },
  TRANSFORM: {
    icon: <Zap size={16} />,
    bg: 'bg-yellow-100',
    text: 'text-yellow-600',
    label: 'AI변환',
  },
  PUBLISH: {
    icon: <Upload size={16} />,
    bg: 'bg-blue-100',
    text: 'text-blue-600',
    label: '발행',
  },
  ERROR: {
    icon: <AlertCircle size={16} />,
    bg: 'bg-red-100',
    text: 'text-red-600',
    label: '오류',
  },
  INFO: {
    icon: <Info size={16} />,
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    label: '정보',
  },
}

// Metadata 정형화 표시 컴포넌트
function MetadataDisplay({ metadata, type }: { metadata?: NotificationMetadata; type: NotificationType }) {
  if (!metadata) return null

  return (
    <div className="mt-3 space-y-2 text-sm">
      {/* 수집 결과 */}
      {metadata.collection && (
        <div className="space-y-1">
          <div className="font-medium text-gray-700 flex items-center gap-1">
            <Package size={14} /> 수집 결과
          </div>
          <div className="pl-5 space-y-0.5">
            {metadata.collection.bandResults?.map((band, i) => (
              <div key={i} className="text-gray-600">
                • {band.bandName}: <span className="font-medium">{band.count}건</span>
              </div>
            ))}
            <div className="text-gray-500 text-xs mt-1">
              총 {metadata.collection.successCount}건 성공
              {metadata.collection.failedCount > 0 && `, ${metadata.collection.failedCount}건 실패`}
            </div>
          </div>
        </div>
      )}

      {/* 변환 결과 */}
      {metadata.transform && (
        <div className="space-y-1">
          <div className="font-medium text-gray-700 flex items-center gap-1">
            <Zap size={14} /> AI 변환 결과
          </div>
          <div className="pl-5 space-y-0.5">
            {metadata.transform.productNames?.slice(0, 3).map((name, i) => (
              <div key={i} className="text-gray-600">• {name}</div>
            ))}
            {metadata.transform.productNames?.length > 3 && (
              <div className="text-gray-400 text-xs">외 {metadata.transform.productNames.length - 3}건...</div>
            )}
            <div className="text-gray-500 text-xs mt-1">
              총 {metadata.transform.successCount}건 성공
              {metadata.transform.failedCount > 0 && `, ${metadata.transform.failedCount}건 실패`}
            </div>
          </div>
        </div>
      )}

      {/* 상품 생성 결과 */}
      {metadata.productCreate && (
        <div className="space-y-1">
          <div className="font-medium text-gray-700 flex items-center gap-1">
            <Package size={14} /> 상품 생성 결과
          </div>
          <div className="pl-5 space-y-0.5">
            {metadata.productCreate.productNames?.slice(0, 3).map((name, i) => (
              <div key={i} className="text-gray-600">• {name}</div>
            ))}
            {metadata.productCreate.productNames?.length > 3 && (
              <div className="text-gray-400 text-xs">외 {metadata.productCreate.productNames.length - 3}건...</div>
            )}
            <div className="text-gray-500 text-xs mt-1">
              총 {metadata.productCreate.successCount}건 성공
              {metadata.productCreate.failedCount > 0 && `, ${metadata.productCreate.failedCount}건 실패`}
            </div>
          </div>
        </div>
      )}

      {/* 발행 결과 */}
      {metadata.publish && (
        <div className="space-y-1">
          <div className="font-medium text-gray-700 flex items-center gap-1">
            <Upload size={14} /> 발행 결과
            {metadata.publish.channelName && (
              <span className="text-gray-500 font-normal">({metadata.publish.channelName})</span>
            )}
          </div>
          <div className="pl-5 space-y-0.5">
            {metadata.publish.productNames?.slice(0, 3).map((name, i) => (
              <div key={i} className="text-gray-600">• {name}</div>
            ))}
            {metadata.publish.productNames?.length > 3 && (
              <div className="text-gray-400 text-xs">외 {metadata.publish.productNames.length - 3}건...</div>
            )}
            <div className="text-gray-500 text-xs mt-1">
              총 {metadata.publish.successCount}건 성공
              {metadata.publish.failedCount > 0 && `, ${metadata.publish.failedCount}건 실패`}
            </div>
          </div>
        </div>
      )}

      {/* 처리 시간 */}
      {metadata.duration && (
        <div className="text-xs text-gray-400 pt-1 border-t border-gray-100">
          처리 시간: {metadata.duration}
        </div>
      )}
    </div>
  )
}

export default function SourcingNotificationPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<NotificationData | null>(null)

  // 필터 상태
  const [type, setType] = useState('')
  const [isRead, setIsRead] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)

  // 선택된 알림
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTargetIds, setDeleteTargetIds] = useState<number[]>([])

  // 펼쳐진 알림
  const [expandedIds, setExpandedIds] = useState<number[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('section', 'sourcing')
      if (type) params.set('type', type)
      if (isRead) params.set('isRead', isRead)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (search) params.set('search', search)
      params.set('page', page.toString())
      params.set('limit', '20')

      const res = await fetch(`/api/admin/notifications?${params}`)
      const result = await res.json()

      if (result.success) {
        setData(result.data)
      }
    } catch (error) {
      console.error('알림 데이터 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }, [type, isRead, startDate, endDate, search, page])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMinutes < 1) return '방금 전'
    if (diffMinutes < 60) return `${diffMinutes}분 전`
    if (diffHours < 24) return `${diffHours}시간 전`
    if (diffDays < 7) return `${diffDays}일 전`

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const handleSearch = () => {
    setSearch(searchInput)
    setPage(1)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const resetFilters = () => {
    setType('')
    setIsRead('')
    setStartDate('')
    setEndDate('')
    setSearch('')
    setSearchInput('')
    setPage(1)
  }

  const hasFilters = type || isRead || startDate || endDate || search

  // 알림 읽음 처리
  const handleMarkAsRead = async (ids: number[]) => {
    try {
      const res = await fetch('/api/admin/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const result = await res.json()
      if (result.success) {
        fetchData()
        setSelectedIds([])
      }
    } catch (error) {
      console.error('읽음 처리 실패:', error)
    }
  }

  // 알림 삭제 (모달 열기)
  const handleDelete = (ids: number[]) => {
    setDeleteTargetIds(ids)
    setShowDeleteModal(true)
  }

  // 실제 삭제 수행
  const handleDeleteConfirm = async () => {
    setShowDeleteModal(false)
    const ids = deleteTargetIds

    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const result = await res.json()
      if (result.success) {
        fetchData()
        setSelectedIds([])
      }
    } catch (error) {
      console.error('삭제 실패:', error)
    }
  }

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (!data) return
    if (selectedIds.length === data.notifications.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(data.notifications.map((n) => n.id))
    }
  }

  // 개별 선택
  const handleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  // 드롭다운 토글 (펼칠 때 읽음 처리)
  const toggleExpand = (id: number, isRead: boolean) => {
    const willExpand = !expandedIds.includes(id)
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
    // 펼칠 때 읽지 않은 알림이면 읽음 처리
    if (willExpand && !isRead) {
      handleMarkAsRead([id])
    }
  }

  // 알림 클릭 시 해당 페이지로 이동
  const handleNotificationClick = async (notification: Notification) => {
    if (notification.link) {
      // 읽지 않은 알림인 경우에만 읽음 처리 (API 호출 완료 후 이동)
      if (!notification.isRead) {
        try {
          await fetch('/api/admin/notifications/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: [notification.id] }),
          })
        } catch (error) {
          console.error('읽음 처리 실패:', error)
        }
      }
      window.location.href = notification.link
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">알림 관리</h1>
          <p className="text-gray-600">
            소싱 관련 수집, AI변환, 발행 알림을 확인하고 관리합니다.
          </p>
        </div>

        {/* 통계 및 액션 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
                <Bell size={20} className="sm:w-6 sm:h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500">전체 알림</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{data?.stats.total || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-3 bg-red-100 rounded-lg">
                <Mail size={20} className="sm:w-6 sm:h-6 text-red-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500">읽지 않음</p>
                <p className="text-xl sm:text-2xl font-bold text-red-600">{data?.stats.unread || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-3 bg-green-100 rounded-lg">
                <Calendar size={20} className="sm:w-6 sm:h-6 text-green-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500">오늘 알림</p>
                <p className="text-xl sm:text-2xl font-bold text-green-600">{data?.stats.today || 0}</p>
              </div>
            </div>
          </div>
          {/* 읽음 처리 카드 */}
          <button
            onClick={() => handleMarkAsRead(selectedIds)}
            disabled={selectedIds.length === 0}
            className={`bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 text-left transition-colors min-h-[44px] ${
              selectedIds.length > 0
                ? 'hover:border-blue-300 hover:bg-blue-50 cursor-pointer'
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`p-2 sm:p-3 rounded-lg ${selectedIds.length > 0 ? 'bg-blue-100' : 'bg-gray-100'}`}>
                <MailOpen size={20} className={`sm:w-6 sm:h-6 ${selectedIds.length > 0 ? 'text-blue-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500">읽음 처리</p>
                <p className={`text-base sm:text-lg font-bold ${selectedIds.length > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                  {selectedIds.length}개
                </p>
              </div>
            </div>
          </button>
          {/* 삭제 카드 */}
          <button
            onClick={() => handleDelete(selectedIds)}
            disabled={selectedIds.length === 0}
            className={`bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 text-left transition-colors min-h-[44px] ${
              selectedIds.length > 0
                ? 'hover:border-red-300 hover:bg-red-50 cursor-pointer'
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`p-2 sm:p-3 rounded-lg ${selectedIds.length > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                <Trash2 size={20} className={`sm:w-6 sm:h-6 ${selectedIds.length > 0 ? 'text-red-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500">선택 삭제</p>
                <p className={`text-base sm:text-lg font-bold ${selectedIds.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {selectedIds.length}개
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* 필터 영역 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* 타입 필터 */}
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-400" />
              <select
                value={type}
                onChange={(e) => { setType(e.target.value); setPage(1) }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">전체 타입</option>
                <option value="COLLECT">수집</option>
                <option value="TRANSFORM">AI변환</option>
                <option value="PUBLISH">발행</option>
                <option value="ERROR">오류</option>
                <option value="INFO">정보</option>
              </select>
            </div>

            {/* 읽음 상태 필터 */}
            <div className="flex items-center gap-2">
              <MailOpen size={16} className="text-gray-400" />
              <select
                value={isRead}
                onChange={(e) => { setIsRead(e.target.value); setPage(1) }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">전체 상태</option>
                <option value="false">읽지 않음</option>
                <option value="true">읽음</option>
              </select>
            </div>

            {/* 날짜 범위 */}
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-400">~</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 검색 */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="알림 내용 검색"
                  className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                />
              </div>
              <button
                onClick={handleSearch}
                className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
              >
                검색
              </button>
            </div>

            {/* 필터 초기화 */}
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <X size={14} />
                필터 초기화
              </button>
            )}
          </div>
        </div>

        {/* 메인 콘텐츠 */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
            <Loading />
          </div>
        ) : data && data.notifications.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* 검색 결과 요약 */}
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                총 <span className="font-semibold text-gray-900">{data.pagination.total}</span>개의 알림
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.length === data.notifications.length && data.notifications.length > 0}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">전체 선택</span>
              </label>
            </div>

            {/* 알림 리스트 */}
            <div className="divide-y divide-gray-200">
              {data.notifications.map((notification) => {
                const config = typeConfig[notification.type] || typeConfig.INFO
                const isExpanded = expandedIds.includes(notification.id)
                return (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                      !notification.isRead ? 'bg-blue-50/30' : ''
                    }`}
                    onClick={() => toggleExpand(notification.id, notification.isRead)}
                  >
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(notification.id)}
                        onChange={(e) => {
                          e.stopPropagation()
                          handleSelect(notification.id)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className={`p-2 rounded-lg ${config.bg}`}>
                        <span className={config.text}>{config.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${config.bg} ${config.text}`}>
                            {config.label}
                          </span>
                          <h3 className={`text-sm font-medium ${!notification.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                            {notification.title}
                          </h3>
                          {!notification.isRead && (
                            <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded">NEW</span>
                          )}
                        </div>
                        {/* 펼치기 전: 제목만, 펼치면: 상세 정보 */}
                        {isExpanded && (
                          <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                            {/* metadata가 있으면 정형화해서 표시, 없으면 message 표시 */}
                            {notification.metadata ? (
                              <MetadataDisplay metadata={notification.metadata} type={notification.type} />
                            ) : (
                              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                {notification.message}
                              </p>
                            )}
                          </div>
                        )}
                        <div className={`flex items-center justify-between mt-2 ${isExpanded ? 'pt-2' : ''}`}>
                          <p className="text-xs text-gray-400">{formatDate(notification.createdAt)}</p>
                          {isExpanded && notification.link && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleNotificationClick(notification)
                              }}
                              className="px-3 py-1.5 bg-blue-500 text-white text-xs font-medium rounded-lg hover:bg-blue-600 flex items-center gap-1"
                            >
                              상세 보기
                              <ChevronRight size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      {/* 펼침/접힘 아이콘 */}
                      <div className="text-gray-400">
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 페이지네이션 */}
            {data.pagination.totalPages > 1 && (
              <div className="px-4 py-4 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {data.pagination.page} / {data.pagination.totalPages} 페이지
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                    disabled={page === data.pagination.totalPages}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Bell size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">알림이 없습니다</h3>
            <p className="text-gray-500">
              {hasFilters ? '검색 조건에 맞는 알림이 없습니다.' : '수집, AI변환, 발행 등 이벤트 발생 시 알림이 표시됩니다.'}
            </p>
          </div>
        )}
      </div>

      {/* 삭제 확인 모달 */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">알림 삭제</h3>
              <p className="text-gray-600">
                {deleteTargetIds.length}개의 알림을 삭제하시겠습니까?
              </p>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
