import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@fuelcap/authz", "@fuelcap/demo-data"],
};

export default nextConfig;
