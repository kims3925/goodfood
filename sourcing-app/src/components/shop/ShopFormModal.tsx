'use client'

import { useState, useEffect } from 'react'
import { X, Store, Globe, CreditCard, Phone } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import ImageUpload from '@/components/ui/ImageUpload'
import { useToast } from '@/components/ui/Toast'
import { BANKS, getBankByName, formatAccountNumber, getAccountNumberDigits } from '@/constants/banks'

interface Shop {
  id: number
  subdomain: string
  name: string
  coverUrl: string | null
  bankName: string | null
  bankAccount: string | null
  accountHolder: string | null
  contactPhone: string | null
  contactEmail: string | null
}

interface ShopFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  shop: Shop | null
}

export default function ShopFormModal({
  isOpen,
  onClose,
  onSuccess,
  shop,
}: ShopFormModalProps) {
  const toast = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [subdomain, setSubdomain] = useState('')
  const [name, setName] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [bankAccountDisplay, setBankAccountDisplay] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')

  // 은행 옵션
  const bankOptions = BANKS.map(bank => ({
    value: bank.name,
    label: bank.name,
  }))

  const selectedBank = getBankByName(bankName)

  // Initialize form when shop changes
  useEffect(() => {
    if (shop) {
      setSubdomain(shop.subdomain)
      setName(shop.name)
      setCoverUrl(shop.coverUrl || '')
      setBankName(shop.bankName || '')
      setBankAccount(shop.bankAccount || '')
      setAccountHolder(shop.accountHolder || '')
      setContactPhone(shop.contactPhone || '')
      setContactEmail(shop.contactEmail || '')
      // 계좌번호 포맷팅 표시
      if (shop.bankName && shop.bankAccount) {
        const bank = getBankByName(shop.bankName)
        if (bank) {
          setBankAccountDisplay(formatAccountNumber(shop.bankAccount, bank.code))
        } else {
          setBankAccountDisplay(shop.bankAccount || '')
        }
      }
    } else {
      resetForm()
    }
  }, [shop, isOpen])

  const resetForm = () => {
    setSubdomain('')
    setName('')
    setCoverUrl('')
    setBankName('')
    setBankAccount('')
    setBankAccountDisplay('')
    setAccountHolder('')
    setContactPhone('')
    setContactEmail('')
  }

  // 은행 선택 핸들러
  const handleBankChange = (value: string) => {
    setBankName(value)
    // 은행 변경 시 계좌번호 재포맷팅
    if (bankAccount) {
      const bank = getBankByName(value)
      if (bank) {
        const formatted = formatAccountNumber(bankAccount, bank.code)
        setBankAccountDisplay(formatted)
      }
    }
  }

  // 계좌번호 입력 핸들러
  const handleAccountNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    const digits = getAccountNumberDigits(inputValue)

    // 최대 자릿수 제한
    const maxLength = selectedBank?.length || 14
    const limitedDigits = digits.slice(0, maxLength)

    // 숫자만 저장
    setBankAccount(limitedDigits)

    // 포맷팅된 값 표시
    if (selectedBank) {
      const formatted = formatAccountNumber(limitedDigits, selectedBank.code)
      setBankAccountDisplay(formatted)
    } else {
      setBankAccountDisplay(limitedDigits)
    }
  }

  // 전화번호 입력 핸들러 (자동 포맷팅)
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    const digits = inputValue.replace(/\D/g, '')

    // 최대 11자리 제한
    const limitedDigits = digits.slice(0, 11)

    // 자동 포맷팅
    let formatted = ''
    if (limitedDigits.startsWith('02')) {
      // 서울 지역번호
      if (limitedDigits.length <= 2) {
        formatted = limitedDigits
      } else if (limitedDigits.length <= 5) {
        formatted = `${limitedDigits.slice(0, 2)}-${limitedDigits.slice(2)}`
      } else if (limitedDigits.length <= 9) {
        formatted = `${limitedDigits.slice(0, 2)}-${limitedDigits.slice(2, 5)}-${limitedDigits.slice(5)}`
      } else {
        formatted = `${limitedDigits.slice(0, 2)}-${limitedDigits.slice(2, 6)}-${limitedDigits.slice(6)}`
      }
    } else {
      // 일반 전화번호 (010, 031 등)
      if (limitedDigits.length <= 3) {
        formatted = limitedDigits
      } else if (limitedDigits.length <= 7) {
        formatted = `${limitedDigits.slice(0, 3)}-${limitedDigits.slice(3)}`
      } else {
        formatted = `${limitedDigits.slice(0, 3)}-${limitedDigits.slice(3, 7)}-${limitedDigits.slice(7)}`
      }
    }

    setContactPhone(formatted)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation - 기본 정보
    if (!subdomain.trim()) {
      toast.error('도메인을 입력해주세요.')
      return
    }

    if (!name.trim()) {
      toast.error('쇼핑몰명을 입력해주세요.')
      return
    }

    // Subdomain format validation
    const subdomainRegex = /^[a-z0-9-]+$/
    if (!subdomainRegex.test(subdomain)) {
      toast.error('도메인은 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.')
      return
    }

    if (!coverUrl.trim()) {
      toast.error('커버 이미지를 업로드해주세요.')
      return
    }

    // Validation - 계좌 정보
    if (!bankName.trim()) {
      toast.error('은행을 선택해주세요.')
      return
    }

    if (!bankAccount.trim()) {
      toast.error('계좌번호를 입력해주세요.')
      return
    }

    if (!accountHolder.trim()) {
      toast.error('예금주를 입력해주세요.')
      return
    }

    // Validation - 연락처 정보
    if (!contactPhone.trim()) {
      toast.error('연락처를 입력해주세요.')
      return
    }

    if (!contactEmail.trim()) {
      toast.error('이메일을 입력해주세요.')
      return
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(contactEmail)) {
      toast.error('올바른 이메일 형식을 입력해주세요.')
      return
    }

    setIsSubmitting(true)

    try {
      const data = {
        subdomain,
        name,
        coverUrl: coverUrl || null,
        bankName: bankName || null,
        bankAccount: bankAccount || null,
        accountHolder: accountHolder || null,
        contactPhone: contactPhone || null,
        contactEmail: contactEmail || null,
      }

      const url = shop ? `/api/shop/${shop.id}` : '/api/shop'
      const method = shop ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (result.success) {
        toast.success(shop ? '쇼핑몰이 수정되었습니다.' : '쇼핑몰이 등록되었습니다.')
        onSuccess()
        onClose()
        resetForm()
      } else {
        toast.error(result.error || '처리에 실패했습니다.')
      }
    } catch (error) {
      console.error('쇼핑몰 저장 실패:', error)
      toast.error('처리 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Store size={20} className="text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {shop ? '쇼핑몰 수정' : '쇼핑몰 등록'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-6">
            {/* 기본 정보 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Globe size={16} className="text-gray-500" />
                기본 정보
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    도메인 <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm whitespace-nowrap">
                      {process.env.NEXT_PUBLIC_SHOP_BASE_URL || 'http://localhost:3000'}/
                    </span>
                    <Input
                      type="text"
                      value={subdomain}
                      onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                      placeholder="myshop"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">영문 소문자, 숫자, 하이픈만 사용</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    쇼핑몰명 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="내 쇼핑몰"
                  />
                </div>
                <div className="col-span-2">
                  <ImageUpload
                    label="커버 이미지"
                    value={coverUrl}
                    onChange={(url) => setCoverUrl(url)}
                    placeholder="커버 이미지를 업로드하세요"
                    required
                  />
                </div>
              </div>
            </div>

            {/* 계좌 정보 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard size={16} className="text-gray-500" />
                계좌 정보
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    은행 <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={bankName}
                    onChange={handleBankChange}
                    options={bankOptions}
                    placeholder="은행 선택"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    계좌번호 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={bankAccountDisplay}
                    onChange={handleAccountNumberChange}
                    placeholder={selectedBank?.placeholder || '계좌번호 입력'}
                    disabled={!bankName}
                  />
                  {selectedBank && (
                    <p className="text-xs text-gray-400 mt-1">
                      형식: {selectedBank.format} ({selectedBank.length}자리)
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    예금주 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    placeholder="홍길동"
                  />
                </div>
              </div>
            </div>

            {/* 연락처 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Phone size={16} className="text-gray-500" />
                연락처 정보
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    연락처 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={contactPhone}
                    onChange={handlePhoneChange}
                    placeholder="010-1234-5678"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    형식: 010-XXXX-XXXX 또는 02-XXXX-XXXX
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    이메일 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="support@example.com"
                  />
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            취소
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            loading={isSubmitting}
          >
            {shop ? '수정' : '등록'}
          </Button>
        </div>
      </div>
    </div>
  )
}
