import { useState, useEffect, useRef } from 'react'
import { db } from './firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

// ─── Constants ───────────────────────────────────────────────────────────────

const POSITIONS  = ['GK', 'DEF', 'MID', 'FWD']
const FORMATION  = { GK: 2, DEF: 6, MID: 4, FWD: 2 }
const POS_COLOR  = { GK: '#f59e0b', DEF: '#3b82f6', MID: '#22c55e', FWD: '#ef4444' }
const POS_BG     = { GK: '#fef3c7', DEF: '#dbeafe', MID: '#dcfce7', FWD: '#fee2e2' }

const STATS     = ['Pace', 'Shooting', 'Passing', 'Dribbling', 'Defending', 'Physical']
const QUALITIES = ['Aggression', 'Leadership', 'Team Player', 'Work Rate']
const LEVELS    = ['Low', 'Med', 'High']
const LEVEL_COLOR = { Low: '#9ca3af', Med: '#3b82f6', High: '#f59e0b' }

const C = {
  header: '#0f172a', accent: '#22c55e', card: '#ffffff',
  bg: '#f1f5f9', border: '#e2e8f0', muted: '#94a3b8', text: '#0f172a', sub: '#475569',
}

const qualityKey = q =>
  q === 'Team Player' ? 'teamPlayer' : q === 'Work Rate' ? 'workRate' : q.toLowerCase()

const defaultPlayer = () => ({
  id: Date.now() + Math.random(),
  name: '', position: 'MID', secondaryPositions: [], stars: 3, age: 25,
  pace: 5, shooting: 5, passing: 5, dribbling: 5, defending: 5, physical: 5,
  aggression: 'Med', leadership: 'Med', teamPlayer: 'Med', workRate: 'Med',
  keepApart: [], keepTogether: []
})

function playerScore(p) {
  const avg = (p.pace + p.shooting + p.passing + p.dribbling + p.defending + p.physical) / 6
  return p.stars * 0.6 + (avg / 10) * 5 * 0.4
}

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

function formatDate(ts) {
  const d = new Date(ts)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Small UI ────────────────────────────────────────────────────────────────

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

function Badge({ pos, small }) {
  return (
    <span style={{ background: POS_BG[pos], color: POS_COLOR[pos], borderRadius: 6,
      padding: small ? '1px 5px' : '2px 8px', fontSize: small ? 10 : 11, fontWeight: 700, letterSpacing: 0.3 }}>
      {pos}
    </span>
  )
}

function StatBar({ label, value }) {
  const color = value >= 8 ? '#22c55e' : value >= 6 ? '#3b82f6' : value >= 4 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 10, color: C.muted, width: 60, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 5, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${value * 10}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.3s' }} />
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
        onChange={e => onChange(+e.target.value)} style={{ flex: 1, accentColor: color }} />
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
              fontWeight: value === l ? 600 : 400 }}>
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
      textTransform: 'uppercase', marginBottom: 8, marginTop: 14 }}>{children}</p>
  )
}

function Card({ children, style }) {
  return (
    <div style={{ background: C.card, borderRadius: 16,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: `1px solid ${C.border}`, ...style }}>
      {children}
    </div>
  )
}

function Btn({ children, onClick, variant = 'default', disabled, style }) {
  const v = {
    primary: { background: C.accent,   color: '#fff',    border: 'none' },
    ghost:   { background: 'transparent', color: C.sub,  border: `1px solid ${C.border}` },
    default: { background: '#f8fafc',  color: C.text,    border: `1px solid ${C.border}` },
    blue:    { background: '#3b82f6',  color: '#fff',    border: 'none' },
    red:     { background: '#fee2e2',  color: '#ef4444', border: '1px solid #fca5a5' },
  }[variant] || {}
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ ...v, borderRadius: 10, padding: '9px 16px', fontSize: 14, fontWeight: 500,
        opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer', ...style }}>
      {children}
    </button>
  )
}

// ─── Player Card ─────────────────────────────────────────────────────────────

