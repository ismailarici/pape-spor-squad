import { useState, useEffect, useRef } from 'react'
import { db } from './firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

// ─── Constants ───────────────────────────────────────────────────────────────

const POSITIONS = ['GK', 'DEF', 'MID', 'FWD']
const FORMATION = { GK: 2, DEF: 6, MID: 4, FWD: 2 }
const POS_COLOR  = { GK: '#f59e0b', DEF: '#3b82f6', MID: '#22c55e', FWD: '#ef4444' }
const POS_BG     = { GK: '#fef3c7', DEF: '#dbeafe', MID: '#dcfce7', FWD: '#fee2e2' }

const STATS    = ['Pace', 'Shooting', 'Passing', 'Dribbling', 'Defending', 'Physical']
const QUALITIES = ['Aggression', 'Leadership', 'Team Player', 'Work Rate']
const LEVELS   = ['Low', 'Med', 'High']
const LEVEL_COLOR = { Low: '#9ca3af', Med: '#3b82f6', High: '#f59e0b' }

const C = {
  header:  '#0f172a',
  accent:  '#22c55e',
  card:    '#ffffff',
  bg:      '#f1f5f9',
  border:  '#e2e8f0',
  muted:   '#94a3b8',
  text:    '#0f172a',
  sub:     '#475569',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const qualityKey = q =>
  q === 'Team Player' ? 'teamPlayer' : q === 'Work Rate' ? 'workRate' : q.toLowerCase()

const defaultPlayer = () => ({
  id: Date.now() + Math.random(),
  name: '', position: 'MID', stars: 3, age: 25,
  pace: 5, shooting: 5, passing: 5, dribbling: 5, defending: 5, physical: 5,
  aggression: 'Med', leadership: 'Med', teamPlayer: 'Med', workRate: 'Med',
  keepApart: [], keepTogether: []
})

const defaultRule = () => ({
  id: Date.now() + Math.random(),
  label: '', playerA: null, playerB: null, type: 'together', active: true
})

function playerScore(p) {
  const avg = (p.pace + p.shooting + p.passing + p.dribbling + p.defending + p.physical) / 6
  return p.stars * 0.6 + (avg / 10) * 5 * 0.4
}

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

// ─── Small UI pieces ─────────────────────────────────────────────────────────

function Stars({ value, onChange, size = 16 }) {
  return (
    <div style={{ display: 'flex', gap: 1 }}>
      {[1,2,3,4,5].map(s => (
        <span key={s} onClick={() => onChange?.(s)}
          style={{ fontSize: size, cursor: onChange ? 'pointer' : 'default',
            color: s <= value ? '#f59e0b' : '#e2e8f0', lineHeight: 1 }}>★</span>
      ))}
    </div>
  )
}

function Badge({ pos }) {
  return (
    <span style={{ background: POS_BG[pos], color: POS_COLOR[pos], borderRadius: 6,
      padding: '2px 8px', fontSize: 11, fontWeight: 700, letterSpacing: 0.3 }}>
      {pos}
    </span>
  )
}

function StatBar({ label, value }) {
  const pct = value * 10
  const color = value >= 8 ? '#22c55e' : value >= 6 ? '#3b82f6' : value >= 4 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 10, color: C.muted, width: 60, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 5, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99,
          transition: 'width 0.3s ease' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, width: 16, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function Slider({ label, value, onChange }) {
  const color = value >= 8 ? '#22c55e' : value >= 6 ? '#3b82f6' : value >= 4 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
      <span style={{ fontSize: 12, color: C.sub, width: 70, flexShrink: 0 }}>{label}</span>
      <input type="range" min={1} max={10} step={1} value={value}
        onChange={e => onChange(+e.target.value)}
        style={{ flex: 1, accentColor: color }} />
      <span style={{ fontSize: 13, fontWeight: 700, color, width: 18, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function QualityToggle({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 12, color: C.sub, width: 80, flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {LEVELS.map(l => (
          <button key={l} onClick={() => onChange(l)}
            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20,
              background: value === l ? LEVEL_COLOR[l] : 'transparent',
              color: value === l ? '#fff' : C.muted,
              border: `1.5px solid ${value === l ? LEVEL_COLOR[l] : C.border}`,
              fontWeight: value === l ? 600 : 400, transition: 'all 0.15s' }}>
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 1.2,
      textTransform: 'uppercase', marginBottom: 8, marginTop: 14 }}>
      {children}
    </p>
  )
}

function Card({ children, style }) {
  return (
    <div style={{ background: C.card, borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
      border: `1px solid ${C.border}`, ...style }}>
      {children}
    </div>
  )
}

function Btn({ children, onClick, variant = 'default', disabled, style }) {
  const variants = {
    primary:  { background: C.accent,   color: '#fff',    border: 'none' },
    danger:   { background: '#fee2e2',  color: '#ef4444', border: '1px solid #fca5a5' },
    ghost:    { background: 'transparent', color: C.sub,  border: `1px solid ${C.border}` },
    default:  { background: '#f8fafc',  color: C.text,    border: `1px solid ${C.border}` },
    blue:     { background: '#3b82f6',  color: '#fff',    border: 'none' },
  }
  const v = variants[variant] || variants.default
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ ...v, borderRadius: 10, padding: '9px 16px', fontSize: 14, fontWeight: 500,
        opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s', ...style }}>
      {children}
    </button>
  )
}

// ─── Player Card ─────────────────────────────────────────────────────────────

function PlayerCard({ player, allPlayers, onUpdate, onDelete, compact, selected, onToggle }) {
  const [expanded, setExpanded] = useState(false)
  const p = player

  const toggleRelation = (id, field) => {
    const list = p[field] || []
    onUpdate({ ...p, [field]: list.includes(id) ? list.filter(x => x !== id) : [...list, id] })
  }

  if (compact) return (
    <div onClick={onToggle} style={{
      background: selected ? POS_BG[p.position] : C.card,
      border: `2px solid ${selected ? POS_COLOR[p.position] : C.border}`,
      borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center',
      gap: 10, cursor: 'pointer', transition: 'all 0.15s',
      boxShadow: selected ? `0 0 0 3px ${POS_COLOR[p.position]}22` : 'none'
    }}>
      <Badge pos={p.position} />
      <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: C.text }}>{p.name || 'Unnamed'}</span>
      {p.age && <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>{p.age}y</span>}
      <Stars value={p.stars} />
    </div>
  )

  return (
    <Card style={{ marginBottom: 10 }}>
      {/* Header row */}
      <div style={{ padding: '14px 16px 10px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input value={p.name} onChange={e => onUpdate({ ...p, name: e.target.value })}
              placeholder="Player name"
              style={{ flex: 1, fontSize: 15, fontWeight: 600, padding: '8px 12px',
                border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text,
                background: '#fafafa' }} />
            <input type="number" value={p.age} min={15} max={50}
              onChange={e => onUpdate({ ...p, age: +e.target.value })}
              style={{ width: 62, fontSize: 14, padding: '8px 8px', textAlign: 'center',
                border: `1.5px solid ${C.border}`, borderRadius: 10, background: '#fafafa',
                color: C.sub, fontWeight: 500 }} />
          </div>
          {/* Position pills */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
            {POSITIONS.map(pos => (
              <button key={pos} onClick={() => onUpdate({ ...p, position: pos })}
                style={{ padding: '4px 12px', fontSize: 12, borderRadius: 20, fontWeight: 600,
                  background: p.position === pos ? POS_COLOR[pos] : 'transparent',
                  color: p.position === pos ? '#fff' : C.muted,
                  border: `1.5px solid ${p.position === pos ? POS_COLOR[pos] : C.border}`,
                  transition: 'all 0.15s' }}>
                {pos}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: C.muted }}>Rating</span>
            <Stars value={p.stars} onChange={v => onUpdate({ ...p, stars: v })} size={18} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          <button onClick={onDelete}
            style={{ fontSize: 16, color: C.muted, background: 'none', border: 'none',
              padding: '2px 4px', borderRadius: 6, lineHeight: 1 }}>×</button>
          <button onClick={() => setExpanded(!expanded)}
            style={{ fontSize: 11, color: C.sub, background: '#f8fafc', border: `1px solid ${C.border}`,
              borderRadius: 8, padding: '4px 10px', marginTop: 4, fontWeight: 500 }}>
            {expanded ? 'Less ▲' : 'More ▼'}
          </button>
        </div>
      </div>

      {/* Stat bars — always visible */}
      <div style={{ padding: '0 16px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 16px' }}>
        {STATS.map(s => <StatBar key={s} label={s} value={p[s.toLowerCase()] ?? 5} />)}
      </div>

      {/* Expanded section */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '12px 16px 14px' }}>
          <SectionLabel>Stats</SectionLabel>
          {STATS.map(s => (
            <Slider key={s} label={s} value={p[s.toLowerCase()] ?? 5}
              onChange={v => onUpdate({ ...p, [s.toLowerCase()]: v })} />
          ))}
          <SectionLabel>Qualities</SectionLabel>
          {QUALITIES.map(q => (
            <QualityToggle key={q} label={q} value={p[qualityKey(q)] || 'Med'}
              onChange={v => onUpdate({ ...p, [qualityKey(q)]: v })} />
          ))}
          <SectionLabel>Keep apart from</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
            {allPlayers.filter(q => q.id !== p.id && q.name).map(q => {
              const on = (p.keepApart||[]).includes(q.id)
              return (
                <button key={q.id} onClick={() => toggleRelation(q.id, 'keepApart')}
                  style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20,
                    background: on ? '#fee2e2' : 'transparent',
                    color: on ? '#ef4444' : C.muted,
                    border: `1.5px solid ${on ? '#fca5a5' : C.border}`,
                    fontWeight: on ? 600 : 400 }}>
                  {q.name}
                </button>
              )
            })}
          </div>
          <SectionLabel>Gets along well with</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {allPlayers.filter(q => q.id !== p.id && q.name).map(q => {
              const on = (p.keepTogether||[]).includes(q.id)
              return (
                <button key={q.id} onClick={() => toggleRelation(q.id, 'keepTogether')}
                  style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20,
                    background: on ? '#dcfce7' : 'transparent',
                    color: on ? '#16a34a' : C.muted,
                    border: `1.5px solid ${on ? '#86efac' : C.border}`,
                    fontWeight: on ? 600 : 400 }}>
                  {q.name}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── Rules Tab ────────────────────────────────────────────────────────────────

function RulesTab({ rules, players, saveRules }) {
  const [draft, setDraft] = useState(null)
  const named = players.filter(p => p.name)

  const saveDraft = () => {
    if (!draft.playerA || !draft.playerB || draft.playerA === draft.playerB) return
    const pA = players.find(p => p.id === draft.playerA)
    const pB = players.find(p => p.id === draft.playerB)
    const label = draft.label || `${pA?.name} ${draft.type === 'together' ? '+' : '≠'} ${pB?.name}`
    saveRules([...rules, { ...draft, label }])
    setDraft(null)
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: C.sub, marginBottom: 16, lineHeight: 1.6 }}>
        Named constraints applied during team generation. Toggle on/off each session.
      </p>

      {rules.length === 0 && !draft && (
        <Card style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚡</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>No rules yet</div>
          <div style={{ fontSize: 13, color: C.muted }}>Add rules to control team pairings</div>
        </Card>
      )}

      {rules.map(r => {
        const pA = players.find(p => p.id === r.playerA)
        const pB = players.find(p => p.id === r.playerB)
        return (
          <Card key={r.id} style={{ padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 4,
              background: r.active ? (r.type === 'together' ? C.accent : '#ef4444') : C.border }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: r.active ? C.text : C.muted,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                <span style={{ color: r.type === 'together' ? '#16a34a' : '#ef4444', fontWeight: 600 }}>
                  {r.type === 'together' ? 'Same team' : 'Different teams'}
                </span>
                {' · '}{pA?.name} & {pB?.name}
              </div>
            </div>
            <button onClick={() => saveRules(rules.map(x => x.id === r.id ? { ...x, active: !x.active } : x))}
              style={{ fontSize: 12, padding: '5px 12px', borderRadius: 20, fontWeight: 600,
                background: r.active ? '#dcfce7' : '#f1f5f9',
                color: r.active ? '#16a34a' : C.muted,
                border: `1.5px solid ${r.active ? '#86efac' : C.border}` }}>
              {r.active ? 'On' : 'Off'}
            </button>
            <button onClick={() => saveRules(rules.filter(x => x.id !== r.id))}
              style={{ fontSize: 18, color: '#d1d5db', background: 'none', border: 'none',
                padding: '0 4px', lineHeight: 1, flexShrink: 0 }}>×</button>
          </Card>
        )
      })}

      {draft && (
        <Card style={{ padding: '16px', marginBottom: 8 }}>
          <SectionLabel>New rule</SectionLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <select value={draft.playerA || ''} onChange={e => setDraft({ ...draft, playerA: e.target.value })}
              style={{ flex: 1, minWidth: 120, padding: '9px 12px', borderRadius: 10,
                border: `1.5px solid ${C.border}`, fontSize: 13, background: '#fafafa', color: C.text }}>
              <option value=''>Player A</option>
              {named.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value })}
              style={{ padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${C.border}`,
                fontSize: 13, background: '#fafafa', color: C.text }}>
              <option value='together'>Same team</option>
              <option value='apart'>Different teams</option>
            </select>
            <select value={draft.playerB || ''} onChange={e => setDraft({ ...draft, playerB: e.target.value })}
              style={{ flex: 1, minWidth: 120, padding: '9px 12px', borderRadius: 10,
                border: `1.5px solid ${C.border}`, fontSize: 13, background: '#fafafa', color: C.text }}>
              <option value=''>Player B</option>
              {named.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <input value={draft.label} onChange={e => setDraft({ ...draft, label: e.target.value })}
            placeholder="Label (optional — auto-generated if blank)"
            style={{ width: '100%', padding: '9px 12px', borderRadius: 10,
              border: `1.5px solid ${C.border}`, fontSize: 13, marginBottom: 10,
              background: '#fafafa', color: C.text }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="primary" onClick={saveDraft} style={{ flex: 1 }}>Save rule</Btn>
            <Btn variant="ghost" onClick={() => setDraft(null)}>Cancel</Btn>
          </div>
        </Card>
      )}

      {!draft && (
        <button onClick={() => setDraft(defaultRule())}
          style={{ width: '100%', padding: 12, fontSize: 14, borderRadius: 12, marginTop: 4,
            border: `2px dashed ${C.border}`, background: 'transparent', color: C.muted,
            fontWeight: 500 }}>
          + Add rule
        </button>
      )}
    </div>
  )
}

// ─── Team Generation ─────────────────────────────────────────────────────────

function generateTeams(selected, players, rules) {
  const pool = players.filter(p => selected.includes(p.id))
  const gks  = pool.filter(p => p.position === 'GK')
  const defs = pool.filter(p => p.position === 'DEF')
  const mids = pool.filter(p => p.position === 'MID')
  const fwds = pool.filter(p => p.position === 'FWD')
  if (gks.length < 2 || defs.length < 6 || mids.length < 4 || fwds.length < 2) return null

  const active = (rules || []).filter(r => r.active)
  let best = null, bestDiff = Infinity

  for (let i = 0; i < 500; i++) {
    const sd = shuffle(defs), sm = shuffle(mids), sf = shuffle(fwds), sg = shuffle(gks)
    const t1 = [sg[0], ...sd.slice(0,3), ...sm.slice(0,2), sf[0]]
    const t2 = [sg[1], ...sd.slice(3,6), ...sm.slice(2,4), sf[1]]

    const bad = (ta, tb) => {
      if (ta.some(a => ta.some(b => a.id !== b.id && (a.keepApart||[]).includes(b.id)))) return true
      if (tb.some(a => tb.some(b => a.id !== b.id && (a.keepApart||[]).includes(b.id)))) return true
      if (ta.some(a => (a.keepTogether||[]).some(id => tb.find(b => b.id === id)))) return true
      if (tb.some(a => (a.keepTogether||[]).some(id => ta.find(b => b.id === id)))) return true
      return active.some(r => {
        const aT1 = ta.find(p => p.id == r.playerA), bT1 = ta.find(p => p.id == r.playerB)
        const aT2 = tb.find(p => p.id == r.playerA), bT2 = tb.find(p => p.id == r.playerB)
        return r.type === 'together'
          ? (aT1 && bT2) || (aT2 && bT1)
          : (aT1 && bT1) || (aT2 && bT2)
      })
    }

    if (bad(t1, t2)) continue
    const s1 = t1.reduce((s, p) => s + playerScore(p), 0)
    const s2 = t2.reduce((s, p) => s + playerScore(p), 0)
    const diff = Math.abs(s1 - s2)
    if (diff < bestDiff) { bestDiff = diff; best = { t1, t2, s1, s2 } }
  }
  return best
}

// ─── Team Display ─────────────────────────────────────────────────────────────

function TeamDisplay({ team, label, score, color, accent }) {
  const byPos = POSITIONS.reduce((acc, pos) => {
    acc[pos] = team.filter(p => p.position === pos); return acc
  }, {})
  return (
    <div style={{ flex: 1, minWidth: 260, background: C.card, borderRadius: 16,
      border: `1px solid ${C.border}`, overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <div style={{ background: color, padding: '12px 16px', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>{label}</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
          Score {score.toFixed(1)}
        </span>
      </div>
      <div style={{ padding: '12px 16px' }}>
        {POSITIONS.map(pos => byPos[pos].length > 0 && (
          <div key={pos} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: POS_COLOR[pos],
              letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{pos}</div>
            {byPos[pos].map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 0', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: C.text }}>{p.name}</span>
                {p.age && <span style={{ fontSize: 11, color: C.muted }}>{p.age}y</span>}
                <Stars value={p.stars} size={13} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── AI Coach ─────────────────────────────────────────────────────────────────

function AICoach({ players, rules, onPlayersUpdate, onRulesUpdate }) {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: "Hey coach! 👋 Tell me what happened in today's game, ask me to update player stats, create team rules, or anything about the squad."
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const applyActions = (actions, curPlayers, curRules) => {
    let p = [...curPlayers], r = [...curRules], log = []
    for (const a of actions || []) {
      if (a.type === 'updatePlayer') {
        p = p.map(x => x.id == a.playerId ? (log.push(`Updated ${x.name}`), { ...x, ...a.changes }) : x)
      } else if (a.type === 'addRule') {
        const pA = p.find(x => x.id == a.playerAId), pB = p.find(x => x.id == a.playerBId)
        if (pA && pB) {
          r = [...r, { id: Date.now() + Math.random(), active: true, type: a.ruleType,
            playerA: a.playerAId, playerB: a.playerBId,
            label: a.label || `${pA.name} ${a.ruleType === 'together' ? '+' : '≠'} ${pB.name}` }]
          log.push(`Added rule`)
        }
      } else if (a.type === 'toggleRule') {
        r = r.map(x => x.id == a.ruleId ? { ...x, active: !x.active } : x)
        log.push('Toggled rule')
      } else if (a.type === 'deleteRule') {
        r = r.filter(x => x.id != a.ruleId)
        log.push('Deleted rule')
      }
    }
    if (p !== curPlayers) onPlayersUpdate(p)
    if (r !== curRules) onRulesUpdate(r)
    return log
  }

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    const next = [...messages, { role: 'user', content: userMsg }]
    setMessages(next)
    setLoading(true)
    const history = next.slice(1, -1).map(m => ({ role: m.role, content: m.content }))
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, players, rules, history })
      })
      const data = await res.json()
      const log = applyActions(data.actions, players, rules)
      const suffix = log.length ? `\n\n✓ ${log.join(', ')}` : ''
      setMessages(prev => [...prev, { role: 'assistant', content: data.message + suffix }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Try again.' }])
    }
    setLoading(false)
  }

  const suggestions = [
    "Team A won 3-1, Musa scored twice",
    "Put Eren and Kurt on the same team",
    "Who are our weakest defenders?",
    "Suggest how to improve squad balance",
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)', minHeight: 400 }}>
      <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', paddingBottom: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 10, display: 'flex',
            justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {m.role === 'assistant' && (
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, marginRight: 8, flexShrink: 0, alignSelf: 'flex-end' }}>⚽</div>
            )}
            <div style={{
              maxWidth: '78%', padding: '10px 14px', borderRadius: 16, fontSize: 14, lineHeight: 1.6,
              background: m.role === 'user' ? '#0f172a' : C.card,
              color: m.role === 'user' ? '#fff' : C.text,
              border: m.role === 'assistant' ? `1px solid ${C.border}` : 'none',
              borderBottomRightRadius: m.role === 'user' ? 4 : 16,
              borderBottomLeftRadius: m.role === 'assistant' ? 4 : 16,
              boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
              whiteSpace: 'pre-wrap'
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, marginRight: 8 }}>⚽</div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
              borderBottomLeftRadius: 4, padding: '10px 16px', fontSize: 14, color: C.muted }}>
              Thinking<span style={{ animation: 'none' }}>...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length === 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {suggestions.map(s => (
            <button key={s} onClick={() => setInput(s)}
              style={{ fontSize: 12, padding: '6px 12px', borderRadius: 20,
                background: C.card, color: C.sub, border: `1px solid ${C.border}`,
                fontWeight: 500 }}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Talk to your AI coach..."
          style={{ flex: 1, padding: '11px 14px', borderRadius: 12, border: `1.5px solid ${C.border}`,
            fontSize: 14, background: '#fafafa', color: C.text }} />
        <button onClick={send} disabled={loading || !input.trim()}
          style={{ padding: '11px 20px', borderRadius: 12, fontSize: 14, fontWeight: 600,
            background: input.trim() && !loading ? C.accent : C.border,
            color: input.trim() && !loading ? '#fff' : C.muted,
            border: 'none', transition: 'all 0.15s' }}>
          ↑
        </button>
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState('pool')
  const [players, setPlayers]   = useState([])
  const [rules, setRules]       = useState([])
  const [selected, setSelected] = useState([])
  const [teams, setTeams]       = useState(null)
  const [error, setError]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [loaded, setLoaded]     = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const [ps, rs] = await Promise.all([
          getDoc(doc(db, 'shared', 'players')),
          getDoc(doc(db, 'shared', 'rules'))
        ])
        if (ps.exists()) setPlayers(ps.data().list || [])
        if (rs.exists()) setRules(rs.data().list || [])
      } catch (e) { console.error(e) }
      setLoaded(true)
    })()
  }, [])

  const savePlayers = async updated => {
    setPlayers(updated); setSaving(true)
    try { await setDoc(doc(db, 'shared', 'players'), { list: updated }) } catch {}
    setSaving(false)
  }
  const saveRules = async updated => {
    setRules(updated); setSaving(true)
    try { await setDoc(doc(db, 'shared', 'rules'), { list: updated }) } catch {}
    setSaving(false)
  }

  const addPlayer    = () => savePlayers([...players, defaultPlayer()])
  const updatePlayer = p  => savePlayers(players.map(x => x.id === p.id ? p : x))
  const deletePlayer = id => {
    setSelected(s => s.filter(x => x !== id))
    savePlayers(players.filter(x => x.id !== id).map(x => ({
      ...x,
      keepApart:    (x.keepApart||[]).filter(k => k !== id),
      keepTogether: (x.keepTogether||[]).filter(k => k !== id)
    })))
  }

  const selCounts = POSITIONS.reduce((acc, pos) => {
    acc[pos] = selected.filter(id => players.find(p => p.id === id)?.position === pos).length
    return acc
  }, {})

  const toggleSelect = id => {
    const p = players.find(x => x.id === id)
    if (!p) return
    if (selected.includes(id)) { setSelected(s => s.filter(x => x !== id)); setError(''); return }
    if (selCounts[p.position] >= FORMATION[p.position]) {
      setError(`Max ${FORMATION[p.position]} ${p.position}s allowed.`); return
    }
    setError(''); setSelected(s => [...s, id])
  }

  const readyToGenerate = POSITIONS.every(pos => selCounts[pos] === FORMATION[pos])
  const activeRules = rules.filter(r => r.active)

  const generate = () => {
    const result = generateTeams(selected, players, rules)
    if (!result) setError('Could not balance teams. Try toggling some rules off.')
    else { setTeams(result); setError(''); setTab('teams') }
  }

  const TABS = [
    { id: 'pool',    label: 'Squad' },
    { id: 'rules',   label: `Rules${activeRules.length ? ` · ${activeRules.length}` : ''}` },
    { id: 'session', label: 'Session' },
    { id: 'teams',   label: 'Teams' },
    { id: 'ai',      label: '✦ AI' },
  ]

  if (!loaded) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: C.header }}>
      <div style={{ textAlign: 'center', color: '#fff' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚽</div>
        <div style={{ fontSize: 16, opacity: 0.7 }}>Loading squad...</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <div style={{ background: C.header, padding: '16px 20px', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>⚽</span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: -0.3 }}>
              Pape Spor Squad
            </div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
              {players.length} players{saving ? ' · saving...' : ''}
            </div>
          </div>
        </div>
        <div style={{ width: 8, height: 8, borderRadius: '50%',
          background: saving ? '#f59e0b' : C.accent,
          boxShadow: `0 0 8px ${saving ? '#f59e0b' : C.accent}` }} />
      </div>

      {/* Tab bar */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`,
        padding: '0 16px', display: 'flex', gap: 0, overflowX: 'auto',
        scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '14px 16px', fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? C.accent : C.muted, background: 'none', border: 'none',
              borderBottom: `2.5px solid ${tab === t.id ? C.accent : 'transparent'}`,
              whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 40px' }}>

        {/* ── Squad ── */}
        {tab === 'pool' && (
          <div>
            <p style={{ fontSize: 13, color: C.sub, marginBottom: 16, lineHeight: 1.6 }}>
              Shared roster — edits save instantly for everyone in the group.
            </p>
            {players.length === 0 && (
              <Card style={{ padding: '48px 20px', textAlign: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 4 }}>No players yet</div>
                <div style={{ fontSize: 13, color: C.muted }}>Add your first player below</div>
              </Card>
            )}
            {players.map(p => (
              <PlayerCard key={p.id} player={p} allPlayers={players}
                onUpdate={updatePlayer} onDelete={() => deletePlayer(p.id)} />
            ))}
            <button onClick={addPlayer}
              style={{ width: '100%', padding: 14, fontSize: 14, fontWeight: 600,
                borderRadius: 14, border: `2px dashed ${C.border}`, background: 'transparent',
                color: C.muted, marginTop: 4 }}>
              + Add player
            </button>
          </div>
        )}

        {/* ── Rules ── */}
        {tab === 'rules' && (
          <RulesTab rules={rules} players={players} saveRules={saveRules} />
        )}

        {/* ── Session ── */}
        {tab === 'session' && (
          <div>
            <p style={{ fontSize: 13, color: C.sub, marginBottom: 14, lineHeight: 1.6 }}>
              Pick 2 GK · 6 DEF · 4 MID · 2 FWD for today's game.
            </p>

            {/* Formation tracker */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
              {POSITIONS.map(pos => {
                const done = selCounts[pos] === FORMATION[pos]
                return (
                  <Card key={pos} style={{ padding: '10px 8px', textAlign: 'center',
                    borderColor: done ? POS_COLOR[pos] : C.border,
                    background: done ? POS_BG[pos] : C.card }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: POS_COLOR[pos],
                      letterSpacing: 1, marginBottom: 4 }}>{pos}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: done ? POS_COLOR[pos] : C.text, lineHeight: 1 }}>
                      {selCounts[pos]}
                      <span style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>/{FORMATION[pos]}</span>
                    </div>
                  </Card>
                )
              })}
            </div>

            {activeRules.length > 0 && (
              <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10,
                padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#92400e', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span>⚡</span>
                <span>{activeRules.length} rule{activeRules.length > 1 ? 's' : ''} active: {activeRules.map(r => r.label).join(', ')}</span>
              </div>
            )}

            {POSITIONS.map(pos => {
              const group = players.filter(p => p.position === pos)
              if (!group.length) return null
              return (
                <div key={pos} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 3, height: 16, borderRadius: 2, background: POS_COLOR[pos] }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: POS_COLOR[pos], letterSpacing: 0.5 }}>{pos}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {group.map(p => (
                      <PlayerCard key={p.id} player={p} allPlayers={players}
                        onUpdate={updatePlayer} onDelete={() => {}} compact
                        selected={selected.includes(p.id)} onToggle={() => toggleSelect(p.id)} />
                    ))}
                  </div>
                </div>
              )
            })}

            {error && (
              <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10,
                padding: '10px 14px', fontSize: 13, color: '#dc2626', marginTop: 8 }}>
                {error}
              </div>
            )}

            <button onClick={generate} disabled={!readyToGenerate}
              style={{ width: '100%', marginTop: 16, padding: 14, fontSize: 16, fontWeight: 700,
                borderRadius: 14, border: 'none', transition: 'all 0.2s',
                background: readyToGenerate ? C.accent : C.border,
                color: readyToGenerate ? '#fff' : C.muted,
                cursor: readyToGenerate ? 'pointer' : 'not-allowed',
                boxShadow: readyToGenerate ? '0 4px 14px rgba(34,197,94,0.35)' : 'none' }}>
              Generate Teams
            </button>
          </div>
        )}

        {/* ── Teams ── */}
        {tab === 'teams' && (
          <div>
            {!teams ? (
              <Card style={{ padding: '48px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 4 }}>No teams yet</div>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Go to Session to select players</div>
                <Btn variant="primary" onClick={() => setTab('session')}>Go to Session</Btn>
              </Card>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                  <TeamDisplay team={teams.t1} label="Team A" score={teams.s1} color="#3b82f6" />
                  <TeamDisplay team={teams.t2} label="Team B" score={teams.s2} color="#22c55e" />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Btn variant="default" style={{ flex: 1 }}
                    onClick={() => setTeams(generateTeams(selected, players, rules))}>
                    Regenerate
                  </Btn>
                  <Btn variant="default" style={{ flex: 1 }} onClick={() => setTab('session')}>
                    Change players
                  </Btn>
                </div>
                <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef3c7',
                  border: '1px solid #fde68a', borderRadius: 10, fontSize: 12, color: '#92400e',
                  textAlign: 'center' }}>
                  After the game, go to <strong>✦ AI</strong> to report the score and update ratings
                </div>
              </>
            )}
          </div>
        )}

        {/* ── AI Coach ── */}
        {tab === 'ai' && (
          <AICoach players={players} rules={rules}
            onPlayersUpdate={savePlayers} onRulesUpdate={saveRules} />
        )}
      </div>
    </div>
  )
}
