import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- Constants & Config ---
const WORLD_WIDTH = 250;
const WORLD_HEIGHT = 150;
const TILE_SIZE = 32;
const GRAVITY = 0.45;
const JUMP_FORCE = -9.5;
const MOVE_SPEED = 4.8;
const FRICTION = 0.85;

const TILE_TYPES = { 
    AIR: 0, DIRT: 1, GRASS: 2, STONE: 3, WOOD: 4, LEAVES: 5, 
    LAVA: 6, ASH: 7, HELLSTONE: 8, BRICK: 9, ORE_GOLD: 10, 
    CORRUPT_GRASS: 11, TORCH: 12 
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
    [TILE_TYPES.ORE_GOLD]: '#FFD700',
    [TILE_TYPES.CORRUPT_GRASS]: '#9C27B0',
    [TILE_TYPES.TORCH]: '#FFD54F',
};

const PIXEL_PATTERNS = {
    [TILE_TYPES.DIRT]: [[0,0,1,0,0,0,1,0], [0,1,1,1,0,1,1,1], [1,1,0,1,1,1,0,1], [0,1,1,1,0,1,1,1], [0,0,1,0,0,0,1,0], [0,1,1,1,0,1,1,1], [1,1,0,1,1,1,0,1], [0,1,1,1,0,1,1,1]],
    [TILE_TYPES.GRASS]: [[2,2,2,2,2,2,2,2], [2,2,2,2,2,2,2,2], [2,1,2,1,2,2,1,2], [1,1,1,1,1,1,1,1], [1,1,1,1,1,1,1,1], [1,0,1,0,1,1,0,1], [1,1,1,1,1,1,1,1], [1,1,1,1,1,1,1,1]],
    [TILE_TYPES.CORRUPT_GRASS]: [[2,2,2,2,2,2,2,2], [2,2,2,2,2,2,2,2], [2,1,2,1,2,2,1,2], [1,1,1,1,1,1,1,1], [1,1,1,1,1,1,1,1], [1,0,1,0,1,1,0,1], [1,1,1,1,1,1,1,1], [1,1,1,1,1,1,1,1]],
    [TILE_TYPES.STONE]: [[0,0,0,0,0,0,0,0], [0,1,1,1,0,1,1,0], [0,1,0,1,1,0,1,0], [0,1,1,1,0,1,1,0], [0,0,0,0,0,0,0,0], [0,1,1,0,1,1,1,0], [0,1,0,1,1,0,1,0], [0,1,1,1,0,1,1,0]],
    [TILE_TYPES.ASH]: [[0,0,1,0,1,0,0,1], [0,1,1,1,1,1,0,0], [1,1,1,1,1,1,1,0], [0,1,1,1,1,1,1,1], [0,0,1,0,1,0,0,1], [0,1,1,1,1,1,0,0], [1,1,1,1,1,1,1,0], [0,1,1,1,1,1,1,1]],
    [TILE_TYPES.HELLSTONE]: [[1,1,0,1,1,0,1,1], [1,1,1,1,1,1,1,1], [0,1,1,0,1,1,0,1], [1,1,1,1,1,1,1,1], [1,1,0,1,1,0,1,1], [1,1,1,1,1,1,1,1], [0,1,1,0,1,1,0,1], [1,1,1,1,1,1,1,1]],
    [TILE_TYPES.LAVA]: [[2,2,2,2,2,2,2,2], [2,1,1,1,1,1,1,2], [1,1,0,0,0,0,1,1], [2,1,1,1,1,1,1,2], [2,2,2,2,2,2,2,2], [2,1,1,1,1,1,1,2], [1,1,0,0,0,0,1,1], [2,1,1,1,1,1,1,2]],
    [TILE_TYPES.ORE_GOLD]: [[1,1,1,1,1,1,1,1], [1,2,2,1,1,2,2,1], [1,2,2,1,1,2,2,1], [1,1,1,1,1,1,1,1], [1,2,2,1,1,2,2,1], [1,2,2,1,1,2,2,1], [1,1,1,1,1,1,1,1], [1,1,1,1,1,1,1,1]],
    [TILE_TYPES.TORCH]: [[0,0,0,1,1,0,0,0], [0,0,1,2,2,1,0,0], [0,0,1,2,2,1,0,0], [0,0,0,1,1,0,0,0], [0,0,0,1,1,0,0,0], [0,0,0,1,1,0,0,0], [0,0,0,1,1,0,0,0], [0,0,0,1,1,0,0,0]],
};

