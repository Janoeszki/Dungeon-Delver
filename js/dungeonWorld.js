import * as THREE from '../vendor/three.module.js';
import { CharacterBuilder } from './characterBuilder.js';
import { sound } from './audio.js';
import { ENCOUNTERS } from './encounters.js';

/**
 * 3D Dungeon Crawl Adventure World
 * Point-and-Click navigation, camera tracking, interactive POIs and character locomotion.
 */
export class DungeonWorldApp {
    constructor(container, heroConfig, onEncounterTrigger, onPlayerStatsUpdate) {
        this.container = container;
        this.heroConfig = heroConfig;
        this.onEncounterTrigger = onEncounterTrigger;
        this.onPlayerStatsUpdate = onPlayerStatsUpdate;

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        this.builder = new CharacterBuilder();

        // Player state
        this.player = null;
        this.playerModel = null;
        this.isMoving = false;
        this.targetPos = new THREE.Vector3(0, 0, 8);
        this.moveSpeed = 5.2;
        this.walkCycle = 0;
        this.footstepTimer = 0;

        // Interactive entities & props
        this.interactables = [];
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.floorPlane = null;
        this.activeEncounterId = null;

        // Click waypoint reticle
        this.clickReticle = null;
        this.torches = [];
        this.disposed = false;
        this.rafId = null;
        this._onResize = null;

        this.initScene();
        this.buildDungeonEnvironment();
        this.spawnEncounters();
        this.spawnPlayer();
        this.setupEventListeners();
        this.animate();
    }

    initScene() {
        const width = this.container.clientWidth || window.innerWidth;
        const height = this.container.clientHeight || window.innerHeight;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0d14);
        this.scene.fog = new THREE.FogExp2(0x0a0d14, 0.045);

        // Isometric perspective camera
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        this.camera.position.set(0, 14, 18);
        this.camera.lookAt(0, 0, 8);

        // WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Ambient & Directional Lighting
        const ambientLight = new THREE.AmbientLight(0x3a4b6e, 0.75);
        this.scene.add(ambientLight);

        const moonLight = new THREE.DirectionalLight(0x7eb0d5, 0.9);
        moonLight.position.set(12, 22, 12);
        moonLight.castShadow = true;
        moonLight.shadow.mapSize.width = 1024;
        moonLight.shadow.mapSize.height = 1024;
        moonLight.shadow.camera.near = 0.5;
        moonLight.shadow.camera.far = 50;
        moonLight.shadow.camera.left = -20;
        moonLight.shadow.camera.right = 20;
        moonLight.shadow.camera.top = 20;
        moonLight.shadow.camera.bottom = -20;
        this.scene.add(moonLight);

