/** @type {import('next').NextConfig} */
import withMDX from '@next/mdx'
const isProd = process.env.NODE_ENV === 'production'
const nextConfig = {
  output: 'standalone',
  assetPrefix: isProd ? 'http://cdn.chaoyang1024.top' : '',
  pageExtensions: ['js', 'jsx', 'mdx', 'ts', 'tsx']
};

export default withMDX(nextConfig)();
