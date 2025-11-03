import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * 사용자 정보 인터페이스
 */
export interface User {
  id: string
  email: string
  name?: string
  role: string
  image?: string
}

/**
 * 인증 상태 인터페이스
 */
interface AuthState {
  // 상태
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  // 액션
  setUser: (user: User | null) => void
  login: (user: User) => void
  logout: () => void
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
}

/**
 * 인증 Zustand Store
 *
 * Context 격리: 인증 관련 상태만 관리
 * NextAuth 세션과 동기화하여 사용
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // 초기 상태
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // 사용자 정보 설정
      setUser: (user) => {
        set({
          user,
          isAuthenticated: !!user,
          error: null
        })
      },

      // 로그인
      login: (user) => {
        set({
          user,
          isAuthenticated: true,
          error: null
        })
      },

      // 로그아웃
      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
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
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage),  // 세션 스토리지 사용 (보안)
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)

/**
 * NextAuth 세션과 동기화
 */
export function syncAuthWithSession(session: any) {
  const store = useAuthStore.getState()

  if (session?.user) {
    store.login({
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      image: session.user.image
    })
  } else {
    store.logout()
  }
}
