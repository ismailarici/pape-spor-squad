import { useState, useEffect } from 'react'
import { db } from './firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

const POSITIONS = ['GK', 'DEF', 'MID', 'FWD']
const ATTRS = ['Pace', 'Shooting', 'Defending', 'Passing']
const FORMATION = { GK: 2, DEF: 6, MID: 4, FWD: 2 }
const posColor = { GK: '#e8a838', DEF: '#3a8fd4', MID: '#5bb85b', FWD: '#d45a5a' }
const posLight = { GK: '#fff8ec', DEF: '#e8f3fc', MID: '#eaf6ea', FWD: '#fceaea' }

const defaultPlayer = () => ({
  id: Date.now() + Math.random(),
  name: '', position: 'MID', stars: 3,
  pace: 5, shooting: 5, defending: 5, passing: 5, keepApart: []
})

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
      <span style={{ fontSize: 12, fontWeight: 500, width: 16, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function PlayerCard({ player, allPlayers, onUpdate, onDelete, compact, selected, onToggle }) {
  const [expanded, setExpanded] = useState(false)
  const p = player

  const toggleApart = (id) => {
    const ka = p.keepApart.includes(id)
      ? p.keepApart.filter(x => x !== id)
      : [...p.keepApart, id]
    onUpdate({ ...p, keepApart: ka })
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
      <Stars value={p.stars} />
    </div>
  )

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <input value={p.name} onChange={e => onUpdate({ ...p, name: e.target.value })}
            placeholder="Player name"
            style={{ width: '100%', marginBottom: 8, fontSize: 14, padding: '6px 10px',
              border: '1px solid #e5e7eb', borderRadius: 8, outline: 'none' }} />
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
      {expanded && (
        <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12, marginTop: 8 }}>
          {ATTRS.map(attr => (
            <Slider key={attr} label={attr} value={p[attr.toLowerCase()]}
              onChange={v => onUpdate({ ...p, [attr.toLowerCase()]: v })} />
          ))}
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Keep apart from:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {allPlayers.filter(q => q.id !== p.id && q.name).map(q => (
                <button key={q.id} onClick={() => toggleApart(q.id)}
                  style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, cursor: 'pointer',
                    background: p.keepApart.includes(q.id) ? '#fceaea' : 'transparent',
                    color: p.keepApart.includes(q.id) ? '#d45a5a' : '#888',
                    border: `1px solid ${p.keepApart.includes(q.id) ? '#d45a5a' : '#e5e7eb'}` }}>
                  {q.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function playerScore(p) {
  const attrAvg = (p.pace + p.shooting + p.defending + p.passing) / 4
  return p.stars * 0.6 + (attrAvg / 10) * 5 * 0.4
}

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

function generateTeams(selected, players) {
  const pool = players.filter(p => selected.includes(p.id))
  const gks = pool.filter(p => p.position === 'GK')
  const defs = pool.filter(p => p.position === 'DEF')
  const mids = pool.filter(p => p.position === 'MID')
  const fwds = pool.filter(p => p.position === 'FWD')

  if (gks.length < 2 || defs.length < 6 || mids.length < 4 || fwds.length < 2) return null

  let best = null, bestDiff = Infinity

  for (let i = 0; i < 300; i++) {
    const sd = shuffle(defs), sm = shuffle(mids), sf = shuffle(fwds)
    const t1 = [gks[0], ...sd.slice(0,3), ...sm.slice(0,2), sf[0]]
    const t2 = [gks[1], ...sd.slice(3,6), ...sm.slice(2,4), sf[1]]
    const violates = (t) => t.some(a => t.some(b => a.id !== b.id && (a.keepApart||[]).includes(b.id)))
    if (violates(t1) || violates(t2)) continue
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
              <Stars value={p.stars} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

const FIRESTORE_DOC = 'shared/players'

export default function App() {
  const [tab, setTab] = useState('pool')
  const [players, setPlayers] = useState([])
  const [selected, setSelected] = useState([])
  const [teams, setTeams] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'shared', 'players'))
        if (snap.exists()) setPlayers(snap.data().list || [])
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

  const addPlayer = () => savePlayers([...players, defaultPlayer()])
  const updatePlayer = (p) => savePlayers(players.map(x => x.id === p.id ? p : x))
  const deletePlayer = (id) => {
    setSelected(s => s.filter(x => x !== id))
    savePlayers(players.filter(x => x.id !== id).map(x => ({ ...x, keepApart: (x.keepApart||[]).filter(k => k !== id) })))
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
    const result = generateTeams(selected, players)
    if (!result) setError('Could not balance teams with keep-apart rules. Try relaxing some constraints.')
    else { setTeams(result); setError(''); setTab('teams') }
  }

  const tabStyle = (t) => ({
    padding: '8px 20px', fontSize: 14, cursor: 'pointer', borderRadius: 8,
    background: tab === t ? '#f3f4f6' : 'transparent',
    border: tab === t ? '1px solid #e5e7eb' : '1px solid transparent',
    color: tab === t ? '#111' : '#888', fontWeight: tab === t ? 500 : 400
  })

  if (!loaded) return <div style={{ padding: '2rem', color: '#888', fontSize: 14 }}>Loading player pool...</div>

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '1.5rem', maxWidth: 680, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>⚽ Pape Spor Squad</h2>
        <span style={{ fontSize: 12, color: '#888' }}>
          {players.length} players {saving ? '· saving...' : ''}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 24, background: '#f9fafb',
        padding: 4, borderRadius: 10, width: 'fit-content' }}>
        {['pool', 'session', 'teams'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={tabStyle(t)}>
            {t === 'pool' ? 'Player pool' : t === 'session' ? 'Weekly session' : 'Teams'}
          </button>
        ))}
      </div>

      {tab === 'pool' && (
        <div>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
            Shared roster — changes save instantly for everyone. Set position, star rating, and attributes per player.
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

      {tab === 'session' && (
        <div>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
            Select 2 GK · 6 DEF · 4 MID · 2 FWD for today's game.
          </p>
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
                  <button onClick={() => setTeams(generateTeams(selected, players))}
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
