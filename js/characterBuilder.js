import * as THREE from '../vendor/three.module.js';

/**
 * Procedural Low-Poly RuneScape (OSRS) Style Character Generator
 * Builds faceted polygonal Human, Elf, Dwarf, Orc, Goblin, and Catfolk models
 * with Warrior and Mage equipment.
 */
export class CharacterBuilder {
    constructor() {
        this.materials = {};
        this.initMaterials();
    }

    initMaterials() {
        // Faceted flat-shaded materials for classic low-poly RuneScape aesthetics
        this.materials = {
            skin: new THREE.MeshLambertMaterial({ color: 0xffd2b2, flatShading: true }),
            hair: new THREE.MeshLambertMaterial({ color: 0x4a2e1b, flatShading: true }),
            eyes: new THREE.MeshBasicMaterial({ color: 0x1b1b22 }),
            eyeGlint: new THREE.MeshBasicMaterial({ color: 0xffffff }),
            mouth: new THREE.MeshBasicMaterial({ color: 0x7c3636 }),
            cloth: new THREE.MeshLambertMaterial({ color: 0x2b4c7e, flatShading: true }),
            clothAccent: new THREE.MeshLambertMaterial({ color: 0xd97724, flatShading: true }),
            belt: new THREE.MeshLambertMaterial({ color: 0x2c1d11, flatShading: true }),
            buckle: new THREE.MeshPhongMaterial({
                color: 0xffd700,
                shininess: 32,
                specular: 0xfff3b0,
                flatShading: true
            }),
            armorMetal: new THREE.MeshPhongMaterial({
                color: 0x95a5a6,
                shininess: 28,
                specular: 0xcbd5e1,
                flatShading: true
            }),
            armorGold: new THREE.MeshPhongMaterial({
                color: 0xf1c40f,
                shininess: 32,
                specular: 0xfff3b0,
                flatShading: true
            }),
            chainmail: new THREE.MeshLambertMaterial({ color: 0x4a5568, flatShading: true }),
            cape: new THREE.MeshLambertMaterial({ color: 0x991b1b, flatShading: true }),
            darkVisor: new THREE.MeshBasicMaterial({ color: 0x0d0f17 }),
            pageWhite: new THREE.MeshLambertMaterial({ color: 0xf4ebd0, flatShading: true }),
            leather: new THREE.MeshLambertMaterial({ color: 0x5c381e, flatShading: true }),
            wood: new THREE.MeshLambertMaterial({ color: 0x6e4720, flatShading: true }),
            blade: new THREE.MeshPhongMaterial({
                color: 0xdde5ed,
                shininess: 40,
                specular: 0xffffff,
                flatShading: true
            }),
            magicCrystal: new THREE.MeshLambertMaterial({
                color: 0x38ef7d,
                emissive: 0x11998e,
                emissiveIntensity: 0.6,
                flatShading: true
            }),
            magicOrb: new THREE.MeshLambertMaterial({
                color: 0x9b51e0,
                emissive: 0x6a0dad,
                emissiveIntensity: 0.8,
                flatShading: true
            }),
            beard: new THREE.MeshLambertMaterial({ color: 0xb55221, flatShading: true }),
            tusks: new THREE.MeshLambertMaterial({ color: 0xfffcf0, flatShading: true }),
            innerEar: new THREE.MeshLambertMaterial({ color: 0xf49ac2, flatShading: true }),
            muzzle: new THREE.MeshLambertMaterial({ color: 0xffecd2, flatShading: true }),
            catNose: new THREE.MeshBasicMaterial({ color: 0x2c1d11 })
        };
    }

    /**
     * Converts indexed geometry to non-indexed with flat face normals so every triangle
     * renders as a crisp low-poly RuneScape facet.
     */
    makeFaceted(geometry) {
        const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
        g.computeVertexNormals();
        return g;
    }

