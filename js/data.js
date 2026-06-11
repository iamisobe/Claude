// ============================================================
// GRIMVALE — data: types, moves, species (the Grimdex), items,
// crops, brews, fishing tables, rivals. All assets original.
// ============================================================
'use strict';

const TYPES = {
  NONE:   { n:'—',       col:'#9a93a8' },
  SPIRIT: { n:'SPIRIT',  col:'#9b6dff' },
  SHADOW: { n:'SHADOW',  col:'#5a4a7a' },
  BONE:   { n:'BONE',    col:'#d8d0b8' },
  FLORA:  { n:'FLORA',   col:'#6dd86d' },
  FUNGUS: { n:'FUNGUS',  col:'#c98ad8' },
  EMBER:  { n:'EMBER',   col:'#e8825d' },
  FROST:  { n:'FROST',   col:'#8ad8e8' },
  VENOM:  { n:'VENOM',   col:'#a8d84a' },
  DROWNED:{ n:'DROWNED', col:'#5d8ae8' },
  MOON:   { n:'MOON',    col:'#e8e08a' },
};

// attacker type -> defender type -> multiplier (default 1)
const TYPE_CHART = {
  EMBER:  { FLORA:2, FUNGUS:2, FROST:2, DROWNED:.5, EMBER:.5 },
  DROWNED:{ EMBER:2, BONE:2, FLORA:.5, DROWNED:.5 },
  FLORA:  { DROWNED:2, BONE:.5, EMBER:.5, FLORA:.5, FUNGUS:.5 },
  FUNGUS: { FLORA:2, DROWNED:2, EMBER:.5, FROST:.5, FUNGUS:.5 },
  FROST:  { FLORA:2, VENOM:2, EMBER:.5, FROST:.5 },
  VENOM:  { FLORA:2, MOON:2, BONE:.5, FUNGUS:.5, VENOM:.5 },
  BONE:   { FROST:2, VENOM:2, SPIRIT:.5, DROWNED:.5 },
  SPIRIT: { SPIRIT:2, SHADOW:2, BONE:.5 },
  SHADOW: { SPIRIT:2, MOON:2, SHADOW:.5, BONE:.5 },
  MOON:   { SHADOW:2, VENOM:2, MOON:.5, EMBER:.5 },
};
function typeMult(att, defTypes){
  let m = 1;
  for (const d of defTypes) m *= (TYPE_CHART[att] && TYPE_CHART[att][d]) ?? 1;
  return m;
}

// c: 'p' physical (atk/def), 's' special (spc/spc), 'x' status
const MOVES = {
  bash:       { n:'Bash',         t:'NONE',   c:'p', p:40, a:100, pp:35 },
  maul:       { n:'Maul',         t:'NONE',   c:'p', p:70, a:100, pp:20 },
  crush:      { n:'Crush',        t:'NONE',   c:'p', p:95, a:85,  pp:10 },
  spook:      { n:'Spook',        t:'SPIRIT', c:'s', p:40, a:100, pp:30 },
  wail:       { n:'Wail',         t:'SPIRIT', c:'s', p:65, a:100, pp:20 },
  soulburst:  { n:'Soulburst',    t:'SPIRIT', c:'s', p:95, a:90,  pp:10 },
  drainspirit:{ n:'Drain Spirit', t:'SPIRIT', c:'s', p:50, a:100, pp:15, fx:{drain:.5} },
  shadowclaw: { n:'Shadow Claw',  t:'SHADOW', c:'p', p:55, a:100, pp:25 },
  nightrend:  { n:'Night Rend',   t:'SHADOW', c:'p', p:80, a:95,  pp:15 },
  umbra:      { n:'Umbra',        t:'SHADOW', c:'s', p:70, a:100, pp:15 },
  darkrage:   { n:'Dark Rage',    t:'SHADOW', c:'x', a:100, pp:15, fx:{stat:'atk', delta:1, self:true} },
  boneclub:   { n:'Bone Club',    t:'BONE',   c:'p', p:50, a:100, pp:25 },
  femurstorm: { n:'Femur Storm',  t:'BONE',   c:'p', p:85, a:90,  pp:10 },
  calcify:    { n:'Calcify',      t:'BONE',   c:'x', a:100, pp:20, fx:{stat:'def', delta:1, self:true} },
  vinewhip:   { n:'Vine Whip',    t:'FLORA',  c:'p', p:45, a:100, pp:30 },
  thornlash:  { n:'Thorn Lash',   t:'FLORA',  c:'p', p:70, a:95,  pp:15 },
  leech:      { n:'Leech',        t:'FLORA',  c:'s', p:45, a:100, pp:20, fx:{drain:.5} },
  bloomburst: { n:'Bloomburst',   t:'FLORA',  c:'s', p:90, a:85,  pp:10 },
  sporeshot:  { n:'Spore Shot',   t:'FUNGUS', c:'s', p:40, a:100, pp:30, fx:{status:'psn', chance:20} },
  mycoblast:  { n:'Myco Blast',   t:'FUNGUS', c:'s', p:80, a:90,  pp:10 },
  sleepspore: { n:'Sleep Spore',  t:'FUNGUS', c:'x', a:70,  pp:15, fx:{status:'slp', chance:100} },
  emberflick: { n:'Ember Flick',  t:'EMBER',  c:'s', p:40, a:100, pp:30, fx:{status:'brn', chance:10} },
  scorch:     { n:'Scorch',       t:'EMBER',  c:'s', p:70, a:95,  pp:15, fx:{status:'brn', chance:20} },
  hellfire:   { n:'Hellfire',     t:'EMBER',  c:'s', p:95, a:85,  pp:10, fx:{status:'brn', chance:30} },
  frostbite:  { n:'Frostbite',    t:'FROST',  c:'p', p:50, a:100, pp:25, fx:{stat:'spd', delta:-1, chance:20} },
  icelance:   { n:'Ice Lance',    t:'FROST',  c:'p', p:75, a:95,  pp:15 },
  chill:      { n:'Chill',        t:'FROST',  c:'x', a:100, pp:20, fx:{stat:'spd', delta:-1} },
  venomfang:  { n:'Venom Fang',   t:'VENOM',  c:'p', p:50, a:100, pp:25, fx:{status:'psn', chance:30} },
  toxinspray: { n:'Toxin Spray',  t:'VENOM',  c:'s', p:70, a:95,  pp:15, fx:{status:'psn', chance:30} },
  poisoncloud:{ n:'Poison Cloud', t:'VENOM',  c:'x', a:90,  pp:15, fx:{status:'psn', chance:100} },
  drown:      { n:'Drown',        t:'DROWNED',c:'s', p:45, a:100, pp:30 },
  tidalgrip:  { n:'Tidal Grip',   t:'DROWNED',c:'p', p:70, a:100, pp:15 },
  abysswave:  { n:'Abyss Wave',   t:'DROWNED',c:'s', p:95, a:85,  pp:10 },
  moonbeam:   { n:'Moonbeam',     t:'MOON',   c:'s', p:65, a:100, pp:20 },
  lunarflare: { n:'Lunar Flare',  t:'MOON',   c:'s', p:90, a:85,  pp:10 },
  moonlight:  { n:'Moonlight',    t:'MOON',   c:'x', a:100, pp:10, fx:{heal:.5} },
};

