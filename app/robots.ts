import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/unsubscribe", "/resubscribe", "/cancel-registration", "/api"],
    },
    sitemap: "https://rackintherockies.com/sitemap.xml",
  };
}
