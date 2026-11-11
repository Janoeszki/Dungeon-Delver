import * as THREE from '../vendor/three.module.js';

/**
 * Procedural 8-Bit / Cartoon Character Generator
 * Builds modular Human, Elf, Dwarf, Orc, Goblin, and Catfolk models
 * with Warrior and Mage equipment.
 */
export class CharacterBuilder {
    constructor() {
        this.materials = {};
        this.initMaterials();
    }

    initMaterials() {
        // Base materials with flat shading for retro 8-bit / low-poly cartoon look
        this.materials = {
            skin: new THREE.MeshLambertMaterial({ color: 0xffd2b2, flatShading: true }),
            hair: new THREE.MeshLambertMaterial({ color: 0x4a2e1b, flatShading: true }),
            eyes: new THREE.MeshBasicMaterial({ color: 0x1b1b22 }),
            eyeGlint: new THREE.MeshBasicMaterial({ color: 0xffffff }),
            mouth: new THREE.MeshBasicMaterial({ color: 0x7c3636 }),
            cloth: new THREE.MeshLambertMaterial({ color: 0x2b4c7e, flatShading: true }),
            clothAccent: new THREE.MeshLambertMaterial({ color: 0xd97724, flatShading: true }),
            belt: new THREE.MeshLambertMaterial({ color: 0x2c1d11, flatShading: true }),
            buckle: new THREE.MeshLambertMaterial({ color: 0xffd700, flatShading: true }),
            armorMetal: new THREE.MeshLambertMaterial({ color: 0x95a5a6, flatShading: true }),
            armorGold: new THREE.MeshLambertMaterial({ color: 0xf1c40f, flatShading: true }),
            leather: new THREE.MeshLambertMaterial({ color: 0x5c381e, flatShading: true }),
            wood: new THREE.MeshLambertMaterial({ color: 0x6e4720, flatShading: true }),
            blade: new THREE.MeshLambertMaterial({ color: 0xdde5ed, flatShading: true }),
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

    setColors(config) {
        if (config.skinColor) this.materials.skin.color.set(config.skinColor);
        if (config.hairColor) {
            this.materials.hair.color.set(config.hairColor);
            this.materials.beard.color.set(config.hairColor);
        }
        if (config.clothColor) this.materials.cloth.color.set(config.clothColor);
        if (config.armorColor) this.materials.armorMetal.color.set(config.armorColor);
    }

    createCharacter(config = {}) {
        const {
            race = 'human',        // 'human', 'elf', 'dwarf', 'orc', 'goblin', 'catfolk'
            charClass = 'warrior', // 'warrior', 'mage'
            showHelm = true,
            skinColor = '#ffd2b2',
            hairColor = '#4a2e1b',
            clothColor = '#2b4c7e',
            armorColor = '#95a5a6'
        } = config;

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

        // 1. Torso
        const torsoGroup = this.buildTorso(charClass, race);
        bodyGroup.add(torsoGroup);

        // 2. Head & Face
        const headGroup = this.buildHead(race, hairColor);
        headGroup.position.y = 1.05;
        bodyGroup.add(headGroup);

        // 3. Helm / Hat
        const headgear = this.buildHeadgear(charClass, race);
        if (headgear) {
            headgear.name = 'Headgear';
            headgear.visible = showHelm;
            headGroup.add(headgear);
        }

        // 4. Race-specific facial attachments
        if (race === 'dwarf') {
            const beard = this.buildDwarfBeard();
            beard.position.set(0, -0.2, 0.28);
            headGroup.add(beard);
        } else if (race === 'orc') {
            const orcFeatures = this.buildOrcFeatures();
            headGroup.add(orcFeatures);
        } else if (race === 'catfolk') {
            const catMuzzle = this.buildCatMuzzle();
            catMuzzle.position.set(0, 0.08, 0.28);
            headGroup.add(catMuzzle);
        }

        // 5. Ears (Elf, Dwarf, Orc, Goblin, Catfolk, Human)
        const ears = this.buildEars(race);
        headGroup.add(ears);

        // 6. Limbs
        const limbs = this.buildLimbs(charClass, race);
        bodyGroup.add(limbs.leftArm);
        bodyGroup.add(limbs.rightArm);
        bodyGroup.add(limbs.leftLeg);
        bodyGroup.add(limbs.rightLeg);

        // 7. Catfolk Tail
        let tail = null;
        if (race === 'catfolk') {
            tail = this.buildCatTail();
            tail.position.set(0, 0.25, -0.22);
            bodyGroup.add(tail);
        }

        // 8. Weapons & Off-hand
        const weapons = this.buildWeapons(charClass);
        limbs.rightHand.add(weapons.mainHand);
        limbs.leftHand.add(weapons.offHand);

        // Apply Race Scale & Proportions
        this.applyRaceScaling(modelRoot, race);

        // Enable shadow casting for all character meshes
        characterGroup.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
            }
        });

