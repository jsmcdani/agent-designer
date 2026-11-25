import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'
import type { DesignState, GroundedObject, DesignTopic } from '../types'

// The pane MIRRORS the governed walk — visual only, the terminal drives and the server governs. It
// renders the real receipts the gateway emits: grounded objects + fields, lattice-cell topics, the
// dropped ungrounded fields, the draft, and the human gate. Built to the thin-slice design, in terminal.
const PANE = 'agent-designer'
const EMPTY: DesignState = { agentName: null, agentType: null, status: 'idle', stage: null, objects: [], topics: [], gate: null }
const design = atom({ plugin: 'agent-designer', key: 'design' } as const, EMPTY, { shape: 'design-3' })

// ── Walk + two-tier help (from the thin-slice) ───────────────────────────────────
const STEPS = [
  { key: 'prompt', label: 'describe' },
  { key: 'ground', label: 'ground' },
  { key: 'propose', label: 'propose' },
  { key: 'map', label: 'map' },
  { key: 'draft', label: 'draft' },
  { key: 'gate', label: 'gate', gate: true },
] as const
const STATIC_HELP = 'You describe it -> the Designer grounds on your real org -> proposes lattice-cell topics -> binds only grounded fields -> authors the agent-script -> you gate & deploy.'
// The generalized help shown when the pane opens — it should actually teach someone what this is
// before they type a word. The per-step HELP below takes over once the walk is moving.
const INTRO_HELP: string[] = [
  'WHAT THIS IS',
  'Design a governed Agentforce agent from your own words - no UI wiring and no',
  'schema knowledge needed. You describe the agent you want; the Designer grounds',
  'every field on your real org, proposes small single-purpose topics, binds only',
  'real fields, authors the agent-script, and stops at a human gate before anything',
  'is deployed.',
  '',
  'HOW IT WORKS   (6 governed steps - each emits a receipt you can watch here)',
  '  1  describe   say what the agent should do, in plain words',
  '  2  ground     live describe on your org - every field is confirmed REAL',
  '  3  propose    topics as small lattice cells, never one monolith',
  '  4  map        bind only grounded fields; an ungrounded one is DROPPED',
  '  5  draft      the server authors the agent-script (never a classic bundle)',
  '  6  gate       validate + router lint; nothing deploys until you approve',
  '',
  'WHY IT IS SAFE',
  'Grounded + governed by construction: no hallucinated field can enter the spec,',
  'scope is a deterministic entitlement (never an LLM guess), and the human gate is',
  'the only path to a live deploy.',
]
const HELP: Record<string, { t: string; b: string }> = {
  prompt:  { t: 'describe it in plain words', b: 'Say what the agent should do in your own words - no schema or API knowledge. I ground it on your real org from there.' },
  ground:  { t: 'grounding - live describe',  b: 'I describe the objects live on your org, run-as. Every field shown is CONFIRMED real - never a guess or a doc.' },
  propose: { t: 'topics = lattice cells',     b: 'Each topic is one small single-purpose cell. Keep what fits, cut what does not. Routing is by description, so I write them trigger-shaped.' },
  map:     { t: 'grounded fields only',       b: 'I bind only fields a live describe returned. An ungrounded field is DROPPED by construction - no hallucinated field can slip past the gate.' },
  draft:   { t: 'server authors the .agent',  b: 'I author agent-script (never classic) from what we built. You review it before anything deploys.' },
  gate:    { t: 'the human gate',             b: 'Validate + router lint, artifact-only, no org touched. This is YOUR gate - nothing deploys until you approve.' },
}
// gateway stage -> pane step key
const STAGE_MAP: Record<string, string> = { ground: 'ground', propose_topics: 'propose', map_fields: 'map', draft_agent: 'draft', gate: 'gate' }
const stepIndex = (k: string | null) => STEPS.findIndex(s => s.key === k)

// ── Map a gateway DesignSpec -> pane state (REFLECT the spec; keep per-topic dropped from map receipts) ──
function specToState(spec: any, prev: DesignState): DesignState {
  if (!spec || typeof spec !== 'object') return prev
  const objects: GroundedObject[] = (Array.isArray(spec.grounding) ? spec.grounding : []).map((g: any) => ({
    object: String(g.object ?? ''),
    fields: (Array.isArray(g.confirmed_fields) ? g.confirmed_fields : []).map((f: any) => ({ api: String(f.api ?? f.name ?? ''), type: String(f.type ?? '') })),
  }))
  const fmByTopic: Record<string, any> = {}
  for (const fm of (Array.isArray(spec.field_maps) ? spec.field_maps : [])) fmByTopic[fm.topic] = fm
  const topics: DesignTopic[] = (Array.isArray(spec.topics) ? spec.topics : []).map((t: any) => ({
    name: String(t.name ?? ''),
    description: String(t.description ?? t.purpose ?? ''),
    fields: (fmByTopic[t.name]?.fields ?? []).map(String),
    dropped: prev.topics.find(p => p.name === t.name)?.dropped ?? [],
  }))
  const gate = spec.gate_state ? { ok: !!spec.gate_state.ok, nError: Number(spec.gate_state.n_error ?? 0) } : null
  const status: DesignState['status'] = spec.gate_state ? 'gated' : spec.draft_agent ? 'drafted' : spec.prompt ? 'drafting' : 'idle'
  return { agentName: spec.agent_dev_name ?? null, agentType: spec.agent_type ?? null, status, stage: prev.stage, objects, topics, gate }
}

