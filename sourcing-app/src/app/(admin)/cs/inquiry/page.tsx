'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, Clock, CheckCircle, Search, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/Table'
import Loading from '@/components/ui/Loading'
import Pagination from '@/components/ui/Pagination'

interface Inquiry {
  id: number
  inquiryType: string
  title: string
  content: string
  status: 'PENDING' | 'ANSWERED'
  replyCount: number
  createdAt: string
  user: {
    id: number
    name: string
    email: string
  }
}

const inquiryTypes = [
  { value: 'ALL', label: '전체' },
  { value: 'PRODUCT', label: '상품 문의' },
  { value: 'DELIVERY', label: '배송 문의' },
  { value: 'ORDER', label: '주문/결제 문의' },
  { value: 'PAYMENT', label: '환불 문의' },
  { value: 'RETURN', label: '교환/반품 문의' },
  { value: 'EXCHANGE', label: '교환 문의' },
  { value: 'GENERAL', label: '기타 문의' },
]

const statusOptions = [
  { value: 'ALL', label: '전체 상태' },
  { value: 'PENDING', label: '답변대기' },
  { value: 'ANSWERED', label: '답변완료' },
]

type SortField = 'id' | 'inquiryType' | 'status' | 'createdAt'
type SortOrder = 'asc' | 'desc'

export default function InquiryManagementPage() {
  const router = useRouter()
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 10

  // Sorting
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const loadInquiries = useCallback(async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (typeFilter !== 'ALL') params.append('type', typeFilter)
      if (statusFilter !== 'ALL') params.append('status', statusFilter)
      if (searchQuery) params.append('search', searchQuery)
      params.append('page', currentPage.toString())
      params.append('limit', itemsPerPage.toString())

      const response = await fetch(`/api/cs/inquiry?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setInquiries(data.inquiries)
        setTotalItems(data.total || data.inquiries.length)
        setTotalPages(Math.ceil((data.total || data.inquiries.length) / itemsPerPage))
      }
    } catch (error) {
      console.error('Failed to load inquiries:', error)
    } finally {
      setIsLoading(false)
    }
  }, [typeFilter, statusFilter, searchQuery, currentPage])

  useEffect(() => {
    loadInquiries()
  }, [loadInquiries])

  const handleSearch = () => {
    setCurrentPage(1)
    loadInquiries()
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleRowClick = (inquiryId: number) => {
    router.push(`/cs/inquiry/${inquiryId}`)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getTypeLabel = (type: string) => {
    return inquiryTypes.find(t => t.value === type)?.label || type
  }

  const getStatusBadge = (status: string) => {
    if (status === 'ANSWERED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <CheckCircle size={12} />
          답변완료
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
        <Clock size={12} />
        답변대기
      </span>
    )
  }

  // 정렬 핸들러
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // 정렬 아이콘 렌더링
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} className="text-gray-400" />
    }
    return sortOrder === 'asc'
      ? <ArrowUp size={14} className="text-blue-600" />
      : <ArrowDown size={14} className="text-blue-600" />
  }

  // 정렬된 데이터
  const sortedInquiries = [...inquiries].sort((a, b) => {
    let comparison = 0

    switch (sortField) {
      case 'id':
        comparison = a.id - b.id
        break
      case 'inquiryType':
        comparison = a.inquiryType.localeCompare(b.inquiryType)
        break
      case 'status':
        comparison = a.status.localeCompare(b.status)
        break
      case 'createdAt':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        break
    }

    return sortOrder === 'asc' ? comparison : -comparison
  })

  const pendingCount = inquiries.filter(i => i.status === 'PENDING').length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">고객 문의 관리</h1>
          <p className="text-gray-600">
            고객 문의를 확인하고 답변을 등록합니다.
          </p>
        </div>

        {/* 컨트롤 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex gap-2 flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <Input
                    type="text"
                    placeholder="제목, 내용, 고객명 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10"
                  />
                </div>
                <Button variant="secondary" onClick={handleSearch}>
                  검색
                </Button>
              </div>

              <div className="flex gap-2 items-center">
                <select
                  value={typeFilter}
                  onChange={e => {
                    setTypeFilter(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  {inquiryTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={e => {
                    setStatusFilter(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  {statusOptions.map(status => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>

                <Button
                  variant="secondary"
                  onClick={loadInquiries}
                  disabled={isLoading}
                >
                  <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                  새로고침
                </Button>
              </div>
            </div>
          </div>

          {/* 테이블 */}
          {isLoading ? (
            <div className="p-12">
              <Loading />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="w-[5%] cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('id')}
                  >
                    <div className="flex items-center gap-1">
                      순서
                      {renderSortIcon('id')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="w-[10%] cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('inquiryType')}
                  >
                    <div className="flex items-center gap-1">
                      문의유형
                      {renderSortIcon('inquiryType')}
                    </div>
                  </TableHead>
                  <TableHead className="w-[35%]">제목</TableHead>
                  <TableHead className="w-[15%]">고객</TableHead>
                  <TableHead
                    className="w-[10%] cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-1">
                      상태
                      {renderSortIcon('status')}
                    </div>
                  </TableHead>
                  <TableHead className="w-[8%]">답변수</TableHead>
                  <TableHead
                    className="w-[17%] cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('createdAt')}
                  >
                    <div className="flex items-center gap-1">
                      등록일
                      {renderSortIcon('createdAt')}
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedInquiries.length === 0 ? (
                  <TableEmpty message="문의 내역이 없습니다." colSpan={7} />
                ) : (
                  sortedInquiries.map((inquiry, index) => (
                    <TableRow
                      key={inquiry.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleRowClick(inquiry.id)}
                    >
                      <TableCell>
                        <span className="text-gray-600 font-medium">{(currentPage - 1) * itemsPerPage + index + 1}</span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          {getTypeLabel(inquiry.inquiryType)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-gray-900 truncate">{inquiry.title}</div>
                        <div className="text-sm text-gray-500 truncate mt-1">
                          {inquiry.content.substring(0, 50)}...
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-gray-900">{inquiry.user.name}</div>
                        <div className="text-sm text-gray-500">{inquiry.user.email}</div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(inquiry.status)}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                          <MessageSquare size={14} />
                          {inquiry.replyCount}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {formatDate(inquiry.createdAt)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
          />
        </div>
      </div>
    </div>
  )
}
