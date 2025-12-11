'use client'

import { createContext, useContext, ReactNode } from 'react'

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
  freeShippingAmount?: number
  defaultShippingFee?: number
  contactPhone?: string
  contactEmail?: string
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
  return (
    <ShopContext.Provider value={{ shop: initialShop, isLoading: false }}>
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
