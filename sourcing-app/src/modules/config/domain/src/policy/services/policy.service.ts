import { policyRepository } from '../repository/policy.repository'
import type { PolicyListParams, PolicyCreateInput, PolicyUpdateInput } from '../types/policy.types'

export class PolicyService {
  async getList(params: PolicyListParams) {
    return policyRepository.findMany(params)
  }

  async getById(id: number) {
    return policyRepository.findById(id)
  }

  async create(data: PolicyCreateInput) {
    return policyRepository.create(data)
  }

  async update(id: number, data: PolicyUpdateInput, ownerId?: number) {
    const existing = await policyRepository.findById(id)
    // 멀티테넌트 격리: ownerId 전달 시 소유자 불일치면 존재하지 않는 것으로 처리 (IDOR 방지)
    if (!existing || (ownerId !== undefined && existing.userId !== ownerId)) {
      throw new Error('정책을 찾을 수 없습니다.')
    }

    return policyRepository.update(id, data)
  }

  async delete(id: number, ownerId?: number) {
    const existing = await policyRepository.findById(id)
    // 멀티테넌트 격리: ownerId 전달 시 소유자 불일치면 존재하지 않는 것으로 처리 (IDOR 방지)
    if (!existing || (ownerId !== undefined && existing.userId !== ownerId)) {
      throw new Error('정책을 찾을 수 없습니다.')
    }

    return policyRepository.delete(id)
  }
}

export const policyService = new PolicyService()
