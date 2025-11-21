'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  ShoppingCart,
  DollarSign,
  Archive
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'

interface ShopProduct {
  id: string
  productCode: string
  category: string
  name: string
  summary?: string
  status: string
  stock: number
  supplyPrice: number
  salePrice: number
  shippingType: string
  shippingFee: number
  hasOptions: boolean
  thumbnail?: string
  isPublished: boolean
  createdAt: string
  updatedAt: string
}

interface Shop {
  id: string
  shopUrl: string
  shopName: string
}

export default function ShopProductsPage() {
  const router = useRouter()
  const [shop, setShop] = useState<Shop | null>(null)
  const [products, setProducts] = useState<ShopProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showProductModal, setShowProductModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ShopProduct | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // 인증 확인 및 데이터 로드
  useEffect(() => {
    checkAuthAndFetchData()
  }, [])

  const checkAuthAndFetchData = async () => {
    try {
      const response = await fetch('/api/auth/session')
      const data = await response.json()

      if (data.success && data.user) {
        setIsAuthenticated(true)
        fetchShopAndProducts()
      } else {
        router.push('/login')
      }
    } catch (error) {
      console.error('인증 확인 실패:', error)
      router.push('/login')
    }
  }

  const fetchShopAndProducts = async () => {
    try {
      // 쇼핑몰 정보 조회
      const shopResponse = await fetch('/api/shop/settings')
      if (shopResponse.ok) {
        const shopData = await shopResponse.json()
        setShop(shopData.shop)
        
        // 상품 목록 조회
        if (shopData.shop) {
          const productsResponse = await fetch('/api/shop/products')
          if (productsResponse.ok) {
            const productsData = await productsResponse.json()
            setProducts(productsData.products || [])
          }
        }
      }
    } catch (error) {
      console.error('데이터 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  // 필터링된 상품
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesStatus = statusFilter === 'ALL' || product.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [products, searchTerm, statusFilter])

  // 페이지네이션된 상품
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredProducts, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)

  const handleAddProduct = () => {
    setSelectedProduct(null)
    setShowProductModal(true)
  }

  const handleEditProduct = (product: ShopProduct) => {
    setSelectedProduct(product)
    setShowProductModal(true)
  }

  const handleTogglePublish = async (productId: string, isPublished: boolean) => {
    try {
      const response = await fetch(`/api/shop/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: !isPublished })
      })

      if (response.ok) {
        setProducts(prev => 
          prev.map(p => 
            p.id === productId ? { ...p, isPublished: !isPublished } : p
          )
        )
      }
    } catch (error) {
      console.error('상품 노출 설정 실패:', error)
    }
  }

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/shop/products/${productId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setProducts(prev => prev.filter(p => p.id !== productId))
        alert('상품이 삭제되었습니다.')
      }
    } catch (error) {
      console.error('상품 삭제 실패:', error)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap = {
      ACTIVE: { label: '판매중', color: 'bg-green-100 text-green-800' },
      INACTIVE: { label: '판매중지', color: 'bg-gray-100 text-gray-800' },
      SOLD_OUT: { label: '품절', color: 'bg-red-100 text-red-800' }
    }
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || statusMap.ACTIVE
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-color"></div>
      </div>
    )
  }

  if (!shop) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="p-8 text-center">
          <ShoppingCart className="w-16 h-16 text-text-muted mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-text-primary mb-2">
            쇼핑몰이 설정되지 않았습니다
          </h2>
          <p className="text-text-secondary mb-6">
            먼저 쇼핑몰 기본 정보를 설정해주세요.
          </p>
          <Button onClick={() => router.push('/admin/shop/settings')}>
            쇼핑몰 설정하기
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Package className="w-8 h-8 text-primary-color" />
          <div>
            <h1 className="text-3xl font-bold text-text-primary">상품관리</h1>
            <p className="text-text-secondary">{shop.shopName} 쇼핑몰</p>
          </div>
        </div>
      </div>

      {/* 필터 및 검색 */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" size={20} />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="상품명, 상품코드, 카테고리로 검색..."
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="flex gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-color"
            >
              <option value="ALL">전체 상태</option>
              <option value="ACTIVE">판매중</option>
              <option value="INACTIVE">판매중지</option>
              <option value="SOLD_OUT">품절</option>
            </select>
            
            <Button onClick={handleAddProduct} className="flex items-center gap-2">
              <Plus size={16} />
              상품 등록
            </Button>
          </div>
        </div>
      </Card>

      {/* 상품 목록 */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-primary">상품정보</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-primary">상태</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-primary">재고</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-primary">가격</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-primary">배송비</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-primary">노출</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-text-primary">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {paginatedProducts.map((product) => (
                <tr key={product.id} className="hover:bg-surface">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      {product.thumbnail ? (
                        <img 
                          src={product.thumbnail} 
                          alt={product.name}
                          className="w-12 h-12 object-cover rounded-md"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-surface rounded-md flex items-center justify-center">
                          <Package size={20} className="text-text-muted" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-text-primary">{product.name}</p>
                        <p className="text-sm text-text-secondary">{product.productCode}</p>
                        <p className="text-xs text-text-muted">{product.category}</p>
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-4 py-4">
                    {getStatusBadge(product.status)}
                  </td>
                  
                  <td className="px-4 py-4">
                    <span className={`${product.stock <= 5 ? 'text-error' : 'text-text-primary'}`}>
                      {product.stock}개
                    </span>
                  </td>
                  
                  <td className="px-4 py-4">
                    <div className="text-sm">
                      <p className="text-text-secondary">공급: ₩{product.supplyPrice.toLocaleString()}</p>
                      <p className="font-medium text-text-primary">판매: ₩{product.salePrice.toLocaleString()}</p>
                    </div>
                  </td>
                  
                  <td className="px-4 py-4">
                    <span className="text-sm text-text-secondary">
                      {product.shippingType === 'FREE' ? '무료' : `₩${product.shippingFee.toLocaleString()}`}
                    </span>
                  </td>
                  
                  <td className="px-4 py-4">
                    <button
                      onClick={() => handleTogglePublish(product.id, product.isPublished)}
                      className={`p-2 rounded-md transition-colors ${
                        product.isPublished 
                          ? 'text-green-600 hover:bg-green-50' 
                          : 'text-gray-400 hover:bg-gray-50'
                      }`}
                      title={product.isPublished ? '노출됨' : '숨김'}
                    >
                      {product.isPublished ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </td>
                  
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleEditProduct(product)}
                        className="p-2 text-primary-color hover:bg-primary-light rounded-md transition-colors"
                        title="수정"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="p-2 text-error hover:bg-red-50 rounded-md transition-colors"
                        title="삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <Archive className="w-16 h-16 text-text-muted mx-auto mb-4" />
              <p className="text-text-muted">
                {searchTerm || statusFilter !== 'ALL' 
                  ? '검색 조건에 맞는 상품이 없습니다.'
                  : '등록된 상품이 없습니다.'
                }
              </p>
            </div>
          )}
        </div>
        
        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t border-divider">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              이전
            </Button>
            
            <span className="text-sm text-text-secondary px-4">
              {currentPage} / {totalPages}
            </span>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              다음
            </Button>
          </div>
        )}
      </Card>

      {/* 상품 등록/수정 모달 - 기본 구조만 */}
      {showProductModal && (
        <Modal
          isOpen={showProductModal}
          onClose={() => setShowProductModal(false)}
          title={selectedProduct ? '상품 수정' : '상품 등록'}
          size="xl"
        >
          <div className="space-y-6">
            <p className="text-text-secondary">
              상품 등록/수정 폼이 여기에 표시됩니다.
            </p>
            <div className="text-sm text-text-muted">
              다음 필드들이 포함됩니다:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>상품코드, 카테고리, 상품명</li>
                <li>상품요약정보, 판매상태, 재고수량</li>
                <li>공급가, 판매가, 배송비 설정</li>
                <li>옵션 관리, 상품 이미지</li>
                <li>상품 상세정보, 과세유형</li>
              </ul>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}