// ---------- THE GRIMDEX (32 species, all original pixel art) ----------
// base:[hp,atk,def,spd,spc]  catch: higher = easier (out of 255)
// art: 16 rows; sym:true rows are 8 wide and mirrored. '.' = transparent.
const DEX = {

sproutling: { n:'Sproutling', ty:['FLORA'], base:[45,49,49,45,60], catch:120, xp:62,
  ev:{lvl:16,to:'thornwraith'}, src:'starter',
  mv:[[1,'bash'],[1,'vinewhip'],[7,'leech'],[13,'spook'],[19,'thornlash'],[27,'bloomburst']],
  desc:'A seedling possessed by a gentle ghost. It wilts if no one talks to it.',
  sym:true, pal:{o:'#1c3018',g:'#6dd86d',d:'#3da33d',s:'#8a5a3a',e:'#17131f',h:'#a8f0a8'},
  art:[
  '........','...oo...','..ogdo..','..ogdo..','...oo...','..oooo..','.oggggo.','oghgggg.',
  'oggeggg.','oggggggo','.oggggo.','..osso..','..osso..','.osssso.','.os..os.','..o..o..']},

thornwraith: { n:'Thornwraith', ty:['FLORA','SHADOW'], base:[70,85,70,70,95], catch:45, xp:160,
  src:'evolve',
  mv:[[1,'vinewhip'],[1,'shadowclaw'],[7,'leech'],[13,'spook'],[19,'thornlash'],[27,'bloomburst'],[34,'nightrend']],
  desc:'Its hollow trunk hides a tangle of vengeful brambles and one stolen soul.',
  sym:true, pal:{o:'#101c0e',g:'#3da33d',d:'#1f5c1f',s:'#5a4a7a',e:'#e8c95d',h:'#6dd86d'},
  art:[
  '.o...o..','.od.od..','..odo...','..ogo...','.oggggo.','ogggggg.','oggeggg.','ogggggg.',
  '.oggggoo','.osgsgo.','.osssso.','..ossoo.','..osso..','.ossso..','.os.oso.','.oo..oo.']},

cindling: { n:'Cindling', ty:['EMBER'], base:[44,58,40,55,55], catch:120, xp:62,
  ev:{lvl:16,to:'pyrelich'}, src:'starter',
  mv:[[1,'bash'],[1,'emberflick'],[7,'spook'],[13,'scorch'],[19,'maul'],[27,'hellfire']],
  desc:'A candle-imp that burns the memories of the dead for warmth.',
  sym:true, pal:{o:'#2e1208',f:'#e8825d',y:'#f0c84a',w:'#f8ecd0',e:'#17131f',d:'#b8502e'},
  art:[
  '...y....','...fy...','..yfy...','..ofo...','.owwwo..','owwwwwo.','owewwwo.','owwwwwo.',
  'owwwwwo.','.owwwo..','.odddo..','.odddo..','odddddo.','od.ddo..','o..od...','....o...']},

pyrelich: { n:'Pyrelich', ty:['EMBER','BONE'], base:[65,95,65,85,80], catch:45, xp:160,
  src:'evolve',
  mv:[[1,'emberflick'],[1,'boneclub'],[7,'spook'],[13,'scorch'],[19,'femurstorm'],[27,'hellfire'],[34,'crush']],
  desc:'A skeletal king crowned in flame. Its bones never stop smouldering.',
  sym:true, pal:{o:'#2e1208',f:'#e8825d',y:'#f0c84a',b:'#d8d0b8',e:'#e8442e',d:'#8a8268'},
  art:[
  '.f..y...','.yf.fy..','..yfy...','.obbbo..','obbbbbo.','obebbeo.','obbbbbo.','.obdbo..',
  '..obo...','.obbbbo.','obbobbo.','obbobbo.','.obbbo..','..obo...','.obobo..','.oo.oo..']},

dripp: { n:'Dripp', ty:['DROWNED'], base:[50,48,55,42,58], catch:120, xp:62,
  ev:{lvl:16,to:'mireghast'}, src:'starter',
  mv:[[1,'bash'],[1,'drown'],[7,'spook'],[13,'tidalgrip'],[19,'wail'],[27,'abysswave']],
  desc:'A sad droplet that crawled out of a well. It cries constantly, gaining mass.',
  sym:true, pal:{o:'#101c30',w:'#5d8ae8',l:'#8ab8f0',e:'#17131f',d:'#3a5aa8'},
  art:[
  '...o....','...ow...','..owwo..','..owwo..','.owwwwo.','.owlwwo.','owllwwwo','owlewwwo',
  'owwwwwwo','owwwwwwo','owwwwddo','.owwddo.','.owwddo.','..owdo..','...oo...','........']},

mireghast: { n:'Mireghast', ty:['DROWNED','SPIRIT'], base:[80,70,85,55,90], catch:45, xp:160,
  src:'evolve',
  mv:[[1,'drown'],[1,'spook'],[7,'drainspirit'],[13,'tidalgrip'],[19,'wail'],[27,'abysswave'],[34,'soulburst']],
  desc:'A drowned spirit of the marsh. Lanterns sink where it passes.',
  sym:true, pal:{o:'#101c30',w:'#3a5aa8',l:'#5d8ae8',e:'#8af0e8',g:'#2e8a6d',d:'#1f3a78'},
  art:[
  '..oo....','.owwoo..','owwwwwo.','owlwwwo.','owewwwoo','owwwwwwo','olwwwwwo','owwwwgwo',
  'owwgwwwo','.owwwwwo','.owwwwd.','..owwdo.','.owwwo..','.owdo...','..oo.o..','...o....']},

wispy: { n:'Wispy', ty:['SPIRIT'], base:[38,30,32,68,60], catch:190, xp:48,
  ev:{lvl:20,to:'banshriek'}, src:'wild',
  mv:[[1,'spook'],[5,'bash'],[11,'drainspirit'],[17,'wail'],[25,'soulburst']],
  desc:'The first thing most necromancers ever catch. Friendly, if a bit clingy.',
  sym:true, pal:{o:'#3a3050',w:'#cdc4e8',l:'#ffffff',e:'#17131f'},
  art:[
  '........','...ooo..','..owwwo.','.owlwwo.','.owewwwo','.owwwwwo','owwwwwwo','owwwwwwo',
  'owwwwwwo','.owwwwo.','.owwwo..','..owwo..','...owo..','..ow.o..','...o....','........']},

banshriek: { n:'Banshriek', ty:['SPIRIT'], base:[55,50,48,105,95], catch:75, xp:125,
  src:'evolve',
  mv:[[1,'spook'],[1,'wail'],[11,'drainspirit'],[17,'umbra'],[25,'soulburst']],
  desc:'Its scream curdles candle wax. Hold your ears and your soul.',
  sym:true, pal:{o:'#3a3050',w:'#cdc4e8',l:'#ffffff',e:'#9b6dff',m:'#17131f'},
  art:[
  '.o...oo.','.ow.owo.','..owwwo.','.owwwwo.','owlwwwwo','oweowewo','owwwwwwo','owwmmwwo',
  'owwmmwwo','owwwwwwo','.owwwwo.','.owwwo..','..owwo..','.ow.owo.','..o..o..','........']},

skulpup: { n:'Skulpup', ty:['BONE'], base:[50,62,48,50,30], catch:150, xp:60,
  ev:{lvl:22,to:'gravehound'}, src:'wild',
  mv:[[1,'bash'],[1,'boneclub'],[8,'calcify'],[14,'maul'],[21,'femurstorm']],
  desc:'A loyal skeleton of a pup that refused to stop playing fetch.',
  sym:true, pal:{o:'#3a3424',b:'#d8d0b8',d:'#a89e80',e:'#e8442e'},
  art:[
  '.oo.....','.obo.oo.','.obooboo','.obbbbbo','obbbbbbo','obebbbeo','obbbbbbo','.obbddo.',
  '..oddo..','.obbbbo.','obobbobo','obobbobo','.obbbbo.','.ob..bo.','.ob..bo.','.oo..oo.']},

gravehound: { n:'Gravehound', ty:['BONE','SHADOW'], base:[75,95,70,76,50], catch:60, xp:150,
  src:'evolve',
  mv:[[1,'boneclub'],[1,'shadowclaw'],[8,'calcify'],[14,'maul'],[21,'femurstorm'],[30,'nightrend']],
  desc:'It guards graves it dug itself. Do not ask what is buried there.',
  sym:true, pal:{o:'#241e30',b:'#d8d0b8',d:'#8a8268',e:'#9b6dff',s:'#3a3050'},
  art:[
  'oo......','obo..oo.','oboooboo','obbbbbbo','obebbbeo','obbbbbbo','.obbddoo','..osso..',
  '.osssso.','osbsbsso','osbsbsso','osssssso','.osssso.','.ob..bo.','.ob..bo.','.oo..oo.']},

shroomb: { n:'Shroomb', ty:['FUNGUS'], base:[60,40,55,25,55], catch:160, xp:57,
  ev:{lvl:24,to:'mycolossus'}, src:'wild',
  mv:[[1,'bash'],[1,'sporeshot'],[9,'sleepspore'],[15,'leech'],[23,'mycoblast']],
  desc:'It naps under graves and dreams the dreams of whoever lies below.',
  sym:true, pal:{o:'#3a1f40',c:'#c98ad8',s:'#f0e0f8',b:'#e8e0d0',e:'#17131f',d:'#a85ac0'},
  art:[
  '........','..oooo..','.occcco.','occsccco','ocscccso','occccddo','occccddo','.oooooo.',
  '..obbo..','..obbo..','.obbbbo.','.obebbo.','.obbbbo.','..obbo..','..o..o..','........']},

mycolossus: { n:'Mycolossus', ty:['FUNGUS'], base:[95,75,90,30,80], catch:55, xp:165,
  src:'evolve',
  mv:[[1,'sporeshot'],[1,'maul'],[9,'sleepspore'],[15,'leech'],[23,'mycoblast'],[32,'crush']],
  desc:'A walking burial mound. Whole graveyards have gone missing under its cap.',
  sym:true, pal:{o:'#3a1f40',c:'#a85ac0',s:'#f0e0f8',b:'#d8c8b0',e:'#e8c95d',d:'#7a3a90'},
  art:[
  '..oooo..','.occcco.','occsccco','ocsccdso','occcdddo','ccccdddo','.oooooo.','.obbbbo.',
  'obbbbbbo','obebbbbo','obbbbbbo','obbbbbbo','.obbbbo.','.obbobo.','.obo.bo.','.oo..oo.']},

flitbat: { n:'Flitbat', ty:['SHADOW'], base:[40,45,35,72,40], catch:170, xp:52,
  ev:{lvl:21,to:'nocturnyx'}, src:'wild',
  mv:[[1,'bash'],[1,'shadowclaw'],[8,'spook'],[15,'umbra'],[22,'nightrend']],
  desc:'Too lazy to fly straight, it tumbles through the air like a dropped glove.',
  sym:true, pal:{o:'#1a1426',s:'#5a4a7a',l:'#8a78b0',e:'#e8c95d',w:'#3a3050'},
  art:[
  '........','o.......','oo......','owo..oo.','owwo.oso','owwoosso','owwossso','.owsssso',
  '.owsesso','..owssso','..osssso','...osso.','...oso..','...ovo..','....o...','........']},

nocturnyx: { n:'Nocturnyx', ty:['SHADOW','MOON'], base:[60,70,55,110,70], catch:60, xp:145,
  src:'evolve',
  mv:[[1,'shadowclaw'],[1,'moonbeam'],[8,'spook'],[15,'umbra'],[22,'nightrend'],[30,'lunarflare']],
  desc:'A great horned bat that drinks moonlight. Eclipses follow it home.',
  sym:true, pal:{o:'#1a1426',s:'#3a3050',l:'#5a4a7a',e:'#e8e08a',w:'#241e38',m:'#e8e08a'},
  art:[
  'o....o..','oo..om..','owo.omo.','owwoosso','owwwosso','owwossso','owwsssso','.owsesso',
  '.owssss.','..ossss.','..osssso','..ossso.','...osso.','...oso..','...oo...','....o...']},

vipervine: { n:'Vipervine', ty:['VENOM','FLORA'], base:[55,70,45,65,55], catch:110, xp:88,
  src:'wild',
  mv:[[1,'vinewhip'],[1,'venomfang'],[9,'poisoncloud'],[16,'thornlash'],[24,'toxinspray']],
  desc:'A creeper vine with a grudge and fangs full of nettle venom.',
  pal:{o:'#1c3018',g:'#a8d84a',d:'#6d9a2e',e:'#e8442e',f:'#f8ecd0'},
  art:[
  '................','....oooo........','...oggggo.......','..oggggggo......',
  '..ogeggego......','..oggggggo......','..offggffo......','...ogggggo......',
  '....oddggo......','......oggo......','..oo..oggo......','.oggo.oggo......',
  '.oggooggo.......','..oggggo........','...oggo.........','....oo..........']},

frostfae: { n:'Frostfae', ty:['FROST','SPIRIT'], base:[45,40,45,75,85], catch:120, xp:80,
  src:'wild',
  mv:[[1,'spook'],[1,'frostbite'],[9,'chill'],[16,'icelance'],[24,'wail']],
  desc:'The ghost of winter\'s first frost. It etches names on windows at night.',
  sym:true, pal:{o:'#2e4a5a',w:'#c8ecf8',l:'#ffffff',e:'#3a5aa8',i:'#8ad8e8'},
  art:[
  '...i....','..oio...','..owo...','.owwwo..','owwlwwo.','owewwwo.','owwwwwo.','.owwwo..',
  'i.owwo.i','oiowwoio','.owwwwo.','.owiwio.','..owwo..','..oiio..','...o.o..','........']},

mothmare: { n:'Mothmare', ty:['MOON'], base:[60,50,50,65,90], catch:100, xp:95,
  src:'wild',
  mv:[[1,'spook'],[1,'moonbeam'],[10,'sleepspore'],[18,'moonlight'],[26,'lunarflare']],
  desc:'Its wing-dust causes vivid dreams of lives you never lived.',
  sym:true, pal:{o:'#3a3424',w:'#e8e08a',l:'#f8f4c8',e:'#9b6dff',b:'#8a7a4a',m:'#c9b86d'},
  art:[
  'o......o','oo....oo','owo..owo','owwooww.','owlwwlw.','owwmmww.','owmbbmw.','.ombbmo.',
  '.obeebo.','.obbbbo.','owmbbmwo','owwmmwwo','oww..wwo','ow....wo','o......o','........']},

gloomkin: { n:'Gloomkin', ty:['SHADOW','VENOM'], base:[52,66,50,60,48], catch:120, xp:84,
  src:'wild', night:true,
  mv:[[1,'shadowclaw'],[1,'venomfang'],[10,'darkrage'],[17,'umbra'],[25,'toxinspray']],
  desc:'A spiteful imp that bottles nightmares and sells them back to you.',
  sym:true, pal:{o:'#141020',s:'#3a3050',l:'#5a4a7a',e:'#a8d84a',h:'#6d5a96'},
  art:[
  'o.....o.','oo...oo.','oso.oso.','.osooso.','.osssso.','ossssss.','osessse.','ossssss.',
  '.ossss..','.osssso.','..osso..','.ossss..','.os.sso.','.os..so.','.oo..oo.','........']},

pumpkid: { n:'Pumpkid', ty:['FLORA','SHADOW'], base:[55,55,60,30,50], catch:140, xp:70,
  ev:{lvl:18,to:'jackrot'}, src:'farm',
  mv:[[1,'bash'],[1,'vinewhip'],[8,'spook'],[14,'leech'],[20,'shadowclaw'],[26,'bloomburst']],
  desc:'Grown from a monster seed. It grins because it knows where it was planted.',
  sym:true, pal:{o:'#3a1c08',p:'#e8823a',d:'#b85a1f',g:'#3da33d',e:'#f0c84a'},
  art:[
  '...og...','...go...','..oppo..','.oppppo.','oppdppdo','opeppep.','oppppppo','opdppdp.',
  'oppeeppo','opppppp.','.oppppo.','..oooo..','........','........','........','........']},

jackrot: { n:'Jackrot', ty:['FLORA','SHADOW'], base:[85,90,85,40,75], catch:50, xp:155,
  src:'evolve',
  mv:[[1,'vinewhip'],[1,'shadowclaw'],[8,'spook'],[14,'leech'],[20,'nightrend'],[26,'bloomburst']],
  desc:'A scarecrow that harvested itself. Crows work for it now.',
  sym:true, pal:{o:'#3a1c08',p:'#e8823a',d:'#b85a1f',g:'#3da33d',e:'#f0c84a',s:'#8a5a3a'},
  art:[
  '...og...','..oppo..','.oppppo.','opedpep.','oppppppo','opdeedp.','.oppppo.','..osso..',
  'oossssoo','ogosssog','..ossso.','..osso..','.osssso.','.os..so.','.os..so.','.oo..oo.']},

mandragora: { n:'Mandragora', ty:['FLORA'], base:[60,75,60,40,55], catch:100, xp:110,
  src:'farm',
  mv:[[1,'vinewhip'],[1,'wail'],[10,'leech'],[16,'thornlash'],[24,'bloomburst'],[30,'crush']],
  desc:'Pulled screaming from your own garden. It still holds that against you.',
  sym:true, pal:{o:'#2e1f10',r:'#c9a86d',d:'#a8824a',g:'#6dd86d',e:'#17131f'},
  art:[
  '..g..g..','..og.go.','...ogo..','..orrro.','.orrrrro','orrerro.','orrrrrro','orrerro.',
  '.orrrro.','.ordrro.','..orro..','.ordrro.','.or..ro.','ordo.rdo','.o....o.','........']},

murkoi: { n:'Murkoi', ty:['DROWNED'], base:[42,40,38,60,45], catch:190, xp:45,
  src:'fish',
  mv:[[1,'drown'],[6,'bash'],[12,'tidalgrip'],[20,'abysswave']],
  desc:'A pale koi that swims in flooded crypts. Bad luck to eat; worse to ignore.',
  pal:{o:'#1c2a40',w:'#9ab8d8',l:'#cde4f8',e:'#17131f',f:'#5d8ae8'},
  art:[
  '................','................','....oooo........','..oowwwwoo..o...',
  '.owwwwwwwwoofo..','owewwwwwwwwoffo.','owwwwwwlwwwwff..','.owwwwwwwwoffo..',
  '..oowwwwoo..o...','....oooo........','................','................',
  '................','................','................','................']},

boneel: { n:'Boneel', ty:['BONE','DROWNED'], base:[58,72,50,68,40], catch:120, xp:90,
  src:'fish',
  mv:[[1,'bash'],[1,'boneclub'],[10,'tidalgrip'],[18,'calcify'],[26,'femurstorm']],
  desc:'An eel that wears the spine of a larger eel. Ambition, of a sort.',
  pal:{o:'#2a2a30',b:'#d8d0b8',d:'#a89e80',e:'#e8442e',w:'#5d8ae8'},
  art:[
  '................','..oo............','.obbo...........','.obeo.ooo.......',
  '.obbo.obbo..oo..','.obbooobboo.obo.','..obbbobbbboobo.','...oobbbobbbbo..',
  '.....oo..oobbo..','...........obo..','...........oo...','................',
  '................','................','................','................']},

phantfin: { n:'Phantfin', ty:['SPIRIT','DROWNED'], base:[50,45,55,70,75], catch:130, xp:85,
  src:'fish', night:true,
  mv:[[1,'spook'],[1,'drown'],[10,'drainspirit'],[18,'wail'],[26,'abysswave']],
  desc:'The ghost of a fish that was never caught. It haunts anglers out of spite.',
  pal:{o:'#3a3050',w:'#cdc4e8',l:'#ffffff',e:'#8af0e8',f:'#9b6dff'},
  art:[
  '................','......o.o......','....oowowoo.....','...owwwwwwwoo...',
  '..owewwwwwwwwoo.','.owwwwwlwwwwwff.','..owwwwwwwwwoo..','...owwwwwwwoo...',
  '....oow.owo.....','......o..o......','................','................',
  '................','................','................','................']},

lanternjaw: { n:'Lanternjaw', ty:['EMBER','DROWNED'], base:[65,80,55,45,70], catch:80, xp:120,
  src:'fish', moon:'new',
  mv:[[1,'emberflick'],[1,'bash'],[12,'scorch'],[20,'tidalgrip'],[28,'hellfire']],
  desc:'It lures the drowned with a flame that burns underwater. Caught only on new moons.',
  pal:{o:'#1c1424',w:'#3a5aa8',d:'#28407a',e:'#f0c84a',t:'#f8ecd0',f:'#e8825d'},
  art:[
  '......f.........','.....of.........','....oo..........','...oooooooo.....',
  '..owwwwwwwwoo.o.','.owewwwwwwwwoofo','.owwttttwwwwwoff','..owtwwwwwwoofo.',
  '...oooowwwoo..o.','.......ooo......','................','................',
  '................','................','................','................']},

moonscale: { n:'Moonscale', ty:['MOON','DROWNED'], base:[70,60,70,90,110], catch:25, xp:220,
  src:'fish', moon:'full', rare:true,
  mv:[[1,'moonbeam'],[1,'drown'],[14,'moonlight'],[22,'abysswave'],[30,'lunarflare']],
  desc:'A legendary fish of living moonlight. Surfaces only when the moon is full.',
  pal:{o:'#4a4a2e',w:'#e8e08a',l:'#f8f4c8',e:'#9b6dff',f:'#cdc46d'},
  art:[
  '................','....o..o........','...olwwlo.......','..oowwwwoo..o...',
  '.owwlwwwlwwoofo.','owewwwwwwwwwoffo','owwwlwwlwwwwoff.','.owwwwwwwwwoofo.',
  '..oowwwwoo..o...','...olwwlo.......','....o..o........','................',
  '................','................','................','................']},

cryptmite: { n:'Cryptmite', ty:['BONE'], base:[40,55,60,40,30], catch:160, xp:55,
  ev:{lvl:30,to:'cryptlord'}, src:'cata',
  mv:[[1,'bash'],[1,'boneclub'],[10,'calcify'],[18,'maul'],[28,'femurstorm']],
  desc:'A beetle that builds its shell from coffin nails and knuckle bones.',
  sym:true, pal:{o:'#2a2418',b:'#d8d0b8',d:'#8a8268',e:'#e8442e',m:'#5a5240'},
  art:[
  '........','.o....o.','.ob..bo.','..o..o..','..oooo..','.obbbbo.','obdbbdbo','obbeebbo',
  'obbbbbbo','obdbbdbo','.obbbbo.','..oooo..','.ob..bo.','.o....o.','........','........']},

cryptlord: { n:'Cryptlord', ty:['BONE','SHADOW'], base:[80,105,95,55,70], catch:35, xp:200,
  src:'evolve',
  mv:[[1,'boneclub'],[1,'nightrend'],[10,'calcify'],[18,'maul'],[28,'femurstorm'],[36,'crush']],
  desc:'It rules a kingdom of dust beneath the graveyard. Its crown fits perfectly.',
  sym:true, pal:{o:'#1c1810',b:'#d8d0b8',d:'#8a8268',e:'#9b6dff',m:'#3a3050',y:'#e8c95d'},
  art:[
  '.y..y...','.oyyo...','.obbbo..','obbbbbo.','obebbeo.','obbbbbo.','.obddbo.','.ommmoo.',
  'ommmmmo.','ombmbmoo','ommmmmmo','ombmbmo.','.ommmmo.','.ob..bo.','.obo.bo.','.oo..oo.']},

hollowshade: { n:'Hollowshade', ty:['SHADOW'], base:[48,60,40,80,60], catch:140, xp:75,
  src:'cata',
  mv:[[1,'shadowclaw'],[1,'spook'],[12,'darkrage'],[20,'umbra'],[28,'nightrend']],
  desc:'A shadow whose owner died. It auditions new owners in the dark.',
  sym:true, pal:{o:'#0e0a16',s:'#241e38',l:'#3a3050',e:'#e8e0d0'},
  art:[
  '........','..oooo..','.osssso.','ossssss.','osesseso','ossssss.','osssssso','osssssso',
  '.osssss.','.osssso.','..sssss.','.os.sso.','.s..ss..','.s...s..','........','........']},

emberghast: { n:'Emberghast', ty:['EMBER','SPIRIT'], base:[55,65,45,70,85], catch:110, xp:100,
  src:'cata',
  mv:[[1,'emberflick'],[1,'spook'],[12,'scorch'],[20,'drainspirit'],[28,'hellfire']],
  desc:'The last warmth of a snuffed funeral pyre, still looking for its mourners.',
  sym:true, pal:{o:'#3a160a',f:'#e8825d',y:'#f0c84a',w:'#f8d8b0',e:'#17131f'},
  art:[
  '.y..y...','.f.yf...','..yfy...','..ofo...','.owwwo..','owwwwwo.','owewweo.','owwwwwo.',
  'owwwwwwo','.owwwwo.','.owwwo..','..owwwo.','..oww.o.','.ow.w...','..o.....','........']},

rotwalker: { n:'Rotwalker', ty:['FUNGUS','BONE'], base:[70,80,75,25,45], catch:100, xp:115,
  src:'cata',
  mv:[[1,'boneclub'],[1,'sporeshot'],[12,'sleepspore'],[20,'maul'],[28,'mycoblast'],[34,'crush']],
  desc:'A skeleton kept walking by the mushrooms that grew in its joints.',
  sym:true, pal:{o:'#2a2418',b:'#c8c0a8',c:'#c98ad8',e:'#a8d84a',d:'#8a8268'},
  art:[
  '..occo..','..occo..','.obbbbo.','obebbeo.','obbbbbo.','.obdbo..','..obo...','.occco..',
  'obbbbbo.','obobbobo','ocobboco','obbbbbo.','.obbbo..','.ob.bo..','.ob.bo..','.oo.oo..']},

hollowking: { n:'Hollow King', ty:['SPIRIT','BONE'], base:[95,100,90,70,110], catch:10, xp:280,
  src:'boss', rare:true,
  mv:[[1,'soulburst'],[1,'femurstorm'],[1,'moonlight'],[1,'nightrend'],[40,'crush']],
  desc:'The sovereign of the catacombs. Every grave in Grimvale is a room of its palace.',
  sym:true, pal:{o:'#1c1424',b:'#e8e0d0',d:'#a89e80',e:'#8af0e8',m:'#3a3050',y:'#e8c95d',p:'#9b6dff'},
  art:[
  'y.y..y..','oyyoyyo.','obbbbbo.','obebbeo.','obbbbbo.','.obdbo..','opmmmpo.','ommmmmo.',
  'ombmbmoo','ommmmmmo','ombmbmop','ommmmmo.','opmmmpo.','.ommmo..','..o.o...','..o..o..']},
};

