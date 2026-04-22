export class SensorStatus {
    private dom: HTMLElement;
    private imuState: 'unavailable' | 'available' | 'active' = 'unavailable';
    private micState: 'unavailable' | 'available' | 'active' = 'unavailable';
    private gamepadState: 'unavailable' | 'available' | 'active' = 'unavailable';

    private isImuActiveIntent = false;
    private isMicActiveIntent = false;
    private isGamepadActiveIntent = false;

    public onToggleImu?: (active: boolean) => void;
    public onToggleMic?: (active: boolean) => void;
    public onToggleGamepad?: (active: boolean) => void;

    constructor() {
        this.dom = document.createElement('div');
        this.dom.id = 'sensor-status-bar';
        this.dom.style.position = 'absolute';
        this.dom.style.right = '85px'; // Stats.js is 80px wide + 5px gap
        this.dom.style.bottom = '0px';
        this.dom.style.display = 'flex';
        this.dom.style.gap = '3px';
        this.dom.style.padding = '0px';
        this.dom.style.background = 'transparent';
        this.dom.style.zIndex = '10000';
        this.dom.style.height = '48px'; // Same as stats.js
        this.dom.style.alignItems = 'flex-end'; // align to bottom

        this.dom.innerHTML = `
            <div id="status-gamepad" class="sensor-indicator" title="Gamepad">GP</div>
            <div id="status-imu" class="sensor-indicator" title="IMU">IMU</div>
            <div id="status-mic" class="sensor-indicator" title="Microphone">MIC</div>
        `;

        document.body.appendChild(this.dom);

        // Inject styles
        const style = document.createElement('style');
        style.textContent = `
            .sensor-indicator {
                font-family: Helvetica, Arial, sans-serif;
                font-size: 10px;
                line-height: 12px;
                padding: 2px 5px;
                font-weight: bold;
                color: #fff;
                height: 16px;
                border-top-left-radius: 3px;
                border-top-right-radius: 3px;
                cursor: pointer;
                user-select: none;
            }
            .sensor-indicator:hover {
                opacity: 0.85;
            }
            .sensor-unavailable {
                background: #555;
                color: #888;
            }
            .sensor-available {
                background: #f6c90e;
                color: #000;
            }
            .sensor-active {
                background: #34d399;
                color: #000;
            }
        `;
        document.head.appendChild(style);

        this.updateDOM();

        document.getElementById('status-gamepad')?.addEventListener('click', () => {
            if (this.gamepadState !== 'unavailable') {
                const nextState = !this.isGamepadActiveIntent;
                this.setGamepadActive(nextState);
                if (this.onToggleGamepad) this.onToggleGamepad(nextState);
            }
        });

        document.getElementById('status-imu')?.addEventListener('click', () => {
            if (this.imuState !== 'unavailable') {
                const nextState = !this.isImuActiveIntent;
                this.setImuActive(nextState);
                if (this.onToggleImu) this.onToggleImu(nextState);
            }
        });

        document.getElementById('status-mic')?.addEventListener('click', () => {
            if (this.micState !== 'unavailable') {
                const nextState = !this.isMicActiveIntent;
                this.setMicActive(nextState);
                if (this.onToggleMic) this.onToggleMic(nextState);
            }
        });

        // Start polling for availability
        setInterval(() => this.pollAvailability(), 500);
    }

    public setVisible(visible: boolean) {
        this.dom.style.display = visible ? 'flex' : 'none';
    }

    public setImuActive(active: boolean) {
        this.isImuActiveIntent = active;
        this.pollAvailability();
    }

    public setMicActive(active: boolean) {
        this.isMicActiveIntent = active;
        this.pollAvailability();
    }

    public setGamepadActive(active: boolean) {
        this.isGamepadActiveIntent = active;
        this.pollAvailability();
    }

    private pollAvailability() {
        // IMU
        const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        let imuAvailable = typeof DeviceMotionEvent !== 'undefined' && isMobile;
        if (imuAvailable) {
            this.imuState = this.isImuActiveIntent ? 'active' : 'available';
        } else {
            this.imuState = 'unavailable';
        }

        // Mic
        let micAvailable = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
        if (micAvailable) {
            this.micState = this.isMicActiveIntent ? 'active' : 'available';
        } else {
            this.micState = 'unavailable';
        }

        // Gamepad
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        const hasGamepad = Array.from(gamepads).some(gp => gp !== null);
        if (hasGamepad) {
            this.gamepadState = this.isGamepadActiveIntent ? 'active' : 'available';
        } else {
            this.gamepadState = 'unavailable';
        }

        this.updateDOM();
    }

    private updateDOM() {
        const setClass = (id: string, state: string, label: string) => {
            const el = document.getElementById(id);
            if (el) {
                el.className = `sensor-indicator sensor-${state}`;
                const stateStr = state.charAt(0).toUpperCase() + state.slice(1);
                el.title = `${label}: ${stateStr}`;
            }
        };

        setClass('status-gamepad', this.gamepadState, 'Gamepad');
        setClass('status-imu', this.imuState, 'IMU');
        setClass('status-mic', this.micState, 'Microphone');
    }
}
