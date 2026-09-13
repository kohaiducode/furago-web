function showToast(message) {
  let toast = document.getElementById("furago-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "furago-toast";
    toast.style.cssText =
      "position:fixed; top: 100px; left:50%; transform:translateX(-50%); background: var(--green); color: white; padding: 12px 24px; border-radius: 24px; font-weight: bold; font-size: 1rem; z-index: 99999; opacity: 0; transition: opacity 0.3s; pointer-events: none; box-shadow: 0 10px 25px rgba(0,0,0,0.2); display: flex; align-items: center; gap: 10px;";
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> ${message}`;
  toast.style.opacity = "1";
  setTimeout(() => {
    toast.style.opacity = "0";
  }, 2000);
}

// -----------------------------------------------------
// 0. DICTIONARY SERVICE (OFFLINE) & FRENCH LEMMATIZER
// -----------------------------------------------------
const IRREGULAR_VERBS = {
  // être
  suis: "être",
  es: "être",
  est: "être",
  sommes: "être",
  êtes: "être",
  sont: "être",
  étais: "être",
  était: "être",
  étions: "être",
  étiez: "être",
  étaient: "être",
  fus: "être",
  fut: "être",
  fûmes: "être",
  fûtes: "être",
  furent: "être",
  serai: "être",
  seras: "être",
  sera: "être",
  serons: "être",
  serez: "être",
  seront: "être",
  serais: "être",
  serait: "être",
  serions: "être",
  seriez: "être",
  seraient: "être",
  sois: "être",
  soit: "être",
  soyons: "être",
  soyez: "être",
  soient: "être",
  été: "être",
  // avoir
  ai: "avoir",
  as: "avoir",
  a: "avoir",
  avons: "avoir",
  avez: "avoir",
  ont: "avoir",
  avais: "avoir",
  avait: "avoir",
  avions: "avoir",
  aviez: "avoir",
  avaient: "avoir",
  eus: "avoir",
  eut: "avoir",
  eûmes: "avoir",
  eûtes: "avoir",
  eurent: "avoir",
  aurai: "avoir",
  auras: "avoir",
  aura: "avoir",
  aurons: "avoir",
  aurez: "avoir",
  auront: "avoir",
  aurais: "avoir",
  aurait: "avoir",
  aurions: "avoir",
  auriez: "avoir",
  auraient: "avoir",
  aie: "avoir",
  aies: "avoir",
  ait: "avoir",
  ayons: "avoir",
  ayez: "avoir",
  aient: "avoir",
  eu: "avoir",
  eue: "avoir",
  eus: "avoir",
  eues: "avoir",
  ayant: "avoir",
  // aller
  vais: "aller",
  vas: "aller",
  va: "aller",
  allons: "aller",
  allez: "aller",
  vont: "aller",
  allais: "aller",
  allait: "aller",
  allions: "aller",
  alliez: "aller",
  allaient: "aller",
  irai: "aller",
  iras: "aller",
  ira: "aller",
  irons: "aller",
  irez: "aller",
  iront: "aller",
  irais: "aller",
  irait: "aller",
  irions: "aller",
  iriez: "aller",
  iraient: "aller",
  aille: "aller",
  ailles: "aller",
  aillent: "aller",
  allé: "aller",
  allée: "aller",
  allés: "aller",
  allées: "aller",
  allant: "aller",
  // faire
  fais: "faire",
  fait: "faire",
  faisons: "faire",
  faites: "faire",
  font: "faire",
  faisais: "faire",
  faisait: "faire",
  faisions: "faire",
  faisiez: "faire",
  faisaient: "faire",
  fis: "faire",
  fit: "faire",
  fîmes: "faire",
  fîtes: "faire",
  firent: "faire",
  ferai: "faire",
  feras: "faire",
  fera: "faire",
  ferons: "faire",
  ferez: "faire",
  feront: "faire",
  ferais: "faire",
  ferait: "faire",
  ferions: "faire",
  feriez: "faire",
  feraient: "faire",
  fasse: "faire",
  fasses: "faire",
  fassent: "faire",
  faisant: "faire",
  // pouvoir
  peux: "pouvoir",
  peut: "pouvoir",
  pouvons: "pouvoir",
  pouvez: "pouvoir",
  peuvent: "pouvoir",
  pouvais: "pouvoir",
  pouvait: "pouvoir",
  pouvions: "pouvoir",
  pouviez: "pouvoir",
  pouvaient: "pouvoir",
  pus: "pouvoir",
  put: "pouvoir",
  pûmes: "pouvoir",
  pûtes: "pouvoir",
  purent: "pouvoir",
  pourrai: "pouvoir",
  pourras: "pouvoir",
  pourra: "pouvoir",
  pourrons: "pouvoir",
  pourrez: "pouvoir",
  pourront: "pouvoir",
  pourrais: "pouvoir",
  pourrait: "pouvoir",
  pourrions: "pouvoir",
  pourriez: "pouvoir",
  pourraient: "pouvoir",
  puisse: "pouvoir",
  puisses: "pouvoir",
  puissent: "pouvoir",
  pu: "pouvoir",
  pouvant: "pouvoir",
  // vouloir
  veux: "vouloir",
  veut: "vouloir",
  voulons: "vouloir",
  voulez: "vouloir",
  veulent: "vouloir",
  voulais: "vouloir",
  voulait: "vouloir",
  voulions: "vouloir",
  vouliez: "vouloir",
  voulaient: "vouloir",
  voulus: "vouloir",
  voulut: "vouloir",
  voulûmes: "vouloir",
  voulûtes: "vouloir",
  voulurent: "vouloir",
  voudrai: "vouloir",
  voudras: "vouloir",
  voudra: "vouloir",
  voudrons: "vouloir",
  voudrez: "vouloir",
  voudront: "vouloir",
  voudrais: "vouloir",
  voudrait: "vouloir",
  voudrions: "vouloir",
  voudriez: "vouloir",
  voudraient: "vouloir",
  veuille: "vouloir",
  veuillent: "vouloir",
  voulu: "vouloir",
  voulue: "vouloir",
  voulus: "vouloir",
  voulues: "vouloir",
  // devoir
  dois: "devoir",
  doit: "devoir",
  devons: "devoir",
  devez: "devoir",
  doivent: "devoir",
  devais: "devoir",
  devait: "devoir",
  devions: "devoir",
  deviez: "devoir",
  devaient: "devoir",
  dus: "devoir",
  dut: "devoir",
  dûmes: "devoir",
  dûtes: "devoir",
  durent: "devoir",
  devrai: "devoir",
  devras: "devoir",
  devra: "devoir",
  devrons: "devoir",
  devrez: "devoir",
  devront: "devoir",
  devrais: "devoir",
  devrait: "devoir",
  devrions: "devoir",
  devriez: "devoir",
  devraient: "devoir",
  doive: "devoir",
  doivent: "devoir",
  dû: "devoir",
  due: "devoir",
  dus: "devoir",
  dues: "devoir",
  // savoir
  sais: "savoir",
  sait: "savoir",
  savons: "savoir",
  savez: "savoir",
  savent: "savoir",
  savais: "savoir",
  savait: "savoir",
  savions: "savoir",
  saviez: "savoir",
  savaient: "savoir",
  sus: "savoir",
  sut: "savoir",
  sûmes: "savoir",
  sûtes: "savoir",
  surent: "savoir",
  saurai: "savoir",
  sauras: "savoir",
  saura: "savoir",
  saurons: "savoir",
  saurez: "savoir",
  sauront: "savoir",
  saurais: "savoir",
  saurait: "savoir",
  saurions: "savoir",
  sauriez: "savoir",
  sauraient: "savoir",
  sache: "savoir",
  su: "savoir",
  // voir
  vois: "voir",
  voit: "voir",
  voyons: "voir",
  voyez: "voir",
  voient: "voir",
  voyais: "voir",
  voyait: "voir",
  voyions: "voir",
  voyiez: "voir",
  voyaient: "voir",
  vis: "voir",
  vit: "voir",
  vîmes: "voir",
  vîtes: "voir",
  virent: "voir",
  verrai: "voir",
  verras: "voir",
  verra: "voir",
  verrons: "voir",
  verrez: "voir",
  verront: "voir",
  verrais: "voir",
  verrait: "voir",
  verraient: "voir",
  vu: "voir",
  vue: "voir",
  vus: "voir",
  // prendre
  prends: "prendre",
  prend: "prendre",
  prenons: "prendre",
  prenez: "prendre",
  prennent: "prendre",
  prenais: "prendre",
  prenait: "prendre",
  prenaient: "prendre",
  pris: "prendre",
  prise: "prendre",
  prises: "prendre",
  prendrai: "prendre",
  prendras: "prendre",
  prendra: "prendre",
  prendront: "prendre",
  prendrait: "prendre",
  // venir
  viens: "venir",
  vient: "venir",
  venons: "venir",
  venez: "venir",
  viennent: "venir",
  venais: "venir",
  venait: "venir",
  venaient: "venir",
  venu: "venir",
  venue: "venir",
  venus: "venir",
  venues: "venir",
  viendrai: "venir",
  viendra: "venir",
  viendront: "venir",
  viendrait: "venir",
  // dire
  dis: "dire",
  dit: "dire",
  disons: "dire",
  dites: "dire",
  disent: "dire",
  disais: "dire",
  disait: "dire",
  disaient: "dire",
  dirai: "dire",
  dira: "dire",
  diront: "dire",
  // mettre
  mets: "mettre",
  met: "mettre",
  mettons: "mettre",
  mettez: "mettre",
  mettent: "mettre",
  mettais: "mettre",
  mettait: "mettre",
  mettaient: "mettre",
  mis: "mettre",
  mise: "mettre",
  mises: "mettre",
  mettrai: "mettre",
  mettra: "mettre",
  mettront: "mettre",
  mettrait: "mettre",
  // divers
  faut: "falloir",
  fallait: "falloir",
  faudra: "falloir",
  faudrait: "falloir",
  fallu: "falloir",
  crois: "croire",
  croit: "croire",
  croyons: "croire",
  croient: "croire",
  croyait: "croire",
  cru: "croire",
  écris: "écrire",
  écrit: "écrire",
  écrivons: "écrire",
  écrivent: "écrire",
  écrivait: "écrire",
  lis: "lire",
  lit: "lire",
  lisons: "lire",
  lisent: "lire",
  lisait: "lire",
  lu: "lire",
  ouvre: "ouvrir",
  ouvres: "ouvrir",
  ouvrent: "ouvrir",
  ouvrait: "ouvrir",
  ouvert: "ouvrir",
  reçois: "recevoir",
  reçoit: "recevoir",
  recevons: "recevoir",
  reçoivent: "recevoir",
  recevait: "recevoir",
  reçu: "recevoir",
};

function getLemmaCandidates(word) {
  const candidates = [];
  if (IRREGULAR_VERBS[word]) candidates.push(IRREGULAR_VERBS[word]);

  const prefixes = [
    "re",
    "dé",
    "com",
    "sur",
    "in",
    "im",
    "ap",
    "sou",
    "con",
    "pre",
    "par",
    "inter",
  ];
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
  if (word.endsWith("euses"))
    candidates.push(word.slice(0, -5) + "eur", word.slice(0, -5) + "eux");
  else if (word.endsWith("euse"))
    candidates.push(word.slice(0, -4) + "eur", word.slice(0, -4) + "eux");

  if (word.endsWith("trices")) candidates.push(word.slice(0, -6) + "teur");
  else if (word.endsWith("trice")) candidates.push(word.slice(0, -5) + "teur");

  if (word.endsWith("ières")) candidates.push(word.slice(0, -5) + "ier");
  else if (word.endsWith("ière")) candidates.push(word.slice(0, -4) + "ier");

  if (word.endsWith("iennes")) candidates.push(word.slice(0, -6) + "ien");
  else if (word.endsWith("ienne")) candidates.push(word.slice(0, -5) + "ien");

  if (word.endsWith("elles"))
    candidates.push(word.slice(0, -5) + "el", word.slice(0, -5) + "eau");
  else if (word.endsWith("elle"))
    candidates.push(word.slice(0, -4) + "el", word.slice(0, -4) + "eau");

  if (word.endsWith("ives")) candidates.push(word.slice(0, -4) + "if");
  else if (word.endsWith("ive")) candidates.push(word.slice(0, -3) + "if");

  if (word.endsWith("es") && word.length > 3) {
    candidates.push(word.slice(0, -2));
    candidates.push(word.slice(0, -1));
  }
  if (word.endsWith("e") && word.length > 3) {
    candidates.push(word.slice(0, -1));
  }

  // 3. Verb conjugations (1st group -er)
  const erEndings = [
    "erait",
    "eraient",
    "erions",
    "eriez",
    "erons",
    "erez",
    "eront",
    "erais",
    "assent",
    "asses",
    "âmes",
    "âtes",
    "èrent",
    "aient",
    "ions",
    "iez",
    "eras",
    "erai",
    "era",
    "ais",
    "ait",
    "ant",
    "ons",
    "ez",
    "ent",
    "ée",
    "és",
    "ées",
    "é",
    "e",
    "es",
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
    "issaient",
    "issions",
    "issiez",
    "issent",
    "issait",
    "issant",
    "issons",
    "issez",
    "irait",
    "iraient",
    "irions",
    "iriez",
    "irons",
    "irez",
    "iront",
    "irais",
    "ira",
    "irai",
    "iras",
    "it",
    "is",
    "i",
    "ie",
    "ies",
  ];
  for (const end of irEndings) {
    if (word.endsWith(end) && word.length > end.length + 2) {
      const stem = word.slice(0, -end.length);
      candidates.push(stem + "ir");
    }
  }

  const dreEndings = [
    "dent",
    "dait",
    "daient",
    "dons",
    "dez",
    "dra",
    "drait",
    "dront",
    "du",
    "due",
    "dus",
    "dues",
  ];
  for (const end of dreEndings) {
    if (word.endsWith(end) && word.length > end.length + 2) {
      candidates.push(word.slice(0, -end.length) + "dre");
    }
  }

  if (word.endsWith("ent") && word.length > 5) {
    const s = word.slice(0, -3);
    candidates.push(s + "ir", s + "re", s + "tre");
  }

  return [...new Set(candidates)];
}

function getShortTargetedContext(paragraphText, word) {
  if (!paragraphText) return "";
  const clean = paragraphText.replace(/\s+/g, " ").trim();
  const sentences = clean.split(/(?<=[.!?\n])\s+/).filter(Boolean);

  const cleanWord = (word || "").trim().toLowerCase();
  let sentence =
    sentences.find((s) => {
      const regex = new RegExp(
        `(^|[^a-zA-ZÀ-ÿœŒæÆ])${cleanWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-zA-ZÀ-ÿœŒæÆ]|$)`,
        "i",
      );
      return regex.test(s);
    }) ||
    sentences.find((s) => s.toLowerCase().includes(cleanWord)) ||
    sentences[0] ||
    clean;

  // If a sentence is very long (> 22 words) with clear clause breaks like ;, :, or dash, keep the clause with the word
  if (sentence.split(/\s+/).length > 22) {
    const subParts = sentence.split(/[;:—–]\s*/).filter(Boolean);
    const partWithWord = subParts.find((p) =>
      p.toLowerCase().includes(cleanWord),
    );
    if (partWithWord && partWithWord.split(/\s+/).length >= 4) {
      sentence = partWithWord;
    }
  }

  return sentence.trim();
}

function repositionPopup(rect) {
  if (!rect || !dictPopup) return;

  const popupWidth = dictPopup.offsetWidth || 200;
  const popupHeight = dictPopup.offsetHeight || 75;
  const scrollY = window.scrollY || window.pageYOffset || 0;
  const scrollX = window.scrollX || window.pageXOffset || 0;
  const winWidth = window.innerWidth || document.documentElement.clientWidth;
  const winHeight = window.innerHeight || document.documentElement.clientHeight;

  // 1. Horizontal: clamp so it never exits the screen on left or right
  const paddingX = 12;
  let leftPos = rect.left + scrollX + rect.width / 2;
  const minLeft = scrollX + paddingX + popupWidth / 2;
  const maxLeft = scrollX + winWidth - paddingX - popupWidth / 2;
  if (leftPos < minLeft) leftPos = minLeft;
  if (leftPos > maxLeft) leftPos = maxLeft;

  // 2. Arrow offset: points at center of selected word
  const wordCenterScreenX = rect.left + rect.width / 2;
  const popupLeftScreenX = leftPos - scrollX - popupWidth / 2;
  let arrowPercent =
    ((wordCenterScreenX - popupLeftScreenX) / popupWidth) * 100;
  arrowPercent = Math.max(12, Math.min(88, arrowPercent));
  dictPopup.style.setProperty("--arrow-x", `${arrowPercent}%`);

  // 3. Vertical: avoid top bar (55px) and bottom nav / audio panel (75px)
  const topSafety = 55;
  const bottomSafety = 75;
  const spaceAbove = rect.top - topSafety;
  const spaceBelow = winHeight - rect.bottom - bottomSafety;

  let topPos = 0;
  if (spaceAbove >= popupHeight + 8) {
    // Place ABOVE
    topPos = rect.top + scrollY - popupHeight - 8;
    dictPopup.classList.remove("arrow-top");
  } else if (spaceBelow >= popupHeight + 8) {
    // Place BELOW
    topPos = rect.bottom + scrollY + 8;
    dictPopup.classList.add("arrow-top");
  } else {
    // Very tight screen: place where there is more room and clamp within viewport
    if (spaceAbove >= spaceBelow) {
      topPos = Math.max(
        scrollY + topSafety + 5,
        rect.top + scrollY - popupHeight - 8,
      );
      dictPopup.classList.remove("arrow-top");
    } else {
      topPos = Math.min(
        scrollY + winHeight - bottomSafety - popupHeight - 5,
        rect.bottom + scrollY + 8,
      );
      dictPopup.classList.add("arrow-top");
    }
  }

  dictPopup.style.left = `${leftPos}px`;
  dictPopup.style.top = `${topPos}px`;
}

const DictionaryService = {
  db: null,
  isLoaded: false,
  sentenceCache: new Map(),

  async init() {
    try {
      console.log("Loading offline dictionary...");
      const res = await fetch("assets/dict.json");
      this.db = await res.json();
      this.isLoaded = true;
      console.log(
        "Offline dictionary loaded successfully. Total keys:",
        Object.keys(this.db).length,
      );
    } catch (e) {
      console.error("Failed to load offline dictionary", e);
    }
  },

  async lookupWord(word, surroundingSentence) {
    let cleanWord = word
      .toLowerCase()
      .replace(/[.,!?:;"'()[\]«»„“”]/g, "")
      .trim();
    cleanWord = cleanWord.replace(
      /^(l['’]|d['’]|qu['’]|j['’]|m['’]|t['’]|s['’]|n['’]|c['’]|ç['’])/,
      "",
    );

    let matchedWord = cleanWord;
    let entries = null;

    if (this.isLoaded && this.db) {
      if (this.db[cleanWord]) {
        entries = this.db[cleanWord];
        matchedWord = cleanWord;
      } else {
        const candidates = getLemmaCandidates(cleanWord);
        for (const cand of candidates) {
          if (this.db[cand]) {
            entries = this.db[cand];
            matchedWord = cand;
            break;
          }
        }
      }
    }

    // Concise Japanese Definition: 1 line, e.g. "絵画、図表"
    let conciseDef = "";
    let posTags = [];

    if (entries && entries.length > 0) {
      const jpWords = [];
      for (const entry of entries) {
        const term = (
          entry.k && entry.k.length > 0
            ? entry.k[0]
            : entry.r && entry.r.length > 0
              ? entry.r[0]
              : ""
        ).trim();
        const cleanTerm = term.replace(/[\(（].*?[\)）]/g, "").trim();
        if (cleanTerm && !jpWords.includes(cleanTerm)) {
          jpWords.push(cleanTerm);
        }
        if (entry.p) posTags.push(...entry.p);
      }
      conciseDef = jpWords.slice(0, 3).join("、");
    }

    posTags = [...new Set(posTags)];
    let nature = posTags.length > 0 ? posTags[0] : conciseDef ? "名詞" : "単語";

    // Complete, grammatically sound context sentence
    let targetSentence = getShortTargetedContext(surroundingSentence, word);
    let traductionPhrase = "";

    if (targetSentence && targetSentence.length > 0) {
      // 1. Instant cache lookup
      if (
        DictionaryService.sentenceCache &&
        DictionaryService.sentenceCache.has(targetSentence)
      ) {
        traductionPhrase = DictionaryService.sentenceCache.get(targetSentence);
      }

      // 2. High-quality cloud neural translation (Google Translate API - natural native Japanese)
      if (!traductionPhrase) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1800);
          const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=fr&tl=ja&dt=t&q=${encodeURIComponent(targetSentence)}`;
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            traductionPhrase = data[0]
              .map((item) => item[0])
              .join("")
              .trim();
            if (traductionPhrase && DictionaryService.sentenceCache) {
              DictionaryService.sentenceCache.set(
                targetSentence,
                traductionPhrase,
              );
            }
          }
        } catch (netErr) {
          // Network offline or timeout -> fall back to offline ML Kit
        }
      }

      // 3. Offline fallback to on-device ML Kit
      if (!traductionPhrase) {
        try {
          if (
            window.Capacitor &&
            window.Capacitor.Plugins &&
            window.Capacitor.Plugins.Translation
          ) {
            const result = await window.Capacitor.Plugins.Translation.translate(
              {
                text: targetSentence,
                sourceLanguage: "fr",
                targetLanguage: "ja",
              },
            );
            if (result && result.text) {
              traductionPhrase = result.text.trim();
            } else if (result && result.translatedText) {
              traductionPhrase = result.translatedText.trim();
            }
            if (traductionPhrase && DictionaryService.sentenceCache) {
              DictionaryService.sentenceCache.set(
                targetSentence,
                traductionPhrase,
              );
            }
          }
        } catch (mlErr) {
          console.warn("ML Kit offline translation error", mlErr);
        }
      }
    }

    if (!traductionPhrase) {
      traductionPhrase = conciseDef ? conciseDef : "（文脈翻訳なし）";
    }

    return {
      mot: matchedWord,
      originalWord: word,
      matchedLemma: matchedWord !== cleanWord ? matchedWord : null,
      conciseDef: conciseDef,
      phraseOriginale: shortContextSentence,
      traductionPhrase: traductionPhrase,
      nature: nature,
      definitions: [conciseDef].filter(Boolean),
    };
  },
};

