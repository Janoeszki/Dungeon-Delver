import * as THREE from '../vendor/three.module.js';
import { CombatStage3D } from './combat.js';

export const OVERWORLD_MONSTER_IDS = Object.freeze([
    'skeleton',
    'crypt_ghoul',
    'crypt_spider',
    'shadow_wraith'
]);

export const OVERWORLD_TRAP_TYPES = Object.freeze([
    'spike_pit',
    'pendulum_scythe',
    'dart_wall',
    'blood_rune'
]);

export const TRAP_STATES = Object.freeze([
    'armed',
    'revealed',
    'triggered',
    'disarmed'
]);

export const PROP_ANCHOR_TYPES = Object.freeze([
    'bone_pile',
    'cobweb',
    'skull_stack',
    'chains',
    'bloodstain'
]);

function makeFaceted(geometry) {
    return geometry;
}

/**
 * Builds an overworld 3D monster reusing CombatStage3D.prototype.buildMonsterModel
 * for 1:1 visual parity with combat, wrapped and scaled by `scale`.
 * Embeds ZERO PointLights to preserve the scene <= 8 light budget.
 */
export function buildOverworldMonster(monsterId = 'skeleton', scale = 1.0) {
    const resolvedId = OVERWORLD_MONSTER_IDS.includes(monsterId) ? monsterId : 'skeleton';
    const resolvedScale = Number.isFinite(scale) && scale > 0 ? scale : 1.0;

    const model = CombatStage3D.prototype.buildMonsterModel.call({}, resolvedId);
    const root = new THREE.Group();
    root.name = `OverworldMonster_${resolvedId}`;
    root.userData = {
        monsterId: resolvedId,
        isOverworldMonster: true
    };

    model.group.scale.setScalar(resolvedScale);
    root.add(model.group);

    return {
        group: root,
        modelGroup: model.group,
        animState: model.animState,
        monsterId: resolvedId,
        scale: resolvedScale
    };
}

/**
 * Animates idle breathing/hover/leg-twitch and aggro lunge/stride on an overworld monster.
 */
export function updateOverworldMonster(entry, delta = 0.016, elapsed = 0, isAggro = false) {
    const anim = entry?.animState || entry?.userData?.animState;
    if (!anim) return;

    const dt = Number.isFinite(delta) && delta > 0 ? Math.min(delta, 0.1) : 0;
    anim.time = (anim.time || 0) + dt;
    const t = anim.time || elapsed || 0;

    if (anim.soulCore) {
        anim.soulCore.rotation.y += dt * (isAggro ? 4.2 : 2.5);
        anim.soulCore.rotation.x += dt * 1.2;
    }
    if (anim.auraGroup) {
        anim.auraGroup.rotation.y += dt * (isAggro ? 2.8 : 1.4);
    }

    if (anim.monsterId === 'crypt_spider') {
        if (anim.bodyGroup) {
            anim.bodyGroup.position.y = isAggro
                ? Math.abs(Math.sin(t * 8.5)) * 0.06
                : Math.sin(t * 3.6) * 0.025;
        }
        if (anim.abdomen) {
            anim.abdomen.rotation.x = 0.06 + Math.sin(t * (isAggro ? 6.5 : 3.2)) * (isAggro ? 0.12 : 0.06);
        }
        if (Array.isArray(anim.fangs)) {
            anim.fangs.forEach((f, idx) => {
                const dir = idx === 0 ? -1 : 1;
                f.rotation.z = dir * (0.06 + Math.sin(t * (isAggro ? 14 : 7.5) + idx) * (isAggro ? 0.18 : 0.08));
            });
        }
        if (Array.isArray(anim.spiderLegs)) {
            anim.spiderLegs.forEach((leg, idx) => {
                const phase = t * (isAggro ? 11.5 : 4.2) + idx * 0.9;
                leg.hipGroup.rotation.z = leg.side * Math.sin(phase) * (isAggro ? 0.18 : 0.07);
                leg.kneeGroup.rotation.z = -leg.side * Math.cos(phase) * (isAggro ? 0.18 : 0.08);
            });
        }
        return;
    }

    if (anim.monsterId === 'shadow_wraith') {
        if (anim.bodyGroup) {
            anim.bodyGroup.position.y = (isAggro ? 0.22 : 0.14) + Math.sin(t * (isAggro ? 3.8 : 2.2)) * 0.10;
            anim.bodyGroup.rotation.z = Math.sin(t * 1.1) * 0.04;
            anim.bodyGroup.rotation.x = isAggro ? 0.16 : 0;
        }
        if (Array.isArray(anim.shroudTails)) {
            anim.shroudTails.forEach((tail, idx) => {
                tail.rotation.x = Math.sin(t * (isAggro ? 5.0 : 2.8) + idx * 0.8) * (isAggro ? 0.26 : 0.18);
            });
        }
        if (anim.head) anim.head.rotation.y = Math.sin(t * 1.5) * 0.10;
        if (anim.rightArm) {
            anim.rightArm.rotation.x = isAggro
                ? -1.05 + Math.sin(t * 5.0) * 0.28
                : -0.55 + Math.sin(t * 2.0) * 0.12;
        }
        if (anim.leftArm) {
            anim.leftArm.rotation.x = isAggro
                ? -1.05 - Math.sin(t * 5.0) * 0.28
                : -0.55 - Math.sin(t * 2.0) * 0.12;
        }
        return;
    }

    // skeleton & crypt_ghoul
    const crouchOffset = anim.monsterId === 'crypt_ghoul' ? -0.04 : 0;
    if (anim.torso) {
        anim.torso.position.y = crouchOffset + Math.sin(t * (isAggro ? 5.2 : 2.4)) * (isAggro ? 0.05 : 0.03);
        anim.torso.rotation.x = isAggro ? (anim.monsterId === 'crypt_ghoul' ? 0.26 : 0.12) : 0;
    }
    if (anim.head) {
        anim.head.rotation.y = isAggro ? 0 : Math.sin(t * 1.3) * 0.08;
    }
    if (anim.rightArm) {
        anim.rightArm.rotation.x = isAggro
            ? -0.85 + Math.sin(t * 6.5) * 0.35
            : -0.15 + Math.sin(t * 2.1) * 0.08;
    }
    if (anim.leftArm) {
        anim.leftArm.rotation.x = isAggro
            ? -0.55 - Math.sin(t * 6.5) * 0.28
            : -0.25 - Math.sin(t * 2.1) * 0.05;
    }
    if (anim.leftLeg) {
        anim.leftLeg.rotation.x = isAggro ? Math.sin(t * 8.0) * 0.42 : anim.leftLeg.rotation.x * 0.85;
    }
    if (anim.rightLeg) {
        anim.rightLeg.rotation.x = isAggro ? -Math.sin(t * 8.0) * 0.42 : anim.rightLeg.rotation.x * 0.85;
    }
}

