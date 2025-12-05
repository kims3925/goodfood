'use client'

import { createContext, useContext, ReactNode } from 'react'

export interface ChannelBankInfo {
  bankName: string
  bankAccount: string
  accountHolder: string
}

export interface ChannelThemeInfo {
  primaryColor?: string
  secondaryColor?: string
  logoUrl?: string
  faviconUrl?: string
  bannerUrl?: string
  footerText?: string
}

export interface RelatedChannel {
  id: number
  subdomain: string
  name: string
  displayName?: string
  logoUrl?: string
}

export interface ChannelInfo {
  id: number
  subdomain: string
  name: string
  displayName?: string
  coverUrl?: string
  enableToss: boolean
  enableBankTransfer: boolean
  freeShippingAmount?: number
  defaultShippingFee?: number
  contactPhone?: string
  contactEmail?: string
  bankInfo?: ChannelBankInfo
  theme?: ChannelThemeInfo
  relatedChannels?: RelatedChannel[]
}

interface ChannelContextValue {
  channel: ChannelInfo | null
  isLoading: boolean
}

const ChannelContext = createContext<ChannelContextValue>({
  channel: null,
  isLoading: true,
})

interface ChannelProviderProps {
  children: ReactNode
  initialChannel: ChannelInfo | null
}

export function ChannelProvider({ children, initialChannel }: ChannelProviderProps) {
  return (
    <ChannelContext.Provider value={{ channel: initialChannel, isLoading: false }}>
      {children}
    </ChannelContext.Provider>
  )
}

export function useChannel() {
  const context = useContext(ChannelContext)
  if (context === undefined) {
    throw new Error('useChannel must be used within a ChannelProvider')
  }
  return context
}
