/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./src/lib/bible/data/original-language/**/*.json",
    ],
  },
};

export default nextConfig;
