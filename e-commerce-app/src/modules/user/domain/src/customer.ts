/**
 * Customer Service Types
 * 고객 서비스 타입 정의
 */

import { Customer, Order } from '@prisma/client'

export interface CustomerFilter {
  search?: string
  email?: string
  phone?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  offset?: number
  limit?: number
}

export interface CreateCustomerDTO {
  name: string
  email?: string
  phone: string
  address?: string
  zipCode?: string
  detailAddress?: string
}

export interface UpdateCustomerDTO {
  name?: string
  email?: string
  phone?: string
  address?: string
  zipCode?: string
  detailAddress?: string
}

export interface CustomerWithOrders extends Customer {
  orders: Order[]
}
