import {
    MeshBuilder,
    ParticleHelper,
    ParticleSystem,
    ParticleSystemSet,
    Scene,
    Vector3
} from "@babylonjs/core";

/**
 * Configuration for explosion effects
 */
export interface ExplosionConfig {
    /** Size of the explosion pool */
    poolSize?: number;
    /** Duration of explosion in milliseconds */
    duration?: number;
    /** Rendering group ID for particles */
    renderingGroupId?: number;
}

/**
 * Manages explosion particle effects with pooling for performance
 */
export class ExplosionManager {
    private explosionPool: ParticleSystemSet[] = [];
    private scene: Scene;
    private config: Required<ExplosionConfig>;

    // Default configuration
    private static readonly DEFAULT_CONFIG: Required<ExplosionConfig> = {
        poolSize: 10,
        duration: 2000,
        renderingGroupId: 1
    };

    constructor(scene: Scene, config?: ExplosionConfig) {
        this.scene = scene;
        this.config = { ...ExplosionManager.DEFAULT_CONFIG, ...config };
    }

    /**
     * Initialize the explosion pool by pre-creating particle systems
     */
    public async initialize(): Promise<void> {
        console.log(`Pre-creating ${this.config.poolSize} explosion particle systems...`);

        for (let i = 0; i < this.config.poolSize; i++) {
            const set = await ParticleHelper.CreateAsync("explosion", this.scene);
            set.systems.forEach((system) => {
                system.renderingGroupId = this.config.renderingGroupId;
            });
            this.explosionPool.push(set);
        }

        console.log(`Created ${this.config.poolSize} explosion particle systems in pool`);
    }

    /**
     * Get an explosion from the pool
     */
    private getExplosionFromPool(): ParticleSystemSet | null {
        return this.explosionPool.pop() || null;
    }

    /**
     * Return an explosion to the pool after use
     */
    private returnExplosionToPool(explosion: ParticleSystemSet): void {
        explosion.dispose();
        ParticleHelper.CreateAsync("explosion", this.scene).then((set) => {
            set.systems.forEach((system) => {
                system.renderingGroupId = this.config.renderingGroupId;
            });
            this.explosionPool.push(set);
        });
    }

    /**
     * Play an explosion at the specified position with optional scaling
     */
    public playExplosion(position: Vector3, scaling: Vector3 = Vector3.One()): void {
        const explosion = this.getExplosionFromPool();

        if (!explosion) {
            // Pool is empty, create explosion on the fly
            console.log("Explosion pool empty, creating new explosion on demand");
            ParticleHelper.CreateAsync("explosion", this.scene).then((set) => {
                const point = MeshBuilder.CreateSphere("explosionPoint", {
                    diameter: 0.1
                }, this.scene);
                point.position = position.clone();
                point.isVisible = false;

                set.start(point);

                setTimeout(() => {
                    set.dispose();
                    point.dispose();
                }, this.config.duration);
            });
        } else {
            // Use pooled explosion
            const point = MeshBuilder.CreateSphere("explosionPoint", {
                diameter: 10
            }, this.scene);
            point.position = position.clone();
            point.isVisible = false;
            point.scaling = scaling.multiplyByFloats(0.2, 0.3, 0.2);

            console.log("Using pooled explosion with", explosion.systems.length, "systems at", position);

            // Set emitter and start each system individually
            explosion.systems.forEach((system: ParticleSystem, idx: number) => {
                system.emitter = point;
                system.start();
                console.log(`  System ${idx}: emitter set to`, system.emitter, "activeCount=", system.getActiveCount());
            });

            // Stop and return to pool after duration
            setTimeout(() => {
                explosion.systems.forEach((system: ParticleSystem) => {
                    system.stop();
                });
                this.returnExplosionToPool(explosion);
                point.dispose();
            }, this.config.duration);
        }
    }

    /**
     * Get the current number of available explosions in the pool
     */
    public getPoolSize(): number {
        return this.explosionPool.length;
    }

    /**
     * Dispose of all pooled explosions
     */
    public dispose(): void {
        this.explosionPool.forEach(explosion => {
            explosion.dispose();
        });
        this.explosionPool = [];
    }
}
