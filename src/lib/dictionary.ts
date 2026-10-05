export interface FuragoDictEntry {
  id: string;
  lemma: string;
  pos_en: string;
  pos_ja: string;
  gender_en: string;
  gender_ja: string;
  meaning_ja: string;
  meaning_en: string;
  inflections: string[];
  status: string;
}

export interface DictLookupResult {
  mot: string;
  originalWord: string;
  matchedLemma: string | null;
  conciseDef: string;
  phraseOriginale: string;
  traductionPhrase: string;
  nature: string;
  definitions: string[];
  gender: string;
  entry?: FuragoDictEntry;
}

const PRIORITY_LEMMAS: Record<
  string,
  { lemma: string; def: string; pos: string }
> = {
  // être
  est: { lemma: "être", def: "〜である、いる、ある", pos: "動詞" },
  suis: { lemma: "être", def: "〜である、いる、ある", pos: "動詞" },
  sommes: { lemma: "être", def: "〜である、いる、ある", pos: "動詞" },
  sont: { lemma: "être", def: "〜である、いる、ある", pos: "動詞" },
  étais: { lemma: "être", def: "〜であった、いた、あった", pos: "動詞" },
  était: { lemma: "être", def: "〜であった、いた、あった", pos: "動詞" },
  étions: { lemma: "être", def: "〜であった、いた、あった", pos: "動詞" },
  étiez: { lemma: "être", def: "〜であった、いた、あった", pos: "動詞" },
  étaient: { lemma: "être", def: "〜であった、いた、あった", pos: "動詞" },
  été: { lemma: "être", def: "〜であった、夏", pos: "動詞" },
  serai: { lemma: "être", def: "〜になる、いるだろう", pos: "動詞" },
  seras: { lemma: "être", def: "〜になる、いるだろう", pos: "動詞" },
  sera: { lemma: "être", def: "〜になる、いるだろう", pos: "動詞" },
  serons: { lemma: "être", def: "〜になる、いるだろう", pos: "動詞" },
  serez: { lemma: "être", def: "〜になる、いるだろう", pos: "動詞" },
  seront: { lemma: "être", def: "〜になる、いるだろう", pos: "動詞" },
  serait: { lemma: "être", def: "〜であるだろう、いるだろう", pos: "動詞" },
  seraient: { lemma: "être", def: "〜であるだろう、いるだろう", pos: "動詞" },
  sois: { lemma: "être", def: "〜であれ、いる", pos: "動詞" },
  soit: { lemma: "être", def: "〜であれ、または", pos: "動詞" },
  soient: { lemma: "être", def: "〜であれ", pos: "動詞" },

  // avoir
  a: { lemma: "avoir", def: "持つ、ある、〜がいる", pos: "動詞" },
  ont: { lemma: "avoir", def: "持つ、ある、〜がいる", pos: "動詞" },
  ai: { lemma: "avoir", def: "持つ、ある、〜がいる", pos: "動詞" },
  as: { lemma: "avoir", def: "持つ、ある、〜がいる", pos: "動詞" },
  avons: { lemma: "avoir", def: "持つ、ある、〜がいる", pos: "動詞" },
  avez: { lemma: "avoir", def: "持つ、ある、〜がいる", pos: "動詞" },
  avait: { lemma: "avoir", def: "持っていた、あった、いた", pos: "動詞" },
  avaient: { lemma: "avoir", def: "持っていた、あった、いた", pos: "動詞" },
  aura: { lemma: "avoir", def: "持つだろう、あるだろう", pos: "動詞" },
  auront: { lemma: "avoir", def: "持つだろう、あるだろう", pos: "動詞" },
  aurait: { lemma: "avoir", def: "持つだろう、あるだろう", pos: "動詞" },
  eu: { lemma: "avoir", def: "持った、あった", pos: "動詞" },

  // aller
  va: { lemma: "aller", def: "行く", pos: "動詞" },
  vas: { lemma: "aller", def: "行く", pos: "動詞" },
  vais: { lemma: "aller", def: "行く", pos: "動詞" },
  allons: { lemma: "aller", def: "行く", pos: "動詞" },
  allez: { lemma: "aller", def: "行く", pos: "動詞" },
  vont: { lemma: "aller", def: "行く", pos: "動詞" },
  allait: { lemma: "aller", def: "行った、行っていた", pos: "動詞" },
  ira: { lemma: "aller", def: "行くだろう", pos: "動詞" },
  iront: { lemma: "aller", def: "行くだろう", pos: "動詞" },
  allé: { lemma: "aller", def: "行った", pos: "動詞" },

  // faire
  fait: { lemma: "faire", def: "する、作る、行う", pos: "動詞" },
  font: { lemma: "faire", def: "する、作る、行う", pos: "動詞" },
  fais: { lemma: "faire", def: "する、作る、行う", pos: "動詞" },
  faisons: { lemma: "faire", def: "する、作る、行う", pos: "動詞" },
  faites: { lemma: "faire", def: "する、作る、行う", pos: "動詞" },
  faisait: { lemma: "faire", def: "していた、作った", pos: "動詞" },
  fera: { lemma: "faire", def: "するだろう、作るだろう", pos: "動詞" },

  // bon / bonne
  bonne: { lemma: "bon", def: "良い、美味しい、優れた", pos: "形容詞" },
  bonnes: { lemma: "bon", def: "良い、美味しい、優れた", pos: "形容詞" },
  bon: { lemma: "bon", def: "良い、美味しい、優れた", pos: "形容詞" },
  bons: { lemma: "bon", def: "良い、美味しい、優れた", pos: "形容詞" },

  // connaître
  connaît: { lemma: "connaître", def: "知る、理解する、知り合いである", pos: "動詞" },
  connait: { lemma: "connaître", def: "知る、理解する、知り合いである", pos: "動詞" },
  connais: { lemma: "connaître", def: "知る、理解する、知り合いである", pos: "動詞" },
  connaissons: { lemma: "connaître", def: "知る、理解する、知り合いである", pos: "動詞" },
  connaissez: { lemma: "connaître", def: "知る、理解する、知り合いである", pos: "動詞" },
  connaissent: { lemma: "connaître", def: "知る、理解する、知り合いである", pos: "動詞" },
  connaissait: { lemma: "connaître", def: "知っていた", pos: "動詞" },
  connaissaient: { lemma: "connaître", def: "知っていた", pos: "動詞" },
  connu: { lemma: "connaître", def: "知られている、有名な", pos: "動詞" },
  connue: { lemma: "connaître", def: "知られている、有名な", pos: "動詞" },
  connus: { lemma: "connaître", def: "知られている、有名な", pos: "動詞" },
  connues: { lemma: "connaître", def: "知られている、有名な", pos: "動詞" },

  // beau / belle
  belle: { lemma: "beau", def: "美しい、素晴らしい、きれいな", pos: "形容詞" },
  belles: { lemma: "beau", def: "美しい、素晴らしい、きれいな", pos: "形容詞" },
  beaux: { lemma: "beau", def: "美しい、素晴らしい、きれいな", pos: "形容詞" },
  bel: { lemma: "beau", def: "美しい、素晴らしい、きれいな", pos: "形容詞" },
  beau: { lemma: "beau", def: "美しい、素晴らしい、きれいな", pos: "形容詞" },

  // nouveau / nouvelle
  nouvelle: { lemma: "nouveau", def: "新しい、新たな", pos: "形容詞" },
  nouvelles: { lemma: "nouveau", def: "新しい、新たな", pos: "形容詞" },
  nouveaux: { lemma: "nouveau", def: "新しい、新たな", pos: "形容詞" },
  nouvel: { lemma: "nouveau", def: "新しい、新たな", pos: "形容詞" },

  // grand / grande
  grande: { lemma: "grand", def: "大きい、偉大な、高い", pos: "形容詞" },
  grandes: { lemma: "grand", def: "大きい、偉大な、高い", pos: "形容詞" },
  grands: { lemma: "grand", def: "大きい、偉大な、高い", pos: "形容詞" },

  // petit / petite
  petite: { lemma: "petit", def: "小さい、幼い", pos: "形容詞" },
  petites: { lemma: "petit", def: "小さい、幼い", pos: "形容詞" },
  petits: { lemma: "petit", def: "小さい、幼い", pos: "形容詞" },

  // premier / première
  première: { lemma: "premier", def: "最初の、第1の、主要な", pos: "形容詞" },
  premières: { lemma: "premier", def: "最初の、第1の、主要な", pos: "形容詞" },
  premiers: { lemma: "premier", def: "最初の、第1の、主要な", pos: "形容詞" },

  // dernier / dernière
  dernière: { lemma: "dernier", def: "最後の、最新の", pos: "形容詞" },
  dernières: { lemma: "dernier", def: "最後の、最新の", pos: "形容詞" },
  derniers: { lemma: "dernier", def: "最後の、最新の", pos: "形容詞" },

  // vrai / vraie
  vraie: { lemma: "vrai", def: "本当の、真実の、本物の", pos: "形容詞" },
  vraies: { lemma: "vrai", def: "本当の、真実の、本物の", pos: "形容詞" },
  vrais: { lemma: "vrai", def: "本当の、真実の、本物の", pos: "形容詞" },

  // long / longue
  longue: { lemma: "long", def: "長い", pos: "形容詞" },
  longues: { lemma: "long", def: "長い", pos: "形容詞" },
  longs: { lemma: "long", def: "長い", pos: "形容詞" },

  // blanc / blanche
  blanche: { lemma: "blanc", def: "白い", pos: "形容詞" },
  blanches: { lemma: "blanc", def: "白い", pos: "形容詞" },

  // pouvoir
  peux: { lemma: "pouvoir", def: "〜できる", pos: "動詞" },
  peut: { lemma: "pouvoir", def: "〜できる", pos: "動詞" },
  peuvent: { lemma: "pouvoir", def: "〜できる", pos: "動詞" },
  pouvons: { lemma: "pouvoir", def: "〜できる", pos: "動詞" },
  pouvez: { lemma: "pouvoir", def: "〜できる", pos: "動詞" },
  pouvait: { lemma: "pouvoir", def: "〜できた", pos: "動詞" },
  pourra: { lemma: "pouvoir", def: "〜できるだろう", pos: "動詞" },
  pourrait: { lemma: "pouvoir", def: "〜できるかもしれない", pos: "動詞" },
  pu: { lemma: "pouvoir", def: "〜できた", pos: "動詞" },

  // vouloir
  veux: { lemma: "vouloir", def: "〜したい、望む", pos: "動詞" },
  veut: { lemma: "vouloir", def: "〜したい、望む", pos: "動詞" },
  veulent: { lemma: "vouloir", def: "〜したい、望む", pos: "動詞" },
  voulons: { lemma: "vouloir", def: "〜したい、望む", pos: "動詞" },
  voulez: { lemma: "vouloir", def: "〜したい、望む", pos: "動詞" },
  voulait: { lemma: "vouloir", def: "〜したかった", pos: "動詞" },
  voudra: { lemma: "vouloir", def: "〜したがるだろう", pos: "動詞" },
  voudrait: { lemma: "vouloir", def: "〜したいのですが", pos: "動詞" },
  voulu: { lemma: "vouloir", def: "望んだ", pos: "動詞" },

  // devoir
  dois: { lemma: "devoir", def: "〜しなければならない", pos: "動詞" },
  doit: { lemma: "devoir", def: "〜しなければならない", pos: "動詞" },
  doivent: { lemma: "devoir", def: "〜しなければならない", pos: "動詞" },
  devons: { lemma: "devoir", def: "〜しなければならない", pos: "動詞" },
  devez: { lemma: "devoir", def: "〜しなければならない", pos: "動詞" },
  devait: { lemma: "devoir", def: "〜すべきだった、はずだった", pos: "動詞" },
  devra: { lemma: "devoir", def: "〜しなければならないだろう", pos: "動詞" },
  devrait: { lemma: "devoir", def: "〜すべきである", pos: "動詞" },
  dû: { lemma: "devoir", def: "〜しなければならなかった", pos: "動詞" },

  // savoir
  sais: { lemma: "savoir", def: "知っている、わかる、できる", pos: "動詞" },
  sait: { lemma: "savoir", def: "知っている、わかる、できる", pos: "動詞" },
  savent: { lemma: "savoir", def: "知っている、わかる、できる", pos: "動詞" },
  savons: { lemma: "savoir", def: "知っている、わかる、できる", pos: "動詞" },
  savez: { lemma: "savoir", def: "知っている、わかる、できる", pos: "動詞" },
  savait: { lemma: "savoir", def: "知っていた", pos: "動詞" },
  su: { lemma: "savoir", def: "知った", pos: "動詞" },

  // voir
  vois: { lemma: "voir", def: "見る、見える、会う", pos: "動詞" },
  voit: { lemma: "voir", def: "見る、見える、会う", pos: "動詞" },
  voient: { lemma: "voir", def: "見る、見える、会う", pos: "動詞" },
  voyons: { lemma: "voir", def: "見る、見える、会う", pos: "動詞" },
  voyez: { lemma: "voir", def: "見る、見える、会う", pos: "動詞" },
  voyait: { lemma: "voir", def: "見ていた", pos: "動詞" },
  verra: { lemma: "voir", def: "見るだろう", pos: "動詞" },
  vu: { lemma: "voir", def: "見た", pos: "動詞" },

  // prendre
  prend: { lemma: "prendre", def: "取る、乗る、食べる", pos: "動詞" },
  prends: { lemma: "prendre", def: "取る、乗る、食べる", pos: "動詞" },
  prennent: { lemma: "prendre", def: "取る、乗る、食べる", pos: "動詞" },
  prenons: { lemma: "prendre", def: "取る、乗る、食べる", pos: "動詞" },
  prenez: { lemma: "prendre", def: "取る、乗る、食べる", pos: "動詞" },
  prenait: { lemma: "prendre", def: "取っていた", pos: "動詞" },
  pris: { lemma: "prendre", def: "取った", pos: "動詞" },

  // mettre
  met: { lemma: "mettre", def: "置く、身につける", pos: "動詞" },
  mets: { lemma: "mettre", def: "置く、身につける", pos: "動詞" },
  mettent: { lemma: "mettre", def: "置く、身につける", pos: "動詞" },
  mettons: { lemma: "mettre", def: "置く、身につける", pos: "動詞" },
  mettez: { lemma: "mettre", def: "置く、身につける", pos: "動詞" },
  mis: { lemma: "mettre", def: "置いた", pos: "動詞" },

  // dire
  dit: { lemma: "dire", def: "言う、話す", pos: "動詞" },
  dis: { lemma: "dire", def: "言う、話す", pos: "動詞" },
  disent: { lemma: "dire", def: "言う、話す", pos: "動詞" },
  disons: { lemma: "dire", def: "言う、話す", pos: "動詞" },
  dites: { lemma: "dire", def: "言う、話す", pos: "動詞" },

  // venir
  vient: { lemma: "venir", def: "来る", pos: "動詞" },
  viens: { lemma: "venir", def: "来る", pos: "動詞" },
  viennent: { lemma: "venir", def: "来る", pos: "動詞" },
  venons: { lemma: "venir", def: "来る", pos: "動詞" },
  venez: { lemma: "venir", def: "来る", pos: "動詞" },
  venait: { lemma: "venir", def: "来ていた", pos: "動詞" },
  venu: { lemma: "venir", def: "来た", pos: "動詞" },

  // comprendre
  comprend: { lemma: "comprendre", def: "理解する、わかる", pos: "動詞" },
  comprends: { lemma: "comprendre", def: "理解する、わかる", pos: "動詞" },
  comprennent: { lemma: "comprendre", def: "理解する、わかる", pos: "動詞" },
  compris: { lemma: "comprendre", def: "理解した", pos: "動詞" },

  // apprendre
  apprend: { lemma: "apprendre", def: "学ぶ、習う、知る", pos: "動詞" },
  apprends: { lemma: "apprendre", def: "学ぶ、習う、知る", pos: "動詞" },
  apprennent: { lemma: "apprendre", def: "学ぶ、習う、知る", pos: "動詞" },
  appris: { lemma: "apprendre", def: "学んだ", pos: "動詞" },
};

