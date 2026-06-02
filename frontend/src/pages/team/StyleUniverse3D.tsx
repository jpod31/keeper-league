import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stars, Line, Html } from '@react-three/drei'

export interface UniNode {
  id: number; name: string; pos: string; x: number; y: number; z: number
  cluster: number; archetype: string; sc: number; owned: boolean
}
const CL_COLORS = ['#3fe0ff', '#bc8cff', '#f0883e', '#3fb950', '#ff6b9d', '#ffd23f', '#58a6ff', '#ff5e57']

function OwnedNode({ p, color, onSelect }: { p: UniNode; color: string; onSelect: (id: number) => void }) {
  const [hov, setHov] = useState(false)
  const r = 0.16 + Math.min(1, (p.sc || 60) / 130) * 0.34
  return (
    <group position={[p.x, p.y, p.z]}>
      <mesh
        scale={hov ? 1.5 : 1}
        onPointerOver={e => { e.stopPropagation(); setHov(true); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { setHov(false); document.body.style.cursor = 'auto' }}
        onClick={e => { e.stopPropagation(); onSelect(p.id) }}
      >
        <sphereGeometry args={[r, 20, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hov ? 1.4 : 0.85} roughness={0.3} />
      </mesh>
      {/* halo */}
      <mesh>
        <sphereGeometry args={[r * 1.9, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={hov ? 0.22 : 0.1} />
      </mesh>
      {hov && (
        <Html center distanceFactor={16} style={{ pointerEvents: 'none' }}>
          <div style={{ background: 'rgba(10,16,24,.92)', border: `1px solid ${color}`, color: '#e6edf3', padding: '4px 9px', borderRadius: 6, fontSize: 11, whiteSpace: 'nowrap', transform: 'translateY(-26px)', boxShadow: `0 0 14px ${color}66` }}>
            <b>{p.name}</b> · {p.archetype} · {p.sc} SC
          </div>
        </Html>
      )}
    </group>
  )
}

function Scene({ nodes, onSelect }: { nodes: UniNode[]; onSelect: (id: number) => void }) {
  const { cloud, owned, links } = useMemo(() => {
    const others = nodes.filter(n => !n.owned)
    const owned = nodes.filter(n => n.owned)
    const pos = new Float32Array(others.length * 3)
    const col = new Float32Array(others.length * 3)
    others.forEach((n, i) => {
      pos[i * 3] = n.x; pos[i * 3 + 1] = n.y; pos[i * 3 + 2] = n.z
      const c = CL_COLORS[n.cluster % CL_COLORS.length]
      const r = parseInt(c.slice(1, 3), 16) / 255, g = parseInt(c.slice(3, 5), 16) / 255, b = parseInt(c.slice(5, 7), 16) / 255
      col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b
    })
    // cluster centroids (from all nodes) for connective lines
    const cents: Record<number, [number, number, number, number]> = {}
    nodes.forEach(n => { const a = cents[n.cluster] || [0, 0, 0, 0]; a[0] += n.x; a[1] += n.y; a[2] += n.z; a[3]++; cents[n.cluster] = a })
    const links = owned.map(n => {
      const a = cents[n.cluster]
      return { from: [n.x, n.y, n.z] as [number, number, number], to: [a[0] / a[3], a[1] / a[3], a[2] / a[3]] as [number, number, number], color: CL_COLORS[n.cluster % CL_COLORS.length] }
    })
    return { cloud: { pos, col, n: others.length }, owned, links }
  }, [nodes])

  return (
    <>
      <ambientLight intensity={0.7} />
      <pointLight position={[12, 14, 10]} intensity={140} />
      <Stars radius={60} depth={40} count={1800} factor={3} saturation={0} fade speed={0.6} />
      {/* league players as a faint nebula point-cloud */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[cloud.pos, 3]} count={cloud.n} />
          <bufferAttribute attach="attributes-color" args={[cloud.col, 3]} count={cloud.n} />
        </bufferGeometry>
        <pointsMaterial vertexColors size={0.32} sizeAttenuation transparent opacity={0.45} depthWrite={false} />
      </points>
      {links.map((l, i) => <Line key={i} points={[l.from, l.to]} color={l.color} lineWidth={1} transparent opacity={0.25} />)}
      {owned.map(p => <OwnedNode key={p.id} p={p} color={CL_COLORS[p.cluster % CL_COLORS.length]} onSelect={onSelect} />)}
      <OrbitControls enablePan={false} autoRotate autoRotateSpeed={0.5} minDistance={14} maxDistance={48} target={[0, 0, 0]} />
    </>
  )
}

export default function StyleUniverse3D({ nodes, onSelect }: { nodes: UniNode[]; onSelect: (id: number) => void }) {
  return (
    <Canvas camera={{ position: [16, 11, 20], fov: 50 }} dpr={[1, 2]} gl={{ alpha: true, antialias: true }} style={{ width: '100%', height: '100%' }}>
      <fog attach="fog" args={['#070b12', 30, 70]} />
      <Scene nodes={nodes} onSelect={onSelect} />
    </Canvas>
  )
}
