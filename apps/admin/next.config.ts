import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@fuelcap/authz", "@fuelcap/demo-data", "@fuelcap/pricing-control"],
};

export default nextConfig;