/**
 * Builds distinct 3D trap props for all 4 Floor 1 trap archetypes:
 * `spike_pit`, `pendulum_scythe`, `dart_wall`, `blood_rune`.
 */
export function buildTrapProp(trapType = 'spike_pit', trapState = 'armed') {
    const resolvedType = OVERWORLD_TRAP_TYPES.includes(trapType) ? trapType : 'spike_pit';
    const resolvedState = TRAP_STATES.includes(trapState) ? trapState : 'armed';

    const group = new THREE.Group();
    group.name = `Trap_${resolvedType}`;
    group.userData = {
        trapType: resolvedType,
        trapState: resolvedState,
        isTrapProp: true
    };

    const parts = {};

    if (resolvedType === 'spike_pit') {
        const pitDepthMat = new THREE.MeshBasicMaterial({ color: 0x05070a });
        const rimMat = new THREE.MeshLambertMaterial({ color: 0x3b2a22, flatShading: true });
        const spikeMat = new THREE.MeshLambertMaterial({
            color: 0x64748b,
            emissive: 0x000000,
            flatShading: true
        });
        const grateMat = new THREE.MeshLambertMaterial({ color: 0x475569, flatShading: true });
        const seamMat = new THREE.MeshBasicMaterial({
            color: 0x7c2d12,
            transparent: true,
            opacity: 0.35
        });

        const pitHole = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.04, 2.05), pitDepthMat);
        pitHole.position.y = 0.02;
        group.add(pitHole);

        // Cracked stone border rim (4 beveled edge bars)
        const rimGroup = new THREE.Group();
        const barH = 0.09;
        const nRim = new THREE.Mesh(new THREE.BoxGeometry(2.35, barH, 0.18), rimMat);
        nRim.position.set(0, barH / 2, -1.08);
        const sRim = nRim.clone();
        sRim.position.z = 1.08;
        const wRim = new THREE.Mesh(new THREE.BoxGeometry(0.18, barH, 2.35), rimMat);
        wRim.position.set(-1.08, barH / 2, 0);
        const eRim = wRim.clone();
        eRim.position.x = 1.08;
        rimGroup.add(nRim, sRim, wRim, eRim);
        group.add(rimGroup);

        // Subtle floor warning seam
        const warnRing = new THREE.Mesh(new THREE.RingGeometry(1.06, 1.18, 4), seamMat);
        warnRing.rotation.x = -Math.PI / 2;
        warnRing.rotation.z = Math.PI / 4;
        warnRing.position.y = 0.035;
        group.add(warnRing);

        // Spike bed (9 iron spikes)
        const spikeBed = new THREE.Group();
        spikeBed.name = 'SpikeBed';
        const spikeGeo = makeFaceted(new THREE.ConeGeometry(0.08, 0.72, 4));
        for (let ix = -1; ix <= 1; ix++) {
            for (let iz = -1; iz <= 1; iz++) {
                const sp = new THREE.Mesh(spikeGeo, spikeMat);
                sp.position.set(ix * 0.56, 0.22, iz * 0.56);
                sp.castShadow = true;
                spikeBed.add(sp);
            }
        }
        group.add(spikeBed);

        // Disarm lock grate / wedge slab
        const lockGrate = new THREE.Group();
        lockGrate.name = 'LockGrate';
        for (let g = -0.75; g <= 0.75; g += 0.375) {
            const bar = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.06, 0.08), grateMat);
            bar.position.set(0, 0.07, g);
            lockGrate.add(bar);
        }
        const cross = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 2.0), grateMat);
        cross.position.y = 0.075;
        lockGrate.add(cross);
        lockGrate.visible = false;
        group.add(lockGrate);

        parts.spikeBed = spikeBed;
        parts.lockGrate = lockGrate;
        parts.spikeMat = spikeMat;
        parts.seamMat = seamMat;
        parts.warnRing = warnRing;

    } else if (resolvedType === 'pendulum_scythe') {
        const ironMat = new THREE.MeshLambertMaterial({ color: 0x2a3140, flatShading: true });
        const bladeMat = new THREE.MeshLambertMaterial({
            color: 0x94a3b8,
            emissive: 0x000000,
            flatShading: true
        });
        const bloodEdgeMat = new THREE.MeshLambertMaterial({
            color: 0x7f1d1d,
            emissive: 0x220505,
            flatShading: true
        });
        const floorTrackMat = new THREE.MeshBasicMaterial({
            color: 0x475569,
            transparent: true,
            opacity: 0.45
        });

        // Floor gouge arc beneath swinging blade
        const track = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.02, 0.26), floorTrackMat);
        track.position.y = 0.015;
        group.add(track);

        // Overhead iron gantry posts (positioned laterally so hero path in center stays unobstructed)
        const postGeo = new THREE.BoxGeometry(0.18, 2.75, 0.18);
        [-1.35, 1.35].forEach((px) => {
            const post = new THREE.Mesh(postGeo, ironMat);
            post.position.set(px, 1.375, -0.55);
            post.castShadow = true;
            group.add(post);
        });
        const crossbar = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.16, 0.22), ironMat);
        crossbar.position.set(0, 2.72, -0.55);
        crossbar.castShadow = true;
        group.add(crossbar);

        // Swinging pendulum arm + crescent scythe
        const pivot = new THREE.Group();
        pivot.name = 'PendulumPivot';
        pivot.position.set(0, 2.68, -0.55);

        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.05, 6), ironMat);
        rod.position.set(0, -1.02, 0.35);
        rod.rotation.x = 0.18;
        pivot.add(rod);

        const bladeGroup = new THREE.Group();
        bladeGroup.position.set(0, -2.02, 0.55);
        const mainBlade = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.28, 0.05), bladeMat);
        mainBlade.castShadow = true;
        const edge = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.07, 0.06), bloodEdgeMat);
        edge.position.y = -0.14;
        const tipL = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.32, 4), bladeMat);
        tipL.position.set(-0.56, 0.08, 0);
        tipL.rotation.z = 0.65;
        const tipR = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.32, 4), bladeMat);
        tipR.position.set(0.56, 0.08, 0);
        tipR.rotation.z = -0.65;
        bladeGroup.add(mainBlade, edge, tipL, tipR);
        pivot.add(bladeGroup);

        group.add(pivot);

        // Safety wedge clamp visible when disarmed
        const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.25, 0.35), ironMat);
        clamp.position.set(0, 2.65, -0.55);
        clamp.visible = false;
        group.add(clamp);

        parts.pivot = pivot;
        parts.bladeMat = bladeMat;
        parts.bloodEdgeMat = bloodEdgeMat;
        parts.floorTrackMat = floorTrackMat;
        parts.clamp = clamp;

    } else if (resolvedType === 'dart_wall') {
        const stoneMat = new THREE.MeshLambertMaterial({ color: 0x262d3d, flatShading: true });
        const skullMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8, flatShading: true });
        const slitMat = new THREE.MeshBasicMaterial({ color: 0x090b10 });
        const dartMat = new THREE.MeshLambertMaterial({
            color: 0x84cc16,
            emissive: 0x1a2e05,
            flatShading: true
        });
        const plugMat = new THREE.MeshLambertMaterial({ color: 0x57534e, flatShading: true });
        const plateMat = new THREE.MeshLambertMaterial({
            color: 0x333c4f,
            emissive: 0x000000,
            flatShading: true
        });

        // Pressure trigger flagstone in center
        const plate = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 1.4), plateMat);
        plate.position.y = 0.025;
        group.add(plate);

        // Flanking carved skull-relief stone plinths
        const plinths = [];
        const darts = [];
        const plugs = [];
        const eyeLights = [];

        [-1.35, 1.35].forEach((px) => {
            const sideSign = px < 0 ? 1 : -1;
            const plinth = new THREE.Group();
            plinth.position.set(px, 0, 0);

            const body = new THREE.Mesh(new THREE.BoxGeometry(0.44, 1.35, 0.65), stoneMat);
            body.position.y = 0.675;
            body.castShadow = true;
            plinth.add(body);

            // Carved skull relief facing center
            const relief = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.36), skullMat);
            relief.position.set(sideSign * 0.24, 0.85, 0);
            plinth.add(relief);

            // Firing jaw slit
            const slit = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.10, 0.22), slitMat);
            slit.position.set(sideSign * 0.28, 0.72, 0);
            plinth.add(slit);

            // Subtle skull eye glints
            const eyeMat = new THREE.MeshBasicMaterial({ color: 0x475569 });
            [-0.08, 0.08].forEach((ez) => {
                const eye = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.06), eyeMat);
                eye.position.set(sideSign * 0.30, 0.92, ez);
                plinth.add(eye);
            });
            eyeLights.push(eyeMat);

            // Extending dart needles (shown prominently on trigger)
            const dartGroup = new THREE.Group();
            dartGroup.position.set(sideSign * 0.30, 0.72, 0);
            for (const dz of [-0.07, 0.07]) {
                const dart = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.45, 4), dartMat);
                dart.rotation.z = -sideSign * (Math.PI / 2);
                dart.position.set(sideSign * 0.16, 0, dz);
                dartGroup.add(dart);
            }
            dartGroup.visible = false;
            plinth.add(dartGroup);
            darts.push(dartGroup);

            // Stone plug wedges for disarmed state
            const plug = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.24), plugMat);
            plug.position.set(sideSign * 0.29, 0.72, 0);
            plug.visible = false;
            plinth.add(plug);
            plugs.push(plug);

            group.add(plinth);
            plinths.push(plinth);
        });

        parts.plate = plate;
        parts.plateMat = plateMat;
        parts.darts = darts;
        parts.plugs = plugs;
        parts.eyeLights = eyeLights;

    } else {
        // blood_rune
        const slateMat = new THREE.MeshLambertMaterial({ color: 0x1e2430, flatShading: true });
        const outerRingMat = new THREE.MeshBasicMaterial({
            color: 0x7f1d1d,
            transparent: true,
            opacity: 0.48,
            side: THREE.DoubleSide
        });
        const innerSigilMat = new THREE.MeshBasicMaterial({
            color: 0x991b1b,
            transparent: true,
            opacity: 0.42
        });

        const baseDisc = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.28, 0.04, 8), slateMat);
        baseDisc.position.y = 0.02;
        baseDisc.receiveShadow = true;
        group.add(baseDisc);

        const outerRing = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.12, 8), outerRingMat);
        outerRing.rotation.x = -Math.PI / 2;
        outerRing.position.y = 0.048;
        group.add(outerRing);

        const sigilGroup = new THREE.Group();
        sigilGroup.position.y = 0.052;
        for (let i = 0; i < 4; i++) {
            const bar = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.015, 0.07), innerSigilMat);
            bar.rotation.y = (i * Math.PI) / 4;
            sigilGroup.add(bar);
        }
        const coreHex = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), innerSigilMat);
        coreHex.scale.set(1, 0.18, 1);
        sigilGroup.add(coreHex);
        group.add(sigilGroup);

        // Corner rune stones
        const stones = [];
        for (let i = 0; i < 4; i++) {
            const ang = (i * Math.PI) / 2 + Math.PI / 4;
            const stone = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.22), slateMat);
            stone.position.set(Math.cos(ang) * 1.15, 0.12, Math.sin(ang) * 1.15);
            stone.rotation.y = ang;
            stone.castShadow = true;
            group.add(stone);
            stones.push(stone);
        }

        parts.outerRingMat = outerRingMat;
        parts.innerSigilMat = innerSigilMat;
        parts.sigilGroup = sigilGroup;
        parts.outerRing = outerRing;
        parts.baseDisc = baseDisc;
    }

    const entry = {
        group,
        trapType: resolvedType,
        trapState: resolvedState,
        state: resolvedState,
        parts,
        animTime: 0,
        triggerTimer: 0
    };

    updateTrapPropVisual(entry, resolvedState, 0, 0);
    return entry;
}

