/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'unload=*',
          },
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          },
        ],
      },
      {
        // Aggressive cache-busting for JavaScript bundles to prevent stale code
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
  // Note: serverActions config for Next.js 16
  // Increased body size limit to accommodate product updates with multiple images
  // Images are uploaded to Supabase Storage first, but product data with image URLs
  // can still exceed 2MB when updating products with many variants and images
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Increased from 2mb to handle product updates with multiple images
    },
  },
}

export default nextConfig
