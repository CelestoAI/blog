import type { APIRoute } from "astro";
import { generateOgImageForSite } from "@/utils/generateOgImages";

export const prerender = true;

export const GET: APIRoute = async () => {
  const image = await generateOgImageForSite();
  return new Response(new Uint8Array(image), {
    headers: { "Content-Type": "image/png" },
  });
};
