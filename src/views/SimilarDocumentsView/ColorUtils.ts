import { EventEmitter } from 'events';

export class ColorUtils extends EventEmitter {
    private startColor: [number, number, number];
    private endColor: [number, number, number];

    constructor(gradientSettings: { startColor: string, endColor: string }) {
        super();
        this.updateColors(gradientSettings);
    }

    updateColors(gradientSettings: { startColor: string, endColor: string }) {
        console.log("ColorUtils: updateColors called with", gradientSettings);
        this.startColor = this.hexToHSV(gradientSettings.startColor);
        this.endColor = this.hexToHSV(gradientSettings.endColor);
        console.log("New startColor (HSV):", this.startColor);
        console.log("New endColor (HSV):", this.endColor);
        this.emit('colorsUpdated');
    }

    getInterpolatedColor(similarity: number): string {
        // Ensure similarity is between 0 and 1
        similarity = Math.max(0, Math.min(1, similarity));

        // Interpolate each HSV component
        let h1 = this.startColor[0];
        let h2 = this.endColor[0];

        // Adjust hue interpolation to take the shortest path
        const hueDiff = h2 - h1;
        if (Math.abs(hueDiff) > 180) {
            if (h2 > h1) {
                h1 += 360;
            } else {
                h2 += 360;
            }
        }

        const h = (h1 + (h2 - h1) * similarity) % 360;
        const s = this.startColor[1] + (this.endColor[1] - this.startColor[1]) * similarity;
        const v = this.startColor[2] + (this.endColor[2] - this.startColor[2]) * similarity;

        console.log("ColorUtils: getInterpolatedColor called with similarity:", similarity);
        const hex = this.hsvToHex(h, s, v);

        // Convert the interpolated HSV color back to hex
        return hex
    }

    getCurrentGradient(): { startColor: string, endColor: string } {
        return {
            startColor: this.hsvToHex(...this.startColor),
            endColor: this.hsvToHex(...this.endColor)
        };
    }

    private hsvToHex(h: number, s: number, v: number): string {
        h /= 360;
        s /= 100;
        v /= 100;
        let r: number, g: number, b: number;

        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);

        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
            default: r = 0, g = 0, b = 0; // Add a default case
        }

        const toHex = (x: number) => {
            const hex = Math.round(x * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };

        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    private hexToHSV(hex: string): [number, number, number] {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, v = max;

        const d = max - min;
        s = max === 0 ? 0 : d / max;

        if (max === min) {
            h = 0;
        } else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h = h || 0
            h /= 6;
        }

        return [h * 360, s * 100, v * 100];
    }
}
