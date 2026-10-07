# Implémentation Rétention Post-SRS : Correction P0 & Parcours P1

## 1. Résumé

Cette implémentation traite les défaillances critiques identifiées dans l'audit `FURAGO_POST_SRS_RETENTION_AUDIT.md` :
1. **P0 (Persistance SRS)** : Résolution de la perte systématique des résultats de révision SRS initiées depuis l'écran Accueil (Home) ou l'écran Récompense (Reward).
2. **P1 (Transparence de la file SRS)** : Calcul et affichage précis du nombre réel de mots restant dus dans la file SRS globale de l'utilisateur à la fin d'une session (par lots de 5 mots).
3. **P1 (Action Continue Review)** : Bouton primaire dynamique « 🔄 Continuer les révisions (+5) » permettant d'enchaîner immédiatement sur le prochain lot sans revenir au point de départ.
4. **P1 (Next Best Action Post-SRS)** : Élimination du cul-de-sac ergonomique lorsque toutes les révisions sont à jour (`dueRemaining === 0`) en aiguillant directement l'utilisateur vers son action prioritaire :
   - Flux post-Reward : Épisode suivant (série) ou Article suivant (catalogue), sans repasser par l'écran de complétion déjà vu ;
   - Flux post-Home : Reprise de lecture en cours (`continueTarget`) ou Mission du jour non accomplie (`dailyArticle`) ;
   - Flux post-Words : Retour au carnet de vocabulaire (`words`).
5. **P1 (Sortie sûre et hiérarchie visuelle)** : Une seule CTA primaire et une seule CTA secondaire discrète (« 🏠 Accueil » ou « ← Retour »).

---

## 2. Correction P0 `recordReviewResult`

### Problème initial
Le déclenchement de `recordReviewResult` était conditionné par le test d'aiguillage de retour de vue :
```tsx
if (vocabReviewReturnTo === "words") {
  // mise à jour SRS
}
```
Par conséquent, toute session lancée avec `returnTo === "home"` ou `returnTo === "reading"` ignorait totalement la mise à jour SRS. Les mots restaient dus et les compteurs ne progressaient jamais.

### Correction apportée
La condition repose désormais sur la vérification stricte que le mot en cours de révision est un véritable mot SRS (`LearnedWord`) :
1. Introduction de l'état `vocabReviewSource: "saved" | "learned"`.
2. Centralisation via le helper `handleRecordReviewResult` :
```tsx
const handleRecordReviewResult = useCallback((word: SavedWord, isCorrect: boolean) => {
  const isSRSWord = vocabReviewSource === "learned" || word.listId === "learned";
  if (!isSRSWord) return;

  mutateUserState((prev) => {
    const currentLearned = prev.learnedVocabulary || [];
    const lwIndex = currentLearned.findIndex(
      (w) => w.word.toLowerCase() === word.fr.toLowerCase()
    );
    if (lwIndex === -1) return {};

    const nextLw = recordReviewResult(currentLearned[lwIndex], isCorrect);
    const newLearned = [...currentLearned];
    newLearned[lwIndex] = nextLw;
    return { learnedVocabulary: newLearned };
  });
}, [vocabReviewSource, mutateUserState]);
```
3. Exécution garantie sur les deux interactions de révision :
   - Clic sur la carte flashcard « 覚えた / I know this » (`handleRecordReviewResult(word, true)`) ;
   - Clic sur une option de QCM (`handleRecordReviewResult(word, isCorrect)`).
4. Protection contre les faux positifs : si l'utilisateur s'entraîne sur ses mots sauvegardés (`source === "saved"`), `isSRSWord` est faux et `recordReviewResult` n'est pas appelé.

---

## 3. Vérification des trois contextes SRS

### Contexte A : Home → Review
- **Déclenchement** : Bouton « 復習する / Review » de la section Home (`startVocabReview("learned", "home")`).
- **Comportement** : `vocabReviewSource = "learned"`, `returnTo = "home"`.
- **Réponse** : Chaque mot traité appelle `handleRecordReviewResult`.
- **Résultat** : `learnedVocabulary` mis à jour, `interval` adapté (1, 3, 7...), `dueAt` recalculé, persistance immédiate dans `UserState` (`localStorage`).

