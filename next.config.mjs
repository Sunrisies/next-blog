/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === 'production'
const nextConfig = {
  output: 'standalone',
  assetPrefix: isProd ? 'http://cdn.chaoyang1024.top' : '',
};

export default nextConfig;