/**
 * Updates 3D trap prop visual state and subtle/dramatic animations across
 * `armed`, `revealed`, `triggered`, and `disarmed`.
 */
export function updateTrapPropVisual(entry, trapState, delta = 0.016, elapsed = 0) {
    if (!entry || !entry.group) return;

    const nextState = TRAP_STATES.includes(trapState)
        ? trapState
        : (entry.trapState || 'armed');

    if (nextState !== entry.trapState) {
        entry.trapState = nextState;
        entry.state = nextState;
        entry.group.userData.trapState = nextState;
        if (nextState === 'triggered') {
            entry.triggerTimer = 1.0;
        }
    }

    const dt = Number.isFinite(delta) && delta > 0 ? Math.min(delta, 0.1) : 0;
    entry.animTime = (entry.animTime || 0) + dt;
    if (entry.triggerTimer > 0) {
        entry.triggerTimer = Math.max(0, entry.triggerTimer - dt * 1.4);
    }

    const t = entry.animTime || elapsed || 0;
    const { trapType, parts } = entry;
    if (!parts) return;

    if (trapType === 'spike_pit') {
        if (nextState === 'armed') {
            parts.spikeBed.position.y = -0.14;
            parts.spikeMat.color.setHex(0x64748b);
            parts.spikeMat.emissive.setHex(0x000000);
            parts.seamMat.color.setHex(0x7c2d12);
            parts.seamMat.opacity = 0.28;
            parts.lockGrate.visible = false;
        } else if (nextState === 'revealed') {
            parts.spikeBed.position.y = 0.06 + Math.sin(t * 3.0) * 0.02;
            parts.spikeMat.color.setHex(0x94a3b8);
            parts.spikeMat.emissive.setHex(0x7c2d12);
            parts.seamMat.color.setHex(0xf97316);
            parts.seamMat.opacity = 0.72;
            parts.lockGrate.visible = false;
        } else if (nextState === 'triggered') {
            parts.spikeBed.position.y = 0.36 + entry.triggerTimer * 0.14;
            parts.spikeMat.color.setHex(0xef4444);
            parts.spikeMat.emissive.setHex(0x7f1d1d);
            parts.seamMat.color.setHex(0xef4444);
            parts.seamMat.opacity = 0.85;
            parts.lockGrate.visible = false;
        } else {
            // disarmed
            parts.spikeBed.position.y = -0.28;
            parts.spikeMat.color.setHex(0x334155);
            parts.spikeMat.emissive.setHex(0x000000);
            parts.seamMat.color.setHex(0x334155);
            parts.seamMat.opacity = 0.22;
            parts.lockGrate.visible = true;
        }
    } else if (trapType === 'pendulum_scythe') {
        if (nextState === 'armed') {
            parts.pivot.rotation.z = Math.sin(t * 1.45) * 0.24;
            parts.bladeMat.color.setHex(0x94a3b8);
            parts.bladeMat.emissive.setHex(0x000000);
            parts.floorTrackMat.color.setHex(0x475569);
            parts.floorTrackMat.opacity = 0.38;
            parts.clamp.visible = false;
        } else if (nextState === 'revealed') {
            parts.pivot.rotation.z = Math.sin(t * 2.4) * 0.45;
            parts.bladeMat.color.setHex(0xcbd5e1);
            parts.bladeMat.emissive.setHex(0x7c2d12);
            parts.floorTrackMat.color.setHex(0xf59e0b);
            parts.floorTrackMat.opacity = 0.75;
            parts.clamp.visible = false;
        } else if (nextState === 'triggered') {
            const swingDecay = 0.35 + entry.triggerTimer * 0.85;
            parts.pivot.rotation.z = Math.sin(t * 9.5) * swingDecay;
            parts.bladeMat.color.setHex(0xdc2626);
            parts.bladeMat.emissive.setHex(0x450a0a);
            parts.floorTrackMat.color.setHex(0xdc2626);
            parts.floorTrackMat.opacity = 0.8;
            parts.clamp.visible = false;
        } else {
            // disarmed: wedged cleanly high to one side
            parts.pivot.rotation.z = 0.78;
            parts.bladeMat.color.setHex(0x3f4959);
            parts.bladeMat.emissive.setHex(0x000000);
            parts.floorTrackMat.color.setHex(0x1e293b);
            parts.floorTrackMat.opacity = 0.22;
            parts.clamp.visible = true;
        }
    } else if (trapType === 'dart_wall') {
        if (nextState === 'armed') {
            parts.plate.position.y = 0.025;
            parts.plateMat.color.setHex(0x333c4f);
            parts.plateMat.emissive.setHex(0x000000);
            parts.darts.forEach((d) => { d.visible = false; });
            parts.plugs.forEach((p) => { p.visible = false; });
            parts.eyeLights.forEach((m) => m.color.setHex(0x475569));
        } else if (nextState === 'revealed') {
            parts.plate.position.y = 0.035;
            parts.plateMat.color.setHex(0x7c2d12);
            parts.plateMat.emissive.setHex(0x431407);
            parts.darts.forEach((d) => { d.visible = false; });
            parts.plugs.forEach((p) => { p.visible = false; });
            parts.eyeLights.forEach((m) => m.color.setHex(0xf97316));
        } else if (nextState === 'triggered') {
            parts.plate.position.y = 0.008;
            parts.plateMat.color.setHex(0x450a0a);
            parts.plateMat.emissive.setHex(0x7f1d1d);
            parts.darts.forEach((d, idx) => {
                d.visible = true;
                const s = idx === 0 ? 1 : -1;
                d.position.x = s * (0.36 + (1 - entry.triggerTimer) * 0.45);
            });
            parts.plugs.forEach((p) => { p.visible = false; });
            parts.eyeLights.forEach((m) => m.color.setHex(0x84cc16));
        } else {
            // disarmed
            parts.plate.position.y = 0.015;
            parts.plateMat.color.setHex(0x1f2937);
            parts.plateMat.emissive.setHex(0x000000);
            parts.darts.forEach((d) => { d.visible = false; });
            parts.plugs.forEach((p) => { p.visible = true; });
            parts.eyeLights.forEach((m) => m.color.setHex(0x111827));
        }
    } else if (trapType === 'blood_rune') {
        if (nextState === 'armed') {
            const pulse = 0.34 + Math.sin(t * 2.2) * 0.08;
            parts.outerRingMat.color.setHex(0x7f1d1d);
            parts.outerRingMat.opacity = pulse;
            parts.innerSigilMat.color.setHex(0x991b1b);
            parts.innerSigilMat.opacity = pulse * 0.9;
            parts.sigilGroup.rotation.y = t * 0.15;
        } else if (nextState === 'revealed') {
            const pulse = 0.72 + Math.sin(t * 5.0) * 0.18;
            parts.outerRingMat.color.setHex(0xef4444);
            parts.outerRingMat.opacity = pulse;
            parts.innerSigilMat.color.setHex(0xf97316);
            parts.innerSigilMat.opacity = pulse;
            parts.sigilGroup.rotation.y = t * 0.55;
        } else if (nextState === 'triggered') {
            const flash = 0.55 + entry.triggerTimer * 0.45;
            parts.outerRingMat.color.setHex(0xdc2626);
            parts.outerRingMat.opacity = flash;
            parts.innerSigilMat.color.setHex(0xfca5a5);
            parts.innerSigilMat.opacity = flash;
            parts.sigilGroup.rotation.y = t * 1.2;
        } else {
            // disarmed: extinguished cold slate
            parts.outerRingMat.color.setHex(0x334155);
            parts.outerRingMat.opacity = 0.24;
            parts.innerSigilMat.color.setHex(0x1e293b);
            parts.innerSigilMat.opacity = 0.2;
        }
    }
}

