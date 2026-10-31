---
name: blog-writing-guide
description: Write, review, and improve Celesto AI blog posts, technical guides, product announcements, and engineering deep dives. Apply Celesto’s voice, value-first structure, and technical quality standards to content for developers who build and run AI agents.
---

# Celesto AI Blog Writing Skill

Use this guide for the Celesto AI blog. Follow `AGENTS.md` for repository conventions; it takes precedence if this guide conflicts.

Adapted from the [upstream blog guide](https://github.com/getsentry/skills/blob/main/skills/blog-writing-guide/SKILL.md). The editorial principles remain; brand voice, examples, and author conventions reflect Celesto.

**The bar:** Every Celesto AI blog post should be something a senior engineer would share in their team's Slack, or reference in a technical decision.

Write for developers who build and run AI agents. Topics include cloud computers, sandboxes, agent tools, CI, and the wider AI agent ecosystem. Use the product name supported by the source, such as Celesto, Celesto Cloud, or Celesto CI. Do not treat those products as interchangeable.

## Celesto Editorial Rules

- Lead with reader value: the result they can achieve, the cost they can avoid, or the decision they can make.
- Disclose detail progressively: practical outcome, minimum context, concrete steps, then internals and trade-offs.
- Avoid gerunds in authored prose and headings. Preserve exact API names, commands, identifiers, and quotations.
- Cut fluff. Use realistic examples and comments only where they clarify intent.
- Do not use italics. Use emphasis sparingly.

## The Celesto AI Voice

**We sound like:** An engineer who explains a useful result to another developer: direct, specific, practical, and technically precise.

**We don't sound like:** A corporate blog, a press release, a sales deck, or an AI-generated summary.

Support opinions with evidence and trade-offs. A conversational voice is welcome; do not force jokes or sarcasm.

Use "we" for Celesto’s verified work and "you" for the reader. Use "I" for a named author’s own experience. Never invent team history, personal anecdotes, customer stories, or results.

## Banned Language

Never use these. They are automatic red flags:

- "We're excited/thrilled to announce". just announce it
- "Best-in-class" / "industry-leading" / "cutting-edge". show, don't tell
- "Seamless" / "seamlessly". nothing is seamless
- "Empower" / "leverage" / "unlock". say what you actually mean
- "Robust". describe what makes it robust instead
- "At [Company], we believe...". just state the belief
- "Streamline". everyone is streamlining, stop
- Filler transitions: "That being said," "It's worth noting that," "At the end of the day," "Without further ado," "As you might know"
- "In this blog post, we will explore...". be direct, just start

## Value-First Intro (First 2-3 Sentences)

The first two or three sentences must establish the reader’s payoff. State a concrete outcome or a problem with its practical consequence, then explain what the post helps the reader do. Never start with background, company history, or hype.

**Good:** "A React app on your laptop is hard to share: teammates cannot open your localhost URL. This guide shows how to run the app on a Celesto cloud computer and share a public preview."

**Bad:** "At Celesto AI, we always look for ways to improve the developer experience. We’re thrilled to announce our latest cloud features."

## Structure: Follow the Reader's Questions

Start with the least context the reader needs. Add depth as questions arise; introduce each unfamiliar term before its mechanics. Structure posts around the reader’s questions:

1. **What problem does this solve?** (1-2 paragraphs max)
2. **How does it actually work?** Not buttons-you-click, but underlying technology. (Bulk of the post. be specific)
3. **What were the trade-offs or alternatives?** (This separates good from great)
4. **How do I use/try/implement this?** (Concrete next steps)

For engineering deep-dives, also address:

5. **What did we try that didn't work?** (Only when supported by the actual project history)
6. **What are the known limitations?** (Shows intellectual honesty)

## Format for a Quick Scan

People scroll. Shorter paragraphs are almost always better for a quick scan.

**Break paragraphs at contrast points.** When a sentence introduces a "but," "however," or shifts perspective, start a new paragraph. Don't bury the turn inside a block of text.

**Bad:**
> Traditional monitoring tracks requests and latency. That works for stateless HTTP services. AI agents are different. A single run might involve multiple LLM calls, tool executions, and handoffs.

**Good:**
> Traditional monitoring tracks requests and latency. That works for stateless HTTP services.
>
> AI agents are different. A single run might involve multiple LLM calls, tool executions, and handoffs.

The line break before the contrasting point creates visual emphasis. Use the break where it helps the reader follow the argument.

**One idea per paragraph.** If a paragraph covers two distinct points, split it. Three-sentence paragraphs are fine. One-sentence paragraphs are fine for emphasis.

**No em dashes.** Use commas, periods, or line breaks instead. Em dashes are fine in print but create visual clutter in blog formatting.

## SEO for Developer Content

For posts that answer a search query:

**Answer the query first.** For educational guides, explain the general concept before a Celesto implementation. For product announcements, state what changed and who benefits at the start. Do not force either format into a fixed product-to-education ratio.

**Use descriptive H2s.** Include relevant search terms where they help readers identify the section. Avoid keyword repetition.

**Define unfamiliar terms.** Add a brief definition when the audience needs one, such as what an agent sandbox isolates. Do not add a basic section that repeats what the reader already knows.

**Use an FAQ only for unresolved questions.** Do not repeat the article or promise search placement.

## AI Prose Patterns to Avoid

LLM-generated prose has tells. Flag and rewrite these:

**Staccato dramatic fragments.**
- Bad: "No errors. No warnings. Everything green."
- Good: "There were no errors, no warnings, everything looked fine."

**Bumper-sticker aphorisms.**
- Bad: "You can't fix what you can't see."
- Good: "Without visibility into the full request lifecycle, you're guessing."

**Three-beat reveals.**
- Bad: "Not a config issue. Not a code bug. The deploy was stale."
- Good: "It wasn't a config issue or a code bug. The deploy was stale."

**Smug simplicity.**
- Bad: [code block] "That's it. That's all you need."
- Good: [code block] then explain what the code does, or just move on.

**Parallel structure ad copy.**
- Bad: "Metrics tell you what's broken. Traces tell you why."
- Good: "Metrics show what's broken, but traces are where you'll actually figure out why."

**Personality only in the bookends.** AI drafts open with a personal anecdote, go impersonal for 80% of the post, then close with a CTA. The author's voice should persist throughout.
- Bad: Personal intro → clinical middle → "Try Celesto now."
- Good: First-person asides woven through the post: "this is the part that tripped me up" / "I would have blamed the wrong service."

## Section Headings Must Convey Information

**Weak:** "Background," "Architecture," "Results," "Conclusion"

**Strong:** "What a microVM isolates from the host," "How cache keys affect CI job duration," "Why a public preview needs an active app process"

## Technical Quality Standards

**Numbers over adjectives.** Support performance claims with measured results and a reproducible method. State the workload, hardware, versions, sample size, and relevant controls. Do not present one benchmark as a universal result or invent numbers for a draft.
- Bad: "Celesto makes every CI job faster."
- Good: "For the cache-hit job in our published comparison, Celesto CI took 24 seconds on 1 vCPU; GitHub took 31 seconds on 2 vCPUs." See `src/data/blog/celesto-ci-dependency-cache.md` for the source and limitations.

**Code must work.** If a post includes code, test it. Include imports, configuration, and context. Comments should explain **why**, not repeat **what** the code does. Verify current APIs, product capabilities, prices, and security claims against authoritative sources before publication. If a claim lacks evidence, flag the gap instead of guessing.

**Diagrams for systems.** If you describe a system with more than two interacting components, include a diagram. Label with real component names, not generic boxes. Use only components supported by the source.

**Honesty over hype.** Never overstate what a feature does. Acknowledge limitations. If something is in beta, say so. If a competitor does something well, it's okay to note that. Distinguish what the agent requests from what Celesto executes and isolates. Do not claim a sandbox prevents every attack or that an agent always completes a task. State security boundaries, required permissions, persistence limits, and failure modes where relevant.

## Title Guidelines

The title is the highest-leverage sentence in the post. It must stop a developer scrolling through their RSS feed or Twitter.

**Strong titles** make a specific claim, tell a story, or promise a specific payoff:
- "How to Run Pi Coding Agent on a Celesto Cloud Computer"
- "Run Docker and Compose CI from Your Personal GitHub Account"
- "How qcow2 Overlays Work in QEMU"

These titles come from existing repository posts. Use numerical claims in a title only when the post supplies evidence.

**Weak titles** are vague announcements:
- "Our new cloud features"
- "Performance improvements in Celesto"
- "The future of AI agents"

## End with a Useful Next Step

End with something useful: a link to docs, source code, a way to try it, or a call to give feedback. Never end with generic hype ("We can't wait to see what you build!"), recaps of what you just said, or product-page CTAs ("Try Celesto for free. Included on all plans."). Connect back to the story you opened with, or give the reader something concrete to do next. Verify the destination and do not invent free plans, availability, or guarantees.

## Post Types

Here's the quick map by post type:

| Type | Reader payoff | Evidence to include |
|------|---------------|---------------------|
| Engineering Deep Dive | Understand a technical decision and its trade-offs | Actual architecture, alternatives, and limitations |
| Product Launch | Know what changed, who benefits, and how to use it | Verified capabilities, prerequisites, and docs |
| Postmortem | Learn from a concrete failure | Confirmed timeline, impact, cause, and fixes |
| Data / Research | Assess an original result | Dataset provenance, method, controls, and uncertainty |
| Tutorial / Guide | Complete a specific task | Tested steps, expected output, and failure modes |

Preserve an existing byline. For a new post, use `author: Celesto AI` unless the user specifies a named author or a community contribution credits its author. Never invent a person, role, or team structure.

## The "Would I Share This?" Test

Before publication, ask: Would a developer share this post? Would it help someone complete a task or make a technical decision? If not, add the missing evidence or practical detail. Routine release notes belong in the changelog.

Useful posts contain at least one of:
- A technical decision explained with trade-offs
- Original data or research not found elsewhere
- A real-world debugging story with specific details
- An honest account of something that went wrong
- A how-to that saves the reader real time

## Non-Negotiables (Quick Reference)

1. Use the repository’s author convention; preserve named and community authors.
2. Never publish code that doesn't work.
3. Never say "we're excited to announce." Just announce it.
4. If you describe a system, include a diagram.
5. If you make a performance claim, include the number.
6. If you discuss a decision, explain what you didn't choose and why.
7. Every post must have a clear "who is this for" in the author's mind before the first draft.
8. Changelogs belong in the changelog. Blog posts should offer something more.
9. Add enough depth to support the reader’s task. Put advanced detail after the practical explanation; cut repetition.
10. Write the post you wish existed when you were trying to solve this problem.

## Draft Review

Run through both checklists:

**Technical Review:**
- All technical claims accurate
- Code samples work
- Architecture descriptions match reality
- Numbers and benchmarks correct
- No oversimplifications that would make an expert cringe

**Editorial Review:**
- Intro establishes reader value within 2 sentences
- Detail progresses from practical outcome to internals
- No gerunds in authored prose or headings; no italics
- Passes the "would I share this?" test
- No corporate language, filler, or fluff
- Headings convey information
- Right length (not padded, not too thin)
- Title is specific and compelling

**Final Check:**
- Author matches the repository convention or the credited contributor
- Relevant docs, source, or next-step links are verified
- Post doesn't duplicate what's in the changelog

For draft feedback, be specific and constructive. Quote the weak passage, explain why it's weak, and rewrite it to show the standard.

## Repository Content Check

For a new post, follow `AGENTS.md` and `src/content.config.ts`. Put Markdown under `src/data/blog/` and use the frontmatter conventions from adjacent posts. Set author, publication date, title, tags, description, and draft status deliberately; never invent a publication date or change an existing one without a reason. Keep internal blog links under `/blog/` with the repository’s trailing-slash convention.

Keep requested drafts as drafts. A request to write or review a post does not authorize publication or deployment.