// ---------- ITEMS ----------
const ITEMS = {
  tonic:     { n:'Grave Tonic',  k:'heal', amt:30,   price:120,  d:'Restores 30 HP.' },
  bigtonic:  { n:'Crypt Tonic',  k:'heal', amt:80,   price:350,  d:'Restores 80 HP.' },
  fulltonic: { n:'Elixir of Dusk', k:'heal', amt:9999, price:900, d:'Fully restores HP.' },
  revive:    { n:'Second Breath', k:'revive', price:800, d:'Revives a fainted grim to half HP.' },
  cleanse:   { n:'Cleansing Salt', k:'cure', price:150, d:'Cures poison, burn and sleep.' },
  jar:       { n:'Soul Jar',     k:'jar', mult:1,   price:150,  d:'Captures a weakened wild grim.' },
  gjar:      { n:'Greater Jar',  k:'jar', mult:1.5, price:400,  d:'A finer vessel. Better capture odds.' },
  ajar:      { n:'Ancient Jar',  k:'jar', mult:2.2, price:1100, d:'Pre-Calamity make. Excellent odds.' },
  graverune: { n:'Grave Rune',   k:'charm', price:300, d:'Returns you from the catacombs.' },
  bloodberry:{ n:'Bloodberry',   k:'heal', amt:15, price:30, d:'A tart crop. Restores 15 HP.' },
  gravefruit:{ n:'Gravefruit',   k:'heal', amt:40, price:70, d:'Sweet and ominous. Restores 40 HP.' },
  moonwheat: { n:'Moonwheat',    k:'mat', price:90, d:'Silver grain that ripens at night. For brewing.' },
  seed_blood:   { n:'Bloodberry Seed', k:'seed', crop:'bloodberry', price:60,  d:'Grows bloodberries. (fast)' },
  seed_grave:   { n:'Gravefruit Seed', k:'seed', crop:'gravefruit', price:140, d:'Grows gravefruit. (medium)' },
  seed_moon:    { n:'Moonwheat Seed',  k:'seed', crop:'moonwheat',  price:260, d:'Grows moonwheat. (slow)' },
  seed_pumpkid: { n:'Monster Seed: P', k:'seed', crop:'pumpkid',    price:900, d:'Something grins inside this seed.' },
  seed_mandrake:{ n:'Monster Seed: M', k:'seed', crop:'mandragora', price:1400,d:'It hums when watered.' },
  seed_mystery: { n:'Mystery Seed',    k:'seed', crop:'mystery',    price:2500,d:'Nobody knows. That is the point.' },
  worm:     { n:'Grub Bait',  k:'bait', tier:1, price:20,  d:'Basic bait for cursed waters.' },
  glowbait: { n:'Glow Bait',  k:'bait', tier:2, price:80,  d:'Attracts stranger fish.' },
  voidbait: { n:'Void Bait',  k:'bait', tier:3, price:250, d:'Smells like the space between stars.' },
  oldrod:   { n:'Old Rod',    k:'rod', tier:1, price:0,    d:'A mossy rod. Catches common drowned things.' },
  bonerod:  { n:'Bone Rod',   k:'rod', tier:2, price:1500, d:'Carved from a Boneel spine. Finer catches.' },
  abyssrod: { n:'Abyss Rod',  k:'rod', tier:3, price:5000, d:'Its line dips into somewhere else.' },
  plank: { n:'Old Plank',  k:'mat', price:50,  d:'Salvaged manor timber.' },
  stone: { n:'Crypt Stone',k:'mat', price:80,  d:'A solid block of grave-granite.' },
  ecto:  { n:'Ectoplasm',  k:'mat', price:200, d:'Wobbles. Essential for haunted renovation.' },
  f_chair:   { n:'Wraith Chair',   k:'furn', spr:'fchair',  price:200,  d:'It rocks itself.' },
  f_table:   { n:'Seance Table',   k:'furn', spr:'ftable',  price:350,  d:'Knocks twice for yes.' },
  f_rug:     { n:'Howling Rug',    k:'furn', spr:'frug',    price:300,  d:'Woven from wolf sighs.' },
  f_candle:  { n:'Candelabrum',    k:'furn', spr:'fcandle', price:250,  d:'The flames lean toward liars.' },
  f_shelf:   { n:'Tome Shelf',     k:'furn', spr:'fshelf',  price:500,  d:'The books reshelve themselves.' },
  f_mirror:  { n:'Umbral Mirror',  k:'furn', spr:'fmirror', price:650,  d:'Your reflection waves first.' },
  f_clock:   { n:'Dead Clock',     k:'furn', spr:'fclock',  price:550,  d:'Strikes thirteen, but politely.' },
  f_gargoyle:{ n:'Pet Gargoyle',   k:'furn', spr:'fgarg',   price:900,  d:'Statue. Probably.' },
  f_throne:  { n:'Bone Throne',    k:'furn', spr:'fthrone', price:2000, d:'For the necromancer who has everything.' },
  f_banner:  { n:'Grim Banner',    k:'furn', spr:'fbanner', price:400,  d:'Your house sigil: a polite skull.' },
  f_plant:   { n:'Strangle Fern',  k:'furn', spr:'fplant',  price:180,  d:'Feed it weekly or it sulks.' },
};

