import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketConnection, ConnectionState } from '../src/WebSocketConnection';

// ── Mock WebSocket ─────────────────────────────────────────────────────────────
class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    binaryType: string = 'arraybuffer';
    readyState: number = MockWebSocket.CONNECTING;
    url: string;

    onopen: ((ev: Event) => void) | null = null;
    onmessage: ((ev: MessageEvent) => void) | null = null;
    onclose: ((ev: CloseEvent) => void) | null = null;
    onerror: ((ev: Event) => void) | null = null;

    constructor(url: string) {
        this.url = url;
        MockWebSocket.instances.push(this);
    }

    close() {
        this.readyState = MockWebSocket.CLOSED;
    }

    send(_data: unknown) { }

    // ── Helper methods called from tests ──
    simulateOpen() {
        this.readyState = MockWebSocket.OPEN;
        this.onopen?.(new Event('open'));
    }

    simulateMessage(data: ArrayBuffer) {
        const event = new MessageEvent('message', { data });
        this.onmessage?.(event);
    }

    simulateClose() {
        this.readyState = MockWebSocket.CLOSED;
        this.onclose?.(new CloseEvent('close'));
    }

    simulateError() {
        this.onerror?.(new Event('error'));
    }

    static instances: MockWebSocket[] = [];
    static reset() { MockWebSocket.instances = []; }
}