        // Create animation controller helper
        const animState = {
            time: 0,
            race,
            torso: torsoGroup,
            head: headGroup,
            tail,
            leftArm: limbs.leftArm,
            rightArm: limbs.rightArm,
            leftLeg: limbs.leftLeg,
            rightLeg: limbs.rightLeg,
            mainWeapon: weapons.mainHand,
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

        // Main chest block
        const chestWidth = (race === 'orc') ? 0.78 : (race === 'goblin') ? 0.55 : 0.65;
        const chestGeo = new THREE.BoxGeometry(chestWidth, 0.75, 0.42);
        const chestMat = (charClass === 'warrior') ? this.materials.armorMetal : this.materials.cloth;
        const chest = new THREE.Mesh(chestGeo, chestMat);
        chest.position.y = 0.55;
        torso.add(chest);

        // Belt
        const beltGeo = new THREE.BoxGeometry(chestWidth + 0.04, 0.12, 0.44);
        const belt = new THREE.Mesh(beltGeo, this.materials.belt);
        belt.position.y = 0.22;
        torso.add(belt);

        // Buckle
        const buckleGeo = new THREE.BoxGeometry(0.18, 0.14, 0.48);
        const buckle = new THREE.Mesh(buckleGeo, this.materials.buckle);
        buckle.position.y = 0.22;
        torso.add(buckle);

        if (charClass === 'warrior') {
            // Breastplate emblem
            const emblemGeo = new THREE.BoxGeometry(0.22, 0.3, 0.04);
            const emblem = new THREE.Mesh(emblemGeo, this.materials.armorGold);
            emblem.position.set(0, 0.6, 0.22);
            torso.add(emblem);

            // Collar
            const collarGeo = new THREE.BoxGeometry(chestWidth * 0.75, 0.15, 0.2);
            const collar = new THREE.Mesh(collarGeo, this.materials.armorMetal);
            collar.position.set(0, 0.95, -0.05);
            torso.add(collar);
        } else {
            // Mage Robe trim / sash
            const sashGeo = new THREE.BoxGeometry(0.22, 0.76, 0.45);
            const sash = new THREE.Mesh(sashGeo, this.materials.clothAccent);
            sash.position.set(0, 0.55, 0);
            torso.add(sash);

            // Robe skirt lower section
            const skirtGeo = new THREE.BoxGeometry(chestWidth + 0.04, 0.55, 0.46);
            const skirt = new THREE.Mesh(skirtGeo, this.materials.cloth);
            skirt.position.set(0, -0.05, 0);
            torso.add(skirt);
        }

        return torso;
    }

    buildHead(race, hairColor) {
        const headGroup = new THREE.Group();
        headGroup.name = 'HeadGroup';

        // Head Base Cube
        const headWidth = (race === 'orc') ? 0.62 : (race === 'goblin') ? 0.64 : 0.56;
        const headGeo = new THREE.BoxGeometry(headWidth, 0.54, 0.52);
        const head = new THREE.Mesh(headGeo, this.materials.skin);
        head.position.y = 0.15;
        headGroup.add(head);

        // Nose (distinct per race)
        if (race === 'goblin') {
            // Long pointed mischievous hooked nose
            const noseGeo = new THREE.ConeGeometry(0.09, 0.32, 4);
            const nose = new THREE.Mesh(noseGeo, this.materials.skin);
            nose.position.set(0, 0.14, 0.38);
            nose.rotation.x = Math.PI / 2;
            headGroup.add(nose);
        } else if (race !== 'catfolk') {
            // Standard blocky nose for Human, Elf, Dwarf, Orc
            const noseGeo = new THREE.BoxGeometry(0.1, 0.09, 0.1);
            const nose = new THREE.Mesh(noseGeo, this.materials.skin);
            nose.position.set(0, 0.13, 0.28);
            headGroup.add(nose);
        }

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.09, 0.09, 0.02);
        const glintGeo = new THREE.BoxGeometry(0.03, 0.03, 0.03);

