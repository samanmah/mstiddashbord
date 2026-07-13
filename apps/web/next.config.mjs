import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const apiUpstream = process.env.API_UPSTREAM_URL ?? 'http://localhost:4000';

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  // ریشه مونوریپو برای ردیابی صحیح فایل‌ها در خروجی standalone.
  outputFileTracingRoot: join(__dirname, '../../'),
  transpilePackages: ['@ppm/contracts'],
  experimental: {
    optimizePackageImports: ['recharts', 'lucide-react'],
  },
  async rewrites() {
    // در محیط توسعه، درخواست‌های /api به Backend پراکسی می‌شوند تا کوکی‌ها first-party بمانند.
    // در Production این مسیردهی توسط Nginx انجام می‌شود.
    if (process.env.DISABLE_API_REWRITE === 'true') {
      return [];
    }
    return [
      {
        source: '/api/:path*',
        destination: `${apiUpstream}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
