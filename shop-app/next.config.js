/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@modules': path.resolve(__dirname, '../modules'),
      '@': path.resolve(__dirname, './src'),
    }
    return config
  },
  images: {
    // 프로덕션 배포 시 실제 사용하는 도메인만 추가하세요
    // 예: CDN 도메인, S3 버킷 도메인 등
    remotePatterns: [
      // AWS S3 버킷 (예시)
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
      },
      // Cloudinary (예시)
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      // 로컬 개발용 - 프로덕션에서는 제거 권장
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'http',
        hostname: '*.lvh.me',
      },
      // 임시: 모든 HTTPS 호스트 허용 (배포 전 특정 도메인으로 변경 필요)
      // TODO: 프로덕션 배포 전 실제 이미지 호스팅 도메인으로 교체
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
