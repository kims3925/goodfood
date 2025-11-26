/**
 * Customer Service
 * 고객 비즈니스 로직 레이어
 */

import { Customer } from '@bandauto/db'
import {
  customerRepository,
  CustomerRepository
} from '@/domain/customers/repository/customer.repository'
import {
  CreateCustomerDTO,
  UpdateCustomerDTO,
  CustomerFilter,
  CustomerWithOrders
} from '@/types/services/customer'
import {
  ValidationError,
  NotFoundError,
  DuplicateError
} from '@/lib/errors/handlers'

export class CustomerService {
  constructor(
    private repository: CustomerRepository = customerRepository
  ) {}

  /**
   * ID로 고객 조회
   */
  async findById(id: number): Promise<Customer> {
    if (!id) {
      throw new ValidationError('고객 ID는 필수입니다')
    }

    const customer = await this.repository.findById(id)

    if (!customer) {
      throw new NotFoundError('고객', String(id))
    }

    return customer
  }

  /**
   * 전화번호로 고객 조회
   */
  async findByPhone(phone: string): Promise<Customer | null> {
    if (!phone) {
      throw new ValidationError('전화번호는 필수입니다')
    }

    return this.repository.findByPhone(phone)
  }

  /**
   * 이메일로 고객 조회
   */
  async findByEmail(email: string): Promise<Customer | null> {
    if (!email) {
      throw new ValidationError('이메일은 필수입니다')
    }

    return this.repository.findByEmail(email)
  }

  /**
   * 이메일 또는 전화번호로 고객 조회
   */
  async findByEmailOrPhone(email: string, phone: string): Promise<Customer | null> {
    if (!email && !phone) {
      throw new ValidationError('이메일 또는 전화번호가 필요합니다')
    }

    return this.repository.findByEmailOrPhone(email, phone)
  }

  /**
   * 필터 조건으로 고객 조회
   */
  async findByFilter(filter: CustomerFilter): Promise<Customer[]> {
    return this.repository.findByFilter(filter)
  }

  /**
   * 고객 생성 또는 조회
   */
  async findOrCreateCustomer(data: CreateCustomerDTO): Promise<Customer> {
    // 필수 필드 검증
    if (!data.name) {
      throw new ValidationError('고객 이름은 필수입니다')
    }

    if (!data.phone) {
      throw new ValidationError('전화번호는 필수입니다')
    }

    // 기존 고객 확인
    const existingCustomer = await this.repository.findByEmailOrPhone(
      data.email || '',
      data.phone
    )

    if (existingCustomer) {
      return existingCustomer
    }

    // 새 고객 생성
    return this.repository.create({
      name: data.name,
      phone: data.phone,
      email: data.email || null
    })
  }

  /**
   * 고객 생성
   */
  async createCustomer(data: CreateCustomerDTO): Promise<Customer> {
    // 필수 필드 검증
    if (!data.name) {
      throw new ValidationError('고객 이름은 필수입니다')
    }

    if (!data.phone) {
      throw new ValidationError('전화번호는 필수입니다')
    }

    // 중복 확인
    const existingCustomer = await this.repository.findByPhone(data.phone)

    if (existingCustomer) {
      throw new DuplicateError('이미 등록된 전화번호입니다', {
        phone: data.phone
      })
    }

    // 고객 생성
    return this.repository.create({
      name: data.name,
      phone: data.phone,
      email: data.email || null
    })
  }

  /**
   * 고객 업데이트
   */
  async updateCustomer(id: number, data: UpdateCustomerDTO): Promise<Customer> {
    if (!id) {
      throw new ValidationError('고객 ID는 필수입니다')
    }

    // 고객 존재 확인
    const existingCustomer = await this.repository.findById(id)
    if (!existingCustomer) {
      throw new NotFoundError('고객', String(id))
    }

    // 전화번호 중복 확인
    if (data.phone && data.phone !== existingCustomer.phone) {
      const phoneExists = await this.repository.findByPhone(data.phone)
      if (phoneExists) {
        throw new DuplicateError('이미 사용 중인 전화번호입니다', {
          phone: data.phone
        })
      }
    }

    // 업데이트 데이터 필터링
    const updateData: any = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.email !== undefined) updateData.email = data.email

    updateData.updatedAt = new Date()

    return this.repository.update(id, updateData)
  }

  /**
   * 고객 삭제
   */
  async deleteCustomer(id: number): Promise<void> {
    if (!id) {
      throw new ValidationError('고객 ID는 필수입니다')
    }

    // 고객 존재 확인
    const existingCustomer = await this.repository.findById(id)
    if (!existingCustomer) {
      throw new NotFoundError('고객', String(id))
    }

    await this.repository.delete(id)
  }

  /**
   * 주문 정보와 함께 고객 조회
   */
  async findByIdWithOrders(id: number): Promise<CustomerWithOrders> {
    if (!id) {
      throw new ValidationError('고객 ID는 필수입니다')
    }

    const customer = await this.repository.findByIdWithOrders(id)

    if (!customer) {
      throw new NotFoundError('고객', String(id))
    }

    const stats = await this.repository.getCustomerStats(id)

    return {
      ...customer,
      orders: customer.orders || []
    } as CustomerWithOrders
  }

  /**
   * 고객 개수 조회
   */
  async countCustomers(filter?: Partial<CustomerFilter>): Promise<number> {
    return this.repository.count(filter)
  }
}

// Singleton 인스턴스
export const customerService = new CustomerService()
