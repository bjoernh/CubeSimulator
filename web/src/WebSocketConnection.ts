import protobuf from 'protobufjs';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ScreenFrameData {
    screenId: number;
    frameData: Uint8Array;
}

export type FrameCallback = (screens: ScreenFrameData[]) => void;
export type StateCallback = (state: ConnectionState) => void;

export class WebSocketConnection {
    private ws: WebSocket | null = null;
    private state: ConnectionState = 'disconnected';
    private frameCallback: FrameCallback | null = null;
    private stateCallback: StateCallback | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectDelay = 3000;
    private url: string = '';

    private MatrixServerMessage: protobuf.Type | null = null;

    constructor() { }

    async loadProto(protoUrl: string): Promise<void> {
        const root = await protobuf.load(protoUrl);
        this.MatrixServerMessage = root.lookupType('matrixserver.MatrixServerMessage');
    }

    onFrame(cb: FrameCallback): void {
        this.frameCallback = cb;
    }

    onStateChange(cb: StateCallback): void {
        this.stateCallback = cb;
    }

    connect(url: string): void {
        if (this.state === 'connecting' || this.state === 'connected') {
            this.disconnect();
        }
        this.url = url;
        this._connect();
    }

    private _connect(): void {
        this._setState('connecting');
        try {
            this.ws = new WebSocket(this.url);
            this.ws.binaryType = 'arraybuffer';

            this.ws.onopen = () => {
                this._setState('connected');
            };

            this.ws.onmessage = (event: MessageEvent) => {
                this._handleMessage(event.data as ArrayBuffer);
            };

            this.ws.onclose = () => {
                this._setState('disconnected');
                this._scheduleReconnect();
            };

            this.ws.onerror = () => {
                this._setState('error');
            };
        } catch (e) {
            this._setState('error');
        }
    }

    private _handleMessage(data: ArrayBuffer): void {
        if (!this.MatrixServerMessage || !this.frameCallback) return;
        try {
            const bytes = new Uint8Array(data);
            const message = this.MatrixServerMessage.decode(bytes) as any;

            if (message.screenData && message.screenData.length > 0) {
                const screens: ScreenFrameData[] = message.screenData.map((sd: any) => ({
                    screenId: sd.screenID,
                    frameData: sd.frameData as Uint8Array,
                }));
                this.frameCallback(screens);
            }
        } catch (e) {
            console.warn('[WebSocketConnection] Failed to decode protobuf message:', e);
        }
    }

    private _scheduleReconnect(): void {
        if (this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (this.url && this.state !== 'connected') {
                this._connect();
            }
        }, this.reconnectDelay);
    }

    disconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.onclose = null;
            this.ws.onerror = null;
            this.ws.close();
            this.ws = null;
        }
        this._setState('disconnected');
        this.url = '';
    }

    private _setState(state: ConnectionState): void {
        this.state = state;
        if (this.stateCallback) {
            this.stateCallback(state);
        }
    }

    getState(): ConnectionState {
        return this.state;
    }
}