        const leftEye = new THREE.Mesh(eyeGeo, this.materials.eyes);
        leftEye.position.set(-0.14, 0.17, 0.27);
        const leftGlint = new THREE.Mesh(glintGeo, this.materials.eyeGlint);
        leftGlint.position.set(-0.13, 0.19, 0.28);
        headGroup.add(leftEye, leftGlint);

        const rightEye = new THREE.Mesh(eyeGeo, this.materials.eyes);
        rightEye.position.set(0.14, 0.17, 0.27);
        const rightGlint = new THREE.Mesh(glintGeo, this.materials.eyeGlint);
        rightGlint.position.set(0.15, 0.19, 0.28);
        headGroup.add(rightEye, rightGlint);

        // Eyebrows
        const browGeo = new THREE.BoxGeometry(0.13, 0.04, 0.03);
        const leftBrow = new THREE.Mesh(browGeo, this.materials.hair);
        leftBrow.position.set(-0.14, 0.25, 0.27);
        const rightBrow = new THREE.Mesh(browGeo, this.materials.hair);
        rightBrow.position.set(0.14, 0.25, 0.27);
        headGroup.add(leftBrow, rightBrow);

        // Mouth (hidden if catfolk or orc which has tusks)
        if (race !== 'catfolk' && race !== 'orc') {
            const mouthGeo = new THREE.BoxGeometry(0.12, 0.03, 0.02);
            const mouth = new THREE.Mesh(mouthGeo, this.materials.mouth);
            mouth.position.set(0, 0.01, 0.27);
            headGroup.add(mouth);
        }

        // Hair Styles
        const hair = this.buildHair(race);
        headGroup.add(hair);

