'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Share2, Save, Lock, Unlock, Eye, EyeOff, Plus, Search, Trash2, RefreshCw } from 'lucide-react'
import Link from 'next/link'

export default function RetailSettingsPage() {
  const [settings, setSettings] = useState({
    autoPostInterval: 30,
    maxPostsPerDay: 20,
    enableAutoPosting: false,
    postingSchedule: {
      start: '09:00',
      end: '22:00',
    },
    defaultRetailBands: [] as string[],
  })

  const [isLocked, setIsLocked] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // 소매밴드 관리 상태
  const [retailBands, setRetailBands] = useState<any[]>([])
  const [isLoadingBands, setIsLoadingBands] = useState(false)
  const [selectedBands, setSelectedBands] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    loadSettings()
    loadRetailBands()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings/retail')
      const data = await response.json()

      if (data.success && data.settings) {
        setSettings(prev => ({ ...prev, ...data.settings }))
        setIsLocked(data.settings.isLocked || false)
      }
    } catch (error) {
      console.error('Failed to load retail settings:', error)
    }
  }

  // 소매밴드 목록 로드
  const loadRetailBands = async () => {
    try {
      setIsLoadingBands(true)
      const response = await fetch('/api/retail/bands')
      const data = await response.json()

      if (data.success) {
        setRetailBands(data.bands || [])
      }
    } catch (error) {
      console.error('Failed to load retail bands:', error)
    } finally {
      setIsLoadingBands(false)
    }
  }

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true)

      const response = await fetch('/api/settings/retail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...settings, isLocked }),
      })

      const data = await response.json()

      if (data.success) {
        alert('소매밴드 설정이 저장되었습니다.')
        // 저장 후 최신 설정을 다시 로드
        if (data.settings) {
          setSettings(prev => ({ ...prev, ...data.settings }))
          setIsLocked(data.settings.isLocked || false)
        }
      } else {
        alert('설정 저장에 실패했습니다: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to save retail settings:', error)
      alert('설정 저장 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    if (isLocked) return

    // 숫자 필드의 경우 타입 확인
    if (field === 'autoPostInterval' || field === 'maxPostsPerDay') {
      value = isNaN(value) ? 0 : Number(value)
    }

    setSettings(prev => ({ ...prev, [field]: value }))
  }

  const handleScheduleChange = (field: string, value: string) => {
    if (isLocked) return
    setSettings(prev => ({
      ...prev,
      postingSchedule: {
        ...prev.postingSchedule,
        [field]: value
      }
    }))
  }

  const toggleLock = () => {
    setIsLocked(!isLocked)
  }

  // 소매밴드 선택/해제
  const handleBandToggle = (bandId: string) => {
    setSelectedBands(prev =>
      prev.includes(bandId)
        ? prev.filter(id => id !== bandId)
        : [...prev, bandId]
    )
  }

  // 전체 선택/해제
  const handleSelectAll = () => {
    const filteredBandIds = filteredRetailBands.map(band => band.id)
    setSelectedBands(prev =>
      prev.length === filteredBandIds.length ? [] : filteredBandIds
    )
  }


  // 선택된 소매밴드 삭제
  const handleDeleteSelectedBands = async () => {
    if (selectedBands.length === 0) {
      alert('삭제할 소매밴드를 선택해주세요.')
      return
    }

    if (!confirm(`선택된 ${selectedBands.length}개의 소매밴드를 삭제하시겠습니까?`)) {
      return
    }

    try {
      const promises = selectedBands.map(bandId =>
        fetch(`/api/retail/bands?id=${bandId}`, { method: 'DELETE' })
      )

      await Promise.all(promises)
      alert(`${selectedBands.length}개의 소매밴드가 삭제되었습니다.`)
      setSelectedBands([])
      loadRetailBands()
    } catch (error) {
      console.error('Failed to delete retail bands:', error)
      alert('소매밴드 삭제 중 오류가 발생했습니다.')
    }
  }

  // 필터링된 소매밴드 목록
  const filteredRetailBands = retailBands.filter(band =>
    band.bandName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    band.bandKey.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 페이지네이션
  const totalPages = Math.ceil(filteredRetailBands.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedBands = filteredRetailBands.slice(startIndex, startIndex + itemsPerPage)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/admin/settings" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <div className="flex items-center gap-3">
              <Share2 className="h-8 w-8 text-green-600" />
              <h1 className="text-3xl font-bold text-gray-900">소매밴드 설정</h1>
            </div>
            <button
              onClick={toggleLock}
              className={`ml-auto flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isLocked
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              {isLocked ? '잠금됨' : '편집 가능'}
            </button>
          </div>
          <p className="text-gray-600">소매밴드 API 연동 및 자동 포스팅 설정을 관리합니다.</p>
        </div>

        <div className="space-y-8">
          {/* Band API 설정 안내 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-900 mb-1">
                  Band API 설정은 통합 API 설정 페이지에서 관리됩니다
                </h3>
                <p className="text-sm text-blue-700 mb-3">
                  소매밴드 포스팅에 필요한 Band API 설정은 아래 링크에서 한 번만 설정하면 도매/소매 모두 사용됩니다.
                </p>
                <Link
                  href="/admin/settings/api"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  통합 API 설정으로 이동
                </Link>
              </div>
            </div>
          </div>

          {/* 자동 포스팅 설정 */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900">자동 포스팅 설정</h2>
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.enableAutoPosting}
                  onChange={(e) => handleInputChange('enableAutoPosting', e.target.checked)}
                  disabled={isLocked}
                  className={`mr-3 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded ${
                    isLocked ? 'cursor-not-allowed' : ''
                  }`}
                />
                <label className="text-sm font-medium text-gray-700">
                  자동 포스팅 활성화
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    포스팅 간격 (분)
                  </label>
                  <input
                    type="number"
                    value={settings.autoPostInterval}
                    onChange={(e) => handleInputChange('autoPostInterval', parseInt(e.target.value))}
                    disabled={isLocked}
                    min="5"
                    max="180"
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                      isLocked ? 'bg-gray-100 cursor-not-allowed' : ''
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    일일 최대 포스팅 수
                  </label>
                  <input
                    type="number"
                    value={settings.maxPostsPerDay}
                    onChange={(e) => handleInputChange('maxPostsPerDay', parseInt(e.target.value))}
                    disabled={isLocked}
                    min="1"
                    max="100"
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                      isLocked ? 'bg-gray-100 cursor-not-allowed' : ''
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    포스팅 시작 시간
                  </label>
                  <input
                    type="time"
                    value={settings.postingSchedule.start}
                    onChange={(e) => handleScheduleChange('start', e.target.value)}
                    disabled={isLocked}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                      isLocked ? 'bg-gray-100 cursor-not-allowed' : ''
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    포스팅 종료 시간
                  </label>
                  <input
                    type="time"
                    value={settings.postingSchedule.end}
                    onChange={(e) => handleScheduleChange('end', e.target.value)}
                    disabled={isLocked}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                      isLocked ? 'bg-gray-100 cursor-not-allowed' : ''
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 소매밴드 관리 */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">소매밴드 관리</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  새밴드등록
                </button>
                <button
                  onClick={handleDeleteSelectedBands}
                  disabled={selectedBands.length === 0}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  선택삭제 ({selectedBands.length})
                </button>
              </div>
            </div>

            {/* 검색 */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="밴드명 또는 밴드키로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* 소매밴드 목록 테이블 */}
            <div className="overflow-x-auto">
              {isLoadingBands ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
                  <p className="text-gray-500">소매밴드 목록을 불러오는 중...</p>
                </div>
              ) : filteredRetailBands.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">등록된 소매밴드가 없습니다.</p>
                  <p className="text-sm text-gray-400 mt-1">새밴드등록 버튼을 클릭하여 소매밴드를 추가해보세요.</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <input
                          type="checkbox"
                          checked={selectedBands.length === filteredRetailBands.length && filteredRetailBands.length > 0}
                          onChange={handleSelectAll}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        밴드명
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        밴드키
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        멤버수
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        등록일
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        상태
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedBands.map((band) => (
                      <tr key={band.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedBands.includes(band.id)}
                            onChange={() => handleBandToggle(band.id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{band.bandName}</div>
                          {band.description && (
                            <div className="text-sm text-gray-500">{band.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 font-mono">{band.bandKey}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {band.memberCount ? band.memberCount.toLocaleString() : '-'}명
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {band.createdAt ? new Date(band.createdAt).toLocaleDateString('ko-KR') : '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            활성
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-700">
                  총 {filteredRetailBands.length}개 중 {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredRetailBands.length)}개 표시
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    이전
                  </button>
                  <span className="text-sm text-gray-700">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    다음
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 저장 버튼 */}
          <div className="flex justify-end">
            <button
              onClick={handleSaveSettings}
              disabled={isSaving || isLocked}
              className={`px-6 py-3 rounded-lg font-medium flex items-center gap-2 ${
                isLocked
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              } disabled:opacity-50`}
            >
              <Save className="w-4 h-4" />
              {isSaving ? '저장 중...' : '설정 저장'}
            </button>
          </div>

          {isLocked && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 text-sm">
                🔒 설정이 잠겨있습니다. 수정하려면 우측 상단의 잠금 버튼을 클릭하세요.
              </p>
            </div>
          )}
        </div>

        {/* 새밴드등록 모달 */}
        {showAddModal && (
          <NewBandModal
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
            onSubmit={async (selectedBands) => {
              try {
                // 선택된 밴드들을 소매밴드로 추가
                const promises = selectedBands.map(band =>
                  fetch('/api/retail/bands', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      bandKey: band.band_key,
                      bandName: band.name,
                      description: band.description,
                      memberCount: band.member_count
                    }),
                  })
                )

                const responses = await Promise.all(promises)
                const results = await Promise.all(responses.map(r => r.json()))

                const successCount = results.filter(r => r.success).length
                const failCount = results.length - successCount

                if (successCount > 0) {
                  alert(`${successCount}개 밴드가 소매밴드로 추가되었습니다.${failCount > 0 ? ` (${failCount}개 실패)` : ''}`)
                  loadRetailBands() // 목록 새로고침
                } else {
                  alert('모든 밴드 추가에 실패했습니다.')
                }

                setShowAddModal(false)
              } catch (error) {
                console.error('소매밴드 추가 오류:', error)
                alert('소매밴드 추가 중 오류가 발생했습니다.')
              }
            }}
          />
        )}
      </div>
    </div>
  )
}

// New Band Registration Modal Component (same as automation/bands)
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

      // 서버사이드 API를 통해 밴드 목록 조회
      const response = await fetch('/api/user/bands')
      const data = await response.json()

      if (data.success) {
        setUserBands(data.bands || [])
      } else if (data.needsSetup || data.needsTokenRefresh) {
        setNeedsSetup(true)
      } else {
        // 구체적인 오류 메시지 표시
        console.error('밴드 목록 조회 오류:', data.error)
        setNeedsSetup(true)
      }
    } catch (error) {
      console.error('밴드 목록 로드 실패:', error)
      // 네트워크 오류의 경우 설정 확인 안내
      setNeedsSetup(true)
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
              <span className="ml-2 text-gray-600">밴드 API에서 실제 밴드 목록을 불러오는 중...</span>
            </div>
          ) : needsSetup ? (
            <div className="text-center py-8">
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <h3 className="text-sm font-medium text-yellow-800 mb-2">⚙️ 밴드 API 설정 및 연결 확인 필요</h3>
                <p className="text-xs text-yellow-700 mb-3">
                  실제 운용되는 밴드 목록을 불러올 수 없습니다. 다음을 확인해주세요:<br/>
                  • 밴드 API Access Token이 올바르게 설정되었는지 확인<br/>
                  • Access Token이 만료되지 않았는지 확인<br/>
                  • 인터넷 연결 상태 확인<br/>
                  <span className="font-medium text-red-700">아래 버튼을 통해 밴드 API 설정을 확인하고 연결 테스트를 진행해주세요.</span>
                </p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => {
                      onClose()
                      // 페이지의 밴드 API 설정 섹션으로 스크롤
                      const element = document.getElementById('band-api-settings')
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth' })
                      }
                    }}
                    className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded text-xs hover:bg-yellow-200 transition-colors"
                  >
                    현재 페이지에서 설정
                  </button>
                  <button
                    onClick={() => {
                      onClose()
                      // 밴드 API 전용 설정 페이지로 이동
                      window.open('/admin/settings/band', '_blank')
                    }}
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-xs hover:bg-blue-200 transition-colors"
                  >
                    밴드 API 설정 페이지
                  </button>
                </div>
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