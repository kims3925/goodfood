/**
 * AI 채팅 — 자동응답 설정 (작업지시서 §7.3)
 * 의도 12종별 ON/OFF + 고정 템플릿 + 응답 지연 + 항상 에스컬레이션 토글
 */
'use client'

import { useEffect, useState } from 'react'
import { Bot, Save, Power, AlertTriangle, Beaker, Send, KeyRound, Radio, CheckCircle2, XCircle, Loader2 } from 'lucide-react'

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

interface TestResult {
  intent: string
  confidence: number
  reasoning: string
  productName?: string | null
  quantity?: number | null
  amount?: number | null
  replyDraft: string
  escalate: boolean
  reason: string | null
}

export default function InboxSettingsPage() {
  const [rows, setRows] = useState<ConfigRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savedKey, setSavedKey] = useState<string | null>(null)

  // 상단 상태 카드
  const [aiStatus, setAiStatus] = useState<{ hasKey: boolean; model: string | null } | null>(null)
  const [retailChannelCount, setRetailChannelCount] = useState<number | null>(null)

  // 테스트 섹션
  const [testMessage, setTestMessage] = useState('')
  const [testRunning, setTestRunning] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [testError, setTestError] = useState<string | null>(null)

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

  async function loadStatus() {
    try {
      const [aiRes, chRes] = await Promise.all([
        fetch('/api/inbox/ai-status', { credentials: 'include' }).then((r) => r.json()),
        fetch('/api/channel?kind=RETAIL&limit=200', { credentials: 'include' }).then((r) => r.json()),
      ])
      if (aiRes.success) setAiStatus({ hasKey: aiRes.data.hasKey, model: aiRes.data.model })
      if (chRes.success) {
        const active = (chRes.data || []).filter((c: any) => c.isActive !== false)
        setRetailChannelCount(active.length)
      }
    } catch {
      // 무시
    }
  }

  async function runTest() {
    const msg = testMessage.trim()
    if (!msg) {
      setTestError('테스트할 메시지를 입력하세요.')
      return
    }
    setTestError(null)
    setTestResult(null)
    setTestRunning(true)
    try {
      const res = await fetch('/api/inbox/test-classify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      }).then((r) => r.json())
      if (res.success) {
        setTestResult(res.data)
      } else {
        setTestError(res.error || '분류 실패')
      }
    } catch (e: any) {
      setTestError(e?.message || '네트워크 오류')
    } finally {
      setTestRunning(false)
    }
  }

  useEffect(() => {
    load()
    loadStatus()
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

      {/* 상단 활성 상태 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <div className="p-4 bg-white border border-gray-200 rounded-lg flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Radio className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1">
            <div className="text-xs text-gray-500">활성 AI 챗 채널 (소매밴드)</div>
            <div className="text-lg font-bold text-gray-900">
              {retailChannelCount === null ? '—' : `${retailChannelCount} 개`}
            </div>
          </div>
          <a
            href="/sourcing/channel/list"
            className="text-xs text-blue-600 hover:underline"
          >
            관리
          </a>
        </div>
        <div className="p-4 bg-white border border-gray-200 rounded-lg flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              aiStatus?.hasKey ? 'bg-green-100' : 'bg-orange-100'
            }`}
          >
            <KeyRound
              className={`w-5 h-5 ${aiStatus?.hasKey ? 'text-green-600' : 'text-orange-600'}`}
            />
          </div>
          <div className="flex-1">
            <div className="text-xs text-gray-500">Claude API 키</div>
            <div className="text-sm font-semibold text-gray-900">
              {aiStatus === null ? (
                '확인 중...'
              ) : aiStatus.hasKey ? (
                <span className="text-green-700">
                  등록됨 {aiStatus.model && <span className="text-xs text-gray-500">({aiStatus.model})</span>}
                </span>
              ) : (
                <span className="text-orange-700">미등록</span>
              )}
            </div>
          </div>
          <a
            href="/sourcing/settings/ai"
            className="text-xs text-blue-600 hover:underline"
          >
            {aiStatus?.hasKey ? '변경' : '등록'}
          </a>
        </div>
      </div>

      {/* 테스트 섹션 */}
      <section className="mb-6 bg-white border border-gray-200 rounded-lg p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900">
              <Beaker className="w-5 h-5 text-indigo-500" /> 분류 테스트
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              실제 고객 메시지처럼 입력하면 분류된 intent · 신뢰도 · AI 응답 초안 · 에스컬레이션 여부를 즉시 확인합니다. (DB 저장 X)
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !testRunning) runTest()
            }}
            placeholder='예: "포항물회 2개 보내주세요"'
            className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
            disabled={testRunning}
          />
          <button
            onClick={runTest}
            disabled={testRunning || !testMessage.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {testRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            분류 테스트
          </button>
        </div>

        {testError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-center gap-2">
            <XCircle className="w-4 h-4 flex-shrink-0" />
            {testError}
          </div>
        )}

        {testResult && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <div className="text-xs text-blue-700 mb-1">분류된 intent</div>
                <div className="font-bold text-blue-900">
                  {INTENT_LABELS[testResult.intent]?.label || testResult.intent}
                </div>
                <div className="text-[10px] text-blue-600 mt-0.5">{testResult.intent}</div>
              </div>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                <div className="text-xs text-gray-500 mb-1">신뢰도</div>
                <div className="font-bold text-gray-900">
                  {(testResult.confidence * 100).toFixed(0)}%
                </div>
                <div className="w-full h-1.5 bg-gray-200 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className={`h-full ${
                      testResult.confidence >= 0.6 ? 'bg-green-500' : 'bg-orange-500'
                    }`}
                    style={{ width: `${Math.round(testResult.confidence * 100)}%` }}
                  />
                </div>
              </div>
              <div
                className={`p-3 border rounded ${
                  testResult.escalate
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-green-50 border-green-200'
                }`}
              >
                <div
                  className={`text-xs mb-1 ${
                    testResult.escalate ? 'text-orange-700' : 'text-green-700'
                  }`}
                >
                  에스컬레이션
                </div>
                <div
                  className={`font-bold flex items-center gap-1 ${
                    testResult.escalate ? 'text-orange-900' : 'text-green-900'
                  }`}
                >
                  {testResult.escalate ? (
                    <>
                      <AlertTriangle className="w-4 h-4" />
                      사장님 검토 필요
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      자동 응답 가능
                    </>
                  )}
                </div>
                {testResult.reason && (
                  <div className="text-[10px] text-orange-700 mt-1">{testResult.reason}</div>
                )}
              </div>
            </div>

            <div className="p-3 bg-gray-50 border border-gray-200 rounded">
              <div className="text-xs text-gray-500 mb-1">분류 사유</div>
              <div className="text-sm text-gray-800">{testResult.reasoning || '—'}</div>
              {(testResult.productName || testResult.quantity || testResult.amount) && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {testResult.productName && (
                    <span className="px-2 py-0.5 bg-white border border-gray-200 rounded">
                      상품: <strong>{testResult.productName}</strong>
                    </span>
                  )}
                  {testResult.quantity != null && (
                    <span className="px-2 py-0.5 bg-white border border-gray-200 rounded">
                      수량: <strong>{testResult.quantity}</strong>
                    </span>
                  )}
                  {testResult.amount != null && (
                    <span className="px-2 py-0.5 bg-white border border-gray-200 rounded">
                      금액: <strong>{testResult.amount.toLocaleString('ko-KR')}원</strong>
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded">
              <div className="text-xs text-indigo-700 mb-1 flex items-center gap-1">
                <Bot className="w-3 h-3" /> 생성된 자동 응답 초안
              </div>
              <div className="text-sm text-gray-800 whitespace-pre-wrap">
                {testResult.replyDraft || '(응답 없음)'}
              </div>
            </div>
          </div>
        )}
      </section>

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
