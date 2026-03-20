import { ParamConfigPanel } from './ParamConfigPanel';

export class PresetManager {
    private panel: ParamConfigPanel;
    private saveBtn: HTMLButtonElement;
    private loadBtn: HTMLButtonElement;
    private fileInput: HTMLInputElement;

    constructor(panel: ParamConfigPanel) {
        this.panel = panel;
        this.saveBtn = document.getElementById('save-preset-btn') as HTMLButtonElement;
        this.loadBtn = document.getElementById('load-preset-btn') as HTMLButtonElement;
        this.fileInput = document.getElementById('preset-file-input') as HTMLInputElement;

        this.setupListeners();
    }

    private setupListeners() {
        this.saveBtn.addEventListener('click', () => {
            const presetData = this.panel.getCurrentValues();
            if (!presetData.appName) {
                alert('No active app to save preset for.');
                return;
            }
            this.downloadJSON(presetData);
        });

        this.loadBtn.addEventListener('click', () => {
            this.fileInput.click();
        });

        this.fileInput.addEventListener('change', (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const preset = JSON.parse(e.target?.result as string);
                    this.panel.applyValues(preset.params);
                } catch (err) {
                    console.error('[PresetManager] Error parsing preset JSON:', err);
                    alert('Invalid preset file.');
                }
            };
            reader.readAsText(file);
        });
    }

    private downloadJSON(data: any) {
        const filename = `${data.appName}_preset_${new Date().toISOString().slice(0, 10)}.json`;
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
