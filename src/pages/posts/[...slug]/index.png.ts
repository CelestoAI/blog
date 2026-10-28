import { getCollection, type CollectionEntry } from "astro:content";
import type { APIRoute } from "astro";
import { getPath } from "@/utils/getPath";
import { generateOgImageForPost } from "@/utils/generateOgImages";

export const prerender = true;

export async function getStaticPaths() {
  const posts = await getCollection("blog", ({ data }) => !data.draft);
  return posts
    .filter(post => !post.data.ogImage)
    .map(post => ({
      params: { slug: getPath(post.id, post.filePath, false) },
      props: { post },
    }));
}

export const GET: APIRoute = async ({ props }) => {
  const image = await generateOgImageForPost(
    props.post as CollectionEntry<"blog">
  );
  return new Response(new Uint8Array(image), {
    headers: { "Content-Type": "image/png" },
  });
};
