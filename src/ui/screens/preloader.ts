/**
 * Preloader UI - Shows loading progress, level info, and ENTER XR button
 */
export class Preloader {
    private container: HTMLElement | null = null;
    private progressBar: HTMLElement | null = null;
    private statusText: HTMLElement | null = null;
    private startButton: HTMLElement | null = null;
    private levelInfoEl: HTMLElement | null = null;
    private errorEl: HTMLElement | null = null;
    private onStartCallback: (() => void) | null = null;

    constructor() {
        this.createUI();
    }

    private createUI(): void {
        this.container = document.createElement('div');
        this.container.className = 'preloader';
        this.container.innerHTML = this.getTemplate();
        document.body.appendChild(this.container);
        this.cacheElements();
        this.setupButtonHandler();
    }

    private getTemplate(): string {
        return `
            <div class="preloader-content">
                <h1 class="preloader-title">🚀 Space Combat VR</h1>
                <div id="preloaderLevelInfo" class="preloader-level-info" style="display: none;">
                    <h2 id="preloaderLevelName" class="preloader-level-name"></h2>
                    <span id="preloaderDifficulty" class="preloader-difficulty"></span>
                    <ul id="preloaderMissionBrief" class="preloader-mission-brief"></ul>
                </div>
                <div id="preloaderStatus" class="preloader-status">Initializing...</div>
                <div class="preloader-progress-container">
                    <div id="preloaderProgress" class="preloader-progress"></div>
                </div>
                <div id="preloaderError" class="preloader-error" style="display: none;">
                    VR headset not detected. This game requires a VR device.
                </div>
                <div class="preloader-button-container">
                    <button id="preloaderStartBtn" class="preloader-button">ENTER XR</button>
                </div>
                
            </div>`;
    }

    private cacheElements(): void {
        this.progressBar = document.getElementById('preloaderProgress');
        this.statusText = document.getElementById('preloaderStatus');
        this.startButton = document.getElementById('preloaderStartBtn');
        this.levelInfoEl = document.getElementById('preloaderLevelInfo');
        this.errorEl = document.getElementById('preloaderError');
    }

    private setupButtonHandler(): void {
        this.startButton?.addEventListener('click', () => this.onStartCallback?.());
    }

    public setLevelInfo(name: string, difficulty: string, missionBrief: string[]): void {
        if (!this.levelInfoEl) return;
        const nameEl = document.getElementById('preloaderLevelName');
        const diffEl = document.getElementById('preloaderDifficulty');
        const briefEl = document.getElementById('preloaderMissionBrief');

        if (nameEl) nameEl.textContent = name;
        if (diffEl) {
            diffEl.textContent = difficulty;
            diffEl.className = `preloader-difficulty difficulty-${difficulty.toLowerCase()}`;
        }
        if (briefEl) {
            briefEl.innerHTML = missionBrief.map(item => `<li>${item}</li>`).join('');
        }
        this.levelInfoEl.style.display = 'block';
    }

    public updateProgress(percent: number, message: string): void {
        if (this.progressBar) {
            this.progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
        }
        if (this.statusText) this.statusText.textContent = message;
    }

    public async checkXRAvailability(): Promise<boolean> {
        if (!navigator.xr) return false;
        try {
            return await navigator.xr.isSessionSupported('immersive-vr');
        } catch {
            return false;
        }
    }

    public showStartButton(onStart: () => void): void {
        this.onStartCallback = onStart;
        if (this.statusText) this.statusText.textContent = 'Ready to enter VR!';
        if (this.progressBar) this.progressBar.style.width = '100%';
        this.animateButtonIn();
    }

    public showVRNotAvailable(): void {
        if (this.statusText) this.statusText.textContent = 'VR Required';
        if (this.progressBar) this.progressBar.style.width = '100%';
        if (this.errorEl) this.errorEl.style.display = 'block';
        if (this.startButton) this.startButton.style.display = 'none';
    }

    private animateButtonIn(): void {
        if (!this.startButton) return;
        this.startButton.style.display = 'inline-block';
        this.startButton.style.opacity = '0';
        this.startButton.style.transform = 'translateY(20px)';
        setTimeout(() => {
            if (!this.startButton) return;
            this.startButton.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            this.startButton.style.opacity = '1';
            this.startButton.style.transform = 'translateY(0)';
        }, 100);
    }

    public hide(): void {
        if (!this.container) return;
        this.container.style.transition = 'opacity 0.5s ease';
        this.container.style.opacity = '0';
        setTimeout(() => this.container?.remove(), 500);
    }

    public isVisible(): boolean {
        return this.container?.parentElement !== null;
    }
}
