/**
 * AI 쇼핑몰 페이지 빌더 — html-import 모듈 타입
 */

export interface ExtractedProductData {
  name: string
  price: number | null
  originalPrice?: number | null
  discount?: number | null
  images: string[]
  options: Array<{ name: string; values: string[] }>
  description: string
  shipping?: string
  // AI 보강
  category?: string | null
  seoDescription?: string | null
  sellingPoints?: string[]
  tags?: string[]
  rawHtml?: string
}

export interface PageLayoutAnalysis {
  pageType: 'product_detail' | 'category_list' | 'landing' | 'event'
  layout: {
    headerStyle?: 'fixed' | 'static' | 'transparent'
    productImagePosition?: 'left' | 'top' | 'full-width'
    gridColumns?: number
    hasHeroBanner?: boolean
    hasSidebar?: boolean
  }
  colors: {
    primary: string
    secondary: string
    background: string
    text: string
    accent?: string
  }
  typography: {
    headingFont?: 'sans-serif' | 'serif' | 'display'
    bodyFont?: 'sans-serif' | 'serif'
    titleSize?: 'large' | 'medium' | 'small'
  }
  features?: string[]
  overallStyle?: 'minimal' | 'luxury' | 'playful' | 'corporate' | 'traditional'
}

export interface ScrapedPage {
  url: string
  title: string
  html: string
  screenshot: Buffer
  meta: {
    ogTitle?: string
    ogDescription?: string
    ogImage?: string
    price?: string
    currency?: string
  }
  structuredData: any[]
  images: string[]
  textContent: string
}

export type ImportSource = 'html' | 'url' | 'file' | 'band_post'
