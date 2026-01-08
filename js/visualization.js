/**
 * 3D Beam Visualization using Three.js
 * 
 * This module handles all 3D rendering and visualization
 * of the beam analysis results.
 */

class BeamVisualization {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.beamMesh = null;
        this.supportMeshes = [];
        this.loadArrows = [];
        this.deflectionScale = 50; // Scale factor for visualization
        this.showStress = true;
        this.wireframe = false;

        this.init();
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x111827);

        // Camera
        const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        this.camera.position.set(5, 3, 5);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 20;

        // Lights
        this.setupLights();

        // Grid
        this.setupGrid();

        // Handle resize
        window.addEventListener('resize', () => this.onResize());

        // Start animation loop
        this.animate();
    }

    setupLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);

        // Main directional light
        const mainLight = new THREE.DirectionalLight(0xffffff, 1);
        mainLight.position.set(5, 10, 5);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        this.scene.add(mainLight);

        // Fill light
        const fillLight = new THREE.DirectionalLight(0x6366f1, 0.3);
        fillLight.position.set(-5, 5, -5);
        this.scene.add(fillLight);

        // Back light
        const backLight = new THREE.DirectionalLight(0x8b5cf6, 0.2);
        backLight.position.set(0, -5, -10);
        this.scene.add(backLight);
    }

    setupGrid() {
        const gridHelper = new THREE.GridHelper(10, 20, 0x6366f1, 0x1f2937);
        gridHelper.position.y = -0.5;
        this.scene.add(gridHelper);
    }

    /**
     * Create or update beam geometry with deflection
     */
    updateBeam(params, results) {
        // Clear existing beam and supports
        this.clearBeam();

        const { L, b, h, beamType, loadType, P, q, M0, a } = params;
        const { deflection, x } = results;

        // Create beam geometry with deflection
        const segments = deflection.length - 1;
        const geometry = new THREE.BufferGeometry();

        // Create vertices for deformed beam
        const vertices = [];
        const colors = [];
        const indices = [];

        // Calculate max deflection for color mapping
        const maxDefl = Math.max(...deflection.map(Math.abs)) || 1;

        for (let i = 0; i <= segments; i++) {
            const xi = x[i] - L / 2; // Center the beam
            const yi = -deflection[i] * this.deflectionScale; // Negative: downward load = downward deflection

            // Create cross-section vertices (rectangular)
            // Bottom-left, bottom-right, top-right, top-left
            const halfB = b / 2;
            const halfH = h / 2;

            vertices.push(xi, yi - halfH, -halfB);  // 0
            vertices.push(xi, yi - halfH, halfB);   // 1
            vertices.push(xi, yi + halfH, halfB);   // 2
            vertices.push(xi, yi + halfH, -halfB);  // 3

            // Colors based on stress/deflection
            const stressRatio = Math.abs(deflection[i]) / maxDefl;
            const color = this.getStressColor(stressRatio);

            for (let j = 0; j < 4; j++) {
                colors.push(color.r, color.g, color.b);
            }
        }

        // Create faces (indices)
        for (let i = 0; i < segments; i++) {
            const base = i * 4;

            // Front face (z = halfB)
            indices.push(base + 1, base + 5, base + 6);
            indices.push(base + 1, base + 6, base + 2);

            // Back face (z = -halfB)
            indices.push(base + 0, base + 3, base + 7);
            indices.push(base + 0, base + 7, base + 4);

            // Top face
            indices.push(base + 2, base + 6, base + 7);
            indices.push(base + 2, base + 7, base + 3);

            // Bottom face
            indices.push(base + 0, base + 4, base + 5);
            indices.push(base + 0, base + 5, base + 1);
        }

        // Add end caps
        // Left end
        indices.push(0, 1, 2);
        indices.push(0, 2, 3);

        // Right end
        const last = segments * 4;
        indices.push(last + 1, last + 0, last + 3);
        indices.push(last + 1, last + 3, last + 2);

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        // Material
        const material = new THREE.MeshPhongMaterial({
            vertexColors: this.showStress,
            color: this.showStress ? 0xffffff : 0x6366f1,
            wireframe: this.wireframe,
            side: THREE.DoubleSide,
            flatShading: false
        });

        this.beamMesh = new THREE.Mesh(geometry, material);
        this.beamMesh.castShadow = true;
        this.beamMesh.receiveShadow = true;
        this.scene.add(this.beamMesh);

        // Add supports based on beam type
        this.addSupports(beamType, L, h);

        // Add load indicators
        this.addLoadIndicators(loadType, L, a, P, q, M0);

        // Adjust camera to fit beam
        this.fitCameraToBeam(L);
    }

    /**
     * Get color based on stress ratio (blue to red gradient)
     */
    getStressColor(ratio) {
        // Blue (low stress) -> Cyan -> Green -> Yellow -> Red (high stress)
        const r = Math.min(1, ratio * 2);
        const g = ratio < 0.5 ? ratio * 2 : 2 - ratio * 2;
        const b = Math.max(0, 1 - ratio * 2);

        return { r, g, b };
    }

    /**
     * Add support symbols
     */
    addSupports(beamType, L, h) {
        const supportGeometry = new THREE.ConeGeometry(0.1, 0.2, 8);
        const supportMaterial = new THREE.MeshPhongMaterial({ color: 0x10b981 });

        switch (beamType) {
            case 'simply-supported':
                // Pin support at left
                const leftSupport = new THREE.Mesh(supportGeometry, supportMaterial);
                leftSupport.position.set(-L / 2, -h / 2 - 0.15, 0);
                leftSupport.rotation.z = Math.PI;
                this.scene.add(leftSupport);
                this.supportMeshes.push(leftSupport);

                // Roller support at right
                const rightSupport = new THREE.Mesh(supportGeometry, supportMaterial);
                rightSupport.position.set(L / 2, -h / 2 - 0.15, 0);
                rightSupport.rotation.z = Math.PI;
                this.scene.add(rightSupport);
                this.supportMeshes.push(rightSupport);

                // Roller circles
                const rollerGeometry = new THREE.TorusGeometry(0.08, 0.02, 8, 16);
                const rollerMaterial = new THREE.MeshPhongMaterial({ color: 0x10b981 });
                const roller = new THREE.Mesh(rollerGeometry, rollerMaterial);
                roller.position.set(L / 2, -h / 2 - 0.28, 0);
                roller.rotation.x = Math.PI / 2;
                this.scene.add(roller);
                this.supportMeshes.push(roller);
                break;

            case 'fixed-fixed':
                // Fixed supports at both ends
                const fixedGeometry = new THREE.BoxGeometry(0.15, 0.4, 0.3);
                const fixedMaterial = new THREE.MeshPhongMaterial({ color: 0x10b981 });

                const leftFixed = new THREE.Mesh(fixedGeometry, fixedMaterial);
                leftFixed.position.set(-L / 2 - 0.1, 0, 0);
                this.scene.add(leftFixed);
                this.supportMeshes.push(leftFixed);

                const rightFixed = new THREE.Mesh(fixedGeometry, fixedMaterial);
                rightFixed.position.set(L / 2 + 0.1, 0, 0);
                this.scene.add(rightFixed);
                this.supportMeshes.push(rightFixed);
                break;

            case 'cantilever':
                // Fixed support at left only
                const cantileverGeometry = new THREE.BoxGeometry(0.2, 0.5, 0.4);
                const cantileverMaterial = new THREE.MeshPhongMaterial({ color: 0x10b981 });

                const fixedSupport = new THREE.Mesh(cantileverGeometry, cantileverMaterial);
                fixedSupport.position.set(-L / 2 - 0.15, 0, 0);
                this.scene.add(fixedSupport);
                this.supportMeshes.push(fixedSupport);
                break;
        }
    }

    /**
     * Add load indicator arrows
     */
    addLoadIndicators(loadType, L, a, P, q, M0) {
        const arrowColor = 0xef4444;

        switch (loadType) {
            case 'point':
                // Single arrow at load position
                const arrowPos = a - L / 2;
                const arrowDir = new THREE.Vector3(0, -1, 0);
                const arrowLength = 0.5;
                const arrow = new THREE.ArrowHelper(arrowDir, new THREE.Vector3(arrowPos, 0.8, 0), arrowLength, arrowColor, 0.15, 0.1);
                this.scene.add(arrow);
                this.loadArrows.push(arrow);
                break;

            case 'distributed':
                // Multiple arrows for distributed load
                const numArrows = 10;
                for (let i = 0; i <= numArrows; i++) {
                    const xPos = -L / 2 + (i / numArrows) * L;
                    const dir = new THREE.Vector3(0, -1, 0);
                    const distribArrow = new THREE.ArrowHelper(dir, new THREE.Vector3(xPos, 0.6, 0), 0.3, arrowColor, 0.1, 0.06);
                    this.scene.add(distribArrow);
                    this.loadArrows.push(distribArrow);
                }
                break;

            case 'moment':
                // Curved arrow for moment
                const momentPos = a - L / 2;
                const curve = new THREE.EllipseCurve(momentPos, 0.5, 0.2, 0.2, 0, 1.5 * Math.PI, false, 0);
                const points = curve.getPoints(20);
                const momentGeometry = new THREE.BufferGeometry().setFromPoints(points);
                const momentMaterial = new THREE.LineBasicMaterial({ color: arrowColor, linewidth: 3 });
                const momentLine = new THREE.Line(momentGeometry, momentMaterial);
                momentLine.rotation.x = Math.PI / 2;
                this.scene.add(momentLine);
                this.loadArrows.push(momentLine);
                break;
        }
    }

    /**
     * Fit camera to show entire beam
     */
    fitCameraToBeam(L) {
        const distance = Math.max(L * 1.5, 4);
        this.camera.position.set(distance * 0.7, distance * 0.4, distance * 0.7);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    /**
     * Clear beam and related objects
     */
    clearBeam() {
        if (this.beamMesh) {
            this.scene.remove(this.beamMesh);
            this.beamMesh.geometry.dispose();
            this.beamMesh.material.dispose();
            this.beamMesh = null;
        }

        this.supportMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        });
        this.supportMeshes = [];

        this.loadArrows.forEach(arrow => {
            this.scene.remove(arrow);
            if (arrow.dispose) arrow.dispose();
        });
        this.loadArrows = [];
    }

    /**
     * Toggle wireframe mode
     */
    toggleWireframe() {
        this.wireframe = !this.wireframe;
        if (this.beamMesh) {
            this.beamMesh.material.wireframe = this.wireframe;
        }
        return this.wireframe;
    }

    /**
     * Toggle stress visualization
     */
    toggleStress() {
        this.showStress = !this.showStress;
        if (this.beamMesh) {
            this.beamMesh.material.vertexColors = this.showStress;
            this.beamMesh.material.color.set(this.showStress ? 0xffffff : 0x6366f1);
            this.beamMesh.material.needsUpdate = true;
        }
        return this.showStress;
    }

    /**
     * Reset camera view
     */
    resetView() {
        this.camera.position.set(5, 3, 5);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    /**
     * Handle window resize
     */
    onResize() {
        const container = this.canvas.parentElement;
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    /**
     * Animation loop
     */
    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Export for use in other modules
window.BeamVisualization = BeamVisualization;
