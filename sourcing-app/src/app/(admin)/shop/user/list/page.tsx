'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  RefreshCw,
  Users,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  ShoppingBag,
  MessageSquare,
  Star,
  UserCheck,
  ShieldCheck,
  UserCog,
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

type UserRole = 'SOURCING_USER' | 'CUSTOMER' | 'ADMIN'

interface User {
  id: number
  email: string
  name: string | null
  phone: string | null
  role: UserRole
  profileImage: string | null
  oauthProvider: string | null
  createdAt: string
  signupCompletedAt: string | null
  _count: {
    orders: number
    inquiries: number
    reviews: number
  }
}

const roleLabels: Record<UserRole, string> = {
  SOURCING_USER: '소싱 관리자',
  CUSTOMER: '쇼핑몰 고객',
  ADMIN: '슈퍼 관리자',
}

const roleColors: Record<UserRole, string> = {
  SOURCING_USER: 'bg-blue-100 text-blue-700',
  CUSTOMER: 'bg-green-100 text-green-700',
  ADMIN: 'bg-purple-100 text-purple-700',
}

export default function UserListPage() {
  const router = useRouter()
  const toast = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const itemsPerPage = 20

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
      })

      if (search) params.set('search', search)
      if (roleFilter !== 'ALL') params.set('role', roleFilter)

      const res = await fetch(`/api/user?${params}`)
      const data = await res.json()

      if (data.users) {
        setUsers(data.users)
        setTotalPages(data.pagination.totalPages)
        setTotal(data.pagination.total)
      } else {
        toast.error(data.error || '사용자 목록을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('사용자 로드 실패:', error)
      toast.error('사용자 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [page, search, roleFilter, toast])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleSearch = () => {
    setPage(1)
    fetchUsers()
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  // 역할별 통계
  const customerCount = users.filter((u) => u.role === 'CUSTOMER').length
  const sourcingUserCount = users.filter((u) => u.role === 'SOURCING_USER').length
  const adminCount = users.filter((u) => u.role === 'ADMIN').length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">사용자 관리</h1>
          <p className="text-gray-600">
            쇼핑몰 고객과 소싱 관리자를 통합하여 관리합니다.
          </p>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gray-100 rounded-lg">
                <Users size={24} className="text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">전체 사용자</p>
                <p className="text-2xl font-bold text-gray-900">{total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <UserCheck size={24} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">쇼핑몰 고객</p>
                <p className="text-2xl font-bold text-green-600">{customerCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <UserCog size={24} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">소싱 관리자</p>
                <p className="text-2xl font-bold text-blue-600">{sourcingUserCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <ShieldCheck size={24} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">슈퍼 관리자</p>
                <p className="text-2xl font-bold text-purple-600">{adminCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 컨트롤 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              {/* 검색 */}
              <div className="flex gap-2 flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <Input
                    type="text"
                    placeholder="이메일, 이름, 전화번호 검색..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10"
                  />
                </div>
                <Button variant="secondary" onClick={handleSearch}>
                  검색
                </Button>
              </div>

              {/* 필터 & 새로고침 */}
              <div className="flex gap-2 items-center">
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => { setRoleFilter('ALL'); setPage(1) }}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      roleFilter === 'ALL'
                        ? 'bg-white shadow-sm text-gray-900'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    전체
                  </button>
                  <button
                    onClick={() => { setRoleFilter('CUSTOMER'); setPage(1) }}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                      roleFilter === 'CUSTOMER'
                        ? 'bg-white shadow-sm text-green-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <UserCheck size={14} />
                    고객
                  </button>
                  <button
                    onClick={() => { setRoleFilter('SOURCING_USER'); setPage(1) }}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                      roleFilter === 'SOURCING_USER'
                        ? 'bg-white shadow-sm text-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <UserCog size={14} />
                    소싱
                  </button>
                  <button
                    onClick={() => { setRoleFilter('ADMIN'); setPage(1) }}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                      roleFilter === 'ADMIN'
                        ? 'bg-white shadow-sm text-purple-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <ShieldCheck size={14} />
                    관리자
                  </button>
                </div>

                <Button
                  variant="secondary"
                  onClick={fetchUsers}
                  disabled={loading}
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                  새로고침
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
                  <TableHead className="w-[5%]">순서</TableHead>
                  <TableHead className="w-[30%]">사용자</TableHead>
                  <TableHead className="w-[15%]">역할</TableHead>
                  <TableHead className="w-[10%] text-center">주문</TableHead>
                  <TableHead className="w-[10%] text-center">문의</TableHead>
                  <TableHead className="w-[10%] text-center">리뷰</TableHead>
                  <TableHead className="w-[15%]">가입일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableEmpty message="등록된 사용자가 없습니다." />
                ) : (
                  users.map((user, index) => (
                    <TableRow
                      key={user.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/user/${user.id}`)}
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
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                              <Users className="w-5 h-5 text-gray-500" />
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
                                {user.phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColors[user.role]}`}
                        >
                          {roleLabels[user.role]}
                        </span>
                        {user.oauthProvider && (
                          <div className="text-xs text-gray-500 mt-1">
                            {user.oauthProvider}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1 text-gray-600">
                          <ShoppingBag className="w-4 h-4" />
                          <span>{user._count.orders}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1 text-gray-600">
                          <MessageSquare className="w-4 h-4" />
                          <span>{user._count.inquiries}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1 text-gray-600">
                          <Star className="w-4 h-4" />
                          <span>{user._count.reviews}</span>
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
                총 {total}명 중 {(page - 1) * itemsPerPage + 1}-{Math.min(page * itemsPerPage, total)}명
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm text-gray-600">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
