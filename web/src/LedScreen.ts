import * as THREE from 'three';

export class LedScreen {
    pixelHeight: number;
    pixelWidth: number;
    height: number;
    width: number;
    size: number;
    /** Internal RGBA buffer (4 bytes/pixel). Alpha is always 255. */
    data: Uint8Array;
    texture: THREE.DataTexture;
    mesh: THREE.Mesh;
    geometry: THREE.PlaneGeometry;
    material: THREE.MeshBasicMaterial;

    constructor(pixelHeight: number, pixelWidth: number, geometry: THREE.PlaneGeometry) {
        this.pixelHeight = pixelHeight;
        this.pixelWidth = pixelWidth;
        this.size = pixelHeight * pixelWidth;
        // Three.js r152+ dropped RGBFormat — use RGBAFormat with 4 bytes/pixel.
        this.data = new Uint8Array(4 * this.size);
        // Pre-fill alpha channel to fully opaque.
        for (let i = 3; i < this.data.length; i += 4) this.data[i] = 255;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.texture = new THREE.DataTexture(this.data as any, pixelWidth, pixelHeight, THREE.RGBAFormat);
        this.geometry = geometry;
        this.width = geometry.parameters.width;
        this.height = geometry.parameters.height;
        this.material = new THREE.MeshBasicMaterial({ map: this.texture });
        this.mesh = new THREE.Mesh(this.geometry, this.material);
    }

    /**
     * Copy incoming RGB24 frame data (3 bytes/pixel, as sent by matrixserver)
     * into the internal RGBA buffer.
     */
    setFrameData(rgb24: Uint8Array): void {
        for (let i = 0; i < this.size; i++) {
            this.data[i * 4] = rgb24[i * 3];
            this.data[i * 4 + 1] = rgb24[i * 3 + 1];
            this.data[i * 4 + 2] = rgb24[i * 3 + 2];
            // Alpha is already 255, leave it.
        }
        this.invalidate();
    }

    fillTextureRandom(rBase: number, gBase: number, bBase: number): void {
        for (let i = 0; i < this.size; i++) {
            const stride = i * 4;
            this.data[stride] = rBase * Math.random();
            this.data[stride + 1] = gBase * Math.random();
            this.data[stride + 2] = bBase * Math.random();
        }
        this.invalidate();
    }

    invalidate(): void {
        this.texture.needsUpdate = true;
    }

    drawText(text: string, color: string = 'white', bgColor: string = 'black', rotation: number = Math.PI / 2): void {
        const canvas = document.createElement('canvas');
        canvas.width = this.pixelWidth;
        canvas.height = this.pixelHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Background
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // DataTexture reads bottom-up so flip Y
        ctx.scale(1, -1);
        ctx.translate(0, -canvas.height);

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(rotation);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);

        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 9px Arial';

        const words = text.split(' ');
        const lineHeight = 12;
        const startY = (canvas.height - (words.length * lineHeight)) / 2 + (lineHeight / 2);
        
        for(let i = 0; i < words.length; i++) {
            ctx.fillText(words[i], canvas.width / 2, startY + i * lineHeight);
        }

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < this.size; i++) {
            this.data[i * 4] = imgData.data[i * 4];
            this.data[i * 4 + 1] = imgData.data[i * 4 + 1];
            this.data[i * 4 + 2] = imgData.data[i * 4 + 2];
        }
        this.invalidate();
    }
}
