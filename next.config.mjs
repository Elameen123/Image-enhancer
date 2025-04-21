// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Add your configuration here
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://image-processor-api-vvzn.onrender.com/api/:path*',
      },
    ];
  },
};

export default nextConfig;