const DATA_URL = "https://kohaiducode.github.io/furago-data/articles.json";

// Polyfill pour éviter les crashs si speechSynthesis n'est pas supporté (ex: certains WebViews Android)
if (typeof window.speechSynthesis === "undefined") {
  window.speechSynthesis = {
    getVoices: () => [],
    speak: async (utterance) => {
      if (
        window.Capacitor &&
        window.Capacitor.Plugins &&
        window.Capacitor.Plugins.TextToSpeech
      ) {
        try {
          if (utterance.onstart) utterance.onstart();
          let opts = {
            text: utterance.text,
            lang: utterance.lang || "fr-FR",
            rate: utterance.rate || 1.0,
          };
          if (utterance.voice && utterance.voice._originalIndex !== undefined) {
            opts.voice = utterance.voice._originalIndex;
          }
          await window.Capacitor.Plugins.TextToSpeech.speak(opts);
          if (utterance.onend) utterance.onend();
        } catch (e) {
          console.error("TTS Plugin Error:", e);
          if (utterance.onerror) utterance.onerror(e);
          if (utterance.onend) utterance.onend();
        }
      } else {
        if (utterance.onend) utterance.onend();
      }
    },
    cancel: async () => {
      if (
        window.Capacitor &&
        window.Capacitor.Plugins &&
        window.Capacitor.Plugins.TextToSpeech
      ) {
        await window.Capacitor.Plugins.TextToSpeech.stop();
      }
    },
    pause: () => {},
    resume: () => {},
    onvoiceschanged: null,
  };
}
if (typeof window.SpeechSynthesisUtterance === "undefined") {
  window.SpeechSynthesisUtterance = function (text) {
    this.text = text;
    this.lang = "fr-FR";
    this.rate = 1;
    this.pitch = 1;
    this.volume = 1;
    this.voice = null;
    this.onend = null;
    this.onerror = null;
    this.onstart = null;
    this.onboundary = null;
  };
}
// État Global
let currentArticles = [];
let categories = new Set();
let globalLevel = "A1";
let selectedCategories = [];
let currentArticleData = null;

