/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  // O lint roda no editor; não deixa o deploy falhar por causa dele
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
