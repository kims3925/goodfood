'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Store,
  ArrowLeft,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useRouter } from 'next/navigation'
import { CHANNEL_PLATFORM_CONFIG } from '@/lib/channel-utils'

interface WholesaleChannel {
  id: number
  name: string
  platform: string
  kind: string
}

// 정산서 타입 설정
const SETTLEMENT_TYPES: Record<string, { label: string; type: 'jangter' | 'haeyang'; description: string }> = {}

// 채널 이름에서 정산서 타입 자동 감지
function detectSettlementType(channelName: string): 'jangter' | 'haeyang' {
  if (channelName.includes('해양') || channelName.includes('수산')) return 'haeyang'
  return 'jangter'
}

export default function SettlementPage() {
  const router = useRouter()
  const toast = useToast()

  const [channels, setChannels] = useState<WholesaleChannel[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingChannels, setIsLoadingChannels] = useState(true)
  const [settlementType, setSettlementType] = useState<'jangter' | 'haeyang'>('jangter')

  // 기본 날짜 설정 (지난 1주일)
  useEffect(() => {
    const now = new Date()
    const weekAgo = new Date(now)
    weekAgo.setDate(now.getDate() - 7)

    setEndDate(formatDateInput(now))
    setStartDate(formatDateInput(weekAgo))
  }, [])

  // 도매 채널 목록 로드
  useEffect(() => {
    const loadChannels = async () => {
      try {
        const res = await fetch('/api/channel/wholesale')
        const data = await res.json()
        if (data.success && data.data.length > 0) {
          setChannels(data.data)
          setSelectedChannelId(data.data[0].id)
          setSettlementType(detectSettlementType(data.data[0].name))
        }
      } catch (err) {
        console.error('채널 로드 실패:', err)
        toast.error('도매 채널 목록을 불러오는데 실패했습니다.')
      } finally {
        setIsLoadingChannels(false)
      }
    }
    loadChannels()
  }, [])

  // 채널 선택 시 정산서 타입 자동 변경
  const handleChannelChange = (channelId: number) => {
    setSelectedChannelId(channelId)
    const ch = channels.find(c => c.id === channelId)
    if (ch) {
      setSettlementType(detectSettlementType(ch.name))
    }
  }

  // 정산서 다운로드
  const handleExport = async () => {
    if (!selectedChannelId || !startDate || !endDate) {
      toast.error('채널과 기간을 모두 선택해주세요.')
      return
    }

    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        channelId: selectedChannelId.toString(),
        startDate,
        endDate,
        type: settlementType,
      })

      const res = await fetch(`/api/admin/settlement/export?${params}`)

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || '정산서 생성에 실패했습니다.')
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url

      // 파일명 추출
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename\*=UTF-8''(.+)/)
      a.download = match ? decodeURIComponent(match[1]) : '정산서.xlsx'

      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('정산서가 다운로드되었습니다.')
    } catch (err) {
      console.error('정산서 다운로드 실패:', err)
      toast.error('정산서 다운로드에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 빠른 기간 선택
  const setQuickPeriod = (days: number) => {
    const now = new Date()
    const start = new Date(now)
    start.setDate(now.getDate() - days)
    setStartDate(formatDateInput(start))
    setEndDate(formatDateInput(now))
  }

  // 지난주 월~일
  const setLastWeek = () => {
    const now = new Date()
    const dayOfWeek = now.getDay() // 0=일, 1=월, ...
    const lastSunday = new Date(now)
    lastSunday.setDate(now.getDate() - dayOfWeek)
    const lastMonday = new Date(lastSunday)
    lastMonday.setDate(lastSunday.getDate() - 6)
    setStartDate(formatDateInput(lastMonday))
    setEndDate(formatDateInput(lastSunday))
  }

  const selectedChannel = channels.find(c => c.id === selectedChannelId)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" onClick={() => router.push('/shop/order/list')}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">정산서 생성</h1>
            <p className="text-sm text-gray-500">도매처별 주간 정산서를 Excel로 다운로드합니다</p>
          </div>
        </div>

        {/* 메인 카드 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 sm:p-6 space-y-6">

            {/* 1. 도매처 선택 */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Store size={16} />
                도매처 선택
              </label>
              {isLoadingChannels ? (
                <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
              ) : channels.length === 0 ? (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  <AlertCircle size={16} />
                  등록된 도매 채널이 없습니다. 먼저 채널을 등록해주세요.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {channels.map((ch) => {
                    const isSelected = selectedChannelId === ch.id
                    const platformConfig = CHANNEL_PLATFORM_CONFIG[ch.platform]
                    return (
                      <button
                        key={ch.id}
                        onClick={() => handleChannelChange(ch.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          platformConfig?.bgColor || 'bg-gray-100'
                        } ${platformConfig?.color || 'text-gray-700'}`}>
                          {platformConfig?.label || ch.platform}
                        </span>
                        <span className="font-medium text-gray-900">{ch.name}</span>
                        {isSelected && (
                          <span className="ml-auto text-xs text-blue-600 font-medium">
                            {detectSettlementType(ch.name) === 'haeyang' ? '해양수산 양식' : '장터 양식'}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 2. 정산서 양식 */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <FileSpreadsheet size={16} />
                정산서 양식
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSettlementType('jangter')}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    settlementType === 'jangter'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium text-gray-900 text-sm">장터 양식</p>
                  <p className="text-xs text-gray-500 mt-0.5">수익 10% / 과세·면세 구분</p>
                </button>
                <button
                  onClick={() => setSettlementType('haeyang')}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    settlementType === 'haeyang'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium text-gray-900 text-sm">해양수산 양식</p>
                  <p className="text-xs text-gray-500 mt-0.5">수익 + 수수료 1,500원/건</p>
                </button>
              </div>
            </div>

            {/* 3. 기간 선택 */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Calendar size={16} />
                정산 기간
              </label>

              {/* 빠른 선택 */}
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={() => setQuickPeriod(7)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  최근 7일
                </button>
                <button
                  onClick={() => setQuickPeriod(14)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  최근 14일
                </button>
                <button
                  onClick={setLastWeek}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  지난주 (월~일)
                </button>
                <button
                  onClick={() => setQuickPeriod(30)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  최근 30일
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">시작일</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">종료일</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* 다운로드 버튼 */}
            <div className="pt-4 border-t border-gray-200">
              <Button
                variant="primary"
                onClick={handleExport}
                disabled={isLoading || !selectedChannelId || !startDate || !endDate}
                size="lg"
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Download size={20} />
                )}
                {isLoading ? '생성 중...' : '정산서 다운로드'}
              </Button>

              {selectedChannel && startDate && endDate && (
                <p className="text-center text-xs text-gray-500 mt-2">
                  {selectedChannel.name} · {startDate} ~ {endDate} ·{' '}
                  {settlementType === 'haeyang' ? '해양수산' : '장터'} 양식
                </p>
              )}
            </div>

          </div>
        </div>

        {/* 정산 규칙 안내 */}
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">정산 규칙</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600">
            <div className="space-y-1">
              <p className="font-medium text-gray-800">장터 양식</p>
              <p>· 판매수익: 판매가의 10%</p>
              <p>· 카드 결제: 수수료 3.5% 당사 부담</p>
              <p>· 정산내역 = 판매가 - 장터수익</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-gray-800">해양수산 양식</p>
              <p>· 판매수익: 판매가의 약 10%</p>
              <p>· 수수료: 건당 1,500원</p>
              <p>· 정산입금액 = 정산원가 + 수수료</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
