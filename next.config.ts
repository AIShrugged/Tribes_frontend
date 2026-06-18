import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  devIndicators: false,

  turbopack: {
    resolveAlias: {
      '@': './',
    },
  },

  experimental: {
    // File uploads (issue attachments) are sent as File args to Server Actions.
    // Next.js defaults the Server Action request body to 1 MB, which silently
    // rejects any document larger than that before the action runs. The client
    // allows files up to 10 MB (see pending-attachment-uploader.tsx), so the
    // limit must cover that plus multipart overhead.
    serverActions: {
      bodySizeLimit: '12mb',
    },
    staleTimes: {
      dynamic: 0,
      static: 180,
    },
    optimizePackageImports: [
      'lodash',
      'date-fns',
      'rxjs',
      'framer-motion',
      '@tanstack/react-query',
      'react-hook-form',
      'lucide-react',
    ],
  },

  poweredByHeader: false,
  compress: true,

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  /**
   *
   */
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
    ];
  },

  redirects: async () => {
    return [
      {
        source: '/dashboard/profile/menu',
        destination: '/dashboard/profile/preferences',
        permanent: true,
      },
      {
        source: '/dashboard/profile/appearance',
        destination: '/dashboard/profile/preferences',
        permanent: true,
      },
    ];
  },

  productionBrowserSourceMaps: false,
};

export default nextConfig;
