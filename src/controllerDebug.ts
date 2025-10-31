import {
    Engine,
    Scene,
    HemisphericLight,
    Vector3,
    MeshBuilder,
    WebXRDefaultExperience,
    Color3
} from "@babylonjs/core";
import debugLog from './debug';

/**
 * Minimal standalone class to debug WebXR controller detection
 * Usage: import and instantiate in main.ts instead of normal flow
 */
export class ControllerDebug {
    private engine: Engine;
    private scene: Scene;

    constructor() {
        debugLog('🔍 ControllerDebug: Starting minimal test...');
        this.init();
    }

    private async init() {
        // Get canvas
        const canvas = document.querySelector('#gameCanvas') as HTMLCanvasElement;

        // Create engine (no antialiasing for Quest compatibility)
        debugLog('🔍 Creating engine...');
        this.engine = new Engine(canvas, false);

        // Create scene
        debugLog('🔍 Creating scene...');
        this.scene = new Scene(this.engine);
        this.scene.clearColor = new Color3(0.1, 0.1, 0.2).toColor4();

        // Add light
        //const light = new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);

        // Add ground for reference
        const ground = MeshBuilder.CreateGround("ground", { width: 10, height: 10 }, this.scene);

        // Create WebXR
        //consol e.log('🔍 Creating WebXR...');
        //await navigator.xr.offerSession("immersive-vr");
        const xr = await this.scene.createDefaultXRExperienceAsync( {
            disablePointerSelection: true,
            disableTeleportation: true,
            disableDefaultUI: false,  // Enable UI for this test
            disableHandTracking: true
        });

        debugLog('🔍 WebXR created successfully');
        debugLog('🔍 XR input exists:', !!xr.input);
        debugLog('🔍 XR input controllers:', xr.input.controllers.length);

        // Set up controller observable
        debugLog('🔍 Setting up onControllerAddedObservable...');


        xr.input.onControllerAddedObservable.add((controller) => {
            debugLog('✅ CONTROLLER ADDED! Handedness:', controller.inputSource.handedness);
            debugLog('  - Input source:', controller.inputSource);
            debugLog('  - Has motion controller:', !!controller.motionController);

            // Wait for motion controller
            controller.onMotionControllerInitObservable.add((motionController) => {
                debugLog('✅ MOTION CONTROLLER INITIALIZED:', motionController.handness);
                debugLog('  - Profile:', motionController.profileId);
                debugLog('  - Components:', Object.keys(motionController.components));

                // Log when any component changes
                Object.keys(motionController.components).forEach(componentId => {
                    const component = motionController.components[componentId];

                    if (component.onAxisValueChangedObservable) {
                        component.onAxisValueChangedObservable.add((axes) => {
                            debugLog(`📍 ${motionController.handness} ${componentId} axes:`, axes);
                        });
                    }

                    if (component.onButtonStateChangedObservable) {
                        component.onButtonStateChangedObservable.add((state) => {
                            debugLog(`🔘 ${motionController.handness} ${componentId} button:`, {
                                pressed: state.pressed,
                                touched: state.touched,
                                value: state.value
                            });
                        });
                    }
                });
            });
        });

        debugLog('🔍 Observable registered. Waiting for controllers...');

        // Render loop
        this.engine.runRenderLoop(() => {
            this.scene.render();
        });

        // Create button to enter VR (requires user gesture)
        this.createEnterVRButton(xr);
    }

    private createEnterVRButton(xr: WebXRDefaultExperience) {
        const button = document.createElement('button');
        button.textContent = 'Enter VR (Controller Debug)';
        button.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            padding: 20px 40px;
            font-size: 24px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            z-index: 9999;
        `;

        button.onclick = async () => {
            debugLog('🔍 Button clicked - Entering VR mode...');
            button.remove();

            try {
                await xr.baseExperience.enterXRAsync('immersive-vr', 'local-floor', undefined, {
                    requiredFeatures: ['local-floor'],

                });
                debugLog(xr.baseExperience.featuresManager.getEnabledFeatures());
                //await xr.baseExperience.exitXRAsync();
                //await xr.baseExperience.enterXRAsync('immersive-vr', 'local-floor');
                debugLog('🔍 ✅ Entered VR mode successfully');
                debugLog('🔍 Controllers after entering VR:', xr.input.controllers.length);

                // Check again after delays
                setTimeout(() => {
                    debugLog('🔍 [+1s after VR] Controller count:', xr.input.controllers.length);
                }, 1000);

                setTimeout(() => {
                    debugLog('🔍 [+3s after VR] Controller count:', xr.input.controllers.length);
                }, 3000);

                setTimeout(() => {
                    debugLog('🔍 [+5s after VR] Controller count:', xr.input.controllers.length);
                }, 5000);
            } catch (error) {
                console.error('🔍 ❌ Failed to enter VR:', error);
            }
        };

        document.body.appendChild(button);
        debugLog('🔍 Click the button to enter VR mode');
    }
}
