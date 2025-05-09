
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      // Removed Firebase Storage remote pattern
      // If your custom backend is on a different domain, add its pattern here.
      // For images served from the local 'public' directory, no specific pattern is needed for basic functionality.
    ],
  },
};

export default nextConfig;