// ---------- CROPS (time in game-minutes for full growth) ----------
const CROPS = {
  bloodberry: { n:'Bloodberry', time:240,  item:'bloodberry', qty:[2,4] },
  gravefruit: { n:'Gravefruit', time:480,  item:'gravefruit', qty:[1,3] },
  moonwheat:  { n:'Moonwheat',  time:720,  item:'moonwheat',  qty:[2,3] },
  pumpkid:    { n:'Pumpkid Mound',   time:720,  hatch:'pumpkid' },
  mandragora: { n:'Mandragora Root', time:960,  hatch:'mandragora' },
  mystery:    { n:'Mystery Sprout',  time:1440,
    hatch:['wispy','flitbat','shroomb','frostfae','mothmare','gloomkin','vipervine','pumpkid','mandragora','cryptmite'] },
};

// ---------- CAULDRON BREWS ----------
const BREWS = [
  { out:'tonic',     ins:{ bloodberry:3 } },
  { out:'bigtonic',  ins:{ gravefruit:2, bloodberry:1 } },
  { out:'fulltonic', ins:{ moonwheat:2, gravefruit:2 } },
  { out:'glowbait',  ins:{ moonwheat:1 } },
  { out:'voidbait',  ins:{ gravefruit:1, moonwheat:1 } },
  { out:'revive',    ins:{ bloodberry:2, gravefruit:2, moonwheat:2 } },
];

