import prisma from '@bandauto/db'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '쇼핑몰 선택',
  description: '방문하실 쇼핑몰을 선택해주세요',
}

export default async function ChannelSelectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const error = params.error

  // 활성화된 소매 채널 목록 조회
  const channels = await prisma.channel.findMany({
    where: {
      kind: 'RETAIL',
      isActive: true,
      NOT: { subdomain: null },
    },
    select: {
      id: true,
      subdomain: true,
      name: true,
      displayName: true,
      coverUrl: true,
    },
    orderBy: { name: 'asc' },
  })

  // 개발 환경 여부 확인
  const isDev = process.env.NODE_ENV !== 'production'

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">쇼핑몰 선택</h1>
          <p className="text-gray-600">방문하실 쇼핑몰을 선택해주세요</p>
        </div>

        {error === 'not-found' && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
            <p className="text-yellow-800">요청하신 쇼핑몰을 찾을 수 없습니다.</p>
          </div>
        )}

        {error === 'inactive' && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
            <p className="text-yellow-800">해당 쇼핑몰은 현재 운영 중이 아닙니다.</p>
          </div>
        )}

        {channels.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">현재 운영 중인 쇼핑몰이 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {channels.map((channel) => {
              // 개발환경: lvh.me 사용, 프로덕션: 실제 도메인
              const channelUrl = isDev
                ? `http://${channel.subdomain}.lvh.me:3000`
                : `https://${channel.subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'shop.com'}`

              return (
                <Link
                  key={channel.id}
                  href={channelUrl}
                  className="block bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200"
                >
                  {channel.coverUrl ? (
                    <div className="h-40 overflow-hidden">
                      <img
                        src={channel.coverUrl}
                        alt={channel.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-40 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <span className="text-4xl font-bold text-white">
                        {(channel.displayName || channel.name).charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="p-4">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {channel.displayName || channel.name}
                    </h2>
                    {isDev && (
                      <p className="text-sm text-gray-400 mt-1">
                        {channel.subdomain}.lvh.me:3000
                      </p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {isDev && (
          <div className="mt-12 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">개발 환경 안내</h3>
            <p className="text-blue-800 text-sm mb-2">
              로컬에서 서브도메인 테스트를 위해 <code className="bg-blue-100 px-1 rounded">lvh.me</code>를 사용합니다.
            </p>
            <ul className="text-blue-700 text-sm list-disc list-inside">
              <li>lvh.me는 127.0.0.1로 자동 연결됩니다</li>
              <li>쿼리 파라미터로도 테스트 가능: <code className="bg-blue-100 px-1 rounded">localhost:3000?channel=subdomain</code></li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
