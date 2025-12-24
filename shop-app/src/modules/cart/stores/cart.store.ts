import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * API 경로에 shop slug 추가
 */
function buildApiPath(path: string, slug?: string): string {
  if (!slug) return path
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `/${slug}${normalizedPath}`
}

/**
 * 장바구니 아이템 인터페이스
 */
export interface CartItem {
  id: number
  productId: number
  quantity: number
  priceAt: number
  product: {
    id: number
    title: string
    salePrice: number
    images: string
    isAvailable: boolean
    shippingFee?: number
  }
}

/**
 * 장바구니 상태 인터페이스
 */
interface CartState {
  // 상태
  sessionId: string | null
  items: CartItem[]
  totalItems: number
  totalAmount: number
  shippingFee: number
  finalAmount: number
  isLoading: boolean
  error: string | null

  // 액션
  setSessionId: (sessionId: string) => void
  setItems: (items: CartItem[]) => void
  addItem: (item: CartItem) => void
  updateItemQuantity: (itemId: number, quantity: number) => void
  removeItem: (itemId: number) => void
  clearCart: () => void
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
  calculateTotals: () => void
}

/**
 * 장바구니 Zustand Store
 *
 * Context 격리: 장바구니 관련 상태만 관리
 * LocalStorage에 자동 저장 (비회원 장바구니 유지)
 */
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      // 초기 상태
      sessionId: null,
      items: [],
      totalItems: 0,
      totalAmount: 0,
      shippingFee: 0,
      finalAmount: 0,
      isLoading: false,
      error: null,

      // 세션 ID 설정
      setSessionId: (sessionId) => {
        set({ sessionId })
      },

      // 아이템 전체 설정 (서버에서 가져온 데이터)
      setItems: (items) => {
        set({ items }, false)
        get().calculateTotals()
      },

      // 아이템 추가
      addItem: (item) => {
        const { items } = get()
        const existingIndex = items.findIndex((i) => i.productId === item.productId)

        if (existingIndex !== -1) {
          // 기존 아이템 수량 증가
          const updatedItems = [...items]
          updatedItems[existingIndex].quantity += item.quantity
          set({ items: updatedItems }, false)
        } else {
          // 새 아이템 추가
          set({ items: [...items, item] }, false)
        }

        get().calculateTotals()
      },

      // 아이템 수량 변경
      updateItemQuantity: (itemId, quantity) => {
        const { items } = get()

        if (quantity <= 0) {
          // 수량이 0 이하면 삭제
          get().removeItem(itemId)
          return
        }

        const updatedItems = items.map((item) =>
          item.id === itemId ? { ...item, quantity } : item
        )

        set({ items: updatedItems }, false)
        get().calculateTotals()
      },

      // 아이템 삭제
      removeItem: (itemId) => {
        const { items } = get()
        const filteredItems = items.filter((item) => item.id !== itemId)
        set({ items: filteredItems }, false)
        get().calculateTotals()
      },

      // 장바구니 비우기
      clearCart: () => {
        set({
          items: [],
          totalItems: 0,
          totalAmount: 0,
          shippingFee: 0,
          finalAmount: 0,
          error: null
        })
      },

      // 로딩 상태 설정
      setLoading: (isLoading) => {
        set({ isLoading })
      },

      // 에러 설정
      setError: (error) => {
        set({ error })
      },

      // 총액 계산
      calculateTotals: () => {
        const { items } = get()

        const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
        const totalAmount = items.reduce(
          (sum, item) => sum + item.priceAt * item.quantity,
          0
        )

        // 배송비는 상품별로 계산 (각 상품의 shippingFee 합산)
        const shippingFee = items.reduce(
          (sum, item) => sum + (item.product.shippingFee || 0),
          0
        )

        const finalAmount = totalAmount + shippingFee

        set({
          totalItems,
          totalAmount,
          shippingFee,
          finalAmount
        })
      }
    }),
    {
      name: 'cart-storage',  // LocalStorage 키
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // LocalStorage에 저장할 필드만 선택
        sessionId: state.sessionId,
        items: state.items
      })
    }
  )
)

/**
 * 장바구니 아이템 추가 (API 호출 포함)
 */
export async function addToCartWithAPI(
  productId: string,
  quantity: number = 1,
  userId?: string,
  slug?: string
): Promise<void> {
  const store = useCartStore.getState()
  const sessionId = store.sessionId

  if (!sessionId) {
    throw new Error('세션 ID가 없습니다.')
  }

  store.setLoading(true)
  store.setError(null)

  try {
    const response = await fetch(buildApiPath('/api/cart', slug), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, userId, productId, quantity })
    })

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || '장바구니 추가 실패')
    }

    // 서버 응답으로 상태 업데이트
    if (result.cart) {
      store.setItems(result.cart.items)
    }
  } catch (error: any) {
    store.setError(error.message)
    throw error
  } finally {
    store.setLoading(false)
  }
}

/**
 * 장바구니 동기화 (서버에서 가져오기)
 */
export async function syncCartWithServer(
  sessionId: string,
  userId?: string,
  slug?: string
): Promise<void> {
  const store = useCartStore.getState()
  store.setLoading(true)

  try {
    const params = new URLSearchParams({ sessionId })
    if (userId) params.append('userId', userId)

    const response = await fetch(buildApiPath(`/api/cart?${params.toString()}`, slug))
    const result = await response.json()

    if (result.success && result.cart) {
      store.setItems(result.cart.items || [])
    } else {
      store.clearCart()
    }
  } catch (error: any) {
    console.error('장바구니 동기화 실패:', error)
    store.setError(error.message)
  } finally {
    store.setLoading(false)
  }
}
