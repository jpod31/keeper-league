import { useRef, useState, useMemo, Suspense, Component, type ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'

export interface FieldPlayer {
  id: number
  name: string
  position: string
  position_code: string
  afl_team: string
  sc_avg: number
  is_captain?: boolean
  is_vice_captain?: boolean
  score?: number | null
}

interface Props {
  players: FieldPlayer[]
  teamColor?: string
  onPlayerClick?: (p: FieldPlayer) => void
}

const OVAL_LENGTH = 26
const OVAL_WIDTH = 18

function zoneForPosition(code: string): 'DEF' | 'MID' | 'RUC' | 'FWD' {
  const c = (code || '').toUpperCase()
  if (c.includes('DEF') || c === 'D') return 'DEF'
  if (c.includes('FWD') || c === 'F') return 'FWD'
  if (c.includes('RUC') || c === 'R') return 'RUC'
  return 'MID'
}

function layoutPlayers(players: FieldPlayer[]): Array<FieldPlayer & { x: number; z: number }> {
  const groups: Record<'DEF' | 'MID' | 'RUC' | 'FWD', FieldPlayer[]> = {
    DEF: [], MID: [], RUC: [], FWD: [],
  }
  for (const p of players) {
    groups[zoneForPosition(p.position_code || p.position)].push(p)
  }
  const zY: Record<'DEF' | 'MID' | 'RUC' | 'FWD', number> = {
    DEF: -OVAL_LENGTH * 0.33,
    MID: -OVAL_LENGTH * 0.10,
    RUC: 0,
    FWD: OVAL_LENGTH * 0.30,
  }
  const result: Array<FieldPlayer & { x: number; z: number }> = []
  for (const zone of ['DEF', 'MID', 'RUC', 'FWD'] as const) {
    const arr = groups[zone]
    const n = arr.length
    if (n === 0) continue
    const widthSpan = Math.min(OVAL_WIDTH * 0.75, Math.max(5, n * 2.4))
    const startX = -widthSpan / 2
    const step = n === 1 ? 0 : widthSpan / (n - 1)
    arr.forEach((p, i) => {
      const x = n === 1 ? 0 : startX + step * i
      const arc = zone === 'FWD' ? Math.cos((i - (n - 1) / 2) / Math.max(n, 1)) * 1.4
                : zone === 'DEF' ? -Math.cos((i - (n - 1) / 2) / Math.max(n, 1)) * 1.4
                : 0
      result.push({ ...p, x, z: zY[zone] + arc })
    })
  }
  return result
}

// Oval ground — procedural texture via canvas
function useOvalTexture(): THREE.Texture | null {
  return useMemo(() => {
    if (typeof document === 'undefined') return null
    try {
      const cvs = document.createElement('canvas')
      cvs.width = 1024; cvs.height = 1024
      const ctx = cvs.getContext('2d')
      if (!ctx) return null
      const w = cvs.width, h = cvs.height
      const cx = w / 2, cy = h / 2
      const lenPx = w * 0.95 / 2
      const widPx = h * 0.72 / 2
      ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, w, h)
      ctx.save()
      ctx.beginPath(); ctx.ellipse(cx, cy, lenPx, widPx, 0, 0, Math.PI * 2); ctx.clip()
      const bands = 14, bw = w / bands
      for (let i = 0; i < bands; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#1e5b32' : '#1b5230'
        ctx.fillRect(i * bw, 0, bw, h)
      }
      ctx.lineWidth = 5
      ctx.strokeStyle = '#ffffff'
      ctx.beginPath(); ctx.ellipse(cx, cy, lenPx, widPx, 0, 0, Math.PI * 2); ctx.stroke()
      ctx.strokeRect(cx - 40, cy - 40, 80, 80)
      ctx.beginPath(); ctx.arc(cx, cy, 50, 0, Math.PI * 2); ctx.stroke()
      ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.stroke()
      ctx.strokeRect(cx - 36, cy - widPx + 2, 72, 26)
      ctx.strokeRect(cx - 36, cy + widPx - 28, 72, 26)
      ctx.restore()
      const tex = new THREE.CanvasTexture(cvs)
      tex.anisotropy = 4
      return tex
    } catch {
      return null
    }
  }, [])
}

function Oval() {
  const texture = useOvalTexture()
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[OVAL_WIDTH * 1.4, OVAL_LENGTH * 1.4]} />
      {texture
        ? <meshStandardMaterial map={texture} />
        : <meshStandardMaterial color="#1e5b32" />}
    </mesh>
  )
}