// ---------- FISHING ----------
// rod: min rod tier. moon: 'new'|'full'. night: true = only 20:00-06:00.
const FISH_TABLE = [
  { sp:'murkoi',     w:10, rod:1, min:3,  max:10 },
  { sp:'phantfin',   w:5,  rod:1, min:6,  max:14, night:true },
  { sp:'boneel',     w:5,  rod:2, min:8,  max:18 },
  { sp:'lanternjaw', w:3,  rod:2, min:12, max:22, moon:'new' },
  { sp:'moonscale',  w:1,  rod:3, min:20, max:30, moon:'full' },
];

// ---------- WILD ENCOUNTER TABLES ----------
const ENCOUNTERS = {
  woods: [
    { sp:'wispy',    w:10, min:2, max:4 },
    { sp:'skulpup',  w:8,  min:2, max:4 },
    { sp:'shroomb',  w:8,  min:2, max:4 },
    { sp:'flitbat',  w:8,  min:3, max:5 },
    { sp:'vipervine',w:5,  min:3, max:5 },
    { sp:'frostfae', w:4,  min:4, max:6 },
    { sp:'mothmare', w:3,  min:4, max:6 },
    { sp:'gloomkin', w:6,  min:4, max:6, night:true },
  ],
  cata: [
    { sp:'cryptmite',  w:10 },
    { sp:'hollowshade',w:9 },
    { sp:'skulpup',    w:6 },
    { sp:'emberghast', w:6 },
    { sp:'rotwalker',  w:5 },
    { sp:'flitbat',    w:5 },
    { sp:'gloomkin',   w:4 },
    { sp:'banshriek',  w:2 },
    { sp:'gravehound', w:2 },
  ],
};

