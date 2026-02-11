import { inquiryRepository } from '../repository/inquiry.repository'
import type { InquiryListParams, InquiryReplyInput } from '../types/inquiry.types'

export class InquiryService {
  async getList(params: InquiryListParams) {
    return inquiryRepository.findMany(params)
  }

  async getById(id: number) {
    const inquiry = await inquiryRepository.findById(id)
    if (!inquiry) {
      throw new Error('문의를 찾을 수 없습니다.')
    }
    return inquiry
  }

  async getPendingCount(): Promise<number> {
    return inquiryRepository.countPending()
  }

  async addReply(inquiryId: number, data: InquiryReplyInput) {
    const inquiry = await inquiryRepository.findById(inquiryId)
    if (!inquiry) {
      throw new Error('문의를 찾을 수 없습니다.')
    }

    return inquiryRepository.addReply(inquiryId, data.content)
  }
}

export const inquiryService = new InquiryService()