const IRREGULAR_VERBS: Record<string, string> = {
  suis: "être", es: "être", est: "être", sommes: "être", êtes: "être", sont: "être",
  étais: "être", était: "être", étions: "être", étiez: "être", étaient: "être",
  fus: "être", fut: "être", fûmes: "être", fûtes: "être", furent: "être",
  serai: "être", seras: "être", sera: "être", serons: "être", serez: "être", seront: "être",
  serais: "être", serait: "être", serions: "être", seriez: "être", seraient: "être",
  sois: "être", soit: "être", soyons: "être", soyez: "être", soient: "être", été: "être",

  ai: "avoir", as: "avoir", a: "avoir", avons: "avoir", avez: "avoir", ont: "avoir",
  avais: "avoir", avait: "avoir", avions: "avoir", aviez: "avoir", avaient: "avoir",
  eus: "avoir", eut: "avoir", eûmes: "avoir", eûtes: "avoir", eurent: "avoir",
  aurai: "avoir", auras: "avoir", aura: "avoir", aurons: "avoir", aurez: "avoir", auront: "avoir",
  aurais: "avoir", aurait: "avoir", aurions: "avoir", auriez: "avoir", auraient: "avoir",
  aie: "avoir", aies: "avoir", ait: "avoir", ayons: "avoir", ayez: "avoir", aient: "avoir",
  eu: "avoir", eue: "avoir", eues: "avoir", ayant: "avoir",

  vais: "aller", vas: "aller", va: "aller", allons: "aller", allez: "aller", vont: "aller",
  allais: "aller", allait: "aller", allions: "aller", alliez: "aller", allaient: "aller",
  irai: "aller", iras: "aller", ira: "aller", irons: "aller", irez: "aller", iront: "aller",
  irais: "aller", irait: "aller", irions: "aller", iriez: "aller", iraient: "aller",
  aille: "aller", ailles: "aller", aillent: "aller", allé: "aller", allée: "aller", allés: "aller", allées: "aller", allant: "aller",

  fais: "faire", fait: "faire", faisons: "faire", faites: "faire", font: "faire",
  faisais: "faire", faisait: "faire", faisions: "faire", faisiez: "faire", faisaient: "faire",
  fis: "faire", fit: "faire", fîmes: "faire", fîtes: "faire", firent: "faire",
  ferai: "faire", feras: "faire", fera: "faire", ferons: "faire", ferez: "faire", feront: "faire",
  ferais: "faire", ferait: "faire", ferions: "faire", feriez: "faire", feraient: "faire",
  fasse: "faire", fasses: "faire", fassent: "faire", faisant: "faire",

  peux: "pouvoir", peut: "pouvoir", pouvons: "pouvoir", pouvez: "pouvoir", peuvent: "pouvoir",
  pouvais: "pouvoir", pouvait: "pouvoir", pouvions: "pouvoir", pouviez: "pouvoir", pouvaient: "pouvoir",
  pus: "pouvoir", put: "pouvoir", pûmes: "pouvoir", pûtes: "pouvoir", purent: "pouvoir",
  pourrai: "pouvoir", pourras: "pouvoir", pourra: "pouvoir", pourrons: "pouvoir", pourrez: "pouvoir", pourront: "pouvoir",
  pourrais: "pouvoir", pourrait: "pouvoir", pourrions: "pouvoir", pourriez: "pouvoir", pourraient: "pouvoir",
  puisse: "pouvoir", puisses: "pouvoir", puissent: "pouvoir", pu: "pouvoir", pouvant: "pouvoir",

  veux: "vouloir", veut: "vouloir", voulons: "vouloir", voulez: "vouloir", veulent: "vouloir",
  voulais: "vouloir", voulait: "vouloir", voulions: "vouloir", vouliez: "vouloir", voulaient: "vouloir",
  voulus: "vouloir", voulut: "vouloir", voulûmes: "vouloir", voulûtes: "vouloir", voulurent: "vouloir",
  voudrai: "vouloir", voudras: "vouloir", voudra: "vouloir", voudrons: "vouloir", voudrez: "vouloir", voudront: "vouloir",
  voudrais: "vouloir", voudrait: "vouloir", voudrions: "vouloir", voudriez: "vouloir", voudraient: "vouloir",
  veuille: "vouloir", veuillent: "vouloir", voulu: "vouloir", voulue: "vouloir", voulues: "vouloir",

  dois: "devoir", doit: "devoir", devons: "devoir", devez: "devoir", doivent: "devoir",
  devais: "devoir", devait: "devoir", devions: "devoir", deviez: "devoir", devaient: "devoir",
  dus: "devoir", dut: "devoir", dûmes: "devoir", dûtes: "devoir", durent: "devoir",
  devrai: "devoir", devras: "devoir", devra: "devoir", devrons: "devoir", devrez: "devoir", devront: "devoir",
  devrais: "devoir", devrait: "devoir", devrions: "devoir", devriez: "devoir", devraient: "devoir",
  doive: "devoir", dû: "devoir", due: "devoir", dues: "devoir",

  sais: "savoir", sait: "savoir", savons: "savoir", savez: "savoir", savent: "savoir",
  savais: "savoir", savait: "savoir", savions: "savoir", saviez: "savoir", savaient: "savoir",
  sus: "savoir", sut: "savoir", sûmes: "savoir", sûtes: "savoir", surent: "savoir",
  saurai: "savoir", sauras: "savoir", saura: "savoir", saurons: "savoir", saurez: "savoir", sauront: "savoir",
  saurais: "savoir", saurait: "savoir", saurions: "savoir", sauriez: "savoir", sauraient: "savoir",
  sache: "savoir", su: "savoir",

  vois: "voir", voit: "voir", voyons: "voir", voyez: "voir", voient: "voir",
  voyais: "voir", voyait: "voir", voyions: "voir", voyiez: "voir", voyaient: "voir",
  vis: "voir", vit: "voir", vîmes: "voir", vîtes: "voir", virent: "voir",
  verrai: "voir", verras: "voir", verra: "voir", verrons: "voir", verrez: "voir", verront: "voir",
  verrais: "voir", verrait: "voir", verraient: "voir", vu: "voir", vue: "voir", vus: "voir",

  prends: "prendre", prend: "prendre", prenons: "prendre", prenez: "prendre", prennent: "prendre",
  prenais: "prendre", prenait: "prendre", prenaient: "prendre", pris: "prendre", prise: "prendre", prises: "prendre",
  prendrai: "prendre", prendras: "prendre", prendra: "prendre", prendront: "prendre", prendrait: "prendre",

  viens: "venir", vient: "venir", venons: "venir", venez: "venir", viennent: "venir",
  venais: "venir", venait: "venir", venaient: "venir", venu: "venir", venue: "venir", venus: "venir", venues: "venir",
  viendrai: "venir", viendra: "venir", viendront: "venir", viendrait: "venir",

  dis: "dire", dit: "dire", disons: "dire", dites: "dire", disent: "dire",
  disais: "dire", disait: "dire", disaient: "dire", dirai: "dire", dira: "dire", diront: "dire",

  mets: "mettre", met: "mettre", mettons: "mettre", mettez: "mettre", mettent: "mettre",
  mettais: "mettre", mettait: "mettre", mettaient: "mettre", mis: "mettre", mise: "mettre", mises: "mettre",
  mettrai: "mettre", mettra: "mettre", mettront: "mettre", mettrait: "mettre",

  faut: "falloir", fallait: "falloir", faudra: "falloir", faudrait: "falloir", fallu: "falloir",
  crois: "croire", croit: "croire", croyons: "croire", croient: "croire", croyait: "croire", cru: "croire",
  écris: "écrire", écrit: "écrire", écrivons: "écrire", écrivent: "écrire", écrivait: "écrire",
  lis: "lire", lit: "lire", lisons: "lire", lisent: "lire", lisait: "lire", lu: "lire",
  ouvre: "ouvrir", ouvres: "ouvrir", ouvrent: "ouvrir", ouvrait: "ouvrir", ouvert: "ouvrir",
  reçois: "recevoir", reçoit: "recevoir", recevons: "recevoir", reçoivent: "recevoir", recevait: "recevoir", reçu: "recevoir",
};