    /**
     * Builds a non-indexed faceted BufferGeometry lofted across cross-section rings.
     * Rings must be ordered from bottom (lowest y) to top (highest y) for outward normals.
     */
    createLoftedPrism(rings, radialSegments = 8, closeTop = true, closeBottom = true) {
        const positions = [];
        const pushTri = (a, b, c) => {
            positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
        };

        const ringVerts = rings.map((ring) => {
            const verts = [];
            const ox = ring.offsetX || 0;
            const oz = ring.offsetZ || 0;
            const twist = ring.twist || 0;
            for (let s = 0; s < radialSegments; s++) {
                const theta = (s / radialSegments) * Math.PI * 2 + twist;
                verts.push([
                    Math.sin(theta) * ring.rx + ox,
                    ring.y,
                    Math.cos(theta) * ring.rz + oz
                ]);
            }
            return verts;
        });

        for (let r = 0; r < rings.length - 1; r++) {
            const lower = ringVerts[r];
            const upper = ringVerts[r + 1];
            for (let s = 0; s < radialSegments; s++) {
                const sNext = (s + 1) % radialSegments;
                const p00 = lower[s];
                const p01 = lower[sNext];
                const p11 = upper[sNext];
                const p10 = upper[s];
                pushTri(p00, p01, p11);
                pushTri(p00, p11, p10);
            }
        }

        if (closeTop && rings.length > 0) {
            const lastRing = rings[rings.length - 1];
            const topVerts = ringVerts[ringVerts.length - 1];
            const centerTop = [lastRing.offsetX || 0, lastRing.y, lastRing.offsetZ || 0];
            for (let s = 0; s < radialSegments; s++) {
                const sNext = (s + 1) % radialSegments;
                pushTri(centerTop, topVerts[s], topVerts[sNext]);
            }
        }

        if (closeBottom && rings.length > 0) {
            const firstRing = rings[0];
            const botVerts = ringVerts[0];
            const centerBot = [firstRing.offsetX || 0, firstRing.y, firstRing.offsetZ || 0];
            for (let s = 0; s < radialSegments; s++) {
                const sNext = (s + 1) % radialSegments;
                pushTri(centerBot, botVerts[sNext], botVerts[s]);
            }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
        geo.computeVertexNormals();
        return geo;
    }

    getHeadWidthMultiplier(race) {
        if (race === 'orc') return 1.08;
        if (race === 'goblin') return 1.12;
        if (race === 'dwarf') return 1.04;
        if (race === 'elf') return 0.94;
        if (race === 'catfolk') return 0.98;
        return 1.0;
    }

    getTorsoWidthMultiplier(race) {
        if (race === 'orc') return 1.22;
        if (race === 'dwarf') return 1.12;
        if (race === 'goblin') return 0.85;
        if (race === 'elf') return 0.92;
        if (race === 'catfolk') return 0.94;
        return 1.0;
    }

    setColors(config) {
        if (config.skinColor) this.materials.skin.color.set(config.skinColor);
        if (config.hairColor) {
            this.materials.hair.color.set(config.hairColor);
            this.materials.beard.color.set(config.hairColor);
        }
        if (config.clothColor) {
            this.materials.cloth.color.set(config.clothColor);
            const capeColor = new THREE.Color(config.clothColor);
            const hsl = { h: 0, s: 0, l: 0 };
            capeColor.getHSL(hsl);
            capeColor.setHSL(
                (hsl.h + 0.42) % 1.0,
                Math.max(0.45, hsl.s),
                THREE.MathUtils.clamp(hsl.l * 0.85, 0.18, 0.36)
            );
            this.materials.cape.color.copy(capeColor);
        }
        if (config.armorColor) this.materials.armorMetal.color.set(config.armorColor);
    }

    createCharacter(config = {}) {
        const {
            ancestry = config.race || 'human',
            race = ancestry, // 'human', 'elf', 'dwarf', 'orc', 'goblin', 'catfolk'
            charClass = 'warrior', // 'warrior', 'mage'
            showHelm = true,
            skinColor = '#ffd2b2',
            hairColor = '#4a2e1b',
            clothColor = '#2b4c7e',
            armorColor = '#95a5a6'
        } = config;

        const effectiveAncestry = ancestry || race || 'human';

        this.setColors({ skinColor, hairColor, clothColor, armorColor });

        const characterGroup = new THREE.Group();
        characterGroup.name = 'CharacterRoot';

        // Proportions root to allow scaling without breaking world coordinates
        const modelRoot = new THREE.Group();
        modelRoot.name = 'ModelRoot';
        characterGroup.add(modelRoot);

        // Subgroups for animation
        const bodyGroup = new THREE.Group();
        bodyGroup.name = 'BodyGroup';
        modelRoot.add(bodyGroup);

        // 1. Torso & Cape
        const torsoGroup = this.buildTorso(charClass, effectiveAncestry);
        bodyGroup.add(torsoGroup);
        const cape = torsoGroup.getObjectByName('Cape') || null;

        // 2. Head & Face
        const headGroup = this.buildHead(effectiveAncestry, hairColor);
        headGroup.position.y = 1.05;
        bodyGroup.add(headGroup);

        // 3. Helm / Hat
        const headgear = this.buildHeadgear(charClass, effectiveAncestry);
        if (headgear) {
            headgear.name = 'Headgear';
            headgear.visible = showHelm;
            headGroup.add(headgear);
        }

        // 4. Ancestry-specific facial attachments
        if (effectiveAncestry === 'dwarf') {
            const beard = this.buildDwarfBeard();
            beard.position.set(0, -0.05, 0.21);
            headGroup.add(beard);
        } else if (effectiveAncestry === 'orc') {
            const orcFeatures = this.buildOrcFeatures();
            headGroup.add(orcFeatures);
        } else if (effectiveAncestry === 'catfolk') {
            const catMuzzle = this.buildCatMuzzle();
            catMuzzle.position.set(0, 0.08, 0.25);
            headGroup.add(catMuzzle);
        }

        // 5. Ears (Elf, Dwarf, Orc, Goblin, Catfolk, Human)
        const ears = this.buildEars(effectiveAncestry);
        headGroup.add(ears);

        // 6. Limbs
        const limbs = this.buildLimbs(charClass, effectiveAncestry);
        bodyGroup.add(limbs.leftArm);
        bodyGroup.add(limbs.rightArm);
        bodyGroup.add(limbs.leftLeg);
        bodyGroup.add(limbs.rightLeg);

        // 7. Catfolk Tail
        let tail = null;
        if (effectiveAncestry === 'catfolk') {
            tail = this.buildCatTail();
            tail.position.set(0, 0.25, -0.16);
            bodyGroup.add(tail);
        }

        // 8. Weapons & Off-hand
        const weapons = this.buildWeapons(charClass);
        limbs.rightHand.add(weapons.mainHand);
        limbs.leftHand.add(weapons.offHand);
        const offHandOrb = weapons.offHand.getObjectByName('MagicOrbGroup') || null;

        // Apply Race Scale & Proportions
        this.applyRaceScaling(modelRoot, effectiveAncestry);

        // Enable shadow casting for all character meshes
        characterGroup.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
            }
        });

        // Create animation controller helper
        const animState = {
            time: 0,
            race: effectiveAncestry,
            ancestry: effectiveAncestry,
            torso: torsoGroup,
            head: headGroup,
            cape,
            tail,
            leftArm: limbs.leftArm,
            rightArm: limbs.rightArm,
            leftLeg: limbs.leftLeg,
            rightLeg: limbs.rightLeg,
            mainWeapon: weapons.mainHand,
            offHandOrb,
            magicLight: weapons.magicLight
        };

        return {
            group: characterGroup,
            animState,
            config,
            update: (delta) => this.animateIdle(animState, delta)
        };
    }

    buildTorso(charClass, race) {
        const torso = new THREE.Group();
        torso.name = 'Torso';
        const w = this.getTorsoWidthMultiplier(race);
        const octTwist = Math.PI / 8;

        // V-Tapered OSRS Polygonal Chest
        const chestGeo = this.createLoftedPrism([
            { y: 0.15, rx: 0.24 * w, rz: 0.16, twist: octTwist },
            { y: 0.34, rx: 0.21 * w, rz: 0.15, twist: octTwist },
            { y: 0.66, rx: 0.35 * w, rz: 0.23, offsetZ: 0.02, twist: octTwist },
            { y: 0.86, rx: 0.37 * w, rz: 0.20, twist: octTwist },
            { y: 0.93, rx: 0.15, rz: 0.14, twist: octTwist }
        ], 8);
        const chestMat = (charClass === 'warrior') ? this.materials.armorMetal : this.materials.cloth;
        torso.add(new THREE.Mesh(chestGeo, chestMat));

        // 6-sided Skin Neck
        const neckGeo = this.makeFaceted(new THREE.CylinderGeometry(0.11, 0.135, 0.16, 6));
        const neck = new THREE.Mesh(neckGeo, this.materials.skin);
        neck.position.set(0, 0.99, 0);
        torso.add(neck);

        // Polygonal Belt
        const beltGeo = this.createLoftedPrism([
            { y: 0.24, rx: 0.245 * w, rz: 0.175, twist: octTwist },
            { y: 0.34, rx: 0.235 * w, rz: 0.17, twist: octTwist }
        ], 8);
        torso.add(new THREE.Mesh(beltGeo, this.materials.belt));

        // Faceted Diamond Gold Buckle
        const buckle = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), this.materials.buckle);
        buckle.scale.set(1.15, 0.85, 0.45);
        buckle.position.set(0, 0.29, 0.17);
        torso.add(buckle);

        if (charClass === 'warrior') {
            // Angled Chest Plastron Ridge
            const plastronGeo = this.createLoftedPrism([
                { y: 0.44, rx: 0.06, rz: 0.03, offsetZ: 0.18 },
                { y: 0.68, rx: 0.18 * w, rz: 0.05, offsetZ: 0.22 },
                { y: 0.83, rx: 0.14 * w, rz: 0.04, offsetZ: 0.18 }
            ], 4);
            torso.add(new THREE.Mesh(plastronGeo, this.materials.armorMetal));

            // Gold Sternum Crest
            const crest = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), this.materials.armorGold);
            crest.scale.set(0.9, 1.35, 0.38);
            crest.position.set(0, 0.66, 0.245);
            torso.add(crest);

            // Armored Gold Gorget Collar
            const collarGeo = this.createLoftedPrism([
                { y: 0.87, rx: 0.22 * w, rz: 0.175, twist: octTwist },
                { y: 0.95, rx: 0.17, rz: 0.16, twist: octTwist }
            ], 8);
            torso.add(new THREE.Mesh(collarGeo, this.materials.armorGold));

            // Chainmail Under-skirt Ring
            const chainGeo = this.createLoftedPrism([
                { y: 0.16, rx: 0.255 * w, rz: 0.18, twist: octTwist },
                { y: 0.25, rx: 0.245 * w, rz: 0.175, twist: octTwist }
            ], 8);
            torso.add(new THREE.Mesh(chainGeo, this.materials.chainmail));

            // Segmented Plate Tassets / Faulds around hips
            const sideTassetGeo = this.createLoftedPrism([
                { y: -0.22, rx: 0.035, rz: 0.16, twist: Math.PI / 4 },
                { y: 0.0, rx: 0.03, rz: 0.12, twist: Math.PI / 4 }
            ], 4);
            [-1, 1].forEach((side) => {
                const tasset = new THREE.Mesh(sideTassetGeo, this.materials.armorMetal);
                tasset.position.set(side * (0.24 * w), 0.24, 0);
                tasset.rotation.z = side * 0.28;
                torso.add(tasset);

                const rim = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), this.materials.armorGold);
                rim.position.set(side * (0.275 * w), 0.14, 0);
                torso.add(rim);
            });

            const frontBackTassetGeo = this.createLoftedPrism([
                { y: -0.20, rx: 0.16 * w, rz: 0.03, twist: Math.PI / 4 },
                { y: 0.0, rx: 0.11 * w, rz: 0.025, twist: Math.PI / 4 }
            ], 4);
            [-1, 1].forEach((dir) => {
                const plate = new THREE.Mesh(frontBackTassetGeo, this.materials.armorMetal);
                plate.position.set(0, 0.24, dir * 0.165);
                plate.rotation.x = -dir * 0.22;
                torso.add(plate);
            });

            // Faceted OSRS Adventurer Cape
            const cape = this.buildCape(w, 0.34 * w, race === 'catfolk');
            torso.add(cape);
        } else {
            // Mage Shoulder Mantle & Raised Back Arcane Collar
            const mantleGeo = this.createLoftedPrism([
                { y: 0.78, rx: 0.40 * w, rz: 0.24, twist: octTwist },
                { y: 0.90, rx: 0.24 * w, rz: 0.19, twist: octTwist }
            ], 8);
            torso.add(new THREE.Mesh(mantleGeo, this.materials.clothAccent));

            const highCollarGeo = this.createLoftedPrism([
                { y: 0.88, rx: 0.24 * w, rz: 0.08, offsetZ: -0.14, twist: Math.PI / 4 },
                { y: 1.04, rx: 0.29 * w, rz: 0.07, offsetZ: -0.19, twist: Math.PI / 4 }
            ], 4);
            torso.add(new THREE.Mesh(highCollarGeo, this.materials.clothAccent));

            // Flared Polygonal Robe Skirt
            const skirtGeo = this.createLoftedPrism([
                { y: -0.24, rx: 0.36 * w, rz: 0.28, twist: octTwist },
                { y: 0.02, rx: 0.30 * w, rz: 0.23, twist: octTwist },
                { y: 0.25, rx: 0.23 * w, rz: 0.17, twist: octTwist }
            ], 8);
            torso.add(new THREE.Mesh(skirtGeo, this.materials.cloth));

            const hemTrimGeo = this.createLoftedPrism([
                { y: -0.25, rx: 0.37 * w, rz: 0.29, twist: octTwist },
                { y: -0.18, rx: 0.35 * w, rz: 0.275, twist: octTwist }
            ], 8);
            torso.add(new THREE.Mesh(hemTrimGeo, this.materials.clothAccent));

            // Front Runic Tabard / Sash Strip
            const tabardGeo = this.createLoftedPrism([
                { y: -0.23, rx: 0.13, rz: 0.035, offsetZ: 0.27 },
                { y: 0.25, rx: 0.09, rz: 0.03, offsetZ: 0.175 },
                { y: 0.66, rx: 0.12, rz: 0.035, offsetZ: 0.235 },
                { y: 0.87, rx: 0.085, rz: 0.025, offsetZ: 0.195 }
            ], 4);
            torso.add(new THREE.Mesh(tabardGeo, this.materials.clothAccent));

            const runeClasp = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), this.materials.armorGold);
            runeClasp.scale.set(0.9, 1.2, 0.45);
            runeClasp.position.set(0, 0.66, 0.26);
            torso.add(runeClasp);

            // Flowing Mage Back Cape / Stole
            const cape = this.buildCape(w * 0.85, 0.26 * w, race === 'catfolk');
            torso.add(cape);
        }

        return torso;
    }

    buildCape(topFactor, bottomWidth, isShortMantle = false) {
        const capeGroup = new THREE.Group();
        capeGroup.name = 'Cape';
        capeGroup.position.set(0, 0.85, -0.19);

        const midY = isShortMantle ? -0.19 : -0.42;
        const midWidth = isShortMantle ? bottomWidth * 0.82 : bottomWidth * 0.86;
        const midZ = isShortMantle ? -0.05 : -0.09;
        const endY = isShortMantle ? -0.38 : -0.82;
        const endWidth = isShortMantle ? bottomWidth * 0.90 : bottomWidth;
        const endZ = isShortMantle ? -0.08 : -0.15;
        const tipY = isShortMantle ? -0.46 : -0.96;
        const tipZ = isShortMantle ? -0.10 : -0.17;

        const bodyGeo = this.createLoftedPrism([
            { y: endY, rx: endWidth, rz: 0.024, offsetZ: endZ, twist: Math.PI / 4 },
            { y: midY, rx: midWidth, rz: 0.028, offsetZ: midZ, twist: Math.PI / 4 },
            { y: 0.0, rx: 0.24 * topFactor, rz: 0.032, offsetZ: -0.02, twist: Math.PI / 4 }
        ], 4);
        capeGroup.add(new THREE.Mesh(bodyGeo, this.materials.cape));

        // Pointed OSRS Heraldic Cape Tail
        const tipGeo = this.createLoftedPrism([
            { y: tipY, rx: 0.03, rz: 0.015, offsetZ: tipZ, twist: Math.PI / 4 },
            { y: endY, rx: endWidth, rz: 0.024, offsetZ: endZ, twist: Math.PI / 4 }
        ], 4);
        capeGroup.add(new THREE.Mesh(tipGeo, this.materials.cape));

        // Gold Shoulder Clasps
        [-1, 1].forEach((side) => {
            const clasp = new THREE.Mesh(new THREE.OctahedronGeometry(0.052, 0), this.materials.armorGold);
            clasp.position.set(side * (0.18 * topFactor), 0.0, 0.01);
            capeGroup.add(clasp);
        });

        return capeGroup;
    }

    buildHead(race, hairColor) {
        const headGroup = new THREE.Group();
        headGroup.name = 'HeadGroup';
        const hw = this.getHeadWidthMultiplier(race);
        const octTwist = Math.PI / 8;

        // Faceted 8-sided OSRS Cranium & Jaw
        const craniumGeo = this.createLoftedPrism([
            { y: -0.08, rx: 0.18 * hw, rz: 0.17, offsetZ: 0.03, twist: octTwist },
            { y: 0.04, rx: 0.27 * hw, rz: 0.24, offsetZ: 0.02, twist: octTwist },
            { y: 0.18, rx: 0.31 * hw, rz: 0.27, offsetZ: 0.01, twist: octTwist },
            { y: 0.32, rx: 0.29 * hw, rz: 0.27, offsetZ: 0.0, twist: octTwist },
            { y: 0.43, rx: 0.22 * hw, rz: 0.23, offsetZ: -0.01, twist: octTwist }
        ], 8);
        headGroup.add(new THREE.Mesh(craniumGeo, this.materials.skin));

        // Faceted Nose (distinct per ancestry)
        if (race === 'goblin') {
            // 2-segment hooked 4-sided pyramid nose
            const bridgeGeo = this.makeFaceted(new THREE.ConeGeometry(0.065, 0.22, 4));
            const bridge = new THREE.Mesh(bridgeGeo, this.materials.skin);
            bridge.position.set(0, 0.16, 0.32);
            bridge.rotation.x = 1.48;
            headGroup.add(bridge);

            const hookGeo = this.makeFaceted(new THREE.ConeGeometry(0.045, 0.14, 4));
            const hook = new THREE.Mesh(hookGeo, this.materials.skin);
            hook.position.set(0, 0.10, 0.43);
            hook.rotation.x = 2.45;
            headGroup.add(hook);
        } else if (race !== 'catfolk') {
            // Chiseled 4-sided pyramid nose wedge
            const noseGeo = this.makeFaceted(new THREE.ConeGeometry(0.062, 0.15, 4));
            const nose = new THREE.Mesh(noseGeo, this.materials.skin);
            nose.position.set(0, 0.14, 0.27);
            nose.rotation.x = 1.38;
            headGroup.add(nose);
        }

        // Faceted Hexagonal Eyes & Glints
        const eyeGeo = this.makeFaceted(new THREE.CylinderGeometry(0.048, 0.048, 0.04, 6));
        eyeGeo.rotateX(Math.PI / 2);

        const browTilt = (race === 'orc' || race === 'dwarf' || race === 'goblin') ? -0.20 : 0.10;
        const browGeo = this.createLoftedPrism([
            { y: -0.018, rx: 0.075, rz: 0.022, twist: Math.PI / 4 },
            { y: 0.018, rx: 0.068, rz: 0.022, twist: Math.PI / 4 }
        ], 4);

        [-1, 1].forEach((side) => {
            const eye = new THREE.Mesh(eyeGeo, this.materials.eyes);
            eye.scale.set(1.08, 0.85, 1.0);
            eye.position.set(side * (0.115 * hw), 0.20, 0.245);
            eye.rotation.y = side * 0.20;
            headGroup.add(eye);

            const glint = new THREE.Mesh(new THREE.OctahedronGeometry(0.017, 0), this.materials.eyeGlint);
            glint.position.set(side * (0.115 * hw) + 0.012, 0.212, 0.266);
            headGroup.add(glint);

            const brow = new THREE.Mesh(browGeo, this.materials.hair);
            brow.position.set(side * (0.115 * hw), 0.27, 0.248);
            brow.rotation.set(0, side * 0.18, -side * browTilt);
            headGroup.add(brow);
        });

        // Faceted Mouth (hidden if catfolk, orc, or dwarf with full mustache)
        if (race !== 'catfolk' && race !== 'orc' && race !== 'dwarf') {
            const mouthGeo = this.createLoftedPrism([
                { y: -0.014, rx: 0.068, rz: 0.018, twist: Math.PI / 4 },
                { y: 0.014, rx: 0.076, rz: 0.018, twist: Math.PI / 4 }
            ], 4);
            const mouth = new THREE.Mesh(mouthGeo, this.materials.mouth);
            mouth.position.set(0, 0.04, 0.245);
            headGroup.add(mouth);
        }

        // Faceted Hair Styles
        const hair = this.buildHair(race);
        headGroup.add(hair);

        return headGroup;
    }

    buildHair(race) {
        const hairGroup = new THREE.Group();
        hairGroup.name = 'Hair';
        const hw = this.getHeadWidthMultiplier(race);
        const octTwist = Math.PI / 8;

        const addCrownCap = (topY = 0.48, extraScale = 1.0) => {
            const capGeo = this.createLoftedPrism([
                { y: 0.29, rx: 0.305 * hw * extraScale, rz: 0.285 * extraScale, offsetZ: -0.02, twist: octTwist },
                { y: 0.40, rx: 0.265 * hw * extraScale, rz: 0.255 * extraScale, offsetZ: -0.02, twist: octTwist },
                { y: topY, rx: 0.18 * hw * extraScale, rz: 0.19 * extraScale, offsetZ: -0.02, twist: octTwist }
            ], 8);
            hairGroup.add(new THREE.Mesh(capGeo, this.materials.hair));
        };

        if (race === 'elf') {
            addCrownCap(0.47, 1.02);

            // Long flowing tapered polygonal hair plume down the back
            const plumeGeo = this.createLoftedPrism([
                { y: -0.34, rx: 0.13, rz: 0.07, offsetZ: -0.23 },
                { y: 0.05, rx: 0.24, rz: 0.12, offsetZ: -0.22 },
                { y: 0.38, rx: 0.26, rz: 0.14, offsetZ: -0.14 }
            ], 6);
            hairGroup.add(new THREE.Mesh(plumeGeo, this.materials.hair));

            // Tapered temple locks
            const lockGeo = this.makeFaceted(new THREE.ConeGeometry(0.055, 0.42, 4));
            [-1, 1].forEach((side) => {
                const lock = new THREE.Mesh(lockGeo, this.materials.hair);
                lock.position.set(side * 0.24, 0.08, 0.12);
                lock.rotation.set(0.08, 0, side * -0.08);
                lock.rotation.x += Math.PI;
                hairGroup.add(lock);
            });

            // Thin 8-sided Golden Elven Circlet
            const circletGeo = this.makeFaceted(new THREE.TorusGeometry(0.268 * hw, 0.016, 4, 8));
            const circlet = new THREE.Mesh(circletGeo, this.materials.armorGold);
            circlet.rotation.set(Math.PI / 2, 0, octTwist);
            circlet.position.set(0, 0.34, 0.0);
            hairGroup.add(circlet);

            const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.032, 0), this.materials.magicCrystal);
            gem.position.set(0, 0.345, 0.262);
            hairGroup.add(gem);
        } else if (race === 'dwarf') {
            addCrownCap(0.49, 1.08);

            // Thick faceted side & back wedges
            const backWedgeGeo = this.createLoftedPrism([
                { y: 0.06, rx: 0.28 * hw, rz: 0.11, offsetZ: -0.21, twist: octTwist },
                { y: 0.36, rx: 0.31 * hw, rz: 0.13, offsetZ: -0.17, twist: octTwist }
            ], 6);
            hairGroup.add(new THREE.Mesh(backWedgeGeo, this.materials.hair));
        } else if (race === 'orc') {
            // Multi-blade jagged polygonal mohawk crest
            const bladeGeo = this.makeFaceted(new THREE.ConeGeometry(0.095, 0.26, 4));
            [
                { y: 0.46, z: 0.13, rx: 0.35, s: 0.9 },
                { y: 0.50, z: 0.01, rx: -0.05, s: 1.1 },
                { y: 0.46, z: -0.11, rx: -0.45, s: 1.0 },
                { y: 0.37, z: -0.21, rx: -0.95, s: 0.85 }
            ].forEach((b) => {
                const spike = new THREE.Mesh(bladeGeo, this.materials.hair);
                spike.position.set(0, b.y, b.z);
                spike.rotation.x = b.rx;
                spike.scale.setScalar(b.s);
                hairGroup.add(spike);
            });

            // Bound war-tail cone at the back
            const knotGeo = this.makeFaceted(new THREE.ConeGeometry(0.09, 0.32, 5));
            const knot = new THREE.Mesh(knotGeo, this.materials.hair);
            knot.position.set(0, 0.44, -0.27);
            knot.rotation.x = -2.15;
            hairGroup.add(knot);
        } else if (race === 'goblin') {
            // 3 jagged angled tuft cones atop cranium
            const tuftGeo = this.makeFaceted(new THREE.ConeGeometry(0.085, 0.22, 4));
            [
                { x: 0, y: 0.49, z: 0.02, rx: 0.1, rz: 0 },
                { x: -0.11, y: 0.45, z: -0.04, rx: -0.2, rz: 0.45 },
                { x: 0.11, y: 0.45, z: -0.04, rx: -0.2, rz: -0.45 }
            ].forEach((t) => {
                const tuft = new THREE.Mesh(tuftGeo, this.materials.hair);
                tuft.position.set(t.x, t.y, t.z);
                tuft.rotation.set(t.rx, 0, t.rz);
                hairGroup.add(tuft);
            });
        } else if (race === 'catfolk') {
            addCrownCap(0.45, 0.98);

            // Angled cheek-ruff cones
            const ruffGeo = this.makeFaceted(new THREE.ConeGeometry(0.085, 0.20, 4));
            [-1, 1].forEach((side) => {
                const ruff = new THREE.Mesh(ruffGeo, this.materials.hair);
                ruff.position.set(side * 0.29, 0.08, 0.05);
                ruff.rotation.set(0.15, 0, -side * 1.15);
                hairGroup.add(ruff);
            });
        } else {
            // Human: Classic OSRS spiky adventurer hairstyle
            addCrownCap(0.47, 1.03);

            const spikeGeo = this.makeFaceted(new THREE.ConeGeometry(0.085, 0.22, 4));
            [
                { x: -0.12, y: 0.40, z: 0.21, rx: 0.95, rz: 0.35 },
                { x: 0.0, y: 0.42, z: 0.23, rx: 1.05, rz: -0.1 },
                { x: 0.13, y: 0.40, z: 0.20, rx: 0.95, rz: -0.4 },
                { x: 0.0, y: 0.50, z: 0.04, rx: 0.35, rz: 0.0 }
            ].forEach((s) => {
                const spike = new THREE.Mesh(spikeGeo, this.materials.hair);
                spike.position.set(s.x, s.y, s.z);
                spike.rotation.set(s.rx, 0, s.rz);
                hairGroup.add(spike);
            });

            // Faceted back hair wedge
            const backGeo = this.createLoftedPrism([
                { y: 0.08, rx: 0.24 * hw, rz: 0.09, offsetZ: -0.20, twist: octTwist },
                { y: 0.36, rx: 0.29 * hw, rz: 0.12, offsetZ: -0.17, twist: octTwist }
            ], 6);
            hairGroup.add(new THREE.Mesh(backGeo, this.materials.hair));
        }

        return hairGroup;
    }

    buildEars(race) {
        const earsGroup = new THREE.Group();
        earsGroup.name = 'Ears';
        const hw = this.getHeadWidthMultiplier(race);

        if (race === 'elf') {
            // Swept multi-facet elongated pointed elf ears
            const earBaseGeo = this.makeFaceted(new THREE.ConeGeometry(0.07, 0.26, 4));
            const earTipGeo = this.makeFaceted(new THREE.ConeGeometry(0.045, 0.22, 4));
            [-1, 1].forEach((side) => {
                const ear = new THREE.Group();
                ear.position.set(side * 0.29 * hw, 0.22, -0.02);
                ear.rotation.set(-0.35, -side * 0.3, -side * 1.05);

                const base = new THREE.Mesh(earBaseGeo, this.materials.skin);
                base.position.y = 0.11;
                const tip = new THREE.Mesh(earTipGeo, this.materials.skin);
                tip.position.set(0, 0.28, -0.02);
                tip.rotation.x = -0.25;

                ear.add(base, tip);
                earsGroup.add(ear);
            });
        } else if (race === 'goblin') {
            // Ribbed bat-like 2-part faceted ears protruding wide
            const ridgeGeo = this.makeFaceted(new THREE.ConeGeometry(0.08, 0.44, 4));
            const lobeGeo = this.makeFaceted(new THREE.ConeGeometry(0.095, 0.32, 4));
            [-1, 1].forEach((side) => {
                const ear = new THREE.Group();
                ear.position.set(side * 0.32 * hw, 0.19, -0.01);
                ear.rotation.set(0.08, -side * 0.15, -side * 1.38);

                const ridge = new THREE.Mesh(ridgeGeo, this.materials.skin);
                ridge.position.y = 0.20;
                const lobe = new THREE.Mesh(lobeGeo, this.materials.skin);
                lobe.position.set(0, 0.14, -0.05);
                lobe.rotation.z = side * 0.35;

                ear.add(ridge, lobe);
                earsGroup.add(ear);
            });
        } else if (race === 'catfolk') {
            // Perched triangular cat ears with inner-ear facets
            const outerGeo = this.makeFaceted(new THREE.ConeGeometry(0.135, 0.26, 4));
            const innerGeo = this.makeFaceted(new THREE.ConeGeometry(0.085, 0.19, 4));
            [-1, 1].forEach((side) => {
                const ear = new THREE.Group();
                ear.position.set(side * 0.19, 0.48, 0.04);
                ear.rotation.set(-0.08, -side * 0.22, -side * 0.26);

                const outer = new THREE.Mesh(outerGeo, this.materials.hair);
                const inner = new THREE.Mesh(innerGeo, this.materials.innerEar);
                inner.position.set(0, -0.01, 0.032);
                ear.add(outer, inner);
                earsGroup.add(ear);
            });
        } else if (race === 'orc') {
            // Jagged pointed 4-sided orc ears
            const earGeo = this.makeFaceted(new THREE.ConeGeometry(0.085, 0.28, 4));
            [-1, 1].forEach((side) => {
                const ear = new THREE.Mesh(earGeo, this.materials.skin);
                ear.position.set(side * 0.34 * hw, 0.20, -0.05);
                ear.rotation.set(-0.22, -side * 0.2, -side * 1.0);
                earsGroup.add(ear);
            });
        } else {
            // 5-sided low-poly ear wedges (Human, Dwarf)
            const earGeo = this.makeFaceted(new THREE.CylinderGeometry(0.055, 0.045, 0.11, 5));
            [-1, 1].forEach((side) => {
                const ear = new THREE.Mesh(earGeo, this.materials.skin);
                ear.scale.set(0.55, 1.0, 0.85);
                ear.position.set(side * 0.295 * hw, 0.18, 0.0);
                earsGroup.add(ear);
            });
        }

        return earsGroup;
    }

    buildOrcFeatures() {
        const group = new THREE.Group();
        group.name = 'OrcFeatures';

        // Heavy jutting polygonal lower jaw prism
        const jawGeo = this.createLoftedPrism([
            { y: -0.11, rx: 0.23, rz: 0.13, offsetZ: 0.15, twist: Math.PI / 6 },
            { y: 0.06, rx: 0.27, rz: 0.15, offsetZ: 0.16, twist: Math.PI / 6 }
        ], 6);
        group.add(new THREE.Mesh(jawGeo, this.materials.skin));

        // Twin curved 2-segment 4-sided ivory tusks
        const lowerTuskGeo = this.makeFaceted(new THREE.CylinderGeometry(0.036, 0.055, 0.12, 4));
        const upperTuskGeo = this.makeFaceted(new THREE.ConeGeometry(0.038, 0.13, 4));
        [-1, 1].forEach((side) => {
            const tusk = new THREE.Group();
            tusk.position.set(side * 0.145, 0.05, 0.285);
            tusk.rotation.set(0.28, 0, -side * 0.14);

            const base = new THREE.Mesh(lowerTuskGeo, this.materials.tusks);
            base.position.y = 0.04;
            const tip = new THREE.Mesh(upperTuskGeo, this.materials.tusks);
            tip.position.set(-side * 0.015, 0.14, -0.02);
            tip.rotation.set(-0.32, 0, side * 0.12);

            tusk.add(base, tip);
            group.add(tusk);
        });

        // Pronounced V-shaped brow ridge prism
        const browGeo = this.createLoftedPrism([
            { y: -0.04, rx: 0.30, rz: 0.07, twist: Math.PI / 4 },
            { y: 0.04, rx: 0.32, rz: 0.09, twist: Math.PI / 4 }
        ], 4);
        const browRidge = new THREE.Mesh(browGeo, this.materials.skin);
        browRidge.position.set(0, 0.29, 0.245);
        group.add(browRidge);

        return group;
    }

    buildCatMuzzle() {
        const muzzleGroup = new THREE.Group();
        muzzleGroup.name = 'CatMuzzle';

        // Faceted 6-sided snout prism
        const snoutGeo = this.createLoftedPrism([
            { y: -0.05, rx: 0.145, rz: 0.085, twist: Math.PI / 6 },
            { y: 0.055, rx: 0.105, rz: 0.065, twist: Math.PI / 6 }
        ], 6);
        const snout = new THREE.Mesh(snoutGeo, this.materials.muzzle);
        snout.position.set(0, 0, 0.015);
        muzzleGroup.add(snout);

        // Inverted 4-sided pyramid cat nose
        const noseGeo = this.makeFaceted(new THREE.ConeGeometry(0.038, 0.055, 4));
        const nose = new THREE.Mesh(noseGeo, this.materials.catNose);
        nose.position.set(0, 0.032, 0.078);
        nose.rotation.x = Math.PI / 2;
        muzzleGroup.add(nose);

        // Angled whisker spikes
        const whiskerGeo = this.makeFaceted(new THREE.ConeGeometry(0.01, 0.19, 4));
        [-1, 1].forEach((side) => {
            [-0.12, 0.18].forEach((tilt, idx) => {
                const whisker = new THREE.Mesh(whiskerGeo, this.materials.catNose);
                whisker.position.set(side * 0.14, 0.005 + idx * 0.018, 0.055);
                whisker.rotation.set(0, -side * 0.15, -side * (Math.PI / 2 + tilt));
                muzzleGroup.add(whisker);
            });
        });

        return muzzleGroup;
    }

    buildCatTail() {
        const tailGroup = new THREE.Group();
        tailGroup.name = 'CatTail';
        tailGroup.rotation.y = 0.26;

        // Chained 5-segment articulated S-curve hierarchy (fur base + contrasting brush tip)
        const segmentSpecs = [
            { len: 0.18, rBot: 0.058, rTop: 0.050, rx: -1.72, rz: -0.08, mat: this.materials.skin },
            { len: 0.20, rBot: 0.050, rTop: 0.044, rx: 0.56, rz: -0.08, mat: this.materials.skin },
            { len: 0.20, rBot: 0.044, rTop: 0.040, rx: 0.66, rz: -0.05, mat: this.materials.skin },
            { len: 0.14, rBot: 0.040, rTop: 0.045, rx: 0.18, rz: 0.06, mat: this.materials.hair },
            { len: 0.15, rBot: 0.045, rTop: 0.004, rx: -0.52, rz: 0.08, mat: this.materials.hair, isTip: true }
        ];

        const segments = [];
        let parent = tailGroup;
        let prevLen = 0;

        segmentSpecs.forEach((spec) => {
            const segGroup = new THREE.Group();
            segGroup.position.set(0, prevLen, 0);
            segGroup.rotation.set(spec.rx, 0, spec.rz);
            segGroup.userData.baseRot = { x: spec.rx, y: 0, z: spec.rz };

            const rings = spec.isTip
                ? [
                    { y: -spec.rBot * 0.45, rx: spec.rBot * 0.72, rz: spec.rBot * 0.72 },
                    { y: 0, rx: spec.rBot, rz: spec.rBot },
                    { y: spec.len * 0.35, rx: spec.rBot * 1.08, rz: spec.rBot * 1.08 },
                    { y: spec.len, rx: spec.rTop, rz: spec.rTop }
                ]
                : [
                    { y: -spec.rBot * 0.45, rx: spec.rBot * 0.72, rz: spec.rBot * 0.72 },
                    { y: 0, rx: spec.rBot, rz: spec.rBot },
                    { y: spec.len, rx: spec.rTop, rz: spec.rTop }
                ];

            const geo = this.createLoftedPrism(rings, 6);
            segGroup.add(new THREE.Mesh(geo, spec.mat));

            parent.add(segGroup);
            segments.push(segGroup);
            parent = segGroup;
            prevLen = spec.len;
        });

        tailGroup.userData.segments = segments;
        return tailGroup;
    }

    buildDwarfBeard() {
        const beardGroup = new THREE.Group();
        beardGroup.name = 'DwarfBeard';

        // Twin swept 5-sided mustache wings
        const stacheGeo = this.makeFaceted(new THREE.ConeGeometry(0.075, 0.25, 5));
        [-1, 1].forEach((side) => {
            const wing = new THREE.Mesh(stacheGeo, this.materials.beard);
            wing.position.set(side * 0.11, 0.09, 0.05);
            wing.rotation.set(0.15, 0, -side * 1.32);
            beardGroup.add(wing);
        });

        // Broad faceted upper beard wedge
        const upperGeo = this.createLoftedPrism([
            { y: -0.14, rx: 0.22, rz: 0.11, offsetZ: 0.01, twist: Math.PI / 6 },
            { y: 0.08, rx: 0.26, rz: 0.12, offsetZ: 0.02, twist: Math.PI / 6 }
        ], 6);
        beardGroup.add(new THREE.Mesh(upperGeo, this.materials.beard));

        // Twin braided lower beard cones + 8-sided gold beard rings
        const braidGeo = this.makeFaceted(new THREE.ConeGeometry(0.095, 0.32, 6));
        const ringGeo = this.makeFaceted(new THREE.CylinderGeometry(0.082, 0.082, 0.055, 8));
        [-1, 1].forEach((side) => {
            const braid = new THREE.Mesh(braidGeo, this.materials.beard);
            braid.position.set(side * 0.10, -0.26, 0.02);
            braid.rotation.set(0.05, 0, side * 0.08);
            braid.rotation.x += Math.PI;
            beardGroup.add(braid);

            const ring = new THREE.Mesh(ringGeo, this.materials.armorGold);
            ring.position.set(side * 0.105, -0.22, 0.025);
            ring.rotation.z = side * 0.08;
            beardGroup.add(ring);
        });

        return beardGroup;
    }

    buildHeadgear(charClass, race) {
        const gear = new THREE.Group();
        const hw = this.getHeadWidthMultiplier(race);
        const octTwist = Math.PI / 8;

        if (charClass === 'warrior') {
            // Iconic OSRS Full Helm / Plumed Greathelm
            const helmGeo = this.createLoftedPrism([
                { y: -0.02, rx: 0.32 * hw, rz: 0.30, offsetZ: 0.01, twist: octTwist },
                { y: 0.20, rx: 0.345 * hw, rz: 0.32, offsetZ: 0.01, twist: octTwist },
                { y: 0.38, rx: 0.33 * hw, rz: 0.31, offsetZ: 0.0, twist: octTwist },
                { y: 0.50, rx: 0.19 * hw, rz: 0.19, offsetZ: -0.01, twist: octTwist }
            ], 8);
            gear.add(new THREE.Mesh(helmGeo, this.materials.armorMetal));

            // Raised central face-ridge / nose-guard
            const ridgeGeo = this.createLoftedPrism([
                { y: 0.00, rx: 0.048, rz: 0.038, offsetZ: 0.31 },
                { y: 0.22, rx: 0.055, rz: 0.045, offsetZ: 0.325 },
                { y: 0.38, rx: 0.045, rz: 0.035, offsetZ: 0.30 }
            ], 4);
            gear.add(new THREE.Mesh(ridgeGeo, this.materials.armorMetal));

            // Dark V-shaped visor slits
            const slitGeo = this.createLoftedPrism([
                { y: -0.028, rx: 0.09 * hw, rz: 0.018, twist: Math.PI / 4 },
                { y: 0.028, rx: 0.095 * hw, rz: 0.018, twist: Math.PI / 4 }
            ], 4);
            [-1, 1].forEach((side) => {
                const slit = new THREE.Mesh(slitGeo, this.materials.darkVisor);
                slit.position.set(side * (0.105 * hw), 0.21, 0.295);
                slit.rotation.set(0, side * 0.22, side * 0.14);
                gear.add(slit);
            });

            // Gold crown trim band
            const bandGeo = this.createLoftedPrism([
                { y: 0.29, rx: 0.348 * hw, rz: 0.325, offsetZ: 0.0, twist: octTwist },
                { y: 0.34, rx: 0.342 * hw, rz: 0.320, offsetZ: 0.0, twist: octTwist }
            ], 8);
            gear.add(new THREE.Mesh(bandGeo, this.materials.armorGold));

            // Sweeping faceted plume crest
            const socketGeo = this.createLoftedPrism([
                { y: 0.48, rx: 0.055, rz: 0.18, twist: Math.PI / 4 },
                { y: 0.55, rx: 0.045, rz: 0.20, twist: Math.PI / 4 }
            ], 4);
            const socket = new THREE.Mesh(socketGeo, this.materials.armorGold);
            socket.position.set(0, 0, -0.02);
            gear.add(socket);

            const plumeGeo = this.createLoftedPrism([
                { y: 0.54, rx: 0.045, rz: 0.21, offsetZ: -0.02 },
                { y: 0.67, rx: 0.065, rz: 0.26, offsetZ: -0.09 },
                { y: 0.74, rx: 0.035, rz: 0.16, offsetZ: -0.22 }
            ], 6);
            gear.add(new THREE.Mesh(plumeGeo, this.materials.clothAccent));

            // 2-segment curved polygonal horns
            const hornBaseGeo = this.makeFaceted(new THREE.CylinderGeometry(0.055, 0.075, 0.16, 5));
            const hornTipGeo = this.makeFaceted(new THREE.ConeGeometry(0.055, 0.20, 5));
            [-1, 1].forEach((side) => {
                const horn = new THREE.Group();
                horn.position.set(side * (0.31 * hw), 0.33, 0.01);
                horn.rotation.set(0.12, 0, -side * 1.05);

                const base = new THREE.Mesh(hornBaseGeo, this.materials.armorGold);
                base.position.y = 0.07;
                const tip = new THREE.Mesh(hornTipGeo, this.materials.armorGold);
                tip.position.set(-side * 0.03, 0.21, 0);
                tip.rotation.z = side * 0.42;

                horn.add(base, tip);
                gear.add(horn);
            });
        } else {
            // OSRS Crooked Pointed Wizard Hat
            const brimGeo = this.createLoftedPrism([
                { y: 0.36, rx: 0.30 * hw, rz: 0.29, twist: octTwist },
                { y: 0.39, rx: 0.58 * hw, rz: 0.56, twist: octTwist },
                { y: 0.42, rx: 0.55 * hw, rz: 0.53, twist: octTwist }
            ], 8);
            gear.add(new THREE.Mesh(brimGeo, this.materials.cloth));

            // Contrasting hatband
            const bandGeo = this.createLoftedPrism([
                { y: 0.41, rx: 0.33 * hw, rz: 0.31, twist: octTwist },
                { y: 0.51, rx: 0.29 * hw, rz: 0.275, twist: octTwist }
            ], 8);
            gear.add(new THREE.Mesh(bandGeo, this.materials.clothAccent));

            // Diamond gold buckle on hatband
            const buckle = new THREE.Mesh(new THREE.OctahedronGeometry(0.058, 0), this.materials.armorGold);
            buckle.scale.set(1.0, 1.0, 0.5);
            buckle.position.set(0, 0.46, 0.29);
            gear.add(buckle);

            // 3-segment crooked polygonal cone
            const seg1Geo = this.makeFaceted(new THREE.CylinderGeometry(0.19 * hw, 0.29 * hw, 0.28, 7));
            const seg1 = new THREE.Mesh(seg1Geo, this.materials.cloth);
            seg1.position.set(0.01, 0.61, -0.02);
            seg1.rotation.set(-0.15, 0, -0.06);
            gear.add(seg1);

            const seg2Geo = this.makeFaceted(new THREE.CylinderGeometry(0.105 * hw, 0.195 * hw, 0.26, 7));
            const seg2 = new THREE.Mesh(seg2Geo, this.materials.cloth);
            seg2.position.set(0.04, 0.84, -0.08);
            seg2.rotation.set(-0.36, 0, -0.18);
            gear.add(seg2);

            const seg3Geo = this.makeFaceted(new THREE.ConeGeometry(0.11 * hw, 0.28, 7));
            const seg3 = new THREE.Mesh(seg3Geo, this.materials.cloth);
            seg3.position.set(0.11, 1.03, -0.20);
            seg3.rotation.set(-0.68, 0, -0.32);
            gear.add(seg3);
        }

        return gear;
    }

    buildLimbs(charClass, race) {
        const armOffset = (race === 'orc') ? 0.54 : (race === 'goblin') ? 0.38 : (race === 'dwarf') ? 0.48 : 0.44;
        const legOffset = (race === 'orc') ? 0.24 : (race === 'goblin') ? 0.15 : (race === 'dwarf') ? 0.20 : 0.18;

        const upperArmGeo = this.makeFaceted(new THREE.CylinderGeometry(0.105, 0.085, 0.25, 6));
        const elbowGeo = new THREE.OctahedronGeometry(0.085, 0);
        const forearmGeo = (charClass === 'warrior')
            ? this.makeFaceted(new THREE.CylinderGeometry(0.085, 0.105, 0.23, 6))
            : this.makeFaceted(new THREE.CylinderGeometry(0.08, 0.145, 0.24, 6));
        const cuffGeo = (charClass === 'warrior')
            ? this.makeFaceted(new THREE.CylinderGeometry(0.112, 0.112, 0.045, 6))
            : this.makeFaceted(new THREE.CylinderGeometry(0.15, 0.155, 0.045, 6));
        const handGeo = new THREE.DodecahedronGeometry(0.092, 0);

        // Arms
        const makeArm = (isLeft) => {
            const arm = new THREE.Group();
            const sign = isLeft ? -1 : 1;
            arm.name = isLeft ? 'LeftArm' : 'RightArm';
            arm.position.set(sign * armOffset, 0.80, 0);

            if (charClass === 'warrior') {
                // Faceted plate pauldron + gold rim + spike
                const pauldronGeo = this.createLoftedPrism([
                    { y: -0.05, rx: 0.17, rz: 0.19, offsetX: sign * 0.03 },
                    { y: 0.06, rx: 0.16, rz: 0.18, offsetX: sign * 0.03 },
                    { y: 0.16, rx: 0.11, rz: 0.13, offsetX: sign * 0.02 }
                ], 6);
                arm.add(new THREE.Mesh(pauldronGeo, this.materials.armorMetal));

                const rimGeo = this.createLoftedPrism([
                    { y: -0.055, rx: 0.178, rz: 0.198, offsetX: sign * 0.03 },
                    { y: -0.015, rx: 0.175, rz: 0.195, offsetX: sign * 0.03 }
                ], 6);
                arm.add(new THREE.Mesh(rimGeo, this.materials.armorGold));

                const spike = new THREE.Mesh(
                    this.makeFaceted(new THREE.ConeGeometry(0.045, 0.14, 4)),
                    this.materials.armorGold
                );
                spike.position.set(sign * 0.15, 0.09, 0);
                spike.rotation.z = -sign * 0.85;
                arm.add(spike);
            } else {
                // Angled 6-sided mage cloth epaulette
                const epauletteGeo = this.createLoftedPrism([
                    { y: -0.04, rx: 0.15, rz: 0.17, offsetX: sign * 0.02 },
                    { y: 0.10, rx: 0.105, rz: 0.12, offsetX: sign * 0.01 }
                ], 6);
                arm.add(new THREE.Mesh(epauletteGeo, this.materials.clothAccent));
            }

            const upperArmMat = (charClass === 'warrior') ? this.materials.chainmail : this.materials.cloth;
            const upperArm = new THREE.Mesh(upperArmGeo, upperArmMat);
            upperArm.position.set(0, -0.13, 0);
            arm.add(upperArm);

            const elbow = new THREE.Mesh(elbowGeo, upperArmMat);
            elbow.position.set(0, -0.26, 0);
            arm.add(elbow);

            const forearmMat = (charClass === 'warrior') ? this.materials.armorMetal : this.materials.cloth;
            const forearm = new THREE.Mesh(forearmGeo, forearmMat);
            forearm.position.set(0, -0.37, 0);
            arm.add(forearm);

            const cuffMat = (charClass === 'warrior') ? this.materials.armorGold : this.materials.clothAccent;
            const cuff = new THREE.Mesh(cuffGeo, cuffMat);
            cuff.position.set(0, -0.46, 0);
            arm.add(cuff);

            const handMat = (charClass === 'warrior') ? this.materials.armorMetal : this.materials.skin;
            const hand = new THREE.Mesh(handGeo, handMat);
            hand.position.set(0, -0.50, 0);
            hand.name = 'Hand';
            arm.add(hand);

            return { armGroup: arm, hand };
        };

        const leftArmData = makeArm(true);
        const rightArmData = makeArm(false);

        // Legs
        const thighGeo = this.makeFaceted(new THREE.CylinderGeometry(0.13, 0.10, 0.24, 6));
        const kneeGeo = new THREE.OctahedronGeometry(0.086, 0);
        const shinGeo = this.makeFaceted(new THREE.CylinderGeometry(0.105, 0.085, 0.20, 6));
        const ankleCuffGeo = this.makeFaceted(new THREE.CylinderGeometry(0.115, 0.11, 0.05, 6));
        // Boot sole sits strictly at y = -0.575 in leg-local space (-0.425 in bodyGroup space)
        const bootGeo = this.createLoftedPrism([
            { y: -0.575, rx: 0.12, rz: 0.21, offsetZ: 0.07 },
            { y: -0.52, rx: 0.125, rz: 0.215, offsetZ: 0.08 },
            { y: -0.46, rx: 0.105, rz: 0.15, offsetZ: 0.03 },
            { y: -0.40, rx: 0.10, rz: 0.105, offsetZ: 0.0 }
        ], 6);

        const makeLeg = (isLeft) => {
            const leg = new THREE.Group();
            const sign = isLeft ? -1 : 1;
            leg.name = isLeft ? 'LeftLeg' : 'RightLeg';
            leg.position.set(sign * legOffset, 0.15, 0);

            const thighMat = (charClass === 'warrior') ? this.materials.chainmail : this.materials.leather;
            const thigh = new THREE.Mesh(thighGeo, thighMat);
            thigh.position.set(0, -0.12, 0);
            leg.add(thigh);

            const guardMat = (charClass === 'warrior') ? this.materials.armorMetal : this.materials.leather;
            const knee = new THREE.Mesh(kneeGeo, guardMat);
            knee.position.set(0, -0.24, 0.045);
            leg.add(knee);

            const shin = new THREE.Mesh(shinGeo, guardMat);
            shin.position.set(0, -0.34, 0);
            leg.add(shin);

            const bootMat = (charClass === 'warrior') ? this.materials.armorMetal : this.materials.belt;
            leg.add(new THREE.Mesh(bootGeo, bootMat));

            const cuffMat = (charClass === 'warrior') ? this.materials.armorGold : this.materials.leather;
            const ankleCuff = new THREE.Mesh(ankleCuffGeo, cuffMat);
            ankleCuff.position.set(0, -0.41, 0);
            leg.add(ankleCuff);

            return leg;
        };

        const leftLeg = makeLeg(true);
        const rightLeg = makeLeg(false);

        return {
            leftArm: leftArmData.armGroup,
            leftHand: leftArmData.hand,
            rightArm: rightArmData.armGroup,
            rightHand: rightArmData.hand,
            leftLeg,
            rightLeg
        };
    }

    buildWeapons(charClass) {
        const mainHand = new THREE.Group();
        const offHand = new THREE.Group();
        let magicLight = null;

        if (charClass === 'warrior') {
            // --- MAIN HAND: Faceted OSRS Longsword / Broadsword ---
            const sword = new THREE.Group();

            // 4-sided diamond-cross-section tapered blade
            const bladeGeo = this.createLoftedPrism([
                { y: 0.06, rx: 0.088, rz: 0.026 },
                { y: 0.62, rx: 0.075, rz: 0.022 },
                { y: 0.92, rx: 0.062, rz: 0.018 },
                { y: 1.13, rx: 0.002, rz: 0.002 }
            ], 4);
            sword.add(new THREE.Mesh(bladeGeo, this.materials.blade));

            // Central fuller ridge
            const fullerGeo = this.createLoftedPrism([
                { y: 0.06, rx: 0.022, rz: 0.032 },
                { y: 0.56, rx: 0.014, rz: 0.025 }
            ], 4);
            sword.add(new THREE.Mesh(fullerGeo, this.materials.armorGold));

            // Sweeping V-angled polygonal crossguard quillons
            const guardHubGeo = this.createLoftedPrism([
                { y: 0.01, rx: 0.08, rz: 0.05, twist: Math.PI / 4 },
                { y: 0.07, rx: 0.07, rz: 0.045, twist: Math.PI / 4 }
            ], 4);
            sword.add(new THREE.Mesh(guardHubGeo, this.materials.armorGold));

            const quillonGeo = this.makeFaceted(new THREE.ConeGeometry(0.038, 0.17, 4));
            [-1, 1].forEach((side) => {
                const quillon = new THREE.Mesh(quillonGeo, this.materials.armorGold);
                quillon.position.set(side * 0.12, 0.055, 0);
                quillon.rotation.z = -side * 1.25;
                sword.add(quillon);

                const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.034, 0), this.materials.armorGold);
                cap.position.set(side * 0.195, 0.08, 0);
                sword.add(cap);
            });

            // 6-sided leather grip & faceted gold pommel
            const gripGeo = this.makeFaceted(new THREE.CylinderGeometry(0.038, 0.042, 0.24, 6));
            const grip = new THREE.Mesh(gripGeo, this.materials.leather);
            grip.position.set(0, -0.09, 0);
            sword.add(grip);

            const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.062, 0), this.materials.armorGold);
            pommel.position.set(0, -0.23, 0);
            sword.add(pommel);

            sword.position.set(0, 0, 0.09);
            sword.rotation.set(0.35, 0, -0.18);
            mainHand.add(sword);

            // --- OFF HAND: Polygonal Heraldic Kite Shield ---
            const shield = new THREE.Group();
            const hexTwist = Math.PI / 6;

            const shieldBodyGeo = this.createLoftedPrism([
                { y: -0.38, rx: 0.025, rz: 0.035, twist: hexTwist },
                { y: -0.12, rx: 0.19, rz: 0.055, twist: hexTwist },
                { y: 0.12, rx: 0.27, rz: 0.06, twist: hexTwist },
                { y: 0.30, rx: 0.29, rz: 0.055, twist: hexTwist },
                { y: 0.36, rx: 0.21, rz: 0.045, twist: hexTwist }
            ], 6);
            shield.add(new THREE.Mesh(shieldBodyGeo, this.materials.armorMetal));

            const shieldRimGeo = this.createLoftedPrism([
                { y: -0.405, rx: 0.03, rz: 0.025, offsetZ: -0.015, twist: hexTwist },
                { y: -0.12, rx: 0.21, rz: 0.04, offsetZ: -0.015, twist: hexTwist },
                { y: 0.12, rx: 0.295, rz: 0.045, offsetZ: -0.015, twist: hexTwist },
                { y: 0.31, rx: 0.315, rz: 0.04, offsetZ: -0.015, twist: hexTwist },
                { y: 0.38, rx: 0.23, rz: 0.03, offsetZ: -0.015, twist: hexTwist }
            ], 6);
            shield.add(new THREE.Mesh(shieldRimGeo, this.materials.armorGold));

            // Diagonal Heraldic Sash & Faceted Shield Boss
            const sashGeo = this.createLoftedPrism([
                { y: -0.18, rx: 0.07, rz: 0.018, twist: Math.PI / 4 },
                { y: 0.22, rx: 0.07, rz: 0.018, twist: Math.PI / 4 }
            ], 4);
            const sash = new THREE.Mesh(sashGeo, this.materials.clothAccent);
            sash.position.set(0, 0.04, 0.048);
            sash.rotation.z = -0.42;
            shield.add(sash);

            const boss = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), this.materials.armorGold);
            boss.scale.set(1.0, 1.0, 0.55);
            boss.position.set(0, 0.06, 0.055);
            shield.add(boss);

            shield.position.set(0, 0.02, 0.16);
            shield.rotation.set(0.1, 0.38, -0.08);
            offHand.add(shield);
        } else {
            // --- MAIN HAND: Faceted Mystic Battlestaff ---
            const staff = new THREE.Group();

            const shaftSegs = [
                { rTop: 0.042, rBot: 0.048, len: 0.54, x: 0, y: -0.26, z: 0, rz: 0.04 },
                { rTop: 0.04, rBot: 0.044, len: 0.54, x: -0.02, y: 0.24, z: 0, rz: -0.06 },
                { rTop: 0.045, rBot: 0.04, len: 0.42, x: 0.01, y: 0.68, z: 0, rz: 0.05 }
            ];
            shaftSegs.forEach((s) => {
                const seg = new THREE.Mesh(
                    this.makeFaceted(new THREE.CylinderGeometry(s.rTop, s.rBot, s.len, 6)),
                    this.materials.wood
                );
                seg.position.set(s.x, s.y, s.z);
                seg.rotation.z = s.rz;
                staff.add(seg);
            });

            // Gold binding rings at shaft joints
            const ringGeo = this.makeFaceted(new THREE.CylinderGeometry(0.056, 0.056, 0.05, 6));
            [0.0, 0.48, 0.87].forEach((ry) => {
                const ring = new THREE.Mesh(ringGeo, this.materials.armorGold);
                ring.position.set(0, ry, 0);
                staff.add(ring);
            });

            // Sweeping polygonal cradle prongs around crystal
            const prongGeo = this.makeFaceted(new THREE.ConeGeometry(0.048, 0.30, 4));
            [-1, 1].forEach((side) => {
                const prong = new THREE.Mesh(prongGeo, this.materials.wood);
                prong.position.set(side * 0.12, 1.00, 0);
                prong.rotation.z = -side * 0.32;
                staff.add(prong);

                const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.036, 0), this.materials.armorGold);
                tip.position.set(side * 0.17, 1.14, 0);
                staff.add(tip);
            });

            // Levitating Faceted Crystal + Orbiting 6-sided Halo
            const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), this.materials.magicCrystal);
            crystal.scale.set(0.82, 1.25, 0.82);
            crystal.position.set(0, 1.08, 0);
            crystal.name = 'MagicCrystal';
            staff.add(crystal);

            const haloGeo = this.makeFaceted(new THREE.TorusGeometry(0.22, 0.016, 4, 6));
            const halo = new THREE.Mesh(haloGeo, this.materials.armorGold);
            halo.position.set(0, 1.08, 0);
            halo.rotation.set(Math.PI / 2.6, 0.3, 0);
            staff.add(halo);

            const light = new THREE.PointLight(0x38ef7d, 1.2, 2.5);
            light.position.set(0, 1.08, 0);
            staff.add(light);
            magicLight = light;

            staff.position.set(0, -0.15, 0.14);
            staff.rotation.set(0.2, 0, -0.12);
            mainHand.add(staff);

            // --- OFF HAND: OSRS Mage's Tome & Floating Polyhedral Orb ---
            const tomeRig = new THREE.Group();
            tomeRig.position.set(0, 0.04, 0.18);
            tomeRig.rotation.set(0.35, 0.25, -0.1);

            const coverGeo = this.createLoftedPrism([
                { y: -0.02, rx: 0.12, rz: 0.16, twist: Math.PI / 4 },
                { y: 0.005, rx: 0.12, rz: 0.16, twist: Math.PI / 4 }
            ], 4);
            const pageGeo = this.createLoftedPrism([
                { y: 0.0, rx: 0.105, rz: 0.145, twist: Math.PI / 4 },
                { y: 0.025, rx: 0.10, rz: 0.14, twist: Math.PI / 4 }
            ], 4);

            [-1, 1].forEach((side) => {
                const wing = new THREE.Group();
                wing.rotation.z = side * 0.38;

                const cover = new THREE.Mesh(coverGeo, this.materials.leather);
                cover.position.x = side * 0.095;
                const pages = new THREE.Mesh(pageGeo, this.materials.pageWhite);
                pages.position.x = side * 0.09;

                wing.add(cover, pages);
                tomeRig.add(wing);
            });

            // Gold book spine
            const spineGeo = this.makeFaceted(new THREE.CylinderGeometry(0.028, 0.028, 0.24, 6));
            const spine = new THREE.Mesh(spineGeo, this.materials.armorGold);
            spine.rotation.x = Math.PI / 2;
            spine.position.y = -0.015;
            tomeRig.add(spine);

            // Floating Polyhedral Orb + Dual Runic Rings above pages
            const orbAnchor = new THREE.Group();
            orbAnchor.position.set(0, 0.26, 0.02);

            const orbSpinner = new THREE.Group();
            orbSpinner.name = 'MagicOrbGroup';

            const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), this.materials.magicOrb);
            orb.name = 'MagicOrb';
            orbSpinner.add(orb);

            const ring1 = new THREE.Mesh(
                this.makeFaceted(new THREE.TorusGeometry(0.20, 0.014, 4, 6)),
                this.materials.armorGold
            );
            ring1.rotation.x = Math.PI / 3;
            orbSpinner.add(ring1);

            const ring2 = new THREE.Mesh(
                this.makeFaceted(new THREE.TorusGeometry(0.23, 0.012, 4, 6)),
                this.materials.armorGold
            );
            ring2.rotation.set(-Math.PI / 4, Math.PI / 3, 0);
            orbSpinner.add(ring2);

            orbAnchor.add(orbSpinner);
            tomeRig.add(orbAnchor);
            offHand.add(tomeRig);
        }

        return { mainHand, offHand, magicLight };
    }

    applyRaceScaling(modelRoot, race) {
        if (race === 'dwarf') {
            // Short, broad shoulders, sturdy stance
            modelRoot.scale.set(1.25, 0.78, 1.2);
        } else if (race === 'elf') {
            // Slender, graceful, taller
            modelRoot.scale.set(0.88, 1.12, 0.88);
        } else if (race === 'orc') {
            // Hulking juggernaut
            modelRoot.scale.set(1.35, 1.18, 1.3);
        } else if (race === 'goblin') {
            // Small, nimble, hunched scavver
            modelRoot.scale.set(0.72, 0.68, 0.72);
        } else if (race === 'catfolk') {
            // Agile, tall, sleek feline
            modelRoot.scale.set(0.92, 1.08, 0.92);
        } else {
            // Human: balanced standard
            modelRoot.scale.set(1.0, 1.0, 1.0);
        }

        // Align the bottom of character's boots cleanly at y = 0
        // (Boot soles sit at y = -0.425 within unscaled body coordinates)
        modelRoot.position.y = 0.425 * modelRoot.scale.y;
    }

    animateIdle(anim, delta) {
        anim.time += delta;
        const t = anim.time;

        // Subtle breathing bob
        const breatheSpeed = (anim.race === 'goblin') ? 3.5 : (anim.race === 'orc') ? 1.8 : 2.2;
        const breatheAmp = (anim.race === 'orc') ? 0.035 : 0.025;
        const breathe = Math.sin(t * breatheSpeed) * breatheAmp;
        if (anim.torso) anim.torso.position.y = breathe;

        // Gentle head tilt
        if (anim.head) {
            anim.head.rotation.y = Math.sin(t * 1.1) * 0.05;
            anim.head.rotation.x = Math.sin(t * 2.2) * 0.02;
        }

        // Gentle cape billow
        if (anim.cape) {
            anim.cape.rotation.x = 0.08 + Math.sin(t * 2.0) * 0.04;
        }

        // Arm idle sway
        if (anim.leftArm) anim.leftArm.rotation.x = Math.sin(t * 1.8) * 0.05;
        if (anim.rightArm) anim.rightArm.rotation.x = -Math.sin(t * 1.8) * 0.05;

        // Cat tail S-wave sway
        if (anim.tail) {
            anim.tail.rotation.x = Math.sin(t * 1.6) * 0.05;
            anim.tail.rotation.y = 0.26 + Math.sin(t * 2.2) * 0.18;
            anim.tail.rotation.z = Math.cos(t * 1.8) * 0.06;
            const segs = anim.tail.userData.segments;
            if (segs) {
                for (let i = 0; i < segs.length; i++) {
                    const seg = segs[i];
                    const base = seg.userData.baseRot;
                    seg.rotation.z = base.z + Math.sin(t * 3.0 - i * 0.6) * 0.09;
                    seg.rotation.x = base.x + Math.cos(t * 2.4 - i * 0.5) * 0.06;
                }
            }
        }

        // Mage staff crystal & off-hand orb spin
        if (anim.mainWeapon) {
            const crystal = anim.mainWeapon.getObjectByName('MagicCrystal');
            if (crystal) crystal.rotation.y += delta * 1.4;
        }
        if (anim.offHandOrb) {
            anim.offHandOrb.rotation.y += delta * 1.1;
            anim.offHandOrb.position.y = Math.sin(t * 2.4) * 0.035;
        }

        // Crystal pulse if Mage
        if (anim.magicLight) {
            anim.magicLight.intensity = 1.0 + Math.sin(t * 4.0) * 0.4;
        }
    }
}
