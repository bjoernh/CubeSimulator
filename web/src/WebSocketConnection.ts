import protobuf from 'protobufjs';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ScreenFrameData {
    screenId: number;
    frameData: Uint8Array;
}

export type FrameCallback = (screens: ScreenFrameData[]) => void;
export type StateCallback = (state: ConnectionState) => void;
export type ParamSchemaCallback = (schema: any, appId: number) => void;
export type ParamValuesCallback = (values: any, appId: number) => void;

export class WebSocketConnection {
    private ws: WebSocket | null = null;
    private state: ConnectionState = 'disconnected';
    private frameCallback: FrameCallback | null = null;
    private stateCallback: StateCallback | null = null;
    private paramSchemaCallback: ParamSchemaCallback | null = null;
    private paramValuesCallback: ParamValuesCallback | null = null;
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

    onParamSchema(cb: ParamSchemaCallback): void {
        this.paramSchemaCallback = cb;
    }

    onParamValues(cb: ParamValuesCallback): void {
        this.paramValuesCallback = cb;
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
                // Request server info and active app parameter schema
                if (this.MatrixServerMessage) {
                    try {
                        const message = this.MatrixServerMessage.create({
                            messageType: 2 // matrixserver::getServerInfo
                        });
                        const buffer = this.MatrixServerMessage.encode(message).finish();
                        this.ws!.send(buffer);
                    } catch (e) {
                        console.warn('[WebSocketConnection] Failed to send getServerInfo:', e);
                    }
                }
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
        if (!this.MatrixServerMessage) return;
        try {
            const bytes = new Uint8Array(data);
            const message = this.MatrixServerMessage.decode(bytes) as any;

            if (message.screenData && message.screenData.length > 0 && this.frameCallback) {
                const screens: ScreenFrameData[] = message.screenData.map((sd: any) => ({
                    screenId: sd.screenID,
                    frameData: sd.frameData as Uint8Array,
                }));
                this.frameCallback(screens);
            }

            if (message.messageType === 11 && this.paramSchemaCallback) { // appParamSchema
                this.paramSchemaCallback(message.appParamSchema, message.appId);
            } else if (message.messageType === 14 && this.paramValuesCallback) { // appParamValues
                this.paramValuesCallback(message.appParamValues, message.appId);
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

    sendImuData(accelX: number, accelY: number, accelZ: number): void {
        if (this.state !== 'connected' || !this.ws || !this.MatrixServerMessage) return;

        try {
            const message = this.MatrixServerMessage.create({
                messageType: 9, // imuData enum value
                imuData: {
                    accelX,
                    accelY,
                    accelZ,
                    gyroX: 0,
                    gyroY: 0,
                    gyroZ: 0
                }
            });
            const buffer = this.MatrixServerMessage.encode(message).finish();
            this.ws.send(buffer);
        } catch (e) {
            console.warn('[WebSocketConnection] Failed to encode and send IMU data:', e);
        }
    }

    sendParamUpdate(key: string, value: any, type: string, appId: number): void {
        if (this.state !== 'connected' || !this.ws || !this.MatrixServerMessage) return;

        try {
            const update: any = { key };
            if (type === 'float') update.floatVal = value;
            else if (type === 'int') update.intVal = value;
            else if (type === 'bool') update.boolVal = value;
            else if (type === 'enum') update.stringVal = value;

            const message = this.MatrixServerMessage.create({
                messageType: 12, // setAppParam
                appId,
                appParamUpdate: update
            });
            const buffer = this.MatrixServerMessage.encode(message).finish();
            this.ws.send(buffer);
        } catch (e) {
            console.warn('[WebSocketConnection] Failed to send param update:', e);
        }
    }

    sendGetAppParams(appId: number): void {
        if (this.state !== 'connected' || !this.ws || !this.MatrixServerMessage) return;

        try {
            const message = this.MatrixServerMessage.create({
                messageType: 13, // getAppParams
                appId
            });
            const buffer = this.MatrixServerMessage.encode(message).finish();
            this.ws.send(buffer);
        } catch (e) {
            console.warn('[WebSocketConnection] Failed to send getAppParams:', e);
        }
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