        // Click Reticle (Pulsing diamond waypoint)
        const reticleGeo = new THREE.RingGeometry(0.3, 0.42, 4);
        const reticleMat = new THREE.MeshBasicMaterial({
            color: 0xffcf40,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0
        });
        this.clickReticle = new THREE.Mesh(reticleGeo, reticleMat);
        this.clickReticle.rotation.x = -Math.PI / 2;
        this.clickReticle.position.y = 0.04;
        this.scene.add(this.clickReticle);
    }

    buildDungeonEnvironment() {
        // Floor Plane
        const floorGeo = new THREE.PlaneGeometry(36, 48);
        const floorMat = new THREE.MeshLambertMaterial({
            color: 0x1f2430,
            flatShading: true
        });
        this.floorPlane = new THREE.Mesh(floorGeo, floorMat);
        this.floorPlane.rotation.x = -Math.PI / 2;
        this.floorPlane.receiveShadow = true;
        this.floorPlane.name = 'WalkableFloor';
        this.scene.add(this.floorPlane);

        // Stone Tile Grid Pattern
        const gridHelper = new THREE.GridHelper(36, 18, 0x334155, 0x1e293b);
        gridHelper.position.y = 0.02;
        this.scene.add(gridHelper);

        // Perimeter Walls
        const wallMat = new THREE.MeshLambertMaterial({ color: 0x181e2b, flatShading: true });
        const trimMat = new THREE.MeshLambertMaterial({ color: 0x2d3748, flatShading: true });

        const makeWall = (x, z, w, h, d) => {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
            wall.position.set(x, h / 2, z);
            wall.castShadow = true;
            wall.receiveShadow = true;
            this.scene.add(wall);

            const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.4, d + 0.1), trimMat);
            trim.position.set(x, h, z);
            this.scene.add(trim);
        };

        // Outer bounds
        makeWall(0, -22, 36, 4.5, 1.2);    // Far North Wall
        makeWall(0, 16, 36, 3.5, 1.2);     // South Entrance Wall
        makeWall(-15, -3, 1.2, 4.0, 38);   // West Wall
        makeWall(15, -3, 1.2, 4.0, 38);    // East Wall

        // Interior Arch dividing Outer Hall from Royal Crypt
        makeWall(-8, -7, 12, 4.0, 1.0);
        makeWall(8, -7, 12, 4.0, 1.0);

        // Pillars with Flickering Torches
        const pillarPositions = [
            { x: -5, z: 5 }, { x: 5, z: 5 },
            { x: -5, z: -1 }, { x: 5, z: -1 },
            { x: -5, z: -13 }, { x: 5, z: -13 }
        ];

        const pillarGeo = new THREE.BoxGeometry(0.9, 4.2, 0.9);
        const pillarMat = new THREE.MeshLambertMaterial({ color: 0x283244, flatShading: true });

        pillarPositions.forEach(p => {
            const pillar = new THREE.Mesh(pillarGeo, pillarMat);
            pillar.position.set(p.x, 2.1, p.z);
            pillar.castShadow = true;
            pillar.receiveShadow = true;
            this.scene.add(pillar);

            // Torch sconce on pillar
            this.createTorch(p.x, 2.5, p.z + 0.55);
        });
    }

    createTorch(x, y, z) {
        const torchGroup = new THREE.Group();
        torchGroup.position.set(x, y, z);

        // Sconce bracket
        const bracketGeo = new THREE.BoxGeometry(0.12, 0.25, 0.22);
        const bracketMat = new THREE.MeshLambertMaterial({ color: 0x111116 });
        const bracket = new THREE.Mesh(bracketGeo, bracketMat);
        torchGroup.add(bracket);

        // Flame mesh
        const flameGeo = new THREE.ConeGeometry(0.09, 0.22, 5);
        const flameMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        const flame = new THREE.Mesh(flameGeo, flameMat);
        flame.position.set(0, 0.16, 0.08);
        torchGroup.add(flame);

        // Dynamic warm light
        const light = new THREE.PointLight(0xff9922, 1.4, 8);
        light.position.set(0, 0.2, 0.12);
        light.castShadow = false;
        torchGroup.add(light);

        this.torches.push({ light, flame, baseIntensity: 1.4 });
        this.scene.add(torchGroup);
    }

    spawnEncounters() {
        ENCOUNTERS.forEach(enc => {
            const propGroup = new THREE.Group();
            propGroup.position.set(enc.pos.x, 0, enc.pos.z);
            propGroup.userData = { encounterId: enc.id, isEncounter: true };

            // Build distinct 3D visual prop per encounter
            if (enc.id === 'portcullis') {
                // Iron Portcullis Bars
                const gate = new THREE.Group();
                gate.name = 'GateMesh';
                for (let i = -1.5; i <= 1.5; i += 0.38) {
                    const bar = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.04, 0.04, 3.8, 6),
                        new THREE.MeshLambertMaterial({ color: 0x3d4352, flatShading: true })
                    );
                    bar.position.set(i, 1.9, 0);
                    gate.add(bar);
                }
                const crossbar1 = new THREE.Mesh(
                    new THREE.BoxGeometry(3.4, 0.1, 0.1),
                    new THREE.MeshLambertMaterial({ color: 0x232733 })
                );
                crossbar1.position.y = 1.0;
                const crossbar2 = crossbar1.clone();
                crossbar2.position.y = 2.8;
                gate.add(crossbar1, crossbar2);
                propGroup.add(gate);

            } else if (enc.id === 'sarcophagus') {
                // Stone Sarcophagus
                const coffin = new THREE.Mesh(
                    new THREE.BoxGeometry(1.4, 0.7, 2.4),
                    new THREE.MeshLambertMaterial({ color: 0x3d4454, flatShading: true })
                );
                coffin.position.y = 0.35;
                coffin.castShadow = true;

                const lid = new THREE.Mesh(
                    new THREE.BoxGeometry(1.5, 0.18, 2.5),
                    new THREE.MeshLambertMaterial({ color: 0x4e576d, flatShading: true })
                );
                lid.position.y = 0.79;
                lid.name = 'LidMesh';
                propGroup.add(coffin, lid);

            } else if (enc.id === 'monolith') {
                // Floating Arcane Monolith
                const obelisk = new THREE.Mesh(
                    new THREE.OctahedronGeometry(0.8, 0),
                    new THREE.MeshLambertMaterial({
                        color: 0x1a233a,
                        emissive: 0x1e88e5,
                        emissiveIntensity: 0.6,
                        flatShading: true
                    })
                );
                obelisk.position.y = 1.6;
                obelisk.scale.set(0.7, 1.8, 0.7);
                obelisk.name = 'ObeliskMesh';

                const ring = new THREE.Mesh(
                    new THREE.TorusGeometry(1.1, 0.03, 4, 16),
                    new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
                );
                ring.position.y = 1.6;
                ring.rotation.x = Math.PI / 3;

                const monoLight = new THREE.PointLight(0x38bdf8, 1.5, 6);
                monoLight.position.y = 1.6;

                propGroup.add(obelisk, ring, monoLight);

            } else if (enc.id === 'pit_trap') {
                // Spike Pit
                const hole = new THREE.Mesh(
                    new THREE.BoxGeometry(2.4, 0.05, 2.4),
                    new THREE.MeshBasicMaterial({ color: 0x05070a })
                );
                hole.position.y = 0.02;

                const rim = new THREE.Mesh(
                    new THREE.RingGeometry(1.2, 1.45, 4),
                    new THREE.MeshLambertMaterial({ color: 0x7c2d12, side: THREE.DoubleSide })
                );
                rim.rotation.x = -Math.PI / 2;
                rim.position.y = 0.03;
                propGroup.add(hole, rim);

            } else if (enc.id === 'skeleton') {
                // Skeletal Vanguard
                const skelGroup = new THREE.Group();
                skelGroup.name = 'SkeletonMesh';

                const boneMat = new THREE.MeshLambertMaterial({ color: 0xdde2ea, flatShading: true });
                const skull = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), boneMat);
                skull.position.y = 1.5;

                const eyeGlow = new THREE.Mesh(
                    new THREE.BoxGeometry(0.08, 0.08, 0.04),
                    new THREE.MeshBasicMaterial({ color: 0xef4444 })
                );
                const eye1 = eyeGlow.clone(); eye1.position.set(-0.12, 1.52, 0.24);
                const eye2 = eyeGlow.clone(); eye2.position.set(0.12, 1.52, 0.24);

                const ribcage = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.35), boneMat);
                ribcage.position.y = 0.95;

                const halberd = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6),
                    new THREE.MeshLambertMaterial({ color: 0x5a422d })
                );
                halberd.position.set(0.45, 1.1, 0.2);

                const blade = new THREE.Mesh(
                    new THREE.BoxGeometry(0.25, 0.5, 0.04),
                    new THREE.MeshLambertMaterial({ color: 0x94a3b8 })
                );
                blade.position.set(0.45, 2.0, 0.2);

                skelGroup.add(skull, eye1, eye2, ribcage, halberd, blade);
                propGroup.add(skelGroup);

            } else if (enc.id === 'moonwell') {
                // Sacred Moonwell
                const basin = new THREE.Mesh(
                    new THREE.CylinderGeometry(1.2, 1.3, 0.6, 12),
                    new THREE.MeshLambertMaterial({ color: 0xd8e2dc, flatShading: true })
                );
                basin.position.y = 0.3;

                const water = new THREE.Mesh(
                    new THREE.CylinderGeometry(1.05, 1.05, 0.05, 12),
                    new THREE.MeshBasicMaterial({ color: 0x2dd4bf })
                );
                water.position.y = 0.58;

                const wellLight = new THREE.PointLight(0x2dd4bf, 1.2, 5);
                wellLight.position.y = 0.8;

                propGroup.add(basin, water, wellLight);

            } else if (enc.id === 'grand_chest') {
                // Crown Vault Chest
                const chestBase = new THREE.Mesh(
                    new THREE.BoxGeometry(1.4, 0.7, 0.9),
                    new THREE.MeshLambertMaterial({ color: 0x7c4f1c, flatShading: true })
                );
                chestBase.position.y = 0.35;

                const goldTrim = new THREE.Mesh(
                    new THREE.BoxGeometry(1.44, 0.74, 0.94),
                    new THREE.MeshLambertMaterial({ color: 0xf59e0b, wireframe: true })
                );
                goldTrim.position.y = 0.35;

                const chestLid = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.46, 0.46, 1.4, 8),
                    new THREE.MeshLambertMaterial({ color: 0x925e24, flatShading: true })
                );
                chestLid.position.set(0, 0.7, 0);
                chestLid.rotation.z = Math.PI / 2;
                chestLid.name = 'ChestLid';

                const lock = new THREE.Mesh(
                    new THREE.BoxGeometry(0.2, 0.25, 0.1),
                    new THREE.MeshLambertMaterial({ color: 0xffd700 })
                );
                lock.position.set(0, 0.5, 0.48);

                propGroup.add(chestBase, goldTrim, chestLid, lock);
            }

            // Floating 3D POI Beacon Marker
            const beacon = this.createBeaconMarker(enc.icon);
            beacon.position.y = 2.4;
            beacon.name = 'Beacon';
            propGroup.add(beacon);

            this.scene.add(propGroup);
            this.interactables.push({ enc, group: propGroup });
        });
    }

    createBeaconMarker(iconText) {
        const beacon = new THREE.Group();

        // Pulsing glowing octahedron diamond
        const diamondGeo = new THREE.OctahedronGeometry(0.22, 0);
        const diamondMat = new THREE.MeshBasicMaterial({
            color: 0xffcf40,
            wireframe: false
        });
        const diamond = new THREE.Mesh(diamondGeo, diamondMat);
        beacon.add(diamond);

        const outerRing = new THREE.Mesh(
            new THREE.TorusGeometry(0.36, 0.02, 4, 16),
            new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
        );
        outerRing.rotation.x = Math.PI / 2;
        beacon.add(outerRing);

        return beacon;
    }

    spawnPlayer() {
        this.player = new THREE.Group();
        this.player.position.set(0, 0, 10); // Start at South entrance

        this.playerModel = this.builder.createCharacter(this.heroConfig);
        this.player.add(this.playerModel.group);
        this.scene.add(this.player);

        this.targetPos.copy(this.player.position);
    }

    setupEventListeners() {
        this._onResize = () => {
            if (this.disposed) return;
            const width = this.container.clientWidth;
            const height = this.container.clientHeight;
            if (width <= 0 || height <= 0) return;
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        };
        window.addEventListener('resize', this._onResize);

        // Click to Move / Click to Interact
        this.renderer.domElement.addEventListener('pointerdown', (e) => {
            // Calculate pointer in normalized coordinates
            const rect = this.renderer.domElement.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);

            // 1. Check if clicked an encounter prop
            const propHits = this.raycaster.intersectObjects(this.scene.children, true);
            let clickedEncounter = null;

            for (const hit of propHits) {
                let obj = hit.object;
                while (obj && obj !== this.scene) {
                    if (obj.userData && obj.userData.encounterId) {
                        clickedEncounter = obj.userData.encounterId;
                        break;
                    }
                    obj = obj.parent;
                }
                if (clickedEncounter) break;
            }

            if (clickedEncounter) {
                const enc = ENCOUNTERS.find(item => item.id === clickedEncounter);
                if (enc) {
                    // Set move target right in front of the encounter
                    this.setMoveTarget(new THREE.Vector3(enc.pos.x, 0, enc.pos.z + 1.8));
                    return;
                }
            }

            // 2. Clicked ground plane
            const floorHits = this.raycaster.intersectObject(this.floorPlane);
            if (floorHits.length > 0) {
                const point = floorHits[0].point;
                this.setMoveTarget(point);
            }
        });
    }

    setMoveTarget(dest) {
        // Clamp destination to dungeon walls bounds
        const clampedX = THREE.MathUtils.clamp(dest.x, -13.5, 13.5);
        const clampedZ = THREE.MathUtils.clamp(dest.z, -19.5, 14.5);

        this.targetPos.set(clampedX, 0, clampedZ);
        this.isMoving = true;
        sound.playSelect();

        // Position click reticle
        if (this.clickReticle) {
            this.clickReticle.position.set(clampedX, 0.05, clampedZ);
            this.clickReticle.material.opacity = 0.9;
            this.clickReticle.scale.set(1.5, 1.5, 1.5);
        }
    }

    updatePlayerLocomotion(delta) {
        if (!this.player) return;

        const dist = this.player.position.distanceTo(this.targetPos);

        if (this.isMoving && dist > 0.15) {
            // Direction to target
            const dir = new THREE.Vector3().subVectors(this.targetPos, this.player.position).normalize();

            // Rotate smoothly toward movement direction
            const targetAngle = Math.atan2(dir.x, dir.z);
            let diff = targetAngle - this.player.rotation.y;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            this.player.rotation.y += diff * 0.18;

            // Move forward
            const step = Math.min(dist, this.moveSpeed * delta);
            this.player.position.addScaledVector(dir, step);

            // Procedural Walk Cycle Animation
            this.walkCycle += delta * 12;
            const swing = Math.sin(this.walkCycle);

            if (this.playerModel && this.playerModel.animState) {
                const anim = this.playerModel.animState;
                if (anim.leftLeg) anim.leftLeg.rotation.x = swing * 0.55;
                if (anim.rightLeg) anim.rightLeg.rotation.x = -swing * 0.55;
                if (anim.leftArm) anim.leftArm.rotation.x = -swing * 0.45;
                if (anim.rightArm) anim.rightArm.rotation.x = swing * 0.45;
                if (anim.torso) anim.torso.position.y = Math.abs(swing) * 0.06;

                // Feline tail run-bob
                if (anim.tail) {
                    anim.tail.rotation.x = -0.4 + Math.abs(swing) * 0.15;
                    anim.tail.rotation.y = Math.sin(this.walkCycle * 0.5) * 0.35;
                }
            }

            // Footstep sounds
            this.footstepTimer += delta;
            if (this.footstepTimer > 0.28) {
                sound.playStep();
                this.footstepTimer = 0;
            }

            // Check if player reached proximity of any POI (within 2.2 units)
            this.checkEncounterProximity();

        } else {
            // Stopped: return limbs to idle stance
            this.isMoving = false;
            if (this.playerModel) {
                this.playerModel.update(delta);
                // Return legs toward 0 rotation
                const anim = this.playerModel.animState;
                if (anim && anim.leftLeg) anim.leftLeg.rotation.x *= 0.8;
                if (anim && anim.rightLeg) anim.rightLeg.rotation.x *= 0.8;
            }
        }
    }

    checkEncounterProximity() {
        for (const item of this.interactables) {
            const enc = item.enc;
            const encPos = new THREE.Vector3(enc.pos.x, 0, enc.pos.z);
            const dist = this.player.position.distanceTo(encPos);

            // Trigger when close and not already active
            if (dist < 2.3 && this.activeEncounterId !== enc.id && !enc.resolved) {
                this.activeEncounterId = enc.id;
                this.isMoving = false; // pause movement
                this.onEncounterTrigger(enc);
                break;
            }
        }
    }

    resolveEncounterVisual(encounterId, success) {
        const item = this.interactables.find(i => i.enc.id === encounterId);
        if (!item) return;

        item.enc.resolved = true;
        this.activeEncounterId = null;

        // Visual change on the prop
        if (encounterId === 'portcullis' && success) {
            // Lift gate upwards
            const gateMesh = item.group.getObjectByName('GateMesh');
            if (gateMesh) gateMesh.position.y = 3.6;
        } else if (encounterId === 'sarcophagus' && success) {
            const lid = item.group.getObjectByName('LidMesh');
            if (lid) lid.position.set(0.6, 0.79, 0.4);
        } else if (encounterId === 'skeleton' && success) {
            const skel = item.group.getObjectByName('SkeletonMesh');
            if (skel) skel.visible = false;
        } else if (encounterId === 'grand_chest' && success) {
            const lid = item.group.getObjectByName('ChestLid');
            if (lid) lid.rotation.x = -Math.PI / 3;
        }

        // Hide or dim the beacon
        const beacon = item.group.getObjectByName('Beacon');
        if (beacon) beacon.visible = false;
    }

    dispose() {
        this.disposed = true;
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        if (this._onResize) {
            window.removeEventListener('resize', this._onResize);
        }
        if (this.renderer) {
            this.renderer.dispose();
        }
    }

    animate() {
        if (this.disposed) return;
        this.rafId = requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime();

        // Update player walk / idle
        this.updatePlayerLocomotion(delta);

        // Smooth Camera Follow
        if (this.player) {
            const targetCamX = this.player.position.x;
            const targetCamZ = this.player.position.z + 10;
            this.camera.position.x += (targetCamX - this.camera.position.x) * 0.08;
            this.camera.position.z += (targetCamZ - this.camera.position.z) * 0.08;
            this.camera.lookAt(this.player.position.x, 1.0, this.player.position.z);
        }

        // Flickering Torch Lights
        this.torches.forEach((t, i) => {
            const flicker = Math.sin(time * 8 + i * 2.5) * 0.15 + Math.cos(time * 15 + i) * 0.1;
            t.light.intensity = t.baseIntensity + flicker;
            t.flame.scale.y = 1.0 + flicker * 0.4;
        });

        // Beacon rotation & bobbing
        this.interactables.forEach((item, i) => {
            const beacon = item.group.getObjectByName('Beacon');
            if (beacon && beacon.visible) {
                beacon.rotation.y += delta * 1.8;
                beacon.position.y = 2.4 + Math.sin(time * 3 + i) * 0.12;
            }
        });

        // Reticle fade
        if (this.clickReticle && this.clickReticle.material.opacity > 0) {
            this.clickReticle.material.opacity -= delta * 1.5;
            this.clickReticle.scale.multiplyScalar(0.98);
        }

        this.renderer.render(this.scene, this.camera);
    }
}
