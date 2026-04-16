import { useRef, useState, useMemo, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html, Text } from '@react-three/drei'
import * as THREE from 'three'

export interface FieldPlayer {
  id: number
  name: string
  position: string          // FWD / MID / DEF / RUC (or lineup code)
  position_code: string
  afl_team: string
  sc_avg: number
  is_captain?: boolean
  is_vice_captain?: boolean
  score?: number | null     // live round score (optional)
}

interface Props {
  players: FieldPlayer[]
  teamColor?: string
  onPlayerClick?: (p: FieldPlayer) => void
}

// AFL-style oval dimensions (simplified)
const OVAL_LENGTH = 20
const OVAL_WIDTH = 14

// Map position_code or position string → field zone coords.
// Returns y (along the length) where -ve = defensive, +ve = forward
function zoneForPosition(code: string): 'DEF' | 'MID' | 'RUC' | 'FWD' {
  const c = (code || '').toUpperCase()
  if (c.includes('DEF') || c === 'D') return 'DEF'
  if (c.includes('FWD') || c === 'F') return 'FWD'
  if (c.includes('RUC') || c === 'R') return 'RUC'
  return 'MID'
}

// Lay out players in each zone as neat rows
function layoutPlayers(players: FieldPlayer[]): Array<FieldPlayer & { x: number; z: number }> {
  const groups: Record<'DEF' | 'MID' | 'RUC' | 'FWD', FieldPlayer[]> = {
    DEF: [], MID: [], RUC: [], FWD: [],
  }
  for (const p of players) {
    groups[zoneForPosition(p.position_code || p.position)].push(p)
  }
  const zY: Record<'DEF' | 'MID' | 'RUC' | 'FWD', number> = {
    DEF: -OVAL_LENGTH * 0.33,
    MID: -OVAL_LENGTH * 0.05,
    RUC: OVAL_LENGTH * 0.0,
    FWD: OVAL_LENGTH * 0.33,
  }
  const result: Array<FieldPlayer & { x: number; z: number }> = []
  for (const zone of ['DEF', 'MID', 'RUC', 'FWD'] as const) {
    const arr = groups[zone]
    const n = arr.length
    if (n === 0) continue
    // Arrange horizontally in a gentle arc across the oval width.
    // Ruck sits right on center.
    const widthSpan = Math.min(OVAL_WIDTH * 0.7, Math.max(4, n * 2.2))
    const startX = -widthSpan / 2
    const step = n === 1 ? 0 : widthSpan / (n - 1)
    arr.forEach((p, i) => {
      const x = n === 1 ? 0 : startX + step * i
      // arc the line slightly toward the goals
      const arc = zone === 'FWD' ? Math.cos((i - (n - 1) / 2) / n) * 1.2
                : zone === 'DEF' ? -Math.cos((i - (n - 1) / 2) / n) * 1.2
                : 0
      result.push({ ...p, x, z: zY[zone] + arc })
    })
  }
  return result
}

// Oval ground mesh — textured green with markings via canvas texture
function Oval({ children }: { children?: React.ReactNode }) {
  const texture = useMemo(() => {
    const cvs = document.createElement('canvas')
    cvs.width = 1024; cvs.height = 1024
    const ctx = cvs.getContext('2d')!
    // Grass stripes
    const w = cvs.width, h = cvs.height
    const cx = w / 2, cy = h / 2
    const lenPx = w * 0.95 / 2
    const widPx = h * 0.7 / 2
    // Outside (darker)
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, w, h)
    // Grass stripes
    const stripes = 10
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#1b4d2b' : '#1f5a32'
      ctx.beginPath()
      ctx.ellipse(cx, cy, lenPx, widPx, 0, (i / stripes) * Math.PI * 2, ((i + 1) / stripes) * Math.PI * 2)
      ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill()
    }
    // Full oval recolor (overwrite with green+stripes using vertical bands)
    ctx.save()
    ctx.beginPath()
    ctx.ellipse(cx, cy, lenPx, widPx, 0, 0, Math.PI * 2)
    ctx.clip()
    // Vertical alternating stripes
    const bands = 14
    const bw = w / bands
    for (let i = 0; i < bands; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#1e5b32' : '#1b5230'
      ctx.fillRect(i * bw, 0, bw, h)
    }
    // White boundary
    ctx.lineWidth = 6
    ctx.strokeStyle = '#ffffff'
    ctx.beginPath()
    ctx.ellipse(cx, cy, lenPx, widPx, 0, 0, Math.PI * 2)
    ctx.stroke()
    // Center square
    const csq = 80
    ctx.strokeRect(cx - csq / 2, cy - csq / 2, csq, csq)
    // Center circle + inner circle
    ctx.beginPath(); ctx.arc(cx, cy, 50, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.stroke()
    // 50m arcs (at each end)
    ctx.beginPath(); ctx.arc(cx, cy - widPx + 40, 120, 0.15 * Math.PI, 0.85 * Math.PI, true); ctx.stroke()
    ctx.beginPath(); ctx.arc(cx, cy + widPx - 40, 120, 1.15 * Math.PI, 1.85 * Math.PI, true); ctx.stroke()
    // Goal squares
    ctx.strokeRect(cx - 36, cy - widPx - 4, 72, 30)
    ctx.strokeRect(cx - 36, cy + widPx - 26, 72, 30)
    ctx.restore()
    const tex = new THREE.CanvasTexture(cvs)
    tex.anisotropy = 4
    return tex
  }, [])

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[OVAL_WIDTH * 1.3, OVAL_LENGTH * 1.3]} />
        <meshStandardMaterial map={texture} />
      </mesh>
      {children}
    </group>
  )
}

