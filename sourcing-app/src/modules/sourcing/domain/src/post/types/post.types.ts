export interface PostListParams {
  userId: number
  search?: string
  channelId?: number
  page?: number
  limit?: number
}

export interface PostCreateInput {
  userId: number
  channelId: number
  externalId: string
  title: string
  content: string
  author?: string
  comments?: Array<{
    author: string
    content: string
  }>
  images?: string[]
}

export interface PostUpdateInput {
  title?: string
  content?: string
  author?: string
}

export interface SavedPostImage {
  fileName: string
  url: string
  fileSize: number
  fileHash: string
  isExisting: boolean
}

export interface PaginatedResult<T> {
  data: T[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}