// État Audio
let currentQueueIndex = 0;
let ttsQueue = [];
let currentUtterance = null;
let isPlaying = false;
let isPaused = false;
let preferredVoice = null;

// État Quiz
let currentQuizData = [];
let currentQuizIndex = 0;
let currentQuizScore = 0;

// Icônes SVG
const iconPlay = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
const iconPause = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;

// Éléments DOM
const loader = document.getElementById("loader");
const homeView = document.getElementById("home-view");
const readingView = document.getElementById("reading-view");
const navArticles = document.getElementById("nav-articles");
const wordListView = document.getElementById("word-list-view");
const navWords = document.getElementById("nav-words");
const backBtn = document.getElementById("back-btn");
const articleList = document.getElementById("article-list");
const globalLevelBtn = document.getElementById("global-level-btn");
const globalCategoryBtn = document.getElementById("global-category-btn");
const filterModal = document.getElementById("filter-selector-modal");
const filterModalBody = document.getElementById("filter-modal-body");
const filterModalTitle = document.getElementById("filter-modal-title");
const filterOptionsContainer = document.getElementById(
  "filter-options-container",
);

// DOM Lecture
const articleHero = document.getElementById("article-hero");
const articleImage = document.getElementById("article-image");
const articleTitle = document.getElementById("article-title");
const articleMeta = document.getElementById("article-meta");
const articleContent = document.getElementById("article-content");
const quizSection = document.getElementById("quiz-section");
const quizContainer = document.getElementById("quiz-container");