export const updateTrapVisual = updateTrapPropVisual;

/**
 * Builds 3D door prop (`door_portcullis` iron bars or `door_sanctum` obsidian double doors + chain seal).
 */
export function buildDoorProp(doorDef = {}) {
    const id = doorDef.id || 'door_portcullis';
    const width = Number.isFinite(doorDef.width) && doorDef.width > 0 ? doorDef.width : 2.0;
    const isSanctum = id.includes('sanctum');

    const group = new THREE.Group();
    group.name = `Door_${id}`;
    group.userData = {
        doorId: id,
        isDoorProp: true
    };
    if (doorDef.axis === 'z') {
        group.rotation.y = Math.PI / 2;
    }

    const stoneMat = new THREE.MeshLambertMaterial({
        color: isSanctum ? 0x161224 : 0x262e3e,
        flatShading: true
    });
    const metalMat = new THREE.MeshLambertMaterial({
        color: isSanctum ? 0x3b2f5c : 0x475569,
        flatShading: true
    });

    // Archway jamb pillars flanking doorway + top lintel (tall enough to tuck gate cleanly)
    const halfW = width / 2;
    [-halfW - 0.18, halfW + 0.18].forEach((px) => {
        const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.36, 2.9, 0.55), stoneMat);
        jamb.position.set(px, 1.45, 0);
        jamb.castShadow = true;
        jamb.receiveShadow = true;
        group.add(jamb);
    });
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(width + 0.72, 0.42, 0.62), stoneMat);
    lintel.position.set(0, 2.85, 0);
    lintel.castShadow = true;
    group.add(lintel);

    if (isSanctum) {
        const leafW = width * 0.48;
        const leafMat = new THREE.MeshLambertMaterial({ color: 0x1e182e, flatShading: true });
        const runeMat = new THREE.MeshBasicMaterial({ color: 0xa855f7 });

        const leftPivot = new THREE.Group();
        leftPivot.name = 'LeftDoorLeaf';
        leftPivot.position.set(-halfW, 0, 0);
        const leftPanel = new THREE.Mesh(new THREE.BoxGeometry(leafW, 2.55, 0.16), leafMat);
        leftPanel.position.set(leafW / 2, 1.275, 0);
        leftPanel.castShadow = true;
        const leftRune = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.4, 0.2), runeMat);
        leftRune.position.set(leafW * 0.55, 1.3, 0);
        leftPivot.add(leftPanel, leftRune);
        group.add(leftPivot);

        const rightPivot = new THREE.Group();
        rightPivot.name = 'RightDoorLeaf';
        rightPivot.position.set(halfW, 0, 0);
        const rightPanel = new THREE.Mesh(new THREE.BoxGeometry(leafW, 2.55, 0.16), leafMat);
        rightPanel.position.set(-leafW / 2, 1.275, 0);
        rightPanel.castShadow = true;
        const rightRune = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.4, 0.2), runeMat);
        rightRune.position.set(-leafW * 0.55, 1.3, 0);
        rightPivot.add(rightPanel, rightRune);
        group.add(rightPivot);

        const chainSeal = new THREE.Group();
        chainSeal.name = 'ChainSeal';
        [-0.35, 0.35].forEach((rot) => {
            const chain = new THREE.Mesh(new THREE.BoxGeometry(width + 0.1, 0.08, 0.24), metalMat);
            chain.position.set(0, 1.25, 0);
            chain.rotation.z = rot;
            chainSeal.add(chain);
        });
        const lockSeal = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), runeMat);
        lockSeal.position.set(0, 1.25, 0.14);
        chainSeal.add(lockSeal);
        group.add(chainSeal);

        return {
            group,
            doorId: id,
            isSanctum: true,
            isOpen: false,
            openProgress: 0,
            leftPivot,
            rightPivot,
            chainSeal
        };
    }

    // Portcullis iron bars
    const gate = new THREE.Group();
    gate.name = 'GateMesh';
    const span = width - 0.2;
    const barCount = 5;
    for (let i = 0; i < barCount; i++) {
        const bx = -span / 2 + (i / (barCount - 1)) * span;
        const bar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.045, 0.045, 2.55, 6),
            metalMat
        );
        bar.position.set(bx, 1.28, 0);
        bar.castShadow = true;
        gate.add(bar);

        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.16, 4), metalMat);
        spike.position.set(bx, 0.08, 0);
        spike.rotation.x = Math.PI;
        gate.add(spike);
    }
    [0.65, 1.45, 2.25].forEach((cy) => {
        const cross = new THREE.Mesh(new THREE.BoxGeometry(width - 0.05, 0.09, 0.11), metalMat);
        cross.position.set(0, cy, 0);
        gate.add(cross);
    });
    group.add(gate);

    return {
        group,
        doorId: id,
        isSanctum: false,
        isOpen: false,
        openProgress: 0,
        gate
    };
}

