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

// Bigger oval for a proper stadium feel
const OVAL_LENGTH = 32
const OVAL_WIDTH = 22
const GOAL_OFFSET = OVAL_LENGTH / 2 - 0.2

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
    DEF: -OVAL_LENGTH * 0.32,
    MID: -OVAL_LENGTH * 0.10,
    RUC: 0,
    FWD: OVAL_LENGTH * 0.30,
  }
  const result: Array<FieldPlayer & { x: number; z: number }> = []
  for (const zone of ['DEF', 'MID', 'RUC', 'FWD'] as const) {
    const arr = groups[zone]
    const n = arr.length
    if (n === 0) continue
    const widthSpan = Math.min(OVAL_WIDTH * 0.78, Math.max(6, n * 2.6))
    const startX = -widthSpan / 2
    const step = n === 1 ? 0 : widthSpan / (n - 1)
    arr.forEach((p, i) => {
      const x = n === 1 ? 0 : startX + step * i
      const arc = zone === 'FWD' ? Math.cos((i - (n - 1) / 2) / Math.max(n, 1)) * 1.8
                : zone === 'DEF' ? -Math.cos((i - (n - 1) / 2) / Math.max(n, 1)) * 1.8
                : 0
      result.push({ ...p, x, z: zY[zone] + arc })
    })
  }
  return result
}

// Procedural grass+markings texture
function useOvalTexture(): THREE.Texture | null {
  return useMemo(() => {
    if (typeof document === 'undefined') return null
    try {
      const cvs = document.createElement('canvas')
      cvs.width = 2048; cvs.height = 2048
      const ctx = cvs.getContext('2d')
      if (!ctx) return null
      const w = cvs.width, h = cvs.height
      const cx = w / 2, cy = h / 2
      const lenPx = w * 0.95 / 2
      const widPx = h * 0.67 / 2
      ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, w, h)
      ctx.save()
      ctx.beginPath(); ctx.ellipse(cx, cy, lenPx, widPx, 0, 0, Math.PI * 2); ctx.clip()

      // Radial gradient base
      const grad = ctx.createRadialGradient(cx, cy, 100, cx, cy, lenPx)
      grad.addColorStop(0, '#2b8a46')
      grad.addColorStop(0.7, '#1e5b32')
      grad.addColorStop(1, '#174526')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)

      // Mow stripes (vertical)
      const bands = 18
      ctx.globalAlpha = 0.18
      for (let i = 0; i < bands; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#000000'
        ctx.fillRect((i / bands) * w, 0, w / bands, h)
      }
      ctx.globalAlpha = 1

      // Subtle grass noise
      for (let i = 0; i < 6000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.05)'
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2)
      }

      // White markings
      ctx.lineWidth = 8
      ctx.strokeStyle = 'rgba(255,255,255,.95)'
      ctx.beginPath(); ctx.ellipse(cx, cy, lenPx, widPx, 0, 0, Math.PI * 2); ctx.stroke()
      ctx.strokeRect(cx - 90, cy - 90, 180, 180)               // center square
      ctx.beginPath(); ctx.arc(cx, cy, 100, 0, Math.PI * 2); ctx.stroke()    // center circle
      ctx.beginPath(); ctx.arc(cx, cy, 45, 0, Math.PI * 2); ctx.stroke()     // inner circle
      // Goal squares
      ctx.strokeRect(cx - 70, cy - widPx + 4, 140, 50)
      ctx.strokeRect(cx - 70, cy + widPx - 54, 140, 50)
      // 50m arcs
      ctx.beginPath(); ctx.arc(cx, cy - widPx + 50, 230, 0.2 * Math.PI, 0.8 * Math.PI, true); ctx.stroke()
      ctx.beginPath(); ctx.arc(cx, cy + widPx - 50, 230, 1.2 * Math.PI, 1.8 * Math.PI, true); ctx.stroke()

      ctx.restore()
      const tex = new THREE.CanvasTexture(cvs)
      tex.anisotropy = 8
      return tex
    } catch {
      return null
    }
  }, [])
}

function Oval() {
  const texture = useOvalTexture()
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[OVAL_WIDTH * 1.35, OVAL_LENGTH * 1.35]} />
      {texture
        ? <meshStandardMaterial map={texture} roughness={0.9} metalness={0.02} />
        : <meshStandardMaterial color="#1e5b32" />}
    </mesh>
  )
}

