import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- Constants ---
const WORLD_WIDTH = 300;
const WORLD_HEIGHT = 150;
const TILE_SIZE = 32;
const GRAVITY = 0.45;
const JUMP_FORCE = -9.5;
const MOVE_SPEED = 5.2;
const FRICTION = 0.85;

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

const App = () => {
    const canvasRef = useRef(null);
    const worldRef = useRef([]);
    const playerRef = useRef({ x: 4800, y: 500, vx: 0, vy: 0, w: 20, h: 36, onGround: false, hp: 100, maxHp: 100, mana: 100, maxMana: 100, facing: 1 });
    const keysRef = useRef({ left: false, right: false, jump: false });
    const cameraRef = useRef({ x: 0, y: 0 });
    const projectilesRef = useRef([]);
    const enemiesRef = useRef([]);
    const particlesRef = useRef([]);
    const audioCtxRef = useRef(null);
    const timeRef = useRef(0);
    const screenShakeRef = useRef(0);
    
    const [selectedSlot, setSelectedSlot] = useState(2);
    const [isMobile, setIsMobile] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [gameTime, setGameTime] = useState(0); 
    const [stats, setStats] = useState({ hp: 100, mana: 100 });

    const inventory = [
        { type: TILE_TYPES.BRICK, label: '🧱', color: TILE_COLORS[TILE_TYPES.BRICK] },
        { type: TILE_TYPES.TORCH, label: '🔦', color: TILE_COLORS[TILE_TYPES.TORCH] },
        { type: 'ZENITH', label: '⚔️', color: 'linear-gradient(45deg, #00f2ff, #bf00ff)', isWeapon: true },
        { type: 'STAFF', label: '🪄', color: '#E040FB', isWeapon: true },
        { type: 'WINGS', label: '🦋', color: '#fff', isPassive: true },
    ];

    const startBGM = useCallback(() => {
        if (audioCtxRef.current) return;
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        const melody = [{f:261,d:0.3},{f:329,d:0.3},{f:392,d:0.3},{f:523,d:0.6},{f:493,d:0.3},{f:392,d:0.3},{f:261,d:0.6}];
        let nextTime = audioCtxRef.current.currentTime;
        const loop = () => {
            if (isMuted) { setTimeout(loop, 1000); return; }
            melody.forEach(n => {
                const osc = audioCtxRef.current.createOscillator();
                const gain = audioCtxRef.current.createGain();
                osc.type = 'triangle'; osc.frequency.setValueAtTime(gameTime > 12000 ? n.f * 0.8 : n.f, nextTime);
                gain.gain.setValueAtTime(0.04, nextTime); gain.gain.exponentialRampToValueAtTime(0.0001, nextTime + n.d * 3);
                osc.connect(gain); gain.connect(audioCtxRef.current.destination);
                osc.start(nextTime); osc.stop(nextTime + n.d * 3);
                nextTime += n.d;
            });
            setTimeout(loop, (nextTime - audioCtxRef.current.currentTime) * 1000 - 50);
        };
        loop();
    }, [isMuted, gameTime]);

    useEffect(() => {
        const newWorld = [];
        for (let y = 0; y < WORLD_HEIGHT; y++) {
            const row = [];
            for (let x = 0; x < WORLD_WIDTH; x++) {
                const surfaceY = 40 + Math.sin(x * 0.08) * 8;
                if (y > WORLD_HEIGHT - 20) row.push(Math.random() < 0.2 ? TILE_TYPES.LAVA : TILE_TYPES.ASH);
                else if (y > WORLD_HEIGHT - 40) row.push(TILE_TYPES.HELLSTONE);
                else if (y > surfaceY + 10 && Math.random() < 0.06) row.push(TILE_TYPES.AIR);
                else if (y > surfaceY + 20) row.push(Math.random() < 0.02 ? TILE_TYPES.ORE_GOLD : TILE_TYPES.STONE);
                else if (y > surfaceY) row.push(TILE_TYPES.DIRT);
                else if (y > surfaceY - 1) row.push(TILE_TYPES.GRASS);
                else row.push(TILE_TYPES.AIR);
            }
            newWorld.push(row);
        }
        worldRef.current = newWorld;
        enemiesRef.current = [
            { type: 'KING_SLIME', x: 2500, y: 400, vx: 0, vy: 0, w: 120, h: 90, hp: 2000, maxHp: 2000, lastJump: 0, lastHit: 0 },
            { type: 'EYE', x: 1000, y: 200, vx: 0, vy: 0, w: 40, h: 40, hp: 500, maxHp: 500, lastHit: 0 }
        ];

        const handleResize = () => {
            const canvas = canvasRef.current;
            if (canvas) {
                const dpr = window.devicePixelRatio || 1;
                canvas.width = window.innerWidth * dpr;
                canvas.height = window.innerHeight * dpr;
                canvas.style.width = window.innerWidth + 'px';
                canvas.style.height = window.innerHeight + 'px';
                const ctx = canvas.getContext('2d');
                ctx.scale(dpr, dpr);
            }
            setIsMobile(window.innerWidth < 1024);
        };
        window.addEventListener('resize', handleResize);
        handleResize();

        const triggerAudio = () => { startBGM(); window.removeEventListener('click', triggerAudio); };
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
    }, [startBGM]);

    const update = () => {
        const p = playerRef.current; const keys = keysRef.current;
        timeRef.current++;
        setGameTime(prev => (prev + 3) % 24000);
        if (screenShakeRef.current > 0) screenShakeRef.current -= 0.5;

        // Movement Logic
        let targetVx = 0;
        if (keys.left) { targetVx = -MOVE_SPEED; p.facing = -1; }
        else if (keys.right) { targetVx = MOVE_SPEED; p.facing = 1; }
        p.vx = targetVx || (p.vx * FRICTION);
        
        // Auto-Jump (Step-up)
        if (p.onGround && targetVx !== 0) {
            const sideX = targetVx > 0 ? p.x + p.w + 2 : p.x - 2;
            const tx = Math.floor(sideX / TILE_SIZE);
            const tyFoot = Math.floor((p.y + p.h - 2) / TILE_SIZE);
            const tyHead = Math.floor((p.y + 2) / TILE_SIZE);
            const tyAbove = Math.floor((p.y - TILE_SIZE + p.h - 2) / TILE_SIZE);
            
            if (worldRef.current[tyFoot] && worldRef.current[tyFoot][tx] !== TILE_TYPES.AIR) {
                // If foot is blocked but head space is free, auto-step
                if (worldRef.current[tyAbove] && worldRef.current[tyAbove][tx] === TILE_TYPES.AIR) {
                    p.y -= TILE_SIZE;
                }
            }
        }

        const isFlying = inventory[selectedSlot].type === 'WINGS' && keys.jump;
        p.vy += isFlying ? 0.15 : GRAVITY;
        if (keys.jump) {
            if (p.onGround) { p.vy = JUMP_FORCE; p.onGround = false; }
            else if (isFlying && p.mana > 0) { p.vy = -5; p.mana -= 0.6; }
        }
        
        p.x += p.vx; resolveCollisions(p, 'x');
        p.y += p.vy; p.onGround = false; resolveCollisions(p, 'y');
        
        cameraRef.current.x += (p.x - window.innerWidth / 2 - cameraRef.current.x) * 0.1;
        cameraRef.current.y += (p.y - window.innerHeight / 2 - cameraRef.current.y) * 0.1;

        if (timeRef.current % 60 === 0) { if (p.mana < p.maxMana) p.mana += 4; if (p.hp < p.maxHp) p.hp += 1; }
        if (stats.hp !== Math.floor(p.hp) || stats.mana !== Math.floor(p.mana)) setStats({ hp: Math.floor(p.hp), mana: Math.floor(p.mana) });

        projectilesRef.current = projectilesRef.current.filter(proj => {
            proj.life -= 0.02; proj.x += proj.vx; proj.y += proj.vy;
            enemiesRef.current.forEach(en => {
                const dx = proj.x - (en.x + en.w / 2), dy = proj.y - (en.y + en.h / 2), dist = Math.sqrt(dx * dx + dy * dy);
                if (en.hp > 0 && dist < en.w / 2 + 15) { en.hp -= proj.dmg; proj.life = 0; en.lastHit = Date.now(); screenShakeRef.current = 4; }
            });
            return proj.life > 0;
        });

        enemiesRef.current.forEach(en => {
            if (en.hp <= 0) return;
            if (en.type === 'KING_SLIME') {
                en.vy += GRAVITY; en.y += en.vy;
                const tx = Math.floor((en.x + en.w/2) / TILE_SIZE), ty = Math.floor((en.y + en.h) / TILE_SIZE);
                if (worldRef.current[ty] && worldRef.current[ty][tx] !== TILE_TYPES.AIR) { en.y = ty * TILE_SIZE - en.h; en.vy = 0; if (Date.now() - en.lastJump > 2500) { en.vy = -12; en.vx = (p.x - en.x > 0 ? 1 : -1) * 4; en.lastJump = Date.now(); } }
                en.x += en.vx; en.vx *= 0.95;
            }
            if (en.type === 'EYE') { const angle = Math.atan2(p.y - en.y, p.x - en.x); en.vx = Math.cos(angle) * 3; en.vy = Math.sin(angle) * 3; en.x += en.vx; en.y += en.vy; }
            const dx = p.x - en.x, dy = p.y - en.y;
            if (Math.abs(dx) < en.w && Math.abs(dy) < en.h && timeRef.current % 40 === 0) { p.hp -= 15; screenShakeRef.current = 10; }
        });

        if (p.x < 0) p.x = 0; if (p.x > WORLD_WIDTH * TILE_SIZE - p.w) p.x = WORLD_WIDTH * TILE_SIZE - p.w;
    };

    const resolveCollisions = (p, axis) => {
        const x1 = Math.floor(p.x / TILE_SIZE), x2 = Math.floor((p.x + p.w) / TILE_SIZE);
        const y1 = Math.floor(p.y / TILE_SIZE), y2 = Math.floor((p.y + p.h) / TILE_SIZE);
        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) continue;
                const t = worldRef.current[y][x];
                if (t !== TILE_TYPES.AIR && t !== TILE_TYPES.LAVA && t !== TILE_TYPES.TORCH) {
                    if (axis === 'x') { if (p.vx > 0) p.x = x * TILE_SIZE - p.w; else if (p.vx < 0) p.x = (x + 1) * TILE_SIZE; p.vx = 0; }
                    else { if (p.vy > 0) { p.y = y * TILE_SIZE - p.h; p.onGround = true; } else if (p.vy < 0) p.y = (y + 1) * TILE_SIZE; p.vy = 0; }
                }
            }
        }
    };

    const draw = () => {
        const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); const cam = cameraRef.current;
        const p = playerRef.current;
        const timeFactor = Math.sin((gameTime / 24000) * Math.PI * 2 - Math.PI/2) * 0.5 + 0.5;
        const skyR = Math.floor(135 * timeFactor), skyG = Math.floor(206 * timeFactor), skyB = Math.floor(235 * timeFactor + (1-timeFactor)*20);
        
        ctx.fillStyle = `rgb(${skyR},${skyG},${skyB})`; ctx.fillRect(0, 0, canvas.width, canvas.height);
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
                    ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
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
            ctx.save();
            if (en.type === 'KING_SLIME') { ctx.fillStyle = 'rgba(0, 150, 255, 0.7)'; ctx.beginPath(); ctx.arc(en.x+en.w/2, en.y+en.h/2, en.w/2, 0, Math.PI*2); ctx.fill(); }
            if (en.type === 'EYE') { ctx.fillStyle = '#eee'; ctx.beginPath(); ctx.arc(en.x+20, en.y+20, 20, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#f00'; ctx.beginPath(); ctx.arc(en.x+30, en.y+20, 8, 0, Math.PI*2); ctx.fill(); }
            ctx.restore();
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
            const count = item.type === 'ZENITH' ? 5 : 1;
            for(let i=0; i<count; i++) {
                projectilesRef.current.push({ x: p.x+p.w/2, y: p.y+p.h/2, vx: Math.cos(angle + (Math.random()-0.5)*0.2)*15, vy: Math.sin(angle + (Math.random()-0.5)*0.2)*15, color: item.type === 'ZENITH' ? '#00f2ff' : '#E040FB', life: 1.5, dmg: 30 });
            }
        } else {
            const tx = Math.floor(mX/TILE_SIZE), ty = Math.floor(mY/TILE_SIZE);
            if (tx >= 0 && tx < WORLD_WIDTH && ty >= 0 && ty < WORLD_HEIGHT) worldRef.current[ty][tx] = (worldRef.current[ty][tx] === TILE_TYPES.AIR) ? item.type : TILE_TYPES.AIR;
        }
    };

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', touchAction: 'none', background: '#000', userSelect: 'none' }}>
            <canvas ref={canvasRef} onMouseDown={handleAction} onTouchStart={handleAction} style={{ display: 'block' }} />
            
            <div style={{ position: 'fixed', top: '20px', right: '20px', textAlign: 'right', zIndex: 100 }}>
                <div style={{ color: '#fff', fontSize: '1.4em', fontWeight: 'bold', fontFamily: 'Orbitron', textShadow: '0 0 10px #00f2ff' }}>NEURAL TERRARIA v16</div>
                <div style={{ width: '220px', height: '22px', background: 'rgba(0,0,0,0.6)', border: '2px solid #fff', borderRadius: '11px', margin: '10px 0', overflow: 'hidden' }}>
                    <div style={{ width: `${stats.hp}%`, height: '100%', background: '#ff1744' }} />
                </div>
                <div style={{ width: '180px', height: '12px', background: 'rgba(0,0,0,0.6)', border: '2px solid #fff', borderRadius: '6px', marginLeft: '40px', overflow: 'hidden' }}>
                    <div style={{ width: `${stats.mana}%`, height: '100%', background: '#2979ff' }} />
                </div>
            </div>

            <div style={{ position: 'fixed', top: '20px', left: '20px', display: 'flex', gap: '10px', zIndex: 100 }}>
                {inventory.map((item, idx) => (
                    <div key={idx} onPointerDown={(e) => { e.stopPropagation(); setSelectedSlot(idx); }} style={{ width: '64px', height: '64px', background: selectedSlot === idx ? '#fff' : 'rgba(255,255,255,0.4)', border: selectedSlot === idx ? '4px solid #ff4081' : '2px solid #fff', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', backdropFilter: 'blur(10px)' }}>{item.label}</div>
                ))}
            </div>

            {isMobile && (
                <div style={{ position: 'fixed', bottom: '50px', left: '50px', right: '50px', display: 'flex', justifyContent: 'space-between', zIndex: 100, pointerEvents: 'none' }}>
                    <div style={{ display: 'flex', gap: '40px', pointerEvents: 'auto' }}>
                        <button onTouchStart={(e) => { e.preventDefault(); keysRef.current.left = true; }} onTouchEnd={() => keysRef.current.left = false} className="ctrl-btn">←</button>
                        <button onTouchStart={(e) => { e.preventDefault(); keysRef.current.right = true; }} onTouchEnd={() => keysRef.current.right = false} className="ctrl-btn">→</button>
                    </div>
                    <button onTouchStart={(e) => { e.preventDefault(); keysRef.current.jump = true; }} onTouchEnd={() => keysRef.current.jump = false} className="ctrl-btn" style={{ width: '140px', height: '140px', borderRadius: '50%', background: 'rgba(0, 242, 255, 0.4)', fontSize: '2em' }}>JUMP</button>
                </div>
            )}
            <style>{`.ctrl-btn { width: 120px; height: 120px; background: rgba(255,255,255,0.15); border: 4px solid #fff; border-radius: 30px; color: #fff; font-weight: bold; font-size: 4em; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(15px); pointer-events: auto; -webkit-tap-highlight-color: transparent; }`}</style>
        </div>
    );
};

export default App;
