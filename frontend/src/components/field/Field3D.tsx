import { useRef, useState, useMemo, Component, type ReactNode } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
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

const OVAL_LENGTH = 30
const OVAL_WIDTH = 20

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
  for (const p of players) groups[zoneForPosition(p.position_code || p.position)].push(p)
  const zY = {
    DEF: -OVAL_LENGTH * 0.32, MID: -OVAL_LENGTH * 0.1,
    RUC: 0, FWD: OVAL_LENGTH * 0.3,
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
      const arc = zone === 'FWD' ? Math.cos((i - (n - 1) / 2) / Math.max(n, 1)) * 1.6
                : zone === 'DEF' ? -Math.cos((i - (n - 1) / 2) / Math.max(n, 1)) * 1.6
                : 0
      result.push({ ...p, x, z: zY[zone] + arc })
    })
  }
  return result
}

function useOvalTexture(): THREE.Texture | null {
  return useMemo(() => {
    if (typeof document === 'undefined') return null
    try {
      const cvs = document.createElement('canvas')
      cvs.width = 1024; cvs.height = 1024
      const ctx = cvs.getContext('2d'); if (!ctx) return null
      const w = cvs.width, h = cvs.height, cx = w / 2, cy = h / 2
      const lenPx = w * 0.95 / 2, widPx = h * 0.67 / 2
      ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, w, h)
      ctx.save()
      ctx.beginPath(); ctx.ellipse(cx, cy, lenPx, widPx, 0, 0, Math.PI * 2); ctx.clip()
      const grad = ctx.createRadialGradient(cx, cy, 50, cx, cy, lenPx)
      grad.addColorStop(0, '#2b8a46'); grad.addColorStop(0.7, '#1e5b32'); grad.addColorStop(1, '#174526')
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h)
      ctx.globalAlpha = 0.16
      for (let i = 0; i < 16; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#000000'
        ctx.fillRect((i / 16) * w, 0, w / 16, h)
      }
      ctx.globalAlpha = 1
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,.95)'
      ctx.beginPath(); ctx.ellipse(cx, cy, lenPx, widPx, 0, 0, Math.PI * 2); ctx.stroke()
      ctx.strokeRect(cx - 55, cy - 55, 110, 110)
      ctx.beginPath(); ctx.arc(cx, cy, 60, 0, Math.PI * 2); ctx.stroke()
      ctx.beginPath(); ctx.arc(cx, cy, 28, 0, Math.PI * 2); ctx.stroke()
      ctx.strokeRect(cx - 40, cy - widPx + 3, 80, 28)
      ctx.strokeRect(cx - 40, cy + widPx - 31, 80, 28)
      ctx.restore()
      const tex = new THREE.CanvasTexture(cvs)
      tex.anisotropy = 4
      return tex
    } catch { return null }
  }, [])
}

function Oval() {
  const tex = useOvalTexture()
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[OVAL_WIDTH * 1.3, OVAL_LENGTH * 1.3]} />
      {tex ? <meshStandardMaterial map={tex} /> : <meshStandardMaterial color="#1e5b32" />}
    </mesh>
  )
}

function StadiumRing() {
  return (
    <>
      <mesh position={[0, 0.8, 0]} scale={[1.13, 1, 1.1]}>
        <cylinderGeometry args={[OVAL_LENGTH / 2 + 1.8, OVAL_LENGTH / 2 + 1.8, 1.6, 64, 1, true]} />
        <meshStandardMaterial color="#1c2128" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 2.2, 0]} scale={[1.2, 1, 1.15]}>
        <cylinderGeometry args={[OVAL_LENGTH / 2 + 3.4, OVAL_LENGTH / 2 + 3.4, 1.2, 64, 1, true]} />
        <meshStandardMaterial color="#2d333b" side={THREE.DoubleSide} />
      </mesh>
    </>
  )
}

function GoalPosts({ z }: { z: number }) {
  return (
    <group position={[0, 0, z]}>
      {[-0.9, 0.9].map(x => (
        <mesh key={`g${x}`} position={[x, 3.5, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 7, 8]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.15} />
        </mesh>
      ))}
      {[-2.6, 2.6].map(x => (
        <mesh key={`b${x}`} position={[x, 2.2, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 4.4, 8]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Single PlayerMarker. NO <Html> portals — just three.js primitives.
 * Tooltip is rendered outside the Canvas in a React overlay.
 */
function PlayerMarker({
  player, teamColor, onHover, onClick, hovered,
}: {
  player: FieldPlayer & { x: number; z: number }
  teamColor: string
  onHover: (p: FieldPlayer | null, clientX?: number, clientY?: number) => void
  onClick: () => void
  hovered: boolean
}) {
  const ref = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.35 + player.id * 0.1
    }
  })

  const color = player.is_captain ? '#d29922' : player.is_vice_captain ? '#bc8cff' : teamColor
  const glow = hovered ? 1.1 : 0.45

  return (
    <group
      position={[player.x, 0, player.z]}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        onHover(player, e.nativeEvent.clientX, e.nativeEvent.clientY)
      }}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => {
        onHover(player, e.nativeEvent.clientX, e.nativeEvent.clientY)
      }}
      onPointerOut={() => onHover(null)}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick() }}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.95, 24]} />
        <meshBasicMaterial color={color} transparent opacity={hovered ? 0.5 : 0.22} />
      </mesh>
      <group ref={ref}>
        <mesh position={[0, 0.75, 0]}>
          <cylinderGeometry args={[0.48, 0.55, 1.5, 16]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow} />
        </mesh>
        <mesh position={[0, 1.75, 0]}>
          <sphereGeometry args={[0.36, 16, 16]} />
          <meshStandardMaterial color="#f0d7b8" />
        </mesh>
      </group>
      {(player.is_captain || player.is_vice_captain) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[1, 1.28, 32]} />
          <meshBasicMaterial
            color={player.is_captain ? '#d29922' : '#bc8cff'}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  )
}

