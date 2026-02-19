import React, { useState, useEffect, useRef, useCallback } from 'react';

const WORLD_WIDTH = 50;
const WORLD_HEIGHT = 30;
const TILE_SIZE = 32;
const GRAVITY = 0.5;
const JUMP_FORCE = -10;
const MOVE_SPEED = 4;

const TILE_TYPES = {
    AIR: 0,
    DIRT: 1,
    GRASS: 2,
    STONE: 3,
    WOOD: 4,
};

const TILE_COLORS = {
    [TILE_TYPES.AIR]: 'transparent',
    [TILE_TYPES.DIRT]: '#8B4513',
    [TILE_TYPES.GRASS]: '#4CAF50',
    [TILE_TYPES.STONE]: '#757575',
    [TILE_TYPES.WOOD]: '#5D4037',
};

const App = () => {
    const [world, setWorld] = useState([]);
    const [player, setPlayer] = useState({ x: 100, y: 100, vx: 0, vy: 0, width: 24, height: 40 });
    const [camera, setCamera] = useState({ x: 0, y: 0 });
    const [inventory, setInventory] = useState([
        { type: TILE_TYPES.DIRT, count: 99 },
        { type: TILE_TYPES.WOOD, count: 99 },
    ]);
    const [selectedSlot, setSelectedSlot] = useState(0);
    const [isMobile, setIsMobile] = useState(false);

    const requestRef = useRef();
    const keys = useRef({});
    const gameContainerRef = useRef();

    // 初期ワールド生成
    useEffect(() => {
        const newWorld = [];
        for (let y = 0; y < WORLD_HEIGHT; y++) {
            const row = [];
            for (let x = 0; x < WORLD_WIDTH; x++) {
                if (y > 20) row.push(TILE_TYPES.STONE);
                else if (y > 15) row.push(TILE_TYPES.DIRT);
                else if (y === 15) row.push(TILE_TYPES.GRASS);
                else row.push(TILE_TYPES.AIR);
            }
            newWorld.push(row);
        }
        setWorld(newWorld);
        
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleKeyDown = (e) => { keys.current[e.code] = true; };
    const handleKeyUp = (e) => { keys.current[e.code] = false; };

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    const update = useCallback(() => {
        setPlayer(p => {
            let nextVx = 0;
            if (keys.current['KeyA'] || keys.current['ArrowLeft']) nextVx = -MOVE_SPEED;
            if (keys.current['KeyD'] || keys.current['ArrowRight']) nextVx = MOVE_SPEED;

            let nextVy = p.vy + GRAVITY;
            if ((keys.current['Space'] || keys.current['ArrowUp'] || keys.current['KeyW']) && p.onGround) {
                nextVy = JUMP_FORCE;
            }

            let nextX = p.x + nextVx;
            let nextY = p.y + nextVy;
            let onGround = false;

            // 衝突判定（簡易）
            const checkCollision = (tx, ty) => {
                const wx = Math.floor(tx / TILE_SIZE);
                const wy = Math.floor(ty / TILE_SIZE);
                if (wx < 0 || wx >= WORLD_WIDTH || wy < 0 || wy >= WORLD_HEIGHT) return true;
                return world[wy][wx] !== TILE_TYPES.AIR;
            };

            // Y方向衝突
            if (nextVy > 0) { // 落下中
                if (checkCollision(p.x, nextY + p.height) || checkCollision(p.x + p.width, nextY + p.height)) {
                    nextY = Math.floor((nextY + p.height) / TILE_SIZE) * TILE_SIZE - p.height;
                    nextVy = 0;
                    onGround = true;
                }
            } else if (nextVy < 0) { // ジャンプ中
                if (checkCollision(p.x, nextY) || checkCollision(p.x + p.width, nextY)) {
                    nextY = Math.ceil(nextY / TILE_SIZE) * TILE_SIZE;
                    nextVy = 0;
                }
            }

            // X方向衝突
            if (nextVx > 0) {
                if (checkCollision(nextX + p.width, p.y) || checkCollision(nextX + p.width, p.y + p.height - 1)) {
                    nextX = Math.floor((nextX + p.width) / TILE_SIZE) * TILE_SIZE - p.width;
                }
            } else if (nextVx < 0) {
                if (checkCollision(nextX, p.y) || checkCollision(nextX, p.y + p.height - 1)) {
                    nextX = Math.ceil(nextX / TILE_SIZE) * TILE_SIZE;
                }
            }

            return { ...p, x: nextX, y: nextY, vx: nextVx, vy: nextVy, onGround };
        });

        requestRef.current = requestAnimationFrame(update);
    }, [world]);

    useEffect(() => {
        requestRef.current = requestAnimationFrame(update);
        return () => cancelAnimationFrame(requestRef.current);
    }, [update]);

    // カメラ追従
    useEffect(() => {
        setCamera({
            x: player.x - window.innerWidth / 2,
            y: player.y - window.innerHeight / 2
        });
    }, [player.x, player.y]);

    const handleCanvasClick = (e) => {
        const rect = gameContainerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left + camera.x;
        const mouseY = e.clientY - rect.top + camera.y;
        const tx = Math.floor(mouseX / TILE_SIZE);
        const ty = Math.floor(mouseY / TILE_SIZE);

        if (tx >= 0 && tx < WORLD_WIDTH && ty >= 0 && ty < WORLD_HEIGHT) {
            setWorld(prev => {
                const newWorld = prev.map(row => [...row]);
                if (newWorld[ty][tx] === TILE_TYPES.AIR) {
                    newWorld[ty][tx] = inventory[selectedSlot].type;
                } else {
                    newWorld[ty][tx] = TILE_TYPES.AIR;
                }
                return newWorld;
            });
        }
    };

    const MobileControls = () => (
        <div style={{ position: 'fixed', bottom: '20px', left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: '0 20px', zIndex: 100, pointerEvents: 'none' }}>
            <div style={{ display: 'flex', gap: '10px', pointerEvents: 'auto' }}>
                <button onTouchStart={() => keys.current['KeyA'] = true} onTouchEnd={() => keys.current['KeyA'] = false} className="ctrl-btn">←</button>
                <button onTouchStart={() => keys.current['KeyD'] = true} onTouchEnd={() => keys.current['KeyD'] = false} className="ctrl-btn">→</button>
            </div>
            <div style={{ pointerEvents: 'auto' }}>
                <button onTouchStart={() => keys.current['Space'] = true} onTouchEnd={() => keys.current['Space'] = false} className="ctrl-btn" style={{ width: '100px', height: '100px', borderRadius: '50%' }}>JUMP</button>
            </div>
        </div>
    );

    return (
        <div 
            ref={gameContainerRef}
            onClick={handleCanvasClick}
            style={{ 
                width: '100vw', 
                height: '100vh', 
                backgroundColor: '#87CEEB', 
                overflow: 'hidden', 
                position: 'relative',
                touchAction: 'none'
            }}
        >
            {/* World Rendering */}
            <div style={{ 
                transform: `translate(${-camera.x}px, ${-camera.y}px)`,
                transition: 'transform 0.1s ease-out'
            }}>
                {world.map((row, y) => row.map((tile, x) => {
                    if (tile === TILE_TYPES.AIR) return null;
                    // カリング
                    if (x * TILE_SIZE < camera.x - TILE_SIZE || x * TILE_SIZE > camera.x + window.innerWidth + TILE_SIZE) return null;
                    return (
                        <div key={`${x}-${y}`} style={{
                            position: 'absolute',
                            left: x * TILE_SIZE,
                            top: y * TILE_SIZE,
                            width: TILE_SIZE,
                            height: TILE_SIZE,
                            backgroundColor: TILE_COLORS[tile],
                            border: '0.5px solid rgba(0,0,0,0.1)',
                            borderRadius: '2px'
                        }} />
                    );
                }))}

                {/* Player */}
                <div style={{
                    position: 'absolute',
                    left: player.x,
                    top: player.y,
                    width: player.width,
                    height: player.height,
                    backgroundColor: '#FF5722',
                    borderRadius: '4px',
                    boxShadow: '0 0 10px rgba(0,0,0,0.3)',
                    border: '2px solid #fff'
                }}>
                    {/* Face */}
                    <div style={{ position: 'absolute', top: '8px', right: '4px', width: '4px', height: '4px', backgroundColor: '#333' }} />
                </div>
            </div>

            {/* UI */}
            <div style={{ position: 'fixed', top: '20px', left: '20px', display: 'flex', gap: '10px', zIndex: 100 }}>
                {inventory.map((item, idx) => (
                    <div 
                        key={idx}
                        onClick={(e) => { e.stopPropagation(); setSelectedSlot(idx); }}
                        style={{
                            width: '50px', height: '50px', backgroundColor: 'rgba(255,255,255,0.8)',
                            border: selectedSlot === idx ? '4px solid #ff4081' : '2px solid #333',
                            borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer'
                        }}
                    >
                        <div style={{ width: '30px', height: '30px', backgroundColor: TILE_COLORS[item.type] }} />
                    </div>
                ))}
            </div>

            <div style={{ position: 'fixed', top: '20px', right: '20px', color: '#fff', fontSize: '1.2em', fontWeight: 'bold', textShadow: '2px 2px #000' }}>
                NEURAL TERRARIA
            </div>

            {isMobile && <MobileControls />}

            <style>{`
                .ctrl-btn {
                    width: 70px; height: 70px; background: rgba(255,255,255,0.3);
                    border: 2px solid #fff; border-radius: 12px; color: #fff;
                    font-weight: bold; font-size: 1.2em;
                    display: flex; align-items: center; justify-content: center;
                    backdrop-filter: blur(5px);
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
            `}</style>
        </div>
    );
};

export default App;
