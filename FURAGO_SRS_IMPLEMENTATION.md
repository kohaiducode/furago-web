# Implémentation du système SRS (Spaced Repetition System)

### Architecture SRS
Le moteur SRS est implémenté sous forme de logique métier pure (hors React) dans un nouveau fichier `src/lib/srs.ts`. Il expose des fonctions testables : `createSRSWord`, `recordReviewResult`, `getWordsDueForReview`, `getReviewStats`, et `migrateWordToSRS`. L'architecture garantit que l'algorithme est déterministe et n'interagit jamais directement avec le `localStorage`.

### Modèle de données
L'interface `LearnedWord` dans `src/lib/userState.ts` a été augmentée des propriétés strictement requises (rétrocompatibles via la migration) :
- `firstLearnedAt` (timestamp)
- `lastReviewedAt` (timestamp | null)
- `dueAt` (timestamp)
- `interval` (jours : 0, 1, 3, 7, 14, 30, 60)
- `correctCount`
- `wrongCount`
- `difficulty` ("easy", "normal", "hard")
- `reviewStreak`

### Migration
Un passage par `migrateWordToSRS` a été ajouté au sein de la fonction `loadUserState()` pour le chargement.
- Les anciens mots "appris" gagnent les champs SRS avec `interval = 0` et `dueAt = now`.
- Aucune donnée (comme `articleIds`) n'est perdue.
- La fonction `mergeLearnedVocabulary` (utilisée lors de l'attribution de l'XP de lecture) utilise désormais `createSRSWord()` pour insérer de nouveaux mots propres.

### Algorithme
Les intervalles progressifs sont codés en dur (`0, 1, 3, 7, 14, 30, 60`).
- **Bonne réponse** : Passe à l'intervalle suivant, incrémente `correctCount` et `reviewStreak`, et calcule `dueAt` en conséquence. S'il est à 60, il reste à 60.
- **Mauvaise réponse** : Chute de l'intervalle à 1 jour (court et déterministe pour une révision le lendemain), incrémente `wrongCount`, réinitialise le `reviewStreak`.

### Gestion des erreurs
- Les doublons lors de l'apprentissage (même mot dans plusieurs articles) sont fusionnés au niveau des `articleIds` dans `mergeLearnedVocabulary` sans écraser les dates SRS du mot.
- La sélection des mots dans l'UI se fait sur la fonction déterministe `getWordsDueForReview` qui priorise par ordre de retard (`dueAt` ascendant), excluant le `Math.random()`.

### Intégration UserState
La logique UI ne réinvente pas le système de sauvegarde. Lors du clic sur "Je connais" (ou d'une bonne/mauvaise réponse au QCM), on lit le mot dans `learnedVocabulary`, on applique `recordReviewResult`, et on propage via `mutateUserState({ learnedVocabulary: newLearned })`. L'enregistrement `localStorage` est géré par la base stabilisée existante.

### Intégration vue de révision
- **Bouton Home** : Modifié pour afficher le décompte exact (`X due`) et désactivé si aucune révision n'est requise.
- **Démarrage** : La fonction `startVocabReview` pioche les mots depuis `getWordsDueForReview` et les convertit dynamiquement pour les mapper sur la vue QCM, en conservant un pont pour la soumission.
- **Soumission** : Le clic d'un choix et le bouton de fallback `I know this` déclenchent la mise à jour SRS.

### Tests
22 scénarios ont été validés avec succès sans framework externe (`test_srs.ts`), incluant : nouveau mot, 1ère bonne réponse, mauvaise réponse, dates "dueAt", non-sélection des mots non dus, doublons, et conservation des champs d'XP.

### Build / Lint
- `npm run build` : 100% SUCCESS. Le typage strict de `LearnedWord` a forcé la correction des fusions antérieures.
- `npm run lint` : 100% SUCCESS. L'intégration respecte les règles React locales.

### Fichiers modifiés
1. `src/lib/srs.ts` (Nouveau)
2. `src/lib/userState.ts`
3. `src/components/FuragoApp.tsx`

### Risques restants
Le pool de mots générés pour constituer les réponses incorrectes ("distracters") dans le QCM de révision SRS pioche ses définitions dans les mots en base de l'utilisateur. Si l'utilisateur n'a pas beaucoup de vocabulaire, il y aura peu de variété dans les réponses fausses du quiz de vocabulaire. Cela reste cependant suffisant pour la V1 locale.

### STATUS
**PASS**