function SceneContent({
  players, teamColor, onHover, onClick, hoveredId,
}: {
  players: FieldPlayer[]
  teamColor: string
  onHover: (p: FieldPlayer | null, x?: number, y?: number) => void
  onClick: (p: FieldPlayer) => void
  hoveredId: number | null
}) {
  const laid = useMemo(() => layoutPlayers(players), [players])
  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[15, 30, 10]} intensity={0.95} />
      <pointLight position={[0, 8, -OVAL_LENGTH / 2]} intensity={0.9} color="#3fb950" distance={35} />
      <pointLight position={[0, 8, OVAL_LENGTH / 2]} intensity={0.9} color="#58a6ff" distance={35} />
      <StadiumRing />
      <Oval />
      <GoalPosts z={-OVAL_LENGTH / 2 + 0.2} />
      <GoalPosts z={OVAL_LENGTH / 2 - 0.2} />
      {laid.map(p => (
        <PlayerMarker
          key={p.id}
          player={p}
          teamColor={teamColor}
          hovered={hoveredId === p.id}
          onHover={onHover}
          onClick={() => onClick(p)}
        />
      ))}
    </>
  )
}

class CanvasErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { err: boolean }> {
  state = { err: false }
  static getDerivedStateFromError() { return { err: true } }
  componentDidCatch(e: Error) { console.error('[Field3D] render error:', e) }
  render() { return this.state.err ? this.props.fallback : this.props.children }
}

export function Field3D({ players, teamColor = '#58a6ff', onPlayerClick }: Props) {
  const [hovered, setHovered] = useState<{ player: FieldPlayer; x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  function handleHover(p: FieldPlayer | null, x?: number, y?: number) {
    if (!p || x == null || y == null) { setHovered(null); return }
    // Convert to coords relative to container
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setHovered({ player: p, x: x - rect.left, y: y - rect.top })
  }

  const fallback = (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 8, padding: 20, textAlign: 'center',
      background: '#0d1117', color: '#8b949e', fontSize: 14,
    }}>
      <i className="bi bi-exclamation-triangle" style={{ fontSize: 28, color: '#d29922' }}></i>
      <div>3D view unavailable. Check the browser console for the specific error.</div>
    </div>
  )

  const tooltip = hovered && (
    <div style={{
      position: 'absolute',
      left: hovered.x + 14,
      top: hovered.y - 14,
      pointerEvents: 'none',
      background: 'rgba(13,17,23,.95)',
      border: '1px solid ' + (hovered.player.is_captain ? '#d29922'
        : hovered.player.is_vice_captain ? '#bc8cff' : teamColor),
      borderRadius: 8, padding: '8px 12px', minWidth: 160,
      color: '#c9d1d9', fontSize: 12, zIndex: 5,
      boxShadow: '0 4px 20px rgba(0,0,0,.6)',
      fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
    }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#e6edf3' }}>{hovered.player.name}</div>
      <div style={{ color: '#8b949e', fontSize: 11 }}>
        {hovered.player.afl_team || '—'} · {hovered.player.position}
      </div>
      <div style={{ marginTop: 4, display: 'flex', gap: 10 }}>
        <span>SC <b style={{ color: '#58a6ff' }}>{Math.round(hovered.player.sc_avg || 0)}</b></span>
        {hovered.player.score != null &&
          <span>Rd <b style={{ color: '#3fb950' }}>{Math.round(hovered.player.score)}</b></span>}
      </div>
      {hovered.player.is_captain &&
        <div style={{ marginTop: 4, color: '#d29922', fontWeight: 800, fontSize: 10 }}>CAPTAIN (2×)</div>}
      {hovered.player.is_vice_captain &&
        <div style={{ marginTop: 4, color: '#bc8cff', fontWeight: 800, fontSize: 10 }}>VICE CAPTAIN</div>}
    </div>
  )

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: 'min(75vh, 680px)',
        minHeight: 440,
        borderRadius: 12,
        overflow: 'hidden',
        background: '#05070a',
        border: '1px solid #21262d',
      }}
    >
      <CanvasErrorBoundary fallback={fallback}>
        <Canvas
          camera={{ position: [0, 24, 36], fov: 40 }}
          dpr={[1, 1.5]}
          style={{ width: '100%', height: '100%' }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        >
          <SceneContent
            players={players}
            teamColor={teamColor}
            onHover={handleHover}
            onClick={(p) => onPlayerClick?.(p)}
            hoveredId={hovered?.player.id ?? null}
          />
          <OrbitControls
            enablePan={false}
            minDistance={18}
            maxDistance={70}
            maxPolarAngle={Math.PI / 2.15}
            minPolarAngle={Math.PI / 10}
            target={[0, 0, 0]}
            enableDamping
            dampingFactor={0.08}
          />
        </Canvas>
      </CanvasErrorBoundary>

      {tooltip}

      <div style={{
        position: 'absolute', bottom: 10, left: 10,
        background: 'rgba(13,17,23,.6)', border: '1px solid rgba(48,54,61,.6)',
        borderRadius: 6, padding: '4px 10px', color: '#8b949e', fontSize: 11,
        pointerEvents: 'none',
      }}>
        <i className="bi bi-mouse me-1"></i>drag to rotate · scroll to zoom · tap a player
      </div>
    </div>
  )
}
