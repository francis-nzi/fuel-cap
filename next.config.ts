import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@fuelcap/demo-control"],
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
