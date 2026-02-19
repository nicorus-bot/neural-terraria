import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- Constants ---
const WORLD_WIDTH = 300;
const WORLD_HEIGHT = 150;
const TILE_SIZE = 32;
const GRAVITY = 0.45;
const JUMP_FORCE = -9.5;
const MOVE_SPEED = 5.0;
const FRICTION = 0.8;

const TILE_TYPES = { 
    AIR: 0, DIRT: 1, GRASS: 2, STONE: 3, WOOD: 4, LEAVES: 5, 
    LAVA: 6, ASH: 7, HELLSTONE: 8, BRICK: 9, ORE_GOLD: 10, 
    CORRUPT_GRASS: 11, TORCH: 12 
};

const TILE_COLORS = {
    [TILE_TYPES.AIR]: null, [TILE_TYPES.DIRT]: '#8B4513', [TILE_TYPES.GRASS]: '#4CAF50', [TILE_TYPES.STONE]: '#757575',
    [TILE_TYPES.WOOD]: '#5D4037', [TILE_TYPES.LEAVES]: '#2E7D32', [TILE_TYPES.LAVA]: '#FF4500', [TILE_TYPES.ASH]: '#444444',
    [TILE_TYPES.HELLSTONE]: '#FF0000', [TILE_TYPES.BRICK]: '#BDBDBD', [TILE_TYPES.ORE_GOLD]: '#FFD700', [TILE_TYPES.CORRUPT_GRASS]: '#9C27B0',
    [TILE_TYPES.TORCH]: '#FFD54F',
};

const PIXEL_PATTERNS = {
    [TILE_TYPES.DIRT]: [[0,0,1,0], [0,1,1,1], [1,1,0,1], [0,1,1,1]],
    [TILE_TYPES.GRASS]: [[2,2,2,2], [2,2,2,2], [2,1,2,1], [1,1,1,1]],
    [TILE_TYPES.STONE]: [[0,0,0,0], [0,1,1,0], [0,1,0,0], [0,1,1,0]],
};

