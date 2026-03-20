import { WebSocketConnection } from './WebSocketConnection';

export class ParamConfigPanel {
    private container: HTMLElement;
    private appNameElement: HTMLElement;
    private ws: WebSocketConnection;
    private currentAppName: string = '';
    private currentAppId: number = 0;
    private paramGroups: Map<string, HTMLElement> = new Map();
    private activeParams: Map<string, any> = new Map();

    constructor(ws: WebSocketConnection) {
        this.ws = ws;
        this.container = document.getElementById('param-controls')!;
        this.appNameElement = document.getElementById('active-app-name')!;
        
        this.setupPanelToggle();
        this.setupListeners();
    }

    private setupPanelToggle() {
        const panel = document.getElementById('side-panel')!;
        const toggle = document.getElementById('side-panel-toggle')!;
        
        toggle.addEventListener('click', () => {
            panel.classList.toggle('open');
        });
    }

    private setupListeners() {
        this.ws.onParamSchema((schema: any, appId: number) => {
            console.log('[ParamConfigPanel] New schema:', schema, 'AppId:', appId);
            this.currentAppId = appId;
            this.buildUI(schema);
            // Request current values immediately after getting schema
            this.ws.sendGetAppParams(appId);
        });

        this.ws.onParamValues((valuesObject: any, appId: number) => {
            if (appId !== this.currentAppId) return;
            console.log('[ParamConfigPanel] Values:', valuesObject);
            this.updateValues(valuesObject.values);
        });
    }

    private buildUI(schema: any) {
        this.currentAppName = schema.appName;
        this.appNameElement.textContent = this.currentAppName;
        this.container.innerHTML = '';
        this.paramGroups.clear();
        this.activeParams.clear();

        if (!schema.params || schema.params.length === 0) {
            this.container.innerHTML = '<div style="color: rgba(255,255,255,0.3); font-size: 13px;">No parameters available for this app.</div>';
            return;
        }

        schema.params.forEach((param: any) => {
            const groupName = param.group || 'General';
            let groupContainer = this.paramGroups.get(groupName);

            if (!groupContainer) {
                groupContainer = document.createElement('div');
                groupContainer.className = 'param-group';
                const title = document.createElement('div');
                title.className = 'param-group-title';
                title.textContent = groupName;
                groupContainer.appendChild(title);
                this.container.appendChild(groupContainer);
                this.paramGroups.set(groupName, groupContainer);
            }

            const control = this.createControl(param);
            groupContainer.appendChild(control);
            this.activeParams.set(param.key, param);
        });
    }

    private createControl(param: any): HTMLElement {
        const item = document.createElement('div');
        item.className = 'control-item';
        item.id = `control-${param.key}`;

        const header = document.createElement('div');
        header.className = 'control-header';
        
        const label = document.createElement('label');
        label.className = 'control-label';
        label.textContent = param.label || param.key;
        header.appendChild(label);

        const valueDisplay = document.createElement('span');
        valueDisplay.className = 'control-value';
        header.appendChild(valueDisplay);

        item.appendChild(header);

        let input: HTMLElement;

        if (param.type === 'bool') {
            const wrapper = document.createElement('label');
            wrapper.className = 'toggle-switch';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = !!param.defaultVal;
            const slider = document.createElement('span');
            slider.className = 'slider';
            wrapper.appendChild(cb);
            wrapper.appendChild(slider);
            input = cb;
            
            cb.addEventListener('change', () => {
                this.ws.sendParamUpdate(param.key, cb.checked, 'bool', this.currentAppId);
                valueDisplay.textContent = cb.checked ? 'ON' : 'OFF';
            });
            valueDisplay.textContent = cb.checked ? 'ON' : 'OFF';
            item.appendChild(wrapper);
        } else if (param.type === 'enum') {
            const select = document.createElement('select');
            (param.enumOptions || []).forEach((opt: string) => {
                const o = document.createElement('option');
                o.value = opt;
                o.textContent = opt;
                select.appendChild(o);
            });
            input = select;
            select.addEventListener('change', () => {
                this.ws.sendParamUpdate(param.key, select.value, 'enum', this.currentAppId);
                valueDisplay.textContent = select.value;
            });
            valueDisplay.textContent = select.value;
            item.appendChild(select);
        } else {
            // float or int
            const range = document.createElement('input');
            range.type = 'range';
            range.min = (param.minVal ?? 0).toString();
            range.max = (param.maxVal ?? 100).toString();
            range.step = (param.step ?? (param.type === 'int' ? 1 : 0.01)).toString();
            range.value = (param.defaultVal ?? 0).toString();
            input = range;

            range.addEventListener('input', () => {
                const val = param.type === 'int' ? parseInt(range.value) : parseFloat(range.value);
                this.ws.sendParamUpdate(param.key, val, param.type, this.currentAppId);
                valueDisplay.textContent = val.toString();
            });
            valueDisplay.textContent = range.value;
            item.appendChild(range);
        }

        return item;
    }

    private updateValues(values: any[]) {
        if (!values) return;
        values.forEach((v: any) => {
            const param = this.activeParams.get(v.key);
            if (!param) return;

            const item = document.getElementById(`control-${v.key}`);
            if (!item) return;

            const valueDisplay = item.querySelector('.control-value') as HTMLElement;
            let val: any;
            if (param.type === 'float') val = v.floatVal;
            else if (param.type === 'int') val = v.intVal;
            else if (param.type === 'bool') val = v.boolVal;
            else if (param.type === 'enum') val = v.stringVal;

            if (valueDisplay) valueDisplay.textContent = param.type === 'bool' ? (val ? 'ON' : 'OFF') : val.toString();

            const input = item.querySelector('input, select') as any;
            if (input) {
                if (param.type === 'bool') input.checked = !!val;
                else input.value = val;
            }
        });
    }

    public getCurrentValues(): any {
        const preset: any = {
            appName: this.currentAppName,
            params: {}
        };
        
        this.activeParams.forEach((param, key) => {
            const item = document.getElementById(`control-${key}`);
            if (!item) return;
            const input = item.querySelector('input, select') as any;
            if (input) {
                preset.params[key] = param.type === 'bool' ? input.checked : 
                                     (param.type === 'int' ? parseInt(input.value) : 
                                      (param.type === 'float' ? parseFloat(input.value) : input.value));
            }
        });
        
        return preset;
    }

    public applyValues(params: any) {
        for (const key in params) {
            const paramDef = this.activeParams.get(key);
            if (paramDef) {
                const val = params[key];
                this.ws.sendParamUpdate(key, val, paramDef.type, this.currentAppId);
            }
        }
        // Force a refresh of UI by requesting values back from app (or just update UI locally)
        this.ws.sendGetAppParams(this.currentAppId);
    }
}
