/**
 * 오픈 API v1 상품 공통 헬퍼 (STEP 4-3)
 */

/** 목록/상세 공통 where 빌더 — 쇼핑몰 발행물이 있는 상품만 외부 노출 */
export function buildProductWhere(searchParams: URLSearchParams): any {
  const where: any = {
    deletedAt: null,
    shopProducts: { some: { deletedAt: null } },
  }

  const status = searchParams.get('status') || 'active'
  if (status === 'active') {
    where.isActive = true
  } else if (status === 'soldout') {
    where.sourceStatus = 'SOLDOUT'
  } // all: 필터 없음

  const category = searchParams.get('category')
  if (category) {
    // 대분류 코드는 하위 중분류(코드 prefix '{CODE}_') 포함
    where.OR = [{ categoryId: category }, { categoryId: { startsWith: `${category}_` } }]
  }

  const updatedAfter = searchParams.get('updated_after')
  if (updatedAfter) {
    const d = new Date(updatedAfter)
    if (!isNaN(d.getTime())) {
      where.updatedAt = { gte: d }
    }
  }

  return where
}

export function formatProductSummary(p: any) {
  return {
    id: p.id,
    name: p.name,
    category: p.categoryId,
    thumbnail_url: p.thumbnailUrl,
    wholesale_price: p.wholesalePrice != null ? Number(p.wholesalePrice) : null,
    retail_price: p.price,
    shipping_fee: p.shippingFee ?? 0,
    bundle_shipping_type: p.bundleShippingType,
    source_status: p.sourceStatus,
    is_active: p.isActive,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  }
}
