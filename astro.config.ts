import { defineConfig, envField, fontProviders } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import cloudflare from "@astrojs/cloudflare";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { transformerFileName } from "./src/utils/transformers/fileName";
import { SITE } from "./src/config";

// https://astro.build/config
export default defineConfig({
  site: SITE.website,
  base: "/blog",
  trailingSlash: "always",
  redirects: {
    "/posts/smolvm/dont-use-claude-use-desktop/": {
      status: 301,
      destination: "/blog/posts/celesto/dont-use-claude-use-desktop/",
    },
    "/posts/smolvm/firecracker-macos/": {
      status: 301,
      destination: "/blog/posts/celesto/firecracker-macos/",
    },
    "/posts/smolvm/firecracker-qemu-libkrun-performance-benchmarks-sizing-profiles/":
      {
        status: 301,
        destination:
          "/blog/posts/celesto/firecracker-qemu-libkrun-performance-benchmarks-sizing-profiles/",
      },
    "/posts/smolvm/how-qcow2-overlays-work-in-qemu/": {
      status: 301,
      destination: "/blog/posts/celesto/how-qcow2-overlays-work-in-qemu/",
    },
    "/posts/smolvm/safely-run-ai-generated-code/": {
      status: 301,
      destination: "/blog/posts/celesto/safely-run-ai-generated-code/",
    },
    "/posts/smolvm/windows-sandboxes/": {
      status: 301,
      destination: "/blog/posts/celesto/windows-sandboxes/",
    },
    "/posts/2026/nvidia-openshell-vs-celesto-smolvm/": {
      status: 301,
      destination: "/blog/posts/2026/nvidia-openshell-vs-celesto/",
    },
  },
  output: "server",
  adapter: cloudflare({
    prerenderEnvironment: "node",
  }),
  integrations: [
    sitemap({
      filter: page => SITE.showArchives || !page.endsWith("/archives"),
    }),
  ],
  markdown: {
    processor: unified({
      remarkPlugins: [
        remarkToc,
        [remarkCollapse, { test: "Table of contents" }],
      ],
    }),
    shikiConfig: {
      // For more themes, visit https://shiki.style/themes
      themes: { light: "min-light", dark: "night-owl" },
      defaultColor: false,
      wrap: false,
      transformers: [
        transformerFileName({ style: "v2", hideDot: false }),
        transformerNotationHighlight(),
        transformerNotationWordHighlight(),
        transformerNotationDiff({ matchAlgorithm: "v3" }),
      ],
    },
  },
  vite: {
    // eslint-disable-next-line
    // @ts-ignore
    // This will be fixed in Astro 6 with Vite 7 support
    // See: https://github.com/withastro/astro/issues/14030
    plugins: [tailwindcss()],
    ssr: {
      external: ["@resvg/resvg-js"],
    },
    optimizeDeps: {
      exclude: ["@resvg/resvg-js"],
    },
  },
  image: {
    responsiveStyles: true,
    layout: "constrained",
  },
  fonts: [
    {
      name: "Google Sans Code",
      cssVariable: "--font-google-sans-code",
      provider: fontProviders.google(),
      fallbacks: ["monospace"],
      weights: [300, 400, 500, 600, 700],
      styles: ["normal", "italic"],
    },
  ],
  env: {
    schema: {
      PUBLIC_GOOGLE_SITE_VERIFICATION: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
    },
  },
});
