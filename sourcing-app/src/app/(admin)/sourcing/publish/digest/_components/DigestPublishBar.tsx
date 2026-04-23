'use client'

import Button from '@/components/ui/Button'
import { Send } from 'lucide-react'

interface Channel {
  id: number
  name: string
}

interface Props {
  selectedCount: number
  imageCount: number
  channels: Channel[]
  selectedChannels: number[]
  onToggleChannel: (id: number) => void
  onPublish: () => void
  isPublishing: boolean
}

export default function DigestPublishBar({
  selectedCount,
  imageCount,
  channels,
  selectedChannels,
  onToggleChannel,
  onPublish,
  isPublishing,
}: Props) {
  const canPublish = selectedCount > 0 && selectedChannels.length > 0 && !isPublishing

  return (
    <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 z-30">
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
          종합 발행하기
        </Button>
      </div>
    </div>
  )
}
