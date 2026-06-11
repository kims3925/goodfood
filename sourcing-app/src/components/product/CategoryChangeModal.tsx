'use client'

/**
 * 카테고리 일괄 변경 모달 (2026-06-12)
 * - 선택한 상품들의 categoryId(=Category.code)를 일괄 변경
 * - 기존 카테고리 트리에서 선택 또는 신규 카테고리 즉석 생성(POST /api/admin/categories)
 * - 적용: POST /api/product/bulk-category
 */

import { useState, useEffect, useCallback } from 'react'
import Modal, { ModalFooter } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'

interface CategoryNode {
  id: number
  code: string
  name: string
  parentId: number | null
  depth: number
  isActive: boolean
  children: CategoryNode[]
}

interface Props {
  productIds: number[]
  onClose: () => void
  onDone: () => void
}

function flatten(nodes: CategoryNode[], acc: { code: string; label: string; isActive: boolean }[] = [], depth = 0) {
  for (const n of nodes) {
    acc.push({ code: n.code, label: `${' '.repeat(depth * 4)}${n.name} (${n.code})`, isActive: n.isActive })
    if (n.children?.length) flatten(n.children, acc, depth + 1)
  }
  return acc
}

export default function CategoryChangeModal({ productIds, onClose, onDone }: Props) {
  const toast = useToast()
  const [tree, setTree] = useState<CategoryNode[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedCode, setSelectedCode] = useState('')
  const [createMode, setCreateMode] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [newParentId, setNewParentId] = useState<string>('')

  const loadTree = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/categories')
      const data = await res.json()
      if (data.success) setTree(data.data || [])
      else toast.error(data.error || '카테고리 조회 실패')
    } catch {
      toast.error('카테고리 조회 중 오류')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadTree() }, [loadTree])

  const flat = flatten(tree)
  const flatById: { id: number; label: string }[] = []
  const walk = (nodes: CategoryNode[], depth = 0) => {
    for (const n of nodes) {
      flatById.push({ id: n.id, label: `${' '.repeat(depth * 4)}${n.name} (${n.code})` })
      if (n.children?.length) walk(n.children, depth + 1)
    }
  }
  walk(tree)

  const handleApply = async () => {
    let code = selectedCode
    setSaving(true)
    try {
      // 신규 카테고리 생성 모드면 먼저 생성
      if (createMode) {
        if (!newCode.trim() || !newName.trim()) {
          toast.error('신규 카테고리의 코드와 이름을 입력해주세요.')
          setSaving(false)
          return
        }
        const createRes = await fetch('/api/admin/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: newCode.trim().toUpperCase(),
            name: newName.trim(),
            parentId: newParentId ? Number(newParentId) : undefined,
          }),
        })
        const created = await createRes.json()
        if (!created.success) {
          toast.error(created.error || '카테고리 생성 실패')
          setSaving(false)
          return
        }
        code = created.data?.code || newCode.trim().toUpperCase()
      }
      if (!code) {
        toast.error('변경할 카테고리를 선택해주세요.')
        setSaving(false)
        return
      }
      const res = await fetch('/api/product/bulk-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds, categoryId: code }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`${data.updated}개 상품의 카테고리를 변경했습니다.`)
        onDone()
        onClose()
      } else {
        toast.error(data.error || '카테고리 변경 실패')
      }
    } catch {
      toast.error('카테고리 변경 중 오류')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={`카테고리 변경 (${productIds.length}개 상품)`}>
      <div className="space-y-4">
        {/* 모드 토글 */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCreateMode(false)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${!createMode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
          >
            기존 카테고리 선택
          </button>
          <button
            type="button"
            onClick={() => setCreateMode(true)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${createMode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
          >
            + 신규 카테고리 생성
          </button>
        </div>

        {!createMode ? (
          loading ? (
            <p className="text-sm text-gray-500 py-4">카테고리 불러오는 중...</p>
          ) : (
            <select
              value={selectedCode}
              onChange={(e) => setSelectedCode(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">카테고리 선택...</option>
              {flat.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}{!c.isActive ? ' [숨김]' : ''}
                </option>
              ))}
            </select>
          )
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">상위 카테고리 (선택)</label>
              <select
                value={newParentId}
                onChange={(e) => setNewParentId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">(최상위)</option>
                {flatById.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">코드 (영문대문자/숫자/_, 예: SEA_CRAB)</label>
              <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="NEW_CODE" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">이름</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="예: 갑각류" />
            </div>
          </div>
        )}
      </div>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={saving}>취소</Button>
        <Button onClick={handleApply} disabled={saving}>{saving ? '적용 중...' : '적용'}</Button>
      </ModalFooter>
    </Modal>
  )
}
