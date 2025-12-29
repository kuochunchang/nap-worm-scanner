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
    sleepyBugs: [
        document.getElementById('sleepy-bug-1'),
        document.getElementById('sleepy-bug-2')
    ],
    reportCard: document.getElementById('report-card'),
    sleepyProgress: document.getElementById('sleepy-progress'),
    sleepyIndex: document.getElementById('sleepy-index'),
    parasiteTime: document.getElementById('parasite-time'),
    bugStatus: document.getElementById('bug-status'),
    prescription: document.getElementById('prescription'),
    scanAgainBtn: document.getElementById('scan-again-btn'),
    cameraContainer: document.getElementById('camera-container'),
    downloadBtn: document.getElementById('download-btn'),
    shareBtn: document.getElementById('share-btn'),
    shareCanvas: document.getElementById('share-canvas')
};

// ===== State =====
let isScanning = false;
let faceDetectionInterval = null;
let audioContext = null;
let detectedFaces = []; // Store all detected faces
let bugTargetSide = null; // null = each face has own bug, 'left' or 'right' = all bugs on one side

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
        // Detect all faces (up to 2)
        const detections = await faceapi.detectAllFaces(elements.video, options)
            .withFaceLandmarks(true);
        return detections.slice(0, 2); // Return max 2 faces
    } catch (error) {
        console.error('Face detection error:', error);
        return [];
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

    return { x: bugX, y: bugY, faceBox: box };
}

// Sort faces by X position (left to right in mirrored view)
function sortFacesByPosition(faces) {
    return [...faces].sort((a, b) => {
        // In mirrored view, higher X value = left side of screen
        const aX = a.detection.box.x + a.detection.box.width / 2;
        const bX = b.detection.box.x + b.detection.box.width / 2;
        return bX - aX; // Higher X first (appears on left in mirrored view)
    });
}

function positionAllBugs(faces) {
    if (!faces || faces.length === 0) return;

    const sortedFaces = sortFacesByPosition(faces);
    detectedFaces = sortedFaces;

    const videoRect = elements.video.getBoundingClientRect();
    const scaleX = videoRect.width / elements.video.videoWidth;
    const scaleY = videoRect.height / elements.video.videoHeight;

    // Calculate positions for all faces
    const facePositions = sortedFaces.map(face => {
        const box = face.detection.box;
        return {
            x: videoRect.width - ((box.x + box.width / 2) * scaleX),
            y: (box.y * scaleY) - 20,
            box: box
        };
    });

    if (bugTargetSide === null) {
        // Normal mode: each face gets one bug
        facePositions.forEach((pos, index) => {
            if (index < elements.sleepyBugs.length) {
                elements.sleepyBugs[index].style.left = `${pos.x}px`;
                elements.sleepyBugs[index].style.top = `${pos.y}px`;
            }
        });
        // Hide extra bugs
        for (let i = facePositions.length; i < elements.sleepyBugs.length; i++) {
            elements.sleepyBugs[i].classList.remove('visible');
        }
    } else {
        // Targeted mode: all bugs go to one face with stacking
        const targetIndex = bugTargetSide === 'left' ? 0 : Math.min(1, facePositions.length - 1);
        const targetPos = facePositions[targetIndex] || facePositions[0];

        if (targetPos) {
            const bugCount = Math.min(facePositions.length, elements.sleepyBugs.length);
            const stackOffset = 35; // Vertical spacing between stacked bugs

            for (let i = 0; i < bugCount; i++) {
                elements.sleepyBugs[i].style.left = `${targetPos.x}px`;
                elements.sleepyBugs[i].style.top = `${targetPos.y - (i * stackOffset)}px`;
                elements.sleepyBugs[i].classList.add('visible');
            }
            // Hide unused bugs
            for (let i = bugCount; i < elements.sleepyBugs.length; i++) {
                elements.sleepyBugs[i].classList.remove('visible');
            }
        }
    }
}

function showBugs(count = 1) {
    const showCount = Math.min(count, elements.sleepyBugs.length);
    for (let i = 0; i < showCount; i++) {
        elements.sleepyBugs[i].classList.add('visible');
    }
}

function hideAllBugs() {
    elements.sleepyBugs.forEach(bug => bug.classList.remove('visible'));
}

