/**
 * Main Application Controller
 * 
 * Connects UI controls with beam calculations and visualization
 */

class BeamApp {
    constructor() {
        this.calculator = new BeamCalculator();
        this.visualization = new BeamVisualization('beamCanvas');
        this.diagramCanvas = document.getElementById('diagramCanvas');
        this.diagramCtx = this.diagramCanvas.getContext('2d');
        this.currentDiagram = 'deflection';
        this.currentResults = null;
        this.currentParams = null;

        this.initEventListeners();
        this.initDiagramCanvas();

        // Initial calculation
        setTimeout(() => this.calculate(), 100);
    }

    initEventListeners() {
        // Calculate button
        document.getElementById('calculateBtn').addEventListener('click', () => this.calculate());

        // Beam type radio buttons
        document.querySelectorAll('input[name="beamType"]').forEach(radio => {
            radio.addEventListener('change', () => this.calculate());
        });

        // Load type radio buttons
        document.querySelectorAll('input[name="loadType"]').forEach(radio => {
            radio.addEventListener('change', () => this.updateLoadInputs());
        });

        // Material select
        document.getElementById('material').addEventListener('change', (e) => {
            const customDiv = document.getElementById('customMaterial');
            if (e.target.value === 'custom') {
                customDiv.classList.remove('hidden');
            } else {
                customDiv.classList.add('hidden');
            }
            this.calculate();
        });

        // Input changes
        const inputs = ['length', 'width', 'height', 'pointLoad', 'loadPosition',
            'distributedLoad', 'momentLoad', 'customE'];
        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => this.calculate());
            }
        });

        // Canvas controls
        document.getElementById('resetView').addEventListener('click', () => {
            this.visualization.resetView();
        });

        document.getElementById('toggleWireframe').addEventListener('click', (e) => {
            const isWireframe = this.visualization.toggleWireframe();
            e.currentTarget.classList.toggle('active', isWireframe);
        });

        document.getElementById('toggleStress').addEventListener('click', (e) => {
            const showStress = this.visualization.toggleStress();
            e.currentTarget.classList.toggle('active', showStress);
        });

        // Diagram tabs
        document.querySelectorAll('.diagram-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.diagram-tab').forEach(t => t.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.currentDiagram = e.currentTarget.dataset.diagram;
                this.drawDiagram();
            });
        });

        // Window resize
        window.addEventListener('resize', () => this.resizeDiagramCanvas());
    }

    initDiagramCanvas() {
        this.resizeDiagramCanvas();
    }

    resizeDiagramCanvas() {
        const container = this.diagramCanvas.parentElement;
        this.diagramCanvas.width = container.clientWidth;
        this.diagramCanvas.height = container.clientHeight;
        if (this.currentResults) {
            this.drawDiagram();
        }
    }

    updateLoadInputs() {
        const loadType = document.querySelector('input[name="loadType"]:checked').value;

        document.getElementById('pointLoadGroup').classList.toggle('hidden', loadType !== 'point');
        document.getElementById('loadPositionGroup').classList.toggle('hidden', loadType === 'distributed');
        document.getElementById('distributedLoadGroup').classList.toggle('hidden', loadType !== 'distributed');
        document.getElementById('momentLoadGroup').classList.toggle('hidden', loadType !== 'moment');

        this.calculate();
    }

    getParams() {
        const beamType = document.querySelector('input[name="beamType"]:checked').value;
        const loadType = document.querySelector('input[name="loadType"]:checked').value;
        const material = document.getElementById('material').value;

        const L = parseFloat(document.getElementById('length').value) || 2;
        const b = parseFloat(document.getElementById('width').value) || 0.1;
        const h = parseFloat(document.getElementById('height').value) || 0.15;

        const customE = parseFloat(document.getElementById('customE').value) || 200;
        const E = this.calculator.getElasticModulus(material, customE);
        const I = this.calculator.calculateMomentOfInertia(b, h);

        const P = parseFloat(document.getElementById('pointLoad').value) || 10000;
        const q = parseFloat(document.getElementById('distributedLoad').value) || 5000;
        const M0 = parseFloat(document.getElementById('momentLoad').value) || 5000;
        let a = parseFloat(document.getElementById('loadPosition').value) || L / 2;

        // Ensure load position is within beam length
        a = Math.min(Math.max(a, 0.01), L - 0.01);

        // Update load position input max
        document.getElementById('loadPosition').max = L;

        return {
            beamType,
            loadType,
            L,
            b,
            h,
            E,
            I,
            P,
            q,
            M0,
            a
        };
    }

    calculate() {
        const params = this.getParams();
        this.currentParams = params;

        // Perform beam analysis
        const results = this.calculator.analyze(params);
        this.currentResults = results;

        // Calculate max stress
        const maxStress = this.calculator.getMaxStress(results.maxMoment, params.h, params.I);

        // Update visualization
        this.visualization.updateBeam(params, results);

        // Update UI results
        this.updateResults(results, maxStress, params);

        // Draw diagram
        this.drawDiagram();
    }

    updateResults(results, maxStress, params) {
        // Format numbers for display
        const formatNumber = (num, unit) => {
            if (Math.abs(num) >= 1e9) {
                return `${(num / 1e9).toFixed(2)} G${unit}`;
            } else if (Math.abs(num) >= 1e6) {
                return `${(num / 1e6).toFixed(2)} M${unit}`;
            } else if (Math.abs(num) >= 1e3) {
                return `${(num / 1e3).toFixed(2)} k${unit}`;
            } else if (Math.abs(num) >= 1) {
                return `${num.toFixed(3)} ${unit}`;
            } else if (Math.abs(num) >= 1e-3) {
                return `${(num * 1e3).toFixed(3)} m${unit}`;
            } else if (Math.abs(num) >= 1e-6) {
                return `${(num * 1e6).toFixed(3)} μ${unit}`;
            } else {
                return `${num.toExponential(2)} ${unit}`;
            }
        };

        document.getElementById('maxDeflection').textContent = formatNumber(results.maxDeflection, 'm');
        document.getElementById('maxStress').textContent = formatNumber(maxStress, 'Pa');
        document.getElementById('maxSlope').textContent = `${(results.maxSlope * 180 / Math.PI).toFixed(4)}°`;
        document.getElementById('maxMoment').textContent = formatNumber(results.maxMoment, 'N·m');
        document.getElementById('maxShear').textContent = formatNumber(results.maxShear, 'N');
        document.getElementById('momentOfInertia').textContent = formatNumber(params.I, 'm⁴');
    }

    drawDiagram() {
        if (!this.currentResults) return;

        const ctx = this.diagramCtx;
        const canvas = this.diagramCanvas;
        const { x, deflection, moment, shear } = this.currentResults;
        const L = this.currentParams.L;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Get data based on current diagram type
        let data, title, unit, color;
        switch (this.currentDiagram) {
            case 'deflection':
                data = deflection;
                title = 'Deflection Diagram';
                unit = 'm';
                color = '#6366f1';
                break;
            case 'moment':
                data = moment;
                title = 'Bending Moment Diagram';
                unit = 'N·m';
                color = '#8b5cf6';
                break;
            case 'shear':
                data = shear;
                title = 'Shear Force Diagram';
                unit = 'N';
                color = '#a855f7';
                break;
        }

        const padding = { top: 30, right: 40, bottom: 30, left: 60 };
        const width = canvas.width - padding.left - padding.right;
        const height = canvas.height - padding.top - padding.bottom;

        // Find data range
        const minVal = Math.min(...data);
        const maxVal = Math.max(...data);
        const range = maxVal - minVal || 1;
        const absMax = Math.max(Math.abs(minVal), Math.abs(maxVal));

        // Draw background
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw grid
        ctx.strokeStyle = '#1f2937';
        ctx.lineWidth = 1;

        // Horizontal grid lines
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (i / 4) * height;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + width, y);
            ctx.stroke();
        }

        // Vertical grid lines
        for (let i = 0; i <= 5; i++) {
            const xPos = padding.left + (i / 5) * width;
            ctx.beginPath();
            ctx.moveTo(xPos, padding.top);
            ctx.lineTo(xPos, padding.top + height);
            ctx.stroke();
        }

        // Draw zero line if data crosses zero
        if (minVal < 0 && maxVal > 0) {
            const zeroY = padding.top + (maxVal / range) * height;
            ctx.strokeStyle = '#4b5563';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(padding.left, zeroY);
            ctx.lineTo(padding.left + width, zeroY);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Draw data curve
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        for (let i = 0; i < data.length; i++) {
            const xPos = padding.left + (i / (data.length - 1)) * width;
            const yPos = padding.top + ((maxVal - data[i]) / range) * height;

            if (i === 0) {
                ctx.moveTo(xPos, yPos);
            } else {
                ctx.lineTo(xPos, yPos);
            }
        }
        ctx.stroke();

        // Fill under curve
        ctx.lineTo(padding.left + width, padding.top + (maxVal / range) * height);
        ctx.lineTo(padding.left, padding.top + (maxVal / range) * height);
        ctx.closePath();
        ctx.fillStyle = color + '20';
        ctx.fill();

        // Draw title
        ctx.fillStyle = '#9ca3af';
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title, canvas.width / 2, 18);

        // Draw Y-axis labels
        ctx.fillStyle = '#6b7280';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'right';

        const formatValue = (val) => {
            if (Math.abs(val) >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
            if (Math.abs(val) >= 1e3) return `${(val / 1e3).toFixed(1)}k`;
            if (Math.abs(val) >= 1) return val.toFixed(2);
            return (val * 1e3).toFixed(2) + 'm';
        };

        ctx.fillText(formatValue(maxVal), padding.left - 5, padding.top + 4);
        ctx.fillText(formatValue(minVal), padding.left - 5, padding.top + height + 4);

        // Draw X-axis labels
        ctx.textAlign = 'center';
        ctx.fillText('0', padding.left, padding.top + height + 15);
        ctx.fillText(`${L.toFixed(1)} m`, padding.left + width, padding.top + height + 15);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.beamApp = new BeamApp();
});
