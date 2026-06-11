'use client'

/**
 * B2B 사업자 회원 가입 신청 (B2B 공급몰 전환 STEP 3-1, 2026-06-11)
 *
 * 사업자등록번호 + 상호 입력 → 관리자 승인 대기(PENDING).
 * 승인(APPROVED) 후 상품에 공급가가 표시되고 공급가로 주문할 수 있다.
 */

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useShopUrl } from '@/hooks/useShopUrl'
import { useShop } from '@/contexts/ShopContext'

interface B2bInfo {
  b2bStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED'
  b2bAppliedAt: string | null
  b2bApprovedAt: string | null
  b2bRejectReason: string | null
  businessNumber: string | null
  companyName: string | null
}

const STATUS_LABEL: Record<string, { label: string; color: string; desc: string }> = {
  NONE: { label: '미신청', color: 'bg-gray-100 text-gray-600', desc: '사업자 인증을 신청하면 승인 후 공급가로 구매할 수 있습니다.' },
  PENDING: { label: '승인 대기', color: 'bg-amber-100 text-amber-700', desc: '관리자 승인을 기다리고 있습니다. 승인 후 공급가가 표시됩니다.' },
  APPROVED: { label: '승인 완료', color: 'bg-green-100 text-green-700', desc: '사업자 회원으로 승인되었습니다. 상품에 공급가가 표시됩니다.' },
  REJECTED: { label: '반려됨', color: 'bg-red-100 text-red-700', desc: '신청이 반려되었습니다. 정보를 수정해 다시 신청할 수 있습니다.' },
}

export default function B2bApplyPage() {
  const { data: session, status: sessionStatus } = useSession()
  const { getApiPath, getPath } = useShopUrl()
  const { shop } = useShop()
  const primaryColor = shop?.theme?.primaryColor || '#FF6B6B'

  const [info, setInfo] = useState<B2bInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [businessNumber, setBusinessNumber] = useState('')
  const [companyName, setCompanyName] = useState('')

  const fetchInfo = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(getApiPath('/api/b2b/apply'))
      const data = await res.json()
      if (data.success) {
        setInfo(data.data)
        if (data.data.businessNumber) setBusinessNumber(data.data.businessNumber)
        if (data.data.companyName) setCompanyName(data.data.companyName)
      }
    } catch (e) {
      console.error('B2B 상태 조회 실패:', e)
    } finally {
      setLoading(false)
    }
  }, [getApiPath])

  useEffect(() => {
    if (session) fetchInfo()
    else if (sessionStatus !== 'loading') setLoading(false)
  }, [session, sessionStatus, fetchInfo])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setSubmitting(true)
    try {
      const res = await fetch(getApiPath('/api/b2b/apply'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessNumber, companyName }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ type: 'success', text: data.message || '신청이 접수되었습니다.' })
        await fetchInfo()
      } else {
        setMessage({ type: 'error', text: data.error || '신청에 실패했습니다.' })
      }
    } catch {
      setMessage({ type: 'error', text: '신청 중 오류가 발생했습니다.' })
    } finally {
      setSubmitting(false)
    }
  }

  if (sessionStatus === 'loading' || loading) {
    return <div className="max-w-lg mx-auto px-4 py-16 text-center text-gray-400">불러오는 중...</div>
  }

  if (!session) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">사업자 회원 신청</h1>
        <p className="text-gray-500 mb-6">로그인 후 신청할 수 있습니다.</p>
        <a
          href={getPath('/auth/login')}
          className="inline-block px-6 py-3 rounded-xl text-white font-medium"
          style={{ backgroundColor: primaryColor }}
        >
          로그인하기
        </a>
      </div>
    )
  }

  const status = info?.b2bStatus || 'NONE'
  const statusMeta = STATUS_LABEL[status]
  const canApply = status === 'NONE' || status === 'REJECTED'

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">사업자 회원 신청</h1>
      <p className="text-sm text-gray-500 mb-6">
        사업자 인증 시 도매 공급가로 상품을 구매할 수 있습니다.
      </p>

      {/* 상태 카드 */}
      <div className="mb-6 p-4 rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">인증 상태</span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusMeta.color}`}>
            {statusMeta.label}
          </span>
        </div>
        <p className="text-xs text-gray-500">{statusMeta.desc}</p>
        {status === 'REJECTED' && info?.b2bRejectReason && (
          <p className="text-xs text-red-500 mt-2">반려 사유: {info.b2bRejectReason}</p>
        )}
        {status === 'APPROVED' && info?.companyName && (
          <p className="text-xs text-gray-600 mt-2">
            {info.companyName} ({info.businessNumber})
          </p>
        )}
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
          }`}
        >
          {message.text}
        </div>
      )}

      {canApply && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">사업자등록번호 *</label>
            <input
              type="text"
              value={businessNumber}
              onChange={(e) => setBusinessNumber(e.target.value)}
              placeholder="123-45-67890"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">상호 (회사명) *</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="상호명을 입력해주세요"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl text-white font-semibold disabled:opacity-50"
            style={{ backgroundColor: primaryColor }}
          >
            {submitting ? '신청 중...' : status === 'REJECTED' ? '다시 신청하기' : '사업자 인증 신청'}
          </button>
          <p className="text-[11px] text-gray-400 text-center">
            입력하신 사업자 정보는 인증 목적으로만 사용됩니다.
          </p>
        </form>
      )}
    </div>
  )
}
