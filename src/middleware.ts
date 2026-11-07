import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  // Clone headers because redirects can return an immutable Response.
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "DENY");
  // A separate policy preserves Astro's script/style hashes and other CSP rules.
  headers.append("Content-Security-Policy", "frame-ancestors 'none'");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});
