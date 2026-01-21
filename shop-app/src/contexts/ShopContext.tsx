'use client'

import { createContext, useContext, useMemo, ReactNode } from 'react'

export interface ShopBankInfo {
  bankName: string
  bankAccount: string
  accountHolder: string
}

export interface ShopThemeInfo {
  primaryColor?: string
  secondaryColor?: string
  logoUrl?: string
  faviconUrl?: string
  bannerUrl?: string
}

export interface RelatedShop {
  id: number
  subdomain: string
  name: string
  logoUrl?: string
}

export interface ShopInfo {
  id: number
  subdomain: string
  name: string
  coverUrl?: string
  contactPhone?: string
  contactEmail?: string
  ownerName?: string
  businessNumber?: string
  bankInfo?: ShopBankInfo
  theme?: ShopThemeInfo
  relatedShops?: RelatedShop[]
}

interface ShopContextValue {
  shop: ShopInfo | null
  isLoading: boolean
}

const ShopContext = createContext<ShopContextValue>({
  shop: null,
  isLoading: true,
})

interface ShopProviderProps {
  children: ReactNode
  initialShop: ShopInfo | null
}

export function ShopProvider({ children, initialShop }: ShopProviderProps) {
  const contextValue = useMemo(
    () => ({ shop: initialShop, isLoading: false }),
    [initialShop]
  )

  return (
    <ShopContext.Provider value={contextValue}>
      {children}
    </ShopContext.Provider>
  )
}

export function useShop() {
  const context = useContext(ShopContext)
  if (context === undefined) {
    throw new Error('useShop must be used within a ShopProvider')
  }
  return context
}