### Contexte B : Reward → Review
- **Déclenchement** : Bouton « 🔄 単語を復習する / Review Vocabulary » de l'écran Reward (`startVocabReview("learned", "reading")`).
- **Comportement** : `vocabReviewSource = "learned"`, `returnTo = "reading"`.
- **Réponse** : Chaque mot traité appelle `handleRecordReviewResult`.
- **Résultat** : `learnedVocabulary` mis à jour, persistance immédiate.

### Contexte C : Words → Review
- **Déclenchement** : Bouton « 復習する / Review » du carnet d'apprentissage (`startVocabReview("learned", "words")`).
- **Comportement** : `vocabReviewSource = "learned"`, `returnTo = "words"`.
- **Réponse** : Chaque mot traité appelle `handleRecordReviewResult`.
- **Résultat** : `learnedVocabulary` mis à jour, persistance immédiate.

Pour chacun des trois contextes :
- `interval` mis à jour ;
- `correctCount` / `wrongCount` / `reviewStreak` mis à jour ;
- `dueAt` repoussé dans le futur ;
- Sauvegarde `UserState` effectuée sans doublon ni perte.

---

## 4. File SRS restante

- **Calcul en temps réel** :
  ```tsx
  const dueRemaining = vocabReviewSource === "learned"
    ? getWordsDueForReview(learnedWords, nowMs).length
    : 0;
  ```
- **Précision** : Ne s'appuie pas sur `vocabReviewWords.length` (qui ne reflète que le lot courant de 5 mots). Le compteur interroge la totalité du dictionnaire d'apprentissage de l'utilisateur (`learnedWords`) par rapport à l'horodatage courant `nowMs`.
- **Feedback visuel** :
  - Si `dueRemaining > 0` : Affichage clair du reste à faire :
    - `ja` : `あと${dueRemaining}語の復習が残っています`
    - `en` : `You have ${dueRemaining} word(s) left to review`
  - Si `dueRemaining === 0` : Message de félicitations :
    - `ja` : `🎉 すべての復習が完了しました！`
    - `en` : `🎉 All reviews are up to date!`

---

## 5. CTA Continue Review

Lorsque `dueRemaining > 0` :
- **CTA Principale** :
  - `ja` : `🔄 復習を続ける (+${Math.min(5, dueRemaining)})`
  - `en` : `🔄 Continue review (+${Math.min(5, dueRemaining)})`
- **Action** :
  ```tsx
  checkAndAwardVocabReviewXP();
  startVocabReview("learned", vocabReviewReturnTo);
  ```
- **Comportement dynamique** : Sélectionne les 5 prochains mots prioritaires dans `learnedWords` (ou le reliquat si moins de 5), attribue l'XP si applicable, et relance la session immédiatement.

---

## 6. Next Best Action

Lorsque `dueRemaining === 0`, la CTA principale dépend contextuellement de l'origine :

### Depuis Home (`vocabReviewReturnTo === "home"`)
Réutilisation stricte des règles prioritaires de la Home :
1. **Article en cours (`continueTarget`)** :
   - Si `continueArticle` : `📖 続きを読む` / `📖 Continue reading`
   - Si `currentSeriesNextEp` : `📖 次のエピソードへ` / `📖 Next episode`
   - Action : Ouvre directement l'article via `openArticle(continueTarget, false, "home_continue")`.
2. **Mission du jour (`dailyArticle && !isMissionCompletedToday`)** :
   - Libellé : `🎯 今日のミッションを読む` / `🎯 Today's mission`
   - Action : Ouvre la mission du jour via `openArticle(dailyArticle, false, "home_mission")`.
3. **Repli** : `🏠 ホームへ戻る` / `🏠 Back to Home` (`navigateTo("home")`).

---

## 7. Reward → prochaine activité