function getLemmaCandidates(word: string): string[] {
  const candidates: string[] = [];
  if (IRREGULAR_VERBS[word]) candidates.push(IRREGULAR_VERBS[word]);

  const prefixes = ["re", "dé", "com", "sur", "in", "im", "ap", "sou", "con", "pre", "par", "inter"];
  for (const p of prefixes) {
    if (word.startsWith(p)) {
      const sub = word.slice(p.length);
      if (IRREGULAR_VERBS[sub]) {
        candidates.push(p + IRREGULAR_VERBS[sub]);
      }
    }
  }

  // 1. Plural rules
  if (word.endsWith("aux") && word.length > 4) {
    candidates.push(word.slice(0, -3) + "al");
    candidates.push(word.slice(0, -3) + "ail");
  }
  if (word.endsWith("eaux") && word.length > 4) {
    candidates.push(word.slice(0, -1));
  }
  if (word.endsWith("s") && word.length > 2) {
    candidates.push(word.slice(0, -1));
  }
  if (word.endsWith("x") && word.length > 3) {
    candidates.push(word.slice(0, -1));
  }

  // 2. Feminine rules
  if (word.endsWith("euses")) candidates.push(word.slice(0, -5) + "eur", word.slice(0, -5) + "eux");
  else if (word.endsWith("euse")) candidates.push(word.slice(0, -4) + "eur", word.slice(0, -4) + "eux");

  if (word.endsWith("trices")) candidates.push(word.slice(0, -6) + "teur");
  else if (word.endsWith("trice")) candidates.push(word.slice(0, -5) + "teur");

  if (word.endsWith("ières")) candidates.push(word.slice(0, -5) + "ier");
  else if (word.endsWith("ière")) candidates.push(word.slice(0, -4) + "ier");

  if (word.endsWith("iennes")) candidates.push(word.slice(0, -6) + "ien");
  else if (word.endsWith("ienne")) candidates.push(word.slice(0, -5) + "ien");

  if (word.endsWith("elles")) candidates.push(word.slice(0, -5) + "el", word.slice(0, -5) + "eau");
  else if (word.endsWith("elle")) candidates.push(word.slice(0, -4) + "el", word.slice(0, -4) + "eau");

  if (word.endsWith("ives")) candidates.push(word.slice(0, -4) + "if");
  else if (word.endsWith("ive")) candidates.push(word.slice(0, -3) + "if");

  if (word.endsWith("nnes") && word.length >= 5) candidates.push(word.slice(0, -3));
  else if (word.endsWith("nne") && word.length >= 4) candidates.push(word.slice(0, -2));

  if (word.endsWith("sses") && word.length >= 5) candidates.push(word.slice(0, -3));
  else if (word.endsWith("sse") && word.length >= 4) candidates.push(word.slice(0, -2));

  if (word.endsWith("ttes") && word.length >= 5) candidates.push(word.slice(0, -3));
  else if (word.endsWith("tte") && word.length >= 4) candidates.push(word.slice(0, -2));

  if (word.endsWith("es") && word.length > 3) {
    candidates.push(word.slice(0, -2));
    candidates.push(word.slice(0, -1));
  }
  if (word.endsWith("e") && word.length > 3) {
    candidates.push(word.slice(0, -1));
  }

  // 3. Verb conjugations (1st group -er)
  const erEndings = [
    "erait", "eraient", "erions", "eriez", "erons", "erez", "eront", "erais",
    "assent", "asses", "âmes", "âtes", "èrent", "aient", "ions", "iez",
    "eras", "erai", "era", "ais", "ait", "ant", "ons", "ez", "ent",
    "ée", "és", "ées", "é", "e", "es",
  ];
  for (const end of erEndings) {
    if (word.endsWith(end) && word.length > end.length + 2) {
      const stem = word.slice(0, -end.length);
      candidates.push(stem + "er");
      if (stem.endsWith("e")) candidates.push(stem.slice(0, -1) + "er");
      if (stem.endsWith("ç")) candidates.push(stem.slice(0, -1) + "cer");
      if (stem.length > 3 && stem[stem.length - 1] === stem[stem.length - 2]) {
        candidates.push(stem.slice(0, -1) + "er");
      }
      if (stem.includes("è")) {
        candidates.push(stem.replace(/è/g, "e") + "er");
        candidates.push(stem.replace(/è/g, "é") + "er");
      }
    }
  }

  // 4. Verb conjugations (2nd & 3rd group -ir / -re)
  const irEndings = [
    "issaient", "issions", "issiez", "issent", "issait", "issant", "issons", "issez",
    "irait", "iraient", "irions", "iriez", "irons", "irez", "iront", "irais",
    "ira", "irai", "iras", "it", "is", "i", "ie", "ies",
  ];
  for (const end of irEndings) {
    if (word.endsWith(end) && word.length > end.length + 2) {
      const stem = word.slice(0, -end.length);
      candidates.push(stem + "ir");
    }
  }

  const dreEndings = ["dent", "dait", "daient", "dons", "dez", "dra", "drait", "dront", "du", "due", "dus", "dues"];
  for (const end of dreEndings) {
    if (word.endsWith(end) && word.length > end.length + 2) {
      candidates.push(word.slice(0, -end.length) + "dre");
    }
  }

  if (word.endsWith("ent") && word.length > 5) {
    const s = word.slice(0, -3);
    candidates.push(s + "ir", s + "re", s + "tre");
  }

  return Array.from(new Set(candidates));
}

