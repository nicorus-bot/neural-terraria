import React, { useState, useEffect, useRef, useCallback } from 'react';

// Constants
const WORLD_WIDTH = 150;
const WORLD_HEIGHT = 100; // Increased for Underworld
const TILE_SIZE = 32;
const GRAVITY = 0.45;
const JUMP_FORCE = -9.5;
const MOVE_SPEED = 4.5;
const FRICTION = 0.85;

const TILE_TYPES = { AIR: 0, DIRT: 1, GRASS: 2, STONE: 3, WOOD: 4, LEAVES: 5, LAVA: 6, ASH: 7, HELLSTONE: 8, BRICK: 9 };
const TILE_COLORS = {
    [TILE_TYPES.AIR]: null,
    [TILE_TYPES.DIRT]: '#8B4513',
    [TILE_TYPES.GRASS]: '#4CAF50',
    [TILE_TYPES.STONE]: '#757575',
    [TILE_TYPES.WOOD]: '#5D4037',
    [TILE_TYPES.LEAVES]: '#2E7D32',
    [TILE_TYPES.LAVA]: '#FF4500',
    [TILE_TYPES.ASH]: '#444444',
    [TILE_TYPES.HELLSTONE]: '#FF0000',
    [TILE_TYPES.BRICK]: '#BDBDBD',
};

const PIXEL_PATTERNS = {
    [TILE_TYPES.DIRT]: [[0,0,1,0,0,0,1,0], [0,1,1,1,0,1,1,1], [1,1,0,1,1,1,0,1], [0,1,1,1,0,1,1,1], [0,0,1,0,0,0,1,0], [0,1,1,1,0,1,1,1], [1,1,0,1,1,1,0,1], [0,1,1,1,0,1,1,1]],
    [TILE_TYPES.GRASS]: [[2,2,2,2,2,2,2,2], [2,2,2,2,2,2,2,2], [2,1,2,1,2,2,1,2], [1,1,1,1,1,1,1,1], [1,1,1,1,1,1,1,1], [1,0,1,0,1,1,0,1], [1,1,1,1,1,1,1,1], [1,1,1,1,1,1,1,1]],
    [TILE_TYPES.STONE]: [[0,0,0,0,0,0,0,0], [0,1,1,1,0,1,1,0], [0,1,0,1,1,0,1,0], [0,1,1,1,0,1,1,0], [0,0,0,0,0,0,0,0], [0,1,1,0,1,1,1,0], [0,1,0,1,1,0,1,0], [0,1,1,1,0,1,1,0]],
    [TILE_TYPES.ASH]: [[0,0,1,0,1,0,0,1], [0,1,1,1,1,1,0,0], [1,1,1,1,1,1,1,0], [0,1,1,1,1,1,1,1], [0,0,1,0,1,0,0,1], [0,1,1,1,1,1,0,0], [1,1,1,1,1,1,1,0], [0,1,1,1,1,1,1,1]],
    [TILE_TYPES.HELLSTONE]: [[1,1,0,1,1,0,1,1], [1,1,1,1,1,1,1,1], [0,1,1,0,1,1,0,1], [1,1,1,1,1,1,1,1], [1,1,0,1,1,0,1,1], [1,1,1,1,1,1,1,1], [0,1,1,0,1,1,0,1], [1,1,1,1,1,1,1,1]],
    [TILE_TYPES.LAVA]: [[2,2,2,2,2,2,2,2], [2,1,1,1,1,1,1,2], [1,1,0,0,0,0,1,1], [2,1,1,1,1,1,1,2], [2,2,2,2,2,2,2,2], [2,1,1,1,1,1,1,2], [1,1,0,0,0,0,1,1], [2,1,1,1,1,1,1,2]],
};

