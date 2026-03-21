import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioCapture } from '../src/AudioCapture';

describe('AudioCapture', () => {
    let audioCapture: AudioCapture;

    beforeEach(() => {
        audioCapture = new AudioCapture();
        
        // Mock navigator.mediaDevices.getUserMedia
        vi.stubGlobal('navigator', {
            mediaDevices: {
                getUserMedia: vi.fn().mockResolvedValue({
                    getTracks: () => [{ stop: vi.fn() }]
                })
            }
        });

        // Mock AudioContext and AnalyserNode
        const mockAnalyser = {
            fftSize: 0,
            smoothingTimeConstant: 0,
            frequencyBinCount: 512,
            getByteFrequencyData: vi.fn((array: Uint8Array) => {
                for (let i = 0; i < array.length; i++) {
                    array[i] = i % 256; // Mock some data
                }
            }),
            connect: vi.fn(),
            disconnect: vi.fn()
        };

        const mockAudioContext = {
            createAnalyser: vi.fn(() => mockAnalyser),
            createMediaStreamSource: vi.fn(() => ({
                connect: vi.fn(),
                disconnect: vi.fn(),
                mediaStream: {
                    getTracks: () => [{ stop: vi.fn() }]
                }
            })),
            close: vi.fn().mockResolvedValue(undefined),
            state: 'running'
        };

        (window as any).AudioContext = vi.fn().mockImplementation(function() {
            return mockAudioContext;
        });
    });

    it('should return 16 logarithmic bands in uint8 format', async () => {
        await audioCapture.start();
        const data = audioCapture.getAudioData();
        
        expect(data).not.toBeNull();
        if (data) {
            expect(data.frequencyBands).toBeInstanceOf(Uint8Array);
            expect(data.frequencyBands).toHaveLength(16);
            expect(data.volume).toBeGreaterThanOrEqual(0);
            expect(data.volume).toBeLessThanOrEqual(255);
            
            data.frequencyBands.forEach(band => {
                expect(band).toBeGreaterThanOrEqual(0);
                expect(band).toBeLessThanOrEqual(255);
                expect(Number.isInteger(band)).toBe(true);
            });
        }
    });

    it('should return null when not capturing', () => {
        const data = audioCapture.getAudioData();
        expect(data).toBeNull();
    });
});
