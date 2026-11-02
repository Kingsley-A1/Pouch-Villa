import type { MetadataRoute } from "next";
import { absoluteUrl, isIndexable } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  if (!isIndexable) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        /*
          Besides the admin and the API: the shop's filter combinations, search
          results, and the pages that only mean something to one signed-in
          shopper. Every storefront page renders on the server, so a crawler
          walking every `?category=…&device=…` pair was a server render per URL —
          thousands in a night (November 2026), all of them variants of one page.
          The filters' clean, indexable homes are `/browse/…`, which stay open.
        */
        disallow: [
          "/admin",
          "/api/",
          "/shop?",
          "/search",
          "/cart",
          "/checkout",
          "/account",
          "/orders",
          "/track",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
