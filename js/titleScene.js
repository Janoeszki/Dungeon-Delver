import * as THREE from '../vendor/three.module.js';

/**
 * 3D Atmospheric Backdrop for the Starting Page.
 * Renders a gothic stone crypt archway, floating Phusza crystal,
 * twin burning braziers, rising fire embers, and arcane leyline motes.
 */
export class TitleSceneApp {
    constructor(container) {
        this.container = container;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();

        this.active = true;
        this.rafId = null;

        this.crystal = null;
        this.crystalHalo = null;
        this.crystalLight = null;
        this.crystalPulse = 0;

        this.braziers = [];
        this.embers = null;
        this.motes = null;
        this.runeMeshes = [];

        this.pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };

        this.initScene();
        this.buildDungeonHall();
        this.buildPortalArch();
        this.buildBraziers();
        this.buildParticles();
        this.bindEvents();
        this.animate();
    }

    initScene() {
        const width = this.container.clientWidth || window.innerWidth;
        const height = this.container.clientHeight || window.innerHeight;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x05070d);
        this.scene.fog = new THREE.FogExp2(0x05070d, 0.052);

        this.camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 80);
        this.camera.position.set(0, 2.7, 8.2);
        this.camera.lookAt(0, 2.2, -10);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Cool ambient moonlight + deep blue crypt fill
        const ambient = new THREE.AmbientLight(0x2d3f60, 0.75);
        this.scene.add(ambient);

        const rimMoon = new THREE.DirectionalLight(0x5299d3, 0.7);
        rimMoon.position.set(6, 12, 6);
        rimMoon.castShadow = true;
        this.scene.add(rimMoon);
    }

    buildDungeonHall() {
        // Textured-look dark stone floor using subtle tile blocks
        const floorGeo = new THREE.PlaneGeometry(44, 48);
        const floorMat = new THREE.MeshLambertMaterial({ color: 0x111622, flatShading: true });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Subtle stone grid seams
        const grid = new THREE.GridHelper(44, 22, 0x263248, 0x171f2e);
        grid.position.y = 0.015;
        this.scene.add(grid);

        // Raised stone causeway leading to the Runic Arch
        const slabMat = new THREE.MeshLambertMaterial({ color: 0x1c2333, flatShading: true });
        const trimMat = new THREE.MeshLambertMaterial({ color: 0x2c364d, flatShading: true });

        for (let z = 6; z >= -10; z -= 2.2) {
            const slab = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.16, 1.95), slabMat);
            slab.position.set(0, 0.08, z);
            slab.receiveShadow = true;
            this.scene.add(slab);
        }

        // Flanking colonnade pillars receding into the fog
        const pillarGeo = new THREE.BoxGeometry(1.15, 7.0, 1.15);
        const capGeo = new THREE.BoxGeometry(1.45, 0.4, 1.45);
        [-5.4, 5.4].forEach((x) => {
            [-1, -6.5].forEach((z) => {
                const pillar = new THREE.Mesh(pillarGeo, slabMat);
                pillar.position.set(x, 3.5, z);
                pillar.castShadow = true;
                pillar.receiveShadow = true;
                this.scene.add(pillar);

                const cap = new THREE.Mesh(capGeo, trimMat);
                cap.position.set(x, 0.2, z);
                this.scene.add(cap);
            });
        });
    }

    buildPortalArch() {
        const archGroup = new THREE.Group();
        archGroup.position.set(0, 0, -10.5);

        const stoneMat = new THREE.MeshLambertMaterial({ color: 0x202737, flatShading: true });
        const darkMetalMat = new THREE.MeshLambertMaterial({ color: 0x161a24, flatShading: true });

        // Left & Right arch piers
        [-3.1, 3.1].forEach((x) => {
            const pier = new THREE.Mesh(new THREE.BoxGeometry(1.5, 5.8, 1.4), stoneMat);
            pier.position.set(x, 2.9, 0);
            pier.castShadow = true;
            pier.receiveShadow = true;
            archGroup.add(pier);
        });

        // Stone Archway segments + glowing cyan rune tablets
        const segmentCount = 9;
        for (let i = 0; i < segmentCount; i++) {
            const t = i / (segmentCount - 1);
            const angle = Math.PI * (0.08 + t * 0.84);
            const radius = 3.2;
            const x = Math.cos(angle) * radius;
            const y = 4.2 + Math.sin(angle) * 2.5;

            const block = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.95, 1.35), stoneMat);
            block.position.set(x, y, 0);
            block.rotation.z = angle - Math.PI / 2;
            archGroup.add(block);

            // Alternating glowing rune inlays matching the logo's stone arch
            if (i % 2 === 1) {
                const runeMat = new THREE.MeshBasicMaterial({
                    color: 0x38bdf8,
                    transparent: true,
                    opacity: 0.85
                });
                const rune = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.08), runeMat);
                rune.position.set(x, y, 0.7);
                rune.rotation.z = angle - Math.PI / 2 + Math.PI / 4;
                archGroup.add(rune);
                this.runeMeshes.push(rune);
            }
        }

        // Raised iron portcullis spikes at top of archway
        for (let x = -2.0; x <= 2.0; x += 0.5) {
            const bar = new THREE.Mesh(
                new THREE.CylinderGeometry(0.05, 0.05, 2.1, 6),
                darkMetalMat
            );
            bar.position.set(x, 4.9, 0);
            archGroup.add(bar);
        }

        // Altar dais inside the gate
        const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.0, 0.45, 8), stoneMat);
        dais.position.set(0, 0.22, 0.3);
        dais.receiveShadow = true;
        archGroup.add(dais);

        // Levitating Phusza Arcane Crystal
        const crystalGeo = new THREE.OctahedronGeometry(0.95, 0);
        crystalGeo.scale(0.68, 1.45, 0.68);
        const crystalMat = new THREE.MeshPhongMaterial({
            color: 0x38bdf8,
            emissive: 0x0ea5e9,
            emissiveIntensity: 0.95,
            shininess: 90,
            flatShading: true,
            transparent: true,
            opacity: 0.92
        });
        this.crystal = new THREE.Mesh(crystalGeo, crystalMat);
        this.crystal.position.set(0, 2.55, 0.3);
        archGroup.add(this.crystal);

        // Rotating arcane rune ring around crystal
        const haloGeo = new THREE.TorusGeometry(1.45, 0.035, 6, 36);
        const haloMat = new THREE.MeshBasicMaterial({
            color: 0x7dd3fc,
            transparent: true,
            opacity: 0.72
        });
        this.crystalHalo = new THREE.Mesh(haloGeo, haloMat);
        this.crystalHalo.position.set(0, 2.55, 0.3);
        this.crystalHalo.rotation.x = Math.PI * 0.35;
        archGroup.add(this.crystalHalo);

        // Cyan point light illuminating the gate
        this.crystalLight = new THREE.PointLight(0x38bdf8, 3.2, 22);
        this.crystalLight.position.set(0, 2.6, 1.4);
        archGroup.add(this.crystalLight);

        this.scene.add(archGroup);
    }

    buildBraziers() {
        const positions = [
            { x: -4.4, y: 0, z: -8.6, scale: 1.0 },
            { x: 4.4, y: 0, z: -8.6, scale: 1.0 },
            { x: -4.2, y: 0, z: 1.2, scale: 0.9 },
            { x: 4.2, y: 0, z: 1.2, scale: 0.9 }
        ];

        const stoneMat = new THREE.MeshLambertMaterial({ color: 0x252c3c, flatShading: true });
        const bronzeMat = new THREE.MeshLambertMaterial({ color: 0x7c5820, flatShading: true });

        positions.forEach((p) => {
            const g = new THREE.Group();
            g.position.set(p.x, p.y, p.z);
            g.scale.setScalar(p.scale);

            const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.62, 1.25, 8), stoneMat);
            pedestal.position.y = 0.62;
            pedestal.castShadow = true;
            g.add(pedestal);

            const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.38, 0.42, 8), bronzeMat);
            bowl.position.y = 1.38;
            g.add(bowl);

            const outerFlame = new THREE.Mesh(
                new THREE.ConeGeometry(0.38, 0.95, 6),
                new THREE.MeshBasicMaterial({ color: 0xff6a00, transparent: true, opacity: 0.9 })
            );
            outerFlame.position.y = 1.95;
            g.add(outerFlame);

            const innerFlame = new THREE.Mesh(
                new THREE.ConeGeometry(0.22, 0.62, 5),
                new THREE.MeshBasicMaterial({ color: 0xffdd55 })
            );
            innerFlame.position.y = 1.85;
            g.add(innerFlame);

            const light = new THREE.PointLight(0xff8c24, 2.2, 13);
            light.position.set(0, 2.2, 0.2);
            g.add(light);

            this.braziers.push({ light, outerFlame, innerFlame, baseIntensity: 2.2 });
            this.scene.add(g);
        });
    }

    buildParticles() {
        // Warm golden fire embers (RuneScape login vibe)
        const emberCount = 110;
        const emberGeo = new THREE.BufferGeometry();
        const emberPos = new Float32Array(emberCount * 3);
        const emberData = [];

        for (let i = 0; i < emberCount; i++) {
            const side = i % 2 === 0 ? -1 : 1;
            const spread = 1.5 + Math.random() * 6.5;
            emberPos[i * 3] = side * spread + (Math.random() - 0.5) * 2.0;
            emberPos[i * 3 + 1] = Math.random() * 7.5;
            emberPos[i * 3 + 2] = -10 + Math.random() * 14;
            emberData.push({
                speedY: 0.45 + Math.random() * 0.95,
                phase: Math.random() * Math.PI * 2,
                sway: 0.25 + Math.random() * 0.4
            });
        }
        emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
        const emberMat = new THREE.PointsMaterial({
            color: 0xffaa33,
            size: 0.08,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.embers = new THREE.Points(emberGeo, emberMat);
        this.embers.userData = { emberData };
        this.scene.add(this.embers);

        // Cool cyan arcane motes (Phusza crystal / WoW portal vibe)
        const moteCount = 85;
        const moteGeo = new THREE.BufferGeometry();
        const motePos = new Float32Array(moteCount * 3);
        const moteData = [];

        for (let i = 0; i < moteCount; i++) {
            motePos[i * 3] = (Math.random() - 0.5) * 9;
            motePos[i * 3 + 1] = 0.5 + Math.random() * 6.5;
            motePos[i * 3 + 2] = -12 + Math.random() * 12;
            moteData.push({
                speedY: 0.18 + Math.random() * 0.42,
                phase: Math.random() * Math.PI * 2
            });
        }
        moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
        const moteMat = new THREE.PointsMaterial({
            color: 0x38bdf8,
            size: 0.09,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.motes = new THREE.Points(moteGeo, moteMat);
        this.motes.userData = { moteData };
        this.scene.add(this.motes);
    }

    bindEvents() {
        this._onResize = () => this.resize();
        window.addEventListener('resize', this._onResize);

        this._onPointerMove = (e) => {
            if (!this.active) return;
            const nx = (e.clientX / window.innerWidth) * 2 - 1;
            const ny = (e.clientY / window.innerHeight) * 2 - 1;
            this.pointer.targetX = nx * 0.65;
            this.pointer.targetY = -ny * 0.32;
        };
        window.addEventListener('pointermove', this._onPointerMove);
    }

    resize() {
        if (!this.renderer || !this.camera || !this.container) return;
        const width = this.container.clientWidth || window.innerWidth;
        const height = this.container.clientHeight || window.innerHeight;
        if (width === 0 || height === 0) return;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    pulseCrystal() {
        this.crystalPulse = 1.0;
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

    animate() {
        if (!this.active) return;
        this.rafId = requestAnimationFrame(() => this.animate());

        const delta = Math.min(this.clock.getDelta(), 0.1);
        const t = this.clock.getElapsedTime();

        // Smooth camera parallax + subtle breathing drift
        this.pointer.x += (this.pointer.targetX - this.pointer.x) * 0.04;
        this.pointer.y += (this.pointer.targetY - this.pointer.y) * 0.04;

        this.camera.position.x = this.pointer.x + Math.sin(t * 0.35) * 0.25;
        this.camera.position.y = 2.7 + this.pointer.y + Math.cos(t * 0.45) * 0.08;
        this.camera.position.z = 8.2 + Math.sin(t * 0.22) * 0.3;
        this.camera.lookAt(0, 2.35, -10.2);

        // Crystal & arcane halo animation
        if (this.crystalPulse > 0) {
            this.crystalPulse = Math.max(0, this.crystalPulse - delta * 1.4);
        }

        if (this.crystal) {
            this.crystal.rotation.y += delta * (0.75 + this.crystalPulse * 3.5);
            this.crystal.position.y = 2.55 + Math.sin(t * 1.7) * 0.18;
            const s = 1 + this.crystalPulse * 0.22;
            this.crystal.scale.setScalar(s);
        }

        if (this.crystalHalo) {
            this.crystalHalo.rotation.z += delta * (0.65 + this.crystalPulse * 2.5);
            this.crystalHalo.rotation.y = Math.sin(t * 0.6) * 0.35;
        }

        if (this.crystalLight) {
            this.crystalLight.intensity = 3.0 + Math.sin(t * 2.6) * 0.5 + this.crystalPulse * 3.5;
        }

        // Arch runes gentle pulse
        this.runeMeshes.forEach((r, idx) => {
            r.material.opacity = 0.55 + Math.sin(t * 2.2 + idx * 0.9) * 0.3 + this.crystalPulse * 0.2;
        });

        // Brazier fire flicker
        this.braziers.forEach((b, i) => {
            const flicker = Math.sin(t * 9.5 + i * 2.1) * 0.25 + Math.cos(t * 17.3 + i) * 0.15;
            b.light.intensity = b.baseIntensity + flicker;
            b.outerFlame.scale.set(1 + flicker * 0.12, 1 + flicker * 0.35, 1 + flicker * 0.12);
            b.innerFlame.scale.set(1 - flicker * 0.08, 1 + flicker * 0.25, 1 - flicker * 0.08);
        });

        // Rising embers
        if (this.embers) {
            const pos = this.embers.geometry.attributes.position.array;
            const data = this.embers.userData.emberData;
            for (let i = 0; i < data.length; i++) {
                pos[i * 3 + 1] += data[i].speedY * delta;
                pos[i * 3] += Math.sin(t * 1.6 + data[i].phase) * data[i].sway * delta;
                if (pos[i * 3 + 1] > 7.8) {
                    pos[i * 3 + 1] = 0.2;
                }
            }
            this.embers.geometry.attributes.position.needsUpdate = true;
        }

        // Floating cyan motes
        if (this.motes) {
            const pos = this.motes.geometry.attributes.position.array;
            const data = this.motes.userData.moteData;
            for (let i = 0; i < data.length; i++) {
                pos[i * 3 + 1] += data[i].speedY * delta;
                pos[i * 3] += Math.cos(t * 0.9 + data[i].phase) * 0.22 * delta;
                if (pos[i * 3 + 1] > 7.2) {
                    pos[i * 3 + 1] = 0.4;
                }
            }
            this.motes.geometry.attributes.position.needsUpdate = true;
        }

        this.renderer.render(this.scene, this.camera);
    }
}
