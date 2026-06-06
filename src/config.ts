export const SITE = {
  website: "https://celesto.ai/blog/", // replace this with your deployed domain
  basePath: "/blog", // base path for all internal links (used because site is served via Vercel rewrite)
  author: "Celesto AI",
  profile: "https://celesto.ai/",
  desc: "Insights, tutorials, and updates from Celesto AI - the fastest way to deploy long-running AI agents with built-in observability and security.",
  title: "Celesto AI Blog",
  ogImage:
    "https://ik.imagekit.io/gradsflow/celestoai/logo/celesto-preview_YCCacMZkx.png?updatedAt=1758078180636",
  lightAndDarkMode: true,
  postPerIndex: 4,
  postPerPage: 4,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
  showBackButton: true, // show back button in post detail
  editPost: {
    enabled: false,
    text: "Edit page",
    url: "https://github.com/CelestoAI/paper-blog/edit/main/",
  },
  dynamicOgImage: false,
  dir: "ltr", // "rtl" | "auto"
  lang: "en", // html lang code. Set this empty and default will be "en"
  timezone: "UTC", // Default global timezone (IANA format) https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
} as const;