const btnPlayPause = document.getElementById("btn-play-pause");
const btnRestart = document.getElementById("btn-restart");
const btnPrevSentence = document.getElementById("btn-prev-sentence");
const btnNextSentence = document.getElementById("btn-next-sentence");
const audioSpeedSelect = document.getElementById("audio-speed-select");
const audioVoiceSelect = document.getElementById("audio-voice-select");
let allLocalFrVoices = [];

// 1. Initialisation
async function initApp() {
  initVoices();
  DictionaryService.init();
  try {
    const response = await fetch(DATA_URL);
    const data = await response.json();

    currentArticles = data.articles.filter(
      (a) => Object.keys(a.levels).length > 0,
    );

    // Sort articles by date descending (newest first)
    currentArticles.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });

    currentArticles.forEach((a) => {
      if (a.category) categories.add(a.category.trim());
    });

    selectedCategories = Array.from(categories);
    globalCategoryBtn.textContent = "カテゴリー";

    renderHome();
  } catch (error) {
    console.error(error);
    alert("Google Sheetsとの接続エラーが発生しました。");
  }
}

// 2. Gestion des voix de synthèse
function initVoices() {
  const loadVoices = async () => {
    let voices =
      window.speechSynthesis && window.speechSynthesis.getVoices
        ? window.speechSynthesis.getVoices()
        : [];
    voices.forEach((v, i) => (v._originalIndex = i));

    if (
      window.Capacitor &&
      window.Capacitor.Plugins &&
      window.Capacitor.Plugins.TextToSpeech
    ) {
      try {
        const res =
          await window.Capacitor.Plugins.TextToSpeech.getSupportedVoices();
        if (res && res.voices) voices = res.voices;
        voices.forEach((v, i) => (v._originalIndex = i));
      } catch (e) {
        console.error(e);
      }
    }

    if (voices.length === 0) {
      setTimeout(loadVoices, 500);
      return;
    }

    allLocalFrVoices = voices.filter((v) => {
      const l = (v.lang || "").toLowerCase();
      const n = (v.name || "").toLowerCase();
      if (
        l.includes("fr-ca") ||
        l.includes("canada") ||
        n.includes("canada") ||
        n.includes("canadien")
      )
        return false;
      // Retire les voix réseau (souvent des doublons des voix locales)
      if (n.includes("network") || n.includes("réseau")) return false;
      return l.startsWith("fr");
    });

    // Dédoublonnage basé sur l'identifiant de la voix
    const uniqueVoices = [];
    const seenUris = new Set();
    allLocalFrVoices.forEach((v) => {
      let identifier = (v.voiceURI || v.name || "")
        .toLowerCase()
        .replace(/-local/g, "")
        .replace(/-network/g, "")
        .trim();
      if (!seenUris.has(identifier)) {
        seenUris.add(identifier);
        uniqueVoices.push(v);
      }
    });
    allLocalFrVoices = uniqueVoices;

    if (audioVoiceSelect) {
      audioVoiceSelect.innerHTML = "";
      if (allLocalFrVoices.length === 0) {
        audioVoiceSelect.innerHTML =
          '<option value="">Voix par défaut</option>';
      } else {
        let femaleNames = ["Sophie", "Camille", "Léa", "Alice", "Emma"];
        let maleNames = ["Thomas", "Lucas", "Hugo", "Paul", "Arthur"];
        let fIdx = 0;
        let mIdx = 0;

        allLocalFrVoices.forEach((v, index) => {
          // Retire la voix d'Alice (index 5) car c'est un doublon
          if (index === 5) return;

          const option = document.createElement("option");
          option.value = index;

          let identifier = (v.voiceURI || v.name || "").toLowerCase();
          let isFemale = false;
          let isMale = false;

          if (/vlf|vld|vla|fra|frc|female|femme/i.test(identifier)) {
            isFemale = true;
          } else if (/vle|vlc|vlb|frb|frd|male|homme/i.test(identifier)) {
            isMale = true;
          } else {
            // Fallback basé sur votre retour exact
            if (index === 0 || index === 1 || index === 3 || index === 5) {
              isFemale = true;
            } else {
              isMale = true;
            }
          }

          let displayName = "";
          if (isFemale) {
            displayName = `(女) ${femaleNames[fIdx % femaleNames.length]}`;
            fIdx++;
          } else {
            displayName = `(男) ${maleNames[mIdx % maleNames.length]}`;
            mIdx++;
          }

          option.textContent = displayName;
          audioVoiceSelect.appendChild(option);
        });

        if (!preferredVoice) {
          preferredVoice = allLocalFrVoices[0];
        }
      }
    }
  };
  loadVoices();
  if (
    window.speechSynthesis &&
    window.speechSynthesis.onvoiceschanged !== undefined
  ) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}

if (audioVoiceSelect) {
  audioVoiceSelect.addEventListener("change", (e) => {
    preferredVoice = allLocalFrVoices[e.target.value];
    if (isPlaying) {
      isPaused = false;
      isPlaying = false;
      if (window.speechSynthesis && window.speechSynthesis.cancel)
        window.speechSynthesis.cancel();
      setTimeout(() => {
        playAudio(currentQueueIndex);
      }, 100);
    }
  });
}

// 3. Événements des Filtres (Modal)
function openFilterModal(type) {
  filterOptionsContainer.innerHTML = "";
  filterModal.classList.remove("hidden");

  // Animation d'entrée
  setTimeout(() => {
    filterModalBody.style.transform = "translateY(0)";
  }, 10);

  const closeFilter = () => {
    filterModalBody.style.transform = "translateY(100%)";
    setTimeout(() => filterModal.classList.add("hidden"), 300);
  };

  filterModal.onclick = (e) => {
    if (e.target === filterModal) closeFilter();
  };

  if (type === "level") {
    filterModalTitle.textContent = "レベルを選ぶ";
    filterOptionsContainer.classList.remove("filter-grid");
    const levels = ["A1", "A2", "B1", "B2", "C1"];
    levels.forEach((level) => {
      const btn = document.createElement("button");
      btn.className = "quiz-option"; // On réutilise le style des boutons quiz
      btn.style.textAlign = "center";
      if (globalLevel === level) {
        btn.style.borderColor = "var(--primary)";
        btn.style.background = "var(--primary-light)";
      }
      btn.textContent = `レベル ${level}`;
      btn.onclick = () => {
        globalLevel = level;
        globalLevelBtn.textContent = `レベル ${level}`;
        renderHome();
        closeFilter();
      };
      filterOptionsContainer.appendChild(btn);
    });
  } else if (type === "category") {
    filterModalTitle.textContent = "カテゴリーを選ぶ";
    filterOptionsContainer.classList.add("filter-grid");

    const cats = Array.from(categories);
    cats.forEach((cat) => {
      const btn = document.createElement("button");
      btn.className = "quiz-option";
      btn.style.textAlign = "center";

      const updateStyle = () => {
        if (selectedCategories.includes(cat)) {
          btn.style.borderColor = "var(--primary)";
          btn.style.background = "var(--primary-light)";
        } else {
          btn.style.borderColor = "#E5E5EA";
          btn.style.background = "var(--surface)";
        }
      };

      updateStyle();
      btn.textContent = cat;

      btn.onclick = () => {
        if (selectedCategories.includes(cat)) {
          if (selectedCategories.length > 1) {
            selectedCategories = selectedCategories.filter((c) => c !== cat);
          }
        } else {
          selectedCategories.push(cat);
        }
        updateStyle();

        if (selectedCategories.length === categories.size) {
          globalCategoryBtn.textContent = "カテゴリー";
        } else {
          globalCategoryBtn.textContent = `カテゴリー (${selectedCategories.length})`;
        }

        renderHome();
      };
      filterOptionsContainer.appendChild(btn);
    });
  }
}

globalLevelBtn.addEventListener("click", () => openFilterModal("level"));
globalCategoryBtn.addEventListener("click", () => openFilterModal("category"));

