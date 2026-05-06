/**
 * AI 채팅 — 통합 인박스 (작업지시서 §7.2)
 *
 * 좌측 패널: 메시지 리스트 (채널 아이콘 + 발신자 + 미리보기 + 시간 + 미읽음 뱃지)
 * 우측 패널: 대화 스레드 + AI 응답 영역 + 사장님 직접 입력
 */
'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  MessageSquare,
  Bot,
  AlertTriangle,
  Check,
  Sparkles,
  Send,
  RefreshCw,
  Plus,
  X,
} from 'lucide-react'

const CHANNEL_LABELS: Record<string, { label: string; color: string }> = {
  BAND_COMMENT: { label: '밴드댓글', color: 'bg-green-100 text-green-700' },
  BAND_CHAT: { label: '밴드채팅', color: 'bg-emerald-100 text-emerald-700' },
  KAKAO: { label: '카카오톡', color: 'bg-yellow-100 text-yellow-800' },
  SMS: { label: 'SMS', color: 'bg-blue-100 text-blue-700' },
}

const INTENT_LABELS: Record<string, string> = {
  ORDER: '🛒 주문',
  PRICE: '💰 가격',
  STOCK: '📦 재고',
  DELIVERY: '🚚 배송',
  PAYMENT: '💳 결제',
  DEPOSIT: '🏦 입금',
  RETURN: '↩️ 반품',
  COMPLAINT: '😡 불만',
  RESTOCK: '🔔 재입고',
  RECOMMEND: '⭐ 추천',
  INFO: 'ℹ️ 정보',
  GENERAL: '💬 잡담',
}

interface InboxMessage {
  id: number
  channel: string
  direction: 'INBOUND' | 'OUTBOUND'
  threadId: string
  senderId: string
  senderName: string | null
  content: string
  intent: string | null
  confidence: number | null
  aiReply: string | null
  isAutoReplied: boolean
  isEscalated: boolean
  escalateReason: string | null
  isRead: boolean
  createdAt: string
  repliedAt: string | null
  metadata: any
}

interface Stats {
  unreadCount: number
  escalatedCount: number
}

