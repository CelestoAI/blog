import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  cp,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, relative, resolve, sep } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { preview } from "astro";
import sharp from "sharp";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const excluded = new Set([
  ".git",
  ".astro",
  ".wrangler",
  ".gstack",
  ".agents",
  ".claude",
  ".codex",
  ".aws",
  "node_modules",
  "dist",
]);

async function htmlFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await htmlFiles(path)));
    else if (entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}

async function serveFiles(directory) {
  const server = createServer(async (request, response) => {
    const path = resolve(
      directory,
      `.${decodeURIComponent(new URL(request.url, "http://localhost").pathname)}`
    );
    if (relative(directory, path).startsWith("..")) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(path);
      response.setHeader(
        "Content-Type",
        extname(path) === ".wasm"
          ? "application/wasm"
          : "application/octet-stream"
      );
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  return server;
}

test(
  "production publication, image, and response-header contracts",
  { timeout: 180_000 },
  async () => {
    const workspace = await mkdtemp(join(tmpdir(), "blog-publication-"));
    const id = `publication-${randomUUID()}`;
    const past = `${id}-past`;
    const future = `${id}-future`;
    const draft = `${id}-draft`;
    let server;
    let search;
    let app;

    try {
      // A disposable copy keeps fixtures and generated output out of the checkout.
      await cp(projectRoot, workspace, {
        recursive: true,
        filter: source => {
          const path = relative(projectRoot, source);
          const first = path.split(sep)[0];
          return (
            !excluded.has(first) &&
            !first.startsWith(".env") &&
            !first.startsWith(".dev.vars") &&
            path !== join("public", "pagefind")
          );
        },
      });
      // Keep Astro's virtual modules and all build caches inside the fixture.
      const dependencies = await realpath(join(projectRoot, "node_modules"));
      await cp(dependencies, join(workspace, "node_modules"), {
        recursive: true,
        mode: constants.COPYFILE_FICLONE,
        verbatimSymlinks: true,
        filter: source => {
          const first = relative(dependencies, source).split(sep)[0];
          return !first.startsWith(".") || first === ".bin";
        },
      });

      for (const [slug, date, isDraft] of [
        [past, "2000-01-01T00:00:00Z", false],
        [future, new Date(Date.now() + 86_400_000).toISOString(), false],
        [draft, "2000-01-01T00:00:00Z", true],
      ]) {
        await writeFile(
          join(workspace, "src/data/blog", `${slug}.md`),
          `---
author: Celesto AI
pubDatetime: ${date}
title: ${slug}
description: ${slug} release check.
draft: ${isDraft}
tags:
  - publication-check
---

${slug} body marker.

${slug === past ? "![Publication logo](../../assets/celesto-logo.png)" : ""}
`,
          { flag: "wx" }
        );
      }

      execFileSync("npm", ["run", "build"], {
        cwd: workspace,
        stdio: "inherit",
        timeout: 120_000,
      });

      const client = join(workspace, "dist/client");
      const blog = join(client, "blog");
      const article = await readFile(
        join(blog, "posts", past, "index.html"),
        "utf8"
      );
      assert.ok(
        article.includes(`${past} body marker.`),
        "past article must exist"
      );
      const png = await readFile(join(blog, "posts", past, "index.png"));
      assert.deepEqual(
        [...png.subarray(0, 8)],
        [137, 80, 78, 71, 13, 10, 26, 10]
      );

      for (const slug of [future, draft]) {
        await assert.rejects(access(join(blog, "posts", slug, "index.html")), {
          code: "ENOENT",
        });
        await assert.rejects(access(join(blog, "posts", slug, "index.png")), {
          code: "ENOENT",
        });
      }

      const image = article.match(
        /<img\b[^>]*\balt="Publication logo"[^>]*>/
      )?.[0];
      assert.ok(image, "past article must contain its local image");
      const src = image.match(/\bsrc="([^"]+)"/)?.[1];
      assert.ok(src, "local image must have a source URL");
      const imageURL = new URL(src, "https://fixture.invalid");
      assert.equal(imageURL.origin, "https://fixture.invalid");
      assert.ok(
        imageURL.pathname.endsWith(".webp"),
        "local image must be precompiled"
      );
      const metadata = await sharp(
        await readFile(join(client, imageURL.pathname))
      ).metadata();
      assert.equal(
        metadata.format,
        "webp",
        "WebP output must contain WebP bytes"
      );

      const archive = await readFile(join(blog, "archives/index.html"), "utf8");
      assert.ok(archive.includes(past), "archive must retain the past post");
      const sitemap = await readFile(join(blog, "sitemap-0.xml"), "utf8");
      assert.ok(
        sitemap.includes(`/posts/${past}/`),
        "sitemap must retain the past post"
      );
      for (const file of await htmlFiles(blog)) {
        const html = await readFile(file, "utf8");
        for (const slug of [future, draft]) {
          assert.ok(
            !html.includes(slug),
            `${relative(blog, file)} must exclude ${slug}`
          );
        }
      }
      for (const slug of [future, draft]) {
        assert.ok(!sitemap.includes(slug), `sitemap must exclude ${slug}`);
      }

      // Query the generated search index through Pagefind's public API.
      server = await serveFiles(client);
      const origin = `http://127.0.0.1:${server.address().port}`;
      const { createInstance } = await import(
        pathToFileURL(join(blog, "pagefind/pagefind.js"))
      );
      search = createInstance({
        basePath: `${origin}/blog/pagefind/`,
        language: "en",
      });
      const publishedResults = await search.search(past);
      const publishedData = await Promise.all(
        publishedResults.results.map(result => result.data())
      );
      assert.ok(
        publishedData.some(result => result.url.includes(`/posts/${past}/`)),
        "search must retain the past article"
      );
      for (const slug of [future, draft]) {
        const matches = await search.search(slug);
        for (const result of matches.results) {
          assert.ok(
            !JSON.stringify(await result.data()).includes(slug),
            `search must exclude ${slug}`
          );
        }
      }

      app = await preview({
        root: workspace,
        server: { host: "127.0.0.1", port: 0 },
        logLevel: "error",
      });
      const previewOrigin = `http://127.0.0.1:${app.server.address().port}`;
      for (const [path, status] of [
        [`/blog/posts/${past}/`, 200],
        ["/blog/about/", 200],
        ["/blog/rss.xml", 200],
        ["/blog/sitemap.xml", 301],
        [`/blog/posts/${future}/`, 404],
        [`/blog/posts/${draft}/`, 404],
      ]) {
        const response = await fetch(`${previewOrigin}${path}`, {
          redirect: "manual",
        });
        assert.equal(response.status, status, path);
        assert.equal(
          response.headers.get("x-content-type-options"),
          "nosniff",
          path
        );
        assert.equal(
          response.headers.get("referrer-policy"),
          "strict-origin-when-cross-origin",
          path
        );
        assert.equal(response.headers.get("x-frame-options"), "DENY", path);
        const policy = response.headers.get("content-security-policy");
        assert.match(policy ?? "", /frame-ancestors\s+'none'/, path);
        const body = await response.text();

        if (path === "/blog/about/") {
          assert.match(policy, /\bscript-src\b/, "SSR must retain Astro's CSP");
          assert.match(policy, /'sha256-[^']+'/, "SSR must retain CSP hashes");
        }
        if (path === "/blog/rss.xml") {
          assert.ok(body.includes(past), "RSS must retain the past post");
          for (const slug of [future, draft]) {
            assert.ok(!body.includes(slug), `RSS must exclude ${slug}`);
          }
        }
        if (path === "/blog/sitemap.xml") {
          const location = response.headers.get("location");
          assert.ok(location, "redirect must retain Location");
          assert.equal(
            new URL(location, previewOrigin).pathname,
            "/blog/sitemap-0.xml"
          );
        }
      }
    } finally {
      await app?.stop();
      await search?.destroy();
      if (server) {
        await new Promise((resolveClose, reject) => {
          server.close(error => (error ? reject(error) : resolveClose()));
          server.closeAllConnections();
        });
      }
      await rm(workspace, { recursive: true, force: true });
    }
  }
);
