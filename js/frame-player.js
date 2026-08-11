class FramePlayer {
    constructor(canvasId, folderName, filesArray, options = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error(`Canvas with ID ${canvasId} not found.`);
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        this.folderName = folderName;
        this.files = filesArray;
        this.totalFrames = filesArray.length;
        this.images = new Array(this.totalFrames);
        
        // Options
        this.fps = options.fps || 12;
        this.frameDuration = 1000 / this.fps;
        this.onFirstFrameLoad = options.onFirstFrameLoad || null;
        this.onBatchLoad = options.onBatchLoad || null;
        this.onProgress = options.onProgress || null;
        this.batchCount = options.batchCount || 5;

        // Loop State
        this.currentFrameIndex = 0;
        this.direction = 1;
        this.isPlaying = false;
        this.loopLastTime = 0;
        this.animationFrameId = null;
        this.loadedCount = 0;

        // Check reduced motion preference
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (this.reducedMotion) {
            this.fps = 1; // Play extremely slowly if user prefers reduced motion
            this.frameDuration = 1000 / this.fps;
        }

        // Initialize bindings
        this.handleResize = this.resize.bind(this);
        window.addEventListener('resize', this.handleResize);

        this.handleVisibilityChange = this.visibilityChanged.bind(this);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    init() {
        this.resize();
        
        // Load the very first frame immediately
        const firstImg = new Image();
        firstImg.src = `${this.folderName}/${this.files[0]}`;
        firstImg.onload = () => {
            this.images[0] = firstImg;
            this.loadedCount++;
            this.draw(0);
            
            if (this.onFirstFrameLoad) {
                this.onFirstFrameLoad();
            }

            // Load the first batch (e.g. frames 2 to 5) for loader progress tracking
            this.loadInitialBatch();
        };

        firstImg.onerror = () => {
            console.error(`Failed to load initial frame: ${firstImg.src}`);
            this.fallbackText("Our memory is loading... ❤️");
        };
    }

    loadInitialBatch() {
        let batchLoaded = 1; // first frame is already loaded
        const limit = Math.min(this.batchCount, this.totalFrames);

        if (limit <= 1) {
            this.loadRemaining();
            if (this.onBatchLoad) this.onBatchLoad();
            return;
        }

        for (let i = 1; i < limit; i++) {
            const img = new Image();
            img.src = `${this.folderName}/${this.files[i]}`;
            img.onload = () => {
                this.images[i] = img;
                this.loadedCount++;
                batchLoaded++;
                
                if (this.onProgress) {
                    this.onProgress(Math.round((batchLoaded / limit) * 100));
                }

                if (batchLoaded === limit) {
                    if (this.onBatchLoad) this.onBatchLoad();
                    this.loadRemaining();
                }
            };
            img.onerror = () => {
                console.warn(`Failed to load frame ${i}: ${img.src}. Skipping.`);
                batchLoaded++;
                if (batchLoaded === limit) {
                    if (this.onBatchLoad) this.onBatchLoad();
                    this.loadRemaining();
                }
            };
        }
    }

    loadRemaining() {
        for (let i = this.batchCount; i < this.totalFrames; i++) {
            const img = new Image();
            img.src = `${this.folderName}/${this.files[i]}`;
            img.onload = () => {
                this.images[i] = img;
                this.loadedCount++;
            };
            img.onerror = () => {
                console.warn(`Failed to load frame ${i}: ${img.src}. Skipping.`);
            };
        }
    }

    resize() {
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;
        if (this.images[this.currentFrameIndex]) {
            this.draw(this.currentFrameIndex);
        }
    }

    draw(index) {
        // Fallback to frame 0 if current index image is not loaded yet
        const img = this.images[index] || this.images[0];
        if (!img) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const imgWidth = img.width;
        const imgHeight = img.height;
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;

        const imgRatio = imgWidth / imgHeight;
        const canvasRatio = canvasWidth / canvasHeight;

        let drawWidth, drawHeight, drawX, drawY;

        // Aspect ratio cover calculations
        if (canvasRatio > imgRatio) {
            drawWidth = canvasWidth;
            drawHeight = canvasWidth / imgRatio;
            drawX = 0;
            drawY = (canvasHeight - drawHeight) / 2;
        } else {
            drawWidth = canvasHeight * imgRatio;
            drawHeight = canvasHeight;
            drawX = (canvasWidth - drawWidth) / 2;
            drawY = 0;
        }

        this.ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    }

    fallbackText(msg) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = "#FAF6EE";
        this.ctx.font = "italic 1.5rem 'Cormorant Garamond', serif";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(msg, this.canvas.width / 2, this.canvas.height / 2);
    }

    start() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.loopLastTime = 0;
        this.animationFrameId = requestAnimationFrame(this.tick.bind(this));
    }

    stop() {
        this.isPlaying = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    tick(timestamp) {
        if (!this.isPlaying) return;
        if (!this.loopLastTime) this.loopLastTime = timestamp;
        const elapsed = timestamp - this.loopLastTime;

        if (elapsed >= this.frameDuration) {
            this.currentFrameIndex += this.direction;
            if (this.currentFrameIndex >= this.totalFrames) {
                this.currentFrameIndex = this.totalFrames - 2;
                this.direction = -1;
            } else if (this.currentFrameIndex < 0) {
                this.currentFrameIndex = 1;
                this.direction = 1;
            }
            // Safeguards
            if (this.currentFrameIndex < 0) this.currentFrameIndex = 0;
            if (this.currentFrameIndex >= this.totalFrames) this.currentFrameIndex = this.totalFrames - 1;

            this.draw(this.currentFrameIndex);
            this.loopLastTime = timestamp - (elapsed % this.frameDuration);
        }

        this.animationFrameId = requestAnimationFrame(this.tick.bind(this));
    }

    visibilityChanged() {
        if (document.hidden) {
            this.stop();
        } else {
            this.start();
        }
    }

    destroy() {
        this.stop();
        window.removeEventListener('resize', this.handleResize);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
}

// Global files sequence helper mapping 35 frames (skipping 033, 036)
const ANIMATION_FRAMES_LIST = [
    "frame_001.png", "frame_002.png", "frame_003.png", "frame_004.png", "frame_005.png",
    "frame_006.png", "frame_007.png", "frame_008.png", "frame_009.png", "frame_010.png",
    "frame_011.png", "frame_012.png", "frame_013.png", "frame_014.png", "frame_015.png",
    "frame_016.png", "frame_017.png", "frame_018.png", "frame_019.png", "frame_020.png",
    "frame_021.png", "frame_022.png", "frame_023.png", "frame_024.png", "frame_025.png",
    "frame_026.png", "frame_027.png", "frame_028.png", "frame_029.png", "frame_030.png",
    "frame_031.png", "frame_032.png", "frame_034.png", "frame_035.png", "frame_037.png"
];