/**
 * Animates a 3D door prop smoothly between closed and open states.
 */
export function updateDoorPropVisual(doorEntry, isOpen, delta = 0.016) {
    if (!doorEntry) return;
    if (typeof isOpen === 'boolean') {
        doorEntry.isOpen = isOpen;
    }
    const target = doorEntry.isOpen ? 1 : 0;
    const step = Number.isFinite(delta) && delta > 0 ? Math.min(1, delta * 4.5) : 1;
    doorEntry.openProgress += (target - doorEntry.openProgress) * step;
    if (Math.abs(target - doorEntry.openProgress) < 0.01) {
        doorEntry.openProgress = target;
    }

    const p = doorEntry.openProgress;
    if (doorEntry.isSanctum) {
        if (doorEntry.leftPivot) doorEntry.leftPivot.rotation.y = -p * 1.45;
        if (doorEntry.rightPivot) doorEntry.rightPivot.rotation.y = p * 1.45;
        if (doorEntry.chainSeal) doorEntry.chainSeal.visible = p < 0.15;
    } else if (doorEntry.gate) {
        doorEntry.gate.position.y = p * 2.25;
        doorEntry.gate.scale.y = 1 - p * 0.25;
    }
}

export const setDoorPropOpen = updateDoorPropVisual;

/**
 * Builds 3D Shrine props (`moonwell`, plus `sarcophagus` and `monolith` fallbacks).
 * Embeds ZERO PointLights.
 */
