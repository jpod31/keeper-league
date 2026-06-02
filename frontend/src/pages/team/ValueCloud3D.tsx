import { useState, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Line, Html } from '@react-three/drei'

export interface CloudPlayer {
  id: number; name: string; sc_avg: number; consistency: number | null; vorp?: number | null; primary: string
}
const POS_COLOR: Record<string, string> = { DEF: '#58a6ff', MID: '#bc8cff', FWD: '#f0883e', RUC: '#3fb950' }
const SIZE = 9

function norm(v: number, lo: number, hi: number) {
  if (hi <= lo) return 0
  return ((v - lo) / (hi - lo)) * SIZE - SIZE / 2
}

function Bubble({ pos, color, radius, label, onClick }: { pos: [number, number, number]; color: string; radius: number; label: string; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <mesh
      position={pos}
      scale={hov ? 1.45 : 1}
      onPointerOver={e => { e.stopPropagation(); setHov(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHov(false); document.body.style.cursor = 'auto' }}
      onClick={e => { e.stopPropagation(); onClick() }}
    >
      <sphereGeometry args={[radius, 24, 24]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hov ? 0.7 : 0.22} roughness={0.35} metalness={0.1} />
      {hov && (
        <Html center distanceFactor={14} style={{ pointerEvents: 'none' }}>
          <div style={{ background: '#161d27', border: '1px solid rgba(110,130,180,.35)', color: '#e6edf3', padding: '4px 8px', borderRadius: 6, fontSize: 11, whiteSpace: 'nowrap', transform: 'translateY(-22px)', boxShadow: '0 4px 14px rgba(0,0,0,.5)' }}>{label}</div>
        </Html>
      )}
    </mesh>
  )
}

function Scene({ players, onSelect }: { players: CloudPlayer[]; onSelect: (id: number) => void }) {
  const bubbles = useMemo(() => {
    const pool = players.filter(p => (p.sc_avg || 0) > 0 && p.consistency != null)
    const scs = pool.map(p => p.sc_avg), cons = pool.map(p => p.consistency as number)
    const vorps = pool.map(p => Math.max(0, p.vorp ?? 0))
    const scLo = Math.min(...scs), scHi = Math.max(...scs)
    const cLo = Math.min(...cons), cHi = Math.max(...cons)
    const vHi = Math.max(1, ...vorps)
    return pool.map(p => {
      const v = Math.max(0, p.vorp ?? 0)
      return {
        id: p.id,
        pos: [norm(p.sc_avg, scLo, scHi), norm(v, 0, vHi), norm(p.consistency as number, cLo, cHi)] as [number, number, number],
        color: POS_COLOR[p.primary] || '#8b949e',
        radius: 0.14 + (v / vHi) * 0.36,
        label: `${p.name} · SC ${p.sc_avg} · cons ${p.consistency} · VORP +${Math.round(v)}`,
      }
    })
  }, [players])
  const H = SIZE / 2
  return (
    <>
      <ambientLight intensity={0.65} />
      <pointLight position={[10, 12, 8]} intensity={120} />
      <pointLight position={[-8, -4, -8]} intensity={40} color="#5878c8" />
      <gridHelper args={[SIZE, 9, '#30363d', '#171d27']} position={[0, -H, 0]} />
      <Line points={[[-H, -H, -H], [H, -H, -H]]} color="#3a4150" lineWidth={1.4} />
      <Line points={[[-H, -H, -H], [-H, H, -H]]} color="#3a4150" lineWidth={1.4} />
      <Line points={[[-H, -H, -H], [-H, -H, H]]} color="#3a4150" lineWidth={1.4} />
      {bubbles.map(b => (
        <Bubble key={b.id} pos={b.pos} color={b.color} radius={b.radius} label={b.label} onClick={() => onSelect(b.id)} />
      ))}
      <OrbitControls enablePan={false} autoRotate autoRotateSpeed={0.55} minDistance={9} maxDistance={26} target={[0, 0, 0]} />
    </>
  )
}

const LEGEND: [string, string][] = [['DEF', POS_COLOR.DEF], ['MID', POS_COLOR.MID], ['FWD', POS_COLOR.FWD], ['RUC', POS_COLOR.RUC]]

export default function ValueCloud3D({ players, onSelect }: { players: CloudPlayer[]; onSelect: (id: number) => void }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: 420 }}>
      <Canvas camera={{ position: [10, 8, 13], fov: 48 }} style={{ background: '#0a0e13', borderRadius: 8 }} dpr={[1, 2]}>
        <Scene players={players} onSelect={onSelect} />
      </Canvas>
      <div style={{ position: 'absolute', top: 10, right: 12, display: 'flex', gap: 12, fontSize: 11, color: '#8b949e', pointerEvents: 'none' }}>
        {LEGEND.map(([k, c]) => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: c, display: 'inline-block' }} />{k}
          </span>
        ))}
      </div>
      <div style={{ position: 'absolute', bottom: 10, left: 14, fontSize: 10.5, color: '#6e7681', pointerEvents: 'none', lineHeight: 1.5 }}>
        <div><b style={{ color: '#8b949e' }}>↑ height & size</b> = VORP</div>
        <div>X = SC output · Z = reliability · drag to orbit</div>
      </div>
    </div>
  )
}
