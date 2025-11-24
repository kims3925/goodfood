'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Edit, Save, X, Package, FileText, Trash2, AlertCircle } from 'lucide-react'
import Button from '@/components/ui/Button'
import Loading from '@/components/ui/Loading'
import ProductFormModal from '@/components/product/ProductFormModal'
import Link from 'next/link'

interface Product {
  id: number
  postId: number
  name: string
  description: string | null
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'SOLDOUT'
  thumbnailUrl: string | null
  price: number | null
  wholesalePrice: number | null
  categoryId: string | null
  currency: string
  createdAt: string
  updatedAt: string
  post: {
    id: number
    title: string
    content: string
    wholesaleBand: {
      name: string
      bandKey: string
      coverUrl: string | null
    }
    images: Array<{
      imageUrl: string
    }>
  }
  options: Array<{
    id: number
    groupName: string
    value: string
    sortOrder: number
  }>
  variants: Array<{
    id: number
    sku: string | null
    optionSummary: string | null
    price: number
    wholesalePrice: number | null
    stock: number
  }>
}

export default function ProductDetailPage() {
  const router = useRouter()
  const params = useParams()
  const productId = parseInt(params.id as string)

  const [product, setProduct] = useState<Product | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)

  useEffect(() => {
    if (productId) {
      loadProduct()
    }
  }, [productId])

  const loadProduct = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/product/${productId}`)
      const data = await response.json()

      if (data.success) {
        setProduct(data.data)
      } else {
        setError(data.error || '상품을 불러오는데 실패했습니다.')
      }
    } catch (err) {
      console.error('상품 로드 실패:', err)
      setError('상품을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateStatus = async (newStatus: Product['status']) => {
    if (!product) return

    try {
      const response = await fetch('/api/product', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: product.id,
          status: newStatus,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setProduct({ ...product, status: newStatus })
        alert('상태가 변경되었습니다.')
      } else {
        alert(data.error || '상태 변경에 실패했습니다.')
      }
    } catch (error) {
      console.error('상태 변경 실패:', error)
      alert('상태 변경에 실패했습니다.')
    }
  }

  const handleDelete = async () => {
    if (!product) return
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/product?id=${product.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        alert('상품이 삭제되었습니다.')
        router.push('/product/list')
      } else {
        alert(data.error || '삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('상품 삭제 실패:', error)
      alert('상품 삭제에 실패했습니다.')
    }
  }

  const handleEditComplete = () => {
    setShowEditModal(false)
    loadProduct() // Reload product data
  }

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; color: string } } = {
      DRAFT: { label: '임시저장', color: 'bg-gray-100 text-gray-800' },
      ACTIVE: { label: '판매중', color: 'bg-green-100 text-green-800' },
      INACTIVE: { label: '판매중지', color: 'bg-yellow-100 text-yellow-800' },
      SOLDOUT: { label: '품절', color: 'bg-red-100 text-red-800' },
    }

    const statusInfo = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' }

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    )
  }

  const formatPrice = (price: number | null) => {
    if (!price) return '-'
    return `₩${price.toLocaleString()}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR')
  }

  // Group options by groupName
  const groupedOptions = product?.options.reduce((acc, option) => {
    if (!acc[option.groupName]) {
      acc[option.groupName] = []
    }
    acc[option.groupName].push(option.value)
    return acc
  }, {} as Record<string, string[]>) || {}

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="flex flex-col items-center justify-center space-y-4">
              <AlertCircle className="text-red-500" size={48} />
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">상품을 찾을 수 없습니다</h3>
                <p className="text-gray-600">{error}</p>
              </div>
              <Button variant="primary" onClick={() => router.push('/product/list')}>
                상품 목록으로 돌아가기
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.push('/product/list')}>
              <ArrowLeft size={20} />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">상품 상세</h1>
              <p className="text-gray-600 mt-1">상품 정보를 확인하고 수정할 수 있습니다.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowEditModal(true)}>
              <Edit size={16} />
              수정
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              <Trash2 size={16} />
              삭제
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">기본 정보</h2>
              </div>
              <div className="p-6 space-y-6">
                {/* Thumbnail & Name */}
                <div className="flex gap-6">
                  {product.thumbnailUrl ? (
                    <img
                      src={product.thumbnailUrl}
                      alt={product.name}
                      className="w-32 h-32 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <Package size={48} className="text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h3>
                    {product.description && (
                      <p className="text-gray-600 whitespace-pre-wrap">{product.description}</p>
                    )}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">카테고리</label>
                    <p className="mt-1 text-gray-900">{product.categoryId || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">도매가</label>
                    <p className="mt-1 text-gray-900 line-through">{formatPrice(product.wholesalePrice)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">판매가</label>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{formatPrice(product.price)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Options Card */}
            {Object.keys(groupedOptions).length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">옵션 정보</h2>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {Object.entries(groupedOptions).map(([groupName, values]) => (
                      <div key={groupName}>
                        <label className="text-sm font-medium text-gray-700">{groupName}</label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {values.map((value, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-50 text-purple-700 border border-purple-200"
                            >
                              {value}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}


            {/* Source Post Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">출처 게시물</h2>
                <Link
                  href={`/post/detail/${product.post.id}`}
                  className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
                >
                  <FileText size={14} />
                  게시물 보기
                </Link>
              </div>
              <div className="p-6">
                <div className="flex items-start gap-4">
                  {product.post.images[0]?.imageUrl && (
                    <img
                      src={product.post.images[0].imageUrl}
                      alt={product.post.title}
                      className="w-24 h-24 rounded-lg object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-purple-600">
                        {product.post.wholesaleBand.name}
                      </span>
                    </div>
                    <h4 className="font-medium text-gray-900 mb-1">{product.post.title}</h4>
                    <p className="text-sm text-gray-600 line-clamp-2">{product.post.content}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">상태 관리</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-2 block">현재 상태</label>
                  {getStatusBadge(product.status)}
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">상태 변경</label>
                  <div className="space-y-2">
                    <Button
                      variant={product.status === 'ACTIVE' ? 'primary' : 'secondary'}
                      onClick={() => handleUpdateStatus('ACTIVE')}
                      disabled={product.status === 'ACTIVE'}
                      className="w-full"
                    >
                      판매중으로 변경
                    </Button>
                    <Button
                      variant={product.status === 'INACTIVE' ? 'primary' : 'secondary'}
                      onClick={() => handleUpdateStatus('INACTIVE')}
                      disabled={product.status === 'INACTIVE'}
                      className="w-full"
                    >
                      판매중지로 변경
                    </Button>
                    <Button
                      variant={product.status === 'SOLDOUT' ? 'primary' : 'secondary'}
                      onClick={() => handleUpdateStatus('SOLDOUT')}
                      disabled={product.status === 'SOLDOUT'}
                      className="w-full"
                    >
                      품절로 변경
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Metadata Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">메타데이터</h2>
              </div>
              <div className="p-6 space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">생성일</label>
                  <p className="mt-1 text-sm text-gray-900">{formatDate(product.createdAt)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">수정일</label>
                  <p className="mt-1 text-sm text-gray-900">{formatDate(product.updatedAt)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">상품 ID</label>
                  <p className="mt-1 text-sm text-gray-900 font-mono">{product.id}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <ProductFormModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          postId={product.postId}
          productId={product.id}
          initialData={{
            name: product.name,
            description: product.description || '',
            categoryId: product.categoryId || '',
            currency: product.currency,
            price: product.price || 0,
            wholesalePrice: product.wholesalePrice || undefined,
            options: Object.entries(groupedOptions).map(([groupName, values]) => ({
              groupName,
              values,
            })),
            variants: product.variants.map((v) => ({
              optionSummary: v.optionSummary || '',
              price: v.price,
              wholesalePrice: v.wholesalePrice || undefined,
              stock: v.stock,
              options: {},
            })),
          }}
          onSaved={handleEditComplete}
        />
      )}
    </div>
  )
}
