/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,

  // ให้ build ผ่านแม้มี ESLint warnings (รัน lint แยกใน CI ได้)
  eslint: {
    ignoreDuringBuilds: true,
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    // ลดขนาด JS ฝั่ง client โดย tree-shake แบบ aggressive
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      'recharts',
      '@radix-ui/react-icons',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
    ],
  },

  images: {
    unoptimized: true,
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
    remotePatterns: [
      { protocol: 'https', hostname: 'profile.line-scdn.net' },
      { protocol: 'https', hostname: 'sprofile.line-scdn.net' },
      { protocol: 'https', hostname: 'obs.line-scdn.net' },
      { protocol: 'https', hostname: '*.line-scdn.net' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '*.vercel.app' },
      { protocol: 'https', hostname: 'cny.re-ya.com' },
      { protocol: 'https', hostname: 'clinicya.re-ya.net' },
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

  // standalone output ใช้เมื่อ deploy บน server เอง (Docker/PM2)
  // Vercel/Netlify/Cloudflare Pages จัดการ output เอง ไม่ต้องตั้ง standalone
  output: process.env.VERCEL || process.env.NETLIFY || process.env.CF_PAGES
    ? undefined
    : (process.env.NODE_ENV === 'production' ? 'standalone' : undefined),
}

module.exports = nextConfig
