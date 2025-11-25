'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Edit3, Trash2, RefreshCw } from 'lucide-react'
import Button from '@/components/ui/Button'
import Modal, { ModalFooter } from '@/components/ui/Modal'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/Table'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'

interface PricingPolicy {
  id: number
  userId: number
  name: string
  description: string | null
  content: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function PolicyManagePage() {
  const [policies, setPolicies] = useState<PricingPolicy[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // 선택 삭제 관련 상태
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [selectAll, setSelectAll] = useState(false)

  // 모달 관련 상태
  const [showModal, setShowModal] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<PricingPolicy | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // 폼 상태
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: '',
    isActive: true,
  })

  useEffect(() => {
    loadPolicies()
  }, [])

  const loadPolicies = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/policy?search=${searchTerm}`)
      const data = await response.json()

      if (data.success) {
        setPolicies(data.data)
      }
    } catch (error) {
      console.error('정책 목록 조회 실패:', error)
      alert('정책 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = () => {
    loadPolicies()
  }

  const handleOpenAddModal = () => {
    setEditingPolicy(null)
    setFormData({
      name: '',
      description: '',
      content: '',
      isActive: true,
    })
    setShowModal(true)
  }

  const handleOpenEditModal = (policy: PricingPolicy) => {
    setEditingPolicy(policy)
    setFormData({
      name: policy.name,
      description: policy.description || '',
      content: policy.content,
      isActive: policy.isActive,
    })
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingPolicy(null)
    setFormData({
      name: '',
      description: '',
      content: '',
      isActive: true,
    })
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('정책 이름을 입력해주세요.')
      return
    }
    if (!formData.content.trim()) {
      alert('정책 내용을 입력해주세요.')
      return
    }

    setIsSaving(true)
    try {
      const url = '/api/policy'
      const method = editingPolicy ? 'PUT' : 'POST'
      const body = editingPolicy
        ? { id: editingPolicy.id, ...formData }
        : formData

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (data.success) {
        alert(editingPolicy ? '정책이 수정되었습니다.' : '정책이 등록되었습니다.')
        handleCloseModal()
        loadPolicies()
      } else {
        alert(data.error || '저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('정책 저장 실패:', error)
      alert('정책 저장에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeletePolicy = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/policy?id=${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        alert('정책이 삭제되었습니다.')
        loadPolicies()
      } else {
        alert(data.error || '삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('정책 삭제 실패:', error)
      alert('정책 삭제에 실패했습니다.')
    }
  }

  // 전체 선택/해제
  const handleToggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds([])
      setSelectAll(false)
    } else {
      const allIds = policies.map(policy => policy.id)
      setSelectedIds(allIds)
      setSelectAll(true)
    }
  }

  // 개별 선택/해제
  const handleToggleSelection = (id: number) => {
    setSelectedIds((prev) => {
      const newSelection = prev.includes(id)
        ? prev.filter((i) => i !== id)
        : [...prev, id]

      setSelectAll(newSelection.length === policies.length)
      return newSelection
    })
  }

  // 선택 삭제
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) {
      alert('삭제할 정책을 선택해주세요.')
      return
    }

    if (!confirm(`선택한 ${selectedIds.length}개의 정책을 삭제하시겠습니까?`)) {
      return
    }

    try {
      let successCount = 0
      let failCount = 0

      for (const id of selectedIds) {
        try {
          const response = await fetch(`/api/policy?id=${id}`, {
            method: 'DELETE',
          })
          const data = await response.json()

          if (data.success) {
            successCount++
          } else {
            failCount++
          }
        } catch (error) {
          console.error(`정책 삭제 실패 (ID: ${id}):`, error)
          failCount++
        }
      }

      if (failCount === 0) {
        alert(`${successCount}개의 정책이 삭제되었습니다.`)
      } else {
        alert(`${successCount}개 삭제 성공, ${failCount}개 삭제 실패`)
      }

      setSelectedIds([])
      setSelectAll(false)
      loadPolicies()
    } catch (error) {
      console.error('정책 일괄 삭제 실패:', error)
      alert('정책 삭제에 실패했습니다.')
    }
  }

  const truncateText = (text: string, maxLength: number = 50) => {
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + '...'
    }
    return text
  }

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        활성
      </span>
    ) : (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        비활성
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">정책 관리</h1>
          <p className="text-gray-600">
            AI가 게시물을 상품으로 변환할 때 참조하는 가격 정책을 관리합니다.
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
                    placeholder="정책 이름으로 검색..."
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
                  onClick={loadPolicies}
                  disabled={isLoading}
                >
                  <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                  새로고침
                </Button>
                <Button variant="primary" onClick={handleOpenAddModal}>
                  <Plus size={16} />
                  정책 추가
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDeleteSelected}
                  disabled={selectedIds.length === 0}
                >
                  <Trash2 size={16} />
                  선택 삭제 ({selectedIds.length})
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
                  <TableHead className="w-[5%]">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </TableHead>
                  <TableHead className="w-[20%]">이름</TableHead>
                  <TableHead className="w-[35%]">설명</TableHead>
                  <TableHead className="w-[10%]">상태</TableHead>
                  <TableHead className="w-[15%]">생성일</TableHead>
                  <TableHead className="w-[15%]">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.length === 0 ? (
                  <TableEmpty message="등록된 정책이 없습니다." colSpan={6} />
                ) : (
                  policies.map((policy) => (
                    <TableRow key={policy.id} className="hover:bg-gray-50">
                      <TableCell className="w-[5%]">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(policy.id)}
                          onChange={() => handleToggleSelection(policy.id)}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="w-[20%]">
                        <span className="font-medium text-gray-900">{policy.name}</span>
                      </TableCell>
                      <TableCell className="w-[35%]">
                        <span className="text-gray-600 text-sm">
                          {policy.description ? truncateText(policy.description) : '-'}
                        </span>
                      </TableCell>
                      <TableCell className="w-[10%]">
                        {getStatusBadge(policy.isActive)}
                      </TableCell>
                      <TableCell className="w-[15%]">
                        <span className="text-gray-600 text-sm">
                          {new Date(policy.createdAt).toLocaleDateString('ko-KR')}
                        </span>
                      </TableCell>
                      <TableCell className="w-[15%]">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditModal(policy)}
                          >
                            <Edit3 size={16} className="text-blue-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeletePolicy(policy.id)}
                          >
                            <Trash2 size={16} className="text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* 정책 추가/수정 모달 */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingPolicy ? '정책 수정' : '정책 추가'}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              정책 이름 <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="예: 가족도매방 정책"
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              설명
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="정책에 대한 간단한 설명을 입력하세요"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              정책 내용 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="예: 원가 그대로, 수집가격 기준 구간별 마진 적용 등"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={10}
            />
            <p className="text-xs text-gray-500 mt-1">
              AI가 가격을 계산할 때 참조하는 정책 내용을 입력하세요.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">
              활성화
            </label>
          </div>
        </div>

        <ModalFooter>
          <Button variant="secondary" onClick={handleCloseModal}>
            취소
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? '저장 중...' : editingPolicy ? '수정' : '등록'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
