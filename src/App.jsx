import { useState, useEffect } from 'react'
import { db } from './firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

const POSITIONS = ['GK', 'DEF', 'MID', 'FWD']
const FORMATION = { GK: 2, DEF: 6, MID: 4, FWD: 2 }
const posColor = { GK: '#e8a838', DEF: '#3a8fd4', MID: '#5bb85b', FWD: '#d45a5a' }
const posLight = { GK: '#fff8ec', DEF: '#e8f3fc', MID: '#eaf6ea', FWD: '#fceaea' }

const STATS = ['Pace', 'Shooting', 'Passing', 'Dribbling', 'Defending', 'Physical']
const QUALITIES = ['Aggression', 'Leadership', 'Team Player', 'Work Rate']
const LEVELS = ['Low', 'Med', 'High']
const levelColor = { Low: '#aaa', Med: '#3a8fd4', High: '#e8a838' }

const defaultPlayer = () => ({
  id: Date.now() + Math.random(),
  name: '', position: 'MID', stars: 3, age: 25,
  pace: 5, shooting: 5, passing: 5, dribbling: 5, defending: 5, physical: 5,
  aggression: 'Med', leadership: 'Med', teamPlayer: 'Med', workRate: 'Med',
  keepApart: [], keepTogether: []
})

const defaultRule = () => ({
  id: Date.now() + Math.random(),
  label: '',
  playerA: null,
  playerB: null,
  type: 'together',
  active: true
})

const qualityKey = q => q === 'Team Player' ? 'teamPlayer' : q === 'Work Rate' ? 'workRate' : q.toLowerCase()

function Stars({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map(s => (
        <span key={s} onClick={() => onChange && onChange(s)}
          style={{ cursor: onChange ? 'pointer' : 'default', fontSize: 16,
            color: s <= value ? '#e8a838' : '#ccc' }}>★</span>
      ))}
    </div>
  )
}

function Slider({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <span style={{ fontSize: 12, color: '#666', width: 72 }}>{label}</span>
      <input type="range" min={1} max={10} step={1} value={value}
        onChange={e => onChange(+e.target.value)} style={{ flex: 1 }} />
      <span style={{ fontSize: 12, fontWeight: 600, width: 16, textAlign: 'right',
        color: value >= 8 ? '#5bb85b' : value <= 3 ? '#d45a5a' : '#555' }}>{value}</span>
    </div>
  )
}

function QualityToggle({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 12, color: '#666', width: 80 }}>{label}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {LEVELS.map(l => (
          <button key={l} onClick={() => onChange(l)}
            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, cursor: 'pointer',
              background: value === l ? levelColor[l] : 'transparent',
              color: value === l ? '#fff' : '#aaa',
              border: `1px solid ${value === l ? levelColor[l] : '#e5e7eb'}`,
              fontWeight: value === l ? 600 : 400 }}>
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}

