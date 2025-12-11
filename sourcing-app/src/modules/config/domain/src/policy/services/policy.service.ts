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

  async update(id: number, data: PolicyUpdateInput) {
    const existing = await policyRepository.findById(id)
    if (!existing) {
      throw new Error('정책을 찾을 수 없습니다.')
    }

    return policyRepository.update(id, data)
  }

  async delete(id: number) {
    const existing = await policyRepository.findById(id)
    if (!existing) {
      throw new Error('정책을 찾을 수 없습니다.')
    }

    return policyRepository.delete(id)
  }
}

export const policyService = new PolicyService()