export function getShortTargetedContext(paragraphText: string, word: string): string {
  if (!paragraphText) return "";
  const clean = paragraphText.replace(/\s+/g, " ").trim();
  const sentences = clean.split(/(?<=[.!?\n])\s+/).filter(Boolean);

  const cleanWord = (word || "").trim().toLowerCase();
  let sentence =
    sentences.find((s) => {
      const regex = new RegExp(
        `(^|[^a-zA-ZÀ-ÿœŒæÆ])${cleanWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-zA-ZÀ-ÿœŒæÆ]|$)`,
        "i"
      );
      return regex.test(s);
    }) ||
    sentences.find((s) => s.toLowerCase().includes(cleanWord)) ||
    sentences[0] ||
    clean;

  if (sentence.split(/\s+/).length > 22) {
    const subParts = sentence.split(/[;:—–]\s*/).filter(Boolean);
    const partWithWord = subParts.find((p) => p.toLowerCase().includes(cleanWord));
    if (partWithWord && partWithWord.split(/\s+/).length >= 4) {
      sentence = partWithWord;
    }
  }

  return sentence.trim();
}


class DictionaryServiceClass {
  dbByLemma: Record<string, FuragoDictEntry> = {};
  dbByInflection: Record<string, FuragoDictEntry> = {};
  isLoaded = false;
  isLoading = false;
  sentenceCache = new Map<string, string>();

