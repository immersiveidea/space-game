#!/usr/bin/env node

/**
 * Script to generate default level JSON files
 * Run with: node scripts/generateDefaultLevels.js
 */

const fs = require('fs');
const path = require('path');

// Helper function to generate random asteroid data
function generateAsteroid(id, config, shipPos = [0, 1, 0]) {
    const { distanceMin, distanceMax, rockSizeMin, rockSizeMax, forceMultiplier } = config;

    // Random spherical distribution
    const theta = Math.random() * Math.PI * 2; // Azimuth angle
    const phi = Math.acos(2 * Math.random() - 1); // Polar angle
    const distance = distanceMin + Math.random() * (distanceMax - distanceMin);

    const position = [
        shipPos[0] + distance * Math.sin(phi) * Math.cos(theta),
        shipPos[1] + distance * Math.sin(phi) * Math.sin(theta),
        shipPos[2] + distance * Math.cos(phi)
    ];

    const scale = rockSizeMin + Math.random() * (rockSizeMax - rockSizeMin);

    // Random velocity toward ship
    const speedMin = 15 * forceMultiplier;
    const speedMax = 30 * forceMultiplier;
    const speed = speedMin + Math.random() * (speedMax - speedMin);

    const dirToShip = [
        shipPos[0] - position[0],
        shipPos[1] - position[1],
        shipPos[2] - position[2]
    ];
    const length = Math.sqrt(dirToShip[0]**2 + dirToShip[1]**2 + dirToShip[2]**2);
    const normalized = dirToShip.map(v => v / length);

    const linearVelocity = normalized.map(v => v * speed);

    const angularVelocity = [
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
    ];

    return {
        id: `asteroid-${id}`,
        position,
        scale,
        linearVelocity,
        angularVelocity
    };
}

// Level configurations matching LevelGenerator difficulty configs
const levels = [
    {
        filename: 'rookie-training.json',
        difficulty: 'recruit',
        difficultyConfig: {
            rockCount: 5,
            forceMultiplier: 0.8,
            rockSizeMin: 10,
            rockSizeMax: 15,
            distanceMin: 220,
            distanceMax: 250
        },
        metadata: {
            author: 'System',
            description: 'Learn the basics of ship control and asteroid destruction in a calm sector of space.',
            estimatedTime: '3-5 minutes',
            type: 'default'
        }
    },
    {
        filename: 'rescue-mission.json',
        difficulty: 'pilot',
        difficultyConfig: {
            rockCount: 10,
            forceMultiplier: 1.0,
            rockSizeMin: 8,
            rockSizeMax: 20,
            distanceMin: 225,
            distanceMax: 300
        },
        metadata: {
            author: 'System',
            description: 'Clear a path through moderate asteroid density to reach the stranded station.',
            estimatedTime: '5-8 minutes',
            type: 'default'
        }
    },
    {
        filename: 'deep-space-patrol.json',
        difficulty: 'captain',
        difficultyConfig: {
            rockCount: 20,
            forceMultiplier: 1.2,
            rockSizeMin: 5,
            rockSizeMax: 40,
            distanceMin: 230,
            distanceMax: 450
        },
        metadata: {
            author: 'System',
            description: 'Patrol a dangerous sector with heavy asteroid activity. Watch your fuel!',
            estimatedTime: '8-12 minutes',
            type: 'default'
        }
    },
    {
        filename: 'enemy-territory.json',
        difficulty: 'commander',
        difficultyConfig: {
            rockCount: 50,
            forceMultiplier: 1.3,
            rockSizeMin: 2,
            rockSizeMax: 8,
            distanceMin: 90,
            distanceMax: 280
        },
        metadata: {
            author: 'System',
            description: 'Navigate through hostile space with high-speed asteroids and limited resources.',
            estimatedTime: '10-15 minutes',
            type: 'default'
        }
    },
    {
        filename: 'the-gauntlet.json',
        difficulty: 'commander',
        difficultyConfig: {
            rockCount: 50,
            forceMultiplier: 1.3,
            rockSizeMin: 2,
            rockSizeMax: 8,
            distanceMin: 90,
            distanceMax: 280
        },
        metadata: {
            author: 'System',
            description: 'Face maximum asteroid density in this ultimate test of piloting skill.',
            estimatedTime: '12-18 minutes',
            type: 'default'
        }
    },
    {
        filename: 'final-challenge.json',
        difficulty: 'commander',
        difficultyConfig: {
            rockCount: 50,
            forceMultiplier: 1.3,
            rockSizeMin: 2,
            rockSizeMax: 8,
            distanceMin: 90,
            distanceMax: 280
        },
        metadata: {
            author: 'System',
            description: 'The ultimate challenge - survive the most chaotic asteroid field in known space.',
            estimatedTime: '15-20 minutes',
            type: 'default'
        }
    }
];

// Output directory
const outputDir = path.join(__dirname, '../public/levels');

// Ensure directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Generate each level
for (const level of levels) {
    const asteroids = [];
    for (let i = 0; i < level.difficultyConfig.rockCount; i++) {
        asteroids.push(generateAsteroid(i, level.difficultyConfig));
    }

    const levelConfig = {
        version: '1.0',
        difficulty: level.difficulty,
        timestamp: new Date().toISOString(),
        metadata: level.metadata,
        ship: {
            position: [0, 1, 0],
            rotation: [0, 0, 0],
            linearVelocity: [0, 0, 0],
            angularVelocity: [0, 0, 0]
        },
        startBase: {
            position: [0, 0, 0],
            baseGlbPath: 'base.glb'
        },
        sun: {
            position: [0, 0, 400],
            diameter: 50,
            intensity: 1000000
        },
        planets: [],
        asteroids,
        difficultyConfig: level.difficultyConfig
    };

    const outputPath = path.join(outputDir, level.filename);
    fs.writeFileSync(outputPath, JSON.stringify(levelConfig, null, 2));
    console.log(`Generated: ${level.filename} (${level.difficultyConfig.rockCount} asteroids)`);
}

console.log(`\nSuccessfully generated ${levels.length} default level files!`);