// Handle click on camera container to move bugs
function handleCameraClick(event) {
    if (detectedFaces.length < 2) return; // Need at least 2 faces

    const rect = elements.cameraContainer.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const midpoint = rect.width / 2;

    // Determine which side was clicked
    const clickedSide = clickX < midpoint ? 'left' : 'right';

    // Toggle logic: if already on this side, reset to normal mode
    if (bugTargetSide === clickedSide) {
        bugTargetSide = null; // Reset - each person gets their own bug
    } else {
        bugTargetSide = clickedSide;
    }

    // Immediately reposition bugs
    positionAllBugs(detectedFaces);
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

    // Save data for share image
    saveReportData(sleepyIndex, hours, minutes, bugStatus, prescription);

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

// ===== Screenshot & Share Functions =====
let currentReportData = null;

function saveReportData(sleepyIndex, hours, minutes, bugStatus, prescription) {
    currentReportData = { sleepyIndex, hours, minutes, bugStatus, prescription };
}

async function generateShareImage() {
    const canvas = elements.shareCanvas;
    const ctx = canvas.getContext('2d');

    // Set canvas size (portrait orientation for social media)
    const width = 600;
    const height = 800;
    canvas.width = width;
    canvas.height = height;

    // Background gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#0a0a0f');
    bgGradient.addColorStop(1, '#12121a');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Add subtle glow effect
    const glowGradient = ctx.createRadialGradient(width / 2, 100, 0, width / 2, 100, 300);
    glowGradient.addColorStop(0, 'rgba(0, 255, 136, 0.1)');
    glowGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGradient;
    ctx.fillRect(0, 0, width, height);

    // Draw camera frame with captured image
    const frameX = 50;
    const frameY = 80;
    const frameWidth = 500;
    const frameHeight = 380;

    // Frame border
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(frameX, frameY, frameWidth, frameHeight);

    // Draw video frame (mirrored)
    ctx.save();
    ctx.translate(frameX + frameWidth, frameY);
    ctx.scale(-1, 1);
    ctx.drawImage(elements.video, 0, 0, frameWidth, frameHeight);
    ctx.restore();

    // Draw corner decorations
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 3;
    const cornerSize = 25;
    // Top-left
    ctx.beginPath();
    ctx.moveTo(frameX + cornerSize, frameY);
    ctx.lineTo(frameX, frameY);
    ctx.lineTo(frameX, frameY + cornerSize);
    ctx.stroke();
    // Top-right
    ctx.beginPath();
    ctx.moveTo(frameX + frameWidth - cornerSize, frameY);
    ctx.lineTo(frameX + frameWidth, frameY);
    ctx.lineTo(frameX + frameWidth, frameY + cornerSize);
    ctx.stroke();
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(frameX + cornerSize, frameY + frameHeight);
    ctx.lineTo(frameX, frameY + frameHeight);
    ctx.lineTo(frameX, frameY + frameHeight - cornerSize);
    ctx.stroke();
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(frameX + frameWidth - cornerSize, frameY + frameHeight);
    ctx.lineTo(frameX + frameWidth, frameY + frameHeight);
    ctx.lineTo(frameX + frameWidth, frameY + frameHeight - cornerSize);
    ctx.stroke();

    // Draw sleepy bug emoji on the image
    ctx.font = '50px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🐛💤', frameX + frameWidth / 2, frameY + 60);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🐛 瞌睡蟲檢測報告', width / 2, 510);

    // Divider line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(100, 530);
    ctx.lineTo(500, 530);
    ctx.stroke();

    // Report content
    if (currentReportData) {
        ctx.textAlign = 'left';
        ctx.font = '18px "Segoe UI", sans-serif';
        ctx.fillStyle = '#a0a0b0';

        const startY = 570;
        const lineHeight = 45;

        // Sleepy Index with progress bar
        ctx.fillText('瞌睡指數', 80, startY);
        // Progress bar background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(200, startY - 15, 250, 20);
        // Progress bar fill
        const progressGradient = ctx.createLinearGradient(200, 0, 450, 0);
        progressGradient.addColorStop(0, '#00ff88');
        progressGradient.addColorStop(1, '#00d4ff');
        ctx.fillStyle = progressGradient;
        ctx.fillRect(200, startY - 15, 250 * (currentReportData.sleepyIndex / 100), 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px "Segoe UI", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${currentReportData.sleepyIndex}%`, 530, startY);

        ctx.textAlign = 'left';
        ctx.font = '18px "Segoe UI", sans-serif';
        ctx.fillStyle = '#a0a0b0';

        // Parasite time
        ctx.fillText('寄生時間', 80, startY + lineHeight);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px "Segoe UI", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`約 ${currentReportData.hours} 小時 ${currentReportData.minutes} 分`, 530, startY + lineHeight);

        ctx.textAlign = 'left';
        ctx.font = '18px "Segoe UI", sans-serif';
        ctx.fillStyle = '#a0a0b0';

        // Bug status
        ctx.fillText('蟲體狀態', 80, startY + lineHeight * 2);
        ctx.fillStyle = '#ff6b9d';
        ctx.font = 'bold 18px "Segoe UI", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(currentReportData.bugStatus, 530, startY + lineHeight * 2);

        // Prescription box
        ctx.fillStyle = 'rgba(255, 107, 157, 0.15)';
        ctx.strokeStyle = 'rgba(255, 107, 157, 0.4)';
        ctx.lineWidth = 2;
        const boxY = startY + lineHeight * 2.5;
        ctx.beginPath();
        ctx.roundRect(60, boxY, 480, 60, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ff6b9d';
        ctx.font = '14px "Segoe UI", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('💊 處方建議', 80, boxY + 25);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px "Segoe UI", sans-serif';
        ctx.fillText(currentReportData.prescription, 80, boxY + 48);
    }

    // Footer
    ctx.fillStyle = 'rgba(160, 160, 176, 0.6)';
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠️ 由「瞌睡蟲檢查器 v2.0」生成 · 純屬娛樂', width / 2, height - 20);

    return canvas;
}

async function downloadImage() {
    try {
        elements.downloadBtn.disabled = true;
        elements.downloadBtn.innerHTML = '<span>⏳</span> 生成中...';

        const canvas = await generateShareImage();

        // Create download link
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 10);
        link.download = `瞌睡蟲報告_${timestamp}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        elements.downloadBtn.disabled = false;
        elements.downloadBtn.innerHTML = '<span>📥</span> 下載圖片';
    } catch (error) {
        console.error('Download failed:', error);
        alert('下載失敗，請再試一次！');
        elements.downloadBtn.disabled = false;
        elements.downloadBtn.innerHTML = '<span>📥</span> 下載圖片';
    }
}

async function shareImage() {
    try {
        elements.shareBtn.disabled = true;
        elements.shareBtn.innerHTML = '<span>⏳</span> 處理中...';

        const canvas = await generateShareImage();

        // Convert canvas to blob
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const file = new File([blob], '瞌睡蟲報告.png', { type: 'image/png' });

        // Check if Web Share API is available
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: '🐛 我的瞌睡蟲檢測報告',
                text: `我的瞌睡指數高達 ${currentReportData?.sleepyIndex || 87}%！快來幫我驅蟲！`,
                files: [file]
            });
        } else if (navigator.share) {
            // Fallback: share without file
            await navigator.share({
                title: '🐛 瞌睡蟲檢測報告',
                text: `我的瞌睡指數高達 ${currentReportData?.sleepyIndex || 87}%！處方：${currentReportData?.prescription || '請客喝咖啡！'}`,
                url: window.location.href
            });
        } else {
            // No Web Share API - fallback to download
            alert('您的瀏覽器不支援分享功能，將改為下載圖片。');
            await downloadImage();
        }

        elements.shareBtn.disabled = false;
        elements.shareBtn.innerHTML = '<span>📤</span> 分享結果';
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Share failed:', error);
        }
        elements.shareBtn.disabled = false;
        elements.shareBtn.innerHTML = '<span>📤</span> 分享結果';
    }
}