// ── Helper: build a minimal raw protobuf MatrixServerMessage with screen data ──
function buildScreenFrameMessage(screenId: number, rgbData: Uint8Array): ArrayBuffer {
    // Manually encode a MatrixServerMessage with:
    //   field 1 (messageType) = 4 (setScreenFrame)
    //   field 4 (screenData, repeated ScreenData)
    //     field 1 (screenID) = screenId
    //     field 2 (frameData) = rgbData
    //
    // Protobuf binary encoding (manual):
    //   varint field 1, wire 0 → 0x08, value 4 → 0x04
    //   message field 4, wire 2 → 0x22, then length-prefixed ScreenData:
    //     varint field 1, wire 0 → 0x08, screenId
    //     bytes  field 2, wire 2 → 0x12, length, ...data

    const screenIdByte = screenId & 0x7f; // single-byte varint, screenId < 128
    const frameLen = rgbData.length;

    // ScreenData inner message
    const innerParts: number[] = [
        0x08, screenIdByte,           // field 1 = screenID
        0x12, frameLen, ...Array.from(rgbData),  // field 2 = frameData
    ];
    const innerLen = innerParts.length;

    const outer: number[] = [
        0x08, 0x04,                   // field 1 = messageType = 4 (setScreenFrame)
        0x22, innerLen, ...innerParts // field 4 = screenData (message)
    ];

    return new Uint8Array(outer).buffer;
}

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('WebSocketConnection', () => {
    let connection: WebSocketConnection;

    beforeEach(() => {
        MockWebSocket.reset();
        vi.stubGlobal('WebSocket', MockWebSocket);
        connection = new WebSocketConnection();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllTimers();
    });

    // ── State machine ────────────────────────────────────────────────────────────

    it('starts in disconnected state', () => {
        expect(connection.getState()).toBe<ConnectionState>('disconnected');
    });

    it('transitions to "connecting" immediately after connect()', () => {
        connection.connect('ws://localhost:1337');
        expect(connection.getState()).toBe<ConnectionState>('connecting');
    });

    it('transitions to "connected" when WebSocket fires onopen', () => {
        connection.connect('ws://localhost:1337');
        MockWebSocket.instances[0].simulateOpen();
        expect(connection.getState()).toBe<ConnectionState>('connected');
    });

    it('transitions to "disconnected" when WebSocket fires onclose', () => {
        connection.connect('ws://localhost:1337');
        MockWebSocket.instances[0].simulateOpen();
        MockWebSocket.instances[0].simulateClose();
        expect(connection.getState()).toBe<ConnectionState>('disconnected');
    });

    it('transitions to "error" when WebSocket fires onerror', () => {
        connection.connect('ws://localhost:1337');
        MockWebSocket.instances[0].simulateError();
        expect(connection.getState()).toBe<ConnectionState>('error');
    });

    it('notifies state callback on every transition', () => {
        const states: ConnectionState[] = [];
        connection.onStateChange(s => states.push(s));
        connection.connect('ws://localhost:1337');
        MockWebSocket.instances[0].simulateOpen();
        MockWebSocket.instances[0].simulateClose();
        expect(states).toEqual(['connecting', 'connected', 'disconnected']);
    });

    // ── Manual disconnect ────────────────────────────────────────────────────────

    it('returns to "disconnected" after manual disconnect()', () => {
        connection.connect('ws://localhost:1337');
        MockWebSocket.instances[0].simulateOpen();
        connection.disconnect();
        expect(connection.getState()).toBe<ConnectionState>('disconnected');
    });

    it('does not auto-reconnect after manual disconnect()', () => {
        vi.useFakeTimers();
        const states: ConnectionState[] = [];
        connection.onStateChange(s => states.push(s));
        connection.connect('ws://localhost:1337');
        MockWebSocket.instances[0].simulateOpen();
        connection.disconnect();
        const instanceCountAfterDisconnect = MockWebSocket.instances.length;
        vi.advanceTimersByTime(10000);
        expect(MockWebSocket.instances.length).toBe(instanceCountAfterDisconnect);
        vi.useRealTimers();
    });

    // ── Message decoding ─────────────────────────────────────────────────────────

    it('calls frameCallback with decoded screen data', async () => {
        // Note: loadProto is mocked below — we call _handleMessage indirectly
        // by patching the internal decoder to verify callback integration.
        // Full decode is tested in ProtobufDecoder.test.ts.
        // Here we verify the plumbing: message → callback fires.

        // Stub loadProto to inject a simple decoder
        const receivedFrames: Array<{ screenId: number; frameData: Uint8Array }> = [];
        connection.onFrame(screens => receivedFrames.push(...screens));

        // Inject a mock MatrixServerMessage type
        (connection as any).MatrixServerMessage = {
            decode: (_bytes: Uint8Array) => ({
                screenData: [{ screenID: 0, frameData: new Uint8Array([255, 0, 0]) }],
            }),
        };

        connection.connect('ws://localhost:1337');
        MockWebSocket.instances[0].simulateOpen();
        MockWebSocket.instances[0].simulateMessage(new ArrayBuffer(4)); // content irrelevant since decode is mocked

        expect(receivedFrames.length).toBe(1);
        expect(receivedFrames[0].screenId).toBe(0);
        expect(receivedFrames[0].frameData).toEqual(new Uint8Array([255, 0, 0]));
    });

    it('does not throw if message cannot be decoded', () => {
        (connection as any).MatrixServerMessage = {
            decode: () => { throw new Error('bad proto'); },
        };
        (connection as any).frameCallback = vi.fn();

        connection.connect('ws://localhost:1337');
        MockWebSocket.instances[0].simulateOpen();

        expect(() => {
            MockWebSocket.instances[0].simulateMessage(new ArrayBuffer(4));
        }).not.toThrow();
    });

    it('does not fire frameCallback when screenData is empty', () => {
        const cb = vi.fn();
        connection.onFrame(cb);
        (connection as any).MatrixServerMessage = {
            decode: () => ({ screenData: [] }),
        };

        connection.connect('ws://localhost:1337');
        MockWebSocket.instances[0].simulateOpen();
        MockWebSocket.instances[0].simulateMessage(new ArrayBuffer(4));
        expect(cb).not.toHaveBeenCalled();
    });

    // ── binaryType ───────────────────────────────────────────────────────────────

    it('sets ws.binaryType to "arraybuffer"', () => {
        connection.connect('ws://localhost:1337');
        expect(MockWebSocket.instances[0].binaryType).toBe('arraybuffer');
    });
    // ── IMU transmission ─────────────────────────────────────────────────────────

    it('sends encoded IMU data when connected', () => {
        // Stub the protobuf encoder
        const mockEncodeFinish = vi.fn().mockReturnValue(new Uint8Array([1, 2, 3]));
        const mockCreate = vi.fn().mockImplementation((payload) => payload);
        (connection as any).MatrixServerMessage = {
            create: mockCreate,
            encode: () => ({ finish: mockEncodeFinish }),
        };

        connection.connect('ws://localhost:1337');
        MockWebSocket.instances[0].simulateOpen();

        const sendSpy = vi.spyOn(MockWebSocket.instances[0], 'send');

        connection.sendImuData(0.5, -9.8, 1.2);

        expect(mockCreate).toHaveBeenCalledWith({
            messageType: 9, // imuData
            imuData: {
                accelX: 0.5,
                accelY: -9.8,
                accelZ: 1.2,
                gyroX: 0,
                gyroY: 0,
                gyroZ: 0
            }
        });
        expect(sendSpy).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
    });

    it('does not send IMU data if disconnected', () => {
        const sendSpy = vi.fn();
        MockWebSocket.prototype.send = sendSpy;

        // Missing MatrixServerMessage and not connected
        connection.sendImuData(1, 2, 3);
        expect(sendSpy).not.toHaveBeenCalled();
    });
});
