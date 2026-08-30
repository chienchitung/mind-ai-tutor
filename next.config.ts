import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Realtime's Node transport uses a dynamic require. Keep it native on the
  // server rather than asking webpack to infer the transport module.
  serverExternalPackages: ['@supabase/supabase-js'],
  images: {
    domains: ['avatars.githubusercontent.com'],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
