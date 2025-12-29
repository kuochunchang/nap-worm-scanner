/**
 * 瞌睡蟲檢查器 (Sleepy Bug Detector)
 * A fun prank AR app that detects "sleepy bugs" on people's faces
 */

// ===== Configuration =====
const CONFIG = {
    faceApiModelUrl: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/',
    scanDuration: 4000, // 4 seconds
    scanMessages: [
        '正在分析腦波...',
        '偵測到異常嗜睡反應...',
        '掃描睡眠粒子濃度...',
        '分析完成，發現瞌睡蟲！'
    ],
    prescriptions: [
        '立刻請客喝咖啡驅蟲！☕',
        '建議午睡 30 分鐘補充能量 😴',
        '需要吃巧克力提神！🍫',
        '馬上去洗把臉清醒一下 💦',
        '建議聽搖滾樂振奮精神 🎸',
        '喝一杯濃茶趕走瞌睡蟲 🍵',
        '需要出去走走呼吸新鮮空氣 🌿',
        '強烈建議請假回家睡覺 🏠'
    ],
    bugStatuses: [
        '活躍中 🐛',
        '正在打哈欠 😪',
        '瘋狂繁殖中 🐛🐛',
        '準備下蛋了 🥚',
        '超級肥美 🐛✨'
    ]
};

// ===== DOM Elements =====
const elements = {
    video: document.getElementById('video'),
    overlay: document.getElementById('overlay'),
    startBtn: document.getElementById('start-btn'),
    loadingScreen: document.getElementById('loading-screen'),
    scanLine: document.getElementById('scan-line'),
    scanMessage: document.getElementById('scan-message'),
    scanText: document.getElementById('scan-text'),
    statusDisplay: document.getElementById('status-display'),
    sleepyBug: document.getElementById('sleepy-bug'),
    reportCard: document.getElementById('report-card'),
    sleepyProgress: document.getElementById('sleepy-progress'),
    sleepyIndex: document.getElementById('sleepy-index'),
    parasiteTime: document.getElementById('parasite-time'),
    bugStatus: document.getElementById('bug-status'),
    prescription: document.getElementById('prescription'),
    scanAgainBtn: document.getElementById('scan-again-btn'),
    cameraContainer: document.getElementById('camera-container')
};

// ===== State =====
let isScanning = false;
let faceDetectionInterval = null;
let audioContext = null;

// ===== Audio System =====
class ScanAudio {
    constructor() {
        this.audioContext = null;
        this.isPlaying = false;
    }

    init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    // Generate "beep beep" scanning sound
    playBeep(frequency = 800, duration = 0.1) {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    // Play scanning sound pattern
    async playScanPattern() {
        this.init();
        this.isPlaying = true;

        const pattern = [
            { freq: 800, delay: 0 },
            { freq: 1000, delay: 150 },
            { freq: 800, delay: 300 },
            { freq: 1200, delay: 600 },
            { freq: 1000, delay: 750 },
            { freq: 800, delay: 900 },
        ];

        for (const beep of pattern) {
            if (!this.isPlaying) break;
            await this.delay(beep.delay);
            this.playBeep(beep.freq, 0.08);
        }
    }

    // Play detection alert sound
    playDetectionSound() {
        this.init();
        const frequencies = [523, 659, 784, 1047]; // C5, E5, G5, C6
        frequencies.forEach((freq, i) => {
            setTimeout(() => this.playBeep(freq, 0.15), i * 100);
        });
    }

    stop() {
        this.isPlaying = false;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

const scanAudio = new ScanAudio();

// ===== Face Detection =====
async function loadFaceApiModels() {
    try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(CONFIG.faceApiModelUrl);
        await faceapi.nets.faceLandmark68TinyNet.loadFromUri(CONFIG.faceApiModelUrl);
        console.log('Face API models loaded successfully');
        return true;
    } catch (error) {
        console.error('Failed to load Face API models:', error);
        // Try alternative CDN
        try {
            const altUrl = 'https://raw.githubusercontent.com/nicholaszj/face-api.js-models/master/';
            await faceapi.nets.tinyFaceDetector.loadFromUri(altUrl);
            console.log('Loaded from alternative source');
            return true;
        } catch (e) {
            console.error('All model loading attempts failed');
            return false;
        }
    }
}

async function detectFace() {
    if (!elements.video.videoWidth) return null;

    const options = new faceapi.TinyFaceDetectorOptions({
        inputSize: 224,
        scoreThreshold: 0.5
    });

    try {
        const detection = await faceapi.detectSingleFace(elements.video, options)
            .withFaceLandmarks(true);
        return detection;
    } catch (error) {
        console.error('Face detection error:', error);
        return null;
    }
}

// ===== Camera =====
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'user',
                width: { ideal: 640 },
                height: { ideal: 480 }
            },
            audio: false
        });

        elements.video.srcObject = stream;
        await elements.video.play();

        // Set canvas size to match video
        elements.overlay.width = elements.video.videoWidth;
        elements.overlay.height = elements.video.videoHeight;

        return true;
    } catch (error) {
        console.error('Camera access error:', error);
        alert('無法存取攝影機！請確保已授權攝影機存取權限。');
        return false;
    }
}

// ===== UI Updates =====
function updateStatus(text, className = '') {
    const statusText = elements.statusDisplay.querySelector('.status-text');
    statusText.textContent = text;
    elements.statusDisplay.className = 'status-display ' + className;
}

