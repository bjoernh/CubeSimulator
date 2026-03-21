export class AudioCapture {
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
    private dataArray: Uint8Array | null = null;
    private isCapturing = false;

    constructor() {}

    async start(): Promise<void> {
        if (this.isCapturing) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 64; // Gives 32 frequency bins
            
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

    getAudioData(): { volume: number, frequencyBands: number[] } | null {
        if (!this.isCapturing || !this.analyser || !this.dataArray) return null;

        // @ts-ignore
        this.analyser.getByteFrequencyData(this.dataArray);
        
        let sum = 0;
        const bands: number[] = [];
        
        // Pass out 32 bands normalized to 0.0 - 1.0
        for (let i = 0; i < this.dataArray.length; i++) {
            const val = this.dataArray[i] / 255.0;
            sum += val;
            bands.push(val);
        }
        
        const volume = sum / this.dataArray.length;
        
        return { volume, frequencyBands: bands };
    }

    get isRunning(): boolean {
        return this.isCapturing;
    }
}
