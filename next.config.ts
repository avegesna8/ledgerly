import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // HEIC conversion uses a CommonJS/WASM loader that Webpack cannot safely
  // analyze. Keep it as a Node runtime dependency for the Drive API route.
  serverExternalPackages: ["heic-convert", "heic-decode", "libheif-js"],
};

export default nextConfig;
