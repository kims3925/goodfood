/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
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
      { source: '/', destination: '/sourcing/dashboard/automation', permanent: false },
    ]
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@modules': path.resolve(__dirname, '../modules'),
      '@': path.resolve(__dirname, './src'),
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
  },
}

module.exports = nextConfig
