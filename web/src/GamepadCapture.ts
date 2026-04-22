export interface JoystickData {
    joystickID: number;
    axisX: number;
    axisY: number;
    buttonA: boolean;
    buttonB: boolean;
    buttonX: boolean;
    buttonY: boolean;
    buttonR: boolean;
    buttonL: boolean;
    buttonStart: boolean;
    buttonSelect: boolean;
    rightAxisX: number;
    rightAxisY: number;
    rightTrigger: number;
    leftTrigger: number;
    rightStickButton: boolean;
    leftStickButton: boolean;
    buttonDpadUp: boolean;
    buttonDpadLeft: boolean;
    buttonDpadDown: boolean;
    buttonDpadRight: boolean;
}

export class GamepadCapture {
    private lastStates: Map<number, JoystickData> = new Map();
    private browserToVirtualId: Map<number, number> = new Map();
    private deadzone = 0.05;

    constructor() {
        window.addEventListener("gamepadconnected", (e) => {
            // Assign the next available virtual ID (0, 1, 2...)
            let virtualId = 0;
            const assignedIds = Array.from(this.browserToVirtualId.values());
            while (assignedIds.includes(virtualId)) {
                virtualId++;
            }
            this.browserToVirtualId.set(e.gamepad.index, virtualId);

            console.log("[GamepadCapture] Gamepad connected at index %d: %s. Virtual ID: %d. %d buttons, %d axes. Mapping: %s",
                e.gamepad.index, e.gamepad.id, virtualId,
                e.gamepad.buttons.length, e.gamepad.axes.length, e.gamepad.mapping);
        });

        window.addEventListener("gamepaddisconnected", (e) => {
            const virtualId = this.browserToVirtualId.get(e.gamepad.index);
            console.log("[GamepadCapture] Gamepad disconnected from index %d (Virtual ID: %d): %s",
                e.gamepad.index, virtualId, e.gamepad.id);
            this.browserToVirtualId.delete(e.gamepad.index);
            this.lastStates.delete(e.gamepad.index);
        });
    }

    public getChanges(): JoystickData[] {
        const gamepads = navigator.getGamepads();
        const changes: JoystickData[] = [];

        for (let i = 0; i < gamepads.length; i++) {
            const gp = gamepads[i];
            if (!gp) continue;

            // Ensure we have a virtual ID (handles case where gamepad was connected before GamepadCapture init)
            if (!this.browserToVirtualId.has(gp.index)) {
                let virtualId = 0;
                const assignedIds = Array.from(this.browserToVirtualId.values());
                while (assignedIds.includes(virtualId)) {
                    virtualId++;
                }
                this.browserToVirtualId.set(gp.index, virtualId);
            }

            const virtualId = this.browserToVirtualId.get(gp.index)!;

            if (gp.mapping !== 'standard') {
                if (!this.lastStates.has(gp.index)) {
                    console.warn(`[GamepadCapture] Non-standard gamepad detected at index ${gp.index} (Virtual ID: ${virtualId}): ${gp.id}. Mapping: ${gp.mapping}`);
                }
            }

            const currentState = this.mapGamepadToJoystick(gp, virtualId);
            const lastState = this.lastStates.get(gp.index);

            if (!lastState || this.hasStateChanged(lastState, currentState)) {
                if (!lastState) {
                    console.log(`[GamepadCapture] Initial state sent for gamepad ${gp.index} (Virtual ID: ${virtualId})`);
                }
                changes.push(currentState);
                this.lastStates.set(gp.index, currentState);
            }
        }

        return changes;
    }

    private mapGamepadToJoystick(gp: Gamepad, virtualId: number): JoystickData {
        return {
            joystickID: virtualId,
            axisX: this.applyDeadzone(gp.axes[0]),
            axisY: this.applyDeadzone(gp.axes[1]),
            buttonA: gp.buttons[0].pressed,
            buttonB: gp.buttons[1].pressed,
            buttonX: gp.buttons[2].pressed,
            buttonY: gp.buttons[3].pressed,
            buttonL: gp.buttons[4].pressed,
            buttonR: gp.buttons[5].pressed,
            buttonSelect: gp.buttons[8].pressed,
            buttonStart: gp.buttons[9].pressed,
            leftStickButton: gp.buttons[10].pressed,
            rightStickButton: gp.buttons[11].pressed,
            buttonDpadUp: gp.buttons[12].pressed,
            buttonDpadDown: gp.buttons[13].pressed,
            buttonDpadLeft: gp.buttons[14].pressed,
            buttonDpadRight: gp.buttons[15].pressed,
            rightAxisX: this.applyDeadzone(gp.axes[2]),
            rightAxisY: this.applyDeadzone(gp.axes[3]),
            leftTrigger: gp.buttons[6].value,
            rightTrigger: gp.buttons[7].value,
        };
    }

    private applyDeadzone(value: number): number {
        return Math.abs(value) < this.deadzone ? 0 : value;
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
