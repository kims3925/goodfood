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
    // Cloudinary CDN 사용 시 Next.js 자체 최적화 비활성화
    unoptimized: true,
    remotePatterns: [
      // Cloudinary CDN (이미지 최적화 담당)
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
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
