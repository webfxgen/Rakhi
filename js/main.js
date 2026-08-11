// Global Navigation, State Management, and Audio Synthesizer

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize custom cursor trail (Desktop only)
    initCursorTrail();

    // 2. Initialize global navigation controls & states
    initGlobalSettings();

    // 3. Page entrance animations & link transition bindings
    initTransitions();

    // 4. Background static/noise grain generator
    initFilmGrain();
});

/* STATE MANAGEMENT */
let audioCtx = null;
let loFiAmbientNode = null;

function initGlobalSettings() {
    const vhsBtn = document.getElementById('vhs-toggle-btn');
    const soundBtn = document.getElementById('sound-btn');
    const menuToggle = document.getElementById('menu-toggle');
    const navLinks = document.getElementById('nav-links');

    // Retrieve storage preferences
    const vhsEnabled = localStorage.getItem('90s-mode') === 'true';
    const soundEnabled = localStorage.getItem('sound-mode') === 'true';

    // Apply initial VHS Mode filter class to body
    if (vhsEnabled) {
        document.body.classList.add('retro-vhs-mode-filter');
        const vhsOverlay = document.getElementById('vhs-effects');
        if (vhsOverlay) {
            vhsOverlay.classList.add('active');
            updateVHSClock();
        }
        if (vhsBtn) vhsBtn.classList.add('active');
    }

    // Apply Sound State button styles
    if (soundBtn) {
        soundBtn.innerText = soundEnabled ? '🔊 Sound On' : '🔇 Sound Off';
        if (soundEnabled) {
            soundBtn.classList.add('active');
            startLoFiAmbient();
        }
    }

    // Toggle 90s mode click handler
    if (vhsBtn) {
        vhsBtn.addEventListener('click', () => {
            const active = document.body.classList.toggle('retro-vhs-mode-filter');
            localStorage.setItem('90s-mode', active);
            
            const vhsOverlay = document.getElementById('vhs-effects');
            if (vhsOverlay) {
                vhsOverlay.classList.toggle('active', active);
                if (active) {
                    updateVHSClock();
                }
            }
            vhsBtn.classList.toggle('active', active);
            playChime();
        });
    }

    // Sound toggle click handler
    if (soundBtn) {
        soundBtn.addEventListener('click', () => {
            const active = soundBtn.classList.toggle('active');
            localStorage.setItem('sound-mode', active);
            soundBtn.innerText = active ? '🔊 Sound On' : '🔇 Sound Off';
            
            if (active) {
                startLoFiAmbient();
                playChime();
            } else {
                stopLoFiAmbient();
            }
        });
    }

    // Responsive navigation menu toggle drawer
    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            navLinks.classList.toggle('show');
        });
        document.addEventListener('click', () => {
            navLinks.classList.remove('show');
        });
    }
}