// Tiered stadium seating around the oval — 3 concentric elliptical rings
function Stadium() {
  const tiers = useMemo(() => {
    const out: Array<{ a: number; b: number; y: number; h: number; color: string }> = []
    const base = { a: OVAL_WIDTH / 2 + 1.6, b: OVAL_LENGTH / 2 + 1.6 }
    for (let i = 0; i < 3; i++) {
      const expand = 2 + i * 1.4
      out.push({
        a: base.a + expand,
        b: base.b + expand,
        y: 0.4 + i * 1.2,
        h: 0.9 + i * 0.8,
        color: i === 0 ? '#1c2128' : i === 1 ? '#2d333b' : '#373e47',
      })
    }
    return out
  }, [])
  return (
    <group>
      {/* Inner low wall */}
      <mesh position={[0, 0.3, 0]}>
        <torusGeometry args={[OVAL_LENGTH / 2 + 0.4, 0.18, 8, 64]} />
        <meshStandardMaterial color="#161b22" />
      </mesh>
      {tiers.map((t, i) => (
        <mesh key={i} position={[0, t.y, 0]} scale={[t.a / (OVAL_LENGTH / 2), 1, t.b / (OVAL_LENGTH / 2)]}>
          <cylinderGeometry args={[OVAL_LENGTH / 2, OVAL_LENGTH / 2, t.h, 96, 1, true]} />
          <meshStandardMaterial color={t.color} side={THREE.DoubleSide} roughness={0.8} />
        </mesh>
      ))}
      {/* Top rim lights */}
      <mesh position={[0, 4.5, 0]} scale={[1.18, 1, 1.18]}>
        <torusGeometry args={[OVAL_LENGTH / 2 + 2.2, 0.12, 8, 96]} />
        <meshStandardMaterial color="#58a6ff" emissive="#58a6ff" emissiveIntensity={0.8} />
      </mesh>
    </group>
  )
}

function GoalPosts({ z }: { z: number }) {
  // 4 posts: 2 tall goal posts (centered), 2 shorter behind posts
  return (
    <group position={[0, 0, z]}>
      {[-0.9, 0.9].map(x => (
        <mesh key={`g${x}`} position={[x, 3.5, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 7, 12]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.2} />
        </mesh>
      ))}
      {[-2.6, 2.6].map(x => (
        <mesh key={`b${x}`} position={[x, 2.25, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 4.5, 12]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.15} />
        </mesh>
      ))}
    </group>
  )
}