// ---------- RIVAL NECROMANCERS (the "other players" of the Soul Ladder) ----------
const RIVAL_NAMES = ['Morrick','Vexa','Saul the Pale','Greta Gloom','Ossian','Lady Wormwood',
  'Hex','Barnaby Crow','Sister Maud','Tobias Vane','Nyx','Ezra Hollow','Mirelda',
  'Count Fenwick','Pru the Cruel','Onna the Ash-Witch','Dredge','Casimir','Widow Thorpe','Ilsabet'];
const RIVAL_TITLES = ['Gravecaller','Soulbinder','Bone Whisperer','Dusk Warden','Crypt Robber',
  'Moon Cultist','Hexwright','Pale Rider','Worm Farmer','Last Mourner'];
const RIVAL_POOL = ['wispy','banshriek','skulpup','gravehound','shroomb','mycolossus','flitbat',
  'nocturnyx','vipervine','frostfae','mothmare','gloomkin','pumpkid','jackrot','mandragora',
  'murkoi','boneel','phantfin','lanternjaw','cryptmite','cryptlord','hollowshade','emberghast',
  'rotwalker','thornwraith','pyrelich','mireghast'];

// ---------- COMBAT ARCHETYPES (real-time behaviour per species) ----------
// chaser: melee pursuit · wisp: fast erratic melee · spitter: ranged, keeps distance
// tank: slow, heavy, lots of hp · caster: 3-shot volleys
const ARCH = {
  sproutling:'chaser',  thornwraith:'caster', cindling:'spitter',  pyrelich:'caster',
  dripp:'chaser',       mireghast:'tank',     wispy:'wisp',        banshriek:'wisp',
  skulpup:'chaser',     gravehound:'chaser',  shroomb:'spitter',   mycolossus:'tank',
  flitbat:'wisp',       nocturnyx:'wisp',     vipervine:'spitter', frostfae:'caster',
  mothmare:'caster',    gloomkin:'chaser',    pumpkid:'chaser',    jackrot:'tank',
  mandragora:'tank',    murkoi:'chaser',      boneel:'chaser',     phantfin:'wisp',
  lanternjaw:'spitter', moonscale:'caster',   cryptmite:'chaser',  cryptlord:'tank',
  hollowshade:'wisp',   emberghast:'spitter', rotwalker:'tank',    hollowking:'caster',
};
const ARCH_STATS = { // hpMult, dmgMult, speed(px/s), attack range/cadence handled in combat
  chaser: { hp:1.0, dmg:1.0, spd:95  },
  wisp:   { hp:0.7, dmg:0.8, spd:150 },
  spitter:{ hp:0.8, dmg:0.9, spd:70  },
  tank:   { hp:1.8, dmg:1.4, spd:48  },
  caster: { hp:0.9, dmg:1.1, spd:60  },
};

