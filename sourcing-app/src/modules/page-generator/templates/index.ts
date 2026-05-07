/**
 * 페이지 템플릿 레지스트리.
 * Next.js 번들 환경에서 fs 의존 없이 사용하기 위해 inline TypeScript 모듈로 등록.
 */
import { DETAIL_BASIC_TEMPLATE } from './detail-basic'

export interface TemplateInfo {
  id: string
  name: string
  category: 'general' | 'seafood' | 'fruit' | 'meat' | 'premium'
  source: string
}

export const TEMPLATES: TemplateInfo[] = [
  {
    id: 'basic',
    name: '기본 상세페이지',
    category: 'general',
    source: DETAIL_BASIC_TEMPLATE,
  },
  // 추후 premium / seafood 등 추가
]

export function getTemplate(id: string): TemplateInfo {
  return TEMPLATES.find((t) => t.id === id) || TEMPLATES[0]
}