function scanForSpec(text: string): any | null {
  const anchor = text.lastIndexOf('"grounding"')
  if (anchor < 0) return null
  let start = text.lastIndexOf('{', anchor)
  while (start >= 0) {
    for (let end = text.indexOf('}', anchor); end >= 0; end = text.indexOf('}', end + 1)) {
      try { const o = JSON.parse(text.slice(start, end + 1)); if (o && 'grounding' in o) return o } catch { /* keep extending */ }
    }
    start = text.lastIndexOf('{', start - 1)
  }
  return null
}
function scanForDropped(text: string): string[] {
  const m = text.match(/"rejected"\s*:\s*\[([^\]]*)\]/)
  if (!m) return []
  return ((m[1] ?? '').match(/"([^"]+)"/g) ?? []).map(s => s.replace(/"/g, ''))
}

// The driver writes the live DesignState here after each step; the pane watches it on its OWN 400ms
// timer. So the terminal carries only plain narration (never raw JSON), and the pane shows the intro
// first and then steps on its own, decoupled from my command timing. Top-level so the engine lets $ in.
let lastSeen = ''
async function poll($: any): Promise<void> {
  // Portable: resolve ~/.claude/designer-pane-state.json from the user's own home (never a baked path).
  const home = ((await $.env.get('USERPROFILE')) || (await $.env.get('HOME')) || '').replace(/\\/g, '/')
  const STATE_FILE = home + '/.claude/designer-pane-state.json'
  let raw = ''
  try { raw = await $.fs.read(STATE_FILE) } catch { return } // no file yet -> pane stays on the intro
  if (!raw || raw === lastSeen) return
  lastSeen = raw
  let st: any
  try { st = JSON.parse(raw) } catch { return }
  await update($, design, () => ({
    agentName: st.agentName ?? null,
    agentType: st.agentType ?? null,
    status: (st.status ?? 'idle') as DesignState['status'],
    stage: st.stage ?? null,
    objects: Array.isArray(st.objects) ? st.objects : [],
    topics: Array.isArray(st.topics) ? st.topics : [],
    gate: st.gate ?? null,
  }))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'designer', description: 'Open the Agent Designer live pane' })
    void $.ui.open({ id: PANE, title: 'Agent Designer' })
    $.clock.every(400, () => poll($))
    return next(e)
  })
  on('command.run', { command: 'designer' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Agent Designer' })
    await poll($)
    return { text: 'Agent Designer pane opened — intro first, then it follows each governed step on its own.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const s = await read($, design)
    const now = stepIndex(s.stage)

    // one compact pills row — colour shows progress; no overflow-prone chrome
    const pills = (
      <Box>
        {STEPS.map((st, i) => (
          <Text key={st.key} color={now > i ? 'green' : now === i ? 'cyan' : 'gray'} bold={now === i} dimColor={now < i}>
            {st.label}{i < STEPS.length - 1 ? '  ' : ''}
          </Text>
        ))}
      </Box>
    )

    if (s.status === 'idle') {
      return (
        <Box flexDirection="column" paddingX={1}>
          <Text bold color="cyan">Agent Designer</Text>
          <Text dimColor>Design a governed Agentforce agent from your own words.</Text>
          <Text> </Text>
          {pills}
          <Text> </Text>
          <Text bold color="magenta">WHAT THIS IS</Text>
          <Text dimColor>You describe the agent you want in plain words. It grounds every field on your real org, proposes small single-purpose topics, binds only real fields, authors the agent-script, and stops at a human gate before anything deploys.</Text>
          <Text> </Text>
          <Text bold color="magenta">HOW IT WORKS</Text>
          <Text dimColor>1  describe  - say what it should do, in plain words</Text>
          <Text dimColor>2  ground    - live describe; every field is REAL</Text>
          <Text dimColor>3  propose   - small lattice-cell topics, not a monolith</Text>
          <Text dimColor>4  map       - only grounded fields; others dropped</Text>
          <Text dimColor>5  draft     - the server authors the agent-script</Text>
          <Text dimColor>6  gate      - validate + lint; you approve to deploy</Text>
          <Text> </Text>
          <Text bold color="magenta">HELP IS BUILT IN</Text>
          <Text dimColor>Every step shows what to do and why - just ask.</Text>
        </Box>
      )
    }

    const join = (arr: string[], n: number) => arr.slice(0, n).join(', ') + (arr.length > n ? ` +${arr.length - n} more` : '')
    const row = (label: string, value: string, color?: string) => (
      <Text><Text color="magenta">{(label + '         ').slice(0, 9)}</Text><Text color={color}>{value}</Text></Text>
    )
    const o = s.objects[0]
    const t = s.topics[0]
    const help = s.stage ? HELP[s.stage] : null

    return (
      <Box flexDirection="column" paddingX={1}>
        {pills}
        <Text> </Text>
        <Text bold>{s.agentName ?? 'Equipment Concierge'}</Text>
        <Text dimColor>{s.agentType ?? 'AgentforceEmployeeAgent'} - {s.status}</Text>
        <Text> </Text>
        {o ? row('Grounded', `${o.object} - ${o.fields.length} fields (live describe)`, 'white') : null}
        {t ? row('Topic', t.name, 'white') : null}
        {t && t.fields.length > 0 ? row('Fields', join(t.fields, 4), 'green') : null}
        {t && t.dropped.length > 0 ? row('Dropped', join(t.dropped, 3) + '  (not on the org)', 'red') : null}
        {(s.status === 'drafted' || s.status === 'gated') ? row('Draft', (s.agentName ?? 'agent') + '  (agent-script authored)', 'cyan') : null}
        {s.gate ? row('Gate', (s.gate.ok ? 'PASS' : 'FAIL') + ` - ${s.gate.nError} errors` + (s.gate.ok ? ' - awaiting your approval' : ''), s.gate.ok ? 'green' : 'yellow') : null}
        <Text> </Text>
        {help ? <Text color="cyan">now: {s.stage}</Text> : null}
        {help ? <Text dimColor>{help.b}</Text> : null}
      </Box>
    )
  })
}
