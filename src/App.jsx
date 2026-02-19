import React, { useState, useEffect, useRef, useCallback } from 'react';

// Constants
const WORLD_WIDTH = 120;
const WORLD_HEIGHT = 100; // Expanded for Underworld
const TILE_SIZE = 32;
const GRAVITY = 0.45;
const JUMP_FORCE = -9.5;
const MOVE_SPEED = 4.5;
const FRICTION = 0.85;

const TILE_TYPES = { 
    AIR: 0, DIRT: 1, GRASS: 2, STONE: 3, WOOD: 4, LEAVES: 5,
    LAVA: 6, ASH: 7, HELLSTONE: 8, BRICK: 9
};

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
    [TILE_TYPES.DIRT]: [[0,0,1,0,0,0,1,0],[0,1,1,1,0,1,1,1],[1,1,0,1,1,1,0,1],[0,1,1,1,0,1,1,1],[0,0,1,0,0,0,1,0],[0,1,1,1,0,1,1,1],[1,1,0,1,1,1,0,1],[0,1,1,1,0,1,1,1]],
    [TILE_TYPES.GRASS]: [[2,2,2,2,2,2,2,2],[2,2,2,2,2,2,2,2],[2,1,2,1,2,2,1,2],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,0,1,0,1,1,0,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1]],
    [TILE_TYPES.STONE]: [[0,0,0,0,0,0,0,0],[0,1,1,1,0,1,1,0],[0,1,0,1,1,0,1,0],[0,1,1,1,0,1,1,0],[0,0,0,0,0,0,0,0],[0,1,1,0,1,1,1,0],[0,1,0,1,1,0,1,0],[0,1,1,1,0,1,1,0]],
    [TILE_TYPES.ASH]: [[0,0,1,0,1,0,0,1],[0,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,1],[0,0,1,0,1,0,0,1],[0,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,1]],
    [TILE_TYPES.HELLSTONE]: [[1,1,0,1,1,0,1,1],[1,1,1,1,1,1,1,1],[0,1,1,0,1,1,0,1],[1,1,1,1,1,1,1,1],[1,1,0,1,1,0,1,1],[1,1,1,1,1,1,1,1],[0,1,1,0,1,1,0,1],[1,1,1,1,1,1,1,1]]
};