const App = () => {
    const canvasRef = useRef(null);
    const worldRef = useRef([]);
    const playerRef = useRef({ x: 200, y: 100, vx: 0, vy: 0, w: 20, h: 36, onGround: false, hp: 100 });
    const keysRef = useRef({});
    const cameraRef = useRef({ x: 0, y: 0 });
    const projectilesRef = useRef([]);
    const enemiesRef = useRef([]);
    const npcsRef = useRef([]);
    const audioCtxRef = useRef(null);
    
    const [selectedSlot, setSelectedSlot] = useState(0);
    const [isMobile, setIsMobile] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isHardMode, setIsHardMode] = useState(false);

    const inventory = [
        { type: TILE_TYPES.DIRT, color: TILE_COLORS[TILE_TYPES.DIRT] },
        { type: TILE_TYPES.WOOD, color: TILE_COLORS[TILE_TYPES.WOOD] },
        { type: TILE_TYPES.BRICK, color: TILE_COLORS[TILE_TYPES.BRICK] },
        { type: 'ZENITH', color: 'linear-gradient(45deg, #00f2ff, #bf00ff)', isWeapon: true },
    ];

    const startBGM = useCallback(() => {
        if (audioCtxRef.current) return;
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtxRef.current = ctx;
        const playNote = (freq, time, duration, vol = 0.05) => {
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.type = 'triangle'; osc.frequency.setValueAtTime(freq, time);
            gain.gain.setValueAtTime(vol, time); gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(time); osc.stop(time + duration);
        };
        const melody = [{f:261,d:0.2},{f:329,d:0.2},{f:392,d:0.2},{f:523,d:0.4},{f:493,d:0.2},{f:392,d:0.2},{f:329,d:0.2},{f:293,d:0.4}];
        let nextTime = ctx.currentTime;
        const playNext = () => {
            melody.forEach(note => {
                const speed = isHardMode ? 0.8 : 1.0;
                playNote(isHardMode ? note.f * 0.7 : note.f, nextTime, note.d * 2.5 * speed);
                playNote(note.f / 2, nextTime, note.d * 2.5 * speed, 0.03);
                nextTime += note.d * speed;
            });
            setTimeout(playNext, (nextTime - ctx.currentTime) * 1000 - 100);
        };
        playNext();
    }, [isHardMode]);

    useEffect(() => {
        const newWorld = [];
        for (let y = 0; y < WORLD_HEIGHT; y++) {
            const row = [];
            for (let x = 0; x < WORLD_WIDTH; x++) {
                const surfaceY = 25 + Math.sin(x * 0.1) * 3;
                if (y > WORLD_HEIGHT - 15) row.push(Math.random() < 0.3 ? TILE_TYPES.LAVA : TILE_TYPES.ASH); // Hell
                else if (y > WORLD_HEIGHT - 25) row.push(TILE_TYPES.HELLSTONE); // Hell Border
                else if (y > surfaceY + 20) row.push(TILE_TYPES.STONE); // Deep
                else if (y > surfaceY) row.push(TILE_TYPES.DIRT); // Underground
                else if (y > surfaceY - 1) row.push(TILE_TYPES.GRASS); // Surface
                else row.push(TILE_TYPES.AIR);
            }
            newWorld.push(row);
        }
        worldRef.current = newWorld;
        enemiesRef.current = [
            { type: 'KING_SLIME', x: 800, y: 100, vx: 0, vy: 0, w: 120, h: 90, hp: 500, maxHp: 500, lastJump: 0, lastHit: 0 },
            { type: 'MOON_LORD', x: 2000, y: 0, vx: 0, vy: 0, w: 400, h: 600, hp: 10000, maxHp: 10000, lastAttack: 0, lastHit: 0 }
        ];
        npcsRef.current = [{ type: 'GUIDE', x: 300, y: 100, vx: 0, vy: 0, w: 20, h: 36, dir: 1 }];

        const handleResize = () => { if (canvasRef.current) { canvasRef.current.width = window.innerWidth; canvasRef.current.height = window.innerHeight; } setIsMobile(window.innerWidth < 1024); };
        window.addEventListener('resize', handleResize); handleResize();
        const triggerAudio = () => { startBGM(); window.removeEventListener('click', triggerAudio); };
        window.addEventListener('click', triggerAudio);
        const down = (e) => { keysRef.current[e.code] = true; }; const up = (e) => { keysRef.current[e.code] = false; };
        window.addEventListener('keydown', down); window.addEventListener('keyup', up);
        let frameId; const loop = () => { update(); draw(); frameId = requestAnimationFrame(loop); };
        frameId = requestAnimationFrame(loop);
        return () => { window.removeEventListener('resize', handleResize); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('click', triggerAudio); cancelAnimationFrame(frameId); };
    }, [startBGM]);

    useEffect(() => { if (audioCtxRef.current) { if (isMuted) audioCtxRef.current.suspend(); else audioCtxRef.current.resume(); } }, [isMuted]);

    const update = () => {
        const p = playerRef.current; const keys = keysRef.current;
        let targetVx = 0;
        if (keys['ArrowLeft'] || keys['KeyA']) targetVx = -MOVE_SPEED; else if (keys['ArrowRight'] || keys['KeyD']) targetVx = MOVE_SPEED;
        p.vx = targetVx || (p.vx * FRICTION); if (Math.abs(p.vx) < 0.1) p.vx = 0;
        p.vy += GRAVITY; if ((keys['ArrowUp'] || keys['KeyW'] || keys['Space']) && p.onGround) { p.vy = JUMP_FORCE; p.onGround = false; }
        p.x += p.vx; resolveCollisions(p, 'x'); p.y += p.vy; p.onGround = false; resolveCollisions(p, 'y');
        cameraRef.current.x += (p.x - window.innerWidth / 2 - cameraRef.current.x) * 0.1;
        cameraRef.current.y += (p.y - window.innerHeight / 2 - cameraRef.current.y) * 0.1;

        // Hardmode trigger
        if (!isHardMode && enemiesRef.current.some(en => en.type === 'MOON_LORD' && en.hp <= 0)) {
            setIsHardMode(true);
        }

        projectilesRef.current = projectilesRef.current.filter(proj => {
            proj.life -= 0.02; proj.x += proj.vx; proj.y += proj.vy; proj.angle += 0.2;
            enemiesRef.current.forEach(en => {
                const dx = proj.x - (en.x + en.w / 2), dy = proj.y - (en.y + en.h / 2), dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < en.w / 2 + 10) { en.hp -= (isHardMode ? 5 : 2); proj.life = 0; en.lastHit = Date.now(); }
            });
            return proj.life > 0;
        });

        enemiesRef.current.forEach(en => {
            if (en.type === 'KING_SLIME') {
                en.vy += GRAVITY; en.y += en.vy;
                const tx = Math.floor((en.x + en.w/2) / TILE_SIZE), ty = Math.floor((en.y + en.h) / TILE_SIZE);
                if (worldRef.current[ty] && worldRef.current[ty][tx] !== TILE_TYPES.AIR) { en.y = ty * TILE_SIZE - en.h; en.vy = 0; if (Date.now() - en.lastJump > 2000) { en.vy = -12; en.vx = (p.x - en.x > 0 ? 1 : -1) * 3; en.lastJump = Date.now(); } }
                en.x += en.vx; en.vx *= 0.95;
            }
            if (en.type === 'MOON_LORD') {
                en.y += (p.y - 450 - en.y) * 0.02; en.x += (p.x - en.w/2 - en.x) * 0.02;
            }
        });

        npcsRef.current.forEach(n => {
            n.vy += GRAVITY; n.y += n.vy;
            const tx = Math.floor((n.x + n.w/2) / TILE_SIZE), ty = Math.floor((n.y + n.h) / TILE_SIZE);
            if (worldRef.current[ty] && worldRef.current[ty][tx] !== TILE_TYPES.AIR) { n.y = ty * TILE_SIZE - n.h; n.vy = 0; }
            if (Math.random() < 0.01) n.dir *= -1;
            n.x += n.dir * 0.5;
        });

        if (p.x < 0) p.x = 0; if (p.x > WORLD_WIDTH * TILE_SIZE - p.w) p.x = WORLD_WIDTH * TILE_SIZE - p.w;
    };

    const resolveCollisions = (p, axis) => {
        const x1 = Math.floor(p.x / TILE_SIZE), x2 = Math.floor((p.x + p.w) / TILE_SIZE);
        const y1 = Math.floor(p.y / TILE_SIZE), y2 = Math.floor((p.y + p.h) / TILE_SIZE);
        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) continue;
                if (worldRef.current[y][x] !== TILE_TYPES.AIR && worldRef.current[y][x] !== TILE_TYPES.LAVA) {
                    if (axis === 'x') { if (p.vx > 0) p.x = x * TILE_SIZE - p.w; else if (p.vx < 0) p.x = (x + 1) * TILE_SIZE; p.vx = 0; }
                    else { if (p.vy > 0) { p.y = y * TILE_SIZE - p.h; p.onGround = true; } else if (p.vy < 0) p.y = (y + 1) * TILE_SIZE; p.vy = 0; }
                }
            }
        }
    };

    const draw = () => {
        const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); const cam = cameraRef.current;
        const p = playerRef.current;
        const depth = Math.floor(p.y / TILE_SIZE);
        let bgColor = '#87CEEB';
        if (depth > WORLD_HEIGHT - 30) bgColor = '#1a0505'; // Underworld Sky
        else if (depth > 30) bgColor = '#2c2c2c'; // Underground
        
        ctx.fillStyle = bgColor; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.save(); ctx.translate(-Math.floor(cam.x), -Math.floor(cam.y));
        const startX = Math.max(0, Math.floor(cam.x / TILE_SIZE)), endX = Math.min(WORLD_WIDTH, Math.ceil((cam.x + canvas.width) / TILE_SIZE));
        const startY = Math.max(0, Math.floor(cam.y / TILE_SIZE)), endY = Math.min(WORLD_HEIGHT, Math.ceil((cam.y + canvas.height) / TILE_SIZE));
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const tile = worldRef.current[y][x];
                if (tile !== TILE_TYPES.AIR) {
                    const pattern = PIXEL_PATTERNS[tile];
                    const pSize = TILE_SIZE / 8;
                    if (pattern) {
                        pattern.forEach((row, ry) => { row.forEach((pixel, rx) => {
                            if (pixel === 0) ctx.fillStyle = 'rgba(0,0,0,0.15)';
                            else if (pixel === 2) ctx.fillStyle = isHardMode ? '#ff00ff' : '#66BB6A';
                            else ctx.fillStyle = TILE_COLORS[tile];
                            ctx.fillRect(x * TILE_SIZE + rx * pSize, y * TILE_SIZE + ry * pSize, pSize, pSize);
                        }); });
                    } else { ctx.fillStyle = TILE_COLORS[tile]; ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE); }
                    if (tile === TILE_TYPES.LAVA) { ctx.shadowBlur = 15; ctx.shadowColor = '#FF4500'; } else ctx.shadowBlur = 0;
                }
            }
        }
        
        // Draw Player
        ctx.save(); ctx.translate(p.x + p.w / 2, p.y + p.h / 2); if (p.vx < 0) ctx.scale(-1, 1);
        ctx.fillStyle = '#37474F'; ctx.fillRect(-12, -20, 24, 16); ctx.fillStyle = '#00E5FF'; ctx.fillRect(2, -14, 10, 4);
        ctx.fillStyle = '#455A64'; ctx.fillRect(-10, -4, 20, 20); ctx.fillStyle = '#D32F2F';
        ctx.beginPath(); ctx.moveTo(-10, -4); ctx.lineTo(-25, 4); ctx.lineTo(-10, 18); ctx.fill(); ctx.restore();

        // Draw NPCs
        npcsRef.current.forEach(n => {
            ctx.fillStyle = '#FFCC80'; ctx.fillRect(n.x, n.y + 10, n.w, n.h - 10); // Body
            ctx.fillStyle = '#8D6E63'; ctx.fillRect(n.x, n.y, n.w, 12); // Hair
        });

        // Draw Enemies & Zenith
        projectilesRef.current.forEach(proj => {
            ctx.save(); ctx.translate(proj.x, proj.y); ctx.rotate(proj.angle); ctx.shadowBlur = 15; ctx.shadowColor = proj.color; ctx.fillStyle = proj.color;
            ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(5, 0); ctx.lineTo(0, 5); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill(); ctx.restore();
        });
        enemiesRef.current.forEach(en => {
            if (en.hp <= 0) return;
            ctx.save(); 
            if (en.type === 'KING_SLIME') { ctx.fillStyle = 'rgba(0, 150, 255, 0.7)'; ctx.beginPath(); ctx.arc(en.x + en.w/2, en.y + en.h/2, en.w/2, 0, Math.PI*2); ctx.fill(); }
            if (en.type === 'MOON_LORD') { ctx.fillStyle = 'rgba(100, 150, 150, 0.6)'; ctx.beginPath(); ctx.moveTo(en.x, en.y+en.h); ctx.lineTo(en.x+en.w/2, en.y); ctx.lineTo(en.x+en.w, en.y+en.h); ctx.fill(); }
            ctx.restore();
        });
        ctx.restore();
    };

    const handleAction = (e) => {
        const rect = canvasRef.current.getBoundingClientRect(); const clientX = e.touches ? e.touches[0].clientX : e.clientX; const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const mouseX = clientX - rect.left + cameraRef.current.x; const mouseY = clientY - rect.top + cameraRef.current.y;
        if (inventory[selectedSlot].type === 'ZENITH') {
            const p = playerRef.current; const colors = ['#00f2ff','#bf00ff','#ff0055','#33ff00','#ffff00'];
            for (let i = 0; i < 8; i++) {
                const angle = Math.atan2(mouseY - p.y, mouseX - p.x) + (Math.random() - 0.5) * 0.5;
                projectilesRef.current.push({ x: p.x + p.w / 2, y: p.y + p.h / 2, vx: Math.cos(angle) * 10, vy: Math.sin(angle) * 10, angle: Math.random() * Math.PI * 2, color: colors[Math.floor(Math.random() * colors.length)], life: 1.0 });
            }
            return;
        }
        const tx = Math.floor(mouseX / TILE_SIZE), ty = Math.floor(mouseY / TILE_SIZE);
        if (tx >= 0 && tx < WORLD_WIDTH && ty >= 0 && ty < WORLD_HEIGHT) {
            if (worldRef.current[ty][tx] === TILE_TYPES.AIR) worldRef.current[ty][tx] = inventory[selectedSlot].type;
            else worldRef.current[ty][tx] = TILE_TYPES.AIR;
        }
    };

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', touchAction: 'none' }}>
            <canvas ref={canvasRef} onMouseDown={handleAction} style={{ display: 'block' }} />
            <div style={{ position: 'fixed', top: '20px', left: '20px', display: 'flex', gap: '12px', zIndex: 100, alignItems: 'center' }}>
                {inventory.map((item, idx) => (
                    <div key={idx} onClick={() => setSelectedSlot(idx)} style={{ width: '50px', height: '50px', background: selectedSlot === idx ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255,255,255,0.4)', border: selectedSlot === idx ? '4px solid #ff4081' : '2px solid rgba(0,0,0,0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <div style={{ width: '30px', height: '30px', background: item.color, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>{item.type === 'ZENITH' ? '⚔️' : ''}</div>
                    </div>
                ))}
                <div onClick={() => setIsMuted(!isMuted)} style={{ width: '50px', height: '50px', background: isMuted ? 'rgba(255, 0, 85, 0.4)' : 'rgba(0, 242, 255, 0.4)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '20px', border: '2px solid #fff' }}>{isMuted ? '🔇' : '🔊'}</div>
            </div>
            <div style={{ position: 'fixed', top: '20px', right: '20px', color: '#fff', fontSize: '1.2em', fontWeight: 'bold', textShadow: '2px 2px rgba(0,0,0,0.5)', fontFamily: 'Orbitron' }}>NEURAL TERRARIA v9 {isHardMode ? '(HARDMODE)' : ''}</div>
            {isMobile && (
                <div style={{ position: 'fixed', bottom: '30px', left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: '0 30px', zIndex: 100, pointerEvents: 'none' }}>
                    <div style={{ display: 'flex', gap: '15px', pointerEvents: 'auto' }}>
                        <button onTouchStart={() => keysRef.current['KeyA'] = true} onTouchEnd={() => keysRef.current['KeyA'] = false} className="ctrl-btn">←</button>
                        <button onTouchStart={() => keysRef.current['KeyD'] = true} onTouchEnd={() => keysRef.current['KeyD'] = false} className="ctrl-btn">→</button>
                    </div>
                    <div style={{ pointerEvents: 'auto' }}>
                        <button onTouchStart={() => keysRef.current['Space'] = true} onTouchEnd={() => keysRef.current['Space'] = false} className="ctrl-btn" style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255, 64, 129, 0.4)' }}>JUMP</button>
                    </div>
                </div>
            )}
            <style>{`.ctrl-btn { width: 80px; height: 80px; background: rgba(255,255,255,0.2); border: 2px solid #fff; border-radius: 20px; color: #fff; font-weight: bold; font-size: 2em; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px); }`}</style>
        </div>
    );
};

export default App;
