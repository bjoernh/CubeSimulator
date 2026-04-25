import type { JoystickData } from './GamepadCapture';

const BOUND_KEYS = new Set<string>([
    'KeyW', 'KeyA', 'KeyS', 'KeyD',
    'KeyI', 'KeyJ', 'KeyK', 'KeyL',
    'KeyQ', 'KeyE',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Space', 'ShiftLeft',
    'Enter', 'Tab',
    'Digit1', 'Digit2', 'Digit3', 'Digit4',
]);

function zeroedState(): JoystickData {
    return {
        joystickID: 0,
        axisX: 0, axisY: 0,
        buttonA: false, buttonB: false, buttonX: false, buttonY: false,
        buttonR: false, buttonL: false,
        buttonStart: false, buttonSelect: false,
        rightAxisX: 0, rightAxisY: 0,
        rightTrigger: 0, leftTrigger: 0,
        rightStickButton: false, leftStickButton: false,
        buttonDpadUp: false, buttonDpadLeft: false,
        buttonDpadDown: false, buttonDpadRight: false,
    };
}

export class KeyboardCapture {
    private pressed: Set<string> = new Set();
    private lastState: JoystickData | null = null;
    private active = false;

    private onKeyDown = (e: KeyboardEvent) => this.handleKey(e, true);
    private onKeyUp = (e: KeyboardEvent) => this.handleKey(e, false);
    private onBlur = () => this.pressed.clear();

    public start(): void {
        if (this.active) return;
        this.active = true;
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        window.addEventListener('blur', this.onBlur);
        console.log('[KeyboardCapture] Started');
    }

    public stop(): void {
        if (!this.active) return;
        this.active = false;
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        window.removeEventListener('blur', this.onBlur);
        this.pressed.clear();
        console.log('[KeyboardCapture] Stopped');
    }

    public isActive(): boolean {
        return this.active;
    }

    public getChanges(): JoystickData[] {
        if (!this.active && !this.lastState) return [];

        const current = this.active ? this.buildState() : zeroedState();

        if (!this.lastState || this.hasStateChanged(this.lastState, current)) {
            this.lastState = current;
            if (!this.active) {
                // Emitted one final zeroed frame after stop; clear so we don't keep emitting.
                this.lastState = null;
            }
            return [current];
        }
        return [];
    }

    private handleKey(e: KeyboardEvent, down: boolean): void {
        if (this.isFocusInEditable()) return;
        if (!BOUND_KEYS.has(e.code)) return;

        e.preventDefault();
        if (down) this.pressed.add(e.code);
        else      this.pressed.delete(e.code);
    }

    private isFocusInEditable(): boolean {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return false;
        const tag = el.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable === true;
    }

    private buildState(): JoystickData {
        const held = (code: string) => this.pressed.has(code);

        let axisX = 0;
        if (held('KeyA')) axisX -= 1;
        if (held('KeyD')) axisX += 1;

        let axisY = 0;
        if (held('KeyW')) axisY -= 1;
        if (held('KeyS')) axisY += 1;

        let rightAxisX = 0;
        if (held('KeyJ')) rightAxisX -= 1;
        if (held('KeyL')) rightAxisX += 1;

        let rightAxisY = 0;
        if (held('KeyI')) rightAxisY -= 1;
        if (held('KeyK')) rightAxisY += 1;

        return {
            joystickID: 0,
            axisX, axisY,
            rightAxisX, rightAxisY,
            buttonA: held('Space'),
            buttonB: held('ShiftLeft'),
            buttonX: held('KeyE'),
            buttonY: held('KeyQ'),
            buttonL: held('Digit1'),
            buttonR: held('Digit3'),
            leftTrigger: held('Digit2') ? 1 : 0,
            rightTrigger: held('Digit4') ? 1 : 0,
            buttonStart: held('Enter'),
            buttonSelect: held('Tab'),
            buttonDpadUp: held('ArrowUp'),
            buttonDpadDown: held('ArrowDown'),
            buttonDpadLeft: held('ArrowLeft'),
            buttonDpadRight: held('ArrowRight'),
            leftStickButton: false,
            rightStickButton: false,
        };
    }

    private hasStateChanged(s1: JoystickData, s2: JoystickData): boolean {
        return (
            s1.axisX !== s2.axisX ||
            s1.axisY !== s2.axisY ||
            s1.buttonA !== s2.buttonA ||
            s1.buttonB !== s2.buttonB ||
            s1.buttonX !== s2.buttonX ||
            s1.buttonY !== s2.buttonY ||
            s1.buttonR !== s2.buttonR ||
            s1.buttonL !== s2.buttonL ||
            s1.buttonStart !== s2.buttonStart ||
            s1.buttonSelect !== s2.buttonSelect ||
            s1.rightAxisX !== s2.rightAxisX ||
            s1.rightAxisY !== s2.rightAxisY ||
            s1.rightTrigger !== s2.rightTrigger ||
            s1.leftTrigger !== s2.leftTrigger ||
            s1.rightStickButton !== s2.rightStickButton ||
            s1.leftStickButton !== s2.leftStickButton ||
            s1.buttonDpadUp !== s2.buttonDpadUp ||
            s1.buttonDpadLeft !== s2.buttonDpadLeft ||
            s1.buttonDpadDown !== s2.buttonDpadDown ||
            s1.buttonDpadRight !== s2.buttonDpadRight
        );
    }
}
