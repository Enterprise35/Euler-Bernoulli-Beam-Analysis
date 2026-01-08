/**
 * Euler-Bernoulli Beam Calculator
 * 
 * This module contains all the mathematical formulas for beam analysis
 * based on Euler-Bernoulli beam theory.
 */

class BeamCalculator {
    constructor() {
        // Material properties (E in Pa)
        this.materials = {
            'steel': 200e9,      // 200 GPa
            'aluminum': 70e9,    // 70 GPa
            'copper': 120e9,     // 120 GPa
            'wood': 12e9         // 12 GPa
        };
    }

    /**
     * Calculate moment of inertia for rectangular cross-section
     * I = (b * h^3) / 12
     */
    calculateMomentOfInertia(b, h) {
        return (b * Math.pow(h, 3)) / 12;
    }

    /**
     * Get elastic modulus for material
     */
    getElasticModulus(material, customE = null) {
        if (material === 'custom' && customE !== null) {
            return customE * 1e9; // Convert GPa to Pa
        }
        return this.materials[material] || this.materials['steel'];
    }

    /**
     * Calculate beam deflection, slope, moment, and shear along the beam
     * Returns arrays of values at discrete points
     */
    analyze(params) {
        const {
            beamType,
            loadType,
            L,          // Length (m)
            E,          // Elastic modulus (Pa)
            I,          // Moment of inertia (m^4)
            P = 0,      // Point load (N)
            q = 0,      // Distributed load (N/m)
            M0 = 0,     // Moment load (N·m)
            a = L / 2,    // Load position (m)
            numPoints = 100
        } = params;

        const EI = E * I;
        const x = [];
        const deflection = [];
        const slope = [];
        const moment = [];
        const shear = [];

        for (let i = 0; i <= numPoints; i++) {
            const xi = (i / numPoints) * L;
            x.push(xi);

            let w = 0, theta = 0, M = 0, V = 0;

            switch (beamType) {
                case 'simply-supported':
                    ({ w, theta, M, V } = this.simplySupported(xi, L, EI, loadType, P, q, M0, a));
                    break;
                case 'fixed-fixed':
                    ({ w, theta, M, V } = this.fixedFixed(xi, L, EI, loadType, P, q, M0, a));
                    break;
                case 'cantilever':
                    ({ w, theta, M, V } = this.cantilever(xi, L, EI, loadType, P, q, M0, a));
                    break;
            }

            deflection.push(w);
            slope.push(theta);
            moment.push(M);
            shear.push(V);
        }

        // Calculate max stress (σ = My/I, where y = h/2)
        const maxMoment = Math.max(...moment.map(Math.abs));
        const maxDeflection = Math.max(...deflection.map(Math.abs));
        const maxSlope = Math.max(...slope.map(Math.abs));
        const maxShear = Math.max(...shear.map(Math.abs));

        return {
            x,
            deflection,
            slope,
            moment,
            shear,
            maxMoment,
            maxDeflection,
            maxSlope,
            maxShear,
            EI
        };
    }

    /**
     * Simply Supported Beam
     */
    simplySupported(x, L, EI, loadType, P, q, M0, a) {
        let w = 0, theta = 0, M = 0, V = 0;
        const b = L - a;

        switch (loadType) {
            case 'point':
                // Point load at position a
                if (x <= a) {
                    // Left of load
                    const Pb = P * b;
                    w = (Pb * x) / (6 * L * EI) * (L * L - b * b - x * x);
                    theta = (Pb) / (6 * L * EI) * (L * L - b * b - 3 * x * x);
                    M = (Pb * x) / L;
                    V = (P * b) / L;
                } else {
                    // Right of load
                    const Pa = P * a;
                    const xFromRight = L - x;
                    w = (Pa * xFromRight) / (6 * L * EI) * (L * L - a * a - xFromRight * xFromRight);
                    theta = -(Pa) / (6 * L * EI) * (L * L - a * a - 3 * xFromRight * xFromRight);
                    M = (Pa * xFromRight) / L;
                    V = -(P * a) / L;
                }
                break;

            case 'distributed':
                // Uniformly distributed load
                w = (q * x) / (24 * EI) * (L * L * L - 2 * L * x * x + x * x * x);
                theta = (q) / (24 * EI) * (L * L * L - 6 * L * x * x + 4 * x * x * x);
                M = (q * x) / 2 * (L - x);
                V = q * (L / 2 - x);
                break;

            case 'moment':
                // Point moment at position a
                if (x <= a) {
                    w = (M0 * x) / (6 * L * EI) * (2 * L * L - 3 * L * a + a * a - x * x);
                    theta = (M0) / (6 * L * EI) * (2 * L * L - 3 * L * a + a * a - 3 * x * x);
                    M = (M0 * x) / L;
                    V = M0 / L;
                } else {
                    const xFromRight = L - x;
                    w = (M0 * xFromRight) / (6 * L * EI) * (2 * L * L - 3 * L * b + b * b - xFromRight * xFromRight);
                    theta = -(M0) / (6 * L * EI) * (2 * L * L - 3 * L * b + b * b - 3 * xFromRight * xFromRight);
                    M = M0 * (1 - x / L);
                    V = M0 / L;
                }
                break;
        }

        return { w, theta, M, V };
    }

