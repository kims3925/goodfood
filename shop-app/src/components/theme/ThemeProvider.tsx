'use client'

import { useEffect } from 'react'
import { useShop } from '@/contexts/ShopContext'

/**
 * ThemeProvider
 * Shop 테마를 CSS Variables로 주입하여 전체 앱에 동적 테마 적용
 *
 * 사용되는 CSS Variables:
 * - --color-primary: 메인 색상
 * - --color-primary-dark: 메인 색상 어두운 버전
 * - --color-primary-light: 메인 색상 밝은 버전
 * - --color-secondary: 보조 색상
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { shop } = useShop()

  useEffect(() => {
    const root = document.documentElement
    const primary = shop?.theme?.primaryColor || '#FF6B6B'
    const secondary = shop?.theme?.secondaryColor || '#10b981'

    // CSS Variables 설정
    root.style.setProperty('--color-primary', primary)
    root.style.setProperty('--color-secondary', secondary)

    // 파생 색상 계산 (darker/lighter)
    // color-mix를 지원하지 않는 브라우저를 위해 직접 계산
    root.style.setProperty('--color-primary-rgb', hexToRgb(primary))
    root.style.setProperty('--color-secondary-rgb', hexToRgb(secondary))
  }, [shop?.theme])

  return <>{children}</>
}

/**
 * HEX 색상을 RGB 문자열로 변환 (Tailwind opacity 지원용)
 * @example hexToRgb('#FF6B6B') => '255 107 107'
 */
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '255 107 107' // fallback

  return `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`
}