function PlayerMarker({ player, teamColor, onClick }: {
  player: FieldPlayer & { x: number; z: number }
  teamColor: string
  onClick?: () => void
}) {
  const [hover, setHover] = useState(false)
  const bodyRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (bodyRef.current) {
      bodyRef.current.rotation.y = clock.getElapsedTime() * 0.4 + player.id
    }
  })

  const color = player.is_captain ? '#d29922' : player.is_vice_captain ? '#bc8cff' : teamColor
  const surname = player.name.split(' ').slice(-1)[0].slice(0, 10).toUpperCase()
  const glow = hover ? 1.1 : 0.5

  return (
    <group
      position={[player.x, 0, player.z]}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = 'default' }}
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
    >
      {/* Glowing disc on ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.95, 32]} />
        <meshBasicMaterial color={color} transparent opacity={hover ? 0.45 : 0.22} />
      </mesh>

      {/* Body — stylised "jersey" cylinder + head sphere */}
      <group ref={bodyRef}>
        <mesh position={[0, 0.75, 0]}>
          <cylinderGeometry args={[0.48, 0.55, 1.5, 20]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow} roughness={0.4} metalness={0.1} />
        </mesh>
        <mesh position={[0, 1.75, 0]}>
          <sphereGeometry args={[0.38, 24, 24]} />
          <meshStandardMaterial color="#f0d7b8" roughness={0.7} />
        </mesh>
      </group>

      {/* Captain / VC ring on ground */}
      {(player.is_captain || player.is_vice_captain) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[1, 1.3, 48]} />
          <meshBasicMaterial color={player.is_captain ? '#d29922' : '#bc8cff'} side={THREE.DoubleSide} transparent opacity={0.9} />
        </mesh>
      )}

      {/* Name label */}
      <Html distanceFactor={16} position={[0, 2.7, 0]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{
          fontSize: 11, fontWeight: 800, color: '#fff',
          textShadow: '0 1px 3px rgba(0,0,0,.95), 0 0 8px rgba(0,0,0,.7)',
          whiteSpace: 'nowrap', letterSpacing: '.5px',
          fontFamily: 'Inter, sans-serif',
        }}>
          {surname}
          {player.is_captain && <span style={{ color: '#d29922', marginLeft: 4 }}>(C)</span>}
          {player.is_vice_captain && <span style={{ color: '#bc8cff', marginLeft: 4 }}>(VC)</span>}
        </div>
      </Html>

      {hover && (
        <Html distanceFactor={10} position={[0, 3.2, 0]} center style={{ pointerEvents: 'none', zIndex: 100 }}>
          <div style={{
            background: 'rgba(13,17,23,.95)', border: `1px solid ${color}`, borderRadius: 8,
            padding: '8px 12px', minWidth: 160, color: '#c9d1d9', fontSize: 12,
            boxShadow: `0 4px 28px ${color}99`,
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

function SceneContent({ players, teamColor, onPlayerClick }: Props) {
  const laid = useMemo(() => layoutPlayers(players), [players])
  return (
    <>
      <color attach="background" args={['#05070a']} />
      <fog attach="fog" args={['#05070a', 45, 95]} />

      {/* Ambient + key light */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[20, 40, 10]} intensity={0.9} />
      {/* Stadium floodlights — four blue/green rim lights */}
      <pointLight position={[0, 10, -OVAL_LENGTH / 2 - 4]} intensity={1.2} color="#3fb950" distance={40} />
      <pointLight position={[0, 10, OVAL_LENGTH / 2 + 4]} intensity={1.2} color="#58a6ff" distance={40} />
      <pointLight position={[-OVAL_WIDTH / 2 - 4, 10, 0]} intensity={0.7} color="#bc8cff" distance={30} />
      <pointLight position={[OVAL_WIDTH / 2 + 4, 10, 0]} intensity={0.7} color="#d29922" distance={30} />

      <Stadium />
      <Oval />
      <GoalPosts z={-GOAL_OFFSET} />
      <GoalPosts z={GOAL_OFFSET} />
      {laid.map(p => (
        <PlayerMarker key={p.id} player={p} teamColor={teamColor || '#58a6ff'} onClick={() => onPlayerClick?.(p)} />
      ))}
    </>
  )
}

class CanvasErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { err: boolean; msg: string }> {
  state = { err: false, msg: '' }
  static getDerivedStateFromError(e: Error) { return { err: true, msg: e?.message || '' } }
  componentDidCatch(e: Error) { console.error('Field3D render error:', e) }
  render() {
    if (this.state.err) return this.props.fallback
    return this.props.children
  }
}

export function Field3D({ players, teamColor = '#58a6ff', onPlayerClick }: Props) {
  const fallback = (
    <div style={{
      width: '100%', height: '100%', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 8,
      background: '#0d1117', color: '#8b949e', fontSize: 14, padding: 20, textAlign: 'center',
    }}>
      <i className="bi bi-exclamation-triangle" style={{ fontSize: 28, color: '#d29922' }}></i>
      <div>3D view unavailable — your browser may not support WebGL, or the canvas crashed. Check the console.</div>
    </div>
  )

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: 'min(80vh, 760px)',
      minHeight: 460,
      borderRadius: 12,
      overflow: 'hidden',
      background: '#05070a',
      border: '1px solid #21262d',
    }}>
      <CanvasErrorBoundary fallback={fallback}>
        <Canvas
          camera={{ position: [0, 28, 42], fov: 38 }}
          dpr={[1, 2]}
          style={{ width: '100%', height: '100%' }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        >
          <Suspense fallback={null}>
            <SceneContent players={players} teamColor={teamColor} onPlayerClick={onPlayerClick} />
          </Suspense>
          <OrbitControls
            enablePan={false}
            minDistance={18}
            maxDistance={80}
            maxPolarAngle={Math.PI / 2.15}
            minPolarAngle={Math.PI / 10}
            target={[0, 0, 0]}
            enableDamping
            dampingFactor={0.08}
          />
        </Canvas>
      </CanvasErrorBoundary>

      <div style={{
        position: 'absolute', bottom: 10, left: 10,
        background: 'rgba(13,17,23,.6)', border: '1px solid rgba(48,54,61,.6)',
        borderRadius: 6, padding: '4px 10px', color: '#8b949e', fontSize: 11,
        pointerEvents: 'none',
      }}>
        <i className="bi bi-mouse me-1"></i>drag to rotate · scroll to zoom · tap a player for details
      </div>
    </div>
  )
}
