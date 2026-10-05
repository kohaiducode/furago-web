import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  allowedDevOrigins: ["*.serveousercontent.com", "*.lhr.life"],
};

export default nextConfig;
