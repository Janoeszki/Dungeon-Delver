/**
 * Adventure World POI & Encounter Definitions
 * Each encounter presents a situation, skill check (D20 + Stat), and dynamic rewards or hazards.
 */

export const ENCOUNTERS = [
    {
        id: 'portcullis',
        name: 'Rusted Iron Portcullis',
        icon: '🚪',
        pos: { x: 0, z: -7 },
        description: 'A heavy iron portcullis blocks the archway leading deeper into the Royal Crypt. Dried blood and old scratches mark the bars.',
        resolved: false,
        options: [
            {
                label: 'Force the gate open with raw power',
                stat: 'str',
                statName: 'Strength',
                dc: 12,
                successMsg: 'With a roar, you wedge your fingers beneath the rusted spikes and hoist the iron gate upward! The path ahead is cleared.',
                failMsg: 'The heavy iron screeches but refuses to budge. The strain tears at your muscles and drops a shower of rust into your eyes.',
                reward: { xp: 25, unlocksDoor: true },
                penalty: { hpDamage: 8 }
            },
            {
                label: 'Pick the intricate mechanical lock',
                stat: 'agi',
                statName: 'Agility',
                dc: 12,
                successMsg: 'Using a fine wire and steady hands, you trip the counter-weights. The portcullis counter-pulley releases with a satisfying click!',
                failMsg: 'Your pick snaps inside the jammed tumblers with an ear-piercing clang, jarring your fingers.',
                reward: { xp: 25, unlocksDoor: true },
                penalty: { hpDamage: 6 }
            }
        ]
    },
    {
        id: 'sarcophagus',
        name: 'Sunken Sarcophagus',
        icon: '⚰️',
        pos: { x: 8.5, z: -9 },
        description: 'An ornate stone sarcophagus resting upon carved basalt gargoyles. Faint golden gleams peek through the cracked lid.',
        resolved: false,
        options: [
            {
                label: 'Heave the stone lid aside',
                stat: 'str',
                statName: 'Strength',
                dc: 13,
                successMsg: 'You shove the massive granite slab off with brute force! Inside lies the mummy of Lord Kaelen, clutching 50 Gold, a Ruby Amulet, and a Greater Healing Potion!',
                failMsg: 'The slab slips from your grip and crushes your knuckles against the stone pedestal.',
                reward: { gold: 50, item: 'Ruby Amulet (+15 HP)', consumable: 'Greater Healing Potion', xp: 35 },
                penalty: { hpDamage: 14 }
            },
            {
                label: 'Chant warding incantation to dispel the tomb curse',
                stat: 'int',
                statName: 'Intelligence',
                dc: 11,
                successMsg: 'Speaking the archaic words of binding, the tomb seals dissipate in azure flame! The lid glides open freely, revealing 50 Gold and ancient treasures!',
                failMsg: 'The necrotic ward twists your incantation! A burst of spectral frost lashes out across your face.',
                reward: { gold: 50, item: 'Ruby Amulet (+15 HP)', xp: 35 },
                penalty: { hpDamage: 12 }
            }
        ]
    },
    {
        id: 'monolith',
        name: 'Arcane Leyline Monolith',
        icon: '🔮',
        pos: { x: -8.5, z: -9 },
        description: 'A floating obsidian obelisk pulsing with cerulean runes. The air around it buzzes with dormant magical currents.',
        resolved: false,
        options: [
            {
                label: 'Attune to the cosmic runes',
                stat: 'int',
                statName: 'Intelligence',
                dc: 13,
                successMsg: 'You align your consciousness with the pulsing leyline. Ancient magical energy floods through you! Mana permanently restored and empowered.',
                failMsg: 'The volatile mana surges violently, shocking your nerves with static lightning!',
                reward: { mpRestore: 50, xp: 40, item: 'Leyline Blessing (+10 MP)' },
                penalty: { hpDamage: 10 }
            }
        ]
    },
    {
        id: 'pit_trap',
        name: 'Concealed Spike Pit',
        icon: '🕳️',
        pos: { x: 6, z: 2.5 },
        description: 'The cobblestones suddenly give way, revealing a treacherous 15-foot pit lined with blackened iron spikes!',
        resolved: false,
        options: [
            {
                label: 'Leap across the chasm to the far ledge',
                stat: 'agi',
                statName: 'Agility',
                dc: 11,
                successMsg: 'With remarkable grace, you kick off the collapsing edge and vault across, landing deftly on solid ground!',
                failMsg: 'You stumble at the edge and plummet into the pit! The jagged spikes pierce your armor before you scramble back up.',
                reward: { xp: 20 },
                penalty: { hpDamage: 22 }
            }
        ]
    },
    {
        id: 'skeleton',
        name: 'Skeletal Vanguard',
        icon: '💀',
        isCombat: true,
        monsterId: 'skeleton',
        pos: { x: -7.5, z: 2.5 },
        description: 'An ancient animated skeleton clad in tarnished mail raises a rusty halberd and turns its hollow, glowing eye sockets toward you!',
        resolved: false,
        options: [
            {
                label: 'Engage in Tactical Turn-Based Combat',
                action: 'combat',
                stat: 'str',
                statName: 'Strength'
            }
        ]
    },
    {
        id: 'moonwell',
        name: 'Sacred Healing Font',
        icon: '⛲',
        pos: { x: -2.5, z: 8.5 },
        description: 'A serene marble fountain illuminated by floating water-lilies. Clear enchanted water bubbles from a carved stone cherub.',
        resolved: false,
        options: [
            {
                label: 'Drink deeply and bathe your wounds',
                stat: 'vit',
                statName: 'Vitality',
                dc: 8,
                successMsg: 'The cool enchanted water invigorates your soul! All cuts seal and your magical stamina is completely restored.',
                failMsg: 'The mineral water is bitter and slightly stale, but still manages to soothe minor scratches (+15 HP).',
                reward: { fullHeal: true, xp: 15 },
                penalty: { partialHeal: 15 }
            }
        ]
    },
    {
        id: 'grand_chest',
        name: 'The Crown Vault Chest',
        icon: '👑',
        pos: { x: 0, z: -17 },
        description: 'At the heart of the inner sanctum sits the legendary Gilded Vault of Eldoria, secured with three interlocking dragon skull padlocks.',
        resolved: false,
        options: [
            {
                label: 'Disarm the triple-tumbler lock mechanism',
                stat: 'agi',
                statName: 'Agility',
                dc: 14,
                successMsg: 'Tumbler by tumbler, your deft fingers work the pins... CLACK! The vault chest swings open! A radiant glow fills the chamber as you claim the CROWN OF ELDORIA and 150 Gold!',
                failMsg: 'A hidden scythe blade snaps from the rim! It slices across your forearm and the chest remains locked.',
                reward: { gold: 150, item: '👑 CROWN OF ELDORIA', xp: 100, victory: true },
                penalty: { hpDamage: 18 }
            },
            {
                label: 'Smash through the dragon skull clasps',
                stat: 'str',
                statName: 'Strength',
                dc: 15,
                successMsg: 'You bring down all your might in a devastating blow! The ancient locks shatter! Inside glitters 150 Gold and the fabled CROWN OF ELDORIA!',
                failMsg: 'The lock repels your strike with a concussive shockwave, knocking you back into the stone wall.',
                reward: { gold: 150, item: '👑 CROWN OF ELDORIA', xp: 100, victory: true },
                penalty: { hpDamage: 20 }
            }
        ]
    }
];
