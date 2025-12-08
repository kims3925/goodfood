'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Store,
  Save,
  Trash2,
  Edit,
  X,
  Calendar,
  Globe,
  CreditCard,
  Power,
  PowerOff,
  Palette,
  Phone,
  Truck,
  ExternalLink,
  Package,
  ShoppingCart,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/Toast'
import ImageUpload from '@/components/ui/ImageUpload'

interface ShopTheme {
  id: number
  shopId: number
  primaryColor: string | null
  secondaryColor: string | null
  logoUrl: string | null
  faviconUrl: string | null
  bannerUrl: string | null
}

interface Shop {
  id: number
  userId: number
  subdomain: string
  name: string
  coverUrl: string | null
  bankName: string | null
  bankAccount: string | null
  accountHolder: string | null
  freeShippingAmount: number | null
  defaultShippingFee: number | null
  contactPhone: string | null
  contactEmail: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  theme: ShopTheme | null
  _count: {
    publishedProducts: number
    orders: number
  }
}

export default function ShopDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = params
  const router = useRouter()
  const toast = useToast()

  const [shop, setShop] = useState<Shop | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // 기본 정보 필드
  const [subdomain, setSubdomain] = useState('')
  const [name, setName] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [isActive, setIsActive] = useState(true)

  // 정산 정보 필드
  const [bankName, setBankName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [accountHolder, setAccountHolder] = useState('')

  // 배송 설정 필드
  const [freeShippingAmount, setFreeShippingAmount] = useState<number | null>(null)
  const [defaultShippingFee, setDefaultShippingFee] = useState<number | null>(null)

  // 연락처 필드
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')

  // 테마 필드
  const [primaryColor, setPrimaryColor] = useState('')
  const [secondaryColor, setSecondaryColor] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [faviconUrl, setFaviconUrl] = useState('')
  const [bannerUrl, setBannerUrl] = useState('')

  // Shop URL 도메인 (.env의 NEXT_PUBLIC_DOMAIN 사용)
  const shopBaseDomain = useMemo(() => {
    return process.env.NEXT_PUBLIC_DOMAIN || 'bandauto.com'
  }, [])

  const getShopUrl = useCallback((subdomainValue: string) => {
    const protocol = shopBaseDomain.includes('lvh.me') ? 'http' : 'https'
    return `${protocol}://${subdomainValue}.${shopBaseDomain}`
  }, [shopBaseDomain])

  const loadShop = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/shop/${id}`)
      const data = await response.json()

      if (data.success) {
        const s = data.data
        setShop(s)
        // 기본 정보
        setSubdomain(s.subdomain)
        setName(s.name)
        setCoverUrl(s.coverUrl || '')
        setIsActive(s.isActive)
        // 정산 정보
        setBankName(s.bankName || '')
        setBankAccount(s.bankAccount || '')
        setAccountHolder(s.accountHolder || '')
        // 배송 설정
        setFreeShippingAmount(s.freeShippingAmount)
        setDefaultShippingFee(s.defaultShippingFee)
        // 연락처
        setContactPhone(s.contactPhone || '')
        setContactEmail(s.contactEmail || '')
        // 테마
        if (s.theme) {
          setPrimaryColor(s.theme.primaryColor || '')
          setSecondaryColor(s.theme.secondaryColor || '')
          setLogoUrl(s.theme.logoUrl || '')
          setFaviconUrl(s.theme.faviconUrl || '')
          setBannerUrl(s.theme.bannerUrl || '')
        } else {
          setPrimaryColor('')
          setSecondaryColor('')
          setLogoUrl('')
          setFaviconUrl('')
          setBannerUrl('')
        }
      } else {
        toast.error(data.error || '쇼핑몰을 불러오는데 실패했습니다.')
        router.push('/shop/stores')
      }
    } catch (error) {
      console.error('쇼핑몰 상세 조회 실패:', error)
      toast.error('쇼핑몰을 불러오는데 실패했습니다.')
      router.push('/shop/stores')
    } finally {
      setIsLoading(false)
    }
  }, [id, router, toast])

  useEffect(() => {
    loadShop()
  }, [loadShop])

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('쇼핑몰명을 입력해주세요.')
      return
    }

    if (!subdomain.trim()) {
      toast.error('서브도메인을 입력해주세요.')
      return
    }

    const subdomainRegex = /^[a-z0-9-]+$/
    if (!subdomainRegex.test(subdomain)) {
      toast.error('서브도메인은 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.')
      return
    }

    setIsSaving(true)
    try {
      const updateData = {
        subdomain,
        name,
        coverUrl: coverUrl || null,
        isActive,
        bankName: bankName || null,
        bankAccount: bankAccount || null,
        accountHolder: accountHolder || null,
        freeShippingAmount: freeShippingAmount || null,
        defaultShippingFee: defaultShippingFee || null,
        contactPhone: contactPhone || null,
        contactEmail: contactEmail || null,
        theme: {
          primaryColor: primaryColor || null,
          secondaryColor: secondaryColor || null,
          logoUrl: logoUrl || null,
          faviconUrl: faviconUrl || null,
          bannerUrl: bannerUrl || null,
        },
      }

      const response = await fetch(`/api/shop/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('쇼핑몰이 수정되었습니다.')
        setShop(data.data)
        setIsEditMode(false)
      } else {
        toast.error(data.error || '쇼핑몰 수정에 실패했습니다.')
      }
    } catch (error) {
      console.error('쇼핑몰 수정 실패:', error)
      toast.error('쇼핑몰 수정에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/shop/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast.success('쇼핑몰이 삭제되었습니다.')
        router.push('/shop/stores')
      } else {
        toast.error(data.error || '쇼핑몰 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('쇼핑몰 삭제 실패:', error)
      toast.error('쇼핑몰 삭제에 실패했습니다.')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const cancelEdit = () => {
    if (shop) {
      setSubdomain(shop.subdomain)
      setName(shop.name)
      setCoverUrl(shop.coverUrl || '')
      setIsActive(shop.isActive)
      setBankName(shop.bankName || '')
      setBankAccount(shop.bankAccount || '')
      setAccountHolder(shop.accountHolder || '')
      setFreeShippingAmount(shop.freeShippingAmount)
      setDefaultShippingFee(shop.defaultShippingFee)
      setContactPhone(shop.contactPhone || '')
      setContactEmail(shop.contactEmail || '')
      if (shop.theme) {
        setPrimaryColor(shop.theme.primaryColor || '')
        setSecondaryColor(shop.theme.secondaryColor || '')
        setLogoUrl(shop.theme.logoUrl || '')
        setFaviconUrl(shop.theme.faviconUrl || '')
        setBannerUrl(shop.theme.bannerUrl || '')
      }
    }
    setIsEditMode(false)
  }

  const formatDateTimeKST = (dateString: string) => {
    const date = new Date(dateString)
    const kstOffset = 9 * 60 * 60 * 1000
    const kstDate = new Date(date.getTime() + kstOffset)
    const yyyy = kstDate.getUTCFullYear()
    const mm = String(kstDate.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(kstDate.getUTCDate()).padStart(2, '0')
    const hh = String(kstDate.getUTCHours()).padStart(2, '0')
    const mi = String(kstDate.getUTCMinutes()).padStart(2, '0')
    const ss = String(kstDate.getUTCSeconds()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">쇼핑몰을 찾을 수 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/shop/stores')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft size={20} />
            <span>목록으로</span>
          </button>

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {shop.coverUrl ? (
                <img
                  src={shop.coverUrl}
                  alt={shop.name}
                  className="w-16 h-16 rounded-xl object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Store size={32} className="text-white" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{shop.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <Globe size={14} className="text-gray-400" />
                  <a
                    href={getShopUrl(shop.subdomain)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
                  >
                    {shop.subdomain}.{shopBaseDomain}
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isEditMode ? (
                <>
                  <Button variant="secondary" onClick={cancelEdit} disabled={isSaving}>
                    <X size={16} className="mr-2" />
                    취소
                  </Button>
                  <Button onClick={handleSave} loading={isSaving}>
                    <Save size={16} className="mr-2" />
                    저장
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" onClick={() => setIsEditMode(true)}>
                    <Edit size={16} className="mr-2" />
                    수정
                  </Button>
                  <Button
                    variant="secondary"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 size={16} className="mr-2" />
                    삭제
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Package size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">발행 상품</p>
                <p className="text-xl font-bold text-gray-900">{shop._count.publishedProducts}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <ShoppingCart size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">주문</p>
                <p className="text-xl font-bold text-gray-900">{shop._count.orders}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Calendar size={20} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">생성일</p>
                <p className="text-sm font-medium text-gray-900">{formatDateTimeKST(shop.createdAt)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Calendar size={20} className="text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">수정일</p>
                <p className="text-sm font-medium text-gray-900">{formatDateTimeKST(shop.updatedAt)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 첫 번째 줄: 기본 정보 | 활성화 + 연락처 */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* 기본 정보 카드 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Store size={18} className="text-blue-600" />
                </div>
                <span className="font-semibold text-slate-900">기본 정보</span>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">서브도메인</label>
                  {isEditMode ? (
                    <div className="flex items-center">
                      <Input
                        value={subdomain}
                        onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                        placeholder="myshop"
                        className="rounded-r-none"
                      />
                      <span className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-gray-500 text-sm whitespace-nowrap">
                        .{shopBaseDomain}
                      </span>
                    </div>
                  ) : (
                    <p className="text-gray-900 font-mono">{shop.subdomain}<span className="text-gray-400">.{shopBaseDomain}</span></p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">쇼핑몰명</label>
                  {isEditMode ? (
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="내 쇼핑몰"
                    />
                  ) : (
                    <p className="text-gray-900">{shop.name}</p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">커버 이미지</label>
                {isEditMode ? (
                  <ImageUpload
                    value={coverUrl}
                    onChange={setCoverUrl}
                    placeholder="쇼핑몰 커버 이미지"
                  />
                ) : (
                  coverUrl ? (
                    <div className="relative w-full h-32 rounded-lg overflow-hidden border border-gray-200">
                      <img src={coverUrl} alt="커버 이미지" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-full h-32 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50">
                      <span className="text-gray-400 text-sm">이미지 없음</span>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          {/* 오른쪽: 활성화 + 연락처 */}
          <div className="space-y-6">
            {/* 활성화 상태 카드 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                    {isActive ? (
                      <Power size={18} className="text-green-600" />
                    ) : (
                      <PowerOff size={18} className="text-gray-500" />
                    )}
                  </div>
                  <span className="font-semibold text-slate-900">활성화 상태</span>
                </div>
              </div>
              <div className="p-6">
                {isEditMode ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">쇼핑몰 활성화 여부를 설정합니다.</p>
                      <p className="text-xs text-gray-400">비활성화된 쇼핑몰은 고객에게 표시되지 않습니다.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsActive(!isActive)}
                      className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                        isActive ? 'bg-green-500 focus:ring-green-500' : 'bg-gray-300 focus:ring-gray-500'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isActive ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">현재 상태</p>
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                          shop.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {shop.isActive ? <Power size={14} /> : <PowerOff size={14} />}
                        {shop.isActive ? '활성화됨' : '비활성화됨'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 연락처 카드 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Phone size={18} className="text-purple-600" />
                  </div>
                  <span className="font-semibold text-slate-900">연락처 정보</span>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">연락처</label>
                    {isEditMode ? (
                      <Input
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="02-1234-5678"
                      />
                    ) : (
                      <p className="text-gray-900">{shop.contactPhone || '-'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">이메일</label>
                    {isEditMode ? (
                      <Input
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="support@example.com"
                      />
                    ) : (
                      <p className="text-gray-900">{shop.contactEmail || '-'}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 두 번째 줄: 정산 정보 | 배송 설정 */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* 정산 정보 카드 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CreditCard size={18} className="text-green-600" />
                </div>
                <span className="font-semibold text-slate-900">정산 정보</span>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">은행명</label>
                  {isEditMode ? (
                    <Input
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="국민은행"
                    />
                  ) : (
                    <p className="text-gray-900">{shop.bankName || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">계좌번호</label>
                  {isEditMode ? (
                    <Input
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      placeholder="123-456-789012"
                    />
                  ) : (
                    <p className="text-gray-900 font-mono">{shop.bankAccount || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">예금주</label>
                  {isEditMode ? (
                    <Input
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value)}
                      placeholder="홍길동"
                    />
                  ) : (
                    <p className="text-gray-900">{shop.accountHolder || '-'}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 배송 설정 카드 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Truck size={18} className="text-orange-600" />
                </div>
                <span className="font-semibold text-slate-900">배송 설정</span>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">무료배송 기준금액</label>
                  {isEditMode ? (
                    <div className="relative">
                      <Input
                        type="number"
                        value={freeShippingAmount || ''}
                        onChange={(e) => setFreeShippingAmount(e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="50000"
                      />
                    </div>
                  ) : (
                    <p className="text-gray-900">
                      {shop.freeShippingAmount ? `${shop.freeShippingAmount.toLocaleString()}원` : '-'}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">기본 배송비</label>
                  {isEditMode ? (
                    <Input
                      type="number"
                      value={defaultShippingFee || ''}
                      onChange={(e) => setDefaultShippingFee(e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="3000"
                    />
                  ) : (
                    <p className="text-gray-900">
                      {shop.defaultShippingFee ? `${shop.defaultShippingFee.toLocaleString()}원` : '-'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 세 번째 줄: 테마 설정 (전체 너비) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-pink-100 rounded-lg">
                <Palette size={18} className="text-pink-600" />
              </div>
              <span className="font-semibold text-slate-900">테마 설정</span>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-6">
              {/* 왼쪽: 색상 + 로고/파비콘 */}
              <div className="space-y-5">
                {/* 색상 설정 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-2">메인 컬러</label>
                    {isEditMode ? (
                      <div className="relative">
                        <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                          <div className="relative">
                            <input
                              type="color"
                              value={primaryColor || '#3B82F6'}
                              onChange={(e) => setPrimaryColor(e.target.value)}
                              className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0"
                              style={{ appearance: 'none' }}
                            />
                            <div
                              className="absolute inset-0 rounded-lg border-2 border-white shadow-sm pointer-events-none"
                              style={{ backgroundColor: primaryColor || '#3B82F6' }}
                            />
                          </div>
                          <div className="flex-1">
                            <input
                              type="text"
                              value={primaryColor}
                              onChange={(e) => setPrimaryColor(e.target.value)}
                              placeholder="#3B82F6"
                              className="w-full bg-transparent border-none focus:outline-none text-sm font-mono text-gray-700"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <div
                          className="w-8 h-8 rounded-lg shadow-sm border border-gray-200"
                          style={{ backgroundColor: shop.theme?.primaryColor || '#3B82F6' }}
                        />
                        <span className="text-gray-700 font-mono text-sm">{shop.theme?.primaryColor || '-'}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-2">보조 컬러</label>
                    {isEditMode ? (
                      <div className="relative">
                        <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                          <div className="relative">
                            <input
                              type="color"
                              value={secondaryColor || '#6B7280'}
                              onChange={(e) => setSecondaryColor(e.target.value)}
                              className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0"
                              style={{ appearance: 'none' }}
                            />
                            <div
                              className="absolute inset-0 rounded-lg border-2 border-white shadow-sm pointer-events-none"
                              style={{ backgroundColor: secondaryColor || '#6B7280' }}
                            />
                          </div>
                          <div className="flex-1">
                            <input
                              type="text"
                              value={secondaryColor}
                              onChange={(e) => setSecondaryColor(e.target.value)}
                              placeholder="#6B7280"
                              className="w-full bg-transparent border-none focus:outline-none text-sm font-mono text-gray-700"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <div
                          className="w-8 h-8 rounded-lg shadow-sm border border-gray-200"
                          style={{ backgroundColor: shop.theme?.secondaryColor || '#6B7280' }}
                        />
                        <span className="text-gray-700 font-mono text-sm">{shop.theme?.secondaryColor || '-'}</span>
                      </div>
                    )}
                  </div>
                </div>
                {/* 파비콘 & 로고 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-2">파비콘</label>
                    {isEditMode ? (
                      <ImageUpload
                        value={faviconUrl}
                        onChange={setFaviconUrl}
                        placeholder="파비콘 이미지"
                      />
                    ) : (
                      faviconUrl ? (
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-white p-1">
                          <img src={faviconUrl} alt="파비콘" className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50">
                          <span className="text-gray-400 text-xs">없음</span>
                        </div>
                      )
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-2">로고</label>
                    {isEditMode ? (
                      <ImageUpload
                        value={logoUrl}
                        onChange={setLogoUrl}
                        placeholder="로고 이미지"
                      />
                    ) : (
                      logoUrl ? (
                        <div className="relative w-full h-24 rounded-lg overflow-hidden border border-gray-200 bg-white p-2">
                          <img src={logoUrl} alt="로고" className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-full h-24 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50">
                          <span className="text-gray-400 text-xs">로고 없음</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
              {/* 오른쪽: 배너 */}
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">배너 이미지</label>
                {isEditMode ? (
                  <ImageUpload
                    value={bannerUrl}
                    onChange={setBannerUrl}
                    placeholder="배너 이미지 (권장: 1200x400)"
                    className="h-full"
                  />
                ) : (
                  bannerUrl ? (
                    <div className="relative w-full h-[232px] rounded-lg overflow-hidden border border-gray-200">
                      <img src={bannerUrl} alt="배너" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-full h-[232px] rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50">
                      <span className="text-gray-400 text-sm">배너 이미지 없음</span>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="쇼핑몰 삭제"
        message="이 쇼핑몰을 삭제하시겠습니까? 관련된 상품, 주문, 장바구니 데이터도 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다."
        confirmText="삭제"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}
