export interface ChannelPlatformConfig {
  label: string
  color: string
  bgColor: string
}

export const CHANNEL_PLATFORM_CONFIG: Record<string, ChannelPlatformConfig> = {
  BAND: { label: '밴드', color: 'text-green-700', bgColor: 'bg-green-100' },
  NAVER_CAFE: { label: '네이버카페', color: 'text-green-700', bgColor: 'bg-green-100' },
  ALIEXPRESS: { label: '알리익스프레스', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  SMARTSTORE: { label: '스마트스토어', color: 'text-green-700', bgColor: 'bg-green-100' },
  COUPANG: { label: '쿠팡', color: 'text-red-700', bgColor: 'bg-red-100' },
  CUSTOM: { label: '기타', color: 'text-gray-700', bgColor: 'bg-gray-100' },
}

export const getChannelColor = (platform: string): string => {
  const config = CHANNEL_PLATFORM_CONFIG[platform]
  if (config) {
    return `${config.bgColor} ${config.color}`
  }
  return 'bg-gray-100 text-gray-700'
}

export const getChannelLabel = (platform: string): string => {
  return CHANNEL_PLATFORM_CONFIG[platform]?.label || platform
}
