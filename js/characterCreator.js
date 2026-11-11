import * as THREE from '../vendor/three.module.js';
import { CharacterBuilder } from './characterBuilder.js';
import { sound } from './audio.js';
import { calculateStats, RACE_DATA, CLASS_DATA } from './stats.js';

export class CharacterCreatorApp {
    constructor(canvasContainer) {
        this.container = canvasContainer;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.builder = new CharacterBuilder();
        this.currentCharacter = null;
        this.characterAnchor = null;

        // Turntable interaction state
        this.isDragging = false;
        this.prevMousePos = { x: 0, y: 0 };
        this.rotationY = 0.4;
        this.targetRotationY = 0.4;
        this.cameraDistance = 4.8;
        this.targetCameraDistance = 4.8;

        // Current hero configuration
        this.config = {
            name: 'Valerius',
            race: 'human',
            charClass: 'warrior',
            showHelm: true,
            skinColor: '#ffd2b2',
            hairColor: '#4a2e1b',
            clothColor: '#2b4c7e',
            armorColor: '#95a5a6'
        };

        this.particles = null;
        this.clock = new THREE.Clock();

        this.initScene();
        this.buildPedestal();
        this.createParticles();
        this.setupEventListeners();
        this.rebuildCharacter();
        this.animate();
    }

    initScene() {
        const width = this.container.clientWidth || window.innerWidth;
        const height = this.container.clientHeight || window.innerHeight;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0e1118);
        this.scene.fog = new THREE.FogExp2(0x0e1118, 0.12);

        // Camera
        this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
        this.camera.position.set(0, 1.35, this.cameraDistance);
        this.camera.lookAt(0, 1.15, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Lighting
        const ambient = new THREE.AmbientLight(0x8892b0, 0.85);
        this.scene.add(ambient);

        const keyLight = new THREE.DirectionalLight(0xfff3e0, 1.4);
        keyLight.position.set(4, 6, 4);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 1024;
        keyLight.shadow.mapSize.height = 1024;
        this.scene.add(keyLight);

        const rimLight = new THREE.DirectionalLight(0x64b5f6, 0.9);
        rimLight.position.set(-4, 3, -4);
        this.scene.add(rimLight);

        // Character Anchor group for rotation - resting cleanly on top of pedestal (y = 0.28)
        this.characterAnchor = new THREE.Group();
        this.characterAnchor.position.y = 0.28;
        this.scene.add(this.characterAnchor);
    }

