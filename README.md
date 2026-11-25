# Agent Designer

A live, teaching **pane + walkthrough** for building a **governed Agentforce agent** from plain words —
grounded on your real org, and gated before anything deploys.

You describe an agent in your own words. It grounds every field on your org (so **no hallucinated field**
can get in), proposes small single-purpose topics, binds only real fields, authors the agent-script for
you, and stops at a **human gate** before any deploy. A side pane shows each step as it happens; the
terminal narrates what was done — so someone can watch it once and learn to do it themselves.

> **Thin client.** The governed build, authoring, and grounding run on **your gateway**, not here. No
> credentials, no org data, and no build/authoring logic live in this repository.

## What's in it
A single plugin, **`agent-designer`**:
- a **hooks module** that draws the live pane (the intro/help page first, then the six steps, updating on
  its own timer from a small state file);
- the **`/designer-demo`** skill — a guided, teaching walkthrough you run one step at a time.

## Install
```text
/plugin marketplace add <owner>/<repo>
/plugin install agent-designer --marketplace <owner>/<repo>
```
Replace `<owner>/<repo>` with wherever this is hosted.

## Configure
Point it at the gateway serving your org (your contact gives you the URL); provide a login at runtime —
**never hardcode credentials**:
```text
export AGENT_DESIGNER_URL="https://<the-gateway-serving-your-org>"
```
Supply the login when prompted (or via `AGENT_DESIGNER_USER` / `AGENT_DESIGNER_PASS`). Prefer running the
login yourself with `! …` so your password stays in your shell; only the returned token is captured.

## Use
- **`/designer`** — open the live pane (shows the intro/help, then follows each step on its own).
- **`/designer-demo`** — run the guided teaching walkthrough: describe → ground → propose → map → draft →
  gate → deploy (dry-run), one step at a time, each narrated in plain words.

## Safety
Describe → gate is **read-only** — one live `describe`, no records read, no writes, no org state changed.
The deploy step is a **dry-run first** (still no org state). A live deploy actually creates the agent and
happens only on your explicit, separate go.

## State file
The pane reads `~/.claude/designer-pane-state.json`, written by the walkthrough. Per-user, local only —
it never leaves the machine and holds no secrets.

---
© Platform Technology, Inc. Licensed under the MIT License — see [LICENSE](./LICENSE).
