/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Mirror client `fs` stub for Turbopack dev (`next dev --turbopack`); webpack uses `resolve.fallback` below.
  turbopack: {
    resolveAlias: {
      fs: { browser: "./lib/stubs/empty-fs.js" },
    },
  },
  // إصلاح مشكلة CSS في Next.js 15
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      }
    }
    return config
  },
}

export default nextConfig