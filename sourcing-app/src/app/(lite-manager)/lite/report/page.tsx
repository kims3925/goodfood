/**
 * Lite Report — 수익 리포트 카드 + 카톡/밴드 공유 (F3+F4) 실구현
 * - SVG 카드 미리보기 → Canvas 변환 → PNG 다운로드
 * - 공유 텍스트 자동 생성 (제목 + 마이샵 메인 URL)
 * - Web Share API 지원 시 네이티브 공유 시트
 */
'use client'

import { useEffect, useRef, useState } from 'react'

type Period = 'today' | 'week' | 'month'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: '오늘' },
  { value: 'week', label: '이번 주' },
  { value: 'month', label: '이번 달' },
]

export default function LiteReportPage() {
  const [period, setPeriod] = useState<Period>('today')
  const [svgUrl, setSvgUrl] = useState<string>('')
  const [shareText, setShareText] = useState<string>('')
  const [shopMainUrl, setShopMainUrl] = useState<string | null>(null)
  const [pngBusy, setPngBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // SVG URL — period 변경 시 cache busting
  useEffect(() => {
    setSvgUrl(`/api/lite/report/card.svg?period=${period}&t=${Date.now()}`)
  }, [period])

  // 공유 텍스트 + 마이샵 URL 로드 (대시보드 summary + shop info 활용)
  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/lite/dashboard/summary', { credentials: 'include' }).then((r) => r.json()),
      // 셀러의 첫 shop subdomain 가져오기 — 따로 endpoint 없으면 upload API 의 응답 패턴 차용
      // 여기선 dashboard summary 의 구조에서 fallback
    ])
      .then(([summary]) => {
        if (cancelled) return
        if (summary?.success) {
          const today = summary.data.revenue?.today || { totalAmount: 0, orderCount: 0 }
          const week = summary.data.revenue?.thisWeek || { totalAmount: 0, orderCount: 0 }
          const month = summary.data.revenue?.thisMonth || { totalAmount: 0, orderCount: 0 }
          const w =
            period === 'today' ? today : period === 'week' ? week : month
          const periodLabel = period === 'today' ? '오늘' : period === 'week' ? '이번 주' : '이번 달'
          const text = [
            `✨ ${periodLabel} ₩${(w.totalAmount as number).toLocaleString('ko-KR')} 매출 달성!`,
            `주문 ${w.orderCount}건${w.orderCount > 0 ? ` · 평균 ₩${Math.round((w.totalAmount as number) / w.orderCount).toLocaleString('ko-KR')}` : ''}`,
            '',
            '#SNSAUTO #체험판매',
          ].join('\n')
          setShareText(text)
        }
      })
      .catch(() => {})

    // 마이샵 메인 URL 별도 fetch — recommended-products 를 호출해도 alreadyListed 정보로 shop 알 수 없으므로,
    // upload API 응답의 shop.mainUrl 패턴을 별도 가져오기 위해 간단 endpoint 사용:
    fetch('/api/lite/orders?limit=1', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const sub = data?.data?.orders?.[0]?.shop?.subdomain
        const shopDomain =
          (typeof window !== 'undefined' && (window as any).__NEXT_PUBLIC_SHOP_DOMAIN__) ||
          'shop.abcpharm.net'
        if (sub) setShopMainUrl(`https://${shopDomain}/${sub}`)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [period])

  const downloadPng = async () => {
    setPngBusy(true)
    try {
      const res = await fetch(svgUrl, { credentials: 'include' })
      const svgText = await res.text()
      const blob = new Blob([svgText], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas')
        canvas.width = 720
        canvas.height = 720
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, 720, 720)
        ctx.drawImage(img, 0, 0, 720, 720)
        canvas.toBlob((pngBlob) => {
          if (!pngBlob) return
          const pngUrl = URL.createObjectURL(pngBlob)
          const a = document.createElement('a')
          a.href = pngUrl
          a.download = `snsauto-report-${period}-${Date.now()}.png`
          document.body.appendChild(a)
          a.click()
          a.remove()
          URL.revokeObjectURL(pngUrl)
          URL.revokeObjectURL(url)
        }, 'image/png')
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
      }
      img.src = url
    } catch (err) {
      console.error('PNG 변환 실패', err)
    } finally {
      setPngBusy(false)
    }
  }

  const copyShareText = async () => {
    const finalText = shopMainUrl ? `${shareText}\n\n🛒 ${shopMainUrl}` : shareText
    try {
      await navigator.clipboard.writeText(finalText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const nativeShare = async () => {
    const finalText = shopMainUrl ? `${shareText}\n\n🛒 ${shopMainUrl}` : shareText
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: 'SNSAUTO 매출 리포트',
          text: finalText,
          url: shopMainUrl || undefined,
        })
      } catch {}
    } else {
      copyShareText()
    }
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">수익 리포트</h1>
        <p className="text-sm text-gray-600 mt-1">
          오늘 번 돈을 한 장의 카드로. 카톡·밴드에 자랑해보세요 (자연스러운 바이럴)
        </p>
      </header>

      <div className="mb-4 flex items-center gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              period === p.value
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm font-semibold text-gray-700 mb-3">📸 카드 미리보기</div>
          <div className="aspect-square bg-gray-50 rounded-lg overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={svgUrl}
              alt="report card"
              className="w-full h-full object-contain"
              key={svgUrl}
            />
          </div>
          <canvas ref={canvasRef} width={720} height={720} className="hidden" />
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm font-semibold text-gray-700 mb-3">📤 공유</div>
            <textarea
              readOnly
              value={shareText + (shopMainUrl ? `\n\n🛒 ${shopMainUrl}` : '')}
              className="w-full h-32 text-xs p-2 bg-gray-50 border border-gray-200 rounded font-mono"
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={copyShareText}
                className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                {copied ? '✓ 복사됨' : '📋 텍스트 복사'}
              </button>
              <button
                onClick={downloadPng}
                disabled={pngBusy}
                className="px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
              >
                {pngBusy ? '변환 중...' : '🖼️ PNG 저장'}
              </button>
            </div>
            <button
              onClick={nativeShare}
              className="w-full mt-2 px-3 py-2 bg-yellow-500 text-white text-sm rounded hover:bg-yellow-600"
            >
              📱 카톡/밴드 공유 (모바일)
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <div className="text-sm font-semibold text-blue-900">💡 공유 흐름</div>
            <ol className="text-xs text-blue-700 mt-2 space-y-1 list-decimal list-inside">
              <li>📋 텍스트 복사 → 카톡/밴드 글쓰기에 붙여넣기</li>
              <li>🖼️ PNG 저장 → 함께 사진 첨부</li>
              <li>모바일: 📱 공유 버튼 → 네이티브 공유 시트</li>
            </ol>
          </div>

          <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
            <div className="text-sm font-semibold text-purple-900">⚡ Pro 차이점</div>
            <div className="text-xs text-purple-700 mt-1 leading-relaxed">
              Lite: 손으로 복사·공유 (학습)
              <br />
              Pro: 카톡 채널 + 밴드 자동 게시 + AI 카피 작성
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
