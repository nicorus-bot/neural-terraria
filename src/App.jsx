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
    
    const [selectedSlot, setSelectedSlot] = useState(0);
    const [isMobile, setIsMobile] = useState(false);
    const inventory = [
        { type: TILE_TYPES.DIRT, color: TILE_COLORS[TILE_TYPES.DIRT] },
        { type: TILE_TYPES.WOOD, color: TILE_COLORS[TILE_TYPES.WOOD] },
        { type: TILE_TYPES.STONE, color: TILE_COLORS[TILE_TYPES.STONE] },
        { type: 'ZENITH', color: 'linear-gradient(45deg, #00f2ff, #bf00ff)', isWeapon: true },
    ];

    // Initialization
    useEffect(() => {
        // Generate World
        const newWorld = [];
        for (let y = 0; y < WORLD_HEIGHT; y++) {
            const row = [];
            for (let x = 0; x < WORLD_WIDTH; x++) {
                const surfaceY = 15 + Math.sin(x * 0.1) * 3; // Rolling hills
                if (y > surfaceY + 5) row.push(TILE_TYPES.STONE);
                else if (y > surfaceY) row.push(TILE_TYPES.DIRT);
                else if (y > surfaceY - 1) row.push(TILE_TYPES.GRASS);
                else row.push(TILE_TYPES.AIR);
            }
            newWorld.push(row);
        }
        worldRef.current = newWorld;

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

        // Horizontal Movement
        if (keys['ArrowLeft'] || keys['KeyA']) p.vx = -MOVE_SPEED;
        else if (keys['ArrowRight'] || keys['KeyD']) p.vx = MOVE_SPEED;
        else p.vx *= FRICTION;

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
            return proj.life > 0;
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

        // Draw Player
        const p = playerRef.current;
        ctx.fillStyle = '#FF5722';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
        
        // Eyes
        ctx.fillStyle = '#333';
        const eyeOffset = p.vx >= 0 ? 12 : 4;
        ctx.fillRect(p.x + eyeOffset, p.y + 8, 4, 4);

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
            <div style={{ position: 'fixed', top: '20px', left: '20px', display: 'flex', gap: '12px', zIndex: 100 }}>
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
            </div>

            <div style={{ position: 'fixed', top: '20px', right: '20px', color: '#fff', fontSize: '1.2em', fontWeight: 'bold', textShadow: '2px 2px rgba(0,0,0,0.5)', fontFamily: 'Orbitron' }}>
                NEURAL TERRARIA v2
            </div>

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
