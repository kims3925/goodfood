'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, Edit, Save, X, Trash2, AlertCircle, ImageOff, ExternalLink } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'

interface MatchedProduct {
  id: number
  name: string
  thumbnailUrl: string | null
}

interface PurchaseOrder {
  id: number
  productId: number | null
  productName: string
  totalPrice: number | null
  customerName: string
  createdAt: string
  updatedAt: string
  product: MatchedProduct | null
}

export default function OrderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = parseInt(params.id as string)

  const [order, setOrder] = useState<PurchaseOrder | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 편집 모드 상태
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    productName: '',
    totalPrice: '',
    customerName: '',
  })

  useEffect(() => {
    if (orderId) {
      loadOrder()
    }
  }, [orderId])

  const loadOrder = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/order/${orderId}`)
      const data = await response.json()

      if (data.success) {
        setOrder(data.data)
        setFormData({
          productName: data.data.productName,
          totalPrice: data.data.totalPrice?.toString() || '',
          customerName: data.data.customerName,
        })
      } else {
        setError(data.error || '주문을 불러오는데 실패했습니다.')
      }
    } catch (err) {
      console.error('주문 로드 실패:', err)
      setError('주문을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartEdit = () => {
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    if (order) {
      setFormData({
        productName: order.productName,
        totalPrice: order.totalPrice?.toString() || '',
        customerName: order.customerName,
      })
    }
    setIsEditing(false)
  }

  const handleSave = async () => {
    if (!order) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/order/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: formData.productName,
          totalPrice: formData.totalPrice ? parseInt(formData.totalPrice) : null,
          customerName: formData.customerName,
        }),
      })

      const data = await response.json()

      if (data.success || response.ok) {
        loadOrder()
        setIsEditing(false)
      }
    } catch (error) {
      console.error('주문 저장 실패:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!order) return
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/order/${order.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        router.push('/order/list')
      }
    } catch (error) {
      console.error('주문 삭제 실패:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR')
  }

  const formatPrice = (price: number | null) => {
    if (!price) return '-'
    return `₩${price.toLocaleString()}`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="flex flex-col items-center justify-center space-y-4">
              <AlertCircle className="text-red-500" size={48} />
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">주문을 찾을 수 없습니다</h3>
                <p className="text-gray-600">{error}</p>
              </div>
              <Button variant="primary" onClick={() => router.push('/order/list')}>
                주문 목록으로 돌아가기
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.push('/order/list')}>
              <ArrowLeft size={20} />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">주문 상세</h1>
              <p className="text-gray-600 mt-1">주문 정보를 확인하고 수정할 수 있습니다.</p>
            </div>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button variant="secondary" onClick={handleCancelEdit}>
                  <X size={16} />
                  취소
                </Button>
                <Button variant="primary" onClick={handleSave} disabled={isSaving}>
                  <Save size={16} />
                  {isSaving ? '저장 중...' : '저장'}
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={handleStartEdit}>
                  <Edit size={16} />
                  수정
                </Button>
                <Button variant="danger" onClick={handleDelete}>
                  <Trash2 size={16} />
                  삭제
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Row 1: 주문 정보 + 매칭 상품 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {/* 주문 정보 Card */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">주문 정보</h2>
              </div>
              <div className="p-6 space-y-6 flex-1">
                {/* 상품명 */}
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-2 block">상품명</label>
                  {isEditing ? (
                    <Input
                      type="text"
                      value={formData.productName}
                      onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                      placeholder="상품명"
                    />
                  ) : (
                    <p className="text-lg font-semibold text-gray-900">{order.productName}</p>
                  )}
                </div>

                {/* 총금액 */}
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-2 block">총금액</label>
                  {isEditing ? (
                    <Input
                      type="number"
                      value={formData.totalPrice}
                      onChange={(e) => setFormData({ ...formData, totalPrice: e.target.value })}
                      placeholder="0"
                    />
                  ) : (
                    <p className="text-2xl font-bold text-gray-900">{formatPrice(order.totalPrice)}</p>
                  )}
                </div>

                {/* 주문자 이름 */}
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-2 block">주문자 이름</label>
                  {isEditing ? (
                    <Input
                      type="text"
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      placeholder="주문자 이름"
                    />
                  ) : (
                    <p className="text-gray-900">{order.customerName}</p>
                  )}
                </div>
              </div>
            </div>

            {/* 매칭 상품 Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">매칭된 상품</h2>
              </div>
              <div className="p-6 flex-1">
                {order.product ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      {order.product.thumbnailUrl ? (
                        <Image
                          src={order.product.thumbnailUrl}
                          alt={order.product.name}
                          width={80}
                          height={80}
                          className="w-20 h-20 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-lg bg-gray-200 flex items-center justify-center">
                          <ImageOff size={32} className="text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{order.product.name}</p>
                        <p className="text-sm text-gray-500">ID: {order.product.id}</p>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => router.push(`/product/detail/${order.product!.id}`)}
                      className="w-full"
                    >
                      <ExternalLink size={16} />
                      상품 상세 보기
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                    <ImageOff size={48} className="text-gray-300 mb-4" />
                    <p className="text-gray-500">매칭된 상품이 없습니다</p>
                    <p className="text-sm text-gray-400 mt-1">주문 상품명과 일치하는 상품을 찾지 못했습니다.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 메타데이터 Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">메타데이터</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-500">주문 ID</label>
                  <p className="mt-1 text-gray-900">{order.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">등록일</label>
                  <p className="mt-1 text-gray-900">{formatDate(order.createdAt)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">수정일</label>
                  <p className="mt-1 text-gray-900">{formatDate(order.updatedAt)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