const App = () => {
    const canvasRef = useRef(null);
    const worldRef = useRef([]);
    const playerRef = useRef({ x: 3000, y: 500, vx: 0, vy: 0, w: 18, h: 34, onGround: false, hp: 100, maxHp: 100, mana: 100, maxMana: 100, facing: 1 });
    const keysRef = useRef({ left: false, right: false, jump: false });
    const cameraRef = useRef({ x: 0, y: 0 });
    const projectilesRef = useRef([]);
    const enemiesRef = useRef([]);
    const audioCtxRef = useRef(null);
    const timeRef = useRef(0);
    const screenShakeRef = useRef(0);
    
    const [selectedSlot, setSelectedSlot] = useState(2);
    const [isMobile, setIsMobile] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [stats, setStats] = useState({ hp: 100, mana: 100 });

    // BGM Synthesis (Separated from Game Loop to avoid re-runs)
    const initBGM = () => {
        if (audioCtxRef.current) return;
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtxRef.current = ctx;
        const melody = [{f:261,d:0.3},{f:329,d:0.3},{f:392,d:0.3},{f:523,d:0.6},{f:493,d:0.3},{f:392,d:0.3},{f:261,d:0.6}];
        let nextTime = ctx.currentTime;
        const loop = () => {
            melody.forEach(n => {
                const osc = ctx.createOscillator(); const gain = ctx.createGain();
                osc.type = 'triangle'; osc.frequency.setValueAtTime(n.f, nextTime);
                gain.gain.setValueAtTime(0.03, nextTime); gain.gain.exponentialRampToValueAtTime(0.0001, nextTime + n.d * 2);
                osc.connect(gain); gain.connect(ctx.destination);
                osc.start(nextTime); osc.stop(nextTime + n.d * 2);
                nextTime += n.d;
            });
            setTimeout(loop, (nextTime - ctx.currentTime) * 1000 - 50);
        };
        loop();
    };

    useEffect(() => {
        // World Generation (ONCE)
        const newWorld = [];
        for (let y = 0; y < WORLD_HEIGHT; y++) {
            const row = [];
            for (let x = 0; x < WORLD_WIDTH; x++) {
                const surfaceY = 50 + Math.sin(x * 0.1) * 6;
                if (y > WORLD_HEIGHT - 20) row.push(TILE_TYPES.ASH);
                else if (y > surfaceY + 20) row.push(TILE_TYPES.STONE);
                else if (y > surfaceY) row.push(TILE_TYPES.DIRT);
                else if (y > surfaceY - 1) row.push(TILE_TYPES.GRASS);
                else row.push(TILE_TYPES.AIR);
            }
            newWorld.push(row);
        }
        worldRef.current = newWorld;
        enemiesRef.current = [{ type: 'KING_SLIME', x: 2000, y: 400, vx: 0, vy: 0, w: 100, h: 80, hp: 1000, maxHp: 1000, lastJump: 0, lastHit: 0 }];

        const handleResize = () => {
            if (canvasRef.current) {
                canvasRef.current.width = window.innerWidth;
                canvasRef.current.height = window.innerHeight;
            }
            setIsMobile(window.innerWidth < 1024);
        };
        window.addEventListener('resize', handleResize); handleResize();

        const triggerAudio = () => { initBGM(); window.removeEventListener('click', triggerAudio); };
        window.addEventListener('click', triggerAudio);

        const down = (e) => { 
            if(e.code === 'ArrowLeft' || e.code === 'KeyA') keysRef.current.left = true;
            if(e.code === 'ArrowRight' || e.code === 'KeyD') keysRef.current.right = true;
            if(e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') keysRef.current.jump = true;
        };
        const up = (e) => { 
            if(e.code === 'ArrowLeft' || e.code === 'KeyA') keysRef.current.left = false;
            if(e.code === 'ArrowRight' || e.code === 'KeyD') keysRef.current.right = false;
            if(e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') keysRef.current.jump = false;
        };
        window.addEventListener('keydown', down); window.addEventListener('keyup', up);
        
        let fId;
        const loop = () => { update(); draw(); fId = requestAnimationFrame(loop); };
        fId = requestAnimationFrame(loop);
        return () => { window.removeEventListener('resize', handleResize); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); cancelAnimationFrame(fId); };
    }, []);

    useEffect(() => {
        if (audioCtxRef.current) {
            if (isMuted) audioCtxRef.current.suspend();
            else audioCtxRef.current.resume();
        }
    }, [isMuted]);

    const update = () => {
        const p = playerRef.current; const keys = keysRef.current;
        timeRef.current++;
        if (screenShakeRef.current > 0) screenShakeRef.current -= 0.5;

        // --- Correct Horizontal Movement ---
        if (keys.left) { p.vx = -MOVE_SPEED; p.facing = -1; }
        else if (keys.right) { p.vx = MOVE_SPEED; p.facing = 1; }
        else { p.vx *= FRICTION; }
        if (Math.abs(p.vx) < 0.1) p.vx = 0;

        // Physics
        const isFlying = inventory[selectedSlot].type === 'WINGS' && keys.jump;
        p.vy += isFlying ? 0.15 : GRAVITY;
        if (keys.jump) {
            if (p.onGround) { p.vy = JUMP_FORCE; p.onGround = false; }
            else if (isFlying && p.mana > 0) { p.vy = -5; p.mana -= 0.5; }
        }
        
        // Axis-separated collision resolution (Direction Aware)
        p.x += p.vx;
        resolveXCollisions(p);
        p.y += p.vy;
        p.onGround = false;
        resolveYCollisions(p);
        
        cameraRef.current.x += (p.x - window.innerWidth / 2 - cameraRef.current.x) * 0.1;
        cameraRef.current.y += (p.y - window.innerHeight / 2 - cameraRef.current.y) * 0.1;

        if (timeRef.current % 60 === 0) { if (p.mana < p.maxMana) p.mana += 5; if (p.hp < p.maxHp) p.hp += 1; }
        if (stats.hp !== Math.floor(p.hp) || stats.mana !== Math.floor(p.mana)) setStats({ hp: Math.floor(p.hp), mana: Math.floor(p.mana) });

        projectilesRef.current = projectilesRef.current.filter(proj => {
            proj.life -= 0.02; proj.x += proj.vx; proj.y += proj.vy;
            enemiesRef.current.forEach(en => {
                const dx = proj.x - (en.x + en.w / 2), dy = proj.y - (en.y + en.h / 2), dist = Math.sqrt(dx * dx + dy * dy);
                if (en.hp > 0 && dist < en.w / 2 + 15) { en.hp -= 25; proj.life = 0; en.lastHit = Date.now(); screenShakeRef.current = 4; }
            });
            return proj.life > 0;
        });

        enemiesRef.current.forEach(en => {
            if (en.hp <= 0) return;
            en.vy += GRAVITY; en.y += en.vy;
            const tx = Math.floor((en.x + en.w/2) / TILE_SIZE), ty = Math.floor((en.y + en.h) / TILE_SIZE);
            if (worldRef.current[ty] && worldRef.current[ty][tx] !== TILE_TYPES.AIR) { en.y = ty * TILE_SIZE - en.h; en.vy = 0; if (Date.now() - en.lastJump > 2000) { en.vy = -12; en.vx = (p.x - en.x > 0 ? 1 : -1) * 4; en.lastJump = Date.now(); } }
            en.x += en.vx; en.vx *= 0.95;
            const dx = p.x - en.x, dy = p.y - en.y;
            if (Math.abs(dx) < en.w && Math.abs(dy) < en.h && timeRef.current % 40 === 0) { p.hp -= 10; screenShakeRef.current = 8; }
        });

        if (p.x < 0) p.x = 0; if (p.x > WORLD_WIDTH * TILE_SIZE - p.w) p.x = WORLD_WIDTH * TILE_SIZE - p.w;
    };

    const resolveXCollisions = (p) => {
        const x1 = Math.floor(p.x / TILE_SIZE), x2 = Math.floor((p.x + p.w) / TILE_SIZE);
        const y1 = Math.floor(p.y / TILE_SIZE), y2 = Math.floor((p.y + p.h) / TILE_SIZE);
        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) continue;
                if (worldRef.current[y][x] !== TILE_TYPES.AIR && worldRef.current[y][x] !== TILE_TYPES.LAVA) {
                    if (p.vx > 0) p.x = x * TILE_SIZE - p.w - 0.1;
                    else if (p.vx < 0) p.x = (x + 1) * TILE_SIZE + 0.1;
                    p.vx = 0;
                }
            }
        }
    };

    const resolveYCollisions = (p) => {
        const x1 = Math.floor(p.x / TILE_SIZE), x2 = Math.floor((p.x + p.w) / TILE_SIZE);
        const y1 = Math.floor(p.y / TILE_SIZE), y2 = Math.floor((p.y + p.h) / TILE_SIZE);
        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) continue;
                if (worldRef.current[y][x] !== TILE_TYPES.AIR && worldRef.current[y][x] !== TILE_TYPES.LAVA) {
                    if (p.vy > 0) { p.y = y * TILE_SIZE - p.h - 0.1; p.onGround = true; }
                    else if (p.vy < 0) p.y = (y + 1) * TILE_SIZE + 0.1;
                    p.vy = 0;
                }
            }
        }
    };

    const draw = () => {
        const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); const cam = cameraRef.current;
        const p = playerRef.current;
        ctx.fillStyle = '#87CEEB'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        const sX = (Math.random()-0.5) * screenShakeRef.current, sY = (Math.random()-0.5) * screenShakeRef.current;
        ctx.translate(-Math.floor(cam.x) + sX, -Math.floor(cam.y) + sY);

        const startX = Math.max(0, Math.floor(cam.x / TILE_SIZE)), endX = Math.min(WORLD_WIDTH, Math.ceil((cam.x + canvas.width) / TILE_SIZE));
        const startY = Math.max(0, Math.floor(cam.y / TILE_SIZE)), endY = Math.min(WORLD_HEIGHT, Math.ceil((cam.y + canvas.height) / TILE_SIZE));
        
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const t = worldRef.current[y][x];
                if (t !== TILE_TYPES.AIR) {
                    ctx.fillStyle = TILE_COLORS[t];
                    ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                }
            }
        }
        
        ctx.save(); ctx.translate(p.x+p.w/2, p.y+p.h/2); if (p.facing < 0) ctx.scale(-1, 1);
        ctx.fillStyle = '#37474F'; ctx.fillRect(-12, -20, 24, 16); ctx.fillStyle = '#00E5FF'; ctx.fillRect(2, -14, 10, 4);
        ctx.fillStyle = '#455A64'; ctx.fillRect(-10, -4, 20, 20); ctx.fillStyle = '#D32F2F';
        ctx.beginPath(); ctx.moveTo(-10, -4); ctx.lineTo(-25, 4); ctx.lineTo(-10, 18); ctx.fill(); ctx.restore();

        projectilesRef.current.forEach(proj => {
            ctx.save(); ctx.translate(proj.x, proj.y); ctx.shadowBlur = 10; ctx.shadowColor = proj.color; ctx.fillStyle = proj.color;
            ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.fill(); ctx.restore();
        });

        enemiesRef.current.forEach(en => {
            if (en.hp <= 0) return;
            ctx.fillStyle = 'rgba(0, 150, 255, 0.7)'; ctx.beginPath(); ctx.arc(en.x+en.w/2, en.y+en.h/2, en.w/2, 0, Math.PI*2); ctx.fill();
        });
        ctx.restore();
    };

    const handleAction = (e) => {
        if (e.cancelable) e.preventDefault();
        const rect = canvasRef.current.getBoundingClientRect();
        let cX, cY; if (e.touches) { cX = e.touches[0].clientX; cY = e.touches[0].clientY; } else { cX = e.clientX; cY = e.clientY; }
        const mX = cX - rect.left + cameraRef.current.x, mY = cY - rect.top + cameraRef.current.y;
        if (cY < 150 && cX < 500) return;

        const item = inventory[selectedSlot]; const p = playerRef.current;
        if (item.isWeapon) {
            const angle = Math.atan2(mY-(p.y+p.h/2), mX-(p.x+p.w/2));
            projectilesRef.current.push({ x: p.x+p.w/2, y: p.y+p.h/2, vx: Math.cos(angle)*15, vy: Math.sin(angle)*15, color: item.type === 'ZENITH' ? '#00f2ff' : '#E040FB', life: 1.5, dmg: 40 });
        } else {
            const tx = Math.floor(mX/TILE_SIZE), ty = Math.floor(mY/TILE_SIZE);
            if (tx >= 0 && tx < WORLD_WIDTH && ty >= 0 && ty < WORLD_HEIGHT) worldRef.current[ty][tx] = (worldRef.current[ty][tx] === TILE_TYPES.AIR) ? item.type : TILE_TYPES.AIR;
        }
    };

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', touchAction: 'none', background: '#000', userSelect: 'none' }}>
            <canvas ref={canvasRef} onMouseDown={handleAction} onTouchStart={handleAction} style={{ display: 'block' }} />
            
            <div style={{ position: 'fixed', top: '20px', right: '20px', textAlign: 'right', zIndex: 100 }}>
                <div style={{ color: '#fff', fontSize: '1.4em', fontWeight: 'bold', fontFamily: 'Orbitron' }}>NEURAL TERRARIA v18</div>
                <div style={{ width: '200px', height: '18px', background: 'rgba(0,0,0,0.6)', border: '2px solid #fff', borderRadius: '9px', margin: '10px 0', overflow: 'hidden' }}>
                    <div style={{ width: `${stats.hp}%`, height: '100%', background: '#ff1744' }} />
                </div>
                <div style={{ width: '150px', height: '10px', background: 'rgba(0,0,0,0.6)', border: '2px solid #fff', borderRadius: '5px', marginLeft: '50px', overflow: 'hidden' }}>
                    <div style={{ width: `${stats.mana}%`, height: '100%', background: '#2979ff' }} />
                </div>
            </div>

            <div style={{ position: 'fixed', top: '20px', left: '20px', display: 'flex', gap: '10px', zIndex: 100 }}>
                {inventory.map((item, idx) => (
                    <div key={idx} onPointerDown={(e) => { e.stopPropagation(); setSelectedSlot(idx); }} style={{ width: '55px', height: '55px', background: selectedSlot === idx ? '#fff' : 'rgba(255,255,255,0.4)', border: selectedSlot === idx ? '4px solid #ff4081' : '2px solid #fff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>{item.label}</div>
                ))}
            </div>

            {isMobile && (
                <div style={{ position: 'fixed', bottom: '40px', left: '40px', right: '40px', display: 'flex', justifyContent: 'space-between', zIndex: 100, pointerEvents: 'none' }}>
                    <div style={{ display: 'flex', gap: '20px', pointerEvents: 'auto' }}>
                        <button onTouchStart={() => keysRef.current.left = true} onTouchEnd={() => keysRef.current.left = false} className="ctrl-btn">←</button>
                        <button onTouchStart={() => keysRef.current.right = true} onTouchEnd={() => keysRef.current.right = false} className="ctrl-btn">→</button>
                    </div>
                    <button onTouchStart={() => keysRef.current.jump = true} onTouchEnd={() => keysRef.current.jump = false} className="ctrl-btn" style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(0, 242, 255, 0.4)', fontSize: '1.5em' }}>JUMP</button>
                </div>
            )}
            <style>{`.ctrl-btn { width: 75px; height: 75px; background: rgba(255,255,255,0.15); border: 3px solid #fff; border-radius: 20px; color: #fff; font-weight: bold; font-size: 2.5em; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px); pointer-events: auto; -webkit-tap-highlight-color: transparent; }`}</style>
        </div>
    );
};

export default App;
