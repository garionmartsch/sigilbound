import type { Species } from '../types';

/**
 * Wardens: boss-only beasts. One per element, each guarding the middle of a
 * region's trail. They are never summoned, dropped or given as rewards, so
 * players only ever meet them as bosses. Keys are permanent like every beast.
 *
 * The campaign picks a region's warden by element (see wardenFor in
 * src/campaign.ts); boss behavior is in src/bosses.ts.
 */
export const WARDENS: Record<string, Species> = {
  slagmaw:{name:'Slagmaw',el:'pyre',rarity:'epic',bossOnly:true,body:'golem',c1:'#4A2318',c2:'#FF7A2E',eye:'#FFE08A',hp:165,atk:21,spd:0.9,spikes:true,pattern:'runes',special:'Slag Avalanche',
    forms:['Slagmaw','Slagmaw, Kiln Warden','Slagmaw, Heart of Slag'],
    look:'A hulking golem of cooled black slag with molten orange cracks, a furnace mouth that drips lava, jagged spikes of obsidian on its shoulders and small burning eyes.',
    evoLooks:['Bigger, with rivers of lava running down its arms and a smoking chimney growing from its back.','A towering slag colossus with a roaring furnace in its chest, a crown of obsidian spikes and a rain of embers around it.']},
  wrecktooth:{name:'Wrecktooth',el:'tide',rarity:'epic',bossOnly:true,body:'serpent',c1:'#123A55',c2:'#4FC3E0',eye:'#F0FCFF',hp:155,atk:23,spd:1.05,fins:true,tail:'fin',pattern:'stripes',special:'Shipbreaker',
    forms:['Wrecktooth','Wrecktooth, Reef Warden','Wrecktooth, Drowned King'],
    look:'A scarred sea serpent with dark navy scales, pale aqua stripes, a jaw full of jagged teeth, torn fins and broken ship planks tangled around its coils.',
    evoLooks:['Larger, with barnacle armor, an anchor chain wrapped around its neck and glowing scars.','A colossal drowned serpent wearing a crown of shipwreck timbers, with a whirlpool churning around its coils.']},
  blightroot:{name:'Blightroot',el:'thorn',rarity:'epic',bossOnly:true,body:'brute',c1:'#33421E',c2:'#9ACD32',eye:'#E6FF7A',hp:170,atk:20,spd:0.9,horns:2,spikes:true,pattern:'spots',special:'Rot Bloom',
    forms:['Blightroot','Blightroot, Thorn Warden','Blightroot, Rotting Crown'],
    look:'A hunched forest brute of twisted dark roots, with sickly lime fungus spots, two thorny branch horns, a spiked back and glowing yellow-green eyes.',
    evoLooks:['Bigger, with poison flowers blooming across its back and roots dragging behind it.','A towering blighted tree giant with a crown of dead branches, clouds of spores and glowing fungus everywhere.']},
  rimehowl:{name:'Rimehowl',el:'frost',rarity:'epic',bossOnly:true,body:'beast',c1:'#355F7E',c2:'#E6F8FF',eye:'#BFF3FF',hp:155,atk:22,spd:1.15,horns:2,tail:'spike',pattern:'stripes',special:'Whiteout Howl',
    forms:['Rimehowl','Rimehowl, Pass Warden','Rimehowl, Endless Winter'],
    look:'A great frost wolf with slate-blue fur striped in white, icicle horns, a tail ending in an ice spike and pale glowing eyes.',
    evoLooks:['Larger, with a mane of frost crystals and breath that freezes the air.','A giant blizzard wolf with an aurora trailing from its mane and a storm of snow around it.']},
  voltigon:{name:'Voltigon',el:'storm',rarity:'epic',bossOnly:true,body:'avian',c1:'#2E2462',c2:'#FFE14A',eye:'#FFFFFF',hp:145,atk:24,spd:1.2,crown:true,pattern:'stripes',special:'Skyfall',
    forms:['Voltigon','Voltigon, Spire Warden','Voltigon, Living Storm'],
    look:'A fierce storm raptor with indigo feathers, yellow lightning stripes, a crest that crackles with sparks and a hooked golden beak.',
    evoLooks:['Bigger, with wings like thunderclouds and lightning arcing between its feathers.','A colossal thunderbird with a crown of lightning and a storm cloud forming behind its wings.']},
  cragjaw:{name:'Cragjaw',el:'stone',rarity:'epic',bossOnly:true,body:'brute',c1:'#4E3F2E',c2:'#C9AE86',eye:'#FF9A3C',hp:180,atk:19,spd:0.85,horns:2,spikes:true,special:'Landslide',
    forms:['Cragjaw','Cragjaw, Quarry Warden','Cragjaw, Mountain-Eater'],
    look:'A heavy rock brute with a jaw like a boulder, cracked brown stone skin, two stubby stone horns, crystal spikes on its back and glowing orange eyes.',
    evoLooks:['Bigger, with crystal veins glowing through its body and rubble falling from its shoulders.','A cliff-sized brute with a mountain ridge along its spine and a molten-orange crystal core in its chest.']},
  tempestrix:{name:'Tempestrix',el:'gale',rarity:'epic',bossOnly:true,body:'drake',c1:'#245848',c2:'#D6FFF0',eye:'#FFFFFF',hp:150,atk:23,spd:1.2,horns:2,wings:'feather',tail:'leaf',special:'Eye of the Storm',
    forms:['Tempestrix','Tempestrix, Sky Warden','Tempestrix, Endless Gale'],
    look:'A sleek wind drake with sea-green scales, pale feathered wings, two swept-back horns and a tail that ends in a fan of feathers.',
    evoLooks:['Larger, with a ring of whirling wind around it and longer feathered wings.','A great storm drake with a cyclone forming beneath it and feathers whipping through the air.']},
  haloth:{name:'Haloth',el:'radiant',rarity:'epic',bossOnly:true,body:'wisp',c1:'#B8963A',c2:'#FFF8D6',eye:'#FFFFFF',hp:150,atk:23,spd:1.05,eyes:3,crown:true,pattern:'runes',special:'Blinding Verdict',
    forms:['Haloth','Haloth, Nave Warden','Haloth, Unblinking'],
    look:'A floating golden spirit with three solemn eyes, a halo of light above its head, glowing runes on its body and long trailing ribbons of light.',
    evoLooks:['Grows two more halos and shining wings of light; its gaze is harsher.','A blinding seraph of gold with rings of halos, six eyes and lances of light circling it.']},
  gloamreaver:{name:'Gloamreaver',el:'umbral',rarity:'epic',bossOnly:true,body:'wisp',c1:'#24163C',c2:'#A87BE8',eye:'#F2E6FF',hp:150,atk:24,spd:1.1,eyes:3,horns:2,special:'Lightless Harvest',
    forms:['Gloamreaver','Gloamreaver, Veil Warden','Gloamreaver, Night Unending'],
    look:'A hooded shadow wraith with a deep violet body, three pale glowing eyes, two curved horns and long clawed hands made of smoke.',
    evoLooks:['Larger, with a cloak of night stars and chains of shadow trailing behind it.','A towering reaper of the night with an eclipse halo behind its head and shadows reaching from it.']},
};