function showScanMessage(text) {
    elements.scanText.textContent = text;
    elements.scanMessage.classList.add('visible');
}

function hideScanMessage() {
    elements.scanMessage.classList.remove('visible');
}

function positionBug(detection) {
    if (!detection) return;

    const box = detection.detection.box;
    const videoRect = elements.video.getBoundingClientRect();
    const containerRect = elements.cameraContainer.getBoundingClientRect();

    // Calculate scale factors
    const scaleX = videoRect.width / elements.video.videoWidth;
    const scaleY = videoRect.height / elements.video.videoHeight;

    // Position bug above the head (mirrored because video is flipped)
    const bugX = videoRect.width - ((box.x + box.width / 2) * scaleX);
    const bugY = (box.y * scaleY) - 20;

    elements.sleepyBug.style.left = `${bugX}px`;
    elements.sleepyBug.style.top = `${bugY}px`;
}

function showBug() {
    elements.sleepyBug.classList.add('visible');
}

function hideBug() {
    elements.sleepyBug.classList.remove('visible');
}

function generateReport() {
    // Random sleepy index (72-99%)
    const sleepyIndex = Math.floor(Math.random() * 28) + 72;

    // Random parasite time
    const hours = Math.floor(Math.random() * 5) + 1;
    const minutes = Math.floor(Math.random() * 60);

    // Random prescription
    const prescription = CONFIG.prescriptions[Math.floor(Math.random() * CONFIG.prescriptions.length)];

    // Random bug status
    const bugStatus = CONFIG.bugStatuses[Math.floor(Math.random() * CONFIG.bugStatuses.length)];

    // Update DOM
    elements.sleepyIndex.textContent = `${sleepyIndex}%`;
    elements.sleepyProgress.style.width = `${sleepyIndex}%`;
    elements.parasiteTime.textContent = `約 ${hours} 小時 ${minutes} 分`;
    elements.bugStatus.textContent = bugStatus;
    elements.prescription.textContent = prescription;

    // Show report with animation
    elements.reportCard.classList.add('visible');
}

function hideReport() {
    elements.reportCard.classList.remove('visible');
}

// ===== Main Scan Flow =====
async function startScan() {
    if (isScanning) return;
    isScanning = true;

    // Reset UI
    hideBug();
    hideReport();
    elements.startBtn.disabled = true;
    elements.startBtn.innerHTML = '<span class="btn-icon">🔍</span> 掃描中...';

    // Start camera if not already running
    if (!elements.video.srcObject) {
        const cameraStarted = await startCamera();
        if (!cameraStarted) {
            resetScan();
            return;
        }
    }

    // Start scanning animation
    elements.scanLine.classList.add('active');
    updateStatus('掃描中', 'active');

    // Play scanning sound
    scanAudio.playScanPattern();

    // Show scanning messages sequentially
    let messageIndex = 0;
    const messageInterval = setInterval(() => {
        if (messageIndex < CONFIG.scanMessages.length) {
            showScanMessage(CONFIG.scanMessages[messageIndex]);
            scanAudio.playScanPattern();
            messageIndex++;
        }
    }, CONFIG.scanDuration / CONFIG.scanMessages.length);

    // Start face detection
    let detectedFace = null;
    const detectInterval = setInterval(async () => {
        const detection = await detectFace();
        if (detection) {
            detectedFace = detection;
            positionBug(detection);
        }
    }, 100);

    // After scan duration, show results
    setTimeout(() => {
        clearInterval(messageInterval);
        clearInterval(detectInterval);
        elements.scanLine.classList.remove('active');
        hideScanMessage();

        if (detectedFace) {
            // Face detected - show bug and report
            updateStatus('偵測到瞌睡蟲！', 'detected');
            scanAudio.playDetectionSound();
            positionBug(detectedFace);
            showBug();
            generateReport();

            // Keep updating bug position
            faceDetectionInterval = setInterval(async () => {
                const detection = await detectFace();
                if (detection) {
                    positionBug(detection);
                }
            }, 100);
        } else {
            // No face detected
            updateStatus('未偵測到人臉', '');
            alert('沒有偵測到人臉，請確保臉部在畫面中！');
        }

        elements.startBtn.disabled = false;
        elements.startBtn.innerHTML = '<span class="btn-icon">📷</span> 開始掃描';
        isScanning = false;

    }, CONFIG.scanDuration);
}

function resetScan() {
    isScanning = false;
    if (faceDetectionInterval) {
        clearInterval(faceDetectionInterval);
        faceDetectionInterval = null;
    }
    hideBug();
    hideReport();
    hideScanMessage();
    elements.scanLine.classList.remove('active');
    updateStatus('待機中', '');
    elements.startBtn.disabled = false;
    elements.startBtn.innerHTML = '<span class="btn-icon">📷</span> 開始掃描';
    scanAudio.stop();
}

// ===== Initialization =====
async function init() {
    // Load face detection models
    const modelsLoaded = await loadFaceApiModels();

    if (modelsLoaded) {
        elements.loadingScreen.classList.add('hidden');

        // Event listeners
        elements.startBtn.addEventListener('click', startScan);
        elements.scanAgainBtn.addEventListener('click', () => {
            resetScan();
            startScan();
        });
    } else {
        elements.loadingScreen.querySelector('.loading-text').textContent =
            '載入失敗，請重新整理頁面';
    }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