    buildPedestal() {
        const pedestal = new THREE.Group();

        // Base Stone Cylinder
        const baseGeo = new THREE.CylinderGeometry(1.5, 1.7, 0.35, 16);
        const stoneMat = new THREE.MeshLambertMaterial({ color: 0x222633, flatShading: true });
        const base = new THREE.Mesh(baseGeo, stoneMat);
        base.position.y = 0.05;
        base.receiveShadow = true;
        pedestal.add(base);

        // Runic Top Inset
        const topGeo = new THREE.CylinderGeometry(1.35, 1.35, 0.08, 16);
        const runeMat = new THREE.MeshLambertMaterial({ color: 0x2d3448, flatShading: true });
        const top = new THREE.Mesh(topGeo, runeMat);
        top.position.y = 0.24;
        top.receiveShadow = true;
        pedestal.add(top);

        // Glowing Rune Ring
        const ringGeo = new THREE.TorusGeometry(1.15, 0.03, 4, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x4fc3f7 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.29;
        pedestal.add(ring);

        // Ground shadow receiver floor
        const floorGeo = new THREE.PlaneGeometry(30, 30);
        const floorMat = new THREE.MeshLambertMaterial({ color: 0x090b10 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.12;
        floor.receiveShadow = true;
        pedestal.add(floor);

        this.scene.add(pedestal);
    }

    createParticles() {
        const particleCount = 45;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const speeds = new Float32Array(particleCount);

        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 0.2 + Math.random() * 1.1;
            positions[i * 3] = Math.cos(angle) * radius;
            positions[i * 3 + 1] = 0.32 + Math.random() * 2.5;
            positions[i * 3 + 2] = Math.sin(angle) * radius;
            speeds[i] = 0.2 + Math.random() * 0.4;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const mat = new THREE.PointsMaterial({
            color: 0x76e4f7,
            size: 0.05,
            transparent: true,
            opacity: 0.75,
            blending: THREE.AdditiveBlending
        });

        this.particles = new THREE.Points(geo, mat);
        this.particles.userData = { speeds };
        this.scene.add(this.particles);
    }

    rebuildCharacter() {
        if (this.currentCharacter) {
            this.characterAnchor.remove(this.currentCharacter.group);
        }

        this.currentCharacter = this.builder.createCharacter(this.config);
        this.characterAnchor.add(this.currentCharacter.group);

        this.updateStatsUI();
    }

    updateConfig(newConfig, soundType = 'select') {
        const raceChanged = newConfig.race && newConfig.race !== this.config.race;
        const classChanged = newConfig.charClass && newConfig.charClass !== this.config.charClass;

        Object.assign(this.config, newConfig);

        if (raceChanged) {
            sound.playRaceSwitch();
        } else if (classChanged) {
            sound.playClassEquip(this.config.charClass);
        } else if (soundType === 'select') {
            sound.playSelect();
        }

        this.rebuildCharacter();
    }

    updateStatsUI() {
        const stats = calculateStats(this.config.race, this.config.charClass);

        const elName = document.getElementById('heroNameBadge');
        if (elName) elName.textContent = this.config.name || 'Hero';

        const elRaceClass = document.getElementById('heroRaceClassBadge');
        if (elRaceClass) {
            elRaceClass.textContent = `${stats.race.name} ${stats.charClass.name}`;
        }

        const elPerkTitle = document.getElementById('racialPerkTitle');
        const elPerkDesc = document.getElementById('racialPerkDesc');
        if (elPerkTitle) elPerkTitle.textContent = `${stats.race.icon} ${stats.race.name} Ancestry Trait`;
        if (elPerkDesc) elPerkDesc.textContent = stats.race.perk;

        const elAbilityTitle = document.getElementById('classAbilityTitle');
        const elAbilityDesc = document.getElementById('classAbilityDesc');
        if (elAbilityTitle) elAbilityTitle.textContent = `${stats.charClass.icon} ${stats.charClass.name} Signature`;
        if (elAbilityDesc) elAbilityDesc.textContent = stats.charClass.signature;

        // Stat Bars & Numbers
        this.setStatDisplay('statHp', stats.maxHp, 250);
        this.setStatDisplay('statMp', stats.maxMp, 200);
        this.setStatDisplay('statStr', stats.str, 25);
        this.setStatDisplay('statAgi', stats.agi, 25);
        this.setStatDisplay('statInt', stats.int, 25);
        this.setStatDisplay('statVit', stats.vit, 25);
    }

    setStatDisplay(elementId, value, max) {
        const valEl = document.getElementById(`${elementId}Val`);
        const barEl = document.getElementById(`${elementId}Bar`);
        if (valEl) valEl.textContent = value;
        if (barEl) {
            const pct = Math.min(100, Math.round((value / max) * 100));
            barEl.style.width = `${pct}%`;
        }
    }

    setupEventListeners() {
        window.addEventListener('resize', () => {
            const width = this.container.clientWidth;
            const height = this.container.clientHeight;
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        });

        // Mouse Drag Turntable
        const canvas = this.renderer.domElement;

        canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.prevMousePos = { x: e.clientX, y: e.clientY };
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const deltaX = e.clientX - this.prevMousePos.x;
            this.targetRotationY += deltaX * 0.012;
            this.prevMousePos = { x: e.clientX, y: e.clientY };
        });

        window.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        // Touch support for mobile / tablets
        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                this.isDragging = true;
                this.prevMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
        });

        window.addEventListener('touchmove', (e) => {
            if (!this.isDragging || e.touches.length !== 1) return;
            const deltaX = e.touches[0].clientX - this.prevMousePos.x;
            this.targetRotationY += deltaX * 0.015;
            this.prevMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        });

        window.addEventListener('touchend', () => {
            this.isDragging = false;
        });

        // Zoom with wheel
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.targetCameraDistance = THREE.MathUtils.clamp(
                this.targetCameraDistance + e.deltaY * 0.003,
                2.5,
                6.5
            );
        }, { passive: false });
    }

    rotateCharacter(deltaAngle) {
        this.targetRotationY += deltaAngle;
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();

        // Turntable smooth damping
        this.rotationY += (this.targetRotationY - this.rotationY) * 0.12;
        this.characterAnchor.rotation.y = this.rotationY;

        // Camera distance smooth zoom
        this.cameraDistance += (this.targetCameraDistance - this.cameraDistance) * 0.1;
        this.camera.position.z = this.cameraDistance;
        this.camera.lookAt(0, 1.15, 0);

        // Character idle animation
        if (this.currentCharacter) {
            this.currentCharacter.update(delta);
        }

        // Float particles upward
        if (this.particles) {
            const positions = this.particles.geometry.attributes.position.array;
            const speeds = this.particles.userData.speeds;
            for (let i = 0; i < speeds.length; i++) {
                positions[i * 3 + 1] += speeds[i] * delta;
                if (positions[i * 3 + 1] > 3.0) {
                    positions[i * 3 + 1] = 0.28;
                }
            }
            this.particles.geometry.attributes.position.needsUpdate = true;
        }

        this.renderer.render(this.scene, this.camera);
    }
}