function PlayerCard({ player, allPlayers, onUpdate, onDelete, compact, selected, onToggle }) {
  const [expanded, setExpanded] = useState(false)
  const p = player
  const secondary = p.secondaryPositions || []

  const toggleRelation = (id, field) => {
    const list = p[field] || []
    onUpdate({ ...p, [field]: list.includes(id) ? list.filter(x => x !== id) : [...list, id] })
  }

  const toggleSecondary = pos => {
    if (pos === p.position) return // can't set primary as secondary
    onUpdate({ ...p, secondaryPositions: secondary.includes(pos) ? secondary.filter(x => x !== pos) : [...secondary, pos] })
  }

  if (compact) return (
    <div onClick={onToggle} style={{
      background: selected ? POS_BG[p.position] : C.card,
      border: `2px solid ${selected ? POS_COLOR[p.position] : C.border}`,
      borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center',
      gap: 8, cursor: 'pointer', transition: 'all 0.15s',
    }}>
      <Badge pos={p.position} />
      {secondary.map(pos => <Badge key={pos} pos={pos} small />)}
      <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: C.text }}>{p.name || 'Unnamed'}</span>
      {p.age && <span style={{ fontSize: 12, color: C.muted }}>{p.age}y</span>}
      <Stars value={p.stars} />
    </div>
  )

  return (
    <Card style={{ marginBottom: 10 }}>
      <div style={{ padding: '14px 16px 10px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input value={p.name} onChange={e => onUpdate({ ...p, name: e.target.value })}
              placeholder="Player name"
              style={{ flex: 1, fontSize: 15, fontWeight: 600, padding: '8px 12px',
                border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, background: '#fafafa' }} />
            <input type="number" value={p.age} min={15} max={50}
              onChange={e => onUpdate({ ...p, age: +e.target.value })}
              style={{ width: 62, fontSize: 14, padding: '8px', textAlign: 'center',
                border: `1.5px solid ${C.border}`, borderRadius: 10, background: '#fafafa', color: C.sub }} />
          </div>

          {/* Primary position */}
          <div style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: 1,
              textTransform: 'uppercase', marginRight: 8 }}>Primary</span>
            <div style={{ display: 'inline-flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
              {POSITIONS.map(pos => (
                <button key={pos} onClick={() => onUpdate({ ...p, position: pos, secondaryPositions: secondary.filter(x => x !== pos) })}
                  style={{ padding: '4px 12px', fontSize: 12, borderRadius: 20, fontWeight: 600,
                    background: p.position === pos ? POS_COLOR[pos] : 'transparent',
                    color: p.position === pos ? '#fff' : C.muted,
                    border: `1.5px solid ${p.position === pos ? POS_COLOR[pos] : C.border}` }}>
                  {pos}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: C.muted }}>Rating</span>
            <Stars value={p.stars} onChange={v => onUpdate({ ...p, stars: v })} size={18} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          <button onClick={onDelete}
            style={{ fontSize: 18, color: C.muted, background: 'none', border: 'none', lineHeight: 1 }}>×</button>
          <button onClick={() => setExpanded(!expanded)}
            style={{ fontSize: 11, color: C.sub, background: '#f8fafc', border: `1px solid ${C.border}`,
              borderRadius: 8, padding: '4px 10px', marginTop: 4, fontWeight: 500 }}>
            {expanded ? 'Less ▲' : 'More ▼'}
          </button>
        </div>
      </div>

      {/* Stat mini-bars */}
      <div style={{ padding: '0 16px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 16px' }}>
        {STATS.map(s => <StatBar key={s} label={s} value={p[s.toLowerCase()] ?? 5} />)}
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '12px 16px 14px' }}>

          {/* Secondary positions */}
          <SectionLabel>Can also play</SectionLabel>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 4 }}>
            {POSITIONS.filter(pos => pos !== p.position).map(pos => (
              <button key={pos} onClick={() => toggleSecondary(pos)}
                style={{ padding: '4px 12px', fontSize: 12, borderRadius: 20, fontWeight: 600,
                  background: secondary.includes(pos) ? POS_BG[pos] : 'transparent',
                  color: secondary.includes(pos) ? POS_COLOR[pos] : C.muted,
                  border: `1.5px solid ${secondary.includes(pos) ? POS_COLOR[pos] : C.border}` }}>
                {pos} {secondary.includes(pos) ? '✓' : '+'}
              </button>
            ))}
          </div>

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
                    background: on ? '#fee2e2' : 'transparent', color: on ? '#ef4444' : C.muted,
                    border: `1.5px solid ${on ? '#fca5a5' : C.border}`, fontWeight: on ? 600 : 400 }}>
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
                    background: on ? '#dcfce7' : 'transparent', color: on ? '#16a34a' : C.muted,
                    border: `1.5px solid ${on ? '#86efac' : C.border}`, fontWeight: on ? 600 : 400 }}>
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
                background: r.active ? '#dcfce7' : '#f1f5f9', color: r.active ? '#16a34a' : C.muted,
                border: `1.5px solid ${r.active ? '#86efac' : C.border}` }}>
              {r.active ? 'On' : 'Off'}
            </button>
            <button onClick={() => saveRules(rules.filter(x => x.id !== r.id))}
              style={{ fontSize: 18, color: '#d1d5db', background: 'none', border: 'none', padding: '0 4px', lineHeight: 1 }}>×</button>
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
              style={{ padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, background: '#fafafa', color: C.text }}>
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
            placeholder="Label (optional)"
            style={{ width: '100%', padding: '9px 12px', borderRadius: 10,
              border: `1.5px solid ${C.border}`, fontSize: 13, marginBottom: 10, background: '#fafafa', color: C.text }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="primary" onClick={saveDraft} style={{ flex: 1 }}>Save rule</Btn>
            <Btn variant="ghost" onClick={() => setDraft(null)}>Cancel</Btn>
          </div>
        </Card>
      )}
      {!draft && (
        <button onClick={() => setDraft({ id: Date.now(), label: '', playerA: null, playerB: null, type: 'together', active: true })}
          style={{ width: '100%', padding: 12, fontSize: 14, borderRadius: 12, marginTop: 4,
            border: `2px dashed ${C.border}`, background: 'transparent', color: C.muted, fontWeight: 500 }}>
          + Add rule
        </button>
      )}
    </div>
  )
}

