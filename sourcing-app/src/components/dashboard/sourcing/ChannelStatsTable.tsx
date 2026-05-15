'use client'

/**
 * 채널별 현황 테이블
 * 도매/소매 채널별 통계를 가로로 나란히 표시
 * 모바일: 카드 뷰, 데스크톱: 테이블 뷰
 */

import Image from 'next/image'
import { CheckCircle, XCircle, Package, Zap, ShoppingBag, Send, Store, ExternalLink, Radio } from 'lucide-react'
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import type { ChannelStat } from '@/types/dashboard'

interface ChannelStatsTableProps {
  channels: ChannelStat[]
  isLoading?: boolean
}

// 채널 아이콘 컴포넌트
function ChannelIcon({ coverUrl, name, size = 'md' }: { coverUrl?: string | null; name: string; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'w-6 h-6' : 'w-8 h-8'
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'

  if (coverUrl) {
    return (
      <Image
        src={coverUrl}
        alt={name}
        width={size === 'sm' ? 24 : 32}
        height={size === 'sm' ? 24 : 32}
        className={`${sizeClass} rounded-md object-cover flex-shrink-0`}
      />
    )
  }
  return (
    <div className={`${sizeClass} rounded-md bg-gray-200 flex items-center justify-center flex-shrink-0`}>
      <Radio className={`${iconSize} text-gray-500`} />
    </div>
  )
}

function ChannelStatusBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
        <CheckCircle className="w-3 h-3" />
        활성
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded-full">
      <XCircle className="w-3 h-3" />
      비활성
    </span>
  )
}

function ProgressBar({ value, color, showLabel = true }: { value: number; color: string; showLabel?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      {showLabel && <span className="text-xs text-gray-500 w-8 text-right">{value}%</span>}
    </div>
  )
}