// 4. Afficher la liste filtrée
function renderHome() {
  loader.classList.add("hidden");
  readingView.classList.add("hidden");
  backBtn.classList.add("hidden");
  homeView.classList.remove("hidden");

  articleList.innerHTML = "";

  const filteredArticles = currentArticles.filter((article) => {
    if (!selectedCategories.includes(article.category.trim())) return false;
    if (!article.levels[globalLevel]) return false;
    return true;
  });

  if (filteredArticles.length === 0) {
    articleList.innerHTML =
      '<p style="text-align:center; padding:40px 20px; color:#8E8E93;">条件に一致する記事は見つかりませんでした。</p>';
    return;
  }

  filteredArticles.forEach((article, index) => {
    const levelData = article.levels[globalLevel];
    const displayTitle = levelData.title;

    // Convertir automatiquement les liens Google Drive en liens d'image directs
    let finalImageUrl = article.imageUrl ? article.imageUrl.trim() : "";
    const driveRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
    if (finalImageUrl.match(driveRegex)) {
      finalImageUrl = `https://drive.google.com/thumbnail?id=${finalImageUrl.match(driveRegex)[1]}&sz=w1000`;
    }

    const li = document.createElement("li");
    li.className =
      "article-card fade-in " + (index === 0 ? "hero-format" : "list-format");
    li.style.animationDelay = `${index * 0.05}s`;
    li.style.opacity = "0"; // Assure que c'est invisible avant l'animation

    const imgHtml = finalImageUrl
      ? `<div class="article-image-container"><img src="${finalImageUrl}" alt=""></div>`
      : "";

    const dateFormatted = article.date
      ? new Date(article.date).toLocaleDateString("ja-JP")
      : "";
    const dateHtml = dateFormatted
      ? `<span style="color:#8E8E93; font-size: 0.8rem; margin-left: auto;">${dateFormatted}</span>`
      : "";

    li.innerHTML = `
            ${imgHtml}
            <div class="article-card-content">
                <h3 style="margin-bottom: 8px;">${displayTitle}</h3>
                <p class="meta" style="display:flex; align-items:center; gap:6px; margin: 0;">
                    <span class="badge">${globalLevel}</span> 
                    <span class="badge" style="background:#F2F2F7; color:#8E8E93;">${article.category || "一般"}</span>
                    ${dateHtml}
                </p>
            </div>
        `;
    li.addEventListener("click", () => openArticle(article, levelData));
    articleList.appendChild(li);
  });
}

// 5. Ouvrir l'article
function openArticle(article, levelData) {
  document.querySelector(".bottom-nav").classList.add("hidden");
  document.getElementById("audio-panel").classList.add("visible");
  currentArticleData = levelData;
  homeView.classList.add("hidden");
  readingView.classList.remove("hidden");
  backBtn.classList.remove("hidden");
  window.scrollTo(0, 0);

  // Précharger les modèles de traduction ML Kit (silencieux)
  if (typeof preloadMLKitModels === "function") preloadMLKitModels();

  // Réinitialiser Audio
  if (window.speechSynthesis && window.speechSynthesis.cancel)
    window.speechSynthesis.cancel();
  isPlaying = false;
  isPaused = false;
  currentQueueIndex = 0;
  ttsQueue = [];
  updateAudioButtonUI();

  // Convertir automatiquement les liens Google Drive en liens d'image directs
  let finalImageUrl = article.imageUrl ? article.imageUrl.trim() : "";
  const driveRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
  if (finalImageUrl.match(driveRegex)) {
    finalImageUrl = `https://drive.google.com/thumbnail?id=${finalImageUrl.match(driveRegex)[1]}&sz=w1000`;
  }

  if (finalImageUrl) {
    articleImage.src = finalImageUrl;
    articleHero.style.display = "block";
  } else {
    articleHero.style.display = "none";
  }

  articleTitle.textContent = levelData.title;
  const dateFormatted = article.date
    ? new Date(article.date).toLocaleDateString("ja-JP")
    : "";
  const dateHtml = dateFormatted
    ? `<span style="color:#8E8E93; font-size: 0.85rem; margin-left: auto;">${dateFormatted}</span>`
    : "";
  articleMeta.style.display = "flex";
  articleMeta.style.alignItems = "center";
  articleMeta.style.gap = "8px";
  articleMeta.style.marginTop = "12px";
  articleMeta.innerHTML = `<span class="badge" style="font-size:0.9rem;">${globalLevel}</span> <span class="badge" style="background:#F2F2F7; color:#8E8E93; font-size:0.9rem;">${article.category || "一般"}</span>${dateHtml}`;

  // Rendu initial sans surlignage
  renderArticleHTML(levelData.content, -1, 0);

  startQuiz(levelData.quiz);
}

// Fonction utilitaire pour générer le HTML de l'article avec ou sans surlignage
function renderArticleHTML(text, highlightStart = -1, highlightLength = 0) {
  if (!text) return;
  let html = "";
  let currentIndex = 0;

  const paragraphs = text.split("\n");

  paragraphs.forEach((pText) => {
    if (pText.trim() === "") {
      currentIndex += pText.length + 1; // +1 pour le retour à la ligne
      return;
    }

    const pStart = currentIndex;
    const pEnd = currentIndex + pText.length;

    if (highlightStart >= pStart && highlightStart < pEnd) {
      // Le surlignage se trouve dans ce paragraphe
      const localStart = highlightStart - pStart;
      const localLength = highlightLength;

      const before = pText.substring(0, localStart);
      const hl = pText.substring(localStart, localStart + localLength);
      const after = pText.substring(localStart + localLength);

      html += `<p>${before}<span class="tts-highlight">${hl}</span>${after}</p>`;
    } else {
      html += `<p>${pText}</p>`;
    }

    currentIndex += pText.length + 1;
  });

  articleContent.innerHTML = html;
}

// 6. Gestion du Quiz (Question par Question)
function startQuiz(quizArray) {
  quizContainer.innerHTML = "";
  if (!quizArray || quizArray.length === 0) {
    quizSection.classList.add("hidden");
    return;
  }

  quizSection.classList.remove("hidden");
  currentQuizData = quizArray;
  currentQuizIndex = 0;
  currentQuizScore = 0;

  renderCurrentQuizQuestion();
}

function renderCurrentQuizQuestion() {
  quizContainer.innerHTML = "";

  // Si toutes les questions sont répondues -> Afficher le score
  if (currentQuizIndex >= currentQuizData.length) {
    const total = currentQuizData.length;
    // Déterminer le message
    let msg = "もう一度挑戦しよう！"; // "Retente ta chance"
    if (currentQuizScore === total)
      msg = "素晴らしい！"; // "Bravo!"
    else if (currentQuizScore >= total / 2) msg = "よくできました！"; // "Bien joué"

    quizContainer.innerHTML = `
            <div class="quiz-card fade-in" style="text-align:center;">
                <h4 style="font-size:1.8rem; margin-bottom:12px; color:var(--primary);">スコア: ${currentQuizScore} / ${total}</h4>
                <p style="font-size:1.2rem; color:var(--text-main); font-weight:bold; margin-bottom: 24px;">${msg}</p>
                <button id="btn-retry-quiz" style="background:var(--primary); color:white; border:none; padding:12px 24px; border-radius:12px; font-weight:bold; cursor:pointer;">もう一度やる</button>
            </div>
        `;
    document.getElementById("btn-retry-quiz").addEventListener("click", () => {
      currentQuizIndex = 0;
      currentQuizScore = 0;
      renderCurrentQuizQuestion();
    });
    return;
  }

  // Afficher la question courante
  const q = currentQuizData[currentQuizIndex];
  const qDiv = document.createElement("div");
  qDiv.className = "quiz-card fade-in";

  qDiv.innerHTML = `
        <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:8px; font-weight:bold;">質問 ${currentQuizIndex + 1} / ${currentQuizData.length}</p>
        <p class="quiz-question">${q.text}</p>
    `;

  const optionsList = document.createElement("div");

  ["A", "B", "C", "D"].forEach((key) => {
    if (!q.options[key]) return;
    const btn = document.createElement("button");
    btn.className = "quiz-option";
    btn.textContent = `${key}. ${q.options[key]}`;

    btn.addEventListener("click", () => {
      // Empêcher les autres clics
      Array.from(optionsList.children).forEach((b) => (b.disabled = true));

      const isCorrect = key === q.answer.trim().toUpperCase();
      if (isCorrect) {
        btn.classList.add("correct");
        currentQuizScore++;
      } else {
        btn.classList.add("incorrect");
        // Illuminer la bonne réponse
        Array.from(optionsList.children).forEach((b) => {
          if (b.textContent.startsWith(q.answer.trim().toUpperCase())) {
            b.classList.add("correct");
          }
        });
      }

      // Animation et texte de feedback
      const feedback = document.createElement("div");
      feedback.className = "quiz-feedback-text";
      if (isCorrect) {
        feedback.classList.add("text-correct");
        feedback.textContent = "⭕ 正解！"; // Bonne réponse
      } else {
        feedback.classList.add("text-incorrect");
        feedback.textContent = "❌ 不正解..."; // Mauvaise réponse
      }
      qDiv.appendChild(feedback);

      // Attendre 2 secondes puis passer à la question suivante
      setTimeout(() => {
        currentQuizIndex++;
        renderCurrentQuizQuestion();
      }, 2000);
    });
    optionsList.appendChild(btn);
  });
  qDiv.appendChild(optionsList);
  quizContainer.appendChild(qDiv);
}

