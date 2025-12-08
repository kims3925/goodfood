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
  UserCog,
  Store,
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

type UserRole = 'USER' | 'MANAGER' | 'ADMIN'

interface Shop {
  id: number
  name: string
  subdomain: string
}

interface User {
  id: number
  shopId: number | null
  email: string
  name: string | null
  phone: string | null
  role: UserRole
  profileImage: string | null
  createdAt: string
  signupCompletedAt: string | null
  registeredShop: Shop | null
  _count: {
    orders: number
    inquiries: number
    reviews: number
  }
}

const roleLabels: Record<UserRole, string> = {
  USER: '일반 사용자',
  MANAGER: '쇼핑몰 관리자',
  ADMIN: '슈퍼 관리자',
}

const roleColors: Record<UserRole, string> = {
  USER: 'bg-green-100 text-green-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  ADMIN: 'bg-purple-100 text-purple-700',
}

export default function UserListPage() {
  const router = useRouter()
  const toast = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL')
  const [shopFilter, setShopFilter] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [stats, setStats] = useState({ total: 0, USER: 0, MANAGER: 0 })

  // 개발자 도구에서 활성화: localStorage.setItem('enableUserManagement', 'true')
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    const isEnabled = localStorage.getItem('enableUserManagement') === 'true'
    setEnabled(isEnabled)
    if (!isEnabled) {
      router.replace('/shop/dashboard')
    }
  }, [router])

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
      if (shopFilter) params.set('shopId', shopFilter.toString())

      const res = await fetch(`/api/user?${params}`)
      const data = await res.json()

      if (res.ok && data.users) {
        setUsers(data.users)
        setShops(data.shops || [])
        setStats(data.stats || { total: 0, USER: 0, MANAGER: 0 })
        setTotalPages(data.pagination.totalPages)
      } else if (res.status === 401) {
        console.log('인증이 필요합니다')
      } else {
        toast.error(data.error || '사용자 목록을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('사용자 로드 실패:', error)
      toast.error('사용자 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, roleFilter, shopFilter])

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

  // 활성화 체크 중이면 로딩 표시
  if (enabled === null || !enabled) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">사용자 관리</h1>
          <p className="text-gray-600">
            쇼핑몰 고객과 관리자를 통합하여 관리합니다.
          </p>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gray-100 rounded-lg">
                <Users size={24} className="text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">전체 사용자</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <UserCheck size={24} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">일반 사용자</p>
                <p className="text-2xl font-bold text-green-600">{stats.USER}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <UserCog size={24} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">쇼핑몰 관리자</p>
                <p className="text-2xl font-bold text-blue-600">{stats.MANAGER}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 컨트롤 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              {/* 왼쪽: 쇼핑몰 필터 + 역할 필터 */}
              <div className="flex flex-wrap gap-3 items-center">
                {/* 쇼핑몰 필터 */}
                <div className="flex items-center gap-2">
                  <Store size={16} className="text-gray-500" />
                  <select
                    value={shopFilter ?? ''}
                    onChange={(e) => {
                      setShopFilter(e.target.value ? parseInt(e.target.value) : null)
                      setPage(1)
                    }}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">전체 쇼핑몰</option>
                    {shops.map((shop) => (
                      <option key={shop.id} value={shop.id}>
                        {shop.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 역할 필터 */}
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
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
                    onClick={() => { setRoleFilter('USER'); setPage(1) }}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                      roleFilter === 'USER'
                        ? 'bg-white shadow-sm text-green-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <UserCheck size={14} />
                    일반
                  </button>
                  <button
                    onClick={() => { setRoleFilter('MANAGER'); setPage(1) }}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                      roleFilter === 'MANAGER'
                        ? 'bg-white shadow-sm text-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <UserCog size={14} />
                    관리자
                  </button>
                </div>
              </div>

              {/* 오른쪽: 검색 + 새로고침 */}
              <div className="flex gap-2 items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <Input
                    type="text"
                    placeholder="이메일, 이름, 전화번호..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-9 w-64"
                  />
                </div>
                <Button variant="secondary" onClick={handleSearch}>
                  검색
                </Button>
                <Button
                  variant="secondary"
                  onClick={fetchUsers}
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
                  <TableHead className="w-[4%]">순서</TableHead>
                  <TableHead className="w-[25%]">사용자</TableHead>
                  <TableHead className="w-[15%]">소속 쇼핑몰</TableHead>
                  <TableHead className="w-[12%]">역할</TableHead>
                  <TableHead className="w-[8%] text-center">주문</TableHead>
                  <TableHead className="w-[8%] text-center">문의</TableHead>
                  <TableHead className="w-[8%] text-center">리뷰</TableHead>
                  <TableHead className="w-[12%]">가입일</TableHead>
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
                      onClick={() => router.push(`/shop/user/${user.id}`)}
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
                        {user.registeredShop ? (
                          <div className="flex items-center gap-1.5">
                            <Store size={14} className="text-gray-400" />
                            <span className="text-gray-900">{user.registeredShop.name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColors[user.role]}`}
                        >
                          {roleLabels[user.role]}
                        </span>
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
                총 {stats.total}명 중 {(page - 1) * itemsPerPage + 1}-{Math.min(page * itemsPerPage, stats.total)}명
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
