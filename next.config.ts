
import type {NextConfig} from 'next';

const nextConfig = {
  images: {
    domains: process.env.NEXT_PUBLIC_IMAGE_DOMAINS
      ? process.env.NEXT_PUBLIC_IMAGE_DOMAINS.split(',').map(domain => domain.trim())
      : [],
  },
};

export default nextConfig;