// 7. Lecteur Audio avec file d'attente (TTS Queue)
const audioPanel = document.getElementById("audio-panel");
const btnCloseAudio = document.getElementById("btn-close-audio");
const audioProgressBar = document.getElementById("audio-progress-bar");

function buildTtsQueue(text) {
  ttsQueue = [];
  let currentIndex = 0;
  const regex = /[^.!?\n]+[.!?\n]*\s*/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match[0].trim().length > 0) {
      ttsQueue.push({
        text: match[0],
        start: currentIndex,
        length: match[0].length,
      });
    }
    currentIndex += match[0].length;
  }
}

function updateAudioButtonUI() {
  if (isPlaying && !isPaused) {
    btnPlayPause.innerHTML = `${iconPause}`;
    btnPlayPause.style.background = "#FF9500";
    btnPlayPause.style.color = "#FFFFFF";
  } else if (isPaused) {
    btnPlayPause.innerHTML = `${iconPlay}`;
    btnPlayPause.style.background = "#34C759";
    btnPlayPause.style.color = "#FFFFFF";
  } else {
    btnPlayPause.innerHTML = `${iconPlay}`;
    btnPlayPause.style.background = "#5E5CE6";
    btnPlayPause.style.color = "#FFFFFF";
  }

  // Update progress bar
  if (ttsQueue.length > 0) {
    const progress = (currentQueueIndex / ttsQueue.length) * 100;
    audioProgressBar.style.width = `${progress}%`;
  } else {
    audioProgressBar.style.width = `0%`;
  }
}

function playNextInQueue() {
  if (!isPlaying || isPaused) return;

  if (currentQueueIndex >= ttsQueue.length) {
    isPlaying = false;
    isPaused = false;
    currentQueueIndex = 0;
    updateAudioButtonUI();
    if (currentArticleData)
      renderArticleHTML(currentArticleData.content, -1, 0);
    return;
  }

  const item = ttsQueue[currentQueueIndex];
  updateAudioButtonUI();

  if (currentArticleData)
    renderArticleHTML(currentArticleData.content, item.start, item.length);

  currentUtterance = new SpeechSynthesisUtterance(item.text);
  if (preferredVoice) currentUtterance.voice = preferredVoice;
  currentUtterance.lang = "fr-FR";
  currentUtterance.rate = parseFloat(audioSpeedSelect.value);

  // Surlignage synchrone immédiat (au cas où onstart bug sur Android)
  if (currentArticleData)
    renderArticleHTML(currentArticleData.content, item.start, item.length);

  currentUtterance.onstart = () => {
    // Surligne toute la phrase par défaut au début
    if (currentArticleData)
      renderArticleHTML(currentArticleData.content, item.start, item.length);
  };

  currentUtterance.onboundary = (e) => {
    // Surligne mot par mot pendant la lecture (si supporté par le téléphone)
    if (e.name === "word") {
      const textRemaining = item.text.substring(e.charIndex);
      const match = textRemaining.match(/^[a-zA-ZÀ-ÿœŒæÆ]+/);
      const wordLength = match ? match[0].length : 1;
      if (currentArticleData) {
        renderArticleHTML(
          currentArticleData.content,
          item.start + e.charIndex,
          wordLength,
        );
      }
    }
  };

  currentUtterance.onend = () => {
    if (isPlaying && !isPaused) {
      currentQueueIndex++;
      playNextInQueue();
    }
  };

  currentUtterance.onerror = (e) => {
    console.error("TTS Error:", e);
    isPlaying = false;
    isPaused = false;
    updateAudioButtonUI();
    if (currentArticleData)
      renderArticleHTML(currentArticleData.content, -1, 0);
  };

  if (window.speechSynthesis && window.speechSynthesis.speak)
    window.speechSynthesis.speak(currentUtterance);
}

function playAudio(startIndex = -1) {
  if (startIndex !== -1) {
    currentQueueIndex = startIndex;
  }

  if (isPaused) {
    isPaused = false;
    isPlaying = true;
    updateAudioButtonUI();
    playNextInQueue();
    return;
  }

  if (window.speechSynthesis && window.speechSynthesis.cancel)
    window.speechSynthesis.cancel();

  if (!currentArticleData || !currentArticleData.content) return;

  if (ttsQueue.length === 0) {
    buildTtsQueue(currentArticleData.content);
  }

  isPlaying = true;
  isPaused = false;
  updateAudioButtonUI();
  playNextInQueue();
}

function pauseAudio() {
  isPaused = true;
  isPlaying = false;
  if (window.speechSynthesis && window.speechSynthesis.cancel)
    window.speechSynthesis.cancel();
  updateAudioButtonUI();
}

btnPlayPause.addEventListener("click", () => {
  if (isPlaying && !isPaused) {
    pauseAudio();
  } else {
    playAudio();
  }
});

btnRestart.addEventListener("click", () => {
  isPaused = false;
  isPlaying = false;
  currentQueueIndex = 0;
  if (window.speechSynthesis && window.speechSynthesis.cancel)
    window.speechSynthesis.cancel();
  if (currentArticleData) renderArticleHTML(currentArticleData.content, -1, 0);
  setTimeout(() => {
    playAudio();
  }, 100);
});

audioSpeedSelect.addEventListener("change", () => {
  if (isPlaying) {
    isPaused = false;
    isPlaying = false;
    if (window.speechSynthesis && window.speechSynthesis.cancel)
      window.speechSynthesis.cancel();
    setTimeout(() => {
      playAudio(currentQueueIndex);
    }, 100);
  }
});

// UI Bottom Sheet

// Bouton Retour
backBtn.addEventListener("click", () => {
  document.querySelector(".bottom-nav").classList.remove("hidden");
  audioPanel.classList.remove("visible");
  if (window.speechSynthesis && window.speechSynthesis.cancel)
    window.speechSynthesis.cancel();
  if (currentArticleData) renderArticleHTML(currentArticleData.content, -1, 0);
  renderHome();
});

// Lancement

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

// Gestion du bouton retour physique (Android)
if (
  window.Capacitor &&
  window.Capacitor.Plugins &&
  window.Capacitor.Plugins.App
) {
  window.Capacitor.Plugins.App.addListener("backButton", () => {
    if (!readingView.classList.contains("hidden")) {
      if (window.speechSynthesis && window.speechSynthesis.cancel)
        window.speechSynthesis.cancel();
      if (currentArticleData)
        renderArticleHTML(currentArticleData.content, -1, 0);
      document.querySelector(".bottom-nav").classList.remove("hidden");
      audioPanel.classList.remove("visible");
      renderHome();
    } else {
      window.Capacitor.Plugins.App.exitApp();
    }
  });
}

// -----------------------------------------------------
// Dictionnaire Interactif (Surlignage)
// -----------------------------------------------------
const dictPopup = document.getElementById("dict-popup");
const dictWord = document.getElementById("dict-word");
const dictTranslation = document.getElementById("dict-translation");
const dictAudioBtn = document.getElementById("dict-audio-btn");

let currentDictText = "";
const translationCache = new Map(); // Cache pour mémoriser les traductions

// --- GESTION DU CLIC / TAP SIMPLE SUR UN MOT ---
let tapStartX = 0;
let tapStartY = 0;

document.addEventListener("pointerdown", (e) => {
  tapStartX = e.clientX;
  tapStartY = e.clientY;

  if (
    dictPopup &&
    !dictPopup.contains(e.target) &&
    !e.target.closest(".tap-word")
  ) {
    dictPopup.classList.add("hidden");
  }
});

