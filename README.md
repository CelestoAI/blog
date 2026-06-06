# Celesto AI Blog 📄

The official blog of [Celesto AI](https://celesto.ai/), sharing insights, research, and updates on the frontiers of artificial intelligence.

## 🌐 Live Site

The blog is served at [celesto.ai/blog/](https://celesto.ai/blog/).

## ✍️ Adding New Posts

To add a new blog post, create a new Markdown file in the `src/data/blog/` directory.

Example frontmatter:

```yaml
---
author: Celesto AI
pubDatetime: 2026-02-05T12:00:00Z
title: "My New AI Post"
slug: my-new-ai-post
featured: true
draft: false
tags:
  - ai
  - updates
description: A short summary of the blog post for SEO and previews.
---
```

## 👨🏻‍💻 Local Development

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Start the dev server:**
   ```bash
   npm run dev
   ```
   The site will be available at `http://localhost:4321/blog/`.

## 🧞 Commands

| Command           | Action                                            |
| :---------------- | :------------------------------------------------ |
| `npm install`     | Installs dependencies                             |
| `npm run dev`     | Starts local dev server at `localhost:4321/blog/` |
| `npm run build`   | Builds the production site to `./dist/`           |
| `npm run preview` | Previews the build locally                        |
| `npm run format`  | Formats code with Prettier                        |
| `npm run lint`    | Lints code with ESLint                            |

## 🤝 Contribution

We are currently not accepting external Pull Requests (PRs) unless you have discussed your proposal with the team first.

## ✨ Feedback & Suggestions

If you have any suggestions/feedback, contact us at [hello@celesto.ai](mailto:hello@celesto.ai).

## 📜 License

Licensed under the MIT License, Copyright © 2026

---

Maintained by Celesto AI (hello@celesto.ai). Originally created by [Sat Naing](https://satnaing.dev).