    /**
     * Fixed-Fixed Beam (Ankastre)
     */
    fixedFixed(x, L, EI, loadType, P, q, M0, a) {
        let w = 0, theta = 0, M = 0, V = 0;
        const b = L - a;

        switch (loadType) {
            case 'point':
                // Point load at center for simplicity (a = L/2)
                const aPos = a;
                const bPos = L - a;

                if (x <= aPos) {
                    w = (P * bPos * bPos * x * x) / (6 * EI * L * L * L) * (3 * aPos * L - 3 * aPos * x - bPos * x);
                    theta = (P * bPos * bPos * x) / (6 * EI * L * L * L) * (6 * aPos * L - 6 * aPos * x - 2 * bPos * x - 3 * bPos * L + 3 * bPos * x);
                    M = (P * bPos * bPos) / (L * L * L) * (3 * aPos * x - L * x) + (P * aPos * bPos * bPos) / (L * L);
                    V = (P * bPos * bPos) / (L * L * L) * (3 * aPos - L);
                } else {
                    const xR = L - x;
                    w = (P * aPos * aPos * xR * xR) / (6 * EI * L * L * L) * (3 * bPos * L - 3 * bPos * xR - aPos * xR);
                    theta = -(P * aPos * aPos * xR) / (6 * EI * L * L * L) * (6 * bPos * L - 6 * bPos * xR - 2 * aPos * xR - 3 * aPos * L + 3 * aPos * xR);
                    M = (P * aPos * aPos * xR) / (L * L * L) * (3 * bPos - L);
                    V = -(P * aPos * aPos) / (L * L * L) * (3 * bPos - L);
                }
                break;

            case 'distributed':
                // Uniformly distributed load
                w = (q * x * x) / (24 * EI) * (L - x) * (L - x);
                theta = (q * x) / (12 * EI) * (L - x) * (L - 2 * x);
                M = (q / 12) * (6 * L * x - 6 * x * x - L * L);
                V = q * (L / 2 - x);
                break;

            case 'moment':
                // Simplified moment calculation
                w = (M0 * x * x) / (6 * EI * L * L) * (3 * L - 4 * x);
                theta = (M0 * x) / (2 * EI * L * L) * (L - 2 * x);
                M = M0 * (1 - 4 * x / L + 3 * x * x / (L * L));
                V = M0 * 6 / (L * L) * (1 - 2 * x / L);
                break;
        }

        return { w, theta, M, V };
    }

    /**
     * Cantilever Beam
     */
    cantilever(x, L, EI, loadType, P, q, M0, a) {
        let w = 0, theta = 0, M = 0, V = 0;

        switch (loadType) {
            case 'point':
                // Point load at position a (from fixed end)
                if (x <= a) {
                    w = (P * x * x) / (6 * EI) * (3 * a - x);
                    theta = (P * x) / (2 * EI) * (2 * a - x);
                    M = -P * (a - x);
                    V = P;
                } else {
                    w = (P * a * a) / (6 * EI) * (3 * x - a);
                    theta = (P * a * a) / (2 * EI);
                    M = 0;
                    V = 0;
                }
                break;

            case 'distributed':
                // Uniformly distributed load along entire length
                w = (q * x * x) / (24 * EI) * (x * x - 4 * L * x + 6 * L * L);
                theta = (q * x) / (6 * EI) * (x * x - 3 * L * x + 3 * L * L);
                M = -(q / 2) * (L - x) * (L - x);
                V = q * (L - x);
                break;

            case 'moment':
                // Point moment at free end
                w = (M0 * x * x) / (2 * EI);
                theta = (M0 * x) / EI;
                M = -M0;
                V = 0;
                break;
        }

        return { w, theta, M, V };
    }

    /**
     * Calculate stress at a point
     * σ = My/I
     */
    calculateStress(M, y, I) {
        return (M * y) / I;
    }

    /**
     * Get maximum stress (at top/bottom fibers)
     * y = h/2
     */
    getMaxStress(maxMoment, h, I) {
        return Math.abs(maxMoment * (h / 2) / I);
    }
}

// Export for use in other modules
window.BeamCalculator = BeamCalculator;
