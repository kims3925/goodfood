/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  // Docker 배포를 위한 standalone 모드
  output: 'standalone',

  // 보안 헤더 설정
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
  // 빌드 시 타입 체크/ESLint 건너뛰어 메모리 사용량 감소 (CI 서버 OOM 방지)
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  skipTrailingSlashRedirect: true,
  async redirects() {
    return [
      // 소싱 관련 리다이렉트
      { source: '/dashboard/:path*', destination: '/sourcing/dashboard/:path*', permanent: true },
      { source: '/channel', destination: '/sourcing/channel', permanent: true },
      { source: '/channel/:path*', destination: '/sourcing/channel/:path*', permanent: true },
      { source: '/post/:path*', destination: '/sourcing/post/:path*', permanent: true },
      { source: '/collected-product/:path*', destination: '/sourcing/collected-product/:path*', permanent: true },
      { source: '/product/:path*', destination: '/sourcing/product/:path*', permanent: true },
      { source: '/published-product/:path*', destination: '/sourcing/published-product/:path*', permanent: true },
      { source: '/publish', destination: '/sourcing/publish', permanent: true },
      { source: '/automation/:path*', destination: '/sourcing/automation/:path*', permanent: true },
      { source: '/policy/:path*', destination: '/sourcing/policy/:path*', permanent: true },
      { source: '/admin/settings/:path*', destination: '/sourcing/settings/:path*', permanent: true },
      // 쇼핑몰 관련 리다이렉트
      { source: '/order/:path*', destination: '/shop/order/:path*', permanent: true },
      { source: '/wholesale-orders', destination: '/shop/wholesale-orders', permanent: true },
      { source: '/settlement/:path*', destination: '/shop/settlement/:path*', permanent: true },
      { source: '/user/:path*', destination: '/shop/user/:path*', permanent: true },
      { source: '/cs/:path*', destination: '/shop/cs/:path*', permanent: true },
      // 기본 리다이렉트
      { source: '/', destination: '/sourcing/automation/settings', permanent: false },
    ]
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@modules': path.resolve(__dirname, '../modules'),
      '@': path.resolve(__dirname, './src'),
    }

    // 서버 전용 패키지 external 설정
    if (isServer) {
      config.externals.push({
        'playwright-core': 'commonjs playwright-core',
        'playwright': 'commonjs playwright',
        'chromium-bidi': 'commonjs chromium-bidi',
        'electron': 'commonjs electron',
      })
    }

    return config
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    instrumentationHook: true,
    serverComponentsExternalPackages: [
      'playwright-core',
      'playwright',
      'node-cron',
      '@bandauto/db',
      'prisma',
    ],
  },
}

module.exports = nextConfig
