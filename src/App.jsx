import React, { useState, useEffect, useRef } from 'react';

// Constants
const WORLD_WIDTH = 100;
const WORLD_HEIGHT = 50;
const TILE_SIZE = 32;
const GRAVITY = 0.45;
const JUMP_FORCE = -9.5;
const MOVE_SPEED = 4.5;
const FRICTION = 0.85;

const TILE_TYPES = { AIR: 0, DIRT: 1, GRASS: 2, STONE: 3, WOOD: 4, LEAVES: 5 };
const TILE_COLORS = {
    [TILE_TYPES.AIR]: null,
    [TILE_TYPES.DIRT]: '#8B4513',
    [TILE_TYPES.GRASS]: '#4CAF50',
    [TILE_TYPES.STONE]: '#757575',
    [TILE_TYPES.WOOD]: '#5D4037',
    [TILE_TYPES.LEAVES]: '#2E7D32',
};

const App = () => {
    const canvasRef = useRef(null);
    const worldRef = useRef([]);
    const playerRef = useRef({ x: 200, y: 100, vx: 0, vy: 0, w: 20, h: 36, onGround: false });
    const keysRef = useRef({});
    const cameraRef = useRef({ x: 0, y: 0 });
    const projectilesRef = useRef([]); // Zenith projectiles
    const enemiesRef = useRef([]); // King Slime and others
    
    const [selectedSlot, setSelectedSlot] = useState(0);
    const [isMobile, setIsMobile] = useState(false);
    const [spawnBoss, setSpawnBoss] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [audioStarted, setAudioStarted] = useState(false);

    const audioRef = useRef(null);

    const inventory = [
        { type: TILE_TYPES.DIRT, color: TILE_COLORS[TILE_TYPES.DIRT] },
        { type: TILE_TYPES.WOOD, color: TILE_COLORS[TILE_TYPES.WOOD] },
        { type: TILE_TYPES.STONE, color: TILE_COLORS[TILE_TYPES.STONE] },
        { type: 'ZENITH', color: 'linear-gradient(45deg, #00f2ff, #bf00ff)', isWeapon: true },
    ];

    // Initialization
    useEffect(() => {
        // Terraria-like background music
        const audio = new Audio('https://www.chosic.com/wp-content/uploads/2021/07/The-Adventure-Begins.mp3');
        audio.loop = true;
        audio.volume = 0.3;
        audioRef.current = audio;

        const handleFirstInteraction = () => {
            if (audioRef.current) {
                audioRef.current.play().catch(e => console.error("Audio play failed:", e));
                setAudioStarted(true);
            }
            window.removeEventListener('mousedown', handleFirstInteraction);
            window.removeEventListener('touchstart', handleFirstInteraction);
            window.removeEventListener('keydown', handleFirstInteraction);
        };

        window.addEventListener('mousedown', handleFirstInteraction);
        window.addEventListener('touchstart', handleFirstInteraction);
        window.addEventListener('keydown', handleFirstInteraction);

        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            window.removeEventListener('mousedown', handleFirstInteraction);
            window.removeEventListener('touchstart', handleFirstInteraction);
            window.removeEventListener('keydown', handleFirstInteraction);
        };
    }, []);

    // Mute handling
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.muted = isMuted;
        }
    }, [isMuted]);

    // Secondary Initialization (World & Logic)
    useEffect(() => {
        // Generate World
        const newWorld = [];
        for (let y = 0; y < WORLD_HEIGHT; y++) {
            const row = [];
            for (let x = 0; x < WORLD_WIDTH; x++) {
                const surfaceY = 25 + Math.sin(x * 0.1) * 3; // Lower surface
                if (y > surfaceY + 15) row.push(TILE_TYPES.STONE);
                else if (y > surfaceY) row.push(TILE_TYPES.DIRT);
                else if (y > surfaceY - 1) row.push(TILE_TYPES.GRASS);
                else row.push(TILE_TYPES.AIR);
            }
            newWorld.push(row);
        }
        worldRef.current = newWorld;
        
        // Initial Enemy Spawn
        enemiesRef.current = [
            { type: 'KING_SLIME', x: 800, y: 100, vx: 0, vy: 0, w: 120, h: 90, hp: 500, maxHp: 500, lastJump: 0, lastHit: 0 },
            { type: 'MOON_LORD', x: 1200, y: -200, vx: 0, vy: 0, w: 400, h: 600, hp: 10000, maxHp: 10000, lastAttack: 0, lastHit: 0 },
            { type: 'ZOMBIE', x: 400, y: 100, vx: 0, vy: 0, w: 20, h: 36, hp: 50, maxHp: 50, lastHit: 0 },
            { type: 'SLIME', x: 600, y: 100, vx: 0, vy: 0, w: 24, h: 18, hp: 20, maxHp: 20, lastJump: 0, lastHit: 0 }
        ];

        const handleResize = () => {
            if (canvasRef.current) {
                canvasRef.current.width = window.innerWidth;
                canvasRef.current.height = window.innerHeight;
            }
            setIsMobile(window.innerWidth < 1024);
        };
        window.addEventListener('resize', handleResize);
        handleResize();

        // Keyboard setup
        const down = (e) => { keysRef.current[e.code] = true; };
        const up = (e) => { keysRef.current[e.code] = false; };
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);

        // Main Game Loop
        let frameId;
        const loop = () => {
            update();
            draw();
            frameId = requestAnimationFrame(loop);
        };
        frameId = requestAnimationFrame(loop);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('keydown', down);
            window.removeEventListener('keyup', up);
            cancelAnimationFrame(frameId);
        };
    }, []);

    const update = () => {
        const p = playerRef.current;
        const keys = keysRef.current;

        // Horizontal Movement - Reset vx first to avoid sliding feel if needed, 
        // but Terraria has slight weight, so we'll use keys directly for precision.
        let targetVx = 0;
        if (keys['ArrowLeft'] || keys['KeyA']) targetVx = -MOVE_SPEED;
        else if (keys['ArrowRight'] || keys['KeyD']) targetVx = MOVE_SPEED;
        
        p.vx = targetVx || (p.vx * FRICTION);
        if (Math.abs(p.vx) < 0.1) p.vx = 0;

        // Vertical Movement
        p.vy += GRAVITY;
        if ((keys['ArrowUp'] || keys['KeyW'] || keys['Space']) && p.onGround) {
            p.vy = JUMP_FORCE;
            p.onGround = false;
        }

        // Collision Detection (AABB)
        // Move X
        p.x += p.vx;
        resolveCollisions(p, 'x');
        // Move Y
        p.y += p.vy;
        p.onGround = false;
        resolveCollisions(p, 'y');

        // Camera follow
        cameraRef.current.x += (p.x - window.innerWidth / 2 - cameraRef.current.x) * 0.1;
        cameraRef.current.y += (p.y - window.innerHeight / 2 - cameraRef.current.y) * 0.1;

        // Update Projectiles (Zenith)
        projectilesRef.current = projectilesRef.current.filter(proj => {
            proj.life -= 0.02;
            proj.x += proj.vx;
            proj.y += proj.vy;
            proj.angle += 0.2;
            
            // Collision with enemies
            enemiesRef.current.forEach(en => {
                const dx = proj.x - (en.x + en.w / 2);
                const dy = proj.y - (en.y + en.h / 2);
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < en.w / 2 + 10) {
                    en.hp -= 2;
                    proj.life = 0; // Destroy projectile
                    en.lastHit = Date.now();
                }
            });
            
            return proj.life > 0;
        });

        // Update Enemies
        enemiesRef.current = enemiesRef.current.filter(en => {
            if (en.hp <= 0) return false;
            
            // AI logic for King Slime
            if (en.type === 'KING_SLIME') {
                en.vy += GRAVITY;
                en.y += en.vy;
                
                // Ground collision
                const tx1 = Math.floor(en.x / TILE_SIZE);
                const tx2 = Math.floor((en.x + en.w) / TILE_SIZE);
                const ty = Math.floor((en.y + en.h) / TILE_SIZE);
                
                let onGround = false;
                for (let x = tx1; x <= tx2; x++) {
                    if (worldRef.current[ty] && worldRef.current[ty][x] !== TILE_TYPES.AIR) {
                        en.y = ty * TILE_SIZE - en.h;
                        en.vy = 0;
                        onGround = true;
                    }
                }
                
                // Jumping AI
                if (onGround && Date.now() - en.lastJump > 2000) {
                    en.vy = -12;
                    en.vx = (p.x - en.x > 0 ? 1 : -1) * 3;
                    en.lastJump = Date.now();
                }
                
                en.x += en.vx;
                if (!onGround) en.vx *= 0.98; else en.vx *= 0.9;
            }

            if (en.type === 'ZOMBIE') {
                en.vy += GRAVITY;
                en.y += en.vy;
                const tx = Math.floor((en.x + en.w/2) / TILE_SIZE);
                const ty = Math.floor((en.y + en.h) / TILE_SIZE);
                if (worldRef.current[ty] && worldRef.current[ty][tx] !== TILE_TYPES.AIR) {
                    en.y = ty * TILE_SIZE - en.h;
                    en.vy = 0;
                }
                en.vx = (p.x - en.x > 0 ? 1 : -1) * 1.5;
                en.x += en.vx;
            }

            if (en.type === 'SLIME') {
                en.vy += GRAVITY;
                en.y += en.vy;
                const tx = Math.floor((en.x + en.w/2) / TILE_SIZE);
                const ty = Math.floor((en.y + en.h) / TILE_SIZE);
                let onGround = false;
                if (worldRef.current[ty] && worldRef.current[ty][tx] !== TILE_TYPES.AIR) {
                    en.y = ty * TILE_SIZE - en.h;
                    en.vy = 0;
                    onGround = true;
                }
                if (onGround && Math.random() < 0.02) {
                    en.vy = -6;
                    en.vx = (p.x - en.x > 0 ? 1 : -1) * 2;
                }
                en.x += en.vx;
                en.vx *= 0.95;
            }

            if (en.type === 'MOON_LORD') {
                // Floating logic - stay above player
                const targetY = p.y - 450;
                const targetX = p.x - en.w / 2;
                en.y += (targetY - en.y) * 0.02;
                en.x += (targetX - en.x) * 0.02;
                
                // Swaying
                en.y += Math.sin(Date.now() * 0.001) * 1.0;
            }
            return true;
        });

        // World Bounds
        if (p.x < 0) p.x = 0;
        if (p.x > WORLD_WIDTH * TILE_SIZE - p.w) p.x = WORLD_WIDTH * TILE_SIZE - p.w;
    };

    const resolveCollisions = (p, axis) => {
        const x1 = Math.floor(p.x / TILE_SIZE);
        const x2 = Math.floor((p.x + p.w) / TILE_SIZE);
        const y1 = Math.floor(p.y / TILE_SIZE);
        const y2 = Math.floor((p.y + p.h) / TILE_SIZE);

        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) continue;
                if (worldRef.current[y][x] !== TILE_TYPES.AIR) {
                    if (axis === 'x') {
                        if (p.vx > 0) p.x = x * TILE_SIZE - p.w;
                        else if (p.vx < 0) p.x = (x + 1) * TILE_SIZE;
                        p.vx = 0;
                    } else {
                        if (p.vy > 0) {
                            p.y = y * TILE_SIZE - p.h;
                            p.onGround = true;
                        } else if (p.vy < 0) {
                            p.y = (y + 1) * TILE_SIZE;
                        }
                        p.vy = 0;
                    }
                }
            }
        }
    };

    const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const cam = cameraRef.current;

        // Clear
        ctx.fillStyle = '#87CEEB'; // Sky
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(-Math.floor(cam.x), -Math.floor(cam.y));

        // Draw World
        const startX = Math.max(0, Math.floor(cam.x / TILE_SIZE));
        const endX = Math.min(WORLD_WIDTH, Math.ceil((cam.x + canvas.width) / TILE_SIZE));
        const startY = Math.max(0, Math.floor(cam.y / TILE_SIZE));
        const endY = Math.min(WORLD_HEIGHT, Math.ceil((cam.y + canvas.height) / TILE_SIZE));

        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const tile = worldRef.current[y][x];
                if (tile !== TILE_TYPES.AIR) {
                    ctx.fillStyle = TILE_COLORS[tile];
                    ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                    // Outline for pop look
                    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                    ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                }
            }
        }

        // Draw Player (かっこいいスタイル)
        const p = playerRef.current;
        const isMoving = Math.abs(p.vx) > 0.1;
        const walkCycle = isMoving ? Math.sin(Date.now() * 0.01) * 4 : 0;
        const facingRight = p.vx >= 0;

        ctx.save();
        ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
        if (!facingRight) ctx.scale(-1, 1);

        // Body Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(-p.w / 2 + 2, -p.h / 2 + 4, p.w, p.h);

        // Armor/Body
        ctx.fillStyle = '#455A64'; // Cool grey-blue
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        
        // Helmet/Head
        ctx.fillStyle = '#37474F';
        ctx.fillRect(-p.w / 2 - 2, -p.h / 2 - 2, p.w + 4, 14);
        
        // Visor (Glowing)
        ctx.fillStyle = '#00E5FF';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00E5FF';
        ctx.fillRect(facingRight ? 2 : -10, -p.h / 2 + 4, 8, 4);
        ctx.shadowBlur = 0;

        // Scarf/Cape
        ctx.fillStyle = '#D32F2F';
        const capeSwing = isMoving ? Math.sin(Date.now() * 0.015) * 5 : 0;
        ctx.beginPath();
        ctx.moveTo(-p.w / 2, -p.h / 2 + 10);
        ctx.lineTo(-p.w / 2 - 15, -p.h / 2 + 15 + capeSwing);
        ctx.lineTo(-p.w / 2, -p.h / 2 + 25);
        ctx.fill();

        ctx.restore();

        // Draw Zenith Projectiles
        projectilesRef.current.forEach(proj => {
            ctx.save();
            ctx.translate(proj.x, proj.y);
            ctx.rotate(proj.angle);
            
            // Neon Glow
            ctx.shadowBlur = 15;
            ctx.shadowColor = proj.color;
            ctx.fillStyle = proj.color;
            
            // Sword shape
            ctx.beginPath();
            ctx.moveTo(0, -20);
            ctx.lineTo(5, 0);
            ctx.lineTo(0, 5);
            ctx.lineTo(-5, 0);
            ctx.closePath();
            ctx.fill();
            
            ctx.restore();
        });

        // Draw Enemies
        enemiesRef.current.forEach(en => {
            ctx.save();
            if (en.type === 'KING_SLIME') {
                const isHit = Date.now() - en.lastHit < 100;
                ctx.fillStyle = isHit ? '#fff' : 'rgba(0, 150, 255, 0.7)';
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#0096FF';
                
                // Draw Slime Body (Squash and stretch based on vy)
                const squash = Math.min(1.2, 1 + Math.abs(en.vy) * 0.02);
                const stretch = 1 / squash;
                ctx.translate(en.x + en.w / 2, en.y + en.h);
                ctx.scale(squash, stretch);
                
                ctx.beginPath();
                ctx.arc(0, -en.h / 2, en.w / 2, 0, Math.PI * 2);
                ctx.fill();
                
                // Draw Crown
                ctx.fillStyle = '#FFD700';
                ctx.fillRect(-15, -en.h - 10, 30, 15);
                ctx.beginPath();
                ctx.moveTo(-15, -en.h - 10);
                ctx.lineTo(-20, -en.h - 20);
                ctx.lineTo(-10, -en.h - 10);
                ctx.lineTo(0, -en.h - 25);
                ctx.lineTo(10, -en.h - 10);
                ctx.lineTo(20, -en.h - 20);
                ctx.lineTo(15, -en.h - 10);
                ctx.fill();
            }

            if (en.type === 'ZOMBIE') {
                const isHit = Date.now() - en.lastHit < 100;
                ctx.fillStyle = isHit ? '#fff' : '#4a5d23';
                ctx.fillRect(en.x, en.y, en.w, en.h);
                ctx.fillStyle = '#333';
                ctx.fillRect(en.x + (en.vx > 0 ? 12 : 4), en.y + 6, 4, 4);
            }

            if (en.type === 'SLIME') {
                const isHit = Date.now() - en.lastHit < 100;
                ctx.fillStyle = isHit ? '#fff' : 'rgba(0, 255, 100, 0.8)';
                ctx.beginPath();
                ctx.arc(en.x + en.w/2, en.y + en.h/2, en.w/2, 0, Math.PI * 2);
                ctx.fill();
            }

            if (en.type === 'MOON_LORD') {
                const isHit = Date.now() - en.lastHit < 100;
                ctx.save();
                ctx.translate(en.x + en.w / 2, en.y + en.h / 2);
                
                // Outer Glow
                ctx.shadowBlur = 40;
                ctx.shadowColor = 'rgba(0, 242, 255, 0.5)';

                // Body (Core Torso)
                ctx.fillStyle = isHit ? '#fff' : 'rgba(80, 120, 130, 0.8)';
                ctx.beginPath();
                ctx.moveTo(-100, 200);
                ctx.quadraticCurveTo(-150, 0, -50, -250);
                ctx.quadraticCurveTo(0, -300, 50, -250);
                ctx.quadraticCurveTo(150, 0, 100, 200);
                ctx.fill();

                // Ribs/Skeleton Detail
                ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                ctx.lineWidth = 8;
                for(let i=0; i<5; i++) {
                    ctx.beginPath();
                    ctx.moveTo(-60, -100 + i*40);
                    ctx.lineTo(60, -100 + i*40);
                    ctx.stroke();
                }

                // Head/Face
                ctx.fillStyle = isHit ? '#fff' : 'rgba(60, 90, 100, 0.9)';
                ctx.beginPath();
                ctx.arc(0, -240, 60, 0, Math.PI * 2);
                ctx.fill();

                // Tentacles (Chin)
                ctx.strokeStyle = ctx.fillStyle;
                ctx.lineWidth = 10;
                for(let i=0; i<4; i++) {
                    ctx.beginPath();
                    ctx.moveTo(-30 + i*20, -200);
                    ctx.lineTo(-40 + i*25, -140 + Math.sin(Date.now()*0.002 + i)*10);
                    ctx.stroke();
                }

                // Eye (Forehead)
                const eyeOpen = Math.sin(Date.now() * 0.001) > -0.5;
                if(eyeOpen) {
                    ctx.fillStyle = '#fff';
                    ctx.beginPath(); ctx.ellipse(0, -260, 25, 15, 0, 0, Math.PI*2); ctx.fill();
                    ctx.fillStyle = '#ff0055';
                    ctx.shadowBlur = 20; ctx.shadowColor = '#ff0055';
                    ctx.beginPath(); ctx.arc(0, -260, 10, 0, Math.PI * 2); ctx.fill();
                }

                // Hands/Eyes
                const handY = Math.sin(Date.now() * 0.0015) * 20;
                // Left Hand
                ctx.fillStyle = 'rgba(80, 120, 130, 0.7)';
                ctx.beginPath(); ctx.arc(-180, 50 + handY, 40, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#ff0055';
                ctx.beginPath(); ctx.arc(-180, 50 + handY, 15, 0, Math.PI*2); ctx.fill();
                // Right Hand
                ctx.fillStyle = 'rgba(80, 120, 130, 0.7)';
                ctx.beginPath(); ctx.arc(180, 50 - handY, 40, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#ff0055';
                ctx.beginPath(); ctx.arc(180, 50 - handY, 15, 0, Math.PI*2); ctx.fill();

                ctx.restore();
            }

            // Health Bar
            if (en.hp < en.maxHp) {
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(en.x, en.y - 15, en.w, 6);
                ctx.fillStyle = '#ff0055';
                ctx.fillRect(en.x, en.y - 15, en.w * (en.hp / en.maxHp), 6);
            }
            
            ctx.restore();
        });

        ctx.restore();
    };

    const handleAction = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const mouseX = clientX - rect.left + cameraRef.current.x;
        const mouseY = clientY - rect.top + cameraRef.current.y;

        const currentItem = inventory[selectedSlot];

        if (currentItem.type === 'ZENITH') {
            // Zenith Attack!
            const p = playerRef.current;
            const colors = ['#00f2ff', '#bf00ff', '#ff0055', '#33ff00', '#ffff00'];
            for (let i = 0; i < 5; i++) {
                const angle = Math.atan2(mouseY - p.y, mouseX - p.x) + (Math.random() - 0.5) * 0.5;
                const speed = 8 + Math.random() * 5;
                projectilesRef.current.push({
                    x: p.x + p.w / 2,
                    y: p.y + p.h / 2,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    angle: Math.random() * Math.PI * 2,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    life: 1.0
                });
            }
            return;
        }

        const tx = Math.floor(mouseX / TILE_SIZE);
        const ty = Math.floor(mouseY / TILE_SIZE);

        if (tx >= 0 && tx < WORLD_WIDTH && ty >= 0 && ty < WORLD_HEIGHT) {
            const world = worldRef.current;
            if (world[ty][tx] === TILE_TYPES.AIR) {
                // Place (if not overlapping player)
                const p = playerRef.current;
                const overlap = (tx * TILE_SIZE < p.x + p.w && (tx+1) * TILE_SIZE > p.x && 
                                 ty * TILE_SIZE < p.y + p.h && (ty+1) * TILE_SIZE > p.y);
                if (!overlap) world[ty][tx] = inventory[selectedSlot].type;
            } else {
                // Mine
                world[ty][tx] = TILE_TYPES.AIR;
            }
        }
    };

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', touchAction: 'none' }}>
            <canvas 
                ref={canvasRef} 
                onMouseDown={handleAction}
                style={{ display: 'block' }}
            />

            {/* UI Overlay */}
            <div style={{ position: 'fixed', top: '20px', left: '20px', display: 'flex', gap: '12px', zIndex: 100, alignItems: 'center' }}>
                {inventory.map((item, idx) => (
                    <div 
                        key={idx}
                        onClick={() => setSelectedSlot(idx)}
                        style={{
                            width: '50px', height: '50px', 
                            background: selectedSlot === idx ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255,255,255,0.4)',
                            border: selectedSlot === idx ? '4px solid #ff4081' : '2px solid rgba(0,0,0,0.2)',
                            borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', transition: 'all 0.2s', backdropFilter: 'blur(5px)'
                        }}
                    >
                        <div style={{ 
                            width: '30px', 
                            height: '30px', 
                            background: item.color, 
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: '#fff'
                        }}>
                            {item.type === 'ZENITH' ? '⚔️' : ''}
                        </div>
                    </div>
                ))}
                
                {/* Audio Toggle */}
                <div 
                    onClick={() => setIsMuted(!isMuted)}
                    style={{
                        width: '50px', height: '50px',
                        background: isMuted ? 'rgba(255, 0, 85, 0.4)' : 'rgba(0, 242, 255, 0.4)',
                        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', fontSize: '20px', border: '2px solid #fff', backdropFilter: 'blur(5px)'
                    }}
                >
                    {isMuted ? '🔇' : '🔊'}
                </div>
            </div>

            <div style={{ position: 'fixed', top: '20px', right: '20px', color: '#fff', fontSize: '1.2em', fontWeight: 'bold', textShadow: '2px 2px rgba(0,0,0,0.5)', fontFamily: 'Orbitron' }}>
                NEURAL TERRARIA v6
            </div>

            {isMobile && (
                <div style={{ position: 'fixed', bottom: '30px', left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: '0 30px', zIndex: 100, pointerEvents: 'none' }}>
                    <div style={{ display: 'flex', gap: '15px', pointerEvents: 'auto' }}>
                        <button 
                            onContextMenu={(e) => e.preventDefault()}
                            onTouchStart={(e) => { e.preventDefault(); keysRef.current['KeyA'] = true; }} 
                            onTouchEnd={(e) => { e.preventDefault(); keysRef.current['KeyA'] = false; }} 
                            className="ctrl-btn"
                        >←</button>
                        <button 
                            onContextMenu={(e) => e.preventDefault()}
                            onTouchStart={(e) => { e.preventDefault(); keysRef.current['KeyD'] = true; }} 
                            onTouchEnd={(e) => { e.preventDefault(); keysRef.current['KeyD'] = false; }} 
                            className="ctrl-btn"
                        >→</button>
                    </div>
                    <div style={{ pointerEvents: 'auto' }}>
                        <button 
                            onContextMenu={(e) => e.preventDefault()}
                            onTouchStart={(e) => { e.preventDefault(); keysRef.current['Space'] = true; }} 
                            onTouchEnd={(e) => { e.preventDefault(); keysRef.current['Space'] = false; }} 
                            className="ctrl-btn" 
                            style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255, 64, 129, 0.4)' }}
                        >JUMP</button>
                    </div>
                </div>
            )}

            <style>{`
                .ctrl-btn {
                    width: 80px; height: 80px; background: rgba(255,255,255,0.2);
                    border: 2px solid #fff; border-radius: 20px; color: #fff;
                    font-weight: bold; font-size: 2em;
                    display: flex; align-items: center; justify-content: center;
                    backdrop-filter: blur(8px); -webkit-tap-highlight-color: transparent;
                }
                .ctrl-btn:active { background: rgba(255,255,255,0.5); transform: scale(0.95); }
            `}</style>
        </div>
    );
};

export default App;
