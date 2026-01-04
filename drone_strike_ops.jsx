import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { 
  Crosshair, Shield, Zap, Target, Navigation, 
  Radio, AlertTriangle, ChevronUp, ChevronDown, Flame, Wifi, Activity
} from 'lucide-react';

// --- CONFIGURATION ÉLITE ---
const CONFIG = {
  COLORS: {
    PRIMARY: 0x00ffff,   // Cyan Électrique
    DANGER: 0xff0033,    // Rouge Militaire
    GRID: 0x0a1a2a,      // Bleu Profond
    BG: 0x020406         // Noir Spatial
  },
  DRONE: {
    START_ALT: 80,
    SPEED: 220,
    ROTATION: 3.5
  }
};

const App = () => {
  const [gameState, setGameState] = useState('START');
  const [health, setHealth] = useState(100);
  const [energy, setEnergy] = useState(100);
  const [altitude, setAltitude] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [heading, setHeading] = useState(0);
  const [distanceToTarget, setDistanceToTarget] = useState(null);
  const [satMessage, setSatMessage] = useState("SYSTÈME PRÊT");
  const [isFiring, setIsFiring] = useState(false);

  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const droneRef = useRef(null);
  const targetRef = useRef(null);
  const projectiles = useRef([]);
  const keys = useRef({});
  const touchData = useRef({ active: false, x: 0, y: 0 });

  const triggerHaptic = (pattern) => {
    if ("vibrate" in navigator) navigator.vibrate(pattern);
  };

  const handleFire = () => {
    if (!droneRef.current || !sceneRef.current) return;
    triggerHaptic(45);
    setIsFiring(true);
    setTimeout(() => setIsFiring(false), 80);

    // Projectile avec traînée lumineuse
    const group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 8, 8), 
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 8, 8), 
      new THREE.MeshBasicMaterial({ color: CONFIG.COLORS.DANGER, transparent: true, opacity: 0.5 })
    );
    group.add(core, glow);
    group.position.copy(droneRef.current.position);
    sceneRef.current.add(group);
    
    const forward = new THREE.Vector3(0, -0.15, -8).applyQuaternion(droneRef.current.quaternion);
    projectiles.current.push({ mesh: group, velocity: forward, life: 180 });
  };

  useEffect(() => {
    if (gameState !== 'ACTION') return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // --- RENDERER PRO ---
    const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Optimisation mobile
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 1.5;
    mountRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(CONFIG.COLORS.BG);
    scene.fog = new THREE.FogExp2(CONFIG.COLORS.BG, 0.0012);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 8000);

    // --- ÉCLAIRAGE CINÉMATOGRAPHIQUE ---
    const ambient = new THREE.AmbientLight(0x4040ff, 0.2); // Ambiance bleutée
    scene.add(ambient);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(500, 1000, 500);
    scene.add(mainLight);

    // Point lumineux sous le drone pour effet "lampe tactique"
    const droneLight = new THREE.PointLight(CONFIG.COLORS.PRIMARY, 2, 100);
    scene.add(droneLight);

    // --- LE DRONE (DESIGN ÉPURÉ) ---
    const drone = new THREE.Group();
    const bodyGeo = new THREE.BoxGeometry(2.5, 0.4, 2);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.1 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    drone.add(body);
    
    // Bras de rotors avec néons
    [[-1.5, 1.5], [1.5, 1.5], [-1.5, -1.5], [1.5, -1.5]].forEach(([x, z]) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 1.5), bodyMat);
      arm.position.set(x/2, 0, z/2);
      arm.rotation.y = Math.PI / 4 * (x*z > 0 ? 1 : -1);
      drone.add(arm);
      const neon = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.8), new THREE.MeshBasicMaterial({ color: CONFIG.COLORS.PRIMARY }));
      neon.position.set(x/1.5, 0.1, z/1.5);
      drone.add(neon);
    });

    drone.position.set(0, CONFIG.DRONE.START_ALT, 0);
    scene.add(drone);
    droneRef.current = drone;

    // --- DÉCOR : MEGACITY NOCTURNE ---
    const grid = new THREE.GridHelper(10000, 100, CONFIG.COLORS.PRIMARY, CONFIG.COLORS.GRID);
    grid.material.transparent = true;
    grid.material.opacity = 0.2;
    scene.add(grid);

    for(let i=0; i<500; i++) {
      const h = Math.random() * 120 + 20;
      const w = 15 + Math.random() * 20;
      const bGeo = new THREE.BoxGeometry(w, h, w);
      const bMat = new THREE.MeshStandardMaterial({ 
        color: 0x05080c, 
        emissive: 0x00ffff, 
        emissiveIntensity: Math.random() > 0.9 ? 0.5 : 0 
      });
      const building = new THREE.Mesh(bGeo, bMat);
      building.position.set((Math.random()-0.5)*5000, h/2, (Math.random()-0.5)*5000);
      scene.add(building);
    }

    // --- CIBLE (Silo Haute-Technologie) ---
    const target = new THREE.Group();
    const silo = new THREE.Mesh(
      new THREE.CylinderGeometry(10, 12, 40, 6), 
      new THREE.MeshStandardMaterial({ color: 0x220000, emissive: CONFIG.COLORS.DANGER, emissiveIntensity: 0.5 })
    );
    target.add(silo);
    // Laser Volumétrique (Faux)
    const laser = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 5000, 8), 
      new THREE.MeshBasicMaterial({ color: CONFIG.COLORS.DANGER, transparent: true, opacity: 0.2 })
    );
    laser.position.y = 2500;
    target.add(laser);
    target.position.set((Math.random()-0.5)*2000, 20, (Math.random()-0.5)*2000);
    scene.add(target);
    targetRef.current = target;

    let velocity = new THREE.Vector3();
    const clock = new THREE.Clock();

    const animate = () => {
      if (gameState !== 'ACTION') return;
      requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // Mouvements fluides
      const sBase = CONFIG.DRONE.SPEED * delta;
      const rBase = CONFIG.DRONE.ROTATION * delta;

      if (keys.current['q'] || (touchData.current.active && touchData.current.x < -0.2)) drone.rotation.y += rBase;
      if (keys.current['d'] || (touchData.current.active && touchData.current.x > 0.2)) drone.rotation.y -= rBase;

      const moveDir = new THREE.Vector3();
      if (keys.current['z'] || (touchData.current.active && touchData.current.y < -0.2)) moveDir.z = -1;
      if (keys.current['s'] || (touchData.current.active && touchData.current.y > 0.2)) moveDir.z = 1;
      moveDir.applyQuaternion(drone.quaternion);
      velocity.addScaledVector(moveDir, sBase);

      if (keys.current['up_active'] || keys.current['Shift']) drone.position.y += sBase * 0.7;
      if (keys.current['down_active'] || keys.current['Control']) drone.position.y -= sBase * 0.7;
      drone.position.y = Math.max(8, drone.position.y);

      velocity.multiplyScalar(0.96);
      drone.position.add(velocity);
      droneLight.position.copy(drone.position).y -= 2;

      // Projectiles
      for (let i = projectiles.current.length - 1; i >= 0; i--) {
        const p = projectiles.current[i];
        p.mesh.position.add(p.velocity);
        p.life--;
        if (p.life <= 0 || p.mesh.position.y <= 0) {
          if (p.mesh.position.distanceTo(target.position) < 30) {
            triggerHaptic([200, 100, 200]);
            setSatMessage("CIBLE ÉLIMINÉE - RETOUR BASE");
          }
          scene.remove(p.mesh);
          projectiles.current.splice(i, 1);
        }
      }

      // Caméra Dynamique (Spring Arm)
      const idealPos = new THREE.Vector3(0, 12, 30).applyQuaternion(drone.quaternion).add(drone.position);
      camera.position.lerp(idealPos, 0.12);
      camera.lookAt(drone.position.clone().add(new THREE.Vector3(0, -5, -60).applyQuaternion(drone.quaternion)));

      setAltitude(Math.round(drone.position.y));
      setSpeed(Math.round(velocity.length() * 30));
      setHeading(Math.floor((drone.rotation.y * (180/Math.PI)) % 360));
      setDistanceToTarget(Math.round(drone.position.distanceTo(target.position)));

      renderer.render(scene, camera);
    };

    animate();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', (e) => keys.current[e.key] = true);
    window.addEventListener('keyup', (e) => keys.current[e.key] = false);

    return () => {
      window.removeEventListener('resize', onResize);
      if (mountRef.current) mountRef.current.removeChild(renderer.domElement);
    };
  }, [gameState]);

  return (
    <div className={`relative w-full h-screen bg-black text-white font-mono overflow-hidden transition-all duration-150 ${isFiring ? 'brightness-150 ring-inset ring-8 ring-red-600/20' : ''}`}>
      <div ref={mountRef} className="absolute inset-0 z-0" />

      {gameState === 'ACTION' && (
        <div className="absolute inset-0 z-10 pointer-events-none p-6 flex flex-col justify-between">
          
          {/* HUD : GLASS MORPHISM STYLE */}
          <div className="flex justify-between items-start">
            <div className="bg-white/5 border border-white/10 p-4 backdrop-blur-xl rounded-xl shadow-2xl">
              <div className="flex items-center gap-4 mb-3">
                <Activity className="w-5 h-5 text-cyan-400" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-cyan-400/60 uppercase font-black">Coque Intégrité</span>
                  <div className="w-40 h-1.5 bg-cyan-950 mt-1 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-[0_0_10px_cyan]" style={{width: `${health}%`}}></div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold tracking-widest text-green-500">LIEN SATELLITE STABLE</span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-2xl font-black italic text-cyan-400 drop-shadow-lg tracking-tighter">VIRTUAL_STRIKE_OS</div>
              <div className="text-[9px] text-white/40 uppercase">Encodage Neuronal v4.2</div>
            </div>
          </div>

          {/* CENTRE : VISEUR TACTIQUE */}
          <div className="flex flex-1 items-center justify-between px-12">
            <div className="space-y-8">
              <div className="bg-black/40 p-4 border-l-2 border-cyan-500 backdrop-blur-sm">
                <div className="text-[10px] text-cyan-500 font-black uppercase mb-1">Vitesse</div>
                <div className="text-4xl font-black tracking-tighter">{speed} <span className="text-sm font-light opacity-50">KTS</span></div>
              </div>
            </div>

            <div className="relative group">
              <div className="w-32 h-32 border border-white/10 rounded-full flex items-center justify-center relative">
                <div className="absolute inset-0 border-t-2 border-cyan-500 rounded-full animate-spin [animation-duration:4s]"></div>
                <Crosshair className="w-12 h-12 text-cyan-400 opacity-80" strokeWidth={1} />
                <div className="absolute w-2 h-2 bg-red-500 rounded-full shadow-[0_0_15px_red]"></div>
              </div>
              {distanceToTarget && (
                <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-2 rounded-full shadow-2xl animate-bounce">
                  <div className="text-[8px] font-black uppercase text-center leading-none mb-1">Lock-On</div>
                  <div className="text-lg font-black">{distanceToTarget}M</div>
                </div>
              )}
            </div>

            <div className="space-y-8">
              <div className="bg-black/40 p-4 border-r-2 border-cyan-500 backdrop-blur-sm text-right">
                <div className="text-[10px] text-cyan-500 font-black uppercase mb-1">Altitude</div>
                <div className="text-4xl font-black tracking-tighter">{altitude} <span className="text-sm font-light opacity-50">FT</span></div>
              </div>
            </div>
          </div>

          {/* BOTTOM : CONTRÔLES HAUTE DENSITÉ */}
          <div className="flex justify-between items-end gap-6 pointer-events-auto">
            
            <div className="w-32 h-32 bg-black/60 border border-white/10 backdrop-blur-xl p-2 rounded-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/5 to-transparent"></div>
              <Navigation className="w-full h-full p-6 text-cyan-400/80 transition-transform duration-300" style={{ transform: `rotate(${-heading}deg)` }} />
              <div className="absolute bottom-2 left-0 w-full text-center text-[8px] font-black text-cyan-500/50">AZIMUT {heading}°</div>
            </div>

            <div className="flex-1 max-w-md mx-4 pb-4">
              <div className="bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-2xl shadow-inner relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></div>
                <div className="flex items-center gap-3 mb-2 justify-center">
                  <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest">Canal Tactique</span>
                </div>
                <div className="text-sm text-white font-medium italic text-center leading-snug">"{satMessage}"</div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex flex-col gap-3">
                <button 
                  onPointerDown={() => keys.current['up_active'] = true}
                  onPointerUp={() => keys.current['up_active'] = false}
                  className="w-16 h-16 bg-white/5 hover:bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center transition-all active:scale-90"
                >
                  <ChevronUp className="w-8 h-8 text-cyan-400" />
                </button>
                <button 
                  onPointerDown={() => keys.current['down_active'] = true}
                  onPointerUp={() => keys.current['down_active'] = false}
                  className="w-16 h-16 bg-white/5 hover:bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center transition-all active:scale-90"
                >
                  <ChevronDown className="w-8 h-8 text-cyan-400" />
                </button>
              </div>

              <button 
                onClick={handleFire}
                className="w-28 h-28 bg-gradient-to-br from-red-600 to-red-900 border-2 border-red-500 rounded-3xl flex flex-col items-center justify-center shadow-[0_0_40px_rgba(255,0,0,0.4)] active:scale-95 transition-all group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-active:translate-y-0 transition-transform"></div>
                <Flame className="w-10 h-10 text-white mb-1 drop-shadow-md" />
                <span className="text-xs font-black text-white uppercase tracking-tighter">Strike</span>
              </button>

              <div className="w-44 h-44 bg-white/5 border-2 border-white/10 rounded-[2.5rem] relative touch-none shadow-inner backdrop-blur-xl flex items-center justify-center"
                   onTouchStart={(e) => {
                     const r = e.currentTarget.getBoundingClientRect();
                     const t = e.touches[0];
                     touchData.current = { active: true, x: (t.clientX - (r.left + 88))/88, y: (t.clientY - (r.top + 88))/88 };
                     triggerHaptic(15);
                   }}
                   onTouchMove={(e) => {
                     const r = e.currentTarget.getBoundingClientRect();
                     const t = e.touches[0];
                     touchData.current = { active: true, x: (t.clientX - (r.left + 88))/88, y: (t.clientY - (r.top + 88))/88 };
                   }}
                   onTouchEnd={() => touchData.current = { active: false, x: 0, y: 0 }}>
                <div className="w-16 h-16 bg-cyan-400 rounded-3xl shadow-[0_0_30px_#00ffff] border-2 border-white/50"
                     style={{ transform: `translate(${touchData.current.x * 60}px, ${touchData.current.y * 60}px)` }} />
              </div>
            </div>

          </div>
        </div>
      )}

      {/* OVERLAY START : CINEMATIC DESIGN */}
      {gameState === 'START' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black">
          <div className="relative mb-20">
            <Target className="w-40 h-40 text-cyan-500/20 absolute -top-10 -left-10 animate-pulse scale-150" strokeWidth={0.5} />
            <Target className="w-40 h-40 text-cyan-500 animate-pulse" strokeWidth={1} />
            <div className="absolute inset-0 bg-cyan-500/30 blur-[100px] rounded-full animate-pulse"></div>
          </div>
          
          <h1 className="text-8xl font-black italic tracking-tighter text-white mb-2 leading-none">VIRTUAL <span className="text-cyan-500">STRIKE</span></h1>
          <p className="text-sm font-bold tracking-[1em] text-cyan-500/50 uppercase mb-20 pl-4">Advanced Warfare Simulator</p>
          
          <div className="flex flex-col items-center gap-6">
            <button 
              onClick={() => { triggerHaptic(60); setGameState('ACTION'); }}
              className="group relative px-20 py-6 bg-transparent border-2 border-cyan-500 overflow-hidden"
            >
              <div className="absolute inset-0 bg-cyan-500 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              <span className="relative z-10 font-black text-xl tracking-[0.4em] uppercase group-hover:text-black transition-colors">Initialiser</span>
            </button>
            <div className="flex gap-8 text-[10px] text-white/40 font-bold uppercase tracking-widest">
              <span>PC Control : ZQSD + Shift</span>
              <span className="text-cyan-500/50">|</span>
              <span>Mobile : Touch Interface</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
