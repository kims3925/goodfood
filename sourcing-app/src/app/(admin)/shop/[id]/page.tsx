'use client'

import { useState, useEffect, useCallback } from 'react'
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
  Building2,
  User,
  Power,
  PowerOff,
  Palette,
  Mail,
  Phone,
  Truck,
  Image,
  FileText,
  ExternalLink,
  Package,
  ShoppingCart,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/Toast'

interface ShopTheme {
  id: number
  shopId: number
  primaryColor: string | null
  secondaryColor: string | null
  logoUrl: string | null
  faviconUrl: string | null
  bannerUrl: string | null
  footerText: string | null
}

interface Shop {
  id: number
  userId: number
  subdomain: string
  name: string
  coverUrl: string | null
  enableToss: boolean
  enableBankTransfer: boolean
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
    carts: number
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

  // 결제 설정 필드
  const [enableToss, setEnableToss] = useState(true)
  const [enableBankTransfer, setEnableBankTransfer] = useState(true)
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
  const [footerText, setFooterText] = useState('')

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
        // 결제 설정
        setEnableToss(s.enableToss)
        setEnableBankTransfer(s.enableBankTransfer)
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
          setFooterText(s.theme.footerText || '')
        } else {
          setPrimaryColor('')
          setSecondaryColor('')
          setLogoUrl('')
          setFaviconUrl('')
          setBannerUrl('')
          setFooterText('')
        }
      } else {
        toast.error(data.error || '쇼핑몰을 불러오는데 실패했습니다.')
        router.push('/shop/list')
      }
    } catch (error) {
      console.error('쇼핑몰 상세 조회 실패:', error)
      toast.error('쇼핑몰을 불러오는데 실패했습니다.')
      router.push('/shop/list')
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
        enableToss,
        enableBankTransfer,
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
          footerText: footerText || null,
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
        router.push('/shop/list')
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
      setEnableToss(shop.enableToss)
      setEnableBankTransfer(shop.enableBankTransfer)
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
        setFooterText(shop.theme.footerText || '')
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
            onClick={() => router.push('/shop/list')}
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
                    href={`https://${shop.subdomain}.bandauto.com`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
                  >
                    {shop.subdomain}.bandauto.com
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

        {/* 상세 정보 그리드 */}
        <div className="grid grid-cols-2 gap-6">
          {/* 왼쪽 컬럼 */}
          <div className="space-y-6">
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
                      <Input
                        value={subdomain}
                        onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                        placeholder="myshop"
                      />
                    ) : (
                      <p className="text-gray-900 font-mono">{shop.subdomain}</p>
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
                  <label className="block text-sm font-medium text-gray-500 mb-1">상태</label>
                    {isEditMode ? (
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="isActive"
                            checked={isActive}
                            onChange={() => setIsActive(true)}
                            className="w-4 h-4 text-green-600"
                          />
                          <span className="text-sm text-gray-700">활성</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="isActive"
                            checked={!isActive}
                            onChange={() => setIsActive(false)}
                            className="w-4 h-4 text-gray-600"
                          />
                          <span className="text-sm text-gray-700">비활성</span>
                        </label>
                      </div>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          shop.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {shop.isActive ? <Power size={12} /> : <PowerOff size={12} />}
                        {shop.isActive ? '활성' : '비활성'}
                      </span>
                    )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">커버 이미지 URL</label>
                  {isEditMode ? (
                    <Input
                      value={coverUrl}
                      onChange={(e) => setCoverUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  ) : (
                    <p className="text-gray-900 truncate">{shop.coverUrl || '-'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* 결제 설정 카드 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CreditCard size={18} className="text-green-600" />
                  </div>
                  <span className="font-semibold text-slate-900">결제 설정</span>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">결제 수단</label>
                  {isEditMode ? (
                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enableToss}
                          onChange={(e) => setEnableToss(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600"
                        />
                        <span className="text-sm text-gray-700">토스페이먼츠</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enableBankTransfer}
                          onChange={(e) => setEnableBankTransfer(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600"
                        />
                        <span className="text-sm text-gray-700">계좌이체</span>
                      </label>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {shop.enableToss && (
                        <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700">토스페이먼츠</span>
                      )}
                      {shop.enableBankTransfer && (
                        <span className="px-2 py-1 rounded text-xs bg-purple-100 text-purple-700">계좌이체</span>
                      )}
                      {!shop.enableToss && !shop.enableBankTransfer && (
                        <span className="text-gray-400 text-sm">없음</span>
                      )}
                    </div>
                  )}
                </div>
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

          {/* 오른쪽 컬럼 */}
          <div className="space-y-6">
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

            {/* 테마 설정 카드 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-pink-100 rounded-lg">
                    <Palette size={18} className="text-pink-600" />
                  </div>
                  <span className="font-semibold text-slate-900">테마 설정</span>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">메인 컬러</label>
                    {isEditMode ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={primaryColor || '#3B82F6'}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="w-10 h-10 rounded cursor-pointer"
                        />
                        <Input
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          placeholder="#3B82F6"
                          className="flex-1"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {shop.theme?.primaryColor && (
                          <div
                            className="w-6 h-6 rounded border border-gray-200"
                            style={{ backgroundColor: shop.theme.primaryColor }}
                          />
                        )}
                        <span className="text-gray-900 font-mono">{shop.theme?.primaryColor || '-'}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">보조 컬러</label>
                    {isEditMode ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={secondaryColor || '#6B7280'}
                          onChange={(e) => setSecondaryColor(e.target.value)}
                          className="w-10 h-10 rounded cursor-pointer"
                        />
                        <Input
                          value={secondaryColor}
                          onChange={(e) => setSecondaryColor(e.target.value)}
                          placeholder="#6B7280"
                          className="flex-1"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {shop.theme?.secondaryColor && (
                          <div
                            className="w-6 h-6 rounded border border-gray-200"
                            style={{ backgroundColor: shop.theme.secondaryColor }}
                          />
                        )}
                        <span className="text-gray-900 font-mono">{shop.theme?.secondaryColor || '-'}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">로고 URL</label>
                  {isEditMode ? (
                    <Input
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  ) : (
                    <p className="text-gray-900 truncate">{shop.theme?.logoUrl || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">파비콘 URL</label>
                  {isEditMode ? (
                    <Input
                      value={faviconUrl}
                      onChange={(e) => setFaviconUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  ) : (
                    <p className="text-gray-900 truncate">{shop.theme?.faviconUrl || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">배너 URL</label>
                  {isEditMode ? (
                    <Input
                      value={bannerUrl}
                      onChange={(e) => setBannerUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  ) : (
                    <p className="text-gray-900 truncate">{shop.theme?.bannerUrl || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">푸터 텍스트</label>
                  {isEditMode ? (
                    <textarea
                      value={footerText}
                      onChange={(e) => setFooterText(e.target.value)}
                      placeholder="쇼핑몰 하단에 표시될 텍스트"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      rows={3}
                    />
                  ) : (
                    <p className="text-gray-900 whitespace-pre-wrap">{shop.theme?.footerText || '-'}</p>
                  )}
                </div>
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
