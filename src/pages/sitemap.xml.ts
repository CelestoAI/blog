import type { APIRoute } from "astro";
import { SITE } from "@/config";

export const GET: APIRoute = ({ request }) =>
  Response.redirect(
    new URL(`${SITE.basePath}/sitemap-0.xml`, request.url),
    301
  );
