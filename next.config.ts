import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */  images: {
    remotePatterns: [
      // รูปจาก API ในเครื่อง (เดิมของคุณ)
      {
        protocol: "http",
        hostname: "localhost",
        port: "5000",
        pathname: "/uploads/**", // หรือ "/**" ถ้าอยากอนุญาตทุก path
      },

      // รูปโปรไฟล์จาก Google (แนะนำใส่หลาย subdomain เผื่อสลับ)
      { protocol: "https", hostname: "lh1.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "lh2.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "lh4.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "lh5.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "lh6.googleusercontent.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
