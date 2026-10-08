You are an expert in writing tech blog and documentation. Prefer to start with the value framework. 

This repository contains the source code for the official [Celesto AI Blog](https://celesto.ai/blog/), built with [Astro](https://astro.build/). It is optimized for performance, accessibility, and SEO, and is deployed to Cloudflare Workers.


## Writing guidelines
- don't use gerunds
- Progressive disclosure with increasing complexity
- Don't add any fluff
- Only realistic examples and comments for clarity
- Value-first intro


## Project Overview

*   **Purpose:** To share insights, research, and updates about Celesto AI and the AI agent ecosystem.
*   **Framework:** Astro (v5+) using the [AstroPaper](https://github.com/satnaing/astro-paper) theme as a base.
*   **Styling:** Tailwind CSS (v4).
*   **Search:** [Pagefind](https://pagefind.app/) for static, client-side search.
*   **Deployment:** Cloudflare Workers (SSR mode) via the `@astrojs/cloudflare` adapter.
*   **Architecture:**
    *   **Content:** Markdown files located in `src/data/blog/`.
    *   **Subpath:** The site is configured to run under the `/blog` subpath (via `base: "/blog"` in `astro.config.ts`).
    *   **Proxying:** Intended to be served via a reverse proxy (e.g., Vercel rewrites) from the main domain `celesto.ai`.

## Development Workflow

### Prerequisites
*   Node.js (v18+ recommended)
*   npm (used for dependency management)

### Key Commands

| Command | Description |
| :--- | :--- |
| `npm install` | Install project dependencies. |
| `npm run dev` | Start the local development server at `http://localhost:4321/blog/`. |
| `npm run build` | Build the project for production (outputs to `./dist/`), generate search index, and prepare assets. |
| `npm run preview` | Preview the production build locally. |
| `npm run deploy` | Build the project and deploy to Cloudflare Workers using Wrangler. |
| `npm run lint` | Run ESLint to check for code quality issues. |
| `npm run format` | Format code using Prettier. |

### Adding Content
1.  Create a new Markdown file in `src/data/blog/`.
2.  Ensure the file includes the required frontmatter:
    ```yaml
    ---
    author: Celesto AI
    pubDatetime: 2026-02-05T12:00:00Z
    title: "Your Post Title"
    slug: your-post-slug
    featured: true
    draft: false
    tags:
      - ai
      - tag2
    description: A brief description for SEO.
    ---
    ```

## Configuration & Architecture

### Astro Configuration (`astro.config.ts`)
*   **Adapter:** `@astrojs/cloudflare` is used for SSR on Cloudflare Workers.
*   **Base Path:** `base: "/blog"` ensures all assets and links are prefixed correctly.
*   **Trailing Slash:** `trailingSlash: "always"` is set to ensuring consistent routing.
*   **Integrations:** Includes Sitemap, Tailwind CSS, and various remark plugins for Markdown processing.

### Cloudflare Workers (`wrangler.toml`)
*   **Compatibility:** Uses `nodejs_compat` flag for broader Node.js support.
*   **Assets:** Static assets are served from `./dist`.
*   **Entry Point:** The main worker entry point is `./dist/_worker.js/index.js`.

### Search
Pagefind is used for search. Since the site uses SSR, pages must be explicitly prerendered (`export const prerender = true` in page files) so Pagefind can index the static HTML during the build process.

## Conventions

*   **Code Style:** TypeScript is used throughout. Prettier and ESLint are configured to enforce style.
*   **Component Structure:**
    *   `src/components`: Reusable UI components (Header, Footer, Card, etc.).
    *   `src/layouts`: Page layouts (Layout, Main, PostDetails).
    *   `src/pages`: File-based routing for the site.
*   **Git:** External Pull Requests are generally not accepted without prior discussion.