  async init() {
    if (this.isLoaded || this.isLoading) return;
    this.isLoading = true;
    try {
      const res = await fetch("https://raw.githubusercontent.com/kohaiducode/furago-data/main/dictionary.json");
      if (res.ok) {
        const data: FuragoDictEntry[] = await res.json();
        for (const entry of data) {
           const lemmaKey = (entry.lemma || "").toLowerCase().trim();
           if (lemmaKey) this.dbByLemma[lemmaKey] = entry;
           
           if (entry.inflections) {
              for (const inf of entry.inflections) {
                  const infKey = inf.toLowerCase().trim();
                  if (infKey && infKey !== lemmaKey) {
                      this.dbByInflection[infKey] = entry;
                  }
              }
           }
        }
        this.isLoaded = true;
      }
    } catch (e) {
      console.error("Failed to load dictionary from GitHub", e);
    } finally {
      this.isLoading = false;
    }
  }

  async lookupWord(word: string, surroundingSentence: string, appLang: "ja" | "en" = "ja"): Promise<DictLookupResult> {
    if (!this.isLoaded && !this.isLoading) {
      await this.init();
    }

    let cleanWord = word.toLowerCase().trim();
    cleanWord = cleanWord.replace(
      /^(l['’]|d['’]|qu['’]|j['’]|m['’]|t['’]|s['’]|n['’]|c['’]|ç['’])/,
      ""
    );
    cleanWord = cleanWord.replace(/[.,!?:;"'()[\]«»„“”]/g, "");

    const targetSentence = getShortTargetedContext(surroundingSentence, word);
    let traductionPhrase = "";

    if (targetSentence && targetSentence.length > 0) {
      if (this.sentenceCache.has(targetSentence)) {
        traductionPhrase = this.sentenceCache.get(targetSentence) || "";
      }

      if (!traductionPhrase) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1800);
          const targetLang = appLang === "en" ? "en" : "ja";
          const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=fr&tl=${targetLang}&dt=t&q=${encodeURIComponent(targetSentence)}`;
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            traductionPhrase = data[0]
              .map((item: any[]) => item[0])
              .join("")
              .trim();
            if (traductionPhrase) {
              this.sentenceCache.set(targetSentence, traductionPhrase);
            }
          }
        } catch {
          // Offline or timeout fallback
        }
      }
    }

    let matchedEntry: FuragoDictEntry | null = null;
    let matchedWord = cleanWord;
    
    // Check custom priority lemmas first if not found in db? Or db first?
    // Let's use the DB first
    if (this.isLoaded) {
      if (this.dbByLemma[cleanWord]) {
        matchedEntry = this.dbByLemma[cleanWord];
        matchedWord = matchedEntry.lemma;
      } else if (this.dbByInflection[cleanWord]) {
        matchedEntry = this.dbByInflection[cleanWord];
        matchedWord = matchedEntry.lemma;
      }
    }

    let conciseDef = "";
    let nature = "単語";
    let gender = "";

    if (matchedEntry) {
       conciseDef = appLang === "en" ? matchedEntry.meaning_en : matchedEntry.meaning_ja;
       nature = appLang === "en" ? matchedEntry.pos_en : matchedEntry.pos_ja;
       const rawGender = appLang === "en" ? matchedEntry.gender_en : matchedEntry.gender_ja;
       gender = rawGender === "-" ? "" : rawGender;
    } else {
       // Fallback to priority lemmas if not in DB
       if (PRIORITY_LEMMAS[cleanWord]) {
           const p = PRIORITY_LEMMAS[cleanWord];
           matchedWord = p.lemma;
           nature = p.pos;
           conciseDef = p.def; // These are currently JA only, but that's a fallback.
       } else {
           // Try candidate heuristics (e.g. drop 's', 'e')
           const candidates = getLemmaCandidates(cleanWord);
           for (const c of candidates) {
               if (this.isLoaded && this.dbByLemma[c]) {
                   matchedEntry = this.dbByLemma[c];
                   matchedWord = matchedEntry.lemma;
                   break;
               }
           }
           if (matchedEntry) {
               conciseDef = appLang === "en" ? matchedEntry.meaning_en : matchedEntry.meaning_ja;
               nature = appLang === "en" ? matchedEntry.pos_en : matchedEntry.pos_ja;
               const rawGender = appLang === "en" ? matchedEntry.gender_en : matchedEntry.gender_ja;
               gender = rawGender === "-" ? "" : rawGender;
           }
       }
    }

    if (!traductionPhrase) {
      traductionPhrase = conciseDef ? conciseDef : (appLang === "en" ? "(No context translation)" : "（文脈翻訳なし）");
    }

    return {
      mot: matchedWord,
      originalWord: word,
      matchedLemma: matchedWord.toLowerCase() !== word.toLowerCase().trim() ? matchedWord : null,
      conciseDef,
      phraseOriginale: targetSentence,
      traductionPhrase,
      nature,
      gender,
      definitions: conciseDef ? conciseDef.split("、") : [],
      entry: matchedEntry || undefined
    };
  }
}


export const DictionaryService = new DictionaryServiceClass();
