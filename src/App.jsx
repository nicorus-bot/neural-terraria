import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- ゲーム定数 ---
const TILE_SIZE = 32;
const WORLD_WIDTH = 300;
const WORLD_HEIGHT = 150;
const GRAVITY = 0.4;
const JUMP_FORCE = -9;
const MOVE_SPEED = 4.5;
const FRICTION = 0.8;

const TILE_TYPES = { AIR: 0, DIRT: 1, GRASS: 2, STONE: 3, WOOD: 4, ASH: 5, LAVA: 6, BRICK: 7, GOLD: 8, TORCH: 9 };
const TILE_COLORS = {
    [TILE_TYPES.AIR]: null, [TILE_TYPES.DIRT]: '#8B4513', [TILE_TYPES.GRASS]: '#4CAF50', [TILE_TYPES.STONE]: '#757575',
    [TILE_TYPES.WOOD]: '#5D4037', [TILE_TYPES.ASH]: '#444444', [TILE_TYPES.LAVA]: '#FF4500', [TILE_TYPES.BRICK]: '#BDBDBD',
    [TILE_TYPES.GOLD]: '#FFD700', [TILE_TYPES.TORCH]: '#FFEB3B'
};

const App = () => {
    const canvasRef = useRef(null);
    const worldRef = useRef([]);
    const playerRef = useRef({ x: 4500, y: 500, vx: 0, vy: 0, w: 20, h: 36, onGround: false, facing: 1, hp: 100, mana: 100 });
    const keysRef = useRef({ left: false, right: false, jump: false, down: false });
    const cameraRef = useRef({ x: 0, y: 0 });
    const projectilesRef = useRef([]);
    const enemiesRef = useRef([]);
    const screenShakeRef = useRef(0);
    const audioCtxRef = useRef(null);
    
    const [stats, setStats] = useState({ hp: 100, mana: 100 });
    const [selectedSlot, setSelectedSlot] = useState(2);
    const [isMuted, setIsMuted] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    const inventory = [
        { type: TILE_TYPES.BRICK, label: '🧱' },
        { type: TILE_TYPES.TORCH, label: '🔦' },
        { type: 'ZENITH', label: '⚔️', isWeapon: true },
        { type: 'STAFF', label: '🪄', isWeapon: true },
        { type: 'WINGS', label: '🦋' }
    ];

    // --- テラリア・メインテーマ合成エンジン (Web Audio API) ---
    const playTerrariaTheme = useCallback(() => {
        if (audioCtxRef.current) return;
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        
        const playNote = (freq, time, duration, vol = 0.05, type = 'triangle') => {
            const osc = audioCtxRef.current.createOscillator();
            const gain = audioCtxRef.current.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, time);
            gain.gain.setValueAtTime(vol, time);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
            osc.connect(gain); gain.connect(audioCtxRef.current.destination);
            osc.start(time); osc.stop(time + duration);
        };

        // メロディデータ (Overworld Day)
        const melody = [
            { f: 392, d: 0.2 }, { f: 392, d: 0.2 }, { f: 392, d: 0.2 }, { f: 392, d: 0.2 }, // Intro G
            { f: 261, d: 0.4 }, { f: 329, d: 0.4 }, { f: 392, d: 0.4 }, { f: 523, d: 0.4 }, // C E G C
            { f: 493, d: 0.4 }, { f: 392, d: 0.4 }, { f: 329, d: 0.4 }, { f: 293, d: 0.8 }, // B G E D
            { f: 349, d: 0.4 }, { f: 440, d: 0.4 }, { f: 523, d: 0.4 }, { f: 659, d: 0.4 }, // F A C E
            { f: 587, d: 0.4 }, { f: 493, d: 0.4 }, { f: 392, d: 0.4 }, { f: 523, d: 0.8 }, // D B G C
        ];

        let nextTime = audioCtxRef.current.currentTime;
        const loop = () => {
            if (isMuted) { setTimeout(loop, 1000); return; }
            melody.forEach(n => {
                playNote(n.f, nextTime, n.d * 2.5);
                playNote(n.f / 2, nextTime, n.d * 2.5, 0.02, 'square'); // Bass
                nextTime += n.d;
            });
            setTimeout(loop, (nextTime - audioCtxRef.current.currentTime) * 1000 - 50);
        };
        loop();
    }, [isMuted]);

    useEffect(() => {
        if (audioCtxRef.current) {
            if (isMuted) audioCtxRef.current.suspend();
            else audioCtxRef.current.resume();
        }
    }, [isMuted]);

    // --- 初期化 ---
    useEffect(() => {
        const newWorld = [];
        for (let y = 0; y < WORLD_HEIGHT; y++) {
            const row = [];
            for (let x = 0; x < WORLD_WIDTH; x++) {
                const surfaceY = 60 + Math.sin(x * 0.1) * 5;
                if (y > WORLD_HEIGHT - 20) row.push(Math.random() < 0.2 ? TILE_TYPES.LAVA : TILE_TYPES.ASH);
                else if (y > surfaceY + 15) row.push(TILE_TYPES.STONE);
                else if (y > surfaceY) row.push(TILE_TYPES.DIRT);
                else if (y > surfaceY - 1) row.push(TILE_TYPES.GRASS);
                else row.push(TILE_TYPES.AIR);
            }
            newWorld.push(row);
        }
        worldRef.current = newWorld;
        enemiesRef.current = [{ type: 'KING_SLIME', x: 2000, y: 400, vx: 0, vy: 0, w: 100, h: 80, hp: 1000, maxHp: 1000, lastJump: 0 }];

        const handleResize = () => {
            const canvas = canvasRef.current;
            if (canvas) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
            setIsMobile(window.innerWidth < 1024);
        };
        window.addEventListener('resize', handleResize); handleResize();

        const down = (e) => {
            if(e.code === 'ArrowLeft' || e.code === 'KeyA') keysRef.current.left = true;
            if(e.code === 'ArrowRight' || e.code === 'KeyD') keysRef.current.right = true;
            if(e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') keysRef.current.jump = true;
            if(e.code === 'ArrowDown' || e.code === 'KeyS') keysRef.current.down = true;
        };
        const up = (e) => {
            if(e.code === 'ArrowLeft' || e.code === 'KeyA') keysRef.current.left = false;
            if(e.code === 'ArrowRight' || e.code === 'KeyD') keysRef.current.right = false;
            if(e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') keysRef.current.jump = false;
            if(e.code === 'ArrowDown' || e.code === 'KeyS') keysRef.current.down = false;
        };
        window.addEventListener('keydown', down); window.addEventListener('keyup', up);

        let fId;
        const loop = () => { update(); draw(); fId = requestAnimationFrame(loop); };
        fId = requestAnimationFrame(loop);
        return () => { window.removeEventListener('resize', handleResize); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); cancelAnimationFrame(fId); };
    }, []);

    const update = () => {
        const p = playerRef.current; const keys = keysRef.current;
        if (screenShakeRef.current > 0) screenShakeRef.current -= 0.5;

        if (keys.left) { p.vx = -MOVE_SPEED; p.facing = -1; }
        else if (keys.right) { p.vx = MOVE_SPEED; p.facing = 1; }
        else { p.vx *= FRICTION; }
        
        if (keys.down) {
            const tx = Math.floor((p.x + p.w / 2) / TILE_SIZE);
            const ty = Math.floor((p.y + p.h + 5) / TILE_SIZE);
            if (worldRef.current[ty] && worldRef.current[ty][tx] !== TILE_TYPES.AIR && worldRef.current[ty][tx] !== TILE_TYPES.LAVA) {
                worldRef.current[ty][tx] = TILE_TYPES.AIR;
                screenShakeRef.current = 2;
            }
        }

        const canFly = inventory[selectedSlot]?.type === 'WINGS' && keys.jump;
        p.vy += canFly ? 0.1 : GRAVITY;
        if (keys.jump) {
            if (p.onGround) { p.vy = JUMP_FORCE; p.onGround = false; }
            else if (canFly && p.mana > 0) { p.vy = -4; p.mana -= 0.5; }
        }

        p.x += p.vx; resolveCollision(p, 'x');
        p.y += p.vy; p.onGround = false; resolveCollision(p, 'y');
        cameraRef.current.x += (p.x - window.innerWidth/2 - cameraRef.current.x) * 0.1;
        cameraRef.current.y += (p.y - window.innerHeight/2 - cameraRef.current.y) * 0.1;

        if (Date.now() % 1000 < 20) { if (p.mana < 100) p.mana += 1; if (p.hp < 100) p.hp += 0.5; }
        if (stats.hp !== Math.floor(p.hp)) setStats({ hp: Math.floor(p.hp), mana: Math.floor(p.mana) });

        projectilesRef.current = projectilesRef.current.filter(pr => {
            pr.x += pr.vx; pr.y += pr.vy; pr.life -= 0.02;
            enemiesRef.current.forEach(en => {
                if (en.hp > 0 && Math.abs(pr.x - (en.x+en.w/2)) < en.w/2 && Math.abs(pr.y - (en.y+en.h/2)) < en.h/2) {
                    en.hp -= 30; pr.life = 0; screenShakeRef.current = 5;
                }
            });
            return pr.life > 0;
        });

        enemiesRef.current.forEach(en => {
            if (en.hp <= 0) return;
            en.vy += GRAVITY; en.y += en.vy;
            const tx = Math.floor((en.x+en.w/2)/TILE_SIZE), ty = Math.floor((en.y+en.h)/TILE_SIZE);
            if (worldRef.current[ty] && worldRef.current[ty][tx] !== TILE_TYPES.AIR) { en.y = ty*TILE_SIZE - en.h; en.vy = 0; if (Date.now() - en.lastJump > 2000) { en.vy = -10; en.vx = (p.x - en.x > 0 ? 1 : -1) * 3; en.lastJump = Date.now(); } }
            en.x += en.vx; en.vx *= 0.95;
            if (Math.abs(p.x - en.x) < 30 && Math.abs(p.y - en.y) < 30) { p.hp -= 0.5; screenShakeRef.current = 2; }
        });

        if (p.x < 0) p.x = 0; if (p.x > WORLD_WIDTH * TILE_SIZE - p.w) p.x = WORLD_WIDTH * TILE_SIZE - p.w;
    };

    const resolveCollision = (p, axis) => {
        const x1 = Math.floor(p.x/TILE_SIZE), x2 = Math.floor((p.x+p.w)/TILE_SIZE);
        const y1 = Math.floor(p.y/TILE_SIZE), y2 = Math.floor((p.y+p.h)/TILE_SIZE);
        for(let y=y1; y<=y2; y++) {
            for(let x=x1; x<=x2; x++) {
                if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) continue;
                if (worldRef.current[y][x] !== TILE_TYPES.AIR && worldRef.current[y][x] !== TILE_TYPES.LAVA) {
                    if (axis === 'x') {
                        if (p.vx > 0) p.x = x * TILE_SIZE - p.w - 0.1;
                        else if (p.vx < 0) p.x = (x + 1) * TILE_SIZE + 0.1;
                        p.vx = 0;
                    } else {
                        if (p.vy > 0) { p.y = y * TILE_SIZE - p.h - 0.1; p.onGround = true; }
                        else if (p.vy < 0) p.y = (y + 1) * TILE_SIZE + 0.1;
                        p.vy = 0;
                    }
                }
            }
        }
    };

    const draw = () => {
        const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d');
        const cam = cameraRef.current; const p = playerRef.current;
        ctx.fillStyle = '#87CEEB'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        const sX = (Math.random()-0.5)*screenShakeRef.current, sY = (Math.random()-0.5)*screenShakeRef.current;
        ctx.translate(-Math.floor(cam.x) + sX, -Math.floor(cam.y) + sY);
        const startX = Math.max(0, Math.floor(cam.x/TILE_SIZE)), endX = Math.min(WORLD_WIDTH, Math.ceil((cam.x+canvas.width)/TILE_SIZE));
        const startY = Math.max(0, Math.floor(cam.y/TILE_SIZE)), endY = Math.min(WORLD_HEIGHT, Math.ceil((cam.y+canvas.height)/TILE_SIZE));
        for(let y=startY; y<endY; y++) {
            for(let x=startX; x<endX; x++) {
                const t = worldRef.current[y][x];
                if (t !== TILE_TYPES.AIR) {
                    ctx.fillStyle = TILE_COLORS[t];
                    ctx.fillRect(x*TILE_SIZE, y*TILE_SIZE, TILE_SIZE, TILE_SIZE);
                    if (t !== TILE_TYPES.LAVA) { ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.strokeRect(x*TILE_SIZE, y*TILE_SIZE, TILE_SIZE, TILE_SIZE); }
                }
            }
        }
        ctx.save(); ctx.translate(p.x+p.w/2, p.y+p.h/2); if(p.facing < 0) ctx.scale(-1, 1);
        ctx.fillStyle = '#37474F'; ctx.fillRect(-12, -20, 24, 16); ctx.fillStyle = '#00E5FF'; ctx.fillRect(2, -14, 10, 4);
        ctx.fillStyle = '#455A64'; ctx.fillRect(-10, -4, 20, 20); ctx.fillStyle = '#D32F2F'; ctx.beginPath(); ctx.moveTo(-10,-4); ctx.lineTo(-25,4); ctx.lineTo(-10,18); ctx.fill();
        ctx.restore();
        projectilesRef.current.forEach(pr => { ctx.fillStyle = pr.color; ctx.beginPath(); ctx.arc(pr.x, pr.y, 6, 0, Math.PI*2); ctx.fill(); });
        enemiesRef.current.forEach(en => { if(en.hp > 0) { ctx.fillStyle = 'rgba(0,150,255,0.7)'; ctx.beginPath(); ctx.arc(en.x+en.w/2, en.y+en.h/2, en.w/2, 0, Math.PI*2); ctx.fill(); } });
        ctx.restore();
    };

    const handleAction = (e) => {
        if (e.cancelable) e.preventDefault();
        playTerrariaTheme();
        const rect = canvasRef.current.getBoundingClientRect();
        let cX, cY; if (e.touches) { cX = e.touches[0].clientX; cY = e.touches[0].clientY; } else { cX = e.clientX; cY = e.clientY; }
        const mX = cX - rect.left + cameraRef.current.x, mY = cY - rect.top + cameraRef.current.y;
        if (cY < 120 && cX < 500) return;
        const item = inventory[selectedSlot]; const p = playerRef.current;
        if (item?.isWeapon) {
            const ang = Math.atan2(mY-(p.y+p.h/2), mX-(p.x+p.w/2));
            const num = item.type === 'ZENITH' ? 5 : 1;
            if (item.type === 'STAFF' && p.mana < 10) return;
            if (item.type === 'STAFF') p.mana -= 10;
            for(let i=0; i<num; i++) projectilesRef.current.push({ x: p.x+p.w/2, y: p.y+p.h/2, vx: Math.cos(ang + (Math.random()-0.5)*0.3)*12, vy: Math.sin(ang + (Math.random()-0.5)*0.3)*12, color: item.type === 'ZENITH' ? '#00f2ff' : '#E040FB', life: 1.0 });
        } else {
            const tx = Math.floor(mX/TILE_SIZE), ty = Math.floor(mY/TILE_SIZE);
            if (tx >= 0 && tx < WORLD_WIDTH && ty >= 0 && ty < WORLD_HEIGHT) worldRef.current[ty][tx] = (worldRef.current[ty][tx] === TILE_TYPES.AIR) ? item.type : TILE_TYPES.AIR;
        }
    };

    const Joystick = () => {
        const baseRef = useRef(null);
        const stickRef = useRef(null);
        const [active, setActive] = useState(false);
        const handleTouch = (e) => {
            const touch = e.touches[0];
            const base = baseRef.current.getBoundingClientRect();
            const centerX = base.left + base.width / 2;
            const centerY = base.top + base.height / 2;
            const dx = touch.clientX - centerX;
            const dy = touch.clientY - centerY;
            const dist = Math.min(60, Math.sqrt(dx * dx + dy * dy));
            const angle = Math.atan2(dy, dx);
            const x = Math.cos(angle) * dist;
            const y = Math.sin(angle) * dist;
            stickRef.current.style.transform = `translate(${x}px, ${y}px)`;
            keysRef.current.left = dx < -20;
            keysRef.current.right = dx > 20;
            keysRef.current.jump = dy < -20;
            keysRef.current.down = dy > 30;
        };
        const resetJoystick = () => { setActive(false); stickRef.current.style.transform = `translate(0, 0)`; keysRef.current.left = false; keysRef.current.right = false; keysRef.current.jump = false; keysRef.current.down = false; };
        return (
            <div ref={baseRef} onTouchStart={(e) => { e.preventDefault(); setActive(true); handleTouch(e); playTerrariaTheme(); }} onTouchMove={(e) => { e.preventDefault(); handleTouch(e); }} onTouchEnd={resetJoystick} style={{ position: 'fixed', bottom: '50px', left: '50px', width: '150px', height: '150px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', border: '4px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, pointerEvents: 'auto', touchAction: 'none' }}>
                <div ref={stickRef} style={{ width: '70px', height: '70px', background: active ? 'rgba(0, 242, 255, 0.6)' : 'rgba(255,255,255,0.4)', borderRadius: '50%', border: '2px solid #fff' }} />
            </div>
        );
    };

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', touchAction: 'none', background: '#000', userSelect: 'none', WebkitUserSelect: 'none' }}>
            <canvas ref={canvasRef} onMouseDown={handleAction} onTouchStart={handleAction} style={{ display: 'block' }} />
            <div style={{ position: 'fixed', top: '20px', right: '20px', textAlign: 'right', zIndex: 100 }}>
                <div style={{ color: '#fff', fontSize: '1.2em', fontWeight: 'bold', fontFamily: 'Orbitron' }}>NEURAL TERRARIA v22</div>
                <div style={{ width: '200px', height: '15px', background: '#222', border: '2px solid #fff', borderRadius: '8px', margin: '8px 0', overflow: 'hidden' }}>
                    <div style={{ width: `${stats.hp}%`, height: '100%', background: '#ff1744' }} />
                </div>
                <div style={{ width: '150px', height: '10px', background: '#222', border: '2px solid #fff', borderRadius: '5px', marginLeft: '50px', overflow: 'hidden' }}>
                    <div style={{ width: `${stats.mana}%`, height: '100%', background: '#2979ff' }} />
                </div>
            </div>
            <div style={{ position: 'fixed', top: '20px', left: '20px', display: 'flex', gap: '8px', zIndex: 100 }}>
                {inventory.map((item, idx) => (
                    <div key={idx} onPointerDown={(e) => { e.stopPropagation(); setSelectedSlot(idx); playTerrariaTheme(); }} style={{ width: '50px', height: '50px', background: selectedSlot === idx ? '#fff' : 'rgba(255,255,255,0.3)', border: selectedSlot === idx ? '3px solid #ff4081' : '2px solid #fff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', cursor: 'pointer' }}>{item.label}</div>
                ))}
                <div onPointerDown={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }} style={{ width: '50px', height: '50px', background: isMuted ? '#ff1744' : '#00e676', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '24px', border: '2px solid #fff' }}>{isMuted ? '🔇' : '🔊'}</div>
            </div>
            {isMobile && <Joystick />}
        </div>
    );
};

export default App;
