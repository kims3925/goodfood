/**
 * /sourcing/order/external — 외부주문 간소화 입력 페이지 (Phase 4)
 *
 * - [소매주문] / [도매발주] 라디오
 * - 자유 텍스트 영역
 * - 발신자 이름/전화 (선택)
 * - "주문 추출+등록" 버튼 → POST /api/order/external/from-text
 */
'use client'

import { useState } from 'react'
import Link from 'next/link'

type ExternalKind = 'RETAIL' | 'WHOLESALE'

interface SubmitResult {
  orderId: number
  orderNumber: string
  totalAmount: number
  matchedShopProductIds: number[]
  unmatchedNames: string[]
  extracted: any
}

export default function ExternalOrderPage() {
  const [externalKind, setExternalKind] = useState<ExternalKind>('RETAIL')
  const [rawText, setRawText] = useState('')
  const [senderName, setSenderName] = useState('')
  const [senderPhone, setSenderPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!rawText.trim()) {
      setError('주문 텍스트를 입력해 주세요.')
      return
    }
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/order/external/from-text', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalKind,
          rawText,
          senderName: senderName.trim() || undefined,
          senderPhone: senderPhone.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || '등록 실패')
        return
      }
      setResult(json.data)
    } catch (err: any) {
      setError(err?.message || '등록 실패')
    } finally {
      setBusy(false)
    }
  }

  function handleReset() {
    setRawText('')
    setSenderName('')
    setSenderPhone('')
    setResult(null)
    setError(null)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">외부주문 등록</h1>
      <p className="text-sm text-gray-500 mb-6">
        전화/카톡/밴드댓글로 받은 주문 텍스트를 그대로 붙여넣으면 AI 가 상품명/수량/배송지를
        자동 추출하여 결제대기(PENDING) 상태로 등록합니다.
      </p>

      <div className="space-y-4 bg-white border rounded p-5">
        {/* 분류 라디오 */}
        <div>
          <label className="block text-sm font-medium mb-2">주문 분류</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="kind"
                value="RETAIL"
                checked={externalKind === 'RETAIL'}
                onChange={() => setExternalKind('RETAIL')}
              />
              <span>소매주문</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="kind"
                value="WHOLESALE"
                checked={externalKind === 'WHOLESALE'}
                onChange={() => setExternalKind('WHOLESALE')}
              />
              <span>도매발주</span>
            </label>
          </div>
        </div>

        {/* 텍스트 영역 */}
        <div>
          <label className="block text-sm font-medium mb-2">주문 메시지</label>
          <textarea
            className="w-full border rounded p-3 text-sm min-h-[180px]"
            placeholder="예) 포항물회 2개 보내주세요. 받는사람 김영자 010-1111-2222 서울시 강남구 ..."
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />
        </div>

        {/* 발신자 정보 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">발신자 이름 (선택)</label>
            <input
              className="w-full border rounded p-2 text-sm"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="텍스트에 없으면 입력"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">발신자 전화 (선택)</label>
            <input
              className="w-full border rounded p-2 text-sm"
              value={senderPhone}
              onChange={(e) => setSenderPhone(e.target.value)}
              placeholder="010-..."
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 text-sm rounded p-3">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm px-4 py-2 rounded"
            onClick={handleSubmit}
            disabled={busy}
          >
            {busy ? '추출 중...' : 'AI 추출 + 주문 등록'}
          </button>
          <button
            className="bg-white border text-sm px-4 py-2 rounded hover:bg-gray-50"
            onClick={handleReset}
            disabled={busy}
          >
            초기화
          </button>
        </div>
      </div>

      {result && (
        <div className="mt-6 bg-green-50 border border-green-300 rounded p-5">
          <h2 className="font-semibold text-green-800 mb-2">
            ✓ 주문 등록 완료 (#{result.orderNumber})
          </h2>
          <ul className="text-sm space-y-1 text-gray-700">
            <li>주문 ID: {result.orderId}</li>
            <li>합계: {result.totalAmount.toLocaleString('ko-KR')}원</li>
            <li>매칭된 ShopProduct: {result.matchedShopProductIds.length}건</li>
            {result.unmatchedNames.length > 0 && (
              <li className="text-orange-700">
                미매칭(커스텀 아이템): {result.unmatchedNames.join(', ')}
              </li>
            )}
          </ul>
          <div className="mt-3 flex gap-2">
            <Link
              href="/shop/order/list"
              className="text-sm text-blue-700 underline"
            >
              주문 목록 보기 →
            </Link>
            <button
              className="text-sm text-gray-600 underline"
              onClick={handleReset}
            >
              새로 입력
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
