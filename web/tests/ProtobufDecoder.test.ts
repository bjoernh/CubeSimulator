import { describe, it, expect, beforeAll } from 'vitest';
import protobuf from 'protobufjs';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load and parse the real proto file (runs in Node/jsdom via Vitest)
let root: protobuf.Root;
let MatrixServerMessage: protobuf.Type;

beforeAll(async () => {
    const protoPath = resolve(__dirname, '../src/proto/matrixserver.proto');
    const protoContent = readFileSync(protoPath, 'utf-8');
    root = protobuf.parse(protoContent, { keepCase: false }).root;
    MatrixServerMessage = root.lookupType('matrixserver.MatrixServerMessage');
});

describe('Protobuf matrixserver.proto', () => {
    it('loads and resolves MatrixServerMessage type', () => {
        expect(MatrixServerMessage).toBeDefined();
    });

    it('encodes and decodes a setScreenFrame message with 6 screens', () => {
        const SCREENS = 6;
        const PIXELS = 64 * 64;
        const frameBytes = 3 * PIXELS;

        const payload: Record<string, unknown> = {
            messageType: 4, // setScreenFrame
            screenData: Array.from({ length: SCREENS }, (_, i) => ({
                screenID: i,
                frameData: new Uint8Array(frameBytes).fill(i * 10),
                encoding: 1, // rgb24bbp
            })),
        };

        const err = MatrixServerMessage.verify(payload);
        expect(err).toBeNull();

        const encoded = MatrixServerMessage.encode(MatrixServerMessage.create(payload)).finish();
        expect(encoded.length).toBeGreaterThan(0);

        const decoded = MatrixServerMessage.decode(encoded) as any;
        expect(decoded.messageType).toBe(4);
        expect(decoded.screenData.length).toBe(SCREENS);

        for (let i = 0; i < SCREENS; i++) {
            expect(decoded.screenData[i].screenID).toBe(i);
            expect(decoded.screenData[i].frameData.length).toBe(frameBytes);
            // Spot-check the fill value
            expect(decoded.screenData[i].frameData[0]).toBe(i * 10);
        }
    });

    it('decodes a message with no screenData gracefully', () => {
        const payload = { messageType: 1 }; // registerApp
        const encoded = MatrixServerMessage.encode(MatrixServerMessage.create(payload)).finish();
        const decoded = MatrixServerMessage.decode(encoded) as any;
        expect(decoded.messageType).toBe(1);
        expect(decoded.screenData).toEqual([]);
    });

    it('roundtrips ServerConfig fields (simulatorAddress, simulatorPort)', () => {
        const ServerConfig = root.lookupType('matrixserver.ServerConfig');
        const payload = {
            serverName: 'test-server',
            simulatorAddress: '192.168.1.42',
            simulatorPort: '1337',
            globalScreenBrightness: 80,
        };
        const encoded = ServerConfig.encode(ServerConfig.create(payload)).finish();
        const decoded = ServerConfig.decode(encoded) as any;
        expect(decoded.simulatorAddress).toBe('192.168.1.42');
        expect(decoded.simulatorPort).toBe('1337');
        expect(decoded.globalScreenBrightness).toBe(80);
    });

    it('decodes partial/minimum message without throwing', () => {
        // Just a single byte (varint tag for messageType=defaultMessageType)
        const minimal = Uint8Array.from([0x08, 0x00]);
        expect(() => MatrixServerMessage.decode(minimal)).not.toThrow();
    });

    it('frameData survives encode/decode as raw bytes (binary safe)', () => {
        // All 256 byte values should survive the roundtrip
        const frameData = new Uint8Array(256);
        for (let i = 0; i < 256; i++) frameData[i] = i;

        const payload = {
            messageType: 4,
            screenData: [{ screenID: 0, frameData, encoding: 1 }],
        };
        const encoded = MatrixServerMessage.encode(MatrixServerMessage.create(payload)).finish();
        const decoded = MatrixServerMessage.decode(encoded) as any;
        const roundTripped = decoded.screenData[0].frameData as Uint8Array;
        for (let i = 0; i < 256; i++) {
            expect(roundTripped[i]).toBe(i);
        }
    });
});
