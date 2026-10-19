import type { NextConfig } from "next";
import { allowedDevOriginsFromEnv } from "./src/lib/dev-origins";

const allowedDevOrigins = allowedDevOriginsFromEnv();

const nextConfig: NextConfig = {
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "yt3.ggpht.com" },
      { protocol: "https", hostname: "yt3.googleusercontent.com" },
      { protocol: "https", hostname: "**.tiktokcdn.com" },
      { protocol: "https", hostname: "**.tiktokcdn-us.com" },
      { protocol: "https", hostname: "**.tiktokcdn-eu.com" },
      { protocol: "https", hostname: "**.ibyteimg.com" },
      { protocol: "https", hostname: "pbs.twimg.com" },
      { protocol: "https", hostname: "**.licdn.com" },
    ],
  },
};

export default nextConfig;
