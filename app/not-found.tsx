import Link from 'next/link'
import { Home, ArrowLeft } from 'lucide-react'
import Button from '@/components/ui/Button'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="text-center">
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-primary-color opacity-30">404</h1>
        </div>
        
        <h2 className="text-3xl font-bold text-text-primary mb-4">
          페이지를 찾을 수 없습니다
        </h2>
        
        <p className="text-text-secondary mb-8 max-w-md mx-auto">
          요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
          URL을 다시 확인하거나 홈페이지로 돌아가세요.
        </p>
        
        <div className="flex gap-4 justify-center">
          <Link href="/">
            <Button variant="secondary">
              <ArrowLeft size={20} className="mr-2" />
              뒤로 가기
            </Button>
          </Link>
          
          <Link href="/dashboard">
            <Button>
              <Home size={20} className="mr-2" />
              대시보드로 이동
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}