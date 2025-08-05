document.addEventListener('DOMContentLoaded', () => {
    class QTEGame_SVG_Fan {
        constructor() {
            this.toleranceRange = { min: 10, max: 25 };
            this.speedRange = { min: 120, max: 360 };
            this.directionSetting = 0;
            this.successDelay = 50;
            this.reactionTimeRange = { min: 300, max: 2000 };
            this.tolerance = 15;
            this.rotationSpeedDegreesPerSecond = 120;
            this.rotationDirection = 1;
            this.angle = 0;
            this.isRunning = false;
            this.animationId = null;
            this.markerHit = false;
            this.missedMarkers = [];
            this.lastTargetAngle = null;
            this.spinnerContainer = document.getElementById('qte-spinner-container');
            this.svgCanvas = document.getElementById('qte-svg-canvas');
            this.promptElement = document.getElementById('qte-prompt');
            this.modalElement = document.getElementById('qte-modal');
            this.markerPath = null;
            this.errorMarkersPath = null;
            this.handPath = null;
            this.wiperPath = null;
            this.init();
        }

        init() {
            this.createUI();
            this.resetGame();
            this.bindEvents();
        }

        createUI() {
            // FIX: 修正 SVG 命名空間字串，移除不正確的 markdown 格式
            const svgNS = "[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)";
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
            return [ "M", startInner.x, startInner.y, "L", startOuter.x, startOuter.y, "A", outerRadius, outerRadius, 0, largeArcFlag, 1, endOuter.x, endOuter.y, "L", endInner.x, endInner.y, "A", innerRadius, innerRadius, 0, largeArcFlag, 0, startInner.x, startInner.y, "Z" ].join(" ");
        }

        describeFan(x, y, radius, startAngle, endAngle) {
            const start = this.polarToCartesian(x, y, radius, startAngle);
            const end = this.polarToCartesian(x, y, radius, endAngle);
            const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? "1" : "0";
            return ["M", x, y, "L", start.x, start.y, "A", radius, radius, 0, largeArcFlag, 1, end.x, end.y, "Z"].join(" ");
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
            let errorPathData = "";
            this.missedMarkers.forEach(angle => {
                const startPoint = this.polarToCartesian(center, center, radius - 12, angle);
                const endPoint = this.polarToCartesian(center, center, radius + 12, angle);
                errorPathData += `M ${startPoint.x} ${startPoint.y} L ${endPoint.x} ${endPoint.y} `;
            });
            this.errorMarkersPath.setAttribute('d', errorPathData);
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
            this.rotationDirection = Math.random() < 0.5 ? 1 : -1;
            let possibleAngles = [];
            if (this.lastTargetAngle === null) {
                for (let i = 0; i < 360; i++) possibleAngles.push(i);
            } else {
                const historyBuffer = 90;
                const forbiddenStart = (this.lastTargetAngle - historyBuffer + 360) % 360;
                const forbiddenEnd = (this.lastTargetAngle + historyBuffer) % 360;
                for (let i = 0; i < 360; i++) {
                    let isForbidden = false;
                    if (forbiddenStart <= forbiddenEnd) {
                        if (i >= forbiddenStart && i <= forbiddenEnd) isForbidden = true;
                    } else {
                        if (i >= forbiddenStart || i <= forbiddenEnd) isForbidden = true;
                    }
                    if (!isForbidden) possibleAngles.push(i);
                }
            }
            if (possibleAngles.length === 0) {
                for (let i = 0; i < 360; i++) possibleAngles.push(i);
            }
            this.targetAngle = possibleAngles[Math.floor(Math.random() * possibleAngles.length)];
            this.lastTargetAngle = this.targetAngle;
            this.markerHit = false;
            this.missedMarkers = [];
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
            if (this.isRunning) return;
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
        }

        onMiss() {
            this.missedMarkers.push(this.angle); 
            this.updateViews();
            if (this.modalElement && typeof this.modalElement.animate === 'function') {
                 this.modalElement.animate([
                    { transform: 'translateX(0px)' }, { transform: 'translateX(-10px)' },
                    { transform: 'translateX(10px)' }, { transform: 'translateX(-10px)' },
                    { transform: 'translateX(10px)' }, { transform: 'translateX(0px)' }
                ], { duration: 300, easing: 'ease-in-out' });
            }
        }
    }

    // 將 game 實例暴露到 window，以便通訊腳本可以覆寫其方法
    window.qteGame = new QTEGame_SVG_Fan();
});