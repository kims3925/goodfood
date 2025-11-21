'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Store, Globe, Bell, Save, AlertTriangle } from 'lucide-react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'

interface Shop {
  id: string
  shopUrl: string
  shopName: string
  noticeTitle?: string
  noticeContent?: string
  isActive: boolean
}

export default function ShopSettingsPage() {
  const router = useRouter()
  const [shop, setShop] = useState<Shop | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showNoticeModal, setShowNoticeModal] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // 폼 데이터
  const [formData, setFormData] = useState({
    shopUrl: '',
    shopName: '',
    noticeTitle: '',
    noticeContent: ''
  })

  // 인증 확인 및 쇼핑몰 정보 로드
  useEffect(() => {
    checkAuthAndFetchData()
  }, [])

  const checkAuthAndFetchData = async () => {
    try {
      const response = await fetch('/api/auth/session')
      const data = await response.json()

      if (data.success && data.user) {
        setIsAuthenticated(true)
        fetchShopData()
      } else {
        router.push('/login')
      }
    } catch (error) {
      console.error('인증 확인 실패:', error)
      router.push('/login')
    }
  }

  const fetchShopData = async () => {
    try {
      const response = await fetch('/api/shop/settings')
      if (response.ok) {
        const data = await response.json()
        setShop(data.shop)
        if (data.shop) {
          setFormData({
            shopUrl: data.shop.shopUrl || '',
            shopName: data.shop.shopName || '',
            noticeTitle: data.shop.noticeTitle || '',
            noticeContent: data.shop.noticeContent || ''
          })
        }
      }
    } catch (error) {
      console.error('쇼핑몰 정보 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // 에러 초기화
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    // 몰 주소 검증 (영문+숫자만)
    if (!formData.shopUrl) {
      newErrors.shopUrl = '몰 주소를 입력해주세요.'
    } else if (!/^[a-zA-Z0-9]+$/.test(formData.shopUrl)) {
      newErrors.shopUrl = '몰 주소는 영문과 숫자만 사용 가능합니다.'
    } else if (formData.shopUrl.length < 3 || formData.shopUrl.length > 20) {
      newErrors.shopUrl = '몰 주소는 3~20자 이내로 입력해주세요.'
    }

    // 몰 이름 검증
    if (!formData.shopName) {
      newErrors.shopName = '몰 이름을 입력해주세요.'
    } else if (formData.shopName.length > 20) {
      newErrors.shopName = '몰 이름은 최대 20자까지 입력 가능합니다.'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return

    setSaving(true)
    try {
      const response = await fetch('/api/shop/settings', {
        method: shop ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        const result = await response.json()
        setShop(result.shop)
        alert(shop ? '쇼핑몰 정보가 수정되었습니다.' : '쇼핑몰이 생성되었습니다.')
      } else {
        const error = await response.json()
        if (error.code === 'URL_EXISTS') {
          setErrors({ shopUrl: '이미 사용 중인 몰 주소입니다.' })
        } else {
          alert('저장 중 오류가 발생했습니다.')
        }
      }
    } catch (error) {
      console.error('저장 실패:', error)
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-color"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Store className="w-8 h-8 text-primary-color" />
          <h1 className="text-3xl font-bold text-text-primary">몰관리</h1>
        </div>
        <p className="text-text-secondary">
          쇼핑몰의 기본 정보와 설정을 관리할 수 있습니다.
        </p>
      </div>

      <div className="grid gap-6">
        {/* 기본 정보 */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-text-primary mb-6 flex items-center gap-2">
            <Globe size={20} />
            기본 정보
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                몰 주소 *
              </label>
              <Input
                value={formData.shopUrl}
                onChange={(e) => handleInputChange('shopUrl', e.target.value)}
                placeholder="예: myshop123 (영문+숫자만)"
                className={errors.shopUrl ? 'border-error' : ''}
              />
              {errors.shopUrl && (
                <p className="text-sm text-error mt-1">{errors.shopUrl}</p>
              )}
              <p className="text-xs text-text-muted mt-1">
                스토어 URL: /store/{formData.shopUrl || 'myshop'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                몰 이름 *
              </label>
              <Input
                value={formData.shopName}
                onChange={(e) => handleInputChange('shopName', e.target.value)}
                placeholder="예: 나은이네 농산물"
                maxLength={20}
                className={errors.shopName ? 'border-error' : ''}
              />
              {errors.shopName && (
                <p className="text-sm text-error mt-1">{errors.shopName}</p>
              )}
              <p className="text-xs text-text-muted mt-1">
                {formData.shopName.length}/20자
              </p>
            </div>
          </div>
        </Card>

        {/* 공지사항 */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-text-primary flex items-center gap-2">
              <Bell size={20} />
              공지사항
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNoticeModal(true)}
              className="text-primary-color hover:text-primary-hover"
            >
              미리보기
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                공지사항 제목
              </label>
              <Input
                value={formData.noticeTitle}
                onChange={(e) => handleInputChange('noticeTitle', e.target.value)}
                placeholder="예: 신선한 농산물 할인 이벤트!"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                공지사항 내용
              </label>
              <textarea
                value={formData.noticeContent}
                onChange={(e) => handleInputChange('noticeContent', e.target.value)}
                placeholder="공지사항 내용을 입력하세요..."
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-color focus:border-transparent placeholder:text-text-muted resize-y"
                rows={6}
              />
            </div>
          </div>
        </Card>

        {/* 저장 버튼 */}
        <div className="flex justify-end gap-3">
          {shop && (
            <div className="flex items-center gap-2 text-sm text-text-secondary mr-auto">
              <AlertTriangle size={16} />
              마지막 수정: {new Date().toLocaleString('ko-KR')}
            </div>
          )}
          
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 min-w-[120px]"
          >
            <Save size={16} />
            {saving ? '저장 중...' : shop ? '수정하기' : '생성하기'}
          </Button>
        </div>
      </div>

      {/* 공지사항 미리보기 모달 */}
      {showNoticeModal && (
        <Modal
          isOpen={showNoticeModal}
          onClose={() => setShowNoticeModal(false)}
          title="공지사항 미리보기"
          size="lg"
        >
          <div className="space-y-4">
            {formData.noticeTitle || formData.noticeContent ? (
              <>
                {formData.noticeTitle && (
                  <h3 className="text-lg font-semibold text-text-primary">
                    {formData.noticeTitle}
                  </h3>
                )}
                {formData.noticeContent && (
                  <div className="text-text-secondary whitespace-pre-wrap">
                    {formData.noticeContent}
                  </div>
                )}
              </>
            ) : (
              <p className="text-text-muted text-center py-8">
                공지사항이 설정되지 않았습니다.
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}