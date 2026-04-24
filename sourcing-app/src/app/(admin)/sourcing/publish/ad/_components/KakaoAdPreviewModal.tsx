'use client'

import { useEffect, useState } from 'react'
import { X, Download, Edit2, RefreshCw } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import Button from '@/components/ui/Button'

export interface KakaoAdCard {
  id: number
  productId: number
  title: string
  titleColor: string
  subtitle: string
  bannerText: string | null
  ribbonText: string | null
  saleBadge: boolean
  productName: string
  descriptionHtml: string
  priceText: string
  sourceImageUrl: string
  previewUrl: string
  hasRendered?: boolean
  aiGenerated?: boolean
  sendStatus?: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  cards: KakaoAdCard[]
  batchId: number | null
  onCardUpdated: (card: KakaoAdCard) => void
}

const COLORS = [
  { value: 'red', label: '🔴 빨강' },
  { value: 'blue', label: '🔵 파랑' },
  { value: 'green', label: '🟢 녹색' },
] as const

export default function KakaoAdPreviewModal({ isOpen, onClose, cards, batchId, onCardUpdated }: Props) {
  const toast = useToast()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState<Partial<KakaoAdCard>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [previewVersions, setPreviewVersions] = useState<Record<number, number>>({})

  useEffect(() => {
    if (!isOpen) {
      setEditingId(null)
      setDraft({})
    }
  }, [isOpen])

  if (!isOpen) return null

  const editing = editingId ? cards.find((c) => c.id === editingId) : null

  const startEdit = (card: KakaoAdCard) => {
    setEditingId(card.id)
    setDraft({
      title: card.title,
      titleColor: card.titleColor,
      subtitle: card.subtitle,
      bannerText: card.bannerText,
      ribbonText: card.ribbonText,
      saleBadge: card.saleBadge,
      descriptionHtml: card.descriptionHtml,
      priceText: card.priceText,
    })
  }

  const saveEdit = async () => {
    if (!editing) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/ad/kakao/card/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error || '저장 실패')
        return
      }
      const updated: KakaoAdCard = {
        ...editing,
        ...draft,
        ...data.card,
        previewUrl: editing.previewUrl,
      } as KakaoAdCard
      onCardUpdated(updated)
      setPreviewVersions((prev) => ({ ...prev, [editing.id]: (prev[editing.id] || 0) + 1 }))
      setEditingId(null)
      setDraft({})
      toast.success('저장 완료. 미리보기 재합성됨.')
    } catch (err: any) {
      toast.error(err?.message || '네트워크 오류')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDownload = async () => {
    if (cards.length === 0) return
    setIsDownloading(true)
    try {
      const body: any = batchId ? { batchId, mode: 'zip' } : { cardIds: cards.map((c) => c.id), mode: 'zip' }
      const res = await fetch('/api/ad/kakao/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        toast.error(`다운로드 실패: ${errText || res.status}`)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kakao-ads-${new Date().toISOString().slice(0, 10)}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(`광고 카드 ${cards.length}장 ZIP 다운로드 완료`)
    } catch (err: any) {
      toast.error(err?.message || '다운로드 오류')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-stretch justify-center overflow-auto">
      <div className="bg-white w-full max-w-6xl mt-8 mb-8 mx-4 rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-64px)]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-900">📱 카카오톡 광고 카드 미리보기</h2>
            <span className="text-sm text-gray-500">{cards.length}/{cards.length} 생성 완료</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-md">
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {cards.map((card, idx) => {
              const v = previewVersions[card.id] || 0
              return (
                <div
                  key={card.id}
                  className="border border-gray-200 rounded-lg overflow-hidden bg-white hover:shadow-md transition-shadow"
                >
                  <div className="relative aspect-[9/16] bg-gray-100">
                    <img
                      src={`${card.previewUrl}?v=${v}`}
                      alt={card.title}
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                    {!card.aiGenerated && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 text-[10px] font-bold bg-yellow-500 text-white rounded">
                        AI 실패 — 수동 편집
                      </span>
                    )}
                  </div>
                  <div className="p-2 text-xs space-y-1">
                    <div className="font-semibold text-gray-900 truncate">{idx + 1}. {card.title}</div>
                    <div className="text-gray-500 truncate">{card.productName}</div>
                    <button
                      onClick={() => startEdit(card)}
                      className="w-full mt-1 px-2 py-1.5 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded flex items-center justify-center gap-1"
                    >
                      <Edit2 size={12} /> 편집
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {editing && (
            <div className="mt-6 border-2 border-blue-500 rounded-lg p-4 bg-blue-50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-blue-900">카드 #{cards.findIndex((c) => c.id === editing.id) + 1} 편집</h3>
                <button onClick={() => setEditingId(null)} className="text-sm text-gray-600 hover:text-gray-900">
                  취소
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">타이틀 (20자 내외)</label>
                  <input
                    type="text"
                    value={draft.title || ''}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                    maxLength={50}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">색상</label>
                  <div className="flex gap-2">
                    {COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setDraft({ ...draft, titleColor: c.value })}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          (draft.titleColor || editing.titleColor) === c.value
                            ? c.value === 'red'
                              ? 'bg-red-500 text-white'
                              : c.value === 'blue'
                              ? 'bg-blue-600 text-white'
                              : 'bg-green-600 text-white'
                            : 'bg-white border border-gray-300 text-gray-700'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">서브타이틀 (30자 내외)</label>
                  <input
                    type="text"
                    value={draft.subtitle || ''}
                    onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                    maxLength={100}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">리본 배지 (선택)</label>
                  <input
                    type="text"
                    value={draft.ribbonText || ''}
                    onChange={(e) => setDraft({ ...draft, ribbonText: e.target.value || null })}
                    placeholder="예: 국내산100% (비워두면 미표시)"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                    maxLength={50}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">강조 배너 (선택)</label>
                  <input
                    type="text"
                    value={draft.bannerText || ''}
                    onChange={(e) => setDraft({ ...draft, bannerText: e.target.value || null })}
                    placeholder="예: 프리미엄 국내산 100%"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                    maxLength={100}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer mt-6">
                    <input
                      type="checkbox"
                      checked={!!draft.saleBadge}
                      onChange={(e) => setDraft({ ...draft, saleBadge: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                    />
                    <span>행사상품 배지 표시</span>
                  </label>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">본문 (200자 내외, 줄바꿈 허용)</label>
                  <textarea
                    value={draft.descriptionHtml || ''}
                    onChange={(e) => setDraft({ ...draft, descriptionHtml: e.target.value })}
                    rows={6}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md font-mono"
                    maxLength={500}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">가격 라인</label>
                  <input
                    type="text"
                    value={draft.priceText || ''}
                    onChange={(e) => setDraft({ ...draft, priceText: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                    maxLength={200}
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  취소
                </button>
                <Button variant="primary" onClick={saveEdit} loading={isSaving}>
                  <RefreshCw size={14} /> 저장 + 재합성
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-5 py-3 bg-gray-50 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            ZIP 다운로드 후 카카오톡 채널에 수동 첨부해 발송하세요.
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>닫기</Button>
            <Button
              variant="primary"
              onClick={handleDownload}
              loading={isDownloading}
              disabled={cards.length === 0}
            >
              <Download size={16} /> 📦 ZIP 다운로드 ({cards.length}장)
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