export function buildShrineProp(encounter = {}) {
    const id = String(encounter.id || encounter.propType || 'moonwell').toLowerCase();
    const group = new THREE.Group();
    group.name = `Shrine_${id}`;

    if (id.includes('sarcophagus')) {
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
        group.add(coffin, lid);
        return { group, shrineType: 'sarcophagus', lid };
    }

    if (id.includes('monolith')) {
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
        group.add(obelisk, ring);
        return { group, shrineType: 'monolith', obelisk, ring };
    }

    // Default: Sacred Moonwell
    const marbleMat = new THREE.MeshLambertMaterial({ color: 0xd8e2dc, flatShading: true });
    const trimMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8, flatShading: true });
    const waterMat = new THREE.MeshBasicMaterial({ color: 0x2dd4bf });

    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.36, 1.48, 0.18, 12), trimMat);
    plinth.position.y = 0.09;
    plinth.receiveShadow = true;
    group.add(plinth);

    const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.26, 0.56, 12), marbleMat);
    basin.position.y = 0.42;
    basin.castShadow = true;
    basin.receiveShadow = true;
    group.add(basin);

    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 0.05, 12), waterMat);
    water.position.y = 0.69;
    water.name = 'ShrineWater';
    group.add(water);

    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.04, 0.035, 4, 16),
        new THREE.MeshBasicMaterial({ color: 0x5eead4 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.74;
    group.add(ring);

    return { group, shrineType: 'moonwell', water, waterMat, ring };
}

/**
 * Builds the Floor 1 Exit Seal / Spiral Descent Dais (`exit_seal`).
 * Embeds ZERO PointLights.
 */
export function buildExitSealProp(encounter = {}) {
    const group = new THREE.Group();
    group.name = `ExitSeal_${encounter.id || 'exit_seal'}`;

    const slateMat = new THREE.MeshLambertMaterial({ color: 0x1a1e2e, flatShading: true });
    const goldMat = new THREE.MeshLambertMaterial({
        color: 0xd97706,
        emissive: 0x451a03,
        emissiveIntensity: 0.45,
        flatShading: true
    });
    const sealMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const cyanMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    // Two-stepped descent dais
    const step1 = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.70, 0.16, 8), slateMat);
    step1.position.y = 0.08;
    step1.receiveShadow = true;
    const step2 = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.28, 0.16, 8), slateMat);
    step2.position.y = 0.24;
    step2.receiveShadow = true;
    group.add(step1, step2);

    // Spiral descent stair aperture steps
    for (let i = 0; i < 4; i++) {
        const stair = new THREE.Mesh(new THREE.BoxGeometry(0.9 - i * 0.14, 0.06, 0.28), slateMat);
        stair.position.set(0, 0.30 - i * 0.06, -0.3 + i * 0.22);
        group.add(stair);
    }

    // Gilded Phusza Seal Ring & Crown Pedestal
    const sealRing = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.045, 5, 16), sealMat);
    sealRing.rotation.x = Math.PI / 2;
    sealRing.position.y = 0.34;
    group.add(sealRing);

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.72, 6), goldMat);
    pedestal.position.y = 0.66;
    pedestal.castShadow = true;
    group.add(pedestal);

    const crownOrb = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), cyanMat);
    crownOrb.position.y = 1.26;
    crownOrb.name = 'CrownVaultMesh';
    group.add(crownOrb);

    const orbitRing = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.022, 4, 14), sealMat);
    orbitRing.position.y = 1.26;
    orbitRing.rotation.x = Math.PI / 3;
    group.add(orbitRing);

    return { group, sealRing, crownOrb, orbitRing, sealMat, opened: false };
}

