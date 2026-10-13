/**/
const MC_CURSOR_SYSTEM = (() => {
    const el = document.getElementById("mc_cursor_core");

    let posX = 0;
    let posY = 0;
    let targetX = 0;
    let targetY = 0;
    let rotation = 0;
    let lastTipX = null;
    let lastTipY = null;
    let mouseReady = false;
    let lastMoveX = 0;
    let lastMoveY = 0;
    let lastMoveTime = 0;
    let mouseSpeed = 0;
    let lastSpawnTime = 0;
    let graceRemaining = 0;
    let sparksArmed = false;
    let lastFrameTime = null;
    let wandW = 80;
    let wandH = 80;

    const WAND_SIZE = 80;
    const SPARK_MIN_SPEED = 2.04;
    const SPARK_SLOW_SPEED = 0.08;
    const GRACE_BASE_MS = 500;
    const GRACE_MAX_MS = 3200;
    const GRACE_SLOW_EXTEND_MAX = 2.1;
    const SPARK_SPEED_DECAY_MS = 40;
    const SPAWN_INTERVAL_MS = 24;
    const SPAWN_INTERVAL_GRACE_MS = 20;
    const PARTICLE_TTL = 48;
    const MAX_PARTICLES = 64;
    const PERF_WARN_MS = 5;
    const PERF_CRITICAL_MS = 10;

    const particles = [];
    const particlePool = [];
    let particleLayer = null;
    let perfEma = 0;

    function getCombinedLoad() {
        return Math.max(perfEma, window.__fxTileLoad || 0);
    }

    function getParticleCap() {
        const load = getCombinedLoad();
        if (load > PERF_CRITICAL_MS) {
            return 20;
        }
        if (load > PERF_WARN_MS) {
            return 40;
        }
        return MAX_PARTICLES;
    }

    function reportPerf(costMs) {
        perfEma = perfEma * 0.86 + costMs * 0.14;
        window.__fxSparkLoad = perfEma;
    }

    function cacheWandSize() {
        wandW = el.offsetWidth || WAND_SIZE;
        wandH = el.offsetHeight || wandW;
    }

    function getSparkOrigin() {
        const cx = posX + wandW * 0.5;
        const cy = posY + wandH * 0.5;
        const lx = -wandW * 0.5;
        const ly = -wandH * 0.5;
        const rad = (rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        return {
            x: cx + lx * cos - ly * sin,
            y: cy + lx * sin + ly * cos
        };
    }

    function slowExtendFactor(speed) {
        if (speed < SPARK_SLOW_SPEED || speed >= SPARK_MIN_SPEED) {
            return 0;
        }

        const t = (speed - SPARK_SLOW_SPEED) / (SPARK_MIN_SPEED - SPARK_SLOW_SPEED);
        return t * t * t;
    }

    function applyWandTransform() {
        el.style.transform = `translate3d(${posX}px, ${posY}px, 0) rotate(${rotation}deg)`;
    }

    function createParticleElement() {
        const p = document.createElement("div");
        p.style.cssText =
            "position:fixed;left:0;top:0;width:6px;height:6px;margin:-3px 0 0 -3px;" +
            "background:cyan;border-radius:50%;pointer-events:none;" +
            "box-shadow:0 0 8px cyan;will-change:transform,opacity;";
        particleLayer.appendChild(p);
        return p;
    }

    function acquireParticleElement() {
        if (particlePool.length) {
            return particlePool.pop();
        }
        if (particles.length + particlePool.length >= MAX_PARTICLES) {
            return null;
        }
        return createParticleElement();
    }

    function releaseParticleElement(node) {
        node.style.display = "none";
        if (particlePool.length < MAX_PARTICLES) {
            particlePool.push(node);
        } else {
            node.remove();
        }
    }

    function MC_spawnParticle(px, py, vx, vy) {
        if (particles.length >= getParticleCap()) {
            return;
        }

        const node = acquireParticleElement();
        if (!node) {
            return;
        }
        node.style.display = "block";

        particles.push({
            el: node,
            x: px,
            y: py,
            vx: vx + (Math.random() - 0.5) * 3,
            vy: vy + (Math.random() - 0.5) * 3,
            ttl: PARTICLE_TTL
        });
    }

    function updateParticles() {
        const load = getCombinedLoad();
        if (load > PERF_CRITICAL_MS + 6 && particles.length > 12) {
            return;
        }

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.12;
            p.ttl--;

            if (p.ttl <= 0) {
                releaseParticleElement(p.el);
                particles[i] = particles[particles.length - 1];
                particles.pop();
                continue;
            }

            p.el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
            p.el.style.opacity = String(p.ttl / PARTICLE_TTL);
        }
    }

    const onMouseMove = (e) => {
        const t = performance.now();

        if (!mouseReady) {
            mouseReady = true;
            posX = e.clientX;
            posY = e.clientY;
            targetX = e.clientX;
            targetY = e.clientY;
            lastMoveX = e.clientX;
            lastMoveY = e.clientY;
            lastMoveTime = t;
            return;
        }

        const dt = t - lastMoveTime;
        if (dt > 0 && dt < 80) {
            const dist = Math.hypot(e.clientX - lastMoveX, e.clientY - lastMoveY);
            mouseSpeed = dist / dt;
        }

        lastMoveX = e.clientX;
        lastMoveY = e.clientY;
        lastMoveTime = t;
        targetX = e.clientX;
        targetY = e.clientY;
    };

    const onMouseDown = () => {
        rotation = -12.5;
        applyWandTransform();
    };

    const onMouseUp = () => {
        rotation = 0;
        applyWandTransform();
    };

    function MC_updateLoop(now) {
        const frameDt = lastFrameTime != null ? Math.min(now - lastFrameTime, 48) : 16;
        lastFrameTime = now;
        const sparkT0 = performance.now();

        posX += (targetX - posX) * 0.15;
        posY += (targetY - posY) * 0.15;
        applyWandTransform();

        const tip = getSparkOrigin();
        const load = getCombinedLoad();
        const sparksAllowed = load <= PERF_CRITICAL_MS + 4;

        if (lastTipX != null && mouseReady && sparksAllowed) {
            if (now - lastMoveTime > SPARK_SPEED_DECAY_MS) {
                mouseSpeed = 0;
            }

            const dx = tip.x - lastTipX;
            const dy = tip.y - lastTipY;

            const fastMove = mouseSpeed >= SPARK_MIN_SPEED;
            const slowMove = mouseSpeed >= SPARK_SLOW_SPEED && mouseSpeed < SPARK_MIN_SPEED;

            if (!sparksArmed) {
                if (fastMove) {
                    sparksArmed = true;
                    graceRemaining = GRACE_BASE_MS;
                }
            } else if (fastMove) {
                graceRemaining = GRACE_BASE_MS;
            } else if (slowMove && graceRemaining > 0) {
                const extendRate = GRACE_SLOW_EXTEND_MAX * slowExtendFactor(mouseSpeed);
                graceRemaining = Math.min(
                    GRACE_MAX_MS,
                    graceRemaining + frameDt * extendRate
                );
            } else if (graceRemaining > 0) {
                graceRemaining = Math.max(0, graceRemaining - frameDt);
                if (graceRemaining <= 0) {
                    graceRemaining = 0;
                    sparksArmed = false;
                }
            }

            const canSpark = sparksArmed && (fastMove || (graceRemaining > 0 && slowMove));
            let spawnInterval = sparksArmed && !fastMove ? SPAWN_INTERVAL_GRACE_MS : SPAWN_INTERVAL_MS;
            if (load > PERF_CRITICAL_MS) {
                spawnInterval *= 3;
            } else if (load > PERF_WARN_MS) {
                spawnInterval *= 2;
            }

            if (canSpark && now - lastSpawnTime >= spawnInterval) {
                MC_spawnParticle(tip.x, tip.y, dx * 0.08, dy * 0.08);
                lastSpawnTime = now;
            }
        }

        updateParticles();

        lastTipX = tip.x;
        lastTipY = tip.y;

        reportPerf(performance.now() - sparkT0);
        requestAnimationFrame(MC_updateLoop);
    }

    function init() {
        document.body.style.cursor = "none";

        Object.assign(el.style, {
            position: "fixed",
            width: WAND_SIZE + "px",
            height: "auto",
            left: "0",
            top: "0",
            pointerEvents: "none",
            zIndex: "999999",
            transformOrigin: "center center",
            willChange: "transform",
            userSelect: "none",
            WebkitUserSelect: "none",
            WebkitUserDrag: "none"
        });

        particleLayer = document.createElement("div");
        particleLayer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:999998;overflow:hidden;";
        document.body.appendChild(particleLayer);

        if (el.complete) {
            cacheWandSize();
        } else {
            el.addEventListener("load", cacheWandSize, { once: true });
        }

        document.addEventListener("mousemove", onMouseMove, { passive: true });
        document.addEventListener("mousedown", onMouseDown);
        document.addEventListener("mouseup", onMouseUp);
        document.addEventListener("selectstart", (e) => e.preventDefault());
        document.addEventListener("dragstart", (e) => e.preventDefault());

        requestAnimationFrame(MC_updateLoop);
    }

    return { init };
})();

MC_CURSOR_SYSTEM.init();
