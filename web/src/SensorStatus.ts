export class SensorStatus {
    private dom: HTMLElement;
    private imuState: 'unavailable' | 'available' | 'active' = 'unavailable';
    private micState: 'unavailable' | 'available' | 'active' = 'unavailable';
    private gamepadState: 'unavailable' | 'available' | 'active' = 'unavailable';
    private kbState: 'unavailable' | 'available' | 'active' = 'unavailable';

    private isImuActiveIntent = false;
    private isMicActiveIntent = false;
    private isGamepadActiveIntent = false;
    private isKbActiveIntent = false;

    public onToggleImu?: (active: boolean) => void;
    public onToggleMic?: (active: boolean) => void;
    public onToggleGamepad?: (active: boolean) => void;
    public onToggleKb?: (active: boolean) => void;

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
            <div id="status-kb" class="sensor-indicator" title="Keyboard (right-click for key map)">KB</div>
            <div id="status-imu" class="sensor-indicator" title="IMU">IMU</div>
            <div id="status-mic" class="sensor-indicator" title="Microphone">MIC</div>
        `;

        document.body.appendChild(this.dom);
        this.injectStyles();
        this.buildModal();
        this.updateDOM();

        document.getElementById('status-gamepad')?.addEventListener('click', () => {
            if (this.gamepadState !== 'unavailable') {
                const nextState = !this.isGamepadActiveIntent;
                this.setGamepadActive(nextState);
                if (this.onToggleGamepad) this.onToggleGamepad(nextState);
            }
        });

        document.getElementById('status-kb')?.addEventListener('click', () => {
            if (this.kbState !== 'unavailable') {
                const nextState = !this.isKbActiveIntent;
                this.setKbActive(nextState);
                if (this.onToggleKb) this.onToggleKb(nextState);
            }
        });

        document.getElementById('status-kb')?.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showKeyMapModal();
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

    public setKbActive(active: boolean) {
        this.isKbActiveIntent = active;
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

        // Keyboard: unavailable on touch-only mobile devices
        if (isMobile) {
            this.kbState = 'unavailable';
        } else {
            this.kbState = this.isKbActiveIntent ? 'active' : 'available';
        }

        this.updateDOM();
    }

    private updateDOM() {
        const setClass = (id: string, state: string, label: string, extra = '') => {
            const el = document.getElementById(id);
            if (el) {
                el.className = `sensor-indicator sensor-${state}`;
                const stateStr = state.charAt(0).toUpperCase() + state.slice(1);
                el.title = `${label}: ${stateStr}${extra}`;
            }
        };

        setClass('status-gamepad', this.gamepadState, 'Gamepad');
        setClass('status-kb', this.kbState, 'Keyboard', ' (right-click for key map)');
        setClass('status-imu', this.imuState, 'IMU');
        setClass('status-mic', this.micState, 'Microphone');
    }

    // ── Key-map modal ──────────────────────────────────────────────────────────

    private buildModal() {
        const overlay = document.createElement('div');
        overlay.id = 'kb-modal-overlay';

        overlay.innerHTML = `
<div id="kb-modal">
  <div id="kb-modal-header">
    <span>Keyboard Controls</span>
    <button id="kb-modal-close" aria-label="Close">✕</button>
  </div>
  <div id="kb-modal-body">

    <div class="kb-section-row">
      <div class="kb-section">
        <div class="kb-section-title">Left Stick</div>
        <div class="kb-dpad">
          <div class="kb-dpad-row"><span class="kb-key">W</span></div>
          <div class="kb-dpad-row"><span class="kb-key">A</span><span class="kb-key kb-key-center">·</span><span class="kb-key">D</span></div>
          <div class="kb-dpad-row"><span class="kb-key">S</span></div>
        </div>
      </div>

      <div class="kb-section">
        <div class="kb-section-title">Right Stick</div>
        <div class="kb-dpad">
          <div class="kb-dpad-row"><span class="kb-key">I</span></div>
          <div class="kb-dpad-row"><span class="kb-key">J</span><span class="kb-key kb-key-center">·</span><span class="kb-key">L</span></div>
          <div class="kb-dpad-row"><span class="kb-key">K</span></div>
        </div>
      </div>

      <div class="kb-section">
        <div class="kb-section-title">D-Pad</div>
        <div class="kb-dpad">
          <div class="kb-dpad-row"><span class="kb-key">↑</span></div>
          <div class="kb-dpad-row"><span class="kb-key">←</span><span class="kb-key kb-key-center">·</span><span class="kb-key">→</span></div>
          <div class="kb-dpad-row"><span class="kb-key">↓</span></div>
        </div>
      </div>

      <div class="kb-section">
        <div class="kb-section-title">Face Buttons</div>
        <div class="kb-face">
          <div class="kb-face-row">
            <div class="kb-face-btn"><span class="kb-key">Q</span><span class="kb-btn-label">Y</span></div>
            <div class="kb-face-btn"><span class="kb-key">E</span><span class="kb-btn-label">X</span></div>
          </div>
          <div class="kb-face-row">
            <div class="kb-face-btn"><span class="kb-key kb-key-wide">⇧ Shift</span><span class="kb-btn-label">B</span></div>
            <div class="kb-face-btn"><span class="kb-key kb-key-wide">Space</span><span class="kb-btn-label">A</span></div>
          </div>
        </div>
      </div>
    </div>

    <div class="kb-divider"></div>

    <div class="kb-section-row kb-section-row-bottom">
      <div class="kb-row-item"><span class="kb-key">1</span><span class="kb-row-label">L Bumper</span></div>
      <div class="kb-row-item"><span class="kb-key">2</span><span class="kb-row-label">L Trigger</span></div>
      <div class="kb-row-item"><span class="kb-key">3</span><span class="kb-row-label">R Bumper</span></div>
      <div class="kb-row-item"><span class="kb-key">4</span><span class="kb-row-label">R Trigger</span></div>
      <div class="kb-row-item"><span class="kb-key kb-key-wide">Enter</span><span class="kb-row-label">Start</span></div>
      <div class="kb-row-item"><span class="kb-key kb-key-wide">Tab</span><span class="kb-row-label">Select</span></div>
    </div>

  </div>
</div>`;

        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.hideKeyMapModal();
        });

        document.getElementById('kb-modal-close')?.addEventListener('click', () => {
            this.hideKeyMapModal();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.style.display !== 'none' && overlay.style.display !== '') {
                this.hideKeyMapModal();
            }
        });
    }

    private showKeyMapModal() {
        const overlay = document.getElementById('kb-modal-overlay');
        if (overlay) overlay.style.display = 'flex';
    }

    private hideKeyMapModal() {
        const overlay = document.getElementById('kb-modal-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    // ── Styles ─────────────────────────────────────────────────────────────────

    private injectStyles() {
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

            /* ── Key-map modal ── */
            #kb-modal-overlay {
                display: none;
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.65);
                z-index: 20000;
                align-items: center;
                justify-content: center;
            }
            #kb-modal {
                background: #1e232d;
                border: 1px solid #3a3f4b;
                border-radius: 8px;
                width: min(640px, 95vw);
                box-shadow: 0 8px 32px rgba(0,0,0,0.6);
                font-family: Helvetica, Arial, sans-serif;
                color: #e0e4ef;
            }
            #kb-modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 16px 10px;
                border-bottom: 1px solid #3a3f4b;
                font-size: 14px;
                font-weight: bold;
                letter-spacing: 0.05em;
                color: #c8cdd8;
            }
            #kb-modal-close {
                background: none;
                border: none;
                color: #888;
                cursor: pointer;
                font-size: 14px;
                padding: 2px 6px;
                border-radius: 4px;
                line-height: 1;
            }
            #kb-modal-close:hover {
                background: #3a3f4b;
                color: #e0e4ef;
            }
            #kb-modal-body {
                padding: 16px;
            }
            .kb-section-row {
                display: flex;
                gap: 12px;
                align-items: flex-start;
                flex-wrap: wrap;
            }
            .kb-section-row-bottom {
                align-items: center;
                justify-content: center;
            }
            .kb-section {
                display: flex;
                flex-direction: column;
                align-items: center;
                flex: 1;
                min-width: 90px;
            }
            .kb-section-title {
                font-size: 9px;
                font-weight: bold;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: #6b7280;
                margin-bottom: 8px;
            }
            .kb-dpad {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 3px;
            }
            .kb-dpad-row {
                display: flex;
                gap: 3px;
                align-items: center;
            }
            .kb-key {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 26px;
                height: 24px;
                padding: 0 5px;
                background: #2a303c;
                border: 1px solid #4a5060;
                border-bottom: 3px solid #383e4e;
                border-radius: 4px;
                font-size: 11px;
                font-weight: bold;
                color: #c8cdd8;
                box-sizing: border-box;
            }
            .kb-key-center {
                background: transparent;
                border-color: transparent;
                border-bottom-color: transparent;
                color: #3a3f4b;
                min-width: 10px;
            }
            .kb-key-wide {
                min-width: 52px;
            }
            .kb-face {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .kb-face-row {
                display: flex;
                gap: 6px;
                justify-content: center;
            }
            .kb-face-btn {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 3px;
            }
            .kb-btn-label {
                font-size: 9px;
                font-weight: bold;
                color: #6b7280;
                letter-spacing: 0.05em;
            }
            .kb-divider {
                height: 1px;
                background: #2e3340;
                margin: 14px 0;
            }
            .kb-row-item {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
            }
            .kb-row-label {
                font-size: 9px;
                color: #6b7280;
                white-space: nowrap;
            }
        `;
        document.head.appendChild(style);
    }
}
