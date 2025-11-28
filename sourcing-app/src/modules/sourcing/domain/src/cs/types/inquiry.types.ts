export type InquiryType = 'PRODUCT' | 'ORDER' | 'SHIPPING' | 'RETURN' | 'ETC'
export type InquiryStatus = 'PENDING' | 'ANSWERED' | 'CLOSED'

export interface InquiryListParams {
  type?: InquiryType | 'ALL'
  status?: InquiryStatus | 'ALL'
}

export interface InquiryReplyInput {
  content: string
}
