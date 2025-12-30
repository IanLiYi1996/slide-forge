/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
await import("./src/env.js");

/** @type {import("next").NextConfig} */
const config = {
  // Enable standalone output for Docker deployment
  output: "standalone",

  // CloudFront asset prefix (set via environment variable in production)
  assetPrefix: process.env.ASSET_PREFIX || "",

  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  images: {
    // Disable image optimization in production (use CloudFront)
    unoptimized: process.env.NODE_ENV === "production",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.ufs.sh",
      },
      {
        protocol: "https",
        hostname: process.env.CLOUDFRONT_DOMAIN || "*.cloudfront.net",
      },
    ],
  },
};

export default config;
