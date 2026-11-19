class SimulationEngine {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.grid = new Uint8Array(width * height);
        this.nextGrid = new Uint8Array(width * height);
        this.generation = 0;
        this.population = 0;
        this.birthRules = new Set([3]);
        this.survivalRules = new Set([2, 3]);
        this.setRule('B3/S23');
    }

    setRule(ruleString) {
        const match = ruleString.toUpperCase().match(/^B([0-8]*)\/S([0-8]*)$/);
        if (!match) return false;

        this.birthRules.clear();
        for (const char of match[1]) {
            this.birthRules.add(parseInt(char, 10));
        }

        this.survivalRules.clear();
        for (const char of match[2]) {
            this.survivalRules.add(parseInt(char, 10));
        }
        return true;
    }

    clear() {
        this.grid.fill(0);
        this.generation = 0;
        this.population = 0;
    }

    setCell(x, y, value) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        const idx = y * this.width + x;
        const previous = this.grid[idx];
        this.grid[idx] = value ? 1 : 0;
        if (previous !== this.grid[idx]) {
            this.population += this.grid[idx] ? 1 : -1;
        }
    }

    step() {
        let newPop = 0;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const idx = y * this.width + x;
                let neighbors = 0;

                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                            neighbors += this.grid[ny * this.width + nx];
                        }
                    }
                }

                const currentState = this.grid[idx];
                let nextState = 0;

                if (currentState === 1) {
                    if (this.survivalRules.has(neighbors)) {
                        nextState = 1;
                    }
                } else {
                    if (this.birthRules.has(neighbors)) {
                        nextState = 1;
                    }
                }

                this.nextGrid[idx] = nextState;
                newPop += nextState;
            }
        }

        const temp = this.grid;
        this.grid = this.nextGrid;
        this.nextGrid = temp;

        this.generation++;
        this.population = newPop;
    }

    loadPreset(type) {
        this.clear();
        const cx = Math.floor(this.width / 2);
        const cy = Math.floor(this.height / 2);

        if (type === 'glider') {
            const coords = [[0, -1], [1, 0], [-1, 1], [0, 1], [1, 1]];
            for (const [dx, dy] of coords) {
                this.setCell(cx + dx, cy + dy, 1);
            }
        } else if (type === 'gun') {
            const ox = cx - 18;
            const oy = cy - 5;
            const pattern = [
                [1,5],[1,6],[2,5],[2,6],[11,5],[11,6],[11,7],[12,4],[12,8],[13,3],[13,9],
                [14,3],[14,9],[15,6],[16,4],[16,8],[17,5],[17,6],[17,7],[18,6],[21,3],
                [21,4],[21,5],[22,3],[22,4],[22,5],[23,2],[23,6],[25,1],[25,2],[25,6],
                [25,7],[35,3],[35,4],[36,3],[36,4]
            ];
            for (const [x, y] of pattern) {
                this.setCell(ox + x, oy + y, 1);
            }
        } else if (type === 'pulsar') {
            const offsets = [-6, -1, 1, 6];
            for (const dy of offsets) {
                for (const dx of [-4, -3, -2, 2, 3, 4]) {
                    this.setCell(cx + dx, cy + dy, 1);
                    this.setCell(cx + dy, cy + dx, 1);
                }
            }
        } else if (type === 'lwss') {
            const coords = [
                [0, 0], [3, 0], [4, 1], [0, 2], [4, 2], [1, 3], [2, 3], [3, 3], [4, 3]
            ];
            for (const [dx, dy] of coords) {
                this.setCell(cx - 2 + dx, cy - 2 + dy, 1);
            }
        }
    }
}

class Renderer {
    constructor(canvas, engine) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.engine = engine;
        
        this.cellSize = 10;
        this.offsetX = 0;
        this.offsetY = 0;
        
        this.isPanning = false;
        this.startX = 0;
        this.startY = 0;