// ─── History Tab ─────────────────────────────────────────────────────────────

function HistoryTab({ history, players, teams, saveHistory }) {
  const [filter, setFilter] = useState('all')
  const [showGameForm, setShowGameForm] = useState(false)
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [gameForm, setGameForm] = useState({ scoreA: '', scoreB: '', note: '' })
  const [noteText, setNoteText] = useState('')

  const logGame = () => {
    if (gameForm.scoreA === '' || gameForm.scoreB === '') return
    const entry = {
      id: Date.now() + Math.random(),
      type: 'game',
      timestamp: Date.now(),
      scoreA: +gameForm.scoreA,
      scoreB: +gameForm.scoreB,
      teamA: teams?.t1?.map(p => p.id) || [],
      teamB: teams?.t2?.map(p => p.id) || [],
      teamANames: teams?.t1?.map(p => p.name) || [],
      teamBNames: teams?.t2?.map(p => p.name) || [],
      note: gameForm.note,
    }
    saveHistory([entry, ...history])
    setGameForm({ scoreA: '', scoreB: '', note: '' })
    setShowGameForm(false)
  }

  const logNote = () => {
    if (!noteText.trim()) return
    const entry = { id: Date.now() + Math.random(), type: 'note', timestamp: Date.now(), text: noteText.trim() }
    saveHistory([entry, ...history])
    setNoteText('')
    setShowNoteForm(false)
  }

  const filtered = filter === 'all' ? history : history.filter(e => e.type === filter)

  const typeIcon  = { game: '⚽', playerUpdate: '📊', note: '💬' }
  const typeLabel = { game: 'Game', playerUpdate: 'Update', note: 'Note' }
  const typeColor = { game: '#3b82f6', playerUpdate: '#22c55e', note: '#f59e0b' }
  const typeBg    = { game: '#dbeafe', playerUpdate: '#dcfce7', note: '#fef3c7' }

  return (
    <div>
      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => { setShowGameForm(!showGameForm); setShowNoteForm(false) }}
          style={{ flex: 1, padding: '10px', borderRadius: 12, fontSize: 13, fontWeight: 600,
            background: showGameForm ? C.accent : C.card, color: showGameForm ? '#fff' : C.sub,
            border: `1.5px solid ${showGameForm ? C.accent : C.border}` }}>
          ⚽ Log game
        </button>
        <button onClick={() => { setShowNoteForm(!showNoteForm); setShowGameForm(false) }}
          style={{ flex: 1, padding: '10px', borderRadius: 12, fontSize: 13, fontWeight: 600,
            background: showNoteForm ? '#f59e0b' : C.card, color: showNoteForm ? '#fff' : C.sub,
            border: `1.5px solid ${showNoteForm ? '#f59e0b' : C.border}` }}>
          💬 Add note
        </button>
      </div>

      {/* Game form */}
      {showGameForm && (
        <Card style={{ padding: 16, marginBottom: 16 }}>
          <SectionLabel>Log game result</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 600 }}>TEAM A</div>
              <input type="number" min={0} max={99} value={gameForm.scoreA}
                onChange={e => setGameForm({ ...gameForm, scoreA: e.target.value })}
                style={{ width: '100%', fontSize: 28, fontWeight: 800, textAlign: 'center',
                  padding: '8px', border: `2px solid ${C.border}`, borderRadius: 12,
                  color: '#3b82f6', background: '#dbeafe' }} />
            </div>
            <span style={{ fontSize: 20, color: C.muted, fontWeight: 700 }}>–</span>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 600 }}>TEAM B</div>
              <input type="number" min={0} max={99} value={gameForm.scoreB}
                onChange={e => setGameForm({ ...gameForm, scoreB: e.target.value })}
                style={{ width: '100%', fontSize: 28, fontWeight: 800, textAlign: 'center',
                  padding: '8px', border: `2px solid ${C.border}`, borderRadius: 12,
                  color: '#22c55e', background: '#dcfce7' }} />
            </div>
          </div>
          <input value={gameForm.note} onChange={e => setGameForm({ ...gameForm, note: e.target.value })}
            placeholder="Notes (optional — standout players, incidents...)"
            style={{ width: '100%', padding: '9px 12px', borderRadius: 10,
              border: `1.5px solid ${C.border}`, fontSize: 13, marginBottom: 10,
              background: '#fafafa', color: C.text }} />
          {!teams && <p style={{ fontSize: 12, color: '#f59e0b', marginBottom: 8 }}>⚠ No teams generated yet — score will be logged without team details.</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="primary" onClick={logGame} style={{ flex: 1 }}>Save result</Btn>
            <Btn variant="ghost" onClick={() => setShowGameForm(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      {/* Note form */}
      {showNoteForm && (
        <Card style={{ padding: 16, marginBottom: 16 }}>
          <SectionLabel>Add note</SectionLabel>
          <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
            placeholder="Tactical notes, observations, anything worth remembering..."
            rows={3}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 10,
              border: `1.5px solid ${C.border}`, fontSize: 13, marginBottom: 10,
              background: '#fafafa', color: C.text, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="primary" onClick={logNote} style={{ flex: 1 }}>Save note</Btn>
            <Btn variant="ghost" onClick={() => setShowNoteForm(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {['all', 'game', 'playerUpdate', 'note'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ fontSize: 12, padding: '5px 12px', borderRadius: 20, fontWeight: 600,
              background: filter === f ? C.text : C.card,
              color: filter === f ? '#fff' : C.muted,
              border: `1.5px solid ${filter === f ? C.text : C.border}` }}>
            {f === 'all' ? 'All' : typeLabel[f]}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {filtered.length === 0 && (
        <Card style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>No history yet</div>
          <div style={{ fontSize: 13, color: C.muted }}>Log a game or let the AI Coach make updates</div>
        </Card>
      )}

      <div style={{ position: 'relative' }}>
        {filtered.length > 0 && (
          <div style={{ position: 'absolute', left: 18, top: 0, bottom: 0, width: 2,
            background: C.border, borderRadius: 2 }} />
        )}
        {filtered.map((e, i) => (
          <div key={e.id} style={{ display: 'flex', gap: 12, marginBottom: 12, position: 'relative' }}>
            {/* Icon bubble */}
            <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, zIndex: 1,
              background: typeBg[e.type], border: `2px solid ${C.card}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
              boxShadow: `0 0 0 2px ${typeColor[e.type]}33` }}>
              {typeIcon[e.type]}
            </div>

            {/* Content */}
            <Card style={{ flex: 1, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: typeColor[e.type],
                  textTransform: 'uppercase', letterSpacing: 0.8 }}>{typeLabel[e.type]}</span>
                <span style={{ fontSize: 11, color: C.muted }}>{formatDate(e.timestamp)}</span>
              </div>

              {e.type === 'game' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 700, marginBottom: 2 }}>TEAM A</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#3b82f6', lineHeight: 1 }}>{e.scoreA}</div>
                    </div>
                    <div style={{ fontSize: 16, color: C.muted, fontWeight: 700, flex: 1, textAlign: 'center' }}>–</div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 700, marginBottom: 2 }}>TEAM B</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#22c55e', lineHeight: 1 }}>{e.scoreB}</div>
                    </div>
                    <div style={{ flex: 2, fontSize: 12, color: C.sub }}>
                      {e.scoreA > e.scoreB ? '🏆 Team A won' : e.scoreB > e.scoreA ? '🏆 Team B won' : '🤝 Draw'}
                    </div>
                  </div>
                  {e.teamANames?.length > 0 && (
                    <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
                      <span style={{ color: '#3b82f6', fontWeight: 600 }}>A: </span>{e.teamANames.join(', ')}
                      <br />
                      <span style={{ color: '#22c55e', fontWeight: 600 }}>B: </span>{e.teamBNames?.join(', ')}
                    </div>
                  )}
                  {e.note && <p style={{ fontSize: 12, color: C.sub, marginTop: 6, fontStyle: 'italic' }}>"{e.note}"</p>}
                </div>
              )}

              {e.type === 'playerUpdate' && (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>
                    {e.playerName}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: e.reason ? 6 : 0 }}>
                    {(e.changes || []).map((ch, ci) => (
                      <span key={ci} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 20,
                        background: '#f1f5f9', color: C.sub }}>
                        {ch.field}: <strong style={{ color: '#ef4444' }}>{ch.from}</strong>
                        {' → '}
                        <strong style={{ color: C.accent }}>{ch.to}</strong>
                      </span>
                    ))}
                  </div>
                  {e.reason && <p style={{ fontSize: 12, color: C.sub, fontStyle: 'italic' }}>"{e.reason}"</p>}
                </div>
              )}

              {e.type === 'note' && (
                <p style={{ fontSize: 13, color: C.sub, lineHeight: 1.6 }}>{e.text}</p>
              )}

              <button onClick={() => saveHistory(history.filter(x => x.id !== e.id))}
                style={{ position: 'absolute', top: 8, right: 8, fontSize: 14, color: '#e2e8f0',
                  background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </Card>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Team Generation ─────────────────────────────────────────────────────────

function generateTeams(selected, players, rules) {
  const pool   = players.filter(p => selected.includes(p.id))
  const active = (rules || []).filter(r => r.active)
  const half   = Math.floor(pool.length / 2)

  const bad = (ta, tb) => {
    if (ta.some(a => ta.some(b => a.id !== b.id && (a.keepApart||[]).includes(b.id)))) return true
    if (tb.some(a => tb.some(b => a.id !== b.id && (a.keepApart||[]).includes(b.id)))) return true
    if (ta.some(a => (a.keepTogether||[]).some(id => tb.find(b => b.id === id)))) return true
    if (tb.some(a => (a.keepTogether||[]).some(id => ta.find(b => b.id === id)))) return true
    return active.some(r => {
      const aT1 = ta.find(p => p.id == r.playerA), bT1 = ta.find(p => p.id == r.playerB)
      const aT2 = tb.find(p => p.id == r.playerA), bT2 = tb.find(p => p.id == r.playerB)
      return r.type === 'together' ? (aT1 && bT2) || (aT2 && bT1) : (aT1 && bT1) || (aT2 && bT2)
    })
  }

  // Try strict position-based split first (ideal case)
  const gks  = pool.filter(p => p.position === 'GK')
  const defs = pool.filter(p => p.position === 'DEF')
  const mids = pool.filter(p => p.position === 'MID')
  const fwds = pool.filter(p => p.position === 'FWD')

  if (gks.length >= 2 && defs.length >= 6 && mids.length >= 4 && fwds.length >= 2) {
    let best = null, bestDiff = Infinity
    for (let i = 0; i < 500; i++) {
      const sd = shuffle(defs), sm = shuffle(mids), sf = shuffle(fwds), sg = shuffle(gks)
      const t1 = [sg[0], ...sd.slice(0,3), ...sm.slice(0,2), sf[0]]
      const t2 = [sg[1], ...sd.slice(3,6), ...sm.slice(2,4), sf[1]]
      if (bad(t1, t2)) continue
      const s1 = t1.reduce((s, p) => s + playerScore(p), 0)
      const s2 = t2.reduce((s, p) => s + playerScore(p), 0)
      const diff = Math.abs(s1 - s2)
      if (diff < bestDiff) { bestDiff = diff; best = { t1, t2, s1, s2 } }
    }
    if (best) return best
  }

  // Fallback: score-based split ignoring positions, still respecting rules
  let best = null, bestDiff = Infinity
  for (let i = 0; i < 800; i++) {
    const sp = shuffle(pool)
    const t1 = sp.slice(0, half)
    const t2 = sp.slice(half)
    if (bad(t1, t2)) continue
    const s1 = t1.reduce((s, p) => s + playerScore(p), 0)
    const s2 = t2.reduce((s, p) => s + playerScore(p), 0)
    const diff = Math.abs(s1 - s2)
    if (diff < bestDiff) { bestDiff = diff; best = { t1, t2, s1, s2, fallback: true } }
  }
  return best
}

// ─── Team Display ─────────────────────────────────────────────────────────────

function TeamDisplay({ team, label, score, color }) {
  const byPos = POSITIONS.reduce((acc, pos) => { acc[pos] = team.filter(p => p.position === pos); return acc }, {})
  return (
    <div style={{ flex: 1, minWidth: 260, background: C.card, borderRadius: 16,
      border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <div style={{ background: color, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>{label}</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Score {score.toFixed(1)}</span>
      </div>
      <div style={{ padding: '12px 16px' }}>
        {POSITIONS.map(pos => byPos[pos].length > 0 && (
          <div key={pos} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: POS_COLOR[pos],
              letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{pos}</div>
            {byPos[pos].map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 0', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{p.name}</span>
                {(p.secondaryPositions||[]).length > 0 && (
                  <div style={{ display: 'flex', gap: 3 }}>
                    {p.secondaryPositions.map(sp => <Badge key={sp} pos={sp} small />)}
                  </div>
                )}
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

function AICoach({ players, rules, history, onPlayersUpdate, onRulesUpdate, onHistoryUpdate }) {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: "Hey coach! 👋 Tell me what happened in today's game, ask me to update player stats, create team rules, or anything about the squad."
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const applyActions = (actions, curPlayers, curRules, curHistory, aiMessage) => {
    let p = [...curPlayers], r = [...curRules], h = [...curHistory]
    const log = []

    for (const a of actions || []) {
      if (a.type === 'updatePlayer') {
        const old = p.find(x => x.id == a.playerId)
        if (old) {
          const changes = Object.entries(a.changes).map(([field, to]) => ({
            field, from: old[field], to
          })).filter(ch => ch.from !== ch.to)

          p = p.map(x => x.id == a.playerId ? { ...x, ...a.changes } : x)
          log.push(`Updated ${old.name}`)

          if (changes.length > 0) {
            h = [{
              id: Date.now() + Math.random(),
              type: 'playerUpdate',
              timestamp: Date.now(),
              playerId: a.playerId,
              playerName: old.name,
              changes,
              reason: aiMessage,
            }, ...h]
          }
        }
      } else if (a.type === 'addRule') {
        const pA = p.find(x => x.id == a.playerAId), pB = p.find(x => x.id == a.playerBId)
        if (pA && pB) {
          r = [...r, { id: Date.now() + Math.random(), active: true, type: a.ruleType,
            playerA: a.playerAId, playerB: a.playerBId,
            label: a.label || `${pA.name} ${a.ruleType === 'together' ? '+' : '≠'} ${pB.name}` }]
          log.push('Added rule')
        }
      } else if (a.type === 'toggleRule') {
        r = r.map(x => x.id == a.ruleId ? { ...x, active: !x.active } : x)
        log.push('Toggled rule')
      } else if (a.type === 'deleteRule') {
        r = r.filter(x => x.id != a.ruleId)
        log.push('Deleted rule')
      }
    }

    if (JSON.stringify(p) !== JSON.stringify(curPlayers)) onPlayersUpdate(p)
    if (JSON.stringify(r) !== JSON.stringify(curRules)) onRulesUpdate(r)
    if (JSON.stringify(h) !== JSON.stringify(curHistory)) onHistoryUpdate(h)
    return log
  }

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    const next = [...messages, { role: 'user', content: userMsg }]
    setMessages(next)
    setLoading(true)
    const hist = next.slice(1, -1).map(m => ({ role: m.role, content: m.content }))
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, players, rules, history: hist })
      })
      const data = await res.json()
      const log = applyActions(data.actions, players, rules, history, data.message)
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
    "Suggest improvements for next week",
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
              boxShadow: '0 1px 2px rgba(0,0,0,0.06)', whiteSpace: 'pre-wrap'
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, marginRight: 8 }}>⚽</div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
              borderBottomLeftRadius: 4, padding: '10px 16px', fontSize: 14, color: C.muted }}>
              Thinking...
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
                background: C.card, color: C.sub, border: `1px solid ${C.border}`, fontWeight: 500 }}>
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
          style={{ padding: '11px 20px', borderRadius: 12, fontSize: 16, fontWeight: 700,
            background: input.trim() && !loading ? C.accent : C.border,
            color: input.trim() && !loading ? '#fff' : C.muted, border: 'none' }}>
          ↑
        </button>
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab]           = useState('pool')
  const [players, setPlayers]   = useState([])
  const [rules, setRules]       = useState([])
  const [history, setHistory]   = useState([])
  const [selected, setSelected] = useState([])
  const [teams, setTeams]       = useState(null)
  const [error, setError]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [loaded, setLoaded]     = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const [ps, rs, hs] = await Promise.all([
          getDoc(doc(db, 'shared', 'players')),
          getDoc(doc(db, 'shared', 'rules')),
          getDoc(doc(db, 'shared', 'history')),
        ])
        if (ps.exists()) setPlayers(ps.data().list || [])
        if (rs.exists()) setRules(rs.data().list || [])
        if (hs.exists()) setHistory(hs.data().entries || [])
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
  const saveHistory = async updated => {
    setHistory(updated); setSaving(true)
    try { await setDoc(doc(db, 'shared', 'history'), { entries: updated }) } catch {}
    setSaving(false)
  }

  const addPlayer    = () => savePlayers([...players, defaultPlayer()])
  const updatePlayer = p  => savePlayers(players.map(x => x.id === p.id ? p : x))
  const deletePlayer = id => {
    setSelected(s => s.filter(x => x !== id))
    savePlayers(players.filter(x => x.id !== id).map(x => ({
      ...x,
      keepApart:    (x.keepApart||[]).filter(k => k !== id),
      keepTogether: (x.keepTogether||[]).filter(k => k !== id),
    })))
  }

  const selCounts = POSITIONS.reduce((acc, pos) => {
    acc[pos] = selected.filter(id => players.find(p => p.id === id)?.position === pos).length
    return acc
  }, {})

  const totalNeeded = Object.values(FORMATION).reduce((a, b) => a + b, 0)

  const toggleSelect = id => {
    if (selected.includes(id)) { setSelected(s => s.filter(x => x !== id)); setError(''); return }
    if (selected.length >= totalNeeded) { setError(`Max ${totalNeeded} players allowed.`); return }
    setError(''); setSelected(s => [...s, id])
  }

  const readyToGenerate = selected.length === totalNeeded
  const activeRules = rules.filter(r => r.active)

  const generate = () => {
    const result = generateTeams(selected, players, rules)
    if (!result) setError('Could not split teams — too many conflicting rules. Try toggling some off.')
    else {
      setTeams(result)
      setError(result.fallback ? 'Teams split by score (not enough players per position for formation-based split).' : '')
      setTab('teams')
    }
  }

  const TABS = [
    { id: 'pool',    label: 'Squad' },
    { id: 'rules',   label: `Rules${activeRules.length ? ` · ${activeRules.length}` : ''}` },
    { id: 'session', label: 'Session' },
    { id: 'teams',   label: 'Teams' },
    { id: 'history', label: `History${history.length ? ` · ${history.length}` : ''}` },
    { id: 'ai',      label: '✦ AI' },
  ]

  if (!loaded) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.header }}>
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
        position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>⚽</span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: -0.3 }}>Pape Spor Squad</div>
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
            style={{ padding: '14px 14px', fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? C.accent : C.muted, background: 'none', border: 'none',
              borderBottom: `2.5px solid ${tab === t.id ? C.accent : 'transparent'}`,
              whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 60px' }}>

        {tab === 'pool' && (
          <div>
            <p style={{ fontSize: 13, color: C.sub, marginBottom: 16, lineHeight: 1.6 }}>
              Shared roster — edits save instantly for everyone.
            </p>
            {players.length === 0 && (
              <Card style={{ padding: '48px 20px', textAlign: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>No players yet</div>
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

        {tab === 'rules' && <RulesTab rules={rules} players={players} saveRules={saveRules} />}

        {tab === 'session' && (
          <div>
            <p style={{ fontSize: 13, color: C.sub, marginBottom: 14, lineHeight: 1.6 }}>
              Pick 14 players for today's game. Formation counters are a guide — no position limits enforced.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
              {POSITIONS.map(pos => {
                const done = selCounts[pos] === FORMATION[pos]
                return (
                  <Card key={pos} style={{ padding: '10px 8px', textAlign: 'center',
                    borderColor: done ? POS_COLOR[pos] : C.border, background: done ? POS_BG[pos] : C.card }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: POS_COLOR[pos], letterSpacing: 1, marginBottom: 4 }}>{pos}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: done ? POS_COLOR[pos] : C.text, lineHeight: 1 }}>
                      {selCounts[pos]}<span style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>/{FORMATION[pos]}</span>
                    </div>
                  </Card>
                )
              })}
            </div>
            {activeRules.length > 0 && (
              <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10,
                padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#92400e', display: 'flex', gap: 8 }}>
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
                    <span style={{ fontSize: 12, fontWeight: 700, color: POS_COLOR[pos] }}>{pos}</span>
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
                padding: '10px 14px', fontSize: 13, color: '#dc2626', marginTop: 8 }}>{error}</div>
            )}
            <button onClick={generate} disabled={!readyToGenerate}
              style={{ width: '100%', marginTop: 16, padding: 14, fontSize: 16, fontWeight: 700,
                borderRadius: 14, border: 'none', background: readyToGenerate ? C.accent : C.border,
                color: readyToGenerate ? '#fff' : C.muted, cursor: readyToGenerate ? 'pointer' : 'not-allowed',
                boxShadow: readyToGenerate ? '0 4px 14px rgba(34,197,94,0.35)' : 'none' }}>
              {readyToGenerate ? 'Generate Teams' : `Select ${totalNeeded - selected.length} more player${totalNeeded - selected.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}

        {tab === 'teams' && (
          <div>
            {!teams ? (
              <Card style={{ padding: '48px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>No teams yet</div>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Go to Session to select players</div>
                <Btn variant="primary" onClick={() => setTab('session')}>Go to Session</Btn>
              </Card>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                  <TeamDisplay team={teams.t1} label="Team A" score={teams.s1} color="#3b82f6" />
                  <TeamDisplay team={teams.t2} label="Team B" score={teams.s2} color="#22c55e" />
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <Btn style={{ flex: 1 }} onClick={() => setTeams(generateTeams(selected, players, rules))}>Regenerate</Btn>
                  <Btn style={{ flex: 1 }} onClick={() => setTab('session')}>Change players</Btn>
                </div>
                <button onClick={() => setTab('history')}
                  style={{ width: '100%', padding: '10px 14px', background: '#fef3c7',
                    border: '1px solid #fde68a', borderRadius: 10, fontSize: 12, color: '#92400e',
                    fontWeight: 600, cursor: 'pointer' }}>
                  ⚽ After the game → log the score in History
                </button>
              </>
            )}
          </div>
        )}

        {tab === 'history' && (
          <HistoryTab history={history} players={players} teams={teams} saveHistory={saveHistory} />
        )}

        {tab === 'ai' && (
          <AICoach players={players} rules={rules} history={history}
            onPlayersUpdate={savePlayers} onRulesUpdate={saveRules} onHistoryUpdate={saveHistory} />
        )}
      </div>
    </div>
  )
}
