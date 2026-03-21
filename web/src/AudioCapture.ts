export class AudioCapture {
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
    private dataArray: Uint8Array | null = null;
    private isCapturing = false;
    private previousBands: number[] = new Array(16).fill(0);
    private smoothing = 0.8; // Smoothing factor between 0.0 and 1.0

    constructor() {}

    async start(): Promise<void> {
        if (this.isCapturing) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 1024; // 1024 FFT gives 512 frequency bins (more resolution)
            this.analyser.smoothingTimeConstant = 0.5; // Internal Web Audio smoothing
            
            this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
            this.mediaStreamSource.connect(this.analyser);
            
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            this.isCapturing = true;
        } catch (err) {
            console.error('[AudioCapture] Error accessing microphone', err);
            throw err;
        }
    }

    stop(): void {
        this.isCapturing = false;
        if (this.mediaStreamSource) {
            this.mediaStreamSource.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStreamSource.disconnect();
        }
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
    }

    getAudioData(): { volume: number, frequencyBands: Uint8Array } | null {
        if (!this.isCapturing || !this.analyser || !this.dataArray) return null;

        // @ts-ignore
        this.analyser.getByteFrequencyData(this.dataArray);
        
        const binCount = this.dataArray.length;
        const numBands = 16;
        const bands = new Uint8Array(numBands);
        
        // Calculate raw volume (average of all bins, 0-255)
        let totalVolume = 0;
        for (let i = 0; i < binCount; i++) {
            totalVolume += this.dataArray[i];
        }
        const volume = Math.floor(totalVolume / binCount);

        // Group 512 bins into 16 logarithmic bands
        const logBase = Math.log(binCount);
        let lastBinIndex = 0;

        for (let i = 0; i < numBands; i++) {
            const nextBinIndex = Math.floor(Math.exp(((i + 1) / numBands) * logBase));
            const startIndex = lastBinIndex;
            const endIndex = Math.min(nextBinIndex, binCount);
            
            let sum = 0;
            let count = 0;
            for (let j = startIndex; j < endIndex; j++) {
                sum += this.dataArray[j];
                count++;
            }
            
            let bandValueFloat = count > 0 ? sum / count : 0;
            
            // Apply smoothing in float space for precision, then floor to uint8
            bandValueFloat = this.previousBands[i] * this.smoothing + bandValueFloat * (1 - this.smoothing);
            this.previousBands[i] = bandValueFloat;
            
            bands[i] = Math.floor(bandValueFloat);
            lastBinIndex = endIndex;
        }
        
        return { volume, frequencyBands: bands };
    }

    get isRunning(): boolean {
        return this.isCapturing;
    }
}
