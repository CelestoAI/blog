import { slugifyStr } from "./slugify";

export const BLOG_TOPICS = [
  { label: "AI agents", tag: "ai-agents" },
  { label: "Security", tag: "security" },
  { label: "microVMs", tag: "microvm" },
  { label: "CI", tag: "ci" },
];

export function getTopicLabel(tag: string) {
  return (
    BLOG_TOPICS.find(topic => topic.tag === slugifyStr(tag))?.label ??
    tag.replaceAll("-", " ")
  );
}
