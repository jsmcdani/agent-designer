---
name: designer-demo
description: Run the Agent Designer governed build as a LIVE TEACHING walkthrough — the kind the architect watches to learn how to do it herself, then tries. The terminal shows only plain-English narration ("here's what I did / here's what you'd type") — never code or JSON. A side pane shows the intro/help page first, then steps on its own. It is interactive (pause for the user between steps), demonstrates the built-in help, and goes all the way through the human gate to a deploy dry-run (no org state). Use when the user says "run the designer demo", "walk me/her through the designer", "show the agent designer", "do the teaching walkthrough", or invokes /designer-demo.
---

# Agent Designer — live teaching walkthrough

Drive the governed Agent Designer end-to-end as a demo someone **learns from**. They watch the terminal
(a plain-English story of what you did and what *they* would type) with a side **pane** that shows the
intro/help first and then each governed step as it lands. Then they try it themselves. Getting this
"pat" is the whole point — follow the rules exactly; they were learned the hard way.

## HARD RULES — do not violate (each one cost us a redo)
1. **Never print raw gateway JSON to the terminal.** The pane reads a **state file**; you write state with
   `pane_state.py`, which prints ONE clean human line and nothing else. Raw JSON "is of no value" and must
   not appear in the CLI.
2. **Start on the intro/help page.** First action is `python pane_state.py idle`. Never skip it — it shows
   what the tool is, the 6 steps, and that help is built in.
3. **One step per turn. Narrate, run the quiet step, then STOP and wait** for the user's "keep going" / "yes".
   This paces it, lets the pane paint cleanly, and makes it interactive (they drive the advance).
4. **Every step teaches**, in plain words: *"Here's what I did"* + *"Here's what you'd type"* (their input).
   Name at most a few real fields — never dump objects/fields/JSON.
5. **Demonstrate the built-in HELP** at least once: surface the per-step help line ("if you're unsure, the
   help says: …") so they see help exists and how it reads.
6. **Safety:** describe→gate is read-only / artifact-only (one live `describe`, no records, no writes, no org
   state). The **deploy** step is **dry-run first** (`confirm:false` — full gate + anon-Apex smoke, still NO
   org state). A LIVE deploy (`confirm:true`) creates the agent and needs the user's **explicit** go.
7. **If the pane doesn't move, STOP** — do not push on. The pane follows `STATE_FILE`; if it's stale, the
   mod isn't watching (re-open with `/designer`), not that the step failed.

## Preconditions
- The **agent-designer-pane** mod is loaded (the pane renders; `/designer` opens it at any width). The mod
  watches `STATE_FILE = ~/.claude/designer-pane-state.json` on a timer.
- **`pane_state.py`** (in this skill's folder) maps a gateway response → `STATE_FILE` and prints a clean line:
  `python <skill>/pane_state.py <response.json>` or `… idle`.
- A reachable **gateway** whose base URL is in **`AGENT_DESIGNER_URL`** (e.g. a local bench at
  `http://127.0.0.1:8794`, or your own deployed gateway). Grounding runs live against your org through it.
  Never bake a specific host into this skill or a logged command.
- **Credentials — NEVER hardcode them here or in any command the terminal logs.** Take the username/password
  from env (`AGENT_DESIGNER_USER` / `AGENT_DESIGNER_PASS`) or ask the user, and prefer having the user run the
  login with `! …` so their password stays in their shell; capture only the returned token to a file. The
  login is the user's own org admin (that per-user run-as is part of what the demo shows off).
- Carry the `spec` between steps (save to a file, reload each step). **Read/write JSON as UTF-8** — the
  gateway responses contain em-dashes (cp1252 default crashes).

## The walk (ONE step per turn — narrate, run quiet, STOP for "keep going")

**0 · OPEN.** `python pane_state.py idle`. Say: *"This is the Agent Designer. The pane shows what it is and
the 6 governed steps — describe, ground, propose, map, draft, gate — and help is built in. Say go to start."*

**1 · DESCRIBE.** Narrate: *"All you do to begin is say what the agent should do, in your own words. What I'd
type: '<prompt>'. No object names, no fields, no API — just intent."* Quietly: login (token→file), `POST /start
{prompt, orgRef, agentType}` → save spec; `pane_state.py r.json`. Pane → describe (agent card, now: prompt).
STOP.

**2 · GROUND.** Narrate: *"Now it grounds on your real org with a live describe. You confirm which object —
here, Asset. It comes back with the REAL fields (e.g. HealthScore, Asset_Reliability__c, MTBF) — every one
confirmed, none guessed."* `POST /step {objects:['Asset']}`; `pane_state.py`. Pane → ground. **Show help:**
*"If 'grounding' is unclear, the pane's help says: every field is confirmed real, never a guess."* STOP.

**3 · PROPOSE.** Narrate: *"You propose small topics — one job each (a 'lattice cell', not a monolith). What
I'd write: a topic 'Asset Health Check' with a trigger-shaped description — Use this when… / Typical triggers:
… / Do NOT use for…"* `POST /step {topics:[{name, description}]}`; `pane_state.py`. Pane → propose. STOP.

**4 · MAP.** Narrate: *"You bind the real fields to the topic. Watch the guard — I include one made-up field
on purpose; it gets DROPPED because it isn't on the org. No hallucinated field can get through."* `POST /step
{field_maps:[{topic, action, fields:[…real…, 'Bogus_Reliability_Score__c']}]}`; `pane_state.py`. Pane → map
(the dropped field shows). STOP.

**5 · DRAFT.** Narrate: *"The server writes the agent-script for you — a router, your topic, and an off-topic
guard. You never hand-write it."* `POST /step {}`; `pane_state.py`. Pane → draft. STOP.

**6 · GATE.** Narrate: *"The gate validates + lints the router — artifact only, nothing touched on the org.
This is your checkpoint: nothing deploys until you approve."* `POST /step {}`; `pane_state.py`. Pane → gate
PASS · 0 errors. Ask: *"Here's the gate — it passed clean. Approve to deploy? (yes runs a dry-run first.)"*
STOP.

**7 · DEPLOY (dry-run).** On "yes": Narrate: *"Deploy dry-run — full gate + an anonymous-Apex smoke test,
still NO org state changed."* `POST /api/agent-designer/deploy {spec, targetOrg:'SDO', confirm:false}`; report
the result in one line. Then: *"That's the preview. A LIVE deploy would actually create the agent — only on
your explicit go."* STOP (never go live without an explicit instruction).

## Gateway shapes (reference)
- `POST /login {username,password}` → `{token}` (Bearer it on every call thereafter)
- `POST /api/agent-designer/start {prompt, orgRef, agentType}` → `{spec, next}`
- `POST /api/agent-designer/step {spec, input}` → `{spec, receipt, stage, nextStage, done}`
- `POST /api/agent-designer/deploy {spec, targetOrg, confirm}` → `{mode, …report}`

Keep it human. The terminal is the lesson; the pane is the proof. Intro first, one clean step at a time,
help shown, through the gate to the dry-run — then hand her the keyboard.
