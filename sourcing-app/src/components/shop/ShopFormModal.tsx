'use client'

import { useState, useEffect } from 'react'
import { X, Store, Globe, CreditCard, Truck, Mail, Phone } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import ImageUpload from '@/components/ui/ImageUpload'
import { useToast } from '@/components/ui/Toast'

interface Shop {
  id: number
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
  const [accountHolder, setAccountHolder] = useState('')
  const [freeShippingAmount, setFreeShippingAmount] = useState('')
  const [defaultShippingFee, setDefaultShippingFee] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')

  // Initialize form when shop changes
  useEffect(() => {
    if (shop) {
      setSubdomain(shop.subdomain)
      setName(shop.name)
      setCoverUrl(shop.coverUrl || '')
      setBankName(shop.bankName || '')
      setBankAccount(shop.bankAccount || '')
      setAccountHolder(shop.accountHolder || '')
      setFreeShippingAmount(shop.freeShippingAmount?.toString() || '')
      setDefaultShippingFee(shop.defaultShippingFee?.toString() || '')
      setContactPhone(shop.contactPhone || '')
      setContactEmail(shop.contactEmail || '')
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
    setAccountHolder('')
    setFreeShippingAmount('')
    setDefaultShippingFee('')
    setContactPhone('')
    setContactEmail('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!subdomain.trim()) {
      toast.error('서브도메인을 입력해주세요.')
      return
    }

    if (!name.trim()) {
      toast.error('쇼핑몰명을 입력해주세요.')
      return
    }

    // Subdomain format validation
    const subdomainRegex = /^[a-z0-9-]+$/
    if (!subdomainRegex.test(subdomain)) {
      toast.error('서브도메인은 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.')
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
        freeShippingAmount: freeShippingAmount ? parseInt(freeShippingAmount) : null,
        defaultShippingFee: defaultShippingFee ? parseInt(defaultShippingFee) : null,
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
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
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
                    서브도메인 <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={subdomain}
                      onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                      placeholder="myshop"
                      className="flex-1"
                    />
                    <span className="text-gray-500 text-sm whitespace-nowrap">.bandauto.com</span>
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
                    은행명
                  </label>
                  <Input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="국민은행"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    계좌번호
                  </label>
                  <Input
                    type="text"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    placeholder="123-456-789012"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    예금주
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

            {/* 배송 설정 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Truck size={16} className="text-gray-500" />
                배송 설정
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    무료배송 기준금액
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={freeShippingAmount}
                      onChange={(e) => setFreeShippingAmount(e.target.value)}
                      placeholder="50000"
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">원</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    기본 배송비
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={defaultShippingFee}
                      onChange={(e) => setDefaultShippingFee(e.target.value)}
                      placeholder="3000"
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">원</span>
                  </div>
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
                    연락처
                  </label>
                  <Input
                    type="text"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="02-1234-5678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    이메일
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
