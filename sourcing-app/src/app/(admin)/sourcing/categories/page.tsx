'use client'

/**
 * 카테고리 관리 — 매니저(상품 메뉴 하위) 진입점 (2026-06-12)
 * 어드민 카테고리 트리 관리 화면을 매니저 레이아웃 경로에서 재사용.
 * (API /api/admin/categories 는 ADMIN 권한 필요)
 */
import AdminCategoriesPage from '../../admin/categories/page'

export default function SourcingCategoriesPage() {
  return <AdminCategoriesPage />
}