        return headGroup;
    }

    buildHair(race) {
        const hairGroup = new THREE.Group();
        hairGroup.name = 'Hair';

        if (race === 'elf') {
            // Elegant flowing long hair
            const crownGeo = new THREE.BoxGeometry(0.6, 0.18, 0.56);
            const crown = new THREE.Mesh(crownGeo, this.materials.hair);
            crown.position.set(0, 0.4, -0.02);
            hairGroup.add(crown);

            const backHairGeo = new THREE.BoxGeometry(0.58, 0.7, 0.18);
            const backHair = new THREE.Mesh(backHairGeo, this.materials.hair);
            backHair.position.set(0, 0.05, -0.22);
            hairGroup.add(backHair);

            const strandGeo = new THREE.BoxGeometry(0.1, 0.45, 0.12);
            const leftStrand = new THREE.Mesh(strandGeo, this.materials.hair);
            leftStrand.position.set(-0.25, 0.1, 0.18);
            const rightStrand = new THREE.Mesh(strandGeo, this.materials.hair);
            rightStrand.position.set(0.25, 0.1, 0.18);
            hairGroup.add(leftStrand, rightStrand);
        } else if (race === 'dwarf') {
            // Thick messy cropped dwarf hair
            const crownGeo = new THREE.BoxGeometry(0.62, 0.22, 0.58);
            const crown = new THREE.Mesh(crownGeo, this.materials.hair);
            crown.position.set(0, 0.4, 0);
            hairGroup.add(crown);

            const backGeo = new THREE.BoxGeometry(0.62, 0.35, 0.18);
            const back = new THREE.Mesh(backGeo, this.materials.hair);
            back.position.set(0, 0.2, -0.22);
            hairGroup.add(back);
        } else if (race === 'orc') {
            // Savage warrior topknot / mohawk
            const mohawkGeo = new THREE.BoxGeometry(0.18, 0.32, 0.6);
            const mohawk = new THREE.Mesh(mohawkGeo, this.materials.hair);
            mohawk.position.set(0, 0.45, -0.05);
            hairGroup.add(mohawk);

            const knotGeo = new THREE.ConeGeometry(0.12, 0.3, 4);
            const knot = new THREE.Mesh(knotGeo, this.materials.hair);
            knot.position.set(0, 0.65, -0.15);
            knot.rotation.x = -0.4;
            hairGroup.add(knot);
        } else if (race === 'goblin') {
            // Spiky scruffy tuft
            const tuftGeo = new THREE.BoxGeometry(0.25, 0.18, 0.25);
            const tuft = new THREE.Mesh(tuftGeo, this.materials.hair);
            tuft.position.set(0, 0.45, 0);
            tuft.rotation.y = Math.PI / 4;
            hairGroup.add(tuft);
        } else if (race === 'catfolk') {
            // Sleek feline fur crest
            const furGeo = new THREE.BoxGeometry(0.52, 0.14, 0.52);
            const fur = new THREE.Mesh(furGeo, this.materials.hair);
            fur.position.set(0, 0.4, 0);
            hairGroup.add(fur);
        } else {
            // Classic adventurer parted hair (Human)
            const crownGeo = new THREE.BoxGeometry(0.6, 0.18, 0.56);
            const crown = new THREE.Mesh(crownGeo, this.materials.hair);
            crown.position.set(0, 0.4, 0);
            hairGroup.add(crown);

            const bangsGeo = new THREE.BoxGeometry(0.48, 0.12, 0.14);
            const bangs = new THREE.Mesh(bangsGeo, this.materials.hair);
            bangs.position.set(0, 0.33, 0.24);
            hairGroup.add(bangs);

            const backGeo = new THREE.BoxGeometry(0.58, 0.3, 0.16);
            const back = new THREE.Mesh(backGeo, this.materials.hair);
            back.position.set(0, 0.2, -0.22);
            hairGroup.add(back);
        }

        return hairGroup;
    }

    buildEars(race) {
        const earsGroup = new THREE.Group();
        earsGroup.name = 'Ears';

        if (race === 'elf') {
            // Majestic elongated pointed ears pointing backwards-up
            const earGeo = new THREE.ConeGeometry(0.08, 0.35, 4);
            const leftEar = new THREE.Mesh(earGeo, this.materials.skin);
            leftEar.position.set(-0.35, 0.22, -0.05);
            leftEar.rotation.set(-0.4, 0, 0.85);

            const rightEar = new THREE.Mesh(earGeo, this.materials.skin);
            rightEar.position.set(0.35, 0.22, -0.05);
            rightEar.rotation.set(-0.4, 0, -0.85);

            earsGroup.add(leftEar, rightEar);
        } else if (race === 'goblin') {
            // Huge bat-like goblin ears protruding wide sideways!
            const earGeo = new THREE.ConeGeometry(0.12, 0.45, 4);
            const leftEar = new THREE.Mesh(earGeo, this.materials.skin);
            leftEar.position.set(-0.48, 0.16, -0.02);
            leftEar.rotation.set(0.1, 0, 1.35);

            const rightEar = new THREE.Mesh(earGeo, this.materials.skin);
            rightEar.position.set(0.48, 0.16, -0.02);
            rightEar.rotation.set(0.1, 0, -1.35);

            earsGroup.add(leftEar, rightEar);
        } else if (race === 'catfolk') {
            // Cute triangular cat ears perched atop the head!
            const outerGeo = new THREE.ConeGeometry(0.14, 0.26, 4);
            const innerGeo = new THREE.ConeGeometry(0.09, 0.2, 4);

            // Left Cat Ear
            const leftEarGroup = new THREE.Group();
            leftEarGroup.position.set(-0.2, 0.5, 0.05);
            leftEarGroup.rotation.set(-0.1, 0.2, 0.25);
            const leftOuter = new THREE.Mesh(outerGeo, this.materials.hair);
            const leftInner = new THREE.Mesh(innerGeo, this.materials.innerEar);
            leftInner.position.set(0, 0, 0.03);
            leftEarGroup.add(leftOuter, leftInner);

            // Right Cat Ear
            const rightEarGroup = new THREE.Group();
            rightEarGroup.position.set(0.2, 0.5, 0.05);
            rightEarGroup.rotation.set(-0.1, -0.2, -0.25);
            const rightOuter = new THREE.Mesh(outerGeo, this.materials.hair);
            const rightInner = new THREE.Mesh(innerGeo, this.materials.innerEar);
            rightInner.position.set(0, 0, 0.03);
            rightEarGroup.add(rightOuter, rightInner);

            earsGroup.add(leftEarGroup, rightEarGroup);
        } else if (race === 'orc') {
            // Broad rugged pointed orc ears
            const earGeo = new THREE.ConeGeometry(0.09, 0.28, 4);
            const leftEar = new THREE.Mesh(earGeo, this.materials.skin);
            leftEar.position.set(-0.38, 0.18, -0.08);
            leftEar.rotation.set(-0.2, 0, 0.95);

            const rightEar = new THREE.Mesh(earGeo, this.materials.skin);
            rightEar.position.set(0.38, 0.18, -0.08);
            rightEar.rotation.set(-0.2, 0, -0.95);

            earsGroup.add(leftEar, rightEar);
        } else {
            // Standard rounded ears (Human, Dwarf)
            const earGeo = new THREE.BoxGeometry(0.08, 0.12, 0.1);
            const leftEar = new THREE.Mesh(earGeo, this.materials.skin);
            leftEar.position.set(-0.31, 0.15, 0);

            const rightEar = new THREE.Mesh(earGeo, this.materials.skin);
            rightEar.position.set(0.31, 0.15, 0);

            earsGroup.add(leftEar, rightEar);
        }

        return earsGroup;
    }

    buildOrcFeatures() {
        const group = new THREE.Group();
        group.name = 'OrcFeatures';

        // Heavy prominent lower jaw
        const jawGeo = new THREE.BoxGeometry(0.5, 0.18, 0.22);
        const jaw = new THREE.Mesh(jawGeo, this.materials.skin);
        jaw.position.set(0, -0.04, 0.2);
        group.add(jaw);

        // Ivory lower tusks protruding upward!
        const tuskGeo = new THREE.ConeGeometry(0.065, 0.22, 4);

        const leftTusk = new THREE.Mesh(tuskGeo, this.materials.tusks);
        leftTusk.position.set(-0.16, 0.12, 0.28);
        leftTusk.rotation.set(0.2, 0, -0.15);

        const rightTusk = new THREE.Mesh(tuskGeo, this.materials.tusks);
        rightTusk.position.set(0.16, 0.12, 0.28);
        rightTusk.rotation.set(0.2, 0, 0.15);

        group.add(leftTusk, rightTusk);

        // Prominent heavy brow ridge
        const browRidgeGeo = new THREE.BoxGeometry(0.62, 0.1, 0.12);
        const browRidge = new THREE.Mesh(browRidgeGeo, this.materials.skin);
        browRidge.position.set(0, 0.26, 0.25);
        group.add(browRidge);

        return group;
    }

    buildCatMuzzle() {
        const muzzleGroup = new THREE.Group();
        muzzleGroup.name = 'CatMuzzle';

        // Cream/White whisker cheek pads
        const padGeo = new THREE.BoxGeometry(0.26, 0.12, 0.1);
        const pad = new THREE.Mesh(padGeo, this.materials.muzzle);
        pad.position.set(0, 0, 0.02);
        muzzleGroup.add(pad);

        // Cute pink/dark triangle nose
        const noseGeo = new THREE.BoxGeometry(0.08, 0.06, 0.04);
        const nose = new THREE.Mesh(noseGeo, this.materials.catNose);
        nose.position.set(0, 0.04, 0.08);
        muzzleGroup.add(nose);

        // Whiskers (thin horizontal lines)
        const whiskerGeo = new THREE.BoxGeometry(0.46, 0.02, 0.02);
        const whisker = new THREE.Mesh(whiskerGeo, this.materials.catNose);
        whisker.position.set(0, 0, 0.07);
        muzzleGroup.add(whisker);

        return muzzleGroup;
    }

    buildCatTail() {
        const tailGroup = new THREE.Group();
        tailGroup.name = 'CatTail';

        // Segmented curved feline tail
        const seg1Geo = new THREE.CylinderGeometry(0.05, 0.06, 0.35, 6);
        const seg1 = new THREE.Mesh(seg1Geo, this.materials.hair);
        seg1.position.set(0, -0.1, -0.12);
        seg1.rotation.x = -0.7;
        tailGroup.add(seg1);

        const seg2Geo = new THREE.CylinderGeometry(0.045, 0.05, 0.35, 6);
        const seg2 = new THREE.Mesh(seg2Geo, this.materials.hair);
        seg2.position.set(0, 0.08, -0.24);
        seg2.rotation.x = 0.5;
        tailGroup.add(seg2);

        const tipGeo = new THREE.SphereGeometry(0.06, 6, 6);
        const tip = new THREE.Mesh(tipGeo, this.materials.hair);
        tip.position.set(0, 0.26, -0.22);
        tailGroup.add(tip);

        return tailGroup;
    }

    buildDwarfBeard() {
        const beardGroup = new THREE.Group();
        beardGroup.name = 'DwarfBeard';

        // Thick mustache
        const stacheGeo = new THREE.BoxGeometry(0.46, 0.14, 0.16);
        const stache = new THREE.Mesh(stacheGeo, this.materials.beard);
        stache.position.set(0, 0.12, 0.05);
        beardGroup.add(stache);

        // Upper full beard body
        const upperGeo = new THREE.BoxGeometry(0.52, 0.3, 0.2);
        const upper = new THREE.Mesh(upperGeo, this.materials.beard);
        upper.position.set(0, -0.05, 0.04);
        beardGroup.add(upper);

        // Lower tapered beard braid
        const braidGeo = new THREE.BoxGeometry(0.36, 0.35, 0.18);
        const braid = new THREE.Mesh(braidGeo, this.materials.beard);
        braid.position.set(0, -0.32, 0.03);
        beardGroup.add(braid);

        // Golden beard ring clasp
        const ringGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 8);
        const ring = new THREE.Mesh(ringGeo, this.materials.armorGold);
        ring.position.set(0, -0.22, 0.08);
        ring.rotation.x = Math.PI / 2;
        beardGroup.add(ring);

        return beardGroup;
    }

    buildHeadgear(charClass, race) {
        const gear = new THREE.Group();

        if (charClass === 'warrior') {
            // Steel Greathelm with golden crest & horns
            const helmWidth = (race === 'orc') ? 0.72 : (race === 'goblin') ? 0.62 : 0.64;
            const helmetGeo = new THREE.BoxGeometry(helmWidth, 0.58, 0.6);
            const helmet = new THREE.Mesh(helmetGeo, this.materials.armorMetal);
            helmet.position.set(0, 0.18, 0);
            gear.add(helmet);

            // Visor slit
            const visorGeo = new THREE.BoxGeometry(helmWidth * 0.7, 0.08, 0.05);
            const visorMat = new THREE.MeshBasicMaterial({ color: 0x111116 });
            const visor = new THREE.Mesh(visorGeo, visorMat);
            visor.position.set(0, 0.17, 0.31);
            gear.add(visor);

            // Gold Helmet Crest
            const crestGeo = new THREE.BoxGeometry(0.08, 0.16, 0.64);
            const crest = new THREE.Mesh(crestGeo, this.materials.armorGold);
            crest.position.set(0, 0.52, 0);
            gear.add(crest);

            // Viking / Knight Horns
            const hornGeo = new THREE.ConeGeometry(0.08, 0.28, 5);
            const leftHorn = new THREE.Mesh(hornGeo, this.materials.armorGold);
            leftHorn.position.set(-helmWidth * 0.52, 0.38, 0.05);
            leftHorn.rotation.set(0.1, 0, 0.9);

            const rightHorn = new THREE.Mesh(hornGeo, this.materials.armorGold);
            rightHorn.position.set(helmWidth * 0.52, 0.38, 0.05);
            rightHorn.rotation.set(0.1, 0, -0.9);

            gear.add(leftHorn, rightHorn);
        } else {
            // Pointed Wizard Hat
            const brimRadius = (race === 'orc') ? 0.62 : 0.55;
            const brimGeo = new THREE.CylinderGeometry(brimRadius, brimRadius + 0.04, 0.06, 12);
            const brim = new THREE.Mesh(brimGeo, this.materials.cloth);
            brim.position.set(0, 0.42, 0);
            gear.add(brim);

            // Hat ribbon / band
            const bandGeo = new THREE.CylinderGeometry(0.32, 0.36, 0.1, 10);
            const band = new THREE.Mesh(bandGeo, this.materials.clothAccent);
            band.position.set(0, 0.48, 0);
            gear.add(band);

            // Pointed cone top angled backwards
            const coneGeo = new THREE.ConeGeometry(0.32, 0.75, 8);
            const cone = new THREE.Mesh(coneGeo, this.materials.cloth);
            cone.position.set(0, 0.85, -0.08);
            cone.rotation.x = -0.25;
            gear.add(cone);

            // Golden star/buckle on ribbon
            const starGeo = new THREE.BoxGeometry(0.08, 0.08, 0.04);
            const star = new THREE.Mesh(starGeo, this.materials.armorGold);
            star.position.set(0, 0.48, 0.33);
            gear.add(star);
        }

        return gear;
    }

    buildLimbs(charClass, race) {
        const armOffset = (race === 'orc') ? 0.54 : (race === 'goblin') ? 0.38 : 0.44;

        // Arms
        const makeArm = (isLeft) => {
            const arm = new THREE.Group();
            const sign = isLeft ? -1 : 1;
            arm.name = isLeft ? 'LeftArm' : 'RightArm';
            arm.position.set(sign * armOffset, 0.8, 0);

            // Pauldron / Shoulder
            if (charClass === 'warrior') {
                const pauldronWidth = (race === 'orc') ? 0.34 : 0.26;
                const pauldronGeo = new THREE.BoxGeometry(pauldronWidth, 0.24, 0.32);
                const pauldron = new THREE.Mesh(pauldronGeo, this.materials.armorMetal);
                pauldron.position.set(sign * 0.04, 0.08, 0);
                arm.add(pauldron);
            }

            // Arm limb
            const armGeo = new THREE.BoxGeometry(0.2, 0.52, 0.22);
            const armMat = (charClass === 'warrior') ? this.materials.leather : this.materials.cloth;
            const armMesh = new THREE.Mesh(armGeo, armMat);
            armMesh.position.set(0, -0.22, 0);
            arm.add(armMesh);

            // Hand / Glove
            const handGeo = new THREE.BoxGeometry(0.18, 0.18, 0.2);
            const handMat = (charClass === 'warrior') ? this.materials.armorMetal : this.materials.skin;
            const hand = new THREE.Mesh(handGeo, handMat);
            hand.position.set(0, -0.5, 0);
            hand.name = 'Hand';
            arm.add(hand);

            return { armGroup: arm, hand };
        };

        const leftArmData = makeArm(true);
        const rightArmData = makeArm(false);

        // Legs
        const legOffset = (race === 'orc') ? 0.24 : (race === 'goblin') ? 0.14 : 0.18;
        const makeLeg = (isLeft) => {
            const leg = new THREE.Group();
            const sign = isLeft ? -1 : 1;
            leg.name = isLeft ? 'LeftLeg' : 'RightLeg';
            leg.position.set(sign * legOffset, 0.15, 0);

            // Upper leg
            const legGeo = new THREE.BoxGeometry(0.24, 0.45, 0.26);
            const legMesh = new THREE.Mesh(legGeo, this.materials.leather);
            legMesh.position.set(0, -0.2, 0);
            leg.add(legMesh);

            // Boot / Shoe
            const bootGeo = new THREE.BoxGeometry(0.26, 0.25, 0.36);
            const bootMat = (charClass === 'warrior') ? this.materials.armorMetal : this.materials.belt;
            const boot = new THREE.Mesh(bootGeo, bootMat);
            boot.position.set(0, -0.45, 0.05);
            leg.add(boot);

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
            // --- MAIN HAND: Steel Broadsword ---
            const sword = new THREE.Group();

            const bladeGeo = new THREE.BoxGeometry(0.14, 0.85, 0.04);
            const blade = new THREE.Mesh(bladeGeo, this.materials.blade);
            blade.position.set(0, 0.48, 0);
            sword.add(blade);

            const tipGeo = new THREE.ConeGeometry(0.098, 0.18, 4);
            const tip = new THREE.Mesh(tipGeo, this.materials.blade);
            tip.position.set(0, 0.98, 0);
            tip.rotation.y = Math.PI / 4;
            sword.add(tip);

            const guardGeo = new THREE.BoxGeometry(0.34, 0.08, 0.1);
            const guard = new THREE.Mesh(guardGeo, this.materials.armorGold);
            guard.position.set(0, 0.04, 0);
            sword.add(guard);

            const gripGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.22, 6);
            const grip = new THREE.Mesh(gripGeo, this.materials.leather);
            grip.position.set(0, -0.1, 0);
            sword.add(grip);

            const pommelGeo = new THREE.SphereGeometry(0.06, 6, 6);
            const pommel = new THREE.Mesh(pommelGeo, this.materials.armorGold);
            pommel.position.set(0, -0.22, 0);
            sword.add(pommel);

            sword.position.set(0, 0, 0.1);
            sword.rotation.set(0.3, 0, -0.2);
            mainHand.add(sword);

            // --- OFF HAND: Heraldic Knight Shield ---
            const shield = new THREE.Group();
            const shieldBodyGeo = new THREE.BoxGeometry(0.48, 0.65, 0.08);
            const shieldBody = new THREE.Mesh(shieldBodyGeo, this.materials.armorMetal);
            shield.add(shieldBody);

            const shieldRimGeo = new THREE.BoxGeometry(0.52, 0.69, 0.04);
            const shieldRim = new THREE.Mesh(shieldRimGeo, this.materials.armorGold);
            shieldRim.position.z = -0.01;
            shield.add(shieldRim);

            const crestGeo = new THREE.BoxGeometry(0.18, 0.25, 0.04);
            const crest = new THREE.Mesh(crestGeo, this.materials.clothAccent);
            crest.position.z = 0.05;
            shield.add(crest);

            shield.position.set(0, 0, 0.18);
            shield.rotation.set(0.1, 0.3, -0.1);
            offHand.add(shield);

        } else {
            // --- MAIN HAND: Gnarled Wizard Staff ---
            const staff = new THREE.Group();

            const shaftGeo = new THREE.CylinderGeometry(0.04, 0.05, 1.4, 6);
            const shaft = new THREE.Mesh(shaftGeo, this.materials.wood);
            shaft.position.y = 0.3;
            staff.add(shaft);

            const clawGeo = new THREE.BoxGeometry(0.06, 0.22, 0.06);
            [-1, 1].forEach(side => {
                const claw = new THREE.Mesh(clawGeo, this.materials.wood);
                claw.position.set(side * 0.1, 1.0, 0);
                claw.rotation.z = -side * 0.25;
                staff.add(claw);
            });

            const crystalGeo = new THREE.OctahedronGeometry(0.14, 0);
            const crystal = new THREE.Mesh(crystalGeo, this.materials.magicCrystal);
            crystal.position.set(0, 1.08, 0);
            crystal.name = 'MagicCrystal';
            staff.add(crystal);

            const light = new THREE.PointLight(0x38ef7d, 1.2, 2.5);
            light.position.set(0, 1.08, 0);
            staff.add(light);
            magicLight = light;

            staff.position.set(0, -0.2, 0.15);
            mainHand.add(staff);

            // --- OFF HAND: Floating Arcane Orb ---
            const orbGroup = new THREE.Group();
            const orbGeo = new THREE.SphereGeometry(0.14, 8, 8);
            const orb = new THREE.Mesh(orbGeo, this.materials.magicOrb);
            orb.name = 'MagicOrb';
            orb.position.set(0, 0.2, 0.25);
            orbGroup.add(orb);

            const ringGeo = new THREE.TorusGeometry(0.22, 0.02, 4, 16);
            const ring = new THREE.Mesh(ringGeo, this.materials.armorGold);
            ring.position.set(0, 0.2, 0.25);
            ring.rotation.x = Math.PI / 3;
            orbGroup.add(ring);

            offHand.add(orbGroup);
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

        // Arm idle sway
        if (anim.leftArm) anim.leftArm.rotation.x = Math.sin(t * 1.8) * 0.05;
        if (anim.rightArm) anim.rightArm.rotation.x = -Math.sin(t * 1.8) * 0.05;

        // Cat tail sway!
        if (anim.tail) {
            anim.tail.rotation.y = Math.sin(t * 2.8) * 0.25;
            anim.tail.rotation.z = Math.cos(t * 2.0) * 0.12;
        }

        // Crystal pulse if Mage
        if (anim.magicLight) {
            anim.magicLight.intensity = 1.0 + Math.sin(t * 4.0) * 0.4;
        }
    }
}
