/**
 * qte_trigger.js
 * 攔截頁面的 QTE 挑戰邏輯。
 * 現在會根據儲存的難度設定調整參數，並加入了連續成功的循環次數要求。
 */
document.addEventListener('DOMContentLoaded', () => {
    // 從 URL 查詢參數中獲取原始目標網址和分頁 ID
    const urlParams = new URLSearchParams(window.location.search);
    const targetUrl = decodeURIComponent(urlParams.get('target'));
    const tabId = urlParams.get('tabId');

    // 定義不同難度的參數預設值，並新增 cycleCount
    const DIFFICULTY_PRESETS = {
        hard: {
            toleranceRange: { min: 10, max: 15 },
            speedRange: { min: 200, max: 350 },
            reactionTimeRange: { min: 400, max: 1000 },
            cycleCount: 3,
        },
        extreme: {
            toleranceRange: { min: 8, max: 12 },
            speedRange: { min: 300, max: 450 },
            reactionTimeRange: { min: 300, max: 800 },
            cycleCount: 4,
        },
        nightmare: {
            toleranceRange: { min: 5, max: 8 },
            speedRange: { min: 400, max: 550 },
            reactionTimeRange: { min: 250, max: 600 },
            cycleCount: 5,
        },
        impossible: {
            toleranceRange: { min: 3, max: 5 },
            speedRange: { min: 500, max: 700 },
            reactionTimeRange: { min: 200, max: 400 },
            cycleCount: 6,
        }
    };

    class QTEGame_Trigger {
        constructor(settings) {
            // 根據傳入的設定初始化遊戲參數
            this.toleranceRange = settings.toleranceRange;
            this.speedRange = settings.speedRange;
            this.reactionTimeRange = settings.reactionTimeRange;
            this.totalCycles = settings.cycleCount; // 總共需要成功的次數

            // 預設難度下，方向為困難隨機，成功延遲為0
            this.directionSetting = 2; 
            this.successDelay = 0;

            // 遊戲狀態變數
            this.currentCycle = 0; // 目前已成功的次數
            this.tolerance = 15;
            this.rotationSpeedDegreesPerSecond = 120;
            this.rotationDirection = 1;
            this.angle = 0;
            this.isRunning = false;
            this.animationId = null;
            this.markerHit = false;
            this.lastTargetAngle = null;
            this.hasEnteredZone = false; // 用於追蹤指針是否已進入過驗證區

            // DOM 元素參考
            this.spinnerContainer = document.getElementById('qte-spinner-container');
            this.svgCanvas = document.getElementById('qte-svg-canvas');
            this.promptElement = document.getElementById('qte-prompt');
            this.modalElement = document.getElementById('qte-modal');
            this.cycleDisplay = null; // 用於顯示進度的元素
            
            this.markerPath = null;
            this.handPath = null;
            this.wiperPath = null;
            
            this.init();
        }

        init() {
            this.createUI();
            this.createCycleDisplay(); // 建立進度顯示
            this.resetGame();
            this.bindEvents();
        }

        createUI() {
            const svgNS = "http://www.w3.org/2000/svg";
            this.wiperPath = document.createElementNS(svgNS, 'path');
            this.wiperPath.id = 'qte-wiper-path';
            this.markerPath = document.createElementNS(svgNS, 'path');
            this.markerPath.id = 'qte-marker-path';
            this.handPath = document.createElementNS(svgNS, 'path');
            this.handPath.id = 'qte-hand-path';
            this.svgCanvas.appendChild(this.wiperPath);
            this.svgCanvas.appendChild(this.markerPath);
            this.svgCanvas.appendChild(this.handPath);
        }

        // 建立並插入用於顯示循環次數進度的 UI 元素
        createCycleDisplay() {
            this.cycleDisplay = document.createElement('div');
            this.cycleDisplay.style.color = 'white';
            this.cycleDisplay.style.fontSize = '24px';
            this.cycleDisplay.style.marginTop = '20px';
            this.cycleDisplay.style.fontWeight = 'bold';
            this.modalElement.appendChild(this.cycleDisplay);
            this.updateCycleDisplay();
        }

        // 更新進度顯示的文字
        updateCycleDisplay() {
            if (this.cycleDisplay) {
                this.cycleDisplay.textContent = `進度: ${this.currentCycle} / ${this.totalCycles}`;
            }
        }

        polarToCartesian(centerX, centerY, radius, angleInDegrees) {
            const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
            return {
                x: centerX + (radius * Math.cos(angleInRadians)),
                y: centerY + (radius * Math.sin(angleInRadians))
            };
        }

        describeRingSegment(x, y, innerRadius, outerRadius, startAngle, endAngle) {
            const startOuter = this.polarToCartesian(x, y, outerRadius, startAngle);
            const endOuter = this.polarToCartesian(x, y, outerRadius, endAngle);
            const startInner = this.polarToCartesian(x, y, innerRadius, startAngle);
            const endInner = this.polarToCartesian(x, y, innerRadius, endAngle);
            const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? "1" : "0";
            const d = [ "M", startInner.x, startInner.y, "L", startOuter.x, startOuter.y, "A", outerRadius, outerRadius, 0, largeArcFlag, 1, endOuter.x, endOuter.y, "L", endInner.x, endInner.y, "A", innerRadius, innerRadius, 0, largeArcFlag, 0, startInner.x, startInner.y, "Z" ].join(" ");
            return d;
        }

        describeFan(x, y, radius, startAngle, endAngle) {
            const start = this.polarToCartesian(x, y, radius, startAngle);
            const end = this.polarToCartesian(x, y, radius, endAngle);
            const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? "1" : "0";
            const d = ["M", x, y, "L", start.x, start.y, "A", radius, radius, 0, largeArcFlag, 1, end.x, end.y, "Z"].join(" ");
            return d;
        }
        
        updateViews() {
            if (!this.spinnerContainer || this.spinnerContainer.offsetWidth === 0) {
                requestAnimationFrame(() => this.updateViews());
                return;
            }
            
            const svgSize = 240; 
            const center = svgSize / 2;
            const radius = (this.spinnerContainer.offsetWidth / 2) - (3 / 2);
            const markerThickness = 8;

            const markerStartAngle = this.targetAngle - this.tolerance;
            const markerEndAngle = this.targetAngle + this.tolerance;
            const markerPathData = this.describeRingSegment(center, center, radius - (markerThickness / 2), radius + (markerThickness / 2), markerStartAngle, markerEndAngle);
            this.markerPath.setAttribute('d', markerPathData);
            this.markerPath.style.fill = this.markerHit ? 'rgba(255, 255, 255, 0.9)' : 'rgba(120, 120, 120, 0.9)';

            const wiperWidth = 30;
            const gap = 1 * this.rotationDirection;
            const wiperStartAngle = this.angle - gap;
            const wiperEndAngle = this.angle - (wiperWidth * this.rotationDirection) - gap;
            const wiperPathData = this.describeFan(center, center, radius * 0.9, wiperStartAngle, wiperEndAngle);
            this.wiperPath.setAttribute('d', wiperPathData);

            const handEndPoint = this.polarToCartesian(center, center, radius - 2, this.angle);
            const handPathData = `M ${center} ${center} L ${handEndPoint.x} ${handEndPoint.y}`;
            this.handPath.setAttribute('d', handPathData);
        }

        generateNewTarget() {
            this.tolerance = Math.random() * (this.toleranceRange.max - this.toleranceRange.min) + this.toleranceRange.min;
            this.rotationSpeedDegreesPerSecond = Math.random() * (this.speedRange.max - this.speedRange.min) + this.speedRange.min;
            
            if (this.directionSetting === 2) {
                if (Math.random() < 0.8) { this.rotationDirection *= -1; }
            } else {
                this.rotationDirection = Math.random() < 0.5 ? 1 : -1;
            }

            this.targetAngle = Math.random() * 360;
            this.markerHit = false;
            this.hasEnteredZone = false; // 重置狀態
        }
        
        resetGame() {
            this.stopRotation();
            this.generateNewTarget();
            const randomReactionTime = (this.reactionTimeRange.min + Math.random() * (this.reactionTimeRange.max - this.reactionTimeRange.min)) / 1000;
            const angleOffset = this.rotationSpeedDegreesPerSecond * randomReactionTime;
            this.angle = (this.rotationDirection === 1) ? (this.targetAngle - angleOffset + 360) % 360 : (this.targetAngle + angleOffset) % 360;
            this.updateViews();
            this.startRotation();
        }

        startRotation() {
            this.isRunning = true;
            let lastTime = 0;
            const animate = (timestamp) => {
                if (!this.isRunning || this.markerHit) return;
                if (!lastTime) lastTime = timestamp;
                const deltaTime = (timestamp - lastTime) / 1000;
                lastTime = timestamp;
                const rotationAmount = this.rotationSpeedDegreesPerSecond * this.rotationDirection * deltaTime;
                this.angle = (this.angle + rotationAmount) % 360;
                if (this.angle < 0) this.angle += 360;

                // --- 越界失敗判斷 ---
                const diff = Math.abs(this.angle - this.targetAngle);
                const actualDiff = Math.min(diff, 360 - diff);
                const isInZone = actualDiff <= this.tolerance;

                if (isInZone) {
                    this.hasEnteredZone = true;
                }

                // 修改後的判斷：當指針曾進入驗證區，且離開驗證區超過 5 度時，才判斷為失敗
                if (this.hasEnteredZone && actualDiff > this.tolerance + 5) {
                    this.onMiss();
                    return; 
                }
                // --- 判斷結束 ---

                this.updateViews();
                this.animationId = requestAnimationFrame(animate);
            };
            this.animationId = requestAnimationFrame(animate);
        }

        stopRotation() {
            this.isRunning = false;
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
                this.animationId = null;
            }
        }
        
        bindEvents() {
            this.handleSpacePress = this.handleSpacePress.bind(this);
            document.addEventListener('keydown', this.handleSpacePress);
        }

        handleSpacePress(e) {
            if (e.code !== 'Space' || !this.isRunning || this.markerHit) return;
            e.preventDefault();
            const diff = Math.abs(this.angle - this.targetAngle);
            const actualDiff = Math.min(diff, 360 - diff);
            if (actualDiff <= this.tolerance) {
                this.onSuccess();
            } else {
                this.onMiss();
            }
        }

        onSuccess() {
            this.markerHit = true;
            this.stopRotation();
            this.updateViews();
            this.currentCycle++;
            this.updateCycleDisplay();

            if (this.currentCycle >= this.totalCycles) {
                // 已完成所有循環，最終成功
                this.promptElement.textContent = "成功！";
                if (tabId) {
                    chrome.runtime.sendMessage({ qte: 'success', tabId: tabId });
                }
                setTimeout(() => {
                    window.location.href = targetUrl;
                }, 500); // 最終成功後延遲長一點
            } else {
                // 完成一個循環，準備下一個
                setTimeout(() => {
                    this.resetGame();
                }, 50); // 將間隔時間改為 50ms
            }
        }

        onMiss() {
            this.stopRotation();
            // 不再顯示錯誤標記
            
            if (this.modalElement && typeof this.modalElement.animate === 'function') {
                 this.modalElement.animate([
                    { transform: 'translateX(0px)' }, { transform: 'translateX(-10px)' },
                    { transform: 'translateX(10px)' }, { transform: 'translateX(-10px)' },
                    { transform: 'translateX(10px)' }, { transform: 'translateX(0px)' }
                ], { duration: 300, easing: 'ease-in-out' });
            }

            setTimeout(() => {
                window.close();
            }, 1000);
        }
    }

    // 讀取設定，然後根據設定初始化遊戲
    chrome.storage.sync.get({
        difficulty: 'hard', // 如果找不到設定，預設為 '困難'
    }, (items) => {
        // 從預設集中獲取對應的難度設定
        const gameSettings = DIFFICULTY_PRESETS[items.difficulty] || DIFFICULTY_PRESETS.hard;

        if (targetUrl && tabId) {
            new QTEGame_Trigger(gameSettings);
        } else {
            document.body.innerHTML = `<h1 style="color: #FF5252; text-align: center; margin-top: 40vh;">錯誤：找不到目標網頁或分頁ID。</h1>`;
        }
    });
});
