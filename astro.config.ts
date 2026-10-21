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
import contentReload from "./src/utils/contentReload";

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
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data: https:",
        "font-src 'self'",
        "connect-src 'self' https://*.posthog.com",
        // PostHog session recording compresses in a blob: worker.
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
      ],
      scriptDirective: {
        // Pagefind search runs on WebAssembly.
        resources: [
          "'self'",
          "'wasm-unsafe-eval'",
          "https://us-assets.i.posthog.com",
        ],
      },
      styleDirective: {
        resources: [
          "'self'",
          { resource: "'unsafe-inline'", kind: "attribute" },
        ],
      },
    },
  },
  output: "server",
  adapter: cloudflare({
    prerenderEnvironment: "node",
  }),
  integrations: [
    sitemap({
      entryLimit: 50_000,
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
    plugins: [
      tailwindcss(),
      contentReload(),
      {
        name: "separate-build-and-dev-caches",
        config: (_config, { command }) => ({
          // A build must not replace dependencies used by a live dev server.
          cacheDir: `node_modules/.vite-${command}`,
        }),
      },
    ],
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
  // Geist and Geist Mono come from the `geist` npm package (SIL Open Font License) so dev and
  // build need no font network call; Astro copies the files into the build, so the CSP
  // keeps `font-src 'self'`.
  fonts: [
    {
      name: "Geist",
      cssVariable: "--font-geist",
      provider: fontProviders.local(),
      options: {
        variants: [
          {
            weight: "100 900",
            style: "normal",
            src: [
              "./node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2",
            ],
          },
        ],
      },
      fallbacks: [
        "ui-sans-serif",
        "system-ui",
        "-apple-system",
        "Segoe UI",
        "sans-serif",
      ],
    },
    {
      name: "Geist Mono",
      cssVariable: "--font-geist-mono",
      provider: fontProviders.local(),
      options: {
        variants: [
          {
            weight: "100 900",
            style: "normal",
            src: [
              "./node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
            ],
          },
        ],
      },
      fallbacks: ["ui-monospace", "SF Mono", "Menlo", "monospace"],
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
