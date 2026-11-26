import * as THREE from '../vendor/three.module.js';
import { CharacterBuilder } from './characterBuilder.js';
import { sound } from './audio.js';
import { calculateStats, ANCESTRY_DATA, CLASS_DATA } from './stats.js';
import { progression } from './progression.js';

export class CharacterCreatorApp {
    constructor(canvasContainer, options = {}) {
        this.container = canvasContainer;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.builder = new CharacterBuilder();
        this.currentCharacter = null;
        this.characterAnchor = null;

        this.active = options.active !== undefined ? options.active : true;
        this.skipDomSync = Boolean(options.skipDomSync);
        this.rafId = null;

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
            ancestry: 'human',
            race: 'human',
            charClass: 'warrior',
            bodyType: 'a',
            hairStyle: 1,
            beardStyle: 0,
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
        this._unsubProgression = progression.onChange(() => {
            this.updateStatsUI();
        });
        if (this.active) {
            this.animate();
        }
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
        const ancestryChanged = (newConfig.ancestry && newConfig.ancestry !== this.config.ancestry) ||
                                (newConfig.race && newConfig.race !== this.config.race);
        const classChanged = newConfig.charClass && newConfig.charClass !== this.config.charClass;

        if (newConfig.ancestry && !newConfig.race) newConfig.race = newConfig.ancestry;
        if (newConfig.race && !newConfig.ancestry) newConfig.ancestry = newConfig.race;

        Object.assign(this.config, newConfig);

        if (ancestryChanged) {
            sound.playRaceSwitch();
        } else if (classChanged) {
            sound.playClassEquip(this.config.charClass);
        } else if (soundType === 'select') {
            sound.playSelect();
        }

        this.rebuildCharacter();
    }

