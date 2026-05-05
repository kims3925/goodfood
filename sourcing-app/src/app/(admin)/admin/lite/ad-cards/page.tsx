/**
 * 어드민 — 라이트 셀러 광고카드 발행 (3×3 콜라주)
 *
 * 흐름:
 * 1. 라이트 셀러 선택
 * 2. 광고카드 생성 (서버: 9개 상품 → PNG)
 * 3. 미리보기 + 채널별 공유 (카톡/인스타/밴드)
 *    - 카톡: 텍스트 클립보드 + PNG 다운로드
 *    - 인스타: 캡션 클립보드 + PNG 다운로드
 *    - 밴드: 본문 클립보드 + PNG 다운로드 (수동 발행)
 */
'use client'

import { useEffect, useState } from 'react'
import { Megaphone, Download, Copy, Check, RefreshCw, ShoppingBag } from 'lucide-react'

interface SellerListItem {
  id: number
  email: string
  name: string | null
  shops: Array<{ id: number; name: string; subdomain: string }>
}

interface GenerateResult {
  imageUrl: string
  shopUrl: string
  products: Array<{ id: number; name: string; priceText: string; imageUrl: string }>
  shareText: {
    shopUrl: string
    kakao: string
    insta: string
    band: string
  }
}

export default function AdminLiteAdCardsPage() {
  const [sellers, setSellers] = useState<SellerListItem[]>([])
  const [loadingSellers, setLoadingSellers] = useState(true)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/lite/sellers', { credentials: 'include' })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setSellers(res.data || [])
      })
      .finally(() => setLoadingSellers(false))
  }, [])

  async function handleGenerate() {
    if (!selectedUserId) return
    setError(null)
    setResult(null)
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/lite/ad-cards/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId }),
      }).then((r) => r.json())
      if (res.success) setResult(res.data)
      else setError(res.error || '생성 실패')
    } catch (err: any) {
      setError(err?.message || '생성 실패')
    } finally {
      setGenerating(false)
    }
  }

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1500)
    } catch {
      alert('클립보드 복사 실패')
    }
  }

  function downloadImage() {
    if (!result) return
    const a = document.createElement('a')
    a.href = result.imageUrl
    a.download = `ad-card-${selectedUserId}-${Date.now()}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const selectedSeller = sellers.find((s) => s.id === selectedUserId)

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-pink-500" /> 라이트 광고카드 발행
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          라이트 셀러 쇼핑몰의 9개 상품을 3×3 콜라주 PNG로 합성하여 카톡/인스타/밴드에 발행합니다.
        </p>
      </header>

      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">1. 라이트 셀러 선택</h2>
        {loadingSellers && <div className="text-sm text-gray-500">로딩 중...</div>}
        {!loadingSellers && sellers.length === 0 && (
          <div className="text-sm text-gray-500">라이트 셀러가 없습니다.</div>
        )}
        {!loadingSellers && sellers.length > 0 && (
          <select
            value={selectedUserId ?? ''}
            onChange={(e) => {
              setSelectedUserId(e.target.value ? Number(e.target.value) : null)
              setResult(null)
              setError(null)
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          >
            <option value="">선택하세요</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id} disabled={s.shops.length === 0}>
                {s.shops[0]?.name || '(쇼핑몰 없음)'} — {s.email}
              </option>
            ))}
          </select>
        )}

        {selectedSeller && (
          <div className="mt-3 p-3 bg-blue-50 rounded text-xs text-blue-900 flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" />
            {selectedSeller.shops[0]?.name} (/{selectedSeller.shops[0]?.subdomain})
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={!selectedUserId || generating}
          className="mt-4 px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded disabled:opacity-50 flex items-center gap-2"
        >
          {generating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> 합성 중... (10-20초 소요)
            </>
          ) : (
            <>
              <Megaphone className="w-4 h-4" /> 광고카드 생성
            </>
          )}
        </button>

        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 미리보기 */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">2. 미리보기 (3×3)</h2>
            <img
              src={result.imageUrl}
              alt="광고카드"
              className="w-full rounded border border-gray-200"
            />
            <button
              onClick={downloadImage}
              className="mt-3 w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" /> PNG 다운로드
            </button>
            <div className="mt-3 text-xs text-gray-500">
              쇼핑몰 URL: <span className="font-mono">{result.shopUrl}</span>
            </div>
          </div>

          {/* 공유 텍스트 */}
          <div className="space-y-4">
            <ChannelCard
              channel="kakao"
              title="📱 카카오톡"
              accent="bg-yellow-100 border-yellow-300"
              text={result.shareText.kakao}
              copied={copiedKey === 'kakao'}
              onCopy={() => copyText('kakao', result.shareText.kakao)}
              hint="아래 텍스트와 PNG를 카카오톡 채널이나 단톡방에 붙여넣어 발행하세요."
            />
            <ChannelCard
              channel="insta"
              title="📷 인스타그램"
              accent="bg-pink-100 border-pink-300"
              text={result.shareText.insta}
              copied={copiedKey === 'insta'}
              onCopy={() => copyText('insta', result.shareText.insta)}
              hint="PNG 다운로드 후 모바일 인스타그램 앱에서 게시. 캡션은 클립보드에 복사됩니다."
            />
            <ChannelCard
              channel="band"
              title="🎵 네이버 밴드"
              accent="bg-green-100 border-green-300"
              text={result.shareText.band}
              copied={copiedKey === 'band'}
              onCopy={() => copyText('band', result.shareText.band)}
              hint="본문을 복사한 후 PNG 첨부하여 밴드 게시글로 작성하세요."
            />
          </div>
        </div>
      )}
    </div>
  )
}

function ChannelCard({
  title,
  accent,
  text,
  copied,
  onCopy,
  hint,
}: {
  channel: string
  title: string
  accent: string
  text: string
  copied: boolean
  onCopy: () => void
  hint: string
}) {
  return (
    <div className={`border rounded-lg p-4 ${accent}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button
          onClick={onCopy}
          className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-green-600" /> 복사됨
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" /> 복사
            </>
          )}
        </button>
      </div>
      <pre className="text-xs whitespace-pre-wrap bg-white p-3 rounded border border-gray-200 max-h-40 overflow-y-auto">
        {text}
      </pre>
      <p className="text-xs text-gray-700 mt-2">{hint}</p>
    </div>
  )
}