// ===== Main Scan Flow =====
async function startScan() {
    if (isScanning) return;
    isScanning = true;

    // Reset UI and state
    hideAllBugs();
    hideReport();
    bugTargetSide = null;
    detectedFaces = [];
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
    let lastDetections = [];
    const detectInterval = setInterval(async () => {
        const detections = await detectFace();
        if (detections && detections.length > 0) {
            lastDetections = detections;
            positionAllBugs(detections);
        }
    }, 100);

    // After scan duration, show results
    setTimeout(() => {
        clearInterval(messageInterval);
        clearInterval(detectInterval);
        elements.scanLine.classList.remove('active');
        hideScanMessage();

        if (lastDetections.length > 0) {
            // Face(s) detected - show bugs and report
            const faceCount = lastDetections.length;
            const statusText = faceCount > 1
                ? `偵測到 ${faceCount} 隻瞌睡蟲！`
                : '偵測到瞌睡蟲！';
            updateStatus(statusText, 'detected');
            scanAudio.playDetectionSound();
            positionAllBugs(lastDetections);
            showBugs(faceCount);
            generateReport();

            // Add click handler for multi-face interaction
            elements.cameraContainer.addEventListener('click', handleCameraClick);

            // Keep updating bug positions
            faceDetectionInterval = setInterval(async () => {
                const detections = await detectFace();
                if (detections && detections.length > 0) {
                    positionAllBugs(detections);
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
    // Remove click handler
    elements.cameraContainer.removeEventListener('click', handleCameraClick);

    // Reset state
    bugTargetSide = null;
    detectedFaces = [];

    hideAllBugs();
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
        elements.downloadBtn.addEventListener('click', downloadImage);
        elements.shareBtn.addEventListener('click', shareImage);
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