        this.resize();
        this.centerGrid();
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    centerGrid() {
        const viewWidth = this.canvas.width / window.devicePixelRatio;
        const viewHeight = this.canvas.height / window.devicePixelRatio;
        this.offsetX = (viewWidth - (this.engine.width * this.cellSize)) / 2;
        this.offsetY = (viewHeight - (this.engine.height * this.cellSize)) / 2;
    }

    screenToGrid(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        const x = screenX - rect.left;
        const y = screenY - rect.top;
        const gridX = Math.floor((x - this.offsetX) / this.cellSize);
        const gridY = Math.floor((y - this.offsetY) / this.cellSize);
        return { x: gridX, y: gridY };
    }

    draw() {
        const viewWidth = this.canvas.width / window.devicePixelRatio;
        const viewHeight = this.canvas.height / window.devicePixelRatio;

        this.ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-base');
        this.ctx.fillRect(0, 0, viewWidth, viewHeight);

        const aliveColor = getComputedStyle(document.documentElement).getPropertyValue('--cell-alive');
        const deadColor = getComputedStyle(document.documentElement).getPropertyValue('--cell-dead');
        const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color');

        this.ctx.fillStyle = deadColor;
        this.ctx.fillRect(this.offsetX, this.offsetY, this.engine.width * this.cellSize, this.engine.height * this.cellSize);

        this.ctx.fillStyle = aliveColor;
        for (let y = 0; y < this.engine.height; y++) {
            for (let x = 0; x < this.engine.width; x++) {
                if (this.engine.grid[y * this.engine.width + x] === 1) {
                    const px = this.offsetX + x * this.cellSize;
                    const py = this.offsetY + y * this.cellSize;
                    if (px + this.cellSize >= 0 && px <= viewWidth && py + this.cellSize >= 0 && py <= viewHeight) {
                        this.ctx.fillRect(px, py, this.cellSize - (this.cellSize > 4 ? 1 : 0), this.cellSize - (this.cellSize > 4 ? 1 : 0));
                    }
                }
            }
        }

        if (this.cellSize >= 6) {
            this.ctx.strokeStyle = borderColor;
            this.ctx.lineWidth = 0.5;
            this.ctx.beginPath();
            
            for (let x = 0; x <= this.engine.width; x++) {
                const px = this.offsetX + x * this.cellSize;
                if (px >= 0 && px <= viewWidth) {
                    this.ctx.moveTo(px, this.offsetY);
                    this.ctx.lineTo(px, this.offsetY + this.engine.height * this.cellSize);
                }
            }
            
            for (let y = 0; y <= this.engine.height; y++) {
                const py = this.offsetY + y * this.cellSize;
                if (py >= 0 && py <= viewHeight) {
                    this.ctx.moveTo(this.offsetX, py);
                    this.ctx.lineTo(this.offsetX + this.engine.width * this.cellSize, py);
                }
            }
            this.ctx.stroke();
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('sim-canvas');
    const engine = new SimulationEngine(120, 80);
    const renderer = new Renderer(canvas, engine);

    let isRunning = false;
    let fps = 0;
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsTimer = 0;
    let targetFps = 30;
    let interval = 1000 / targetFps;
    let lastFrameTime = 0;

    const btnPlay = document.getElementById('btn-play');
    const btnStep = document.getElementById('btn-step');
    const btnClear = document.getElementById('btn-clear');
    const presetSelect = document.getElementById('preset-select');
    const ruleInput = document.getElementById('rule-input');
    const btnApplyRule = document.getElementById('btn-apply-rule');
    const speedRange = document.getElementById('speed-range');
    
    const fpsCounter = document.getElementById('fps-counter');
    const cursorPos = document.getElementById('cursor-pos');
    const genCounter = document.getElementById('gen-counter');
    const populationCounter = document.getElementById('population-counter');

    function updateStats() {
        genCounter.textContent = `Generation: ${engine.generation}`;
        populationCounter.textContent = `Population: ${engine.population}`;
    }

    function loop(timestamp) {
        if (isRunning) {
            const delta = timestamp - lastFrameTime;
            if (delta >= interval) {
                lastFrameTime = timestamp - (delta % interval);
                engine.step();
                renderer.draw();
                updateStats();
            }
        }

        frameCount++;
        if (timestamp - fpsTimer >= 1000) {
            fps = frameCount;
            frameCount = 0;
            fpsTimer = timestamp;
            fpsCounter.textContent = `${fps} FPS`;
        }

        requestAnimationFrame(loop);
    }

    btnPlay.addEventListener('click', () => {
        isRunning = !isRunning;
        btnPlay.textContent = isRunning ? 'Pause' : 'Start';
        btnPlay.classList.toggle('primary', !isRunning);
    });

    btnStep.addEventListener('click', () => {
        if (!isRunning) {
            engine.step();
            renderer.draw();
            updateStats();
        }
    });

    btnClear.addEventListener('click', () => {
        engine.clear();
        renderer.draw();
        updateStats();
    });

    presetSelect.addEventListener('change', (e) => {
        if (e.target.value) {
            engine.loadPreset(e.target.value);
            renderer.draw();
            updateStats();
            e.target.value = '';
        }
    });

    btnApplyRule.addEventListener('click', () => {
        const success = engine.setRule(ruleInput.value);
        if (!success) {
            alert('Invalid rule format. Expected format: B3/S23');
        }
    });

    speedRange.addEventListener('input', (e) => {
        targetFps = parseInt(e.target.value, 10);
        interval = 1000 / targetFps;
    });

    let isDrawing = false;
    let drawValue = 1;

    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            const pos = renderer.screenToGrid(e.clientX, e.clientY);
            if (pos.x >= 0 && pos.x < engine.width && pos.y >= 0 && pos.y < engine.height) {
                const idx = pos.y * engine.width + pos.x;
                drawValue = engine.grid[idx] === 1 ? 0 : 1;
                engine.setCell(pos.x, pos.y, drawValue);
                isDrawing = true;
                renderer.draw();
                updateStats();
            } else if (e.button === 1 || e.shiftKey) {
                renderer.isPanning = true;
                renderer.startX = e.clientX;
                renderer.startY = e.clientY;
            }
        } else if (e.button === 2) {
            renderer.isPanning = true;
            renderer.startX = e.clientX;
            renderer.startY = e.clientY;
        }
    });

    window.addEventListener('mousemove', (e) => {
        const pos = renderer.screenToGrid(e.clientX, e.clientY);
        cursorPos.textContent = `X: ${pos.x}, Y: ${pos.y}`;

        if (isDrawing) {
            if (pos.x >= 0 && pos.x < engine.width && pos.y >= 0 && pos.y < engine.height) {
                engine.setCell(pos.x, pos.y, drawValue);
                renderer.draw();
                updateStats();
            }
        } else if (renderer.isPanning) {
            const dx = e.clientX - renderer.startX;
            const dy = e.clientY - renderer.startY;
            renderer.offsetX += dx;
            renderer.offsetY += dy;
            renderer.startX = e.clientX;
            renderer.startY = e.clientY;
            renderer.draw();
        }
    });

    window.addEventListener('mouseup', () => {
        isDrawing = false;
        renderer.isPanning = false;
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = 1.1;
        const oldCellSize = renderer.cellSize;
        
        if (e.deltaY < 0) {
            renderer.cellSize = Math.min(renderer.cellSize * zoomFactor, 40);
        } else {
            renderer.cellSize = Math.max(renderer.cellSize / zoomFactor, 2);
        }

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        renderer.offsetX = mouseX - (mouseX - renderer.offsetX) * (renderer.cellSize / oldCellSize);
        renderer.offsetY = mouseY - (mouseY - renderer.offsetY) * (renderer.cellSize / oldCellSize);

        renderer.draw();
    }, { passive: false });

    window.addEventListener('resize', () => {
        renderer.resize();
        renderer.draw();
    });

    engine.loadPreset('gun');
    renderer.draw();
    updateStats();
    requestAnimationFrame(loop);
});