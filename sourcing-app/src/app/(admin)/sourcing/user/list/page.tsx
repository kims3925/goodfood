'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  UserCog,
  Plus,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
} from '@/components/ui/Table'
import Loading from '@/components/ui/Loading'
import { useToast } from '@/components/ui/Toast'
import { formatPhoneNumber } from '@/modules/utils/phoneUtils'

interface User {
  id: number
  email: string
  name: string | null
  phone: string | null
  role: 'MANAGER'
  profileImage: string | null
  createdAt: string
}

export default function ManagerListPage() {
  const router = useRouter()
  const toast = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [stats, setStats] = useState({ total: 0 })

  const itemsPerPage = 20

  // fetchUsers: 명시적 파라미터로 stale-closure 방지
  const fetchUsers = useCallback(async (targetPage: number, searchQuery: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: targetPage.toString(),
        limit: itemsPerPage.toString(),
        role: 'MANAGER', // 매니저만 조회
      })

      if (searchQuery) params.set('search', searchQuery)

      const res = await fetch(`/api/user?${params}`)
      const data = await res.json()

      if (res.ok && data.users) {
        setUsers(data.users)
        setStats({ total: data.stats?.MANAGER || 0 })
        setTotalPages(data.pagination.totalPages)
      } else if (res.status === 401) {
        console.log('인증이 필요합니다')
      } else {
        toast.error(data.error || '매니저 목록을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('매니저 로드 실패:', error)
      toast.error('매니저 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [toast])

  // 마운트 시 최초 로드
  useEffect(() => {
    fetchUsers(1, '')
  }, [fetchUsers])

  const handleSearch = () => {
    setPage(1)
    fetchUsers(1, search) // 명시적으로 page=1 전달하여 stale-closure 방지
  }

  // 페이지 변경 핸들러 (stale-closure 방지)
  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    fetchUsers(newPage, search)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">매니저 관리</h1>
            <p className="text-gray-600">
              소싱 앱을 관리하는 매니저 계정을 관리합니다.
            </p>
          </div>
          <Button
            onClick={() => router.push('/sourcing/user/create')}
            className="flex items-center gap-2"
          >
            <Plus size={18} />
            매니저 추가
          </Button>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-3 sm:gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
                <UserCog size={20} className="sm:w-6 sm:h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500">전체 매니저</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-600">{stats.total}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 컨트롤 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex gap-4 items-center justify-end">
              {/* 검색 + 새로고침 */}
              <div className="flex gap-2 items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <Input
                    type="text"
                    placeholder="이메일, 이름, 전화번호..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-9 w-64"
                  />
                </div>
                <Button variant="secondary" onClick={handleSearch}>
                  검색
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => fetchUsers(page, search)}
                  disabled={loading}
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </Button>
              </div>
            </div>
          </div>

          {/* 테이블 */}
          {loading ? (
            <div className="p-12">
              <Loading />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[10%]">순서</TableHead>
                  <TableHead className="w-[60%]">매니저</TableHead>
                  <TableHead className="w-[30%]">가입일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableEmpty message="등록된 매니저가 없습니다." />
                ) : (
                  users.map((user, index) => (
                    <TableRow
                      key={user.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/sourcing/user/detail/${user.id}`)}
                    >
                      <TableCell>
                        <span className="text-gray-500 text-sm">
                          {(page - 1) * itemsPerPage + index + 1}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {user.profileImage ? (
                            <img
                              src={user.profileImage}
                              alt={user.name || '프로필'}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <UserCog className="w-5 h-5 text-blue-500" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-gray-900">
                              {user.name || '(이름 없음)'}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {user.email}
                            </div>
                            {user.phone && (
                              <div className="text-sm text-gray-500 flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {formatPhoneNumber(user.phone)}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600 text-sm">
                          {formatDate(user.createdAt)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                총 {stats.total}명 중 {(page - 1) * itemsPerPage + 1}-{Math.min(page * itemsPerPage, stats.total)}명
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm text-gray-600">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
