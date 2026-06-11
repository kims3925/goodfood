/**
 * 오픈 API v1 발주 공통 헬퍼 (STEP 4-3)
 */

export function formatOrderForApi(order: any) {
  return {
    id: order.id,
    order_number: order.orderNumber,
    status: order.status,
    order_type: order.orderType,
    subtotal_amount: Number(order.subtotalAmount),
    total_amount: Number(order.totalAmount),
    ordered_at: order.orderedAt,
    paid_at: order.paidAt,
    shipped_at: order.shippedAt,
    delivered_at: order.deliveredAt,
    cancelled_at: order.cancelledAt,
    items: (order.items || []).map((item: any) => ({
      id: item.id,
      product_name: item.productName,
      option_summary: item.optionSummary,
      variant_id: item.variantId,
      quantity: item.quantity,
      unit_price: Number(item.unitPrice),
      total_price: Number(item.totalPrice),
    })),
    receiver: order.shippingAddress
      ? {
          name: order.shippingAddress.recipientName,
          phone: order.shippingAddress.recipientPhone,
          address: order.shippingAddress.address,
          postal_code: order.shippingAddress.postalCode,
          address_detail: order.shippingAddress.addressDetail,
          delivery_memo: order.shippingAddress.deliveryMemo,
        }
      : null,
  }
}
