'use client'

import Button from '@/components/ui/Button'
import { Send } from 'lucide-react'

interface Channel {
  id: number
  name: string
}

export type PublishMode = 'digest' | 'individual' | 'both'

interface Props {
  selectedCount: number
  imageCount: number
  channels: Channel[]
  selectedChannels: number[]
  onToggleChannel: (id: number) => void
  onPublish: () => void
  isPublishing: boolean
  publishMode: PublishMode
  onChangePublishMode: (mode: PublishMode) => void
}

const MODE_OPTIONS: Array<{
  value: PublishMode
  label: string
  desc: string
}> = [
  { value: 'digest', label: '종합 1개', desc: '카드 20장+링크 목록 게시글 1개' },
  { value: 'individual', label: '개별 N개', desc: '상품당 게시글 1개 (자동 링크 프리뷰)' },
  { value: 'both', label: '둘 다', desc: '종합 1개 + 개별 N개 순차' },
]

export default function DigestPublishBar({
  selectedCount,
  imageCount,
  channels,
  selectedChannels,
  onToggleChannel,
  onPublish,
  isPublishing,
  publishMode,
  onChangePublishMode,
}: Props) {
  const canPublish = selectedCount > 0 && selectedChannels.length > 0 && !isPublishing

  const buttonLabel =
    publishMode === 'digest'
      ? '종합 발행하기'
      : publishMode === 'individual'
      ? `개별 ${selectedCount}건 발행`
      : `종합+개별 발행 (1+${selectedCount}건)`

  return (
    <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg px-4 sm:px-6 py-3 flex flex-col gap-3 z-30">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="text-sm text-gray-700">
          <span className="font-bold text-blue-600">{selectedCount}개</span> 상품 선택
          <span className="mx-2 text-gray-300">|</span>
          이미지 {imageCount}/20장
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 mr-1">발행 밴드:</span>
          {channels.length === 0 && (
            <span className="text-xs text-gray-400">등록된 소매밴드가 없습니다</span>
          )}
          {channels.map((ch) => {
            const active = selectedChannels.includes(ch.id)
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => onToggleChannel(ch.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {ch.name}
              </button>
            )
          })}
          <Button
            variant="primary"
            disabled={!canPublish}
            loading={isPublishing}
            onClick={onPublish}
            className="ml-2"
          >
            <Send size={16} />
            {buttonLabel}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap border-t border-gray-100 pt-2">
        <span className="text-xs text-gray-500 mr-1">발행 방식:</span>
        {MODE_OPTIONS.map((opt) => {
          const active = publishMode === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChangePublishMode(opt.value)}
              disabled={isPublishing}
              title={opt.desc}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                active
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } disabled:opacity-50`}
            >
              {opt.label}
            </button>
          )
        })}
        <span className="text-[11px] text-gray-400 ml-1 hidden sm:inline">
          {MODE_OPTIONS.find((o) => o.value === publishMode)?.desc}
        </span>
      </div>
    </div>
  )
}
