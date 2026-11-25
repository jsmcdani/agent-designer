#!/usr/bin/env python
# Map a gateway response -> the pane's DesignState file. The pane watches this file on its own timer,
# so NOTHING raw goes to the terminal. Prints ONE clean human line (the receipt summary) and nothing else.
#   python pane_state.py <response.json>     -> write state from a /start or /step response
#   python pane_state.py idle                -> reset the pane to the intro/help page
import json, sys, os

STATE_FILE = os.path.expanduser('~/.claude/designer-pane-state.json')
STAGE_MAP = {'ground': 'ground', 'propose_topics': 'propose', 'map_fields': 'map', 'draft_agent': 'draft', 'gate': 'gate'}

def _load(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)

if sys.argv[1] == 'idle':
    st = {'agentName': None, 'agentType': None, 'status': 'idle', 'stage': None, 'objects': [], 'topics': [], 'gate': None}
    with open(STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(st, f)
    print('intro / help page')
    sys.exit(0)

resp = _load(sys.argv[1])
spec = resp.get('spec', {}) or {}

# carry dropped fields across steps (they come from the map receipt, not the spec)
dropped = {}
try:
    for t in _load(STATE_FILE).get('topics', []):
        if t.get('dropped'):
            dropped[t['name']] = list(t['dropped'])
except Exception:
    pass
for x in (((resp.get('receipt') or {}).get('data') or {}).get('rejected') or []):
    tn, _, fld = x.partition('.')
    dropped.setdefault(tn, [])
    if (fld or x) not in dropped[tn]:
        dropped[tn].append(fld or x)

gw_stage = resp.get('stage')
pane_stage = STAGE_MAP.get(gw_stage) or ('prompt' if resp.get('next') == 'ground' else None)

objects = [{'object': g['object'],
            'fields': [{'api': f['api'], 'type': f.get('type', '')} for f in g.get('confirmed_fields', [])]}
           for g in spec.get('grounding', [])]
fm = {f['topic']: f for f in spec.get('field_maps', [])}
topics = [{'name': t['name'], 'description': t.get('description', ''),
           'fields': fm.get(t['name'], {}).get('fields', []),
           'dropped': dropped.get(t['name'], [])}
          for t in spec.get('topics', [])]
gate = None
if spec.get('gate_state'):
    gs = spec['gate_state']
    gate = {'ok': bool(gs.get('ok')), 'nError': int(gs.get('n_error', 0))}
status = ('gated' if spec.get('gate_state') else
          'drafted' if spec.get('draft_agent') else
          'drafting' if spec.get('prompt') else 'idle')

st = {'agentName': spec.get('agent_dev_name'), 'agentType': spec.get('agent_type'),
      'status': status, 'stage': pane_stage, 'objects': objects, 'topics': topics, 'gate': gate}
with open(STATE_FILE, 'w', encoding='utf-8') as f:
    json.dump(st, f)

rc = resp.get('receipt') or {}
print(rc.get('summary') or ('spec opened' if resp.get('next') else 'ok'))
