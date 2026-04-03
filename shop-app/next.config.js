/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  // Docker 배포 시에만 standalone 모드 (로컬 Windows 환경에서는 심링크 권한 오류 방지)
  output: process.env.STANDALONE === 'true' ? 'standalone' : undefined,

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
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@modules': path.resolve(__dirname, '../modules'),
      '@': path.resolve(__dirname, './src'),
    }
    return config
  },
  images: {
    // 이미지 최적화 비활성화 (서버 부하 감소)
    unoptimized: true,
    remotePatterns: [
      // AWS S3 버킷
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
      },
      // 로컬 개발용
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'http',
        hostname: '*.lvh.me',
      },
      // Band 이미지 (phinf.pstatic.net 등)
      {
        protocol: 'https',
        hostname: '*.pstatic.net',
      },
      // 운영 도메인
      {
        protocol: 'https',
        hostname: 'snsauto.abcpharm.net',
      },
      {
        protocol: 'https',
        hostname: 'shop.abcpharm.net',
      },
      // Band API 이미지
      {
        protocol: 'https',
        hostname: '*.band.us',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

module.exports = nextConfig