/* RETRO VHS CLOCK RUNNER */
function updateVHSClock() {
    const vhsOverlay = document.getElementById('vhs-effects');
    if (!vhsOverlay || !vhsOverlay.classList.contains('active')) return;
    
    const vhsClockEl = document.getElementById('vhs-clock');
    if (vhsClockEl) {
        const now = new Date();
        const pad = (num) => String(num).padStart(2, '0');
        vhsClockEl.innerHTML = `AUG 11 1998<br>${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    }
    setTimeout(updateVHSClock, 1000);
}

/* CUSTOM INTERACTIVE CURSOR */
function initCursorTrail() {
    const cursor = document.getElementById('cursor-trail');
    if (!cursor) return;

    document.addEventListener('mousemove', (e) => {
        gsap.to(cursor, {
            x: e.clientX,
            y: e.clientY,
            duration: 0.1
        });
    });

    // Custom hover behaviors for buttons & anchors
    const interactives = document.querySelectorAll('a, button, [role="button"], .interactive-element');
    interactives.forEach(item => {
        item.addEventListener('mouseenter', () => {
            gsap.to(cursor, { scale: 2.2, background: 'rgba(214, 40, 40, 0.4)', duration: 0.2 });
        });
        item.addEventListener('mouseleave', () => {
            gsap.to(cursor, { scale: 1, background: 'var(--gold-light)', duration: 0.2 });
        });
    });
}

/* AUDIO SYNTHESIZER (Web Audio API) */
function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function playChime() {
    const soundEnabled = localStorage.getItem('sound-mode') === 'true';
    if (!soundEnabled) return;

    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        // Brass Chime frequencies (A5, D6, A6, D7)
        const freqs = [880, 1174.66, 1760, 2349.32];
        const gains = [0.25, 0.15, 0.08, 0.04];
        const decays = [2.0, 1.4, 0.9, 0.5];

        freqs.forEach((f, idx) => {
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, now);

            gainNode.gain.setValueAtTime(gains[idx], now);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, now + decays[idx]);

            osc.connect(gainNode);
            gainNode.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + decays[idx]);
        });
    } catch (err) {
        console.warn("Audio Synthesizer is blocked or unsupported.", err);
    }
}

function startLoFiAmbient() {
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        // Low hum of vintage fan / record crackle
        if (loFiAmbientNode) return;

        const bufferSize = 2 * ctx.sampleRate;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        // Add filter to simulate retro vinyl crackle/low fan hum
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 180; // low bandpass for deep warm hum
        filter.Q.value = 0.5;

        const ambientGain = ctx.createGain();
        ambientGain.gain.setValueAtTime(0.02, now); // very soft hum

        whiteNoise.connect(filter);
        filter.connect(ambientGain);
        ambientGain.connect(ctx.destination);

        whiteNoise.start();
        loFiAmbientNode = { source: whiteNoise, gain: ambientGain };
    } catch (err) {
        console.warn("Failed to generate ambient synthesizer.", err);
    }
}

function stopLoFiAmbient() {
    if (loFiAmbientNode) {
        try {
            loFiAmbientNode.source.stop();
        } catch(e) {}
        loFiAmbientNode = null;
    }
}

/* FILM GRAIN DUST LAYER */
function initFilmGrain() {
    const fgCanvas = document.getElementById('vintage-noise-canvas');
    if (!fgCanvas) return;
    
    const fgCtx = fgCanvas.getContext('2d');
    let width = fgCanvas.width = window.innerWidth;
    let height = fgCanvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
        width = fgCanvas.width = window.innerWidth;
        height = fgCanvas.height = window.innerHeight;
    });

    function drawGrainFrame() {
        fgCtx.clearRect(0, 0, width, height);
        const imgData = fgCtx.createImageData(width, height);
        const data = imgData.data;
        const vhsActive = document.body.classList.contains('retro-vhs-mode-filter');
        
        for (let i = 0; i < data.length; i += 16) {
            const noise = Math.random() * 255;
            data[i] = noise;
            data[i+1] = noise;
            data[i+2] = noise;
            data[i+3] = vhsActive ? 24 : 12; // double opacity on VHS mode
        }
        fgCtx.putImageData(imgData, 0, 0);
        
        // Loop randomly (simulating film projector speed)
        setTimeout(() => {
            requestAnimationFrame(drawGrainFrame);
        }, 1000 / 18); // 18 fps grain jitter
    }

    drawGrainFrame();
}

/* GSAP PAGE SWEEP TRANSITIONS */
function initTransitions() {
    const transitionCover = document.getElementById('page-transition-cover');
    if (!transitionCover) return;

    // Entrance animation
    gsap.set(transitionCover, { translateY: '0%' });
    gsap.to(transitionCover, {
        translateY: '-100%',
        duration: 1.0,
        ease: 'power3.inOut',
        delay: 0.1,
        onComplete: () => {
            gsap.set(transitionCover, { translateY: '100%' });
        }
    });
}
