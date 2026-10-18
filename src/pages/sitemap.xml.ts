import type { APIRoute } from "astro";
import { SITE } from "@/config";

export const GET: APIRoute = ({ request }) =>
  Response.redirect(
    new URL(`${SITE.basePath}/sitemap-index.xml`, request.url),
    301
  );