// 도매 채널 모바일 카드
function WholesaleMobileCard({ channel }: { channel: ChannelStat }) {
  return (
    <div className="p-3 border-b border-gray-100 last:border-b-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <ChannelIcon coverUrl={channel.coverUrl} name={channel.channelName} size="md" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-gray-900 text-sm truncate">{channel.channelName}</p>
            <ChannelStatusBadge isActive={channel.isActive} />
          </div>
        </div>
      </div>

      {/* 통계 그리드 */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="bg-blue-50 rounded-lg p-2 text-center">
          <div className="flex items-center justify-center gap-1 text-blue-600 mb-0.5">
            <Package className="w-3 h-3" />
            <span className="text-[10px]">수집</span>
          </div>
          <p className="text-sm font-bold text-blue-700">{channel.collected.toLocaleString()}</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-2 text-center">
          <div className="flex items-center justify-center gap-1 text-amber-600 mb-0.5">
            <Zap className="w-3 h-3" />
            <span className="text-[10px]">변환</span>
          </div>
          <p className="text-sm font-bold text-amber-700">{channel.transformed.toLocaleString()}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-2 text-center">
          <div className="flex items-center justify-center gap-1 text-green-600 mb-0.5">
            <ShoppingBag className="w-3 h-3" />
            <span className="text-[10px]">상품</span>
          </div>
          <p className="text-sm font-bold text-green-700">{channel.products.toLocaleString()}</p>
        </div>
      </div>

      {/* 전환율 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 w-12">전환율</span>
        <div className="flex-1">
          <ProgressBar
            value={channel.transformRate}
            color={channel.transformRate >= 50 ? 'bg-green-500' : 'bg-yellow-500'}
          />
        </div>
      </div>
    </div>
  )
}

// 소매 채널 모바일 카드
function RetailMobileCard({ channel, getShopUrl }: { channel: ChannelStat; getShopUrl: (subdomain: string) => string }) {
  return (
    <div className="p-3 border-b border-gray-100 last:border-b-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <ChannelIcon coverUrl={channel.coverUrl} name={channel.channelName} size="md" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-gray-900 text-sm truncate">{channel.channelName}</p>
            <div className="flex items-center gap-2">
              <ChannelStatusBadge isActive={channel.isActive} />
            </div>
          </div>
        </div>
        {channel.shop && (
          <a
            href={getShopUrl(channel.shop.subdomain)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-8 h-8 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex-shrink-0"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>

      {/* 쇼핑몰 정보 */}
      {channel.shop ? (
        <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-gray-50 rounded-lg">
          <Store className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-700">{channel.shop.name}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-gray-50 rounded-lg">
          <Store className="w-4 h-4 text-gray-300" />
          <span className="text-xs text-gray-400">연결된 쇼핑몰 없음</span>
        </div>
      )}

      {/* 발행율 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-gray-500 mb-1">채널 발행율</p>
          <ProgressBar
            value={channel.publishRate}
            color={channel.publishRate >= 50 ? 'bg-green-500' : 'bg-yellow-500'}
          />
        </div>
        <div>
          <p className="text-[10px] text-gray-500 mb-1">쇼핑몰 발행율</p>
          {channel.shop ? (
            <ProgressBar
              value={channel.shopPublishRate ?? 0}
              color={(channel.shopPublishRate ?? 0) >= 50 ? 'bg-blue-500' : 'bg-orange-500'}
            />
          ) : (
            <span className="text-xs text-gray-400">-</span>
          )}
        </div>
      </div>
    </div>
  )
}

// 도매 채널 테이블 (수집, 변환, 상품, 전환율)
function WholesaleTable({ channels, isLoading }: { channels: ChannelStat[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (channels.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500 text-sm">
        등록된 도매 채널이 없습니다.
      </div>
    )
  }

  return (
    <>
      {/* 모바일: 카드 뷰 */}
      <div className="lg:hidden">
        {channels.map((channel) => (
          <WholesaleMobileCard key={channel.channelId} channel={channel} />
        ))}
      </div>

      {/* 데스크톱: 테이블 뷰 */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-y border-gray-200">
            <tr>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase w-24">
                채널
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase w-24">
                상태
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase w-24">
                <div className="flex items-center justify-center gap-1">
                  <Package className="w-3 h-3" />
                  수집
                </div>
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase w-24">
                <div className="flex items-center justify-center gap-1">
                  <Zap className="w-3 h-3" />
                  변환
                </div>
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase w-24">
                <div className="flex items-center justify-center gap-1">
                  <ShoppingBag className="w-3 h-3" />
                  상품
                </div>
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase w-48">
                전환율
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {channels.map((channel) => (
              <tr key={channel.channelId} className="hover:bg-gray-50">
                <td className="px-3 py-2 w-24">
                  <div className="flex items-center justify-start gap-2">
                    <ChannelIcon coverUrl={channel.coverUrl} name={channel.channelName} size="sm" />
                    <span className="font-medium text-gray-900 text-sm truncate">
                      {channel.channelName}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-center w-24">
                  <ChannelStatusBadge isActive={channel.isActive} />
                </td>
                <td className="px-3 py-2 text-center w-24 text-sm text-gray-900">
                  {channel.collected.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-center w-24 text-sm text-gray-900">
                  {channel.transformed.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-center w-24 text-sm text-gray-900">
                  {channel.products.toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  <ProgressBar
                    value={channel.transformRate}
                    color={channel.transformRate >= 50 ? 'bg-green-500' : 'bg-yellow-500'}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// 소매 채널 테이블 (발행만)
function RetailTable({ channels, isLoading }: { channels: ChannelStat[]; isLoading: boolean }) {
  // 쇼핑몰 URL 생성 — 환경변수 미설정 시 운영 도메인으로 폴백 (다른 호출부와 동일 패턴)
  const getShopUrl = (subdomain: string) => {
    const shopBaseUrl = process.env.NEXT_PUBLIC_SHOP_BASE_URL || 'https://shop.abcpharm.net'
    return `${shopBaseUrl}/${subdomain}`
  }

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (channels.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500 text-sm">
        등록된 소매 채널이 없습니다.
      </div>
    )
  }

  return (
    <>
      {/* 모바일: 카드 뷰 */}
      <div className="lg:hidden">
        {channels.map((channel) => (
          <RetailMobileCard key={channel.channelId} channel={channel} getShopUrl={getShopUrl} />
        ))}
      </div>

      {/* 데스크톱: 테이블 뷰 */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-y border-gray-200">
            <tr>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase w-32">
                채널
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase w-32">
                상태
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase w-32">
                <div className="flex items-center justify-center gap-1">
                  <Store className="w-3 h-3" />
                  쇼핑몰
                </div>
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase w-32">
                <div className="flex items-center justify-center gap-1">
                  <ExternalLink className="w-3 h-3" />
                  URL
                </div>
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase w-28">
                채널 발행율
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase w-28">
                쇼핑몰 발행율
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {channels.map((channel) => (
              <tr key={channel.channelId} className="hover:bg-gray-50">
                <td className="px-3 py-2 w-32">
                  <div className="flex items-center justify-start gap-2">
                    <ChannelIcon coverUrl={channel.coverUrl} name={channel.channelName} size="sm" />
                    <span className="font-medium text-gray-900 text-sm truncate">
                      {channel.channelName}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 justify-center w-32 text-center">
                  <ChannelStatusBadge isActive={channel.isActive} />
                </td>
                <td className="px-3 py-2 text-center w-32">
                  {channel.shop ? (
                    <span className="text-sm text-gray-900">{channel.shop.name}</span>
                  ) : (
                    <span className="text-xs text-gray-400">연결된 쇼핑몰 없음</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {channel.shop ? (
                    <a
                      href={getShopUrl(channel.shop.subdomain)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {getShopUrl(channel.shop.subdomain)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </td>
                <td className="px-3 py-2 w-28">
                  <ProgressBar
                    value={channel.publishRate}
                    color={channel.publishRate >= 50 ? 'bg-green-500' : 'bg-yellow-500'}
                  />
                </td>
                <td className="px-3 py-2 w-28">
                  {channel.shop ? (
                    <ProgressBar
                      value={channel.shopPublishRate ?? 0}
                      color={(channel.shopPublishRate ?? 0) >= 50 ? 'bg-blue-500' : 'bg-orange-500'}
                    />
                  ) : (
                    <span className="text-xs text-gray-400 text-center block">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default function ChannelStatsTable({
  channels,
  isLoading = false,
}: ChannelStatsTableProps) {
  const wholesaleChannels = channels.filter((ch) => ch.kind === 'WHOLESALE')
  const retailChannels = channels.filter((ch) => ch.kind === 'RETAIL')

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 도매 채널 */}
      <Card padding="none" className="h-auto lg:h-[280px] flex flex-col">
        <CardHeader className="px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <CardTitle className="text-base">도매 채널</CardTitle>
            <span className="text-xs text-gray-500">({wholesaleChannels.length})</span>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-y-auto">
          <WholesaleTable channels={wholesaleChannels} isLoading={isLoading} />
        </CardContent>
      </Card>

      {/* 소매 채널 */}
      <Card padding="none" className="h-auto lg:h-[280px] flex flex-col">
        <CardHeader className="px-4 py-3 flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <CardTitle className="text-base">소매 채널</CardTitle>
              <span className="text-xs text-gray-500">({retailChannels.length})</span>
            </div>
            <span className="text-[10px] sm:text-[12px] text-gray-400">
              * 발행율은 선택 기간 내 상품 기준
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-y-auto">
          <RetailTable channels={retailChannels} isLoading={isLoading} />
        </CardContent>
      </Card>
    </div>
  )
}
