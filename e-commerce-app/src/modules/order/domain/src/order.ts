/**
 * Order Service Types
 * 주문 서비스 타입 정의
 */

import { Order, Customer, Product, Payment, OrderItem } from '@bandauto/db'

export interface CreateOrderDTO {
  userId: number
  customerId: number
  items: {
    productId: number
    quantity: number
    priceAt: number
  }[]
  subtotal: number
  shippingFee: number
  totalAmount: number
  customerName: string
  customerPhone: string
  customerEmail?: string
  shippingAddress?: ShippingAddress
  customerMemo?: string
}

export interface UpdateOrderDTO {
  status?: string
  paymentStatus?: string
  shippingStatus?: string
  trackingNumber?: string
  shippingCompany?: string
}

export interface OrderFilter {
  userId?: number
  customerId?: number
  status?: string
  paymentStatus?: string
  shippingStatus?: string
  startDate?: Date
  endDate?: Date
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  offset?: number
  limit?: number
}

export interface OrderResponse extends Order {
  customer: Customer
  items: (OrderItem & { product: Product })[]
  payments: Payment[]
}

export interface CreateOrderResult {
  order: Order
  paymentUrl?: string
}

export interface OrderStats {
  totalOrders: number
  totalRevenue: number
  paidOrders: number
  pendingOrders: number
  conversionRate: number
}

export interface ShippingAddress {
  recipient: string
  phone: string
  zipCode?: string
  address1: string
  address2?: string
}