    updateStatsUI() {
        if (this.skipDomSync) return;
        const ancestryKey = this.config.ancestry || this.config.race || 'human';
        const stats = calculateStats(ancestryKey, this.config.charClass, progression);

        const elName = document.getElementById('heroNameBadge');
        if (elName) elName.textContent = this.config.name || 'Hero';

        const elAncestryClass = document.getElementById('heroAncestryClassBadge') ||
                                document.getElementById('heroancestryClassBadge') ||
                                document.getElementById('heroRaceClassBadge');
        if (elAncestryClass) {
            elAncestryClass.textContent = `${(stats.ancestry || stats.race).name} ${stats.charClass.name}`;
        }

        const ancestryObj = stats.ancestry || stats.race;
        const elPerkTitle = document.getElementById('racialPerkTitle') || document.getElementById('ancestryPerkTitle');
        const elPerkDesc = document.getElementById('racialPerkDesc') || document.getElementById('ancestryPerkDesc');
        if (elPerkTitle) elPerkTitle.textContent = `${ancestryObj.icon} ${ancestryObj.name} Ancestry Trait`;
        if (elPerkDesc) elPerkDesc.textContent = ancestryObj.perk;

        const elAbilityTitle = document.getElementById('classAbilityTitle');
        const elAbilityDesc = document.getElementById('classAbilityDesc');
        if (elAbilityTitle) elAbilityTitle.textContent = `${stats.charClass.icon} ${stats.charClass.name} Signature`;
        if (elAbilityDesc) elAbilityDesc.textContent = stats.charClass.signature;

        // Stat Bars & Numbers (reflecting EXP-boosted Ancestry stats + Equipped Weapon/Armor)
        this.setStatDisplay('statHp', stats.maxHp, 350);
        this.setStatDisplay('statMp', stats.maxMp, 400);
        this.setStatDisplay('statStr', stats.str, 30);
        this.setStatDisplay('statAgi', stats.agi, 30);
        this.setStatDisplay('statInt', stats.int, 30);
        this.setStatDisplay('statVit', stats.vit, 30);

        // Optional EXP Stat Boost & Loadout Badges in Character Forge
        const boosts = stats.statBoosts || { str: 0, agi: 0, int: 0, vit: 0 };
        const totalBoosts = (boosts.str || 0) + (boosts.agi || 0) + (boosts.int || 0) + (boosts.vit || 0);
        const elBoostSummary = document.getElementById('forgeAncestryBoostSummary');
        if (elBoostSummary) {
            if (totalBoosts > 0) {
                const parts = [];
                if (boosts.str > 0) parts.push(`+${boosts.str} STR`);
                if (boosts.vit > 0) parts.push(`+${boosts.vit} VIT`);
                if (boosts.agi > 0) parts.push(`+${boosts.agi} AGI`);
                if (boosts.int > 0) parts.push(`+${boosts.int} INT`);
                elBoostSummary.textContent = `⭐ ${ancestryObj.name} EXP Boosts Active: ${parts.join(', ')}`;
                elBoostSummary.style.color = '#4ade80';
            } else {
                elBoostSummary.textContent = `⭐ ${ancestryObj.name} EXP Boosts: +0 (Upgrade with EXP in Shop)`;
                elBoostSummary.style.color = '#94a3b8';
            }
        }

        const elLoadoutSummary = document.getElementById('forgeLoadoutSummary');
        if (elLoadoutSummary) {
            const wpn = stats.equippedWeapon;
            const arm = stats.equippedArmor;
            const spells = progression.getOwnedSpells();
            const spellText = spells.length > 0 ? spells.map((s) => s.name).join(', ') : 'None';
            elLoadoutSummary.innerHTML =
                `<div>⚔️ Weapon: <strong style="color:#ffcf40;">${wpn.name}</strong></div>` +
                `<div>🛡️ Armor: <strong style="color:#38bdf8;">${arm.name}</strong></div>` +
                `<div>✨ Spells (${spells.length}): <strong style="color:#c084fc;">${spellText}</strong></div>`;
        }
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

    resize() {
        if (!this.renderer || !this.camera || !this.container) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        if (width <= 0 || height <= 0) return;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    setActive(isActive) {
        if (this.active === isActive) return;
        this.active = isActive;
        if (this.active) {
            this.clock.getDelta();
            this.resize();
            this.animate();
        } else if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    setupEventListeners() {
        this._onResize = () => this.resize();
        window.addEventListener('resize', this._onResize);

        // Mouse Drag Turntable
        const canvas = this.renderer.domElement;

        this._onMouseDown = (e) => {
            this.isDragging = true;
            this.prevMousePos = { x: e.clientX, y: e.clientY };
        };
        canvas.addEventListener('mousedown', this._onMouseDown);

        this._onMouseMove = (e) => {
            if (!this.isDragging) return;
            const deltaX = e.clientX - this.prevMousePos.x;
            this.targetRotationY += deltaX * 0.012;
            this.prevMousePos = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('mousemove', this._onMouseMove);

        this._onMouseUp = () => {
            this.isDragging = false;
        };
        window.addEventListener('mouseup', this._onMouseUp);

        // Touch support for mobile / tablets
        this._onTouchStart = (e) => {
            if (e.touches.length === 1) {
                this.isDragging = true;
                this.prevMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
        };
        canvas.addEventListener('touchstart', this._onTouchStart);

        this._onTouchMove = (e) => {
            if (!this.isDragging || e.touches.length !== 1) return;
            const deltaX = e.touches[0].clientX - this.prevMousePos.x;
            this.targetRotationY += deltaX * 0.015;
            this.prevMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        };
        window.addEventListener('touchmove', this._onTouchMove);

        this._onTouchEnd = () => {
            this.isDragging = false;
        };
        window.addEventListener('touchend', this._onTouchEnd);

        // Zoom with wheel
        this._onWheel = (e) => {
            e.preventDefault();
            this.targetCameraDistance = THREE.MathUtils.clamp(
                this.targetCameraDistance + e.deltaY * 0.003,
                2.5,
                6.5
            );
        };
        canvas.addEventListener('wheel', this._onWheel, { passive: false });
    }

    dispose() {
        this.active = false;
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        if (this._unsubProgression) {
            this._unsubProgression();
            this._unsubProgression = null;
        }
        if (typeof window !== 'undefined') {
            if (this._onResize) window.removeEventListener('resize', this._onResize);
            if (this._onMouseMove) window.removeEventListener('mousemove', this._onMouseMove);
            if (this._onMouseUp) window.removeEventListener('mouseup', this._onMouseUp);
            if (this._onTouchMove) window.removeEventListener('touchmove', this._onTouchMove);
            if (this._onTouchEnd) window.removeEventListener('touchend', this._onTouchEnd);
        }
        const canvas = this.renderer?.domElement;
        if (canvas) {
            if (this._onMouseDown) canvas.removeEventListener('mousedown', this._onMouseDown);
            if (this._onTouchStart) canvas.removeEventListener('touchstart', this._onTouchStart);
            if (this._onWheel) canvas.removeEventListener('wheel', this._onWheel);
            if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        }
        if (this.renderer && typeof this.renderer.dispose === 'function') {
            this.renderer.dispose();
        }
    }

    rotateCharacter(deltaAngle) {
        this.targetRotationY += deltaAngle;
    }

    animate() {
        if (!this.active) return;
        this.rafId = requestAnimationFrame(() => this.animate());

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
