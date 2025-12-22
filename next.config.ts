import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CRITICAL: This must be here to allow pdfkit to read font files
  serverExternalPackages: ["pdfkit"], 

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    return config;
  },
};

export default nextConfig;