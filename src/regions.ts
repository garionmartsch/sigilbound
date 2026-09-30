import type { ElementKey } from './types';

/*
 * The campaign's world: nine elemental regions and the Sigil Gate finale.
 * This file is only words and settings, so it's safe to edit freely:
 * rename places, rewrite story lines, or change which Legendary rules a region.
 * The rules that turn this into stages live in src/campaign.ts.
 */

export interface Region {
  /** Permanent id, stored in saves. Never change an id once it has shipped. */
  id: string;
  name: string;
  el: ElementKey;
  /** The Legendary that rules the region and waits at the end of its trail. */
  boss: string;
  /** Names of the eight main stages; the last is the boss's lair. */
  stages: [string, string, string, string, string, string, string, string];
  /** Names of the two optional side stages. */
  sides: [string, string];
  /** Shown the first time a player reaches the region. */
  intro: string;
  /** Shown before the boss fight. */
  bossLine: string;
  /** Map background colors: sky at the top, ground at the bottom. */
  sky: string;
  ground: string;
}

export const REGIONS: Region[] = [
  {
    id: 'emberwild', name: 'Emberwild', el: 'pyre', boss: 'pyrrhax',
    stages: ['Cinder Road', 'Ashfall Ford', 'Kiln Gate', 'Smoke Hollow', 'Charred Grove', 'Molten Steps', 'Blazing Ridge', 'The World-Kiln'],
    sides: ['Ember Caves', 'Slag Pits'],
    intro: 'Ash falls like snow over the Emberwild. Something beneath the old kilns is waking, and every beast here answers to it.',
    bossLine: 'Pyrrhax rises from the World-Kiln, wings trailing cinders. Its sigil is cracked, and it blames you.',
    sky: '#3A1712', ground: '#1B0C0A',
  },
  {
    id: 'tidereach', name: 'Tidereach', el: 'tide', boss: 'thalassor',
    stages: ['Saltwind Shore', 'Kelp Shallows', 'Wreckers\' Cove', 'Pearl Steps', 'Undertow Straits', 'Coral Vault', 'Drowned Bell', 'The Deep Throne'],
    sides: ['Tidepools', 'Siren Rocks'],
    intro: 'The tides of the Reach run backward now. Sailors whisper that the Deep King has stopped sleeping.',
    bossLine: 'The sea parts. Thalassor lifts its crowned head, and the whole shore goes silent.',
    sky: '#0F2A46', ground: '#08131F',
  },
  {
    id: 'thornmere', name: 'Thornmere', el: 'thorn', boss: 'sylvarok',
    stages: ['Bramble Path', 'Mossfall', 'Hollow Oak', 'Thistle Glen', 'Rootmaze', 'Spore Marsh', 'Elder Grove', 'Heart of the Wild'],
    sides: ['Fern Hollow', 'Blossom Ring'],
    intro: 'The Thornmere grows a mile a night, swallowing roads and villages. The forest is angry, and it is looking for whoever broke the sigils.',
    bossLine: 'Antlers like an old oak part the canopy. Sylvarok has come to judge you.',
    sky: '#16301A', ground: '#0A160C',
  },
  {
    id: 'frostspire', name: 'Frostspire', el: 'frost', boss: 'glaciarch',
    stages: ['Rime Trail', 'Sleet Pass', 'Icicle Bridge', 'Snowdrift Camp', 'Frozen Falls', 'Glacier Gate', 'Hoarfrost Stair', 'The Frozen Throne'],
    sides: ['Crystal Hollow', 'Aurora Lake'],
    intro: 'Snow that never melts has buried the Frostspire passes. At the summit, a throne of ice is no longer empty.',
    bossLine: 'Glaciarch stands from its frozen throne, and the air itself begins to crack.',
    sky: '#1C3348', ground: '#0C1622',
  },
  {
    id: 'stormcrown', name: 'Stormcrown', el: 'storm', boss: 'fulgrax',
    stages: ['Static Fields', 'Rodwatch', 'Thunder Mesa', 'Sparkfall', 'Copper Ruins', 'Squall Bridge', 'Lightning Spire', 'Eye of the Tempest'],
    sides: ['Charged Hollow', 'Stormglass Dunes'],
    intro: 'Lightning has not stopped striking the Stormcrown for a hundred days. The storm has a heartbeat.',
    bossLine: 'Fulgrax roars, and the sky answers. Every bolt is aimed at you.',
    sky: '#241C44', ground: '#100C1E',
  },
  {
    id: 'stonedeep', name: 'Stonedeep', el: 'stone', boss: 'montagrim',
    stages: ['Quarry Road', 'Gravel Run', 'Boulder Maze', 'Shale Terraces', 'Geode Caverns', 'Basalt Columns', 'Crag Summit', 'The Living Mountain'],
    sides: ['Mica Grotto', 'Old Mine'],
    intro: 'Mountains are walking in the Stonedeep. The ground groans with every step.',
    bossLine: 'The largest mountain turns its face toward you. Montagrim is awake.',
    sky: '#2E2519', ground: '#15110B',
  },
  {
    id: 'galeheights', name: 'Galeheights', el: 'gale', boss: 'zephyrion',
    stages: ['Windmill Hill', 'Feather Steppe', 'Updraft Cliffs', 'Cloud Bridge', 'Drifting Isles', 'Cyclone Rim', 'Sky Temple', 'The High Winds'],
    sides: ['Kite Meadow', 'Whistling Arch'],
    intro: 'Islands float loose over the Galeheights, held aloft by winds that answer to one lord.',
    bossLine: 'Zephyrion descends, and the wind forgets how to be gentle.',
    sky: '#15363A', ground: '#0A1A1C',
  },
  {
    id: 'dawnhold', name: 'Dawnhold', el: 'radiant', boss: 'aurelion',
    stages: ['Pilgrim Road', 'Sunwell', 'Gilded Bridge', 'Halo Gardens', 'Lantern Walk', 'Choir Steps', 'Radiant Nave', 'Throne of Dawn'],
    sides: ['Chapel of Glass', 'Morning Orchard'],
    intro: 'The Dawnhold was a sanctuary. Its light has turned harsh and blinding, and its guardians no longer know friend from foe.',
    bossLine: 'Aurelion\'s mane blazes like a second sun. It will test whether you are worthy of the light.',
    sky: '#3A2E14', ground: '#1A140A',
  },
  {
    id: 'nightfall', name: 'Nightfall', el: 'umbral', boss: 'umbrath',
    stages: ['Dusk Road', 'Gloam Wood', 'Hollow Chapel', 'Starless Mere', 'Shade Market', 'Eclipse Bridge', 'Veil of Night', 'The Hollow Crown'],
    sides: ['Whispering Well', 'Moonless Garden'],
    intro: 'Where the Nightfall begins, the stars go out one by one. Every broken sigil led here.',
    bossLine: 'Umbrath unfurls from the dark, wearing a crown made of the sigils it shattered.',
    sky: '#1E1430', ground: '#0D0916',
  },
];

/** The finale at the end of each Circle: one stage against a Mythic. */
export const SIGIL_GATE = {
  id: 'gate',
  name: 'The Sigil Gate',
  /** Mythic bosses, taking turns from one Circle to the next. */
  bosses: ['luminarch', 'nihilarch', 'abyssarch'],
  intro: 'Beyond the Nightfall stands the Sigil Gate, where every bond in the world is written. Something ancient guards it.',
  bossLine: 'The Gate\'s guardian opens its eyes. It has watched every Summoner before you fall.',
  after: 'The Gate opens onto a new Circle. The sigils hold, for now, but the beasts beyond are stronger than before.',
  sky: '#2A1238', ground: '#0F0717',
};

/** Region intro for Circle II and later, when the player has seen the first one. */
export const returnIntro = (name: string, circle: string) =>
  `Circle ${circle}. The ${name} stirs again, fiercer than before. Its beasts have grown, and its ruler has evolved.`;
