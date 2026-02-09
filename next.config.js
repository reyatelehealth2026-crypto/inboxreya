/** @type {import('next').NextConfig} */
const nextConfig = {
  // ไม่ต้องใช้ basePath ถ้ารัน standalone
  // basePath จะถูกจัดการโดย Nginx reverse proxy

  // ให้ build ผ่านแม้มี ESLint warnings (รัน lint แยกใน CI ได้); ป้องกัน Vercel build fail
  eslint: {
    ignoreDuringBuilds: true,
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'profile.line-scdn.net',
      },
      {
        protocol: 'https',
        hostname: 'sprofile.line-scdn.net',
      },
      {
        protocol: 'https',
        hostname: 'obs.line-scdn.net',
      },
      {
        protocol: 'https',
        hostname: '*.line-scdn.net',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: '*.vercel.app',
      },
      {
        protocol: 'https',
        hostname: 'cny.re-ya.com',
      },
      {
        protocol: 'https',
        hostname: 'clinicya.re-ya.net',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: '/api/uploads/:path*',
      },
    ]
  },
  // Output standalone สำหรับ production (เฉพาะเมื่อ deploy บน server)
  // Vercel ไม่ต้องการ output: 'standalone' เพราะใช้ serverless functions
  output: process.env.VERCEL ? undefined : (process.env.NODE_ENV === 'production' ? 'standalone' : undefined),
}

module.exports = nextConfig
