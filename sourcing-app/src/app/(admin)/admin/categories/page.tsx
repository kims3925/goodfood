'use client'

/**
 * 어드민 — 카테고리 트리 관리 (B2B 공급몰 전환 STEP 1-2, 2026-06-11)
 *
 * 식품 도매 카테고리 트리(대/중/소 최대 3단계) CRUD.
 * Product.categoryId(문자열) = Category.code 매칭 — 카테고리별 상품 수 표시.
 * 상품이 있는 카테고리는 삭제 대신 비활성화 권장 (삭제는 API 에서 차단).
 */

import { useState, useEffect, useCallback } from 'react'
import {
  FolderTree,
  Plus,
  Trash2,
  Power,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Pencil,
  Check,
  X,
} from 'lucide-react'

interface CategoryNode {
  id: number
  code: string
  name: string
  parentId: number | null
  depth: number
  sortOrder: number
  isActive: boolean
  productCount: number
  children: CategoryNode[]
}

export default function AdminCategoriesPage() {
  const [tree, setTree] = useState<CategoryNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [actionId, setActionId] = useState<number | null>(null)

  // 추가 폼 (parentId=null 이면 대분류)
  const [addingUnder, setAddingUnder] = useState<number | null | 'root'>(null)
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 인라인 이름 수정
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/categories', { credentials: 'include' }).then((r) => r.json())
      if (!res.success) throw new Error(res.error || '카테고리 조회 실패')
      setTree(res.data || [])
      // 첫 로드 시 대분류 모두 펼침
      setExpanded((prev) => {
        if (prev.size > 0) return prev
        return new Set<number>((res.data || []).map((n: CategoryNode) => n.id))
      })
    } catch (e: any) {
      setError(e?.message || '조회 실패')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleCreate(parentId: number | null) {
    if (!newCode.trim() || !newName.trim()) {
      alert('코드와 이름을 입력해 주세요.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: newCode.trim(), name: newName.trim(), parentId }),
      }).then((r) => r.json())
      if (!res.success) throw new Error(res.error || '생성 실패')
      setAddingUnder(null)
      setNewCode('')
      setNewName('')
      if (parentId) setExpanded((prev) => new Set(prev).add(parentId))
      await load()
    } catch (e: any) {
      alert(e?.message || '생성 실패')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRename(id: number) {
    if (!editName.trim()) return
    setActionId(id)
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      }).then((r) => r.json())
      if (!res.success) throw new Error(res.error || '수정 실패')
      setEditingId(null)
      await load()
    } catch (e: any) {
      alert(e?.message || '수정 실패')
    } finally {
      setActionId(null)
    }
  }

  async function handleToggleActive(node: CategoryNode) {
    setActionId(node.id)
    try {
      const res = await fetch(`/api/admin/categories/${node.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !node.isActive }),
      }).then((r) => r.json())
      if (!res.success) throw new Error(res.error || '변경 실패')
      await load()
    } catch (e: any) {
      alert(e?.message || '변경 실패')
    } finally {
      setActionId(null)
    }
  }

  async function handleDelete(node: CategoryNode) {
    if (!confirm(`'${node.name}' (${node.code}) 카테고리를 삭제할까요?\n하위 카테고리나 소속 상품이 있으면 삭제되지 않습니다.`)) {
      return
    }
    setActionId(node.id)
    try {
      const res = await fetch(`/api/admin/categories/${node.id}`, {
        method: 'DELETE',
        credentials: 'include',
      }).then((r) => r.json())
      if (!res.success) throw new Error(res.error || '삭제 실패')
      await load()
    } catch (e: any) {
      alert(e?.message || '삭제 실패')
    } finally {
      setActionId(null)
    }
  }

  function renderAddForm(parentId: number | null) {
    return (
      <div className="flex flex-wrap items-center gap-2 py-2 pl-2">
        <input
          value={newCode}
          onChange={(e) => setNewCode(e.target.value.toUpperCase())}
          placeholder="코드 (예: SEA_FISH)"
          className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm w-44 font-mono"
        />
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="이름"
          className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm w-40"
        />
        <button
          onClick={() => handleCreate(parentId)}
          disabled={submitting}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg flex items-center gap-1 disabled:opacity-50"
        >
          {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
          추가
        </button>
        <button
          onClick={() => {
            setAddingUnder(null)
            setNewCode('')
            setNewName('')
          }}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm rounded-lg"
        >
          취소
        </button>
      </div>
    )
  }

  function renderNode(node: CategoryNode) {
    const hasChildren = node.children.length > 0
    const isExpanded = expanded.has(node.id)
    const busy = actionId === node.id

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-gray-50 group ${
            !node.isActive ? 'opacity-50' : ''
          }`}
          style={{ paddingLeft: `${(node.depth - 1) * 28 + 8}px` }}
        >
          <button
            onClick={() => toggleExpand(node.id)}
            className={`w-5 h-5 flex items-center justify-center text-gray-400 ${hasChildren ? '' : 'invisible'}`}
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          <span className="font-mono text-xs text-gray-400 w-36 truncate">{node.code}</span>

          {editingId === node.id ? (
            <span className="flex items-center gap-1.5">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRename(node.id)}
                className="px-2 py-1 border border-indigo-300 rounded text-sm w-40"
                autoFocus
              />
              <button onClick={() => handleRename(node.id)} className="text-indigo-600 hover:text-indigo-800">
                <Check size={15} />
              </button>
              <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                <X size={15} />
              </button>
            </span>
          ) : (
            <span className={`text-sm font-medium ${node.depth === 1 ? 'text-gray-900' : 'text-gray-700'}`}>
              {node.name}
            </span>
          )}

          {!node.isActive && (
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-gray-200 text-gray-500">비활성</span>
          )}
          {node.productCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-blue-100 text-blue-600">
              상품 {node.productCount}
            </span>
          )}

          <span className="flex-1" />

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {node.depth < 3 && (
              <button
                onClick={() => {
                  setAddingUnder(node.id)
                  setNewCode(`${node.code}_`)
                  setNewName('')
                }}
                title="하위 카테고리 추가"
                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
              >
                <Plus size={15} />
              </button>
            )}
            <button
              onClick={() => {
                setEditingId(node.id)
                setEditName(node.name)
              }}
              title="이름 수정"
              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => handleToggleActive(node)}
              disabled={busy}
              title={node.isActive ? '비활성화' : '활성화'}
              className={`p-1.5 rounded ${
                node.isActive
                  ? 'text-green-500 hover:text-gray-500 hover:bg-gray-100'
                  : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
              }`}
            >
              <Power size={14} />
            </button>
            <button
              onClick={() => handleDelete(node)}
              disabled={busy}
              title="삭제"
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {addingUnder === node.id && (
          <div style={{ paddingLeft: `${node.depth * 28 + 8}px` }}>{renderAddForm(node.id)}</div>
        )}

        {isExpanded && node.children.map((child) => renderNode(child))}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-100 rounded-xl">
            <FolderTree className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">카테고리 관리</h1>
            <p className="text-sm text-gray-500">
              식품 도매 카테고리 트리 (최대 3단계) — 상품 categoryId 는 코드로 연결됩니다
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setAddingUnder('root')
              setNewCode('')
              setNewName('')
            }}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg flex items-center gap-1.5"
          >
            <Plus size={15} />
            대분류 추가
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {addingUnder === 'root' && (
        <div className="mb-2 p-2 bg-indigo-50/50 border border-indigo-100 rounded-lg">{renderAddForm(null)}</div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-3">
        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">불러오는 중...</div>
        ) : tree.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            카테고리가 없습니다. db 폴더에서 <code className="font-mono">node scripts/seed-categories.cjs</code> 를
            실행하거나 대분류를 추가해주세요.
          </div>
        ) : (
          tree.map((node) => renderNode(node))
        )}
      </div>
    </div>
  )
}