document.addEventListener("pointerup", (e) => {
  if (readingView.classList.contains("hidden")) return;
  if (dictPopup && dictPopup.contains(e.target)) return;

  // Si l'utilisateur a fait défiler l'écran de plus de 10 pixels, on annule le Tap
  if (
    Math.abs(e.clientX - tapStartX) > 10 ||
    Math.abs(e.clientY - tapStartY) > 10
  ) {
    return;
  }

  let targetElement = e.target;
  if (targetElement && targetElement.nodeType === 3)
    targetElement = targetElement.parentElement;

  let wordElement = targetElement
    ? targetElement.closest
      ? targetElement.closest(".tap-word")
      : null
    : null;

  if (wordElement) {
    if (e.cancelable) e.preventDefault();
    let text = wordElement.textContent.trim();
    let rect = wordElement.getBoundingClientRect();

    const paragraphText = wordElement.parentElement.textContent || "";
    const sentences = paragraphText.split(/(?<=[.!?])\s+/);
    let surroundingSentence =
      sentences.find((s) => s.includes(text)) || paragraphText;

    showDictionaryPopup(text, surroundingSentence, rect);
  }
});

// Gérer la sélection manuelle de texte (Glisser ou Appui long)
// On utilise selectionchange qui est beaucoup plus fiable sur mobile
document.addEventListener("selectionchange", () => {
  if (readingView.classList.contains("hidden")) return;

  const selection = window.getSelection();
  const text = selection.toString().trim();

  if (text && text.length > 0 && text.length <= 50) {
    setTimeout(() => {
      const currentSelection = window.getSelection();
      const latestText = currentSelection.toString().trim();
      if (latestText === text && currentSelection.rangeCount > 0) {
        let range = currentSelection.getRangeAt(0);
        let rect = range.getBoundingClientRect();

        let container = range.commonAncestorContainer;
        if (container.nodeType === 3) container = container.parentElement;

        // Find surrounding sentence
        const paragraphText = container.textContent || "";
        const sentences = paragraphText.split(/(?<=[.!?])\s+/);
        let surroundingSentence =
          sentences.find((s) => s.includes(latestText)) || paragraphText;

        showDictionaryPopup(latestText, surroundingSentence, rect);
      }
    }, 400);
  } else if (!text || text.length === 0) {
    dictPopup.classList.add("hidden");
  }
});

// Fonction commune pour afficher le popup et traduire
let currentDictData = null;

async function showDictionaryPopup(text, surroundingSentence, rect) {
  if (
    !text ||
    text.length === 0 ||
    !rect ||
    (rect.width === 0 && rect.height === 0)
  )
    return;

  if (dictSaveBtn) {
    dictSaveBtn.style.color = "";
    dictSaveBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
  }

  dictWord.textContent = text;
  const natureBadge = document.getElementById("dict-nature");
  if (natureBadge) natureBadge.style.display = "none";

  dictTranslation.innerHTML =
    '<div style="font-size:0.85rem; color:var(--text-muted); padding: 4px 0;">検索中...</div>';

  dictPopup.classList.remove("hidden");
  repositionPopup(rect);

  const data = await DictionaryService.lookupWord(text, surroundingSentence);
  currentDictData = data;
  currentDictText = data.mot;

  // Header: Word + (Lemma if different) + Nature tag
  if (
    data.matchedLemma &&
    data.matchedLemma.toLowerCase() !== data.originalWord.toLowerCase()
  ) {
    dictWord.innerHTML = `${data.originalWord} <span class="dict-lemma-hint">(${data.mot})</span>`;
  } else {
    dictWord.textContent = data.originalWord;
  }

  if (natureBadge && data.nature) {
    natureBadge.textContent = data.nature;
    natureBadge.style.display = "inline-block";
  } else if (natureBadge) {
    natureBadge.style.display = "none";
  }

  // Translation Body:
  // Line 1: Concise Japanese Definition (e.g. 絵画、図表)
  // Line 2: Targeted context sentence (e.g. Jocondeは絵画です。)
  let html = "";
  if (data.conciseDef) {
    html += `<div class="dict-def-line">${data.conciseDef}</div>`;
  }

  if (data.traductionPhrase) {
    html += `
      <div class="dict-context-row">
        <span class="dict-context-label">文脈</span>
        <span>${data.traductionPhrase}</span>
      </div>
    `;
  } else if (!data.conciseDef) {
    html = `<div style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">定義が見つかりませんでした</div>`;
  }

  dictTranslation.innerHTML = html;

  // Re-calculate position accurately with rendered dimensions
  repositionPopup(rect);
}

function preloadMLKitModels() {
  if (
    window.Capacitor &&
    window.Capacitor.Plugins &&
    window.Capacitor.Plugins.Translation
  ) {
    window.Capacitor.Plugins.Translation.downloadModel({
      language: "fr",
    }).catch(() => {});
    window.Capacitor.Plugins.Translation.downloadModel({
      language: "ja",
    }).catch(() => {});
  }
}
// Écouter le bouton audio du dictionnaire
if (dictAudioBtn) {
  dictAudioBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentDictText) return;

    const utterance = new SpeechSynthesisUtterance(currentDictText);
    utterance.lang = "fr-FR";
    if (preferredVoice) utterance.voice = preferredVoice;
    // On lit à vitesse normale
    utterance.rate = 1.0;
    if (window.speechSynthesis && window.speechSynthesis.speak)
      window.speechSynthesis.speak(utterance);
  });
}

// -----------------------------------------------------
// Enregistrement des mots (単語帳)
// -----------------------------------------------------
const dictSaveBtn = document.getElementById("dict-save-btn");
let wordLists = JSON.parse(localStorage.getItem("furago_lists")) || [
  { id: "default", name: "デフォルト" },
];
if (!Array.isArray(wordLists) || wordLists.length === 0) {
  wordLists = [{ id: "default", name: "デフォルト" }];
  localStorage.setItem("furago_lists", JSON.stringify(wordLists));
}
wordLists.forEach((l) => {
  if (l.id === "default" && l.name.includes("Tous les mots")) {
    l.name = "デフォルト";
  }
});
localStorage.setItem("furago_lists", JSON.stringify(wordLists));

let savedWords = JSON.parse(localStorage.getItem("furago_words")) || [];
if (!Array.isArray(savedWords)) savedWords = [];

let currentListId = "default";

const listSelectorModal = document.getElementById("list-selector-modal");
const listSelectorContainer = document.getElementById(
  "list-selector-container",
);
const listSelectorCancel = document.getElementById("list-selector-cancel");

if (listSelectorCancel) {
  listSelectorCancel.addEventListener("click", () => {
    listSelectorModal.classList.add("hidden");
  });
}

if (dictSaveBtn) {
  dictSaveBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentDictText) return;
    const translationText = dictTranslation.textContent;
    // Ne pas enregistrer si on est encore en chargement ou en erreur
    if (
      translationText.includes("翻訳中") ||
      translationText.includes("エラー") ||
      translationText.includes("制限")
    ) {
      alert("Veuillez patienter pendant la traduction avant d'enregistrer.");
      return;
    }

    // Ouvrir la modale
    if (listSelectorContainer) {
      listSelectorContainer.innerHTML = "";
      wordLists.forEach((list) => {
        const btn = document.createElement("button");
        btn.style.padding = "12px 16px";
        btn.style.background = "var(--bg)";
        btn.style.color = "var(--text-main)";
        btn.style.border = "1px solid var(--border)";
        btn.style.borderRadius = "12px";
        btn.style.fontSize = "1.05rem";
        btn.style.cursor = "pointer";
        btn.style.display = "flex";
        btn.style.justifyContent = "space-between";
        btn.style.alignItems = "center";

        // Nombre de mots dans cette liste pour info
        const wordsCount = savedWords.filter(
          (w) => w.listId === list.id,
        ).length;

        btn.innerHTML = `
                    <span style="font-weight: bold;">${list.name}</span>
                    <span style="font-size: 0.85rem; color: var(--text-muted);">${wordsCount} mots</span>
                `;

        btn.addEventListener("click", () => {
          listSelectorModal.classList.add("hidden"); // Fermer la modale

          const selectedListId = list.id;
          const exists = savedWords.some(
            (w) =>
              w.fr.toLowerCase() === currentDictText.toLowerCase() &&
              w.listId === selectedListId,
          );

          if (!exists) {
            savedWords.push({
              fr: currentDictData ? currentDictData.mot : currentDictText,
              originalWord: currentDictData
                ? currentDictData.originalWord
                : currentDictText,
              ja: currentDictData
                ? currentDictData.traductionPhrase
                : translationText,
              nature: currentDictData ? currentDictData.nature : "",
              phraseOriginale: currentDictData
                ? currentDictData.phraseOriginale
                : "",
              definitions: currentDictData ? currentDictData.definitions : [],
              listId: selectedListId,
              date: new Date().toISOString(),
            });
            localStorage.setItem("furago_words", JSON.stringify(savedWords));

            // Animation visuelle de succès (TOAST CLAIR)
            showToast("保存しました !");

            // Rafraîchir les listes en arrière-plan si on y est
            renderListsOverview();
          } else {
            alert("Ce mot est déjà dans cette liste.");
          }
        });

        btn.addEventListener("click", () => {
          listSelectorModal.classList.add("hidden");
        });
        listSelectorContainer.appendChild(btn);
      });
      listSelectorModal.classList.remove("hidden");
    }
  });
}