/**
 * Builds scary crypt props for all 5 `propAnchors[].type` keys in `floor1Layout.js`:
 * `'bone_pile'`, `'cobweb'`, `'skull_stack'`, `'chains'`, `'bloodstain'`.
 */
export function buildRoomPropAnchor(anchor = {}) {
    const type = anchor.type || 'bone_pile';
    const group = new THREE.Group();
    group.name = `Prop_${type}`;
    group.userData = { propType: type };

    if (Number.isFinite(anchor.x) && Number.isFinite(anchor.z)) {
        group.position.set(anchor.x, 0, anchor.z);
    }

    const boneMat = new THREE.MeshLambertMaterial({ color: 0xd6d3d1, flatShading: true });
    const darkBoneMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8, flatShading: true });
    const socketMat = new THREE.MeshBasicMaterial({ color: 0x0b0e14 });
    const ironMat = new THREE.MeshLambertMaterial({ color: 0x334155, flatShading: true });

    if (type === 'bone_pile') {
        const boneGeo = new THREE.CylinderGeometry(0.038, 0.045, 0.56, 5);
        const configs = [
            { x: -0.1, y: 0.045, z: 0.05, rx: Math.PI / 2, ry: 0.4, rz: 0.08 },
            { x: 0.08, y: 0.06, z: -0.06, rx: Math.PI / 2, ry: -0.7, rz: 0.14 },
            { x: 0.0, y: 0.08, z: 0.02, rx: Math.PI / 2 - 0.1, ry: 1.2, rz: -0.1 },
            { x: -0.18, y: 0.04, z: -0.12, rx: Math.PI / 2, ry: 0.9, rz: 0.05 }
        ];
        configs.forEach((c, idx) => {
            const b = new THREE.Mesh(boneGeo, idx % 2 === 0 ? boneMat : darkBoneMat);
            b.position.set(c.x, c.y, c.z);
            b.rotation.set(c.rx, c.ry, c.rz);
            b.castShadow = true;
            group.add(b);
        });
        const rib = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 4, 6, Math.PI), darkBoneMat);
        rib.position.set(0.06, 0.09, 0.08);
        rib.rotation.x = Math.PI / 3;
        group.add(rib);

    } else if (type === 'cobweb') {
        const webMat = new THREE.MeshBasicMaterial({
            color: 0xcbd5e1,
            transparent: true,
            opacity: 0.36,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const plane = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.88, 5, 1, true), webMat);
        plane.position.set(0, 0.65, 0);
        plane.rotation.set(Math.PI * 0.62, 0.4, 0.2);
        group.add(plane);

        const strandGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.95, 4);
        for (let i = 0; i < 4; i++) {
            const s = new THREE.Mesh(strandGeo, webMat);
            s.position.set((i - 1.5) * 0.14, 0.55, 0);
            s.rotation.z = (i - 1.5) * 0.25;
            group.add(s);
        }

    } else if (type === 'skull_stack') {
        const makeSkull = (x, y, z, ry) => {
            const sk = new THREE.Group();
            sk.position.set(x, y, z);
            sk.rotation.y = ry;
            const cranium = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), boneMat);
            cranium.position.y = 0.14;
            cranium.castShadow = true;
            sk.add(cranium);
            [-0.06, 0.06].forEach((ex) => {
                const eye = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.03), socketMat);
                eye.position.set(ex, 0.15, 0.13);
                sk.add(eye);
            });
            return sk;
        };
        group.add(
            makeSkull(-0.16, 0, 0.08, 0.25),
            makeSkull(0.16, 0, 0.08, -0.3),
            makeSkull(0, 0, -0.14, 0.05),
            makeSkull(0, 0.22, -0.02, -0.15)
        );

    } else if (type === 'chains') {
        const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.24), ironMat);
        bracket.position.y = 0.07;
        group.add(bracket);
        const linkGeo = new THREE.TorusGeometry(0.08, 0.02, 4, 8);
        for (let i = 0; i < 5; i++) {
            const link = new THREE.Mesh(linkGeo, ironMat);
            link.position.set(i * 0.09 - 0.16, 0.04 + (i < 2 ? i * 0.08 : 0), i * 0.05);
            link.rotation.x = i < 2 ? 0 : Math.PI / 2;
            link.rotation.y = i * 0.5;
            link.castShadow = true;
            group.add(link);
        }

    } else if (type === 'bloodstain') {
        const bloodMat = new THREE.MeshBasicMaterial({
            color: 0x5f0f14,
            transparent: true,
            opacity: 0.78,
            depthWrite: false
        });
        const darkClotMat = new THREE.MeshBasicMaterial({
            color: 0x3b080b,
            transparent: true,
            opacity: 0.82,
            depthWrite: false
        });
        const mainPool = new THREE.Mesh(new THREE.CircleGeometry(0.56, 9), bloodMat);
        mainPool.rotation.x = -Math.PI / 2;
        mainPool.scale.set(1.25, 0.85, 1);
        mainPool.position.y = 0.014;
        const innerPool = new THREE.Mesh(new THREE.CircleGeometry(0.30, 7), darkClotMat);
        innerPool.rotation.x = -Math.PI / 2;
        innerPool.position.set(0.14, 0.016, -0.08);
        const splatter = new THREE.Mesh(new THREE.CircleGeometry(0.16, 6), bloodMat);
        splatter.rotation.x = -Math.PI / 2;
        splatter.position.set(-0.42, 0.015, 0.26);
        group.add(mainPool, innerPool, splatter);

    } else {
        const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), ironMat);
        stone.position.y = 0.14;
        group.add(stone);
    }

    return group;
}