const App = () => {
    const canvasRef = useRef(null);
    const worldRef = useRef([]);
    const playerRef = useRef({ x: 2500, y: 500, vx: 0, vy: 0, w: 20, h: 36, onGround: false, hp: 100, maxHp: 100, mana: 100, maxMana: 100 });
    const keysRef = useRef({});
    const cameraRef = useRef({ x: 0, y: 0 });
    const projectilesRef = useRef([]);
    const enemiesRef = useRef([]);
    const npcsRef = useRef([]);
    const particlesRef = useRef([]);
    const audioCtxRef = useRef(null);
    const timeRef = useRef(0);
    const screenShakeRef = useRef(0);
    
    const [selectedSlot, setSelectedSlot] = useState(0);
    const [isMobile, setIsMobile] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [gameTime, setGameTime] = useState(0); // 0 to 24000
    const [stats, setStats] = useState({ hp: 100, mana: 100 });

    const inventory = [
        { type: TILE_TYPES.BRICK, label: '🧱', color: TILE_COLORS[TILE_TYPES.BRICK] },
        { type: TILE_TYPES.TORCH, label: '🔦', color: TILE_COLORS[TILE_TYPES.TORCH] },
        { type: 'ZENITH', label: '⚔️', color: 'linear-gradient(45deg, #00f2ff, #bf00ff)', isWeapon: true },
        { type: 'STAFF', label: '🪄', color: '#E040FB', isWeapon: true },
        { type: 'WINGS', label: '🦋', color: '#fff', isPassive: true },
    ];

    const playNote = (freq, time, duration, vol = 0.05, type = 'triangle') => {
        if (!audioCtxRef.current || isMuted) return;
        const osc = audioCtxRef.current.createOscillator();
        const gain = audioCtxRef.current.createGain();
        osc.type = type; osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(vol, time); gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        osc.connect(gain); gain.connect(audioCtxRef.current.destination);
        osc.start(time); osc.stop(time + duration);
    };

    const startBGM = useCallback(() => {
        if (audioCtxRef.current) return;
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        const melody = [{f:261,d:0.25},{f:329,d:0.25},{f:392,d:0.25},{f:523,d:0.5},{f:493,d:0.25},{f:392,d:0.25},{f:261,d:0.5}];
        let nextTime = audioCtxRef.current.currentTime;
        const loop = () => {
            if (isMuted) { setTimeout(loop, 1000); return; }
            melody.forEach(n => {
                const isNight = gameTime > 12000;
                playNote(isNight ? n.f * 0.8 : n.f, nextTime, n.d * 3, 0.04);
                nextTime += n.d;
            });
            setTimeout(loop, (nextTime - audioCtxRef.current.currentTime) * 1000 - 100);
        };
        loop();
    }, [isMuted, gameTime]);

    const spawnParticle = (x, y, color, count = 5) => {
        for(let i=0; i<count; i++) {
            particlesRef.current.push({ x, y, vx: (Math.random()-0.5)*12, vy: (Math.random()-0.5)*12, life: 1.0, color, size: Math.random()*5+2 });
        }
    };

    useEffect(() => {
        // World Gen v2 (Biomes & Underworld)
        const newWorld = [];
        for (let y = 0; y < WORLD_HEIGHT; y++) {
            const row = [];
            for (let x = 0; x < WORLD_WIDTH; x++) {
                const surfaceY = 40 + Math.sin(x * 0.08) * 8;
                const isCorruption = x > 80 && x < 120;
                const cave = Math.random() < 0.06 && y > surfaceY + 12;

                if (cave && y < WORLD_HEIGHT - 30) row.push(TILE_TYPES.AIR);
                else if (y > WORLD_HEIGHT - 20) row.push(Math.random() < 0.2 ? TILE_TYPES.LAVA : TILE_TYPES.ASH);
                else if (y > WORLD_HEIGHT - 40) row.push(TILE_TYPES.HELLSTONE);
                else if (y > surfaceY + 20) row.push(Math.random() < 0.02 ? TILE_TYPES.ORE_GOLD : TILE_TYPES.STONE);
                else if (y > surfaceY) row.push(TILE_TYPES.DIRT);
                else if (y > surfaceY - 1) row.push(isCorruption ? TILE_TYPES.CORRUPT_GRASS : TILE_TYPES.GRASS);
                else row.push(TILE_TYPES.AIR);
            }
            newWorld.push(row);
        }
        worldRef.current = newWorld;
        enemiesRef.current = [
            { type: 'KING_SLIME', x: 1000, y: 400, vx: 0, vy: 0, w: 120, h: 90, hp: 1000, maxHp: 1000, lastJump: 0, lastHit: 0 },
            { type: 'SKELETRON', x: 4000, y: 200, vx: 0, vy: 0, w: 80, h: 80, hp: 5000, maxHp: 5000, lastHit: 0, hands: [{x:0,y:0},{x:0,y:0}] }
        ];
        npcsRef.current = [{ type: 'GUIDE', x: 2400, y: 100, vx: 0, vy: 0, w: 20, h: 36, dir: 1 }];

        const handleResize = () => { if (canvasRef.current) { canvasRef.current.width = window.innerWidth; canvasRef.current.height = window.innerHeight; } setIsMobile(window.innerWidth < 1024); };
        window.addEventListener('resize', handleResize); handleResize();
        const triggerAudio = () => { startBGM(); window.removeEventListener('click', triggerAudio); };
        window.addEventListener('click', triggerAudio);
        const down = (e) => { keysRef.current[e.code] = true; }; const up = (e) => { keysRef.current[e.code] = false; };
        window.addEventListener('keydown', down); window.addEventListener('keyup', up);
        
        let frameId;
        const loop = () => { update(); draw(); frameId = requestAnimationFrame(loop); };
        frameId = requestAnimationFrame(loop);
        return () => { window.removeEventListener('resize', handleResize); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); cancelAnimationFrame(frameId); };
    }, [startBGM]);

    const update = () => {
        const p = playerRef.current; const keys = keysRef.current;
        timeRef.current++;
        setGameTime(prev => (prev + 5) % 24000);

        // Shake
        if (screenShakeRef.current > 0) screenShakeRef.current -= 0.5;

        // Player Physics
        let targetVx = 0;
        if (keys['ArrowLeft'] || keys['KeyA']) targetVx = -MOVE_SPEED; else if (keys['ArrowRight'] || keys['KeyD']) targetVx = MOVE_SPEED;
        p.vx = targetVx || (p.vx * FRICTION);
        
        p.vy += (inventory[selectedSlot].type === 'WINGS' && (keys['ArrowUp'] || keys['Space'])) ? 0.15 : GRAVITY;
        if ((keys['ArrowUp'] || keys['KeyW'] || keys['Space'])) {
            if (p.onGround) { p.vy = JUMP_FORCE; p.onGround = false; }
            else if (inventory[selectedSlot].type === 'WINGS' && p.mana > 0) { p.vy = -5; p.mana -= 0.5; spawnParticle(p.x+p.w/2, p.y+p.h, '#fff', 1); }
        }
        
        p.x += p.vx; resolveCollisions(p, 'x'); p.y += p.vy; p.onGround = false; resolveCollisions(p, 'y');
        cameraRef.current.x += (p.x - window.innerWidth / 2 - cameraRef.current.x) * 0.1;
        cameraRef.current.y += (p.y - window.innerHeight / 2 - cameraRef.current.y) * 0.1;

        // Regen
        if (timeRef.current % 60 === 0) {
            if (p.mana < p.maxMana) p.mana += 2;
            if (p.hp < p.maxHp) p.hp += 1;
        }
        if (stats.hp !== Math.floor(p.hp) || stats.mana !== Math.floor(p.mana)) setStats({ hp: Math.floor(p.hp), mana: Math.floor(p.mana) });

        particlesRef.current = particlesRef.current.filter(pt => { pt.x += pt.vx; pt.y += pt.vy; pt.life -= 0.02; return pt.life > 0; });

        projectilesRef.current = projectilesRef.current.filter(proj => {
            proj.life -= 0.02; proj.x += proj.vx; proj.y += proj.vy; proj.angle += 0.2;
            enemiesRef.current.forEach(en => {
                const dx = proj.x - (en.x + en.w / 2), dy = proj.y - (en.y + en.h / 2), dist = Math.sqrt(dx * dx + dy * dy);
                if (en.hp > 0 && dist < en.w / 2 + 15) { 
                    en.hp -= proj.dmg; proj.life = 0; en.lastHit = Date.now();
                    spawnParticle(proj.x, proj.y, proj.color, 5);
                    screenShakeRef.current = 3;
                }
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
            if (en.type === 'SKELETRON') {
                const angle = Date.now() * 0.002;
                en.x += (p.x - en.x) * 0.015; en.y += (p.y - 300 - en.y) * 0.015;
                en.hands[0] = { x: en.x - 100 + Math.cos(angle)*50, y: en.y + 100 + Math.sin(angle)*50 };
                en.hands[1] = { x: en.x + 100 + Math.sin(angle)*50, y: en.y + 100 + Math.cos(angle)*50 };
            }
            // Damage player
            const dx = p.x - en.x, dy = p.y - en.y;
            if (Math.abs(dx) < en.w && Math.abs(dy) < en.h && timeRef.current % 40 === 0) { p.hp -= 15; screenShakeRef.current = 10; spawnParticle(p.x, p.y, '#f00', 8); }
        });

        npcsRef.current.forEach(n => {
            n.vy += GRAVITY; n.y += n.vy;
            const tx = Math.floor((n.x + n.w/2) / TILE_SIZE), ty = Math.floor((n.y + n.h) / TILE_SIZE);
            if (worldRef.current[ty] && worldRef.current[ty][tx] !== TILE_TYPES.AIR) { n.y = ty * TILE_SIZE - n.h; n.vy = 0; }
            if (Math.random() < 0.01) n.dir *= -1;
            n.x += n.dir * 0.6;
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
        
        // Dynamic Sky
        const timeFactor = Math.sin((gameTime / 24000) * Math.PI * 2 - Math.PI/2) * 0.5 + 0.5;
        const skyR = Math.floor(135 * timeFactor), skyG = Math.floor(206 * timeFactor), skyB = Math.floor(235 * timeFactor + (1-timeFactor)*20);
        ctx.fillStyle = `rgb(${skyR},${skyG},${skyB})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        const shakeX = (Math.random()-0.5) * screenShakeRef.current;
        const shakeY = (Math.random()-0.5) * screenShakeRef.current;
        ctx.translate(-Math.floor(cam.x) + shakeX, -Math.floor(cam.y) + shakeY);

        // Rendering tiles
        const startX = Math.max(0, Math.floor(cam.x / TILE_SIZE)), endX = Math.min(WORLD_WIDTH, Math.ceil((cam.x + canvas.width) / TILE_SIZE));
        const startY = Math.max(0, Math.floor(cam.y / TILE_SIZE)), endY = Math.min(WORLD_HEIGHT, Math.ceil((cam.y + canvas.height) / TILE_SIZE));
        
        const lightSources = [];
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const tile = worldRef.current[y][x];
                if (tile !== TILE_TYPES.AIR) {
                    const pattern = PIXEL_PATTERNS[tile]; const pSize = TILE_SIZE / 8;
                    if (pattern) {
                        pattern.forEach((row, ry) => { row.forEach((pixel, rx) => {
                            ctx.fillStyle = pixel === 0 ? 'rgba(0,0,0,0.15)' : pixel === 2 ? '#66BB6A' : TILE_COLORS[tile];
                            ctx.fillRect(x * TILE_SIZE + rx * pSize, y * TILE_SIZE + ry * pSize, pSize, pSize);
                        }); });
                    } else { ctx.fillStyle = TILE_COLORS[tile]; ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE); }
                    if (tile === TILE_TYPES.LAVA || tile === TILE_TYPES.TORCH) lightSources.push({x: x*TILE_SIZE+16, y: y*TILE_SIZE+16, r: tile===TILE_TYPES.LAVA ? 100 : 150});
                }
            }
        }

        // Characters & Projectiles
        ctx.save(); ctx.translate(p.x+p.w/2, p.y+p.h/2); if (p.vx < 0) ctx.scale(-1, 1);
        ctx.fillStyle = '#37474F'; ctx.fillRect(-12, -20, 24, 16); ctx.fillStyle = '#00E5FF'; ctx.fillRect(2, -14, 10, 4);
        ctx.fillStyle = '#455A64'; ctx.fillRect(-10, -4, 20, 20); ctx.fillStyle = '#D32F2F';
        ctx.beginPath(); ctx.moveTo(-10, -4); ctx.lineTo(-25, 4); ctx.lineTo(-10, 18); ctx.fill(); ctx.restore();

        projectilesRef.current.forEach(proj => {
            ctx.save(); ctx.translate(proj.x, proj.y); ctx.rotate(proj.angle); ctx.shadowBlur = 15; ctx.shadowColor = proj.color; ctx.fillStyle = proj.color;
            ctx.beginPath(); proj.isMagic ? ctx.arc(0,0,10,0,Math.PI*2) : ctx.rect(-2,-15,4,20); ctx.fill(); ctx.restore();
        });

        enemiesRef.current.forEach(en => {
            if (en.hp <= 0) return;
            ctx.save(); 
            if (en.type === 'KING_SLIME') { ctx.fillStyle = 'rgba(0, 150, 255, 0.7)'; ctx.beginPath(); ctx.arc(en.x+en.w/2, en.y+en.h/2, en.w/2, 0, Math.PI*2); ctx.fill(); }
            if (en.type === 'SKELETRON') {
                ctx.fillStyle = '#eee'; ctx.beginPath(); ctx.arc(en.x+40, en.y+40, 40, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(en.x+25, en.y+35, 8, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(en.x+55, en.y+35, 8, 0, Math.PI*2); ctx.fill();
                en.hands.forEach(h => { ctx.fillStyle = '#ddd'; ctx.fillRect(h.x-15, h.y-15, 30, 30); });
            }
            ctx.restore();
        });

        // Global Lighting (Simple)
        if (depth > 50 || timeFactor < 0.3) {
            ctx.restore(); ctx.save();
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = `rgba(0,0,20,${Math.max(0, 0.8 - timeFactor)})`;
            ctx.fillRect(0,0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = 'source-over';
        }

        ctx.restore();
    };

    const handleAction = (e) => {
        if (e.cancelable) e.preventDefault();
        const rect = canvasRef.current.getBoundingClientRect();
        let cX, cY; if (e.touches && e.touches.length > 0) { cX = e.touches[0].clientX; cY = e.touches[0].clientY; } else { cX = e.clientX; cY = e.clientY; }
        const mouseX = cX - rect.left + cameraRef.current.x; const mouseY = cY - rect.top + cameraRef.current.y;
        if (cY < 120 && cX < 450) return;

        const item = inventory[selectedSlot]; const p = playerRef.current;
        if (item.type === 'ZENITH') {
            const colors = ['#00f2ff','#bf00ff','#ff0055','#33ff00','#ffff00'];
            for(let i=0; i<6; i++) {
                const angle = Math.atan2(mouseY-(p.y+p.h/2), mouseX-(p.x+p.w/2)) + (Math.random()-0.5)*0.4;
                projectilesRef.current.push({ x: p.x+p.w/2, y: p.y+p.h/2, vx: Math.cos(angle)*15, vy: Math.sin(angle)*15, angle: Math.random()*Math.PI*2, color: colors[Math.floor(Math.random()*colors.length)], life: 1.0, dmg: 20 });
            }
            playNote(600, audioCtxRef.current?.currentTime, 0.1, 0.02, 'sawtooth');
        } else if (item.type === 'STAFF') {
            if (p.mana >= 10) {
                p.mana -= 10; const angle = Math.atan2(mouseY-(p.y+p.h/2), mouseX-(p.x+p.w/2));
                projectilesRef.current.push({ x: p.x+p.w/2, y: p.y+p.h/2, vx: Math.cos(angle)*12, vy: Math.sin(angle)*12, angle: 0, color: '#E040FB', life: 2.0, dmg: 50, isMagic: true });
                playNote(800, audioCtxRef.current?.currentTime, 0.2, 0.03, 'sine');
            }
        } else {
            const tx = Math.floor(mouseX/TILE_SIZE), ty = Math.floor(mouseY/TILE_SIZE);
            if (tx >= 0 && tx < WORLD_WIDTH && ty >= 0 && ty < WORLD_HEIGHT) {
                if (worldRef.current[ty][tx] === TILE_TYPES.AIR) worldRef.current[ty][tx] = item.type;
                else { spawnParticle(tx*TILE_SIZE+16, ty*TILE_SIZE+16, TILE_COLORS[worldRef.current[ty][tx]], 3); worldRef.current[ty][tx] = TILE_TYPES.AIR; playNote(200, audioCtxRef.current?.currentTime, 0.05, 0.02, 'square'); }
            }
        }
    };

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', background: '#000' }}>
            <canvas ref={canvasRef} onMouseDown={handleAction} onTouchStart={handleAction} style={{ display: 'block' }} />
            
            <div style={{ position: 'fixed', top: '20px', right: '20px', textAlign: 'right', zIndex: 100 }}>
                <div style={{ color: '#fff', fontSize: '1.2em', fontWeight: 'bold', fontFamily: 'Orbitron', marginBottom: '5px', textShadow: '0 0 10px #00f2ff' }}>NEURAL TERRARIA v14</div>
                <div style={{ color: '#fff', fontSize: '0.8em', marginBottom: '5px' }}>{gameTime > 12000 ? '🌙 NIGHT' : '☀️ DAY'}</div>
                <div style={{ width: '200px', height: '18px', background: 'rgba(0,0,0,0.5)', border: '2px solid #fff', borderRadius: '9px', overflow: 'hidden', marginBottom: '5px' }}>
                    <div style={{ width: `${stats.hp}%`, height: '100%', background: 'linear-gradient(90deg, #ff1744, #ff5252)', transition: 'width 0.3s' }} />
                </div>
                <div style={{ width: '150px', height: '10px', background: 'rgba(0,0,0,0.5)', border: '2px solid #fff', borderRadius: '5px', overflow: 'hidden', marginLeft: '50px' }}>
                    <div style={{ width: `${stats.mana}%`, height: '100%', background: 'linear-gradient(90deg, #2979ff, #448aff)', transition: 'width 0.3s' }} />
                </div>
            </div>

            <div style={{ position: 'fixed', top: '20px', left: '20px', display: 'flex', gap: '10px', zIndex: 100 }}>
                {inventory.map((item, idx) => (
                    <div key={idx} onPointerDown={(e) => { e.stopPropagation(); setSelectedSlot(idx); }} style={{ width: '55px', height: '55px', background: selectedSlot === idx ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255,255,255,0.4)', border: selectedSlot === idx ? '4px solid #ff4081' : '2px solid #fff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(5px)' }}>
                        <div style={{ fontSize: '28px' }}>{item.label}</div>
                    </div>
                ))}
                <div onPointerDown={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }} style={{ width: '55px', height: '55px', background: isMuted ? '#ff1744' : '#00e676', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '24px', border: '2px solid #fff' }}>{isMuted ? '🔇' : '🔊'}</div>
            </div>

            {isMobile && (
                <div style={{ position: 'fixed', bottom: '30px', left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: '0 30px', zIndex: 100, pointerEvents: 'none' }}>
                    <div style={{ display: 'flex', gap: '15px', pointerEvents: 'auto' }}>
                        <button onTouchStart={() => keysRef.current['KeyA'] = true} onTouchEnd={() => keysRef.current['KeyA'] = false} className="ctrl-btn">←</button>
                        <button onTouchStart={() => keysRef.current['KeyD'] = true} onTouchEnd={() => keysRef.current['KeyD'] = false} className="ctrl-btn">→</button>
                    </div>
                    <button onTouchStart={() => keysRef.current['Space'] = true} onTouchEnd={() => keysRef.current['Space'] = false} className="ctrl-btn" style={{ width: '110px', height: '110px', borderRadius: '50%', background: 'rgba(255, 64, 129, 0.7)' }}>JUMP</button>
                </div>
            )}
            <style>{`.ctrl-btn { width: 90px; height: 90px; background: rgba(255,255,255,0.2); border: 3px solid #fff; border-radius: 24px; color: #fff; font-weight: bold; font-size: 2.8em; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px); pointer-events: auto; -webkit-tap-highlight-color: transparent; }`}</style>
        </div>
    );
};

export default App;
