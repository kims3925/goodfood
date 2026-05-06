/**
 * AI 채팅 — 자동응답 설정 (작업지시서 §7.3)
 * 의도 12종별 ON/OFF + 고정 템플릿 + 응답 지연 + 항상 에스컬레이션 토글
 */
'use client'

import { useEffect, useState } from 'react'
import { Bot, Save, Power, AlertTriangle } from 'lucide-react'

const INTENT_LABELS: Record<string, { label: string; desc: string }> = {
  ORDER: { label: '🛒 주문하기', desc: '주문 의사 표현' },
  PRICE: { label: '💰 가격문의', desc: '가격/배송비 문의' },
  STOCK: { label: '📦 재고문의', desc: '재고 보유 여부' },
  DELIVERY: { label: '🚚 배송문의', desc: '배송 상태 확인' },
  PAYMENT: { label: '💳 결제안내', desc: '결제 방법 안내' },
  DEPOSIT: { label: '🏦 입금확인', desc: '입금 완료 알림' },
  RETURN: { label: '↩️ 교환/반품', desc: '교환/반품 요청' },
  COMPLAINT: { label: '😡 불만/컴플레인', desc: '불만 표시' },
  RESTOCK: { label: '🔔 재입고알림', desc: '재입고 알림 신청' },
  RECOMMEND: { label: '⭐ 추천/상담', desc: '상품 추천 요청' },
  INFO: { label: 'ℹ️ 영업정보', desc: '영업시간/위치/연락처' },
  GENERAL: { label: '💬 인사/잡담', desc: '일반 인사말' },
}

interface ConfigRow {
  id: number
  intent: string
  isEnabled: boolean
  template: string | null
  aiPromptHint: string | null
  escalateAlways: boolean
  replyDelaySec: number
  maxAutoRetries: number
  dirty?: boolean
}

export default function InboxSettingsPage() {
  const [rows, setRows] = useState<ConfigRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savedKey, setSavedKey] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/inbox/config', { credentials: 'include' }).then((r) => r.json())
      if (res.success) {
        setRows((res.data || []).map((r: ConfigRow) => ({ ...r, dirty: false })))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function update(intent: string, patch: Partial<ConfigRow>) {
    setRows((prev) =>
      prev.map((r) => (r.intent === intent ? { ...r, ...patch, dirty: true } : r))
    )
  }

  async function save(intent: string) {
    const r = rows.find((x) => x.intent === intent)
    if (!r) return
    const res = await fetch('/api/inbox/config', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: r.intent,
        isEnabled: r.isEnabled,
        template: r.template,
        aiPromptHint: r.aiPromptHint,
        escalateAlways: r.escalateAlways,
        replyDelaySec: r.replyDelaySec,
        maxAutoRetries: r.maxAutoRetries,
      }),
    }).then((x) => x.json())
    if (res.success) {
      setRows((prev) =>
        prev.map((x) => (x.intent === intent ? { ...x, dirty: false } : x))
      )
      setSavedKey(intent)
      setTimeout(() => setSavedKey(null), 1500)
    } else {
      alert(res.error || '저장 실패')
    }
  }

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="w-6 h-6 text-blue-500" /> AI 자동응답 설정
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          의도 12종별 자동응답 활성화 / 고정 템플릿 / 사장님 검토 강제 여부 / 응답 지연 시간을
          설정합니다.
        </p>
      </header>

      {loading && <div className="text-center text-gray-500 py-12">로딩 중...</div>}

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rows.map((r) => {
            const lab = INTENT_LABELS[r.intent] || { label: r.intent, desc: '' }
            return (
              <div
                key={r.intent}
                className={`bg-white border rounded-lg p-4 ${
                  r.isEnabled ? 'border-gray-200' : 'border-gray-300 opacity-70'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{lab.label}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{lab.desc}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => update(r.intent, { isEnabled: !r.isEnabled })}
                      className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
                        r.isEnabled
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      <Power className="w-3 h-3" />
                      {r.isEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={r.escalateAlways}
                      onChange={(e) => update(r.intent, { escalateAlways: e.target.checked })}
                    />
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-orange-500" />
                      항상 사장님 검토 (자동응답 후 알림)
                    </span>
                  </label>

                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">응답 지연</span>
                    <input
                      type="number"
                      min={0}
                      max={600}
                      value={r.replyDelaySec}
                      onChange={(e) =>
                        update(r.intent, {
                          replyDelaySec: Math.max(0, Math.min(600, Number(e.target.value))),
                        })
                      }
                      className="w-16 px-2 py-1 border border-gray-300 rounded"
                    />
                    <span className="text-gray-500">초 (자연스러운 대화 연출)</span>
                  </div>

                  <div>
                    <label className="block text-gray-600 mb-1">고정 템플릿 (있으면 AI 대체)</label>
                    <textarea
                      value={r.template || ''}
                      onChange={(e) => update(r.intent, { template: e.target.value })}
                      rows={2}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                      placeholder="비워두면 AI 가 매번 새로 생성합니다"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-600 mb-1">AI 프롬프트 보강 메모</label>
                    <input
                      value={r.aiPromptHint || ''}
                      onChange={(e) => update(r.intent, { aiPromptHint: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                      placeholder="예: 가족도매방 정책 적용, 무료배송 강조"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-gray-400">
                      {savedKey === r.intent && '✓ 저장됨'}
                    </span>
                    <button
                      onClick={() => save(r.intent)}
                      disabled={!r.dirty}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <Save className="w-3 h-3" />
                      저장
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
        <h3 className="text-sm font-semibold text-blue-900 mb-1">💡 운영 팁</h3>
        <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
          <li>처음 며칠은 모든 의도를 OFF 로 두고 통합 인박스에서 AI 응답 품질을 검토하세요.</li>
          <li>품질이 안정되면 GENERAL/INFO/RESTOCK 부터 ON 으로 전환을 추천합니다.</li>
          <li>RETURN/COMPLAINT 는 항상 사장님 검토 강제로 두는 것이 안전합니다.</li>
          <li>응답 지연은 30초~1분 정도가 자연스럽습니다 (즉시 응답은 봇 티가 남).</li>
        </ul>
      </div>
    </div>
  )
}