export default function InboxPage() {
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [stats, setStats] = useState<Stats>({ unreadCount: 0, escalatedCount: 0 })
  const [loading, setLoading] = useState(true)
  const [filterChannel, setFilterChannel] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [thread, setThread] = useState<InboxMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (filterChannel !== 'all') qs.set('channel', filterChannel)
      if (filterStatus !== 'all') qs.set('status', filterStatus)
      const res = await fetch(`/api/inbox/messages?${qs.toString()}`, {
        credentials: 'include',
      }).then((r) => r.json())
      if (res.success) {
        setMessages(res.data.messages || [])
        setStats(res.data.stats || { unreadCount: 0, escalatedCount: 0 })
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadThread(id: number) {
    setSelectedId(id)
    const res = await fetch(`/api/inbox/messages/${id}`, { credentials: 'include' }).then((r) =>
      r.json()
    )
    if (res.success) {
      setThread(res.data.thread || [])
      // 자동으로 읽음 처리
      if (res.data.message && !res.data.message.isRead) {
        await fetch(`/api/inbox/messages/${id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isRead: true }),
        })
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, isRead: true } : m))
        )
        setStats((s) => ({ ...s, unreadCount: Math.max(0, s.unreadCount - 1) }))
      }
    }
  }

  useEffect(() => {
    load()
  }, [filterChannel, filterStatus])

  const selected = useMemo(() => messages.find((m) => m.id === selectedId), [messages, selectedId])

  async function handleClassify(id: number) {
    setBusy(true)
    try {
      const res = await fetch(`/api/inbox/messages/${id}/classify`, {
        method: 'POST',
        credentials: 'include',
      }).then((r) => r.json())
      if (res.success) {
        await load()
        if (id === selectedId) await loadThread(id)
      } else alert(res.error || '실패')
    } finally {
      setBusy(false)
    }
  }

  async function handleGenerateReply(id: number, regenerate = false) {
    setBusy(true)
    try {
      const res = await fetch(`/api/inbox/messages/${id}/reply`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate }),
      }).then((r) => r.json())
      if (res.success) {
        if (id === selectedId) await loadThread(id)
        await load()
      } else alert(res.error || '실패')
    } finally {
      setBusy(false)
    }
  }

  async function handleMarkReplied(id: number) {
    setBusy(true)
    try {
      const res = await fetch(`/api/inbox/messages/${id}/reply`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markReplied: true }),
      }).then((r) => r.json())
      if (res.success) {
        await load()
        if (id === selectedId) await loadThread(id)
      } else alert(res.error || '실패')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-blue-500" />
            AI 통합 인박스
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            4채널 (밴드댓글/밴드채팅/카톡/SMS) 메시지를 한 곳에서 관리. AI가 의도 분류 + 응답
            생성합니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-600 flex items-center gap-3">
            <span>
              미읽음 <strong className="text-blue-600">{stats.unreadCount}</strong>
            </span>
            <span>
              에스컬레이션 <strong className="text-orange-600">{stats.escalatedCount}</strong>
            </span>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> 테스트 메시지
          </button>
          <button
            onClick={load}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" /> 새로고침
          </button>
        </div>
      </header>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <FilterTab label="전체 채널" active={filterChannel === 'all'} onClick={() => setFilterChannel('all')} />
        {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
          <FilterTab
            key={k}
            label={v.label}
            active={filterChannel === k}
            onClick={() => setFilterChannel(k)}
          />
        ))}
        <div className="ml-auto flex items-center gap-2">
          <FilterTab label="전체" active={filterStatus === 'all'} onClick={() => setFilterStatus('all')} small />
          <FilterTab label="미읽음" active={filterStatus === 'unread'} onClick={() => setFilterStatus('unread')} small />
          <FilterTab
            label="에스컬레이션"
            active={filterStatus === 'escalated'}
            onClick={() => setFilterStatus('escalated')}
            small
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-220px)]">
        {/* 좌측: 메시지 리스트 */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-gray-500 text-sm">로딩 중...</div>
          ) : messages.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-sm">메시지가 없습니다</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {messages.map((m) => (
                <MessageRow
                  key={m.id}
                  msg={m}
                  active={m.id === selectedId}
                  onClick={() => loadThread(m.id)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* 우측 (2 col): 스레드 + AI 패널 */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg overflow-y-auto flex flex-col">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              왼쪽에서 메시지를 선택하세요
            </div>
          ) : (
            <ThreadPanel
              selected={selected}
              thread={thread}
              busy={busy}
              onClassify={() => handleClassify(selected.id)}
              onGenerate={(regen) => handleGenerateReply(selected.id, regen)}
              onMarkReplied={() => handleMarkReplied(selected.id)}
            />
          )}
        </div>
      </div>

      {showAddModal && (
        <AddTestMessageModal
          onClose={() => setShowAddModal(false)}
          onCreated={async () => {
            setShowAddModal(false)
            await load()
          }}
        />
      )}
    </div>
  )
}

function FilterTab({
  label,
  active,
  onClick,
  small,
}: {
  label: string
  active: boolean
  onClick: () => void
  small?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`${small ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'} rounded-full font-medium ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-300'
      }`}
    >
      {label}
    </button>
  )
}

function MessageRow({
  msg,
  active,
  onClick,
}: {
  msg: InboxMessage
  active: boolean
  onClick: () => void
}) {
  const ch = CHANNEL_LABELS[msg.channel] || { label: msg.channel, color: 'bg-gray-100' }
  return (
    <li
      onClick={onClick}
      className={`p-3 cursor-pointer hover:bg-blue-50 transition-colors ${
        active ? 'bg-blue-100' : ''
      } ${!msg.isRead ? 'border-l-4 border-blue-500' : ''}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${ch.color}`}>{ch.label}</span>
        {msg.isEscalated && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 flex items-center gap-0.5">
            <AlertTriangle className="w-2.5 h-2.5" /> 에스컬
          </span>
        )}
        {msg.isAutoReplied && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-0.5">
            <Check className="w-2.5 h-2.5" /> 응답완료
          </span>
        )}
        {msg.intent && (
          <span className="text-[10px] text-gray-500">{INTENT_LABELS[msg.intent] || msg.intent}</span>
        )}
        <span className="ml-auto text-[10px] text-gray-400">
          {new Date(msg.createdAt).toLocaleString('ko-KR', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
      <div className="text-sm font-medium text-gray-900">{msg.senderName || msg.senderId}</div>
      <div className="text-xs text-gray-600 line-clamp-2 mt-0.5">{msg.content}</div>
    </li>
  )
}

function ThreadPanel({
  selected,
  thread,
  busy,
  onClassify,
  onGenerate,
  onMarkReplied,
}: {
  selected: InboxMessage
  thread: InboxMessage[]
  busy: boolean
  onClassify: () => void
  onGenerate: (regenerate: boolean) => void
  onMarkReplied: () => void
}) {
  return (
    <>
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold">{selected.senderName || selected.senderId}</span>
          <span className="text-xs text-gray-500">· {selected.threadId}</span>
        </div>
        {selected.isEscalated && selected.escalateReason && (
          <div className="text-xs text-orange-700 flex items-center gap-1 mt-1">
            <AlertTriangle className="w-3 h-3" /> {selected.escalateReason}
          </div>
        )}
      </div>

      {/* 스레드 메시지 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {thread.map((m) => (
          <ThreadMessage key={m.id} msg={m as InboxMessage} highlight={m.id === selected.id} />
        ))}
      </div>

      {/* AI 액션 영역 */}
      <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onClassify}
            disabled={busy}
            className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded flex items-center gap-1 disabled:opacity-50"
          >
            <Sparkles className="w-3 h-3" />
            {busy ? '처리 중...' : selected.intent ? '의도 재분류' : 'AI 의도 분류'}
          </button>
          {selected.intent && (
            <button
              onClick={() => onGenerate(false)}
              disabled={busy}
              className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-1 disabled:opacity-50"
            >
              <Bot className="w-3 h-3" />
              {selected.aiReply ? 'AI 응답 보기' : 'AI 응답 생성'}
            </button>
          )}
          {selected.aiReply && (
            <button
              onClick={() => onGenerate(true)}
              disabled={busy}
              className="px-3 py-1.5 text-xs bg-gray-200 hover:bg-gray-300 rounded flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw className="w-3 h-3" /> 재생성
            </button>
          )}
        </div>

        {selected.intent && (
          <div className="text-xs flex items-center gap-2">
            <span className="font-medium">{INTENT_LABELS[selected.intent] || selected.intent}</span>
            {selected.confidence != null && (
              <span className="text-gray-500">
                신뢰도 {(selected.confidence * 100).toFixed(0)}%
              </span>
            )}
          </div>
        )}

        {selected.aiReply && (
          <div className="bg-white border border-blue-200 rounded p-3">
            <div className="text-xs font-semibold text-blue-700 mb-1 flex items-center gap-1">
              <Bot className="w-3 h-3" /> AI 추천 응답
            </div>
            <pre className="text-sm whitespace-pre-wrap text-gray-800">{selected.aiReply}</pre>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(selected.aiReply || '')}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              >
                복사
              </button>
              <button
                onClick={onMarkReplied}
                disabled={busy || selected.isAutoReplied}
                className="px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded flex items-center gap-1 disabled:opacity-50"
              >
                <Send className="w-3 h-3" />
                {selected.isAutoReplied ? '발송완료' : '발송완료 표시'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function ThreadMessage({ msg, highlight }: { msg: InboxMessage; highlight: boolean }) {
  const isInbound = msg.direction === 'INBOUND'
  return (
    <div className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[70%] rounded-lg px-3 py-2 ${
          isInbound
            ? `bg-gray-100 text-gray-900 ${highlight ? 'ring-2 ring-blue-400' : ''}`
            : 'bg-blue-600 text-white'
        }`}
      >
        <div className="text-[10px] opacity-70 mb-0.5">
          {isInbound ? msg.senderName || msg.senderId : '셀러/AI'} ·{' '}
          {new Date(msg.createdAt).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
        <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
      </div>
    </div>
  )
}

function AddTestMessageModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [channel, setChannel] = useState('BAND_COMMENT')
  const [threadId, setThreadId] = useState('test-thread-1')
  const [senderId, setSenderId] = useState('test-user-1')
  const [senderName, setSenderName] = useState('테스트 고객')
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!content.trim()) return alert('메시지 내용을 입력하세요')
    setBusy(true)
    try {
      const res = await fetch('/api/inbox/messages', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, threadId, senderId, senderName, content }),
      }).then((r) => r.json())
      if (res.success) onCreated()
      else alert(res.error || '실패')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">테스트 메시지 추가</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">채널</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            >
              {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">스레드 ID</label>
              <input
                value={threadId}
                onChange={(e) => setThreadId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">발신자 ID</label>
              <input
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">발신자 이름</label>
            <input
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">메시지 내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              placeholder="예: 광어 2kg 하나 주세요"
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            취소
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
          >
            {busy ? '추가 중...' : '추가'}
          </button>
        </div>
      </div>
    </div>
  )
}
