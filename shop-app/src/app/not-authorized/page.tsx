import Link from 'next/link'

export const metadata = {
  title: '접근 권한 없음',
  description: '이 페이지에 접근할 권한이 없습니다',
}

export default function NotAuthorizedPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-gray-300 mb-4">403</h1>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            접근 권한이 없습니다
          </h2>
          <p className="text-gray-600">
            이 페이지에 접근할 권한이 없거나, 유효하지 않은 쇼핑몰입니다.
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/auth/login"
            className="block w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            로그인 페이지로 이동
          </Link>
        </div>
      </div>
    </div>
  )
}