// ---------- GEAR (PoE-style affix drops; slots: staff / robe / charm) ----------
const AFFIXES = {
  dmg:     { n:'+#% melee damage',    base:8,  per:2.0 },
  bolt:    { n:'+#% hex bolt damage', base:10, per:2.5 },
  minion:  { n:'+#% minion damage',   base:8,  per:2.0 },
  hp:      { n:'+# max life',         base:10, per:3.0 },
  soul:    { n:'+# max soul',         base:6,  per:1.5 },
  regen:   { n:'+#% soul regen',      base:15, per:2.0 },
  speed:   { n:'+#% move speed',      base:5,  per:0.5, cap:30 },
  capture: { n:'+#% capture odds',    base:6,  per:1.0 },
  gold:    { n:'+#% gold found',      base:10, per:2.0 },
  xp:      { n:'+#% grim XP',         base:6,  per:1.2 },
};
const GEAR_BASES = {
  staff: ['Femur Rod','Willow Staff','Grave Sceptre','Hollow Crook'],
  robe:  ['Mourning Robe','Grave Shroud','Moth Cloak','Pale Vestment'],
  charm: ['Knuckle Charm','Moon Locket','Wax Seal','Ghost Bell'],
};
const GEAR_PREFIX = ['Whispering','Sodden','Cursed','Moonlit','Smouldering','Rotten','Gleaming','Wormy','Sainted','Umbral'];
const RARITIES = [
  { n:'common',   col:'#cdc4e8', affixes:1 },
  { n:'cursed',   col:'#5d8ae8', affixes:2 },
  { n:'eldritch', col:'#e8c95d', affixes:3 },
];
function rollGear(zoneLvl){
  const slot = ['staff','robe','charm'][rnd(3)];
  const r = Math.random();
  const rar = r < 0.08 ? 2 : r < 0.35 ? 1 : 0;
  const keys = Object.keys(AFFIXES);
  const aff = {};
  for (let i = 0; i <= rar; i++){
    const k = keys[rnd(keys.length)];
    const A = AFFIXES[k];
    let v = Math.round((A.base + A.per * zoneLvl) * (0.7 + Math.random() * 0.6));
    if (A.cap) v = Math.min(A.cap, v);
    aff[k] = (aff[k] || 0) + v;
  }
  return {
    slot, rar, lvl: zoneLvl, aff,
    name: (rar > 0 ? GEAR_PREFIX[rnd(GEAR_PREFIX.length)] + ' ' : '') + GEAR_BASES[slot][rnd(4)],
  };
}
function gearAffix(key){ // sum of an affix across equipped gear
  let v = 0;
  for (const s of ['staff','robe','charm']){
    const g = G.gear.equip[s];
    if (g && g.aff[key]) v += g.aff[key];
  }
  return v;
}

