/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
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
      // 임시: 모든 HTTPS 호스트 허용 (배포 전 특정 도메인으로 변경 필요)
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
  },
}

module.exports = nextConfig