const App = () => {
    const canvasRef = useRef(null);
    const worldRef = useRef([]);
    const playerRef = useRef({ x: 200, y: 100, vx: 0, vy: 0, w: 20, h: 36, onGround: false, hp: 100, maxHp: 100 });
    const keysRef = useRef({});
    const cameraRef = useRef({ x: 0, y: 0 });
    const projectilesRef = useRef([]);
    const enemiesRef = useRef([]);
    const npcsRef = useRef([]); // Guide etc
    const audioCtxRef = useRef(null);
    
    const [selectedSlot, setSelectedSlot] = useState(0);
    const [isMobile, setIsMobile] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isHardMode, setIsHardMode] = useState(false);

    const inventory = [
        { type: TILE_TYPES.DIRT, color: TILE_COLORS[TILE_TYPES.DIRT] },
        { type: TILE_TYPES.WOOD, color: TILE_COLORS[TILE_TYPES.WOOD] },
        { type: TILE_TYPES.STONE, color: TILE_COLORS[TILE_TYPES.STONE] },
        { type: 'ZENITH', color: 'linear-gradient(45deg, #00f2ff, #bf00ff)', isWeapon: true },
    ];

    const startBGM = useCallback(() => {
        if (audioCtxRef.current) return;
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtxRef.current = ctx;
        const playNote = (freq, time, duration, vol = 0.05) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, time);
            gain.gain.setValueAtTime(vol, time);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(time);
            osc.stop(time + duration);
        };
        const melody = [{ f: 261.63, d: 0.2 }, { f: 329.63, d: 0.2 }, { f: 392.00, d: 0.2 }, { f: 523.25, d: 0.4 }, { f: 493.88, d: 0.2 }, { f: 392.00, d: 0.2 }, { f: 329.63, d: 0.2 }, { f: 293.66, d: 0.4 }];
        let nextTime = ctx.currentTime;
        const playNext = () => {
            melody.forEach(note => {
                playNote(note.f, nextTime, note.d * 2.5);
                playNote(note.f / 2, nextTime, note.d * 2.5, 0.03);
                nextTime += note.d;
            });
            setTimeout(playNext, (nextTime - ctx.currentTime) * 1000 - 100);
        };
        playNext();
    }, []);

    useEffect(() => {
        const newWorld = [];
        for (let y = 0; y < WORLD_HEIGHT; y++) {
            const row = [];
            for (let x = 0; x < WORLD_WIDTH; x++) {
                const surfaceY = 25 + Math.sin(x * 0.1) * 3;
                const hellY = WORLD_HEIGHT - 15;
                if (y > hellY + 5) row.push(TILE_TYPES.LAVA);
                else if (y > hellY) row.push(TILE_TYPES.ASH);
                else if (y > hellY - 10 && Math.random() < 0.1) row.push(TILE_TYPES.HELLSTONE);
                else if (y > surfaceY + 15) row.push(TILE_TYPES.STONE);
                else if (y > surfaceY) row.push(TILE_TYPES.DIRT);
                else if (y > surfaceY - 1) row.push(TILE_TYPES.GRASS);
                else row.push(TILE_TYPES.AIR);
            }
            newWorld.push(row);
        }
        worldRef.current = newWorld;
        
        enemiesRef.current = [
            { type: 'KING_SLIME', x: 800, y: 100, vx: 0, vy: 0, w: 120, h: 90, hp: 500, maxHp: 500, lastJump: 0, lastHit: 0 },
            { type: 'MOON_LORD', x: 1500, y: -200, vx: 0, vy: 0, w: 400, h: 600, hp: 10000, maxHp: 10000, lastAttack: 0, lastHit: 0 }
        ];

        npcsRef.current = [
            { type: 'GUIDE', x: 300, y: 100, vx: 0, vy: 0, w: 20, h: 36, lastWalk: 0 }
        ];

        const handleResize = () => {
            if (canvasRef.current) { canvasRef.current.width = window.innerWidth; canvasRef.current.height = window.innerHeight; }
            setIsMobile(window.innerWidth < 1024);
        };
        window.addEventListener('resize', handleResize);
        handleResize();

        const triggerAudio = () => { startBGM(); window.removeEventListener('click', triggerAudio); };
        window.addEventListener('click', triggerAudio);

        const down = (e) => { keysRef.current[e.code] = true; };
        const up = (e) => { keysRef.current[e.code] = false; };
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);

        let frameId;
        const loop = () => { update(); draw(); frameId = requestAnimationFrame(loop); };
        frameId = requestAnimationFrame(loop);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('keydown', down);
            window.removeEventListener('keyup', up);
            window.removeEventListener('click', triggerAudio);
            cancelAnimationFrame(frameId);
        };
    }, [startBGM]);

    const update = () => {
        const p = playerRef.current;
        const keys = keysRef.current;
        let targetVx = 0;
        if (keys['ArrowLeft'] || keys['KeyA']) targetVx = -MOVE_SPEED;
        else if (keys['ArrowRight'] || keys['KeyD']) targetVx = MOVE_SPEED;
        p.vx = targetVx || (p.vx * FRICTION);
        p.vy += GRAVITY;
        if ((keys['ArrowUp'] || keys['KeyW'] || keys['Space']) && p.onGround) { p.vy = JUMP_FORCE; p.onGround = false; }
        p.x += p.vx; resolveCollisions(p, 'x');
        p.y += p.vy; p.onGround = false; resolveCollisions(p, 'y');

        // Hell Logic
        if (p.y > (WORLD_HEIGHT - 10) * TILE_SIZE) { p.hp -= 0.5; }

        cameraRef.current.x += (p.x - window.innerWidth / 2 - cameraRef.current.x) * 0.1;
        cameraRef.current.y += (p.y - window.innerHeight / 2 - cameraRef.current.y) * 0.1;

        projectilesRef.current = projectilesRef.current.filter(proj => {
            proj.life -= 0.02; proj.x += proj.vx; proj.y += proj.vy; proj.angle += 0.2;
            enemiesRef.current.forEach(en => {
                const dist = Math.sqrt((proj.x - (en.x + en.w/2))**2 + (proj.y - (en.y + en.h/2))**2);
                if (dist < en.w/2 + 10) { en.hp -= isHardMode ? 5 : 20; proj.life = 0; en.lastHit = Date.now(); if(en.hp <= 0 && en.type === 'MOON_LORD') setIsHardMode(true); }
            });
            return proj.life > 0;
        });

        enemiesRef.current = enemiesRef.current.filter(en => {
            if (en.hp <= 0) return false;
            en.vy += GRAVITY; en.y += en.vy;
            const tx = Math.floor((en.x + en.w/2)/TILE_SIZE);
            const ty = Math.floor((en.y + en.h)/TILE_SIZE);
            if(worldRef.current[ty] && worldRef.current[ty][tx] !== TILE_TYPES.AIR) { en.y = ty * TILE_SIZE - en.h; en.vy = 0; }
            en.vx = (p.x - en.x > 0 ? 1 : -1) * (isHardMode ? 4 : 2);
            en.x += en.vx;
            return true;
        });

        npcsRef.current.forEach(npc => {
            npc.vy += GRAVITY; npc.y += npc.vy;
            const ty = Math.floor((npc.y + npc.h)/TILE_SIZE);
            const tx = Math.floor((npc.x + npc.w/2)/TILE_SIZE);
            if(worldRef.current[ty] && worldRef.current[ty][tx] !== TILE_TYPES.AIR) { npc.y = ty * TILE_SIZE - npc.h; npc.vy = 0; }
            if(Date.now() - npc.lastWalk > 3000) { npc.vx = (Math.random() - 0.5) * 2; npc.lastWalk = Date.now(); }
            npc.x += npc.vx;
        });
    };

    const resolveCollisions = (p, axis) => {
        const x1 = Math.floor(p.x / TILE_SIZE), x2 = Math.floor((p.x + p.w) / TILE_SIZE);
        const y1 = Math.floor(p.y / TILE_SIZE), y2 = Math.floor((p.y + p.h) / TILE_SIZE);
        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) continue;
                if (worldRef.current[y][x] !== TILE_TYPES.AIR) {
                    if (axis === 'x') { p.x = p.vx > 0 ? x * TILE_SIZE - p.w : (x+1) * TILE_SIZE; p.vx = 0; }
                    else { if(p.vy > 0) { p.y = y * TILE_SIZE - p.h; p.onGround = true; } else { p.y = (y+1) * TILE_SIZE; } p.vy = 0; }
                }
            }
        }
    };

    const draw = () => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d'); const cam = cameraRef.current;
        ctx.fillStyle = playerRef.current.y > (WORLD_HEIGHT - 30) * TILE_SIZE ? '#2b0000' : '#87CEEB';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.save(); ctx.translate(-Math.floor(cam.x), -Math.floor(cam.y));

        const startX = Math.max(0, Math.floor(cam.x / TILE_SIZE)), endX = Math.min(WORLD_WIDTH, Math.ceil((cam.x + canvas.width) / TILE_SIZE));
        const startY = Math.max(0, Math.floor(cam.y / TILE_SIZE)), endY = Math.min(WORLD_HEIGHT, Math.ceil((cam.y + canvas.height) / TILE_SIZE));
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const tile = worldRef.current[y][x];
                if (tile !== TILE_TYPES.AIR) {
                    const pattern = PIXEL_PATTERNS[tile];
                    if(pattern) {
                        const ps = TILE_SIZE / 8;
                        pattern.forEach((r, ry) => r.forEach((p, rx) => {
                            ctx.fillStyle = p === 2 ? '#66BB6A' : (p === 0 ? 'rgba(0,0,0,0.1)' : TILE_COLORS[tile]);
                            ctx.fillRect(x * TILE_SIZE + rx * ps, y * TILE_SIZE + ry * ps, ps, ps);
                        }));
                    } else { ctx.fillStyle = TILE_COLORS[tile]; ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE); }
                }
            }
        }

        const p = playerRef.current;
        ctx.fillStyle = '#455A64'; ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = '#00E5FF'; ctx.fillRect(p.x + (p.vx >= 0 ? 12 : 2), p.y + 8, 6, 4);

        npcsRef.current.forEach(npc => { ctx.fillStyle = '#FFCCBC'; ctx.fillRect(npc.x, npc.y, npc.w, npc.h); ctx.fillStyle = '#333'; ctx.fillText("GUIDE", npc.x, npc.y - 5); });
        
        enemiesRef.current.forEach(en => {
            ctx.fillStyle = en.type === 'KING_SLIME' ? '#0096FF' : '#ff0055';
            ctx.fillRect(en.x, en.y, en.w, en.h);
            ctx.fillStyle = 'red'; ctx.fillRect(en.x, en.y - 10, en.w * (en.hp/en.maxHp), 4);
        });

        projectilesRef.current.forEach(proj => { ctx.fillStyle = proj.color; ctx.fillRect(proj.x, proj.y, 10, 10); });
        ctx.restore();
        
        // Player HP
        ctx.fillStyle = 'black'; ctx.fillRect(20, window.innerHeight - 40, 200, 20);
        ctx.fillStyle = 'red'; ctx.fillRect(20, window.innerHeight - 40, 200 * (p.hp/p.maxHp), 20);
    };

    const handleAction = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const mouseX = clientX - rect.left + cameraRef.current.x, mouseY = clientY - rect.top + cameraRef.current.y;
        if (inventory[selectedSlot].type === 'ZENITH') {
            for (let i = 0; i < 5; i++) {
                const angle = Math.atan2(mouseY - playerRef.current.y, mouseX - playerRef.current.x) + (Math.random() - 0.5) * 0.5;
                projectilesRef.current.push({ x: playerRef.current.x, y: playerRef.current.y, vx: Math.cos(angle) * 10, vy: Math.sin(angle) * 10, color: 'cyan', life: 1.0 });
            }
        } else {
            const tx = Math.floor(mouseX / TILE_SIZE), ty = Math.floor(mouseY / TILE_SIZE);
            if (tx >= 0 && tx < WORLD_WIDTH && ty >= 0 && ty < WORLD_HEIGHT) worldRef.current[ty][tx] = worldRef.current[ty][tx] === TILE_TYPES.AIR ? inventory[selectedSlot].type : TILE_TYPES.AIR;
        }
    };

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', touchAction: 'none' }}>
            <canvas ref={canvasRef} onMouseDown={handleAction} style={{ display: 'block' }} />
            <div style={{ position: 'fixed', top: '20px', left: '20px', display: 'flex', gap: '12px', zIndex: 100 }}>
                {inventory.map((item, idx) => (
                    <div key={idx} onClick={() => setSelectedSlot(idx)} style={{ width: '50px', height: '50px', background: selectedSlot === idx ? '#fff' : 'rgba(255,255,255,0.4)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <div style={{ width: '30px', height: '30px', background: item.color }}>{item.type === 'ZENITH' ? '⚔️' : ''}</div>
                    </div>
                ))}
            </div>
            {isHardMode && <div style={{ position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)', color: 'red', fontSize: '2em', fontWeight: 'bold', textShadow: '2px 2px #000' }}>HARD MODE ACTIVE</div>}
            <div style={{ position: 'fixed', top: '20px', right: '20px', color: '#fff', fontSize: '1.2em', fontWeight: 'bold' }}>NEURAL TERRARIA v9</div>
            {isMobile && (
                <div style={{ position: 'fixed', bottom: '30px', left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: '0 30px', zIndex: 100 }}>
                    <div style={{ display: 'flex', gap: '15px' }}><button onTouchStart={() => keysRef.current['KeyA'] = true} onTouchEnd={() => keysRef.current['KeyA'] = false} style={{ width: '80px', height: '80px' }}>←</button><button onTouchStart={() => keysRef.current['KeyD'] = true} onTouchEnd={() => keysRef.current['KeyD'] = false} style={{ width: '80px', height: '80px' }}>→</button></div>
                    <button onTouchStart={() => keysRef.current['Space'] = true} onTouchEnd={() => keysRef.current['Space'] = false} style={{ width: '100px', height: '100px', borderRadius: '50%' }}>JUMP</button>
                </div>
            )}
        </div>
    );
};

export default App;
