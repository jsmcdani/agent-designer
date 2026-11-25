# Getting Started — Agent Designer

This is a guided tool for building a **governed Agentforce agent from plain words** — grounded on your
real org, and gated before anything deploys. You describe what you want; it confirms the real fields on
your org (so nothing is invented), shapes small focused topics, writes the agent-script for you, and
stops at a checkpoint for your approval. A side panel shows each step; the terminal explains what it did.

You can watch the built-in walkthrough once and then do it yourself.

---

## 1. Install (about a minute)

You'll need **Claude Code**. In it, run:

```
/plugin marketplace add jsmcdani/agent-designer
/plugin install agent-designer
```

If Claude Code asks to enable the plugin or reload, say yes.

## 2. Point it at the gateway

The tool talks to a **gateway** (the governed build runs there, not on your laptop). Set its URL — your
contact will give you the exact value:

```
export AGENT_DESIGNER_URL="<gateway URL you were given>"
```

When the walkthrough logs in, use your **own org admin login**. Tip: so your password never lands in a
log, you can run the login yourself by typing `! ` followed by the login command — only the result is kept.

## 3. Open the live panel

```
/designer
```

You'll see the intro: what the tool is, the **six steps**, and that **help is built in**.

## 4. Learn it — run the guided walkthrough

```
/designer-demo
```

It drives the build **one step at a time** and explains each one. After a step it pauses — just say
**keep going** to advance. You'll move through:

| Step | What happens |
|------|--------------|
| **describe** | you say what the agent should do, in plain words — no field or API knowledge |
| **ground** | it runs a live check on your org and confirms the **real** fields (nothing invented) |
| **propose** | small, single-purpose topics (one job each, not a do-everything bot) |
| **map** | binds only real fields — a made-up one gets **dropped** (that's the guard) |
| **draft** | the server writes the agent-script for you |
| **gate** | it validates everything; **nothing deploys until you approve** |

Everything up to the gate is **read-only** — no records are read or changed, nothing happens to your org.

## 5. Try it yourself

Run `/designer-demo` again (or just start describing) with **your own** idea — for example,
*"an agent that tells a technician how an asset is doing and when it was last serviced."* Follow the same
steps. The panel fills in as you go, and the help text explains each step if you're unsure.

---

## If something looks off
- **No panel showing?** Type `/designer` — it opens at any window width.
- **Unsure what a step means?** The panel shows help for the current step under **"now: …"**, and you
  can always ask.

## What's safe to know
Describe → gate **never changes your org**. A real deploy happens only when you explicitly approve it —
and even then it offers a dry-run first.

---

Questions along the way? Reach out to your contact who shared this.