function PlayerMarker({ player, teamColor, onClick }: {
  player: FieldPlayer & { x: number; z: number }
  teamColor: string
  onClick?: () => void
}) {
  const [hover, setHover] = useState(false)
  const groupRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.position.y = 0.7 + Math.sin(clock.getElapsedTime() * 2 + player.id) * 0.07
    }
  })

  const color = player.is_captain ? '#d29922' : player.is_vice_captain ? '#bc8cff' : teamColor
  const surname = player.name.split(' ').slice(-1)[0].slice(0, 10).toUpperCase()

  return (
    <group
      ref={groupRef}
      position={[player.x, 0.7, player.z]}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = 'default' }}
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
    >
      <mesh position={[0, -0.35, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.7, 8]} />
        <meshStandardMaterial color="#21262d" />
      </mesh>
      <mesh castShadow>
        <cylinderGeometry args={[0.65, 0.65, 0.15, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hover ? 0.9 : 0.3} />
      </mesh>
      {(player.is_captain || player.is_vice_captain) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}>
          <ringGeometry args={[0.7, 0.92, 32]} />
          <meshBasicMaterial color={player.is_captain ? '#d29922' : '#bc8cff'} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* HTML label above each player — always visible, cheaper than drei Text */}
      <Html distanceFactor={14} position={[0, 0.7, 0]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: '#fff',
          textShadow: '0 1px 3px rgba(0,0,0,.9), 0 0 6px rgba(0,0,0,.6)',
          whiteSpace: 'nowrap', letterSpacing: '.5px',
          fontFamily: 'Inter, sans-serif',
        }}>
          {surname}
          {player.is_captain && <span style={{ color: '#d29922', marginLeft: 4 }}>(C)</span>}
          {player.is_vice_captain && <span style={{ color: '#bc8cff', marginLeft: 4 }}>(VC)</span>}
        </div>
      </Html>
      {hover && (
        <Html distanceFactor={10} position={[0, 1.6, 0]} center style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(13,17,23,.95)', border: `1px solid ${color}`, borderRadius: 8,
            padding: '8px 12px', minWidth: 150, color: '#c9d1d9', fontSize: 12,
            boxShadow: `0 4px 20px ${color}66`,
            fontFamily: 'Inter, sans-serif',
            whiteSpace: 'nowrap',
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#e6edf3' }}>{player.name}</div>
            <div style={{ color: '#8b949e', fontSize: 11 }}>{player.afl_team || ''} · {player.position}</div>
            <div style={{ marginTop: 4, display: 'flex', gap: 10 }}>
              <span>SC <b style={{ color: '#58a6ff' }}>{Math.round(player.sc_avg || 0)}</b></span>
              {player.score != null && <span>Rd <b style={{ color: '#3fb950' }}>{Math.round(player.score)}</b></span>}
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

function Scene({ players, teamColor, onPlayerClick }: Props) {
  const laid = useMemo(() => layoutPlayers(players), [players])
  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[10, 18, 5]} intensity={1.0} castShadow />
      <Oval />
      {laid.map(p => (
        <PlayerMarker key={p.id} player={p} teamColor={teamColor || '#58a6ff'} onClick={() => onPlayerClick?.(p)} />
      ))}
    </>
  )
}

// Error boundary so a Three.js crash shows a fallback instead of a blank div
class CanvasErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { err: boolean }> {
  state = { err: false }
  static getDerivedStateFromError() { return { err: true } }
  componentDidCatch(e: Error) { console.error('Field3D render error:', e) }
  render() { return this.state.err ? this.props.fallback : this.props.children }
}

export function Field3D({ players, teamColor = '#58a6ff', onPlayerClick }: Props) {
  const [reset, setReset] = useState(0)

  const fallback = (
    <div style={{
      width: '100%', height: '100%', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 8,
      background: '#0d1117', color: '#8b949e', fontSize: 14,
    }}>
      <i className="bi bi-exclamation-triangle" style={{ fontSize: 28, color: '#d29922' }}></i>
      <div>3D view unavailable — your browser may not support WebGL.</div>
    </div>
  )

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: 'min(75vh, 680px)',
      minHeight: 420,
      borderRadius: 12,
      overflow: 'hidden',
      background: 'linear-gradient(to bottom, #0d1117, #161b22)',
      border: '1px solid #21262d',
    }}>
      <CanvasErrorBoundary fallback={fallback}>
        <Canvas
          key={reset}
          shadows
          camera={{ position: [0, 22, 28], fov: 42 }}
          dpr={[1, 2]}
          style={{ width: '100%', height: '100%' }}
          gl={{ antialias: true, alpha: false }}
          onCreated={(s) => { s.gl.setClearColor('#0d1117') }}
        >
          <Suspense fallback={null}>
            <Scene players={players} teamColor={teamColor} onPlayerClick={onPlayerClick} />
          </Suspense>
          <OrbitControls
            enablePan={false}
            minDistance={16}
            maxDistance={50}
            maxPolarAngle={Math.PI / 2.1}
            minPolarAngle={Math.PI / 6}
            target={[0, 0, 0]}
          />
        </Canvas>
      </CanvasErrorBoundary>

      <div style={{
        position: 'absolute', top: 10, right: 10,
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <button
          onClick={() => setReset(r => r + 1)}
          title="Reset camera"
          style={{
            background: 'rgba(13,17,23,.8)', border: '1px solid #30363d',
            color: '#c9d1d9', borderRadius: 6, padding: '6px 10px',
            fontSize: 12, cursor: 'pointer', fontWeight: 600,
          }}
        >
          <i className="bi bi-arrow-clockwise me-1"></i>Reset
        </button>
      </div>

      <div style={{
        position: 'absolute', bottom: 10, left: 10,
        background: 'rgba(13,17,23,.6)', border: '1px solid rgba(48,54,61,.6)',
        borderRadius: 6, padding: '4px 10px', color: '#8b949e', fontSize: 11,
        pointerEvents: 'none',
      }}>
        <i className="bi bi-mouse me-1"></i>drag to rotate · scroll to zoom · tap player for details
      </div>
    </div>
  )
}