// ---------- BUILDABLE PLOTS (Deeds system; unlocks after the manor tutorial) ----------
// tiers: 0 unowned land -> 1 camp -> 2 cottage -> 3 hall. Buffs scale with tier.
const PLOTS = {
  cabin:    { n:"Hunter's Cabin",   map:'woods', x:8,  y:12, land:3000,
    buff:'Minions earn +10% XP per tier from wild kills.', },
  hide:     { n:'Deep-Woods Hide',  map:'woods', x:26, y:21, land:4500,
    buff:'Murkwood spawns +2 extra grims and more rare ones per tier.' },
  pondshack:{ n:'Pond Shack',       map:'woods', x:20, y:15, land:5000,
    buff:'Fishing catch-window +6% per tier.' },
  moontower:{ n:'Moonhill Tower',   map:'woods', x:27, y:5,  land:14000,
    buff:'+5% capture odds and +5% double-brew chance per tier.' },
  townhouse:{ n:'Square Townhouse', map:'town',  x:13, y:10, land:8000,
    buff:'Shop prices -5% per tier, plus 60⛁ rent per tier each day.' },
  garden:   { n:'Garden Cottage',   map:'town',  x:31, y:10, land:6000,
    buff:'Crops grow +15% faster per tier.' },
  ossuary:  { n:'Graveyard Ossuary',map:'town',  x:2,  y:9,  land:12000,
    buff:'Begin catacomb dives 2 floors deeper per tier.' },
  pier:     { n:'Lakeside Pier',    map:'town',  x:33, y:19, land:9000,
    buff:'Rare fish bite +20% more per tier.' },
  shore:    { n:'Shore Cottage',    map:'town',  x:22, y:24, land:7000,
    buff:'+6% capture odds on hooked fish per tier.' },
};
const PLOT_TIERS = [
  null,
  { n:'Camp',    cost:{ gold:1500,  plank:4 },                    furn:4 },
  { n:'Cottage', cost:{ gold:5000,  plank:8,  stone:6 },          furn:8 },
  { n:'Hall',    cost:{ gold:15000, plank:12, stone:12, ecto:6 }, furn:14 },
];
function plotTier(id){ return (G.houses[id] && G.houses[id].tier) || 0; }

const ROOMS = {
  kitchen:      { n:'Kitchen Wing',  cost:{gold:800,  plank:3, stone:2 }, d:'Unlocks the brewing cauldron.' },
  study:        { n:'Study',         cost:{gold:1500, plank:4, stone:3, ecto:1 }, d:'Restored: all grims gain +15% XP.' },
  conservatory: { n:'Conservatory',  cost:{gold:2500, plank:5, stone:4, ecto:2 }, d:'3 indoor plots. Crops grow twice as fast.' },
  crypt:        { n:'Private Crypt', cost:{gold:4000, plank:4, stone:8, ecto:4 }, d:'Trophy hall. Holds a sealed reward chest.' },
};

// ---------- PLAYER SKILLS (endless levels, no cap) ----------
const SKILLS = {
  necromancy: { n:'Necromancy', icon:'☠', col:'#9b6dff',
    d:'Battling and binding grims. Each level: +1.5% capture odds, +0.5% grim XP.' },
  fishing:    { n:'Fishing', icon:'🎣', col:'#5d8ae8',
    d:'Each level: easier catch window, stronger fish, better rare odds. Rods unlock at Lv 5 / 15.' },
  farming:    { n:'Farming', icon:'☘', col:'#6dd86d',
    d:'Each level: +2% growth speed, +2% bonus-yield chance. Rare seeds unlock as you level.' },
  brewing:    { n:'Brewing', icon:'⚗', col:'#c98ad8',
    d:'Cauldron craft. Each level: +2% chance to double a brew. Recipes unlock as you level.' },
  delving:    { n:'Delving', icon:'⛏', col:'#e8c95d',
    d:'Catacomb craft. Each level: +3% chest gold. Every 5 levels: descend 1 extra floor per stair.' },
};
// Cumulative XP required to BE level l (level 1 = 0 xp). Endless curve.
function skillXpFor(l){ return Math.floor(60 * Math.pow(l-1, 2.1)); }
function skillLevel(xp){ let l = 1; while (skillXpFor(l+1) <= xp) l++; return l; }
// Skill gates
const SKILL_REQ = {
  rod:   { 1:1, 2:5, 3:15 },                       // fishing level per rod tier
  seed:  { bloodberry:1, gravefruit:3, moonwheat:6, pumpkid:9, mandragora:13, mystery:17 }, // farming
  brew:  { tonic:1, glowbait:3, bigtonic:5, voidbait:8, fulltonic:11, revive:15 },          // brewing
};

// XP curve helpers
function xpForLevel(l){ return l*l*l; }
function statsFor(spKey, lvl){
  const b = DEX[spKey].base;
  return {
    maxhp: Math.floor(b[0]*2*lvl/100) + lvl + 10,
    atk: Math.floor(b[1]*2*lvl/100) + 5,
    def: Math.floor(b[2]*2*lvl/100) + 5,
    spd: Math.floor(b[3]*2*lvl/100) + 5,
    spc: Math.floor(b[4]*2*lvl/100) + 5,
  };
}
function movesAt(spKey, lvl){
  const out = [];
  for (const [l, m] of DEX[spKey].mv) if (l <= lvl) out.push(m);
  return out.slice(-4);
}
function makeGrim(spKey, lvl){
  const st = statsFor(spKey, lvl);
  return {
    sp: spKey, nick: DEX[spKey].n, lvl, xp: xpForLevel(lvl),
    hp: st.maxhp, status: null,
    moves: movesAt(spKey, lvl).map(m => ({ id:m, pp:MOVES[m].pp })),
  };
}
const rnd = n => Math.floor(Math.random()*n);
const pickW = list => {
  let tot = 0; for (const e of list) tot += e.w;
  let r = Math.random()*tot;
  for (const e of list){ r -= e.w; if (r <= 0) return e; }
  return list[list.length-1];
};