// -----------------------------------------------------
// Gestion des Vues : Listes (Dossiers) et Mots
// -----------------------------------------------------
const listsOverview = document.getElementById("lists-overview");
const listDetailView = document.getElementById("list-detail-view");
const btnCreateList = document.getElementById("btn-create-list");
const btnBackToLists = document.getElementById("btn-back-to-lists");

if (btnCreateList) {
  btnCreateList.addEventListener("click", () => {
    const listName = prompt("新しいリストの名前を入力してください：");
    if (listName && listName.trim() !== "") {
      const newList = { id: "list_" + Date.now(), name: listName.trim() };
      wordLists.push(newList);
      localStorage.setItem("furago_lists", JSON.stringify(wordLists));
      renderListsOverview();
    }
  });
}

if (btnBackToLists) {
  btnBackToLists.addEventListener("click", () => {
    listDetailView.classList.add("hidden");
    listsOverview.classList.remove("hidden");
    renderListsOverview();
  });
}

function renderListsOverview() {
  const container = document.getElementById("lists-container");
  if (!container) return;
  container.innerHTML = "";

  // S'assurer qu'on n'a pas de mots sans listId (mise à jour pour les anciens utilisateurs)
  savedWords.forEach((w) => {
    if (!w.listId) w.listId = "default";
  });

  wordLists.forEach((list) => {
    const wordsInList = savedWords.filter((w) => w.listId === list.id);
    const card = document.createElement("div");
    card.className = "quiz-card fade-in";
    card.style.display = "flex";
    card.style.justifyContent = "space-between";
    card.style.alignItems = "center";
    card.style.cursor = "pointer";

    card.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="background:var(--primary-light); color:var(--primary); width:40px; height:40px; border-radius:8px; display:flex; justify-content:center; align-items:center;">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                </div>
                <div>
                    <h3 style="color:var(--text-main); font-size:1.1rem; margin-bottom:2px;">${list.name}</h3>
                    <span style="color:var(--text-muted); font-size:0.85rem;">${wordsInList.length} mots</span>
                </div>
            </div>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        `;

    card.addEventListener("click", () => {
      currentListId = list.id;
      document.getElementById("current-list-title").textContent = list.name;
      listsOverview.classList.add("hidden");
      listDetailView.classList.remove("hidden");
      renderSavedWords(list.id);
    });

    container.appendChild(card);
  });
}

function renderSavedWords(listId) {
  const container = document.getElementById("saved-words-container");
  if (!container) return;
  container.innerHTML = "";

  const wordsInList = savedWords.filter((w) => w.listId === listId);

  if (wordsInList.length === 0) {
    container.innerHTML = `
            <div style="text-align:center; padding: 40px 20px; color: var(--text-muted);">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.5; margin-bottom:16px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                <p>このリストは空です。<br>記事内で単語を選択して追加してください！</p>
            </div>`;
    return;
  }

  const reversedWords = [...wordsInList].reverse();

  reversedWords.forEach((word) => {
    const card = document.createElement("div");
    card.className = "quiz-card fade-in";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.gap = "12px";

    const realIndex = savedWords.findIndex(
      (w) => w.fr === word.fr && w.listId === word.listId,
    );

    // Header (Word + POS + Buttons)
    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "flex-start";

    let natureHtml = word.nature
      ? `<span style="background: var(--primary-light); color: var(--primary); padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; margin-bottom: 4px; display: inline-block;">${word.nature}</span>`
      : "";

    header.innerHTML = `
      <div>
          ${natureHtml}
          <h3 style="color:var(--primary); margin:0; font-size:1.2rem;">${word.originalWord && word.originalWord.toLowerCase() !== word.fr.toLowerCase() ? `${word.originalWord} <span style="font-size:0.85rem; color:var(--text-muted); font-weight:normal;">(原形: ${word.fr})</span>` : word.fr}</h3>
      </div>
      <div style="display:flex; gap:8px;">
          <button class="btn-play-word" data-word="${word.fr.replace(/"/g, "&quot;")}" style="background:var(--bg); border:1px solid var(--border); color:var(--green); border-radius:50%; width:36px; height:36px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          </button>
          <button class="btn-delete-word" data-index="${realIndex}" style="background:var(--bg); border:1px solid var(--border); color:var(--red); border-radius:50%; width:36px; height:36px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
      </div>
    `;

    // Body (Context Translation)
    const body = document.createElement("div");

    let defText = word.conciseDef || word.ja || "";
    let defHtml = `<div class="dict-def-line" style="margin-bottom: 6px;">${defText}</div>`;

    let contextHtml = "";
    if (word.phraseOriginale && word.traductionPhrase) {
      contextHtml = `
        <div class="dict-context-row" style="margin-bottom: 6px;">
          <span class="dict-context-label">文脈</span>
          <span>${word.traductionPhrase}</span>
        </div>
      `;
    }

    body.innerHTML = defHtml + contextHtml;
    card.appendChild(body);
    container.appendChild(card);
  });

  // Attach event listeners for delete and play
  const deleteBtns = container.querySelectorAll(".btn-delete-word");
  deleteBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"));
      if (confirm("この単語を削除しますか？")) {
        savedWords.splice(idx, 1);
        localStorage.setItem("furago_words", JSON.stringify(savedWords));
        renderSavedWords(listId);
      }
    });
  });

  const playBtns = container.querySelectorAll(".btn-play-word");
  playBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const text = btn.getAttribute("data-word");
      if (text) {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "fr-FR";
        u.rate = 0.9;
        const voices = speechSynthesis.getVoices();
        const localVoices = voices.filter(
          (v) => v.lang.startsWith("fr") && v.localService,
        );
        if (localVoices.length > 0) u.voice = localVoices[0];
        speechSynthesis.speak(u);
      }
    });
  });
}

// -----------------------------------------------------
// Navigation Bas de page
// -----------------------------------------------------
function switchNav(activeBtn, viewToShow) {
  // 1. Désactiver tous les boutons nav
  [navArticles, navWords].forEach((btn) => btn.classList.remove("active"));
  // 2. Cacher toutes les vues principales
  [homeView, readingView, wordListView].forEach((v) =>
    v.classList.add("hidden"),
  );

  // 3. Activer la bonne vue et le bon bouton
  activeBtn.classList.add("active");
  viewToShow.classList.remove("hidden");

  // 4. Couper l'audio en cours
  if (window.speechSynthesis && window.speechSynthesis.cancel)
    window.speechSynthesis.cancel();

  // 5. Cacher le bouton retour si on n'est pas dans un article
  if (viewToShow !== readingView) {
    backBtn.classList.add("hidden");
  }
}

if (navArticles) {
  navArticles.addEventListener("click", () => {
    switchNav(navArticles, homeView);
    // On s'assure d'être sur la homeView et non readingView si on clique "Articles"
    renderHome();
  });
}

if (navWords) {
  navWords.addEventListener("click", () => {
    try {
      switchNav(navWords, wordListView);
      listsOverview.classList.remove("hidden");
      listDetailView.classList.add("hidden");
      renderListsOverview();
    } catch (err) {
      document.body.innerHTML += `<div style="position:fixed; top:0; left:0; right:0; background:red; color:white; z-index:9999; padding:20px;">ERREUR NAV: ${err.message} <br> ${err.stack}</div>`;
    }
  });
}

if (btnPrevSentence) {
  btnPrevSentence.addEventListener("click", () => {
    if (currentQueueIndex > 0) {
      currentQueueIndex--;
      if (isPlaying) {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        playNextInQueue();
      } else {
        updateProgressUI();
        highlightCurrentSentence();
      }
    }
  });
}
if (btnNextSentence) {
  btnNextSentence.addEventListener("click", () => {
    if (currentQueueIndex < ttsQueue.length - 1) {
      currentQueueIndex++;
      if (isPlaying) {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        playNextInQueue();
      } else {
        updateProgressUI();
        highlightCurrentSentence();
      }
    }
  });
}