function PlayerMarker({ player, teamColor, onClick }: {
  player: FieldPlayer & { x: number; z: number }
  teamColor: string
  onClick?: () => void
}) {
  const [hover, setHover] = useState(false)
  const groupRef = useRef<THREE.Group>(null)

  // Gentle float animation
  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.position.y = 0.6 + Math.sin(clock.getElapsedTime() * 2 + player.id) * 0.05
    }
  })

  const color = player.is_captain ? '#d29922' : player.is_vice_captain ? '#bc8cff' : teamColor

  return (
    <group
      ref={groupRef}
      position={[player.x, 0.6, player.z]}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = 'default' }}
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
    >
      {/* Pole */}
      <mesh position={[0, -0.3, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.6, 8]} />
        <meshStandardMaterial color="#21262d" />
      </mesh>
      {/* Player disc */}
      <mesh castShadow>
        <cylinderGeometry args={[0.55, 0.55, 0.12, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hover ? 0.7 : 0.25} />
      </mesh>
      {/* Captain / VC ring */}
      {(player.is_captain || player.is_vice_captain) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
          <ringGeometry args={[0.6, 0.8, 32]} />
          <meshBasicMaterial color={player.is_captain ? '#d29922' : '#bc8cff'} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* Surname floats above */}
      <Text
        position={[0, 0.65, 0]}
        fontSize={0.35}
        color="#ffffff"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.02}
        outlineColor="#000"
      >
        {player.name.split(' ').slice(-1)[0].slice(0, 10).toUpperCase()}
      </Text>
      {/* Hover card */}
      {hover && (
        <Html distanceFactor={10} position={[0, 1.4, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(13,17,23,.95)', border: `1px solid ${color}`, borderRadius: 8,
            padding: '8px 12px', minWidth: 140, color: '#c9d1d9', fontSize: 12,
            boxShadow: `0 4px 20px ${color}66`,
            fontFamily: 'Inter, sans-serif',
            whiteSpace: 'nowrap',
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#e6edf3' }}>{player.name}</div>
            <div style={{ color: '#8b949e', fontSize: 11 }}>{player.afl_team} · {player.position}</div>
            <div style={{ marginTop: 4, display: 'flex', gap: 10 }}>
              <span>SC <b style={{ color: '#58a6ff' }}>{Math.round(player.sc_avg || 0)}</b></span>
              {player.score != null && <span>Rd <b style={{ color: '#3fb950' }}>{Math.round(player.score)}</b></span>}
            </div>
            {player.is_captain && <div style={{ marginTop: 4, color: '#d29922', fontWeight: 700, fontSize: 10 }}>CAPTAIN (2x)</div>}
            {player.is_vice_captain && <div style={{ marginTop: 4, color: '#bc8cff', fontWeight: 700, fontSize: 10 }}>VICE CAPTAIN</div>}
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
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 20, 5]} intensity={1.1} castShadow />
      <Oval />
      {laid.map(p => (
        <PlayerMarker key={p.id} player={p} teamColor={teamColor || '#58a6ff'} onClick={() => onPlayerClick?.(p)} />
      ))}
    </>
  )
}

export function Field3D({ players, teamColor = '#58a6ff', onPlayerClick }: Props) {
  const [reset, setReset] = useState(0)

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: 'min(75vh, 680px)',
      borderRadius: 12,
      overflow: 'hidden',
      background: 'linear-gradient(to bottom, #0d1117, #161b22)',
      border: '1px solid #21262d',
    }}>
      <Canvas
        key={reset}
        shadows
        camera={{ position: [0, 18, 22], fov: 42 }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <Scene players={players} teamColor={teamColor} onPlayerClick={onPlayerClick} />
        </Suspense>
        <OrbitControls
          enablePan={false}
          minDistance={14}
          maxDistance={42}
          maxPolarAngle={Math.PI / 2.2}
          minPolarAngle={Math.PI / 6}
          target={[0, 0, 0]}
        />
      </Canvas>

      {/* Controls overlay */}
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

      {/* Help hint */}
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