Lorsque `vocabReviewReturnTo === "reading"` et `dueRemaining === 0` :
- **Détection** :
  - Si série en cours avec épisode suivant : `nextRewardEp = currentSeriesInfo?.nextEp`
  - Sinon article suivant du catalogue : `nextRewardArticle = getNextArticleFor(currentArticle)`
- **CTA Principale** :
  - Si épisode disponible : `📖 次のエピソード` / `📖 Next Episode` (`openArticle(nextRewardEp)`)
  - Si article disponible : `📖 次の記事` / `📖 Next Article` (`openArticle(nextRewardArticle)`)
  - Si catalogue épuisé : `🏠 ホームへ戻る` / `🏠 Back to Home` (`navigateTo("home")`)
- **Suppression du cul-de-sac** : L'utilisateur n'est plus renvoyé vers l'écran Reward d'un article déjà validé. Le passage SRS → Lecture suivante est direct et instantané.

---

## 8. CTA secondaire

Dans toutes les situations, une issue de secours claire et secondaire visuellement est disponible :
- Style visuel : Fond neutre `var(--bg)`, bordure subtile `1px solid var(--border)`, texte `var(--text-main)`.
- Si `dueRemaining > 0` :
  - Depuis Words : `単語帳に戻る / Back to Vocabulary`
  - Depuis Home ou Reward : `🏠 ホームへ戻る / 🏠 Back to Home`
- Si `dueRemaining === 0` :
  - Bouton `🏠 ホームへ戻る / 🏠 Back to Home` (uniquement présent si la CTA principale est une action de lecture, pour éviter tout doublon).

---

## 9. Traductions

- Respect strict du système bilingue `ja` et `en` en place (`appLang === "ja" ? ... : ...`).
- Aucune chaîne hardcodée en français dans l'UI.
- Réutilisation des libellés existants (`復習完了！`, `単語帳に戻る`, `ホームへ戻る`, `続きを読む`, etc.).

---

## 10. Non-régression

Vérification des flux et mécanismes adjacents :
- **Algorithme SRS (`src/lib/srs.ts`)** : Strictement inchangé.
- **Attribution XP** : `checkAndAwardVocabReviewXP` (+10 XP quotidien) appelé de façon idempotente sur chaque fin de lot.
- **Analytics** : Événements `srs_session_started`, `srs_session_completed`, `home_cta_clicked`, `article_completed` préservés sans altération.
- **Navigation et Historique** : `handleBack` et `navigateTo` utilisés conformément aux conventions du projet sans altérer l'historique du navigateur.

---

## 11. Typecheck / Lint / Build

1. **Typecheck (`npx tsc --noEmit`)** :
   ```text
   Code 0 — Aucune erreur TypeScript.
   ```
2. **Lint (`npm run lint`)** :
   ```text
   Zero nouvelle erreur / warning.
   Les erreurs préexistantes répertoriées dans lint_output.txt (scripts racine fix-scroll*.js et set-state-in-effect) restent intactes.
   ```
3. **Build (`npm run build`)** :
   ```text
   ▲ Next.js 16.3.6 (Turbopack)
   ✓ Compiled successfully in 334ms
   ✓ Generating static pages (4/4) in 793ms
   Code 0 — Build de production réussi.
   ```

---

## 12. Contrôle du diff

Le diff est strictement confiné à `src/components/FuragoApp.tsx` :
- Définition de l'état `vocabReviewSource` et du helper `handleRecordReviewResult` ;
- Hoisting du helper pur `getNextArticleFor` et calcul de `dueRemaining` ;
- Remplacement du test `vocabReviewReturnTo === "words"` par `handleRecordReviewResult` ;
- Refonte de l'écran de complétion `vocab_review` (informations de file restante, CTA principale contextuelle, CTA secondaire).

---

## 13. Limitations

- Si l'utilisateur n'a aucune connexion réseau et que le cache du dictionnaire local n'a pas encore indexé un mot, le mot est tout de même présenté en révision avec sa forme originale (grâce au fallback gracieux) et son état SRS est mis à jour normalement.

---

## 14. Statut

`PASS`
