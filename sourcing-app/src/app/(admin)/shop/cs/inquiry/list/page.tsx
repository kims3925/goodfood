'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  MessageSquare,
  Clock,
  CheckCircle,
  Search,
  HelpCircle,
  Package,
  Truck,
  CreditCard,
  RotateCcw,
  Wallet,
} from 'lucide-react'
import Input from '@/components/ui/Input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/Table'
import Loading from '@/components/ui/Loading'
import Pagination from '@/components/ui/Pagination'
import { useToast } from '@/components/ui/Toast'

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
  { value: 'ALL', label: '전체', icon: HelpCircle },
  { value: 'PRODUCT', label: '상품', icon: Package },
  { value: 'DELIVERY', label: '배송', icon: Truck },
  { value: 'ORDER', label: '주문/결제', icon: CreditCard },
  { value: 'PAYMENT', label: '환불', icon: Wallet },
  { value: 'RETURN', label: '교환/반품', icon: RotateCcw },
  { value: 'GENERAL', label: '기타', icon: MessageSquare },
]

const statusOptions = [
  { value: 'ALL', label: '전체', icon: MessageSquare, color: 'text-gray-600' },
  { value: 'PENDING', label: '답변대기', icon: Clock, color: 'text-yellow-600' },
  { value: 'ANSWERED', label: '답변완료', icon: CheckCircle, color: 'text-green-600' },
]

export default function InquiryManagementPage() {
  const router = useRouter()
  const toast = useToast()
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    answered: 0,
  })

  // Filters
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 20

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

        // 통계 계산
        if (data.stats) {
          setStats(data.stats)
        } else {
          // API에서 stats를 제공하지 않으면 로컬에서 계산
          const allInquiries = data.inquiries
          setStats({
            total: data.total || allInquiries.length,
            pending: allInquiries.filter((i: Inquiry) => i.status === 'PENDING').length,
            answered: allInquiries.filter((i: Inquiry) => i.status === 'ANSWERED').length,
          })
        }
      }
    } catch (error) {
      console.error('Failed to load inquiries:', error)
      toast.error('문의 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [typeFilter, statusFilter, searchQuery, currentPage, toast])

  useEffect(() => {
    loadInquiries()
  }, [loadInquiries])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleRowClick = (inquiryId: number) => {
    router.push(`/shop/cs/inquiry/detail/${inquiryId}`)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).replace(/\. /g, '.').replace(/\.$/, '')
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

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-3 sm:gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gray-100 rounded-lg">
                <MessageSquare size={24} className="text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">전체 문의</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock size={24} className="text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">답변대기</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle size={24} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">답변완료</p>
                <p className="text-2xl font-bold text-green-600">{stats.answered}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 컨트롤 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              {/* 왼쪽: 필터 영역 */}
              <div className="flex flex-col gap-3 w-full lg:w-auto">
                {/* 상태 필터 */}
                <div className="flex items-center gap-1">
                  {statusOptions.map((status) => {
                    const Icon = status.icon
                    return (
                      <button
                        key={status.value}
                        onClick={() => { setStatusFilter(status.value); setCurrentPage(1) }}
                        className={`px-3 py-2 sm:py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 min-h-[44px] sm:min-h-0 ${
                          statusFilter === status.value
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        <Icon size={14} />
                        {status.label}
                      </button>
                    )
                  })}
                </div>

                {/* 문의 유형 필터 */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 -mb-1">
                  {inquiryTypes.map((type) => {
                    const Icon = type.icon
                    return (
                      <button
                        key={type.value}
                        onClick={() => { setTypeFilter(type.value); setCurrentPage(1) }}
                        className={`px-3 py-2 sm:py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap min-h-[44px] sm:min-h-0 ${
                          typeFilter === type.value
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                      >
                        <Icon size={14} />
                        {type.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 오른쪽: 검색 */}
              <div className="relative w-full lg:w-auto">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <Input
                  type="text"
                  placeholder="제목, 내용, 고객명 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full lg:w-64"
                />
              </div>
            </div>
          </div>

          {/* 문의 목록 */}
          {isLoading ? (
            <div className="p-12">
              <Loading />
            </div>
          ) : inquiries.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              문의 내역이 없습니다.
            </div>
          ) : (
            <>
              {/* 모바일: 카드 뷰 */}
              <div className="lg:hidden p-3 space-y-3">
                {inquiries.map((inquiry) => (
                  <div
                    key={inquiry.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleRowClick(inquiry.id)}
                  >
                    {/* 상단: 문의유형 + 상태 */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                        {getTypeLabel(inquiry.inquiryType)}
                      </span>
                      {getStatusBadge(inquiry.status)}
                    </div>

                    {/* 제목 + 내용 */}
                    <div className="mb-3">
                      <h3 className="font-medium text-gray-900 line-clamp-1 mb-1">{inquiry.title}</h3>
                      <p className="text-sm text-gray-500 line-clamp-2">
                        {inquiry.content}
                      </p>
                    </div>

                    {/* 하단: 고객 정보 + 메타 */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">{inquiry.user.name}</span>
                        <span className="text-xs text-gray-500">{inquiry.user.email}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <MessageSquare size={12} />
                          {inquiry.replyCount}
                        </span>
                        <span>{formatDate(inquiry.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 데스크탑: 테이블 뷰 */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[5%]">순서</TableHead>
                      <TableHead className="w-[10%]">문의유형</TableHead>
                      <TableHead className="w-[35%]">제목</TableHead>
                      <TableHead className="w-[15%]">고객</TableHead>
                      <TableHead className="w-[10%]">상태</TableHead>
                      <TableHead className="w-[8%] text-center">답변수</TableHead>
                      <TableHead className="w-[17%]">등록일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inquiries.map((inquiry, index) => (
                      <TableRow
                        key={inquiry.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleRowClick(inquiry.id)}
                      >
                        <TableCell>
                          <span className="text-gray-500 text-sm">
                            {(currentPage - 1) * itemsPerPage + index + 1}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                            {getTypeLabel(inquiry.inquiryType)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-gray-900 truncate">{inquiry.title}</div>
                          <div className="text-sm text-gray-500 truncate mt-1">
                            {inquiry.content.length > 50
                              ? `${inquiry.content.substring(0, 50)}...`
                              : inquiry.content}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-gray-900 font-medium">{inquiry.user.name}</div>
                          <div className="text-sm text-gray-500">{inquiry.user.email}</div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(inquiry.status)}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center justify-center gap-1 text-sm text-gray-600">
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
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
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
