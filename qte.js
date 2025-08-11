/**
 * QTE.js
 * QTE 反應挑戰遊戲的核心邏輯。
 * 包含了遊戲的初始化、UI更新、事件處理等。
 */
document.addEventListener('DOMContentLoaded', () => {
    class QTEGame_SVG_Fan {
        constructor() {
            // 遊戲參數設定範圍
            this.toleranceRange = { min: 10, max: 25 };
            this.speedRange = { min: 120, max: 360 };
            this.directionSetting = 0; // 0: 隨機, 1: 順時針, -1: 逆時針, 2: 困難隨機
            this.successDelay = 50;
            this.reactionTimeRange = { min: 300, max: 2000 };

            // 遊戲狀態變數
            this.tolerance = 15;
            this.rotationSpeedDegreesPerSecond = 120;
            this.rotationDirection = 1;
            this.angle = 0;
            this.isRunning = false;
            this.animationId = null;
            this.markerHit = false;
            this.missedMarkers = [];
            this.lastTargetAngle = null;

            // DOM 元素參考
            this.spinnerContainer = document.getElementById('qte-spinner-container');
            this.svgCanvas = document.getElementById('qte-svg-canvas');
            this.promptElement = document.getElementById('qte-prompt');
            this.modalElement = document.getElementById('qte-modal');
            this.debugPanel = document.getElementById('debug-panel');
            
            // SVG 路徑元素
            this.markerPath = null;
            this.errorMarkersPath = null;
            this.handPath = null;
            this.wiperPath = null;
            
            // 初始化遊戲
            this.init();
        }

        /**
         * 初始化遊戲，建立UI、讀取設定、綁定事件並開始遊戲。
         */
        init() {
            this.loadSettings();
            this.createUI();
            this.createDebugPanel();
            this.resetGame(); // 初始啟動
            this.bindEvents();
        }

        /**
         * 在 SVG 畫布中建立遊戲所需的各種路徑元素。
         */
        createUI() {
            const svgNS = "http://www.w3.org/2000/svg";
            this.wiperPath = document.createElementNS(svgNS, 'path');
            this.wiperPath.id = 'qte-wiper-path';
            this.markerPath = document.createElementNS(svgNS, 'path');
            this.markerPath.id = 'qte-marker-path';
            this.errorMarkersPath = document.createElementNS(svgNS, 'path');
            this.errorMarkersPath.id = 'qte-error-markers-path';
            this.handPath = document.createElementNS(svgNS, 'path');
            this.handPath.id = 'qte-hand-path';
            this.svgCanvas.appendChild(this.wiperPath);
            this.svgCanvas.appendChild(this.markerPath);
            this.svgCanvas.appendChild(this.errorMarkersPath);
            this.svgCanvas.appendChild(this.handPath);
        }

        /**
         * 建立右上角的除錯/設定面板。
         */
        createDebugPanel() {
            this.debugPanel.innerHTML = `
                <h3>調試視窗</h3>
                <div class="control-group">
                    <label>驗證區間 (度)</label>
                    <div class="control-group-inline">
                        <span>Min: <input type="number" id="tolerance-min"></span>
                        <span>Max: <input type="number" id="tolerance-max"></span>
                    </div>
                </div>
                <div class="control-group">
                    <label>指針速度 (度/秒)</label>
                     <div class="control-group-inline">
                        <span>Min: <input type="number" id="speed-min"></span>
                        <span>Max: <input type="number" id="speed-max"></span>
                    </div>
                </div>
                <div class="control-group">
                    <label>反應區間 (ms)</label>
                     <div class="control-group-inline">
                        <span>Min: <input type="number" id="reaction-time-min"></span>
                        <span>Max: <input type="number" id="reaction-time-max"></span>
                    </div>
                </div>
                <div class="control-group">
                    <label for="direction-select">旋轉方向</label>
                    <select id="direction-select">
                        <option value="0">隨機</option>
                        <option value="1">順時針</option>
                        <option value="-1">逆時針</option>
                        <option value="2">困難隨機</option>
                    </select>
                </div>
                <div class="control-group">
                    <label for="success-delay-input">間隔時間 (ms)</label>
                    <input type="number" id="success-delay-input">
                </div>
                <button id="reset-button">重置</button>
            `;
            this.updateDebugPanelUI();
        }
        
        /**
         * 從 localStorage 讀取使用者儲存的設定。
         */
        loadSettings() {
            const savedSettings = localStorage.getItem('qteGameSettings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                this.toleranceRange = settings.toleranceRange || { min: 10, max: 25 };
                this.speedRange = settings.speedRange || { min: 120, max: 360 };
                this.directionSetting = typeof settings.directionSetting !== 'undefined' ? settings.directionSetting : 0;
                this.successDelay = typeof settings.successDelay !== 'undefined' ? settings.successDelay : 50;
                this.reactionTimeRange = settings.reactionTimeRange || { min: 300, max: 2000 };
            }
        }

        /**
         * 將目前的設定儲存到 localStorage。
         */
        saveSettings() {
            const settings = {
                toleranceRange: this.toleranceRange,
                speedRange: this.speedRange,
                directionSetting: this.directionSetting,
                successDelay: this.successDelay,
                reactionTimeRange: this.reactionTimeRange
            };
            localStorage.setItem('qteGameSettings', JSON.stringify(settings));
        }

        /**
         * 更新除錯面板中的數值以符合目前的設定。
         */
        updateDebugPanelUI() {
            document.getElementById('tolerance-min').value = this.toleranceRange.min;
            document.getElementById('tolerance-max').value = this.toleranceRange.max;
            document.getElementById('speed-min').value = this.speedRange.min;
            document.getElementById('speed-max').value = this.speedRange.max;
            document.getElementById('reaction-time-min').value = this.reactionTimeRange.min;
            document.getElementById('reaction-time-max').value = this.reactionTimeRange.max;
            document.getElementById('direction-select').value = this.directionSetting;
            document.getElementById('success-delay-input').value = this.successDelay;
        }

        /**
         * 將極座標轉換為笛卡爾座標。
         * @param {number} centerX - 圓心 X 座標
         * @param {number} centerY - 圓心 Y 座標
         * @param {number} radius - 半徑
         * @param {number} angleInDegrees - 角度
         * @returns {{x: number, y: number}} 笛卡爾座標
         */
        polarToCartesian(centerX, centerY, radius, angleInDegrees) {
            const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
            return {
                x: centerX + (radius * Math.cos(angleInRadians)),
                y: centerY + (radius * Math.sin(angleInRadians))
            };
        }

        /**
         * 描述一個環形扇區的 SVG 路徑。
         * @param {number} x - 圓心 X
         * @param {number} y - 圓心 Y
         * @param {number} innerRadius - 內半徑
         * @param {number} outerRadius - 外半徑
         * @param {number} startAngle - 開始角度
         * @param {number} endAngle - 結束角度
         * @returns {string} SVG 路徑數據
         */
        describeRingSegment(x, y, innerRadius, outerRadius, startAngle, endAngle) {
            const startOuter = this.polarToCartesian(x, y, outerRadius, startAngle);
            const endOuter = this.polarToCartesian(x, y, outerRadius, endAngle);
            const startInner = this.polarToCartesian(x, y, innerRadius, startAngle);
            const endInner = this.polarToCartesian(x, y, innerRadius, endAngle);
            const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? "1" : "0";
            const d = [ "M", startInner.x, startInner.y, "L", startOuter.x, startOuter.y, "A", outerRadius, outerRadius, 0, largeArcFlag, 1, endOuter.x, endOuter.y, "L", endInner.x, endInner.y, "A", innerRadius, innerRadius, 0, largeArcFlag, 0, startInner.x, startInner.y, "Z" ].join(" ");
            return d;
        }

        /**
         * 描述一個扇形的 SVG 路徑 (用於擦除效果)。
         * @param {number} x - 圓心 X
         * @param {number} y - 圓心 Y
         * @param {number} radius - 半徑
         * @param {number} startAngle - 開始角度
         * @param {number} endAngle - 結束角度
         * @returns {string} SVG 路徑數據
         */
        describeFan(x, y, radius, startAngle, endAngle) {
            const start = this.polarToCartesian(x, y, radius, startAngle);
            const end = this.polarToCartesian(x, y, radius, endAngle);
            const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? "1" : "0";
            const d = ["M", x, y, "L", start.x, start.y, "A", radius, radius, 0, largeArcFlag, 1, end.x, end.y, "Z"].join(" ");
            return d;
        }
        
        /**
         * 根據目前遊戲狀態更新所有 SVG 視圖。
         */
        updateViews() {
            if (!this.spinnerContainer || this.spinnerContainer.offsetWidth === 0) {
                requestAnimationFrame(() => this.updateViews());
                return;
            }
            
            const svgSize = 240; 
            const center = svgSize / 2;
            const radius = (this.spinnerContainer.offsetWidth / 2) - (3 / 2);
            const markerThickness = 8;

            // 更新目標區塊
            const markerStartAngle = this.targetAngle - this.tolerance;
            const markerEndAngle = this.targetAngle + this.tolerance;
            const markerPathData = this.describeRingSegment(center, center, radius - (markerThickness / 2), radius + (markerThickness / 2), markerStartAngle, markerEndAngle);
            this.markerPath.setAttribute('d', markerPathData);
            this.markerPath.style.fill = this.markerHit ? 'rgba(255, 255, 255, 0.9)' : 'rgba(120, 120, 120, 0.9)';

            // 更新錯誤標記
            let errorPathData = "";
            this.missedMarkers.forEach(angle => {
                const startPoint = this.polarToCartesian(center, center, radius - 12, angle);
                const endPoint = this.polarToCartesian(center, center, radius + 12, angle);
                errorPathData += `M ${startPoint.x} ${startPoint.y} L ${endPoint.x} ${endPoint.y} `;
            });
            this.errorMarkersPath.setAttribute('d', errorPathData);

            // 更新擦除動畫
            const wiperWidth = 30;
            const gap = 1 * this.rotationDirection;
            const wiperStartAngle = this.angle - gap;
            const wiperEndAngle = this.angle - (wiperWidth * this.rotationDirection) - gap;
            const wiperPathData = this.describeFan(center, center, radius * 0.9, wiperStartAngle, wiperEndAngle);
            this.wiperPath.setAttribute('d', wiperPathData);

            // 更新指針
            const handEndPoint = this.polarToCartesian(center, center, radius - 2, this.angle);
            const handPathData = `M ${center} ${center} L ${handEndPoint.x} ${handEndPoint.y}`;
            this.handPath.setAttribute('d', handPathData);
        }

        /**
         * 產生一個新的目標位置，並設定相關參數。
         */
        generateNewTarget() {
            // 1. 決定速度、方向、驗證區寬度
            this.tolerance = Math.random() * (this.toleranceRange.max - this.toleranceRange.min) + this.toleranceRange.min;
            this.rotationSpeedDegreesPerSecond = Math.random() * (this.speedRange.max - this.speedRange.min) + this.speedRange.min;

            switch (this.directionSetting) {
                case 2: // 困難隨機: 80% 機率反轉方向
                    if (Math.random() < 0.8) { this.rotationDirection *= -1; }
                    break;
                case 1: // 固定順時針
                    this.rotationDirection = 1;
                    break;
                case -1: // 固定逆時針
                    this.rotationDirection = -1;
                    break;
                case 0: // 標準隨機
                default:
                    this.rotationDirection = Math.random() < 0.5 ? 1 : -1;
                    break;
            }

            // 2. 找出所有與上一個目標距離足夠的潛在位置 (避免重複感)
            let possibleAngles = [];
            if (this.lastTargetAngle === null) {
                for (let i = 0; i < 360; i++) possibleAngles.push(i);
            } else {
                const historyBuffer = 90; // 與上個目標至少間隔 90 度
                const forbiddenStart = (this.lastTargetAngle - historyBuffer + 360) % 360;
                const forbiddenEnd = (this.lastTargetAngle + historyBuffer) % 360;

                for (let i = 0; i < 360; i++) {
                    let isForbidden = false;
                    if (forbiddenStart <= forbiddenEnd) {
                        if (i >= forbiddenStart && i <= forbiddenEnd) {
                            isForbidden = true;
                        }
                    } else { // 跨越 0 度
                        if (i >= forbiddenStart || i <= forbiddenEnd) {
                            isForbidden = true;
                        }
                    }
                    if (!isForbidden) {
                        possibleAngles.push(i);
                    }
                }
            }

            // 如果篩選後沒有任何位置，則放棄歷史距離規則
            if (possibleAngles.length === 0) {
                console.warn("無法滿足歷史距離，已忽略該規則。");
                for (let i = 0; i < 360; i++) possibleAngles.push(i);
            }
            
            // 3. 從這些位置中，選出一個作為最終目標
            this.targetAngle = possibleAngles[Math.floor(Math.random() * possibleAngles.length)];
            this.lastTargetAngle = this.targetAngle;
            this.markerHit = false;
            this.missedMarkers = [];
        }
        
        /**
         * 重置遊戲到新的一局。
         */
        resetGame() {
            this.stopRotation();
            
            // 1. 先決定目標位置
            this.generateNewTarget();

            // 2. 再根據目標位置和反應區間，決定指針的起始位置
            const randomReactionTime = (this.reactionTimeRange.min + Math.random() * (this.reactionTimeRange.max - this.reactionTimeRange.min)) / 1000;
            const angleOffset = this.rotationSpeedDegreesPerSecond * randomReactionTime;

            if (this.rotationDirection === 1) { // 順時針
                this.angle = (this.targetAngle - angleOffset + 360) % 360;
            } else { // 逆時針
                this.angle = (this.targetAngle + angleOffset) % 360;
            }

            this.updateViews(); // 更新畫面以顯示新的指針和目標
            this.startRotation();
        }

        /**
         * 開始指針的旋轉動畫。
         */
        startRotation() {
            this.isRunning = true;
            let lastTime = 0;
            const animate = (timestamp) => {
                if (!this.isRunning) return;
                if (!lastTime) lastTime = timestamp;
                const deltaTime = (timestamp - lastTime) / 1000;
                lastTime = timestamp;
                const rotationAmount = this.rotationSpeedDegreesPerSecond * this.rotationDirection * deltaTime;
                this.angle = (this.angle + rotationAmount) % 360;
                if (this.angle < 0) this.angle += 360;
                this.updateViews();
                this.animationId = requestAnimationFrame(animate);
            };
            this.animationId = requestAnimationFrame(animate);
        }

        /**
         * 停止指針的旋轉動畫。
         */
        stopRotation() {
            this.isRunning = false;
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
                this.animationId = null;
            }
        }
        
        /**
         * 綁定所有必要的事件監聽器。
         */
        bindEvents() {
            // 綁定鍵盤事件
            this.handleSpacePress = this.handleSpacePress.bind(this);
            document.addEventListener('keydown', this.handleSpacePress);

            // 綁定除錯面板的控制項事件
            document.getElementById('tolerance-min').addEventListener('change', (e) => { this.toleranceRange.min = parseFloat(e.target.value); this.saveSettings(); });
            document.getElementById('tolerance-max').addEventListener('change', (e) => { this.toleranceRange.max = parseFloat(e.target.value); this.saveSettings(); });
            document.getElementById('speed-min').addEventListener('change', (e) => { this.speedRange.min = parseFloat(e.target.value); this.saveSettings(); });
            document.getElementById('speed-max').addEventListener('change', (e) => { this.speedRange.max = parseFloat(e.target.value); this.saveSettings(); });
            document.getElementById('reaction-time-min').addEventListener('change', (e) => { this.reactionTimeRange.min = parseInt(e.target.value, 10); this.saveSettings(); });
            document.getElementById('reaction-time-max').addEventListener('change', (e) => { this.reactionTimeRange.max = parseInt(e.target.value, 10); this.saveSettings(); });
            document.getElementById('direction-select').addEventListener('change', (e) => { this.directionSetting = parseInt(e.target.value, 10); this.saveSettings(); });
            document.getElementById('success-delay-input').addEventListener('change', (e) => { this.successDelay = parseInt(e.target.value, 10); this.saveSettings(); });
            
            document.getElementById('reset-button').addEventListener('click', () => this.resetGame());
        }

        /**
         * 處理空白鍵按下事件。
         * @param {KeyboardEvent} e - 鍵盤事件物件
         */
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

        /**
         * 成功擊中目標區塊時的處理函式。
         */
        onSuccess() {
            this.markerHit = true;
            this.stopRotation();
            this.updateViews();
            this.onComplete();
        }

        /**
         * 未擊中目標區塊時的處理函式。
         */
        onMiss() {
            this.missedMarkers.push(this.angle); 
            this.updateViews();
            // 觸發一個輕微的震動效果提示失敗
            if (this.modalElement && typeof this.modalElement.animate === 'function') {
                 this.modalElement.animate([
                    { transform: 'translateX(0px)' }, { transform: 'translateX(-10px)' },
                    { transform: 'translateX(10px)' }, { transform: 'translateX(-10px)' },
                    { transform: 'translateX(10px)' }, { transform: 'translateX(0px)' }
                ], { duration: 300, easing: 'ease-in-out' });
            }
        }

        /**
         * 完成一局（無論成功失敗）後的處理函式。
         */
        onComplete() {
            const delay = (this.directionSetting === 2) ? 50 : this.successDelay;

            setTimeout(() => {
                this.resetGame();
            }, delay);
        }
    }

    // 建立遊戲實例
    new QTEGame_SVG_Fan();
});
