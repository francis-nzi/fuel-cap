import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: ["@fuelcap/authz", "@fuelcap/demo-data", "@fuelcap/demo-control", "@fuelcap/pricing-control"],
};

export default nextConfig;