/**
 * Builds a wall-mounted torch sconce mesh + emissive flame WITHOUT creating a PointLight.
 * Dynamic illumination is handled by the <= 8 pooled PointLights in DungeonWorldApp.
 */
export function buildTorchSconceMesh(torchSpot = {}) {
    const group = new THREE.Group();
    group.name = 'TorchSconce';

    const bracketMat = new THREE.MeshLambertMaterial({ color: 0x181c24, flatShading: true });
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x4e342e, flatShading: true });
    const flameColor = torchSpot.color || 0xff9933;
    const flameMat = new THREE.MeshBasicMaterial({ color: flameColor });

    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.22), bracketMat);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.36, 5), woodMat);
    stick.position.set(0, 0.12, 0.08);
    stick.rotation.x = 0.25;

    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.26, 5), flameMat);
    flame.name = 'TorchFlame';
    flame.position.set(0, 0.34, 0.13);

    group.add(bracket, stick, flame);
    if (Number.isFinite(torchSpot.x) && Number.isFinite(torchSpot.z)) {
        group.position.set(torchSpot.x, 2.35, torchSpot.z);
    }

    return { group, flame, flameMat };
}

/**
 * Builds a glowing POI beacon (`#ffcf40` diamond + `#38bdf8` ring) for visible POIs.
 */
export function buildBeacon(color = 0xffcf40, ringColor = 0x38bdf8) {
    const beacon = new THREE.Group();
    beacon.name = 'Beacon';

    const diamond = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.22, 0),
        new THREE.MeshBasicMaterial({ color })
    );
    beacon.add(diamond);

    const outerRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.36, 0.02, 4, 16),
        new THREE.MeshBasicMaterial({ color: ringColor })
    );
    outerRing.rotation.x = Math.PI / 2;
    beacon.add(outerRing);

    return beacon;
}

/**
 * Builds subtle floating crypt dust/spore particles (`THREE.Points`) with gentle motion
 * so peripheral idle RMS stays low (< 5.0).
 */
export function buildDustMotesSystem({
    bounds = { minX: -18, maxX: 18, minZ: -35, maxZ: 25 },
    count = 140,
    color = 0x7c8aa3
} = {}) {
    const safeCount = Math.max(10, Math.min(400, Math.floor(count)));
    const positions = new Float32Array(safeCount * 3);
    const phases = new Float32Array(safeCount);

    const spanX = (bounds.maxX - bounds.minX) || 36;
    const spanZ = (bounds.maxZ - bounds.minZ) || 60;

    for (let i = 0; i < safeCount; i++) {
        // Deterministic pseudo-random spread for consistent tests & visuals
        const s1 = Math.sin(i * 12.9898 + 1.23) * 43758.5453;
        const s2 = Math.sin(i * 78.233 + 4.56) * 43758.5453;
        const s3 = Math.sin(i * 39.425 + 7.89) * 43758.5453;
        const rx = s1 - Math.floor(s1);
        const ry = s2 - Math.floor(s2);
        const rz = s3 - Math.floor(s3);

        positions[i * 3] = bounds.minX + rx * spanX;
        positions[i * 3 + 1] = 0.25 + ry * 2.8;
        positions[i * 3 + 2] = bounds.minZ + rz * spanZ;
        phases[i] = rx * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color,
        size: 0.065,
        transparent: true,
        opacity: 0.28,
        depthWrite: false
    });

    const points = new THREE.Points(geometry, material);
    points.name = 'CryptDustMotes';

    return {
        points,
        geometry,
        material,
        update(delta = 0.016, elapsed = 0) {
            const dt = Number.isFinite(delta) ? Math.min(delta, 0.1) : 0;
            if (dt <= 0) return;
            const attr = geometry.getAttribute('position');
            if (!attr) return;
            const arr = attr.array;
            for (let i = 0; i < safeCount; i++) {
                const idx = i * 3;
                arr[idx + 1] += dt * 0.08;
                arr[idx] += Math.sin(elapsed * 0.5 + phases[i]) * dt * 0.04;
                if (arr[idx + 1] > 3.1) {
                    arr[idx + 1] = 0.25;
                }
            }
            attr.needsUpdate = true;
        }
    };
}

/**
 * Recursively disposes all geometries, materials, and textures under an Object3D.
 */
export function disposeObject3D(root) {
    if (!root || typeof root.traverse !== 'function') return;
    const textureKeys = [
        'map',
        'alphaMap',
        'aoMap',
        'bumpMap',
        'emissiveMap',
        'envMap',
        'lightMap',
        'metalnessMap',
        'normalMap',
        'roughnessMap',
        'specularMap'
    ];

    const disposeMat = (mat) => {
        if (!mat) return;
        for (const key of textureKeys) {
            if (mat[key] && typeof mat[key].dispose === 'function') {
                mat[key].dispose();
            }
        }
        if (typeof mat.dispose === 'function') {
            mat.dispose();
        }
    };

    root.traverse((obj) => {
        if (obj.geometry && typeof obj.geometry.dispose === 'function') {
            obj.geometry.dispose();
        }
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                for (const m of obj.material) disposeMat(m);
            } else {
                disposeMat(obj.material);
            }
        }
    });
}
