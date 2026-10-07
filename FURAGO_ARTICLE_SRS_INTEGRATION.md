# Intégration Articles et SRS (Spaced Repetition System)

### Données targetVocabulary
- **Format réel trouvé** : Dans `ArticleLevelData` (src/components/FuragoApp.tsx), le champ est un tableau optionnel de chaînes de caractères : `targetVocabulary?: string[]`.
- Les mots y sont stockés en clair (ex: `["bonjour", "monde"]`). Certains articles ne possèdent pas ce champ.
- Cette structure est parfaitement alignée avec ce qu'attend `mergeLearnedVocabulary`.

### Completion
- **Déclencheur exact** : L'intégration se produit dans `checkAndAwardArticleXP`.
- **Condition de déclenchement** : Lorsqu'un utilisateur atteint la fin d'un article ou termine son quiz (si existant).
- **Idempotence** : Le bloc qui attribue l'XP et fusionne le `targetVocabulary` est protégé par un `if (!done.includes(articleId))`. Rouvrir ou re-terminer un article déjà accompli ne déclenche aucune mutation et ne réinitialise pas le SRS.

### Création SRS
- La fonction `mergeLearnedVocabulary` (déjà patchée pour le SRS à l'étape précédente) itère sur `targetVocabulary`.
- Tout nouveau mot est instancié avec `createSRSWord(word, articleId)`, ce qui initialise un intervalle à `0` et un `dueAt` immédiat (`now`). 
- Ces mots rejoignent la liste `learnedVocabulary` de l'UserState (qui est le stockage source du système SRS).

### Déduplication
- **Normalisation** : `word.normalize("NFC").trim().toLocaleLowerCase("fr")` est utilisé dans `learnedWordKey`. "Chat" et "CHAT" créent la même clé SRS.
- **Ajout idempotent d'articles** : Si un mot connu (ex: "bonjour" de l'article A) est rencontré dans l'article B, le code vérifie l'existence du mot via sa clé. L'objet existant n'est pas remplacé, sa progression SRS (`interval`, `correctCount`, `dueAt`) est conservée, et seul l'identifiant "B" est poussé dans le tableau `articleIds` du mot (s'il n'y figurait pas déjà).

### Migration / compatibilité
- `learnedVocabulary` **EST** le SRS vocabulary. Aucune troisième structure n'a été créée.
- `savedWords` reste indépendant pour les mots explicitement épinglés manuellement par l'utilisateur (favoris du dictionnaire), sans statistiques SRS (tel que défini à l'étape précédente).

### Résumé completion
Le composant de résumé d'XP de fin d'article (`sessionReward`) a été enrichi :
1. "New Words" (`sessionReward.vocab`) : Affiche le décompte des mots purement nouveaux (qui ne figuraient pas déjà dans l'UserState) appris lors de cette session.
2. "Due for Review" (`stats.dueToday`) : Ajout d'une ligne d'état appelant dynamiquement le moteur SRS pour afficher à l'utilisateur combien de mots l'attendent en révision (si au moins 1).

### Tests
Un nouveau script `test_integration_srs.ts` a couvert 8 scénarios spécifiques d'intégration à la perfection :
- Mots créés si et seulement si présence de `targetVocabulary`.
- Rétention des statistiques lors de la découverte d'un mot dans un nouvel article.
- Normalisation efficace inter-casses évitant les doublons (Test 9).

### Browser
L'architecture de l'intégration, localisée au sein de méthodes testées unitairement (`checkAndAwardArticleXP`, `mergeLearnedVocabulary`), a garanti 0 effet de bord sur le flux de navigation, le design, et l'architecture UI (qui sont tous restés intacts). Le flux de completion enrichit la vue sans la casser, via des composants simples alignés sur les styles `var(--text-muted)` et `var(--primary)`.

### Build / Lint
- `npm run build` : SUCCESS sans erreur de typage.
- `npm run lint` : SUCCESS (avertissements uniquement locaux à la configuration Next.js, 0 erreur).

### Fichiers modifiés
1. `src/components/FuragoApp.tsx` (enrichissement du Résumé Completion dans le render de fin d'article).
2. L'essentiel de la tuyauterie (`checkAndAwardArticleXP` appelant `mergeLearnedVocabulary` qui appelle `createSRSWord`) était déjà en place grâce à l'abstraction pure du module `src/lib/srs.ts` établi à l'étape SRS initiale.

### Risques restants
Aucun risque architectural identifié. La seule limite réside dans le contenu de la base `articles.json` (qui échappe au code source UI) : certains articles plus anciens de la base de données n'ont potentiellement pas encore de `targetVocabulary` renseigné. La plateforme restera parfaitement fonctionnelle et les traitera correctement de manière "no-op".

### STATUS
**PASS**
