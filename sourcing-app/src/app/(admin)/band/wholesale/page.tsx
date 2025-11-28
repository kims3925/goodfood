'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Trash2, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Modal, { ModalFooter } from '@/components/ui/Modal'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/Table'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import Pagination from '@/components/ui/Pagination'

interface Band {
  id: number
  userId: number
  apiConfigId: number
  bandKey: string
  name: string
  coverUrl: string | null
  isActive: boolean
  createdAt: string
  apiConfig: {
    platform: string
  }
  user: {
    email: string
    name: string | null
  }
}

interface ApiBand {
  band_key: string
  name: string
  cover: string
}

export default function WholesaleBandsPage() {
  const router = useRouter()
  const [bands, setBands] = useState<Band[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 10

  // Band API 조회 관련 상태
  const [availableBands, setAvailableBands] = useState<ApiBand[]>([])
  const [selectedBandKeys, setSelectedBandKeys] = useState<string[]>([])
  const [isLoadingBands, setIsLoadingBands] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [selectAll, setSelectAll] = useState(false)

  // 선택 삭제 관련 상태
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    loadBands()
  }, [currentPage])

  const loadBands = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/band/wholesale?search=${searchTerm}&page=${currentPage}&limit=${itemsPerPage}`)
      const data = await response.json()

      if (data.success) {
        setBands(data.data)
        setTotalItems(data.pagination?.total || 0)
        setTotalPages(data.pagination?.totalPages || 1)
      }
    } catch (error) {
      console.error('밴드 목록 조회 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = () => {
    setCurrentPage(1)
    loadBands()
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleOpenAddModal = async () => {
    setIsLoadingBands(true)
    setApiError(null)
    setAvailableBands([])
    setSelectedBandKeys([])
    setSelectAll(false)
    setShowAddModal(true)

    try {
      // 세션에서 userId를 자동으로 가져옴
      const response = await fetch('/api/band/user-band')
      const data = await response.json()

      if (data.success) {
        setAvailableBands(data.data)
      } else {
        setApiError(data.error || '밴드 목록을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('밴드 API 조회 실패:', error)
      setApiError('밴드 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoadingBands(false)
    }
  }

  const handleToggleSelectAll = () => {
    if (selectAll) {
      setSelectedBandKeys([])
      setSelectAll(false)
    } else {
      const allBandKeys = availableBands.map(band => band.band_key)
      setSelectedBandKeys(allBandKeys)
      setSelectAll(true)
    }
  }

  const handleToggleBandSelection = (bandKey: string) => {
    setSelectedBandKeys((prev) => {
      const newSelection = prev.includes(bandKey)
        ? prev.filter((key) => key !== bandKey)
        : [...prev, bandKey]

      // 전체선택 상태 업데이트
      setSelectAll(newSelection.length === availableBands.length)
      return newSelection
    })
  }

  const handleAddSelectedBands = async () => {
    if (selectedBandKeys.length === 0) {
      return
    }

    try {
      const selectedBands = availableBands.filter((band) =>
        selectedBandKeys.includes(band.band_key)
      )

      for (const band of selectedBands) {
        await fetch('/api/band/wholesale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bandKey: band.band_key,
            name: band.name,
            coverUrl: band.cover,
          }),
        })
      }

      setShowAddModal(false)
      setSelectedBandKeys([])
      loadBands()
    } catch (error) {
      console.error('밴드 등록 실패:', error)
    }
  }

  // 전체 선택/해제
  const handleSelectAllBands = () => {
    if (selectedIds.length === bands.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(bands.map(band => band.id))
    }
  }

  // 개별 선택/해제
  const handleSelectBand = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  // 선택 삭제
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`선택한 ${selectedIds.length}개의 밴드를 삭제하시겠습니까?`)) return

    setIsDeleting(true)
    try {
      for (const id of selectedIds) {
        await fetch(`/api/band/wholesale?id=${id}`, {
          method: 'DELETE',
        })
      }
      setSelectedIds([])
      loadBands()
    } catch (error) {
      console.error('밴드 삭제 실패:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  // 행 클릭 시 상세 페이지 이동
  const handleRowClick = (id: number) => {
    router.push(`/band/wholesale/${id}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">도매밴드 관리</h1>
          <p className="text-gray-600">
            도매밴드를 등록하고 관리합니다. 등록된 밴드에서 게시물을 수집할 수 있습니다.
          </p>
        </div>

        {/* 컨트롤 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex gap-2 flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <Input
                    type="text"
                    placeholder="밴드명으로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10"
                  />
                </div>
                <Button variant="secondary" onClick={handleSearch}>
                  검색
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={loadBands}
                  disabled={isLoading}
                >
                  <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                  새로고침
                </Button>
                <Button variant="primary" onClick={handleOpenAddModal}>
                  <Plus size={16} />
                  밴드 추가
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDeleteSelected}
                  disabled={selectedIds.length === 0 || isDeleting}
                >
                  <Trash2 size={16} />
                  선택 삭제 {selectedIds.length > 0 && `(${selectedIds.length})`}
                </Button>
              </div>
            </div>
          </div>

          {/* 테이블 */}
          {isLoading ? (
            <div className="p-12">
              <Loading />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <input
                      type="checkbox"
                      checked={bands.length > 0 && selectedIds.length === bands.length}
                      onChange={handleSelectAllBands}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                  </TableHead>
                  <TableHead className="w-[40%]">밴드명</TableHead>
                  <TableHead className="w-[15%]">플랫폼</TableHead>
                  <TableHead className="w-[15%]">상태</TableHead>
                  <TableHead className="w-[20%]">등록일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bands.length === 0 ? (
                  <TableEmpty message="등록된 도매밴드가 없습니다." />
                ) : (
                  bands.map((band) => (
                    <TableRow
                      key={band.id}
                      onClick={() => handleRowClick(band.id)}
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(band.id)}
                          onChange={(e) => handleSelectBand(band.id, e as unknown as React.MouseEvent)}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {band.coverUrl ? (
                            <img
                              src={band.coverUrl}
                              alt={band.name}
                              className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                              <span className="text-gray-400 text-xs">No</span>
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-gray-900 text-base">{band.name}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {band.apiConfig.platform}
                        </span>
                      </TableCell>
                      <TableCell>
                        {band.isActive ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            활성
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            비활성
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600">
                          {new Date(band.createdAt).toLocaleDateString('ko-KR')}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
          />
        </div>
      </div>

      {/* 추가 모달 */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          setApiError(null)
          setAvailableBands([])
          setSelectedBandKeys([])
          setSelectAll(false)
        }}
        title="도매밴드 추가"
        size="2xl"
      >
        {isLoadingBands ? (
          <div className="py-12">
            <Loading />
            <p className="text-center text-gray-600 mt-4">사용자의 밴드 목록을 불러오는 중...</p>
          </div>
        ) : apiError ? (
          <div className="py-8">
            <div className="flex flex-col items-center justify-center space-y-4">
              <AlertCircle className="text-red-500" size={48} />
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">API 설정 오류</h3>
                <p className="text-gray-600 mb-4">{apiError}</p>
                <Button
                  variant="primary"
                  onClick={() => router.push('/admin/settings/api')}
                >
                  <ExternalLink size={16} />
                  환경 설정으로 이동
                </Button>
              </div>
            </div>
          </div>
        ) : availableBands.length === 0 ? (
          <div className="py-8">
            <div className="flex flex-col items-center justify-center space-y-4">
              <AlertCircle className="text-yellow-500" size={48} />
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">밴드가 없습니다</h3>
                <p className="text-gray-600">사용자의 밴드 목록이 비어있습니다.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-[calc(75vh-12rem)]">
            <div className="flex-1 overflow-y-auto space-y-2">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700">전체선택</span>
                </div>
                <p className="text-sm text-gray-600">
                  선택: {selectedBandKeys.length}개 / 전체: {availableBands.length}개
                </p>
              </div>
              {availableBands.map((band) => (
                <div
                  key={band.band_key}
                  className={`
                    p-4 border rounded-lg cursor-pointer transition-colors
                    ${
                      selectedBandKeys.includes(band.band_key)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                  onClick={() => handleToggleBandSelection(band.band_key)}
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedBandKeys.includes(band.band_key)}
                      onChange={(e) => {
                        e.stopPropagation()
                        handleToggleBandSelection(band.band_key)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1"
                    />
                    {band.cover && (
                      <img
                        src={band.cover}
                        alt={band.name}
                        className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900">{band.name}</h4>
                      <p className="text-xs text-gray-400 mt-2 truncate">{band.band_key}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <ModalFooter className="mt-0 pt-2 pb-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowAddModal(false)
                  setApiError(null)
                  setAvailableBands([])
                  setSelectedBandKeys([])
                }}
              >
                취소
              </Button>
              <Button
                variant="primary"
                onClick={handleAddSelectedBands}
                disabled={selectedBandKeys.length === 0}
              >
                선택한 밴드 추가 ({selectedBandKeys.length})
              </Button>
            </ModalFooter>
          </div>
        )}
      </Modal>

    </div>
  )
}
