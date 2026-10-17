import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { test } from "node:test";

const origin = "http://localhost:4321";

async function waitForResponse(path, predicate) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${origin}${path}`);
    const html = await response.text();
    if (predicate(response.status, html)) return;
    await setTimeout(250);
  }
  assert.fail(`Local content did not update at ${path} within 10 seconds`);
}

test("local posts reflect additions, edits, and deletions without a restart", async () => {
  const id = `reload-check-${randomUUID()}`;
  const file = new URL(`../src/data/blog/${id}.md`, import.meta.url);
  const route = `/blog/posts/${id}/`;
  const entry = (title, body) => `---
author: Celesto AI
pubDatetime: 2099-01-01T00:00:00Z
title: ${title}
description: Temporary local reload regression check.
draft: false
---

${body}
`;
  // Populate the route cache before the file changes.
  assert.equal((await fetch(`${origin}/blog/posts/`)).status, 200);
  try {
    await writeFile(file, entry(id, "Initial reload check body."), {
      flag: "wx",
    });
    await waitForResponse(
      route,
      (status, html) =>
        status === 200 && html.includes("Initial reload check body.")
    );

    await writeFile(file, entry(`${id} revised`, "Revised reload check body."));
    await waitForResponse(
      route,
      (status, html) =>
        status === 200 &&
        html.includes("Revised reload check body.") &&
        html.includes(`${id} revised`) &&
        !html.includes("Initial reload check body.")
    );
    await waitForResponse(
      "/blog/posts/",
      (status, html) => status === 200 && html.includes(`${id} revised`)
    );

    await unlink(file);
    await waitForResponse(route, status => status === 404);
    await waitForResponse(
      "/blog/posts/",
      (status, html) => status === 200 && !html.includes(id)
    );
  } finally {
    await unlink(file).catch(error => {
      if (error.code !== "ENOENT") throw error;
    });
  }
});