function StatBar({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
      <span style={{ fontSize: 10, color: '#999', width: 58 }}>{label}</span>
      <div style={{ flex: 1, height: 5, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${value * 10}%`, height: '100%', borderRadius: 3,
          background: value >= 8 ? '#5bb85b' : value >= 5 ? '#3a8fd4' : '#d45a5a' }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 600, color: '#666', width: 14 }}>{value}</span>
    </div>
  )
}

function PlayerCard({ player, allPlayers, onUpdate, onDelete, compact, selected, onToggle }) {
  const [expanded, setExpanded] = useState(false)
  const p = player

  const toggleRelation = (id, field) => {
    const list = p[field] || []
    onUpdate({ ...p, [field]: list.includes(id) ? list.filter(x => x !== id) : [...list, id] })
  }

  if (compact) return (
    <div onClick={onToggle} style={{
      background: '#fff', border: selected ? `2px solid ${posColor[p.position]}` : '1px solid #e5e7eb',
      borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer'
    }}>
      <div style={{ background: posLight[p.position], color: posColor[p.position],
        borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 500, minWidth: 32, textAlign: 'center' }}>
        {p.position}
      </div>
      <span style={{ flex: 1, fontWeight: 500, fontSize: 14 }}>{p.name || 'Unnamed'}</span>
      {p.age && <span style={{ fontSize: 11, color: '#aaa' }}>{p.age}y</span>}
      <Stars value={p.stars} />
    </div>
  )

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input value={p.name} onChange={e => onUpdate({ ...p, name: e.target.value })}
              placeholder="Player name"
              style={{ flex: 1, fontSize: 14, padding: '6px 10px',
                border: '1px solid #e5e7eb', borderRadius: 8, outline: 'none' }} />
            <input type="number" value={p.age} min={15} max={50}
              onChange={e => onUpdate({ ...p, age: +e.target.value })}
              placeholder="Age"
              style={{ width: 60, fontSize: 14, padding: '6px 8px', textAlign: 'center',
                border: '1px solid #e5e7eb', borderRadius: 8, outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {POSITIONS.map(pos => (
              <button key={pos} onClick={() => onUpdate({ ...p, position: pos })}
                style={{ padding: '3px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
                  background: p.position === pos ? posLight[pos] : 'transparent',
                  color: p.position === pos ? posColor[pos] : '#888',
                  border: `1px solid ${p.position === pos ? posColor[pos] : '#e5e7eb'}`,
                  fontWeight: p.position === pos ? 500 : 400 }}>
                {pos}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: '#888' }}>Overall</span>
            <Stars value={p.stars} onChange={v => onUpdate({ ...p, stars: v })} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          <button onClick={onDelete}
            style={{ fontSize: 12, color: '#aaa', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          <button onClick={() => setExpanded(!expanded)}
            style={{ fontSize: 11, color: '#888', background: 'none', border: '1px solid #e5e7eb',
              borderRadius: 6, cursor: 'pointer', padding: '3px 8px', marginTop: 4 }}>
            {expanded ? 'less' : 'more'}
          </button>
        </div>
      </div>

      {!expanded && (
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
          {STATS.map(s => <StatBar key={s} label={s} value={p[s.toLowerCase()] ?? 5} />)}
        </div>
      )}

      {expanded && (
        <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12, marginTop: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Stats</p>
          {STATS.map(s => (
            <Slider key={s} label={s} value={p[s.toLowerCase()] ?? 5}
              onChange={v => onUpdate({ ...p, [s.toLowerCase()]: v })} />
          ))}
          <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', margin: '12px 0 8px', textTransform: 'uppercase', letterSpacing: 1 }}>Qualities</p>
          {QUALITIES.map(q => (
            <QualityToggle key={q} label={q} value={p[qualityKey(q)] || 'Med'}
              onChange={v => onUpdate({ ...p, [qualityKey(q)]: v })} />
          ))}
          <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', margin: '12px 0 6px', textTransform: 'uppercase', letterSpacing: 1 }}>Keep apart from</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {allPlayers.filter(q => q.id !== p.id && q.name).map(q => (
              <button key={q.id} onClick={() => toggleRelation(q.id, 'keepApart')}
                style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, cursor: 'pointer',
                  background: (p.keepApart||[]).includes(q.id) ? '#fceaea' : 'transparent',
                  color: (p.keepApart||[]).includes(q.id) ? '#d45a5a' : '#888',
                  border: `1px solid ${(p.keepApart||[]).includes(q.id) ? '#d45a5a' : '#e5e7eb'}` }}>
                {q.name}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: 1 }}>Gets along well with</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {allPlayers.filter(q => q.id !== p.id && q.name).map(q => (
              <button key={q.id} onClick={() => toggleRelation(q.id, 'keepTogether')}
                style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, cursor: 'pointer',
                  background: (p.keepTogether||[]).includes(q.id) ? '#eaf6ea' : 'transparent',
                  color: (p.keepTogether||[]).includes(q.id) ? '#5bb85b' : '#888',
                  border: `1px solid ${(p.keepTogether||[]).includes(q.id) ? '#5bb85b' : '#e5e7eb'}` }}>
                {q.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function RulesTab({ rules, setRules, players, saveRules }) {
  const [draft, setDraft] = useState(null)

  const namedPlayers = players.filter(p => p.name)

  const addRule = () => setDraft(defaultRule())

  const saveDraft = () => {
    if (!draft.playerA || !draft.playerB || draft.playerA === draft.playerB) return
    const pA = players.find(p => p.id === draft.playerA)
    const pB = players.find(p => p.id === draft.playerB)
    const autoLabel = draft.label || `${pA?.name} ${draft.type === 'together' ? '+' : '≠'} ${pB?.name}`
    const newRule = { ...draft, label: autoLabel }
    const updated = [...rules, newRule]
    saveRules(updated)
    setDraft(null)
  }

  const toggleRule = (id) => {
    const updated = rules.map(r => r.id === id ? { ...r, active: !r.active } : r)
    saveRules(updated)
  }

  const deleteRule = (id) => saveRules(rules.filter(r => r.id !== id))

  return (
    <div>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
        Named constraints applied during team generation. Toggle on/off per session.
      </p>

      {rules.length === 0 && !draft && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#bbb', fontSize: 14 }}>
          No rules yet. Add one below.
        </div>
      )}

      {rules.map(r => {
        const pA = players.find(p => p.id === r.playerA)
        const pB = players.find(p => p.id === r.playerB)
        return (
          <div key={r.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
            padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: r.active ? '#111' : '#aaa' }}>{r.label}</div>
              <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>
                <span style={{ color: r.type === 'together' ? '#5bb85b' : '#d45a5a', fontWeight: 500 }}>
                  {r.type === 'together' ? 'Same team' : 'Different teams'}
                </span>
                {' · '}{pA?.name} & {pB?.name}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => toggleRule(r.id)}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
                  background: r.active ? '#eaf6ea' : '#f3f4f6',
                  color: r.active ? '#5bb85b' : '#aaa',
                  border: `1px solid ${r.active ? '#5bb85b' : '#e5e7eb'}`,
                  fontWeight: 500 }}>
                {r.active ? 'On' : 'Off'}
              </button>
              <button onClick={() => deleteRule(r.id)}
                style={{ fontSize: 12, color: '#ccc', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
          </div>
        )
      })}

      {draft && (
        <div style={{ background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 12, padding: '14px 16px', marginBottom: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#aaa', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>New rule</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <select value={draft.playerA || ''} onChange={e => setDraft({ ...draft, playerA: e.target.value })}
              style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, background: '#fff' }}>
              <option value=''>Player A</option>
              {namedPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value })}
              style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, background: '#fff' }}>
              <option value='together'>Same team</option>
              <option value='apart'>Different teams</option>
            </select>
            <select value={draft.playerB || ''} onChange={e => setDraft({ ...draft, playerB: e.target.value })}
              style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, background: '#fff' }}>
              <option value=''>Player B</option>
              {namedPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <input value={draft.label} onChange={e => setDraft({ ...draft, label: e.target.value })}
            placeholder="Label (optional — auto-generated if blank)"
            style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #e5e7eb',
              fontSize: 13, marginBottom: 10, boxSizing: 'border-box', background: '#fff' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={saveDraft}
              style={{ flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                background: '#3a8fd4', color: '#fff', border: 'none', fontWeight: 500 }}>
              Save rule
            </button>
            <button onClick={() => setDraft(null)}
              style={{ padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                background: 'transparent', color: '#888', border: '1px solid #e5e7eb' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {!draft && (
        <button onClick={addRule} style={{ width: '100%', padding: 10, fontSize: 14,
          borderRadius: 10, cursor: 'pointer', marginTop: 4, border: '1px dashed #d1d5db',
          background: 'transparent', color: '#888' }}>
          + Add rule
        </button>
      )}
    </div>
  )
}

function playerScore(p) {
  const statAvg = (p.pace + p.shooting + p.passing + p.dribbling + p.defending + p.physical) / 6
  return p.stars * 0.6 + (statAvg / 10) * 5 * 0.4
}

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

function generateTeams(selected, players, rules) {
  const pool = players.filter(p => selected.includes(p.id))
  const gks = pool.filter(p => p.position === 'GK')
  const defs = pool.filter(p => p.position === 'DEF')
  const mids = pool.filter(p => p.position === 'MID')
  const fwds = pool.filter(p => p.position === 'FWD')

  if (gks.length < 2 || defs.length < 6 || mids.length < 4 || fwds.length < 2) return null

  const activeRules = (rules || []).filter(r => r.active)

  let best = null, bestDiff = Infinity

  for (let i = 0; i < 500; i++) {
    const sd = shuffle(defs), sm = shuffle(mids), sf = shuffle(fwds)
    const t1 = [gks[0], ...sd.slice(0,3), ...sm.slice(0,2), sf[0]]
    const t2 = [gks[1], ...sd.slice(3,6), ...sm.slice(2,4), sf[1]]

    const violates = (ta, tb) => {
      // Player-level keepApart
      const apartViolation = ta.some(a => ta.some(b => a.id !== b.id && (a.keepApart||[]).includes(b.id)))
        || tb.some(a => tb.some(b => a.id !== b.id && (a.keepApart||[]).includes(b.id)))
      // Player-level keepTogether (must be on same team)
      const togetherViolation = ta.some(a => (a.keepTogether||[]).some(id => tb.find(b => b.id === id)))
        || tb.some(a => (a.keepTogether||[]).some(id => ta.find(b => b.id === id)))

      // Named rules
      const ruleViolation = activeRules.some(r => {
        const aInT1 = ta.find(p => p.id === r.playerA)
        const bInT1 = ta.find(p => p.id === r.playerB)
        const aInT2 = tb.find(p => p.id === r.playerA)
        const bInT2 = tb.find(p => p.id === r.playerB)
        if (r.type === 'together') {
          // Both must be in same team
          return (aInT1 && bInT2) || (aInT2 && bInT1)
        } else {
          // Must be on different teams
          return (aInT1 && bInT1) || (aInT2 && bInT2)
        }
      })

      return apartViolation || togetherViolation || ruleViolation
    }

    if (violates(t1, t2)) continue
    const s1 = t1.reduce((s, p) => s + playerScore(p), 0)
    const s2 = t2.reduce((s, p) => s + playerScore(p), 0)
    const diff = Math.abs(s1 - s2)
    if (diff < bestDiff) { bestDiff = diff; best = { t1, t2, s1, s2 } }
  }
  return best
}

function TeamDisplay({ team, label, score, color }) {
  const byPos = POSITIONS.reduce((acc, pos) => { acc[pos] = team.filter(p => p.position === pos); return acc }, {})
  return (
    <div style={{ flex: 1, background: '#fff', border: `2px solid ${color}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{label}</span>
        <span style={{ fontSize: 12, color: '#888' }}>Score: <strong>{score.toFixed(1)}</strong></span>
      </div>
      {POSITIONS.map(pos => byPos[pos].length > 0 && (
        <div key={pos} style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: posColor[pos], marginBottom: 4, display: 'block' }}>{pos}</span>
          {byPos[pos].map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
              borderBottom: '1px solid #f3f4f6' }}>
              <span style={{ flex: 1, fontSize: 14 }}>{p.name}</span>
              {p.age && <span style={{ fontSize: 11, color: '#bbb' }}>{p.age}</span>}
              <Stars value={p.stars} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState('pool')
  const [players, setPlayers] = useState([])
  const [rules, setRules] = useState([])
  const [selected, setSelected] = useState([])
  const [teams, setTeams] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const [pSnap, rSnap] = await Promise.all([
          getDoc(doc(db, 'shared', 'players')),
          getDoc(doc(db, 'shared', 'rules'))
        ])
        if (pSnap.exists()) setPlayers(pSnap.data().list || [])
        if (rSnap.exists()) setRules(rSnap.data().list || [])
      } catch (e) { console.error('Load error', e) }
      setLoaded(true)
    })()
  }, [])

  const savePlayers = async (updated) => {
    setPlayers(updated)
    setSaving(true)
    try { await setDoc(doc(db, 'shared', 'players'), { list: updated }) }
    catch (e) { console.error('Save error', e) }
    setSaving(false)
  }

  const saveRules = async (updated) => {
    setRules(updated)
    setSaving(true)
    try { await setDoc(doc(db, 'shared', 'rules'), { list: updated }) }
    catch (e) { console.error('Save error', e) }
    setSaving(false)
  }

  const addPlayer = () => savePlayers([...players, defaultPlayer()])
  const updatePlayer = (p) => savePlayers(players.map(x => x.id === p.id ? p : x))
  const deletePlayer = (id) => {
    setSelected(s => s.filter(x => x !== id))
    savePlayers(players.filter(x => x.id !== id).map(x => ({
      ...x,
      keepApart: (x.keepApart||[]).filter(k => k !== id),
      keepTogether: (x.keepTogether||[]).filter(k => k !== id)
    })))
  }

  const selCounts = POSITIONS.reduce((acc, pos) => {
    acc[pos] = selected.filter(id => players.find(p => p.id === id)?.position === pos).length
    return acc
  }, {})

  const toggleSelect = (id) => {
    const p = players.find(x => x.id === id)
    if (!p) return
    if (selected.includes(id)) { setSelected(s => s.filter(x => x !== id)); setError(''); return }
    if (selCounts[p.position] >= FORMATION[p.position]) {
      setError(`Max ${FORMATION[p.position]} ${p.position}s allowed.`); return
    }
    setError('')
    setSelected(s => [...s, id])
  }

  const readyToGenerate = POSITIONS.every(pos => selCounts[pos] === FORMATION[pos])

  const generate = () => {
    const result = generateTeams(selected, players, rules)
    if (!result) setError('Could not balance teams with current constraints. Try toggling some rules off.')
    else { setTeams(result); setError(''); setTab('teams') }
  }

  const activeRules = rules.filter(r => r.active)

  const tabStyle = (t) => ({
    padding: '8px 20px', fontSize: 14, cursor: 'pointer', borderRadius: 8,
    background: tab === t ? '#f3f4f6' : 'transparent',
    border: tab === t ? '1px solid #e5e7eb' : '1px solid transparent',
    color: tab === t ? '#111' : '#888', fontWeight: tab === t ? 500 : 400,
    position: 'relative'
  })

  if (!loaded) return <div style={{ padding: '2rem', color: '#888', fontSize: 14 }}>Loading player pool...</div>

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '1.5rem', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>⚽ Pape Spor Squad</h2>
        <span style={{ fontSize: 12, color: '#888' }}>
          {players.length} players {saving ? '· saving...' : ''}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 24, background: '#f9fafb',
        padding: 4, borderRadius: 10, width: 'fit-content' }}>
        {['pool', 'rules', 'session', 'teams'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={tabStyle(t)}>
            {t === 'pool' ? 'Player pool'
              : t === 'rules' ? `Rules${activeRules.length ? ` (${activeRules.length})` : ''}`
              : t === 'session' ? 'Weekly session'
              : 'Teams'}
          </button>
        ))}
      </div>

      {tab === 'pool' && (
        <div>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
            Shared roster — changes save instantly for everyone.
          </p>
          {players.map(p => (
            <PlayerCard key={p.id} player={p} allPlayers={players}
              onUpdate={updatePlayer} onDelete={() => deletePlayer(p.id)} />
          ))}
          <button onClick={addPlayer} style={{ width: '100%', padding: 10, fontSize: 14,
            borderRadius: 10, cursor: 'pointer', marginTop: 4, border: '1px dashed #d1d5db',
            background: 'transparent', color: '#888' }}>
            + Add player
          </button>
        </div>
      )}

      {tab === 'rules' && (
        <RulesTab rules={rules} setRules={setRules} players={players} saveRules={saveRules} />
      )}

      {tab === 'session' && (
        <div>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
            Select 2 GK · 6 DEF · 4 MID · 2 FWD for today's game.
          </p>
          {activeRules.length > 0 && (
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px', marginBottom: 14,
              fontSize: 12, color: '#888' }}>
              {activeRules.length} rule{activeRules.length > 1 ? 's' : ''} active —{' '}
              {activeRules.map(r => r.label).join(', ')}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
            {POSITIONS.map(pos => (
              <div key={pos} style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: posColor[pos], fontWeight: 600, marginBottom: 2 }}>{pos}</div>
                <div style={{ fontSize: 20, fontWeight: 600,
                  color: selCounts[pos] === FORMATION[pos] ? posColor[pos] : '#111' }}>
                  {selCounts[pos]}<span style={{ fontSize: 13, color: '#aaa', fontWeight: 400 }}>/{FORMATION[pos]}</span>
                </div>
              </div>
            ))}
          </div>
          {POSITIONS.map(pos => {
            const group = players.filter(p => p.position === pos)
            if (!group.length) return null
            return (
              <div key={pos} style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: posColor[pos], marginBottom: 6 }}>{pos}</p>
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
          {error && <p style={{ fontSize: 13, color: '#d45a5a', marginTop: 8 }}>{error}</p>}
          <button onClick={generate} disabled={!readyToGenerate}
            style={{ width: '100%', marginTop: 16, padding: 12, fontSize: 15, fontWeight: 500,
              borderRadius: 10, cursor: readyToGenerate ? 'pointer' : 'not-allowed',
              background: readyToGenerate ? '#3a8fd4' : '#f3f4f6',
              color: readyToGenerate ? '#fff' : '#aaa', border: 'none' }}>
            Generate teams
          </button>
        </div>
      )}

      {tab === 'teams' && (
        <div>
          {!teams
            ? <p style={{ fontSize: 13, color: '#888' }}>No teams generated yet. Go to Weekly session to pick players.</p>
            : <>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <TeamDisplay team={teams.t1} label="Team A" score={teams.s1} color="#3a8fd4" />
                  <TeamDisplay team={teams.t2} label="Team B" score={teams.s2} color="#5bb85b" />
                </div>
                <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                  <button onClick={() => setTeams(generateTeams(selected, players, rules))}
                    style={{ flex: 1, padding: 10, fontSize: 14, borderRadius: 10, cursor: 'pointer',
                      border: '1px solid #e5e7eb', background: 'transparent', color: '#111' }}>
                    Regenerate
                  </button>
                  <button onClick={() => setTab('session')}
                    style={{ flex: 1, padding: 10, fontSize: 14, borderRadius: 10, cursor: 'pointer',
                      border: '1px solid #e5e7eb', background: 'transparent', color: '#111' }}>
                    Change players
                  </button>
                </div>
              </>
          }
        </div>
      )}
    </div>
  )
}
