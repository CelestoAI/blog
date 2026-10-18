import type { APIRoute } from "astro";

const getRobotsTxt = (sitemapURL: URL) => `
# Allow all compliant search and AI crawlers.
User-agent: *
Allow: /

Sitemap: ${sitemapURL.href}
`;

export const GET: APIRoute = ({ site }) => {
  const sitemapURL = new URL("sitemap.xml", site);
  return new Response(getRobotsTxt(sitemapURL));
};
