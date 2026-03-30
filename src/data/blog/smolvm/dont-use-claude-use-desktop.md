---
author: Aniket Maurya
pubDatetime: 2026-03-30
modDatetime: 2026-03-30
title: "Don’t Let Claude Use Your Computer from the CLI"
description: "Give it a disposable computer, not your laptop."
featured: true
draft: false
tags:
  - Computer-use
  - Agent Security
  - Security
---


Anthropic recently added a feature to Claude Code called **computer use**. In plain English, this means Claude can do things like open apps, click buttons, type, scroll, and look at what is on your screen from the command line. Anthropic positions it for tasks like testing native apps, debugging visual issues, and using tools that do not have an API or command-line interface.

That is powerful and also where many developers are about to make a bad security decision.

The mistake is not using AI to operate a computer. The mistake is letting it operate **your** computer.

## First, what is the actual risk?

When people first see a demo like this, they usually think about the model making a wrong click or typing the wrong thing. That is part of the problem, but not the whole problem.

The bigger issue is **where** those actions happen.

To use Claude’s computer-use feature on macOS, you have to grant permissions like **Accessibility** and **Screen Recording**. Anthropic also says this feature runs on your actual desktop, unlike its sandboxed Bash tool. In other words, the AI is not working in a fake environment. It is working inside the same machine where you keep your code, browser sessions, local files, secrets, and whatever else happens to be open.

That changes the stakes.

If the model misreads something, follows a bad instruction, clicks the wrong window, edits the wrong file, or interacts with something sensitive, the blast radius is no longer a test environment. It is your real machine.

## But doesn’t Claude already have guardrails?

Yes, and Anthropic has put real thought into them.

Claude asks for app approvals during a session. It warns when an app would effectively give shell access, file access, or system settings access. It hides other apps while it works. You can stop it with `Esc`. Only one Claude session can control the machine at a time. Those are sensible protections. 

But guardrails are not the same as the right architecture.

They reduce risk. They do not remove the core problem: the model is still acting inside your personal computer.

That is the wrong trust boundary.

## What is a “trust boundary”?

This sounds like security jargon, so let’s make it simple.

A **trust boundary** is just the line between:

* the part of the system you are willing to risk
* and the part you really do not want touched

If you let an AI model click around on your laptop, your laptop is inside the trust boundary. You are trusting the agent not to do damage there.

That is a bad default.

A better setup is to move the risky work somewhere else.

## The better model: give the AI a disposable computer

Instead of saying:

**“Let the model use my computer.”**

Say:

**“Let the model use a separate computer made for the task.”**

That separate computer should be:

* isolated from your real machine
* easy to reset
* safe to throw away when the task finishes

That is what a **sandbox** is.

Here, “sandbox” just means a contained environment where the agent can do its work without touching your actual laptop.

For AI agents, that is the right default.

If the task goes wrong, you delete the sandbox and start fresh.

If the task goes right, great — your real machine was never at risk.

## So what does SmolVM do?

SmolVM is a Python SDK and CLI for running code and browser tasks inside **disposable sandboxes**. The goal is simple: give apps and AI agents an isolated workspace so risky work stays away from your machine.

That is the key idea.

You are not asking the model to work on your host computer.

You are giving it another environment to work inside.

## What does “VM” mean?

Before going further, one more term.

A **VM**, or **virtual machine**, is basically a software-created computer. It acts like a separate machine with its own environment, even though it runs on top of a real machine.

You can think of it like this:

* your laptop is the real house
* a VM is a separate locked room built inside that house

The agent works in that room, not in your whole house.

SmolVM goes one step further and uses **microVMs**, which are just very small, lightweight virtual machines designed to start fast and stay isolated. Its docs say that on Linux it uses **Firecracker microVMs**, and on macOS it uses **QEMU**. You do not need to know those names to use the product. The important part is what they do: they create a separate environment so the agent is not running directly on your machine.

## Why is that better than running on the host?

Because the host is your actual machine.

SmolVM’s AI agent integration guide explains the design clearly: instead of executing model-generated commands directly on your machine, it starts an isolated microVM, runs the code there, and tears it down when finished.

That one design choice fixes a lot.

Now when the model needs to:

* run shell commands
* install packages
* open a browser
* click around a UI
* write files
* test workflows

…it does those things in a throwaway environment, not on your laptop.

That is how AI execution should work.

## What does “ephemeral” mean?

Another term worth translating.

**Ephemeral** just means **temporary**.

An ephemeral sandbox is a fresh environment created for one task and destroyed right after. SmolVM’s docs describe this directly: spin up a fresh VM for every task, then destroy it so no state carries over between tasks.

That is useful when the task is risky or untrusted.

For example:

* testing generated shell commands
* browsing unknown websites
* opening files you do not fully trust
* letting an agent explore and try things

If anything weird happens, you delete the environment and move on.

## But what if the agent needs memory between steps?

This is where a lot of people get confused.

They assume the choice is:

* either use the real machine so the state persists
* or use a sandbox and lose all progress after every step

That is false.

SmolVM’s docs also describe a **reusable sandbox across turns**. In plain English, that means the agent can keep the same temporary machine alive across multiple steps. So it can write a file now, come back later, read it again, edit it, and continue from where it left off.

That is a much better model for agents.

You get persistence when you need it.

You still avoid using the host machine.

## What about browser use and computer use?

This matters for browser agents too.

SmolVM includes a browser session that launches Chromium inside a microVM. The docs say this is useful for scraping, testing, and computer-use agents that need to interact with real web pages in an isolated environment. It can also expose a live view so you can watch what is happening.

That is the important shift:

you can give the model **a browser** without giving it **your browser**.

You can give it **a desktop-like environment** without giving it **your desktop**.

That is the security posture people should normalize.

## The real lesson

Anthropic’s feature is impressive. For many workflows, it will feel like magic. And to be fair, Anthropic is open in its docs about the fact that this runs on your actual desktop and that the trust boundary is different from a sandboxed tool.

But that is exactly why developers should think harder here, not less.

The lesson should not be:

**“Wow, now the model can use my computer.”**

The lesson should be:

**“AI agents need computers of their own.”**

Disposable ones. Isolated ones. Resettable ones.

That is the safer pattern.
That is the more production-ready pattern.
And honestly, that is the pattern we should teach beginners from day one.
