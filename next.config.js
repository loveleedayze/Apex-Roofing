/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep the payload lean; we rely on SVG + system fonts for sub-3s loads.
  poweredByHeader: false,
  compress: true,
};

module.exports = nextConfig;
