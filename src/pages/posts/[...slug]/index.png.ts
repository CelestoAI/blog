import { getCollection, type CollectionEntry } from "astro:content";
import type { APIRoute } from "astro";
import { getPath } from "@/utils/getPath";
import { generateOgImageForPost } from "@/utils/generateOgImages";
import postFilter from "@/utils/postFilter";

export const prerender = true;

export async function getStaticPaths() {
  const posts = await getCollection("blog", postFilter);
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
