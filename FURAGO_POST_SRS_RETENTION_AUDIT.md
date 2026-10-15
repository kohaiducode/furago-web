# Audit Rétention P2 : Parcours après une session SRS

## 1. Executive Summary

L'audit complet du cycle d'apprentissage et de révision de Furago révèle que le parcours post-SRS constitue actuellement une **impasse ergonomique (« cul-de-sac »)** :
1. **Écran de fin statique et passif** : À la fin d'une série de révisions (plafonnée à 5 mots), l'utilisateur se retrouve face à un écran terminal affichant uniquement « 復習完了！ / Review Completed! » et un seul bouton de retrait (« 戻る / Back »). Aucune proposition d'action vers l'avant (poursuivre la lecture, mission du jour, ou réviser les mots restants) n'est offerte.
2. **Bug bloquant de synchronisation SRS (P0)** : Dans le code actuel de `FuragoApp.tsx` (lignes 2833 et 2882), la mise à jour des données SRS (`recordReviewResult`) est conditionnée par un test erroné `if (vocabReviewReturnTo === "words")`. Par conséquent, **pour toutes les sessions SRS initiées depuis la Home (`returnTo: "home"`) ou depuis l'écran Reward (`returnTo: "reading"`), les résultats ne sont JAMAIS enregistrés dans le `UserState`**. Les mots restent marqués comme « dus », les compteurs ne baissent pas et les intervalles ne progressent pas, provoquant une boucle infinie de révision perçue.
3. **Boucle étrange post-Reward** : Lorsqu'un utilisateur termine un article, clique sur « Review Vocabulary » sur l'écran Reward, puis finit sa révision SRS, cliquer sur « Back » le renvoie sur l'écran Reward de l'article déjà lu, où le bouton principal reste « Review Vocabulary », cassant le momentum de lecture.
4. **Absence d'orientation sur les mots restants** : L'algorithme tronquant les révisions par lots de 5 mots, un apprenant ayant 15 mots dus se voit féliciter à la 5ème carte sans aucune mention des 10 mots restants, générant confusion et dissonance cognitive lors du retour à l'accueil.

Pour débloquer la rétention, le parcours post-SRS doit être transformé en un **pivot d'engagement actif** aligné avec la logique *Next Best Action* de la Home, offrant un feedback de progression clair et guidant l'utilisateur vers sa prochaine étape naturelle.

---

## 2. Parcours SRS actuel

### Flux de navigation analysé
```text
Home (ou Reward / Wordbook)
  → startVocabReview(source, returnTo)
    → navigateTo("vocab_review", { returnTo })
      → Cartes 1 à 5 (vocabReviewIndex: 0..4)
        → Écran de fin (vocabReviewIndex === vocabReviewWords.length)
```

### Détail de l'écran de fin (`FuragoApp.tsx` L2921–2940)
* **Composant affiché** :
  ```tsx
  <div className="fade-in" style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--surface)', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
    <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🎉</div>
    <h1 style={{ fontSize: '1.8rem', marginBottom: '16px', color: 'var(--text-main)' }}>
      {appLang === "ja" ? "復習完了！" : "Review Completed!"}
    </h1>
    <p style={{ fontSize: '1.1rem', marginBottom: '32px', color: 'var(--text-muted)' }}>
      {appLang === "ja" ? "よくできました！" : "Great job!"}
    </p>
    <button
      onClick={() => {
        checkAndAwardVocabReviewXP();
        handleBack(vocabReviewReturnTo);
      }}
      style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--primary)', color: 'white', fontSize: '1.1rem', fontWeight: 700, border: 'none', cursor: 'pointer' }}
    >
      {appLang === "ja" ? "戻る" : "Back"}
    </button>
  </div>
  ```

* **Boutons visibles** : **Un seul bouton unique**.
* **Actions proposées** :
  1. Créditer le bonus d'XP quotidien de révision (`checkAndAwardVocabReviewXP()` : +10 XP si non encore attribué aujourd'hui).
  2. Revenir en arrière via `handleBack(vocabReviewReturnTo)`.
* **CTA Principale** : `戻る / Back` (bouton plein format, `var(--primary)`, fond violet/bleu).
* **CTA Secondaire** : **Aucune**.
* **Destination du retour** :
  - `handleBack` exécute en priorité `window.history.back()` si `historyIdx > 0`, sinon `navigateTo(fallbackView, undefined, true)`.
  - L'utilisateur est donc renvoyé à la vue qui a initié la révision : `"home"`, `"reading"`, ou `"words"`.
* **Utilisation de `returnTo`** :
  - Stocké dans l'état local du composant `vocabReviewReturnTo` (`"home" | "words" | "reading"`).
  - Poussé dans les query params (`/?view=vocab_review&returnTo=...`) et l'état `history.state`.
  - Sert d'argument de repli pour `handleBack`.
  - **Effet de bord indésirable** : Sert actuellement (à tort) de condition pour exécuter ou non la fonction de mise à jour SRS `recordReviewResult`.

---

## 3. Scénarios après SRS

### Scénario A — SRS terminé depuis Home
```text
Home → Carte "À réviser" (Bouton Review) → Session SRS (5 mots) → Écran de fin → "Back" → Home
```
* **Comportement actuel** : L'utilisateur clique sur « Back » et réatterrit sur la Home.
* **Ce que peut faire l'utilisateur** :
  - Il se retrouve devant le tableau de bord Home sans aucun guidage contextuel sur ce qu'il vient d'accomplir.
  - S'il avait un article en cours, la carte « Continuer » est présente.
  - S'il n'avait pas complété sa mission, la carte « Mission du jour » est présente.
* **Problème identifié** : En raison du bug L2833/2882, `learnedWords` n'a pas été muté. Le compteur de révisions de la Home affiche donc toujours le même nombre de mots dus. L'utilisateur a l'impression que sa session n'a pas été prise en compte.

### Scénario B — SRS terminé depuis Reward
```text
Article complété → Écran Reward → "🔄 単語を復習する" → Session SRS → Écran de fin → "Back" → Écran Reward
```
* **Comportement actuel** : L'utilisateur clique sur « Back », `window.history.back()` se déclenche et restaure la vue `reading` avec les états locaux en mémoire (`quizIndex`, `sessionReward`).
* **Ce que peut faire l'utilisateur** :
  - Il réapparaît sur l'écran de complétion de l'article qu'il vient pourtant de terminer et de célébrer.
  - Le premier bouton affiché en haut reste « 🔄 単語を復習する » (car `sessionReward.vocab > 0` est resté vrai).
  - Pour continuer à lire, il doit cliquer sur le bouton secondaire « 次の記事 / Next Article » ou « 次のエピソード / Next Episode ».
* **Friction majeure** : L'utilisateur a le sentiment d'un retour en arrière illogique. Au lieu d'enchaîner sur l'article suivant une fois son vocabulaire appris, il est ramené à l'étape préliminaire. S'il recharge la page (`F5`), l'état volatil est perdu et il se retrouve renvoyé au début de l'article !

### Scénario C — SRS lancé avec un volume élevé de mots dus (10+ mots dus)
```text
12 mots dus → Session démarrée (limitée à 5) → Carte 5/5 répondue → Écran de fin
```
* **Indication de mots restants** : **AUCUNE**.
* **Comportement actuel** :
  - L'écran indique triomphalement : `🎉 復習完了！ / Review Completed! よくできました！`.
  - Rien n'indique qu'il reste 7 mots en attente dans la file SRS.
  - Aucun bouton « Revoir 5 mots supplémentaires » n'est proposé.
* **Impact utilisateur** : L'apprenant pense être à jour. Quand il retourne sur la Home (ou dans son carnet), il découvre qu'il lui reste 7 mots à réviser. Ce manque de transparence génère méfiance et découragement.

### Scénario D — SRS lancé avec peu de mots (1–2 mots)
```text
1 ou 2 mots dus → Session terminée en 15 secondes → Écran de fin
```
* **Session suivante évidente ?** : **NON**.
* **Comportement actuel** :
  - Pour une interaction de 15 secondes, l'utilisateur subit une transition complète de vue, un écran de fin statique, puis doit cliquer sur « Back » pour revenir manuellement chercher un article.
  - Le coût cognitif de navigation est disproportionné par rapport à l'effort d'apprentissage fourni.
  - Aucune suggestion n'est faite pour capitaliser sur cette session ultra-rapide (ex. « Super rapide ! Lisez la mission du jour pour continuer votre série »).

---

## 4. Frictions identifiées

| ID | Sévérité | Friction | Localisation code | Impact rétention |
| :--- | :---: | :--- | :--- | :--- |
| **F01** | **P0** | **Échec d'enregistrement SRS hors de Wordbook** : `recordReviewResult` n'est appelé que si `vocabReviewReturnTo === "words"`. Lors d'un lancement depuis Home ou Reward, les révisions ne sont jamais sauvegardées. | `FuragoApp.tsx` L2833, L2882 | **Critique** : Casse l'algorithme SRS, les mots restent dus indéfiniment, brise la confiance de l'utilisateur. |
| **F02** | **P1** | **Écran terminal en cul-de-sac** : Seul le bouton « Retour » est proposé. Aucune action constructive vers l'avant (Next Best Action). | `FuragoApp.tsx` L2930–2938 | **Élevé** : Arrêt brutal du flux de session (drop-off après SRS). |
| **F03** | **P1** | **Opacité sur le reste à réviser** : Lors d'un lot de 5 mots sur N mots dus, aucune mention des mots restants et aucun moyen d'enchaîner. | `FuragoApp.tsx` L602, L2921 | **Élevé** : Incompréhension, rupture du sentiment d'accomplissement. |
| **F04** | **P1** | **Régression de contexte post-Reward** : Retourner vers `"reading"` remet l'utilisateur sur l'écran Reward de l'article déjà terminé, avec le bouton SRS toujours prédominant. | `FuragoApp.tsx` L2003–2015, L2933 | **Élevé** : Navigation circulaire, désorientation, effort supplémentaire pour trouver l'article suivant. |
| **F05** | **P2** | **Absence de feedback de performance** : Aucun affichage du score (ex. « 4/5 réussis ») ni de la récompense obtenue (+10 XP, statut de la streak). | `FuragoApp.tsx` L2921–2929 | **Moyen** : Manque de valorisation de l'effort, baisse du renforcement positif. |
| **F06** | **P2** | **Vulnérabilité de l'état Reward au rafraîchissement** : `sessionReward` et `quizIndex` sont volatils en mémoire React ; un refresh pendant ou après SRS renvoie au début du texte. | `FuragoApp.tsx` L1343–1358 | **Moyen** : Frustration en cas d'interruption mobile ou refresh intempestif. |

---

## 5. Opportunité de rétention

Trois architectures de transition post-SRS sont envisageables :

### Option 1 : `SRS terminé → "Continuer la lecture" (Micro-article ou Reprise)`
* **Principe** : L'écran de fin propose immédiatement de reprendre l'article entamé (`continueTarget`) ou de commencer un court article recommandé.
* **Cohérence produit** : Très forte si un article était en cours de lecture. En revanche, si l'utilisateur vient de terminer un article via l'écran Reward, la reprise immédiate doit plutôt être l'épisode suivant de la série (`currentSeriesNextEp`) ou le prochain article du catalogue.

### Option 2 : `SRS terminé → Daily Mission`
* **Principe** : L'écran de fin met en avant la Mission Quotidienne non accomplie.
* **Cohérence produit** : Excellente pour sécuriser le streak quotidien. Si l'utilisateur n'a pas encore fait sa mission (`!isMissionCompletedToday`), c'est l'action à plus forte valeur de rétention. En revanche, si la mission a déjà été faite plus tôt (ou si l'utilisateur venait justement de faire l'article de la mission), cette CTA devient sans objet.

### Option 3 : `SRS terminé → Retour Home passif`
* **Principe** : Maintenir le bouton « Back » actuel.
* **Cohérence produit** : Faible. Décharge la responsabilité du choix sur l'utilisateur et l'oblige à re-scanner l'ensemble de la Home.

### Synthèse & Opportunité Hybride recommandée
L'opportunité optimale consiste à **adapter dynamiquement la CTA principale post-SRS selon le contexte d'achèvement et l'état de l'utilisateur**, sans créer une logique dupliquée :
1. **S'il reste des mots dus dans la file SRS** (`dueWords.length > 5`) :
   - CTA Primaire : `🔄 Revoir 5 mots de plus (reste X)`
   - CTA Secondaire : Continuer vers la lecture ou Retour Accueil.
2. **Si tous les mots sont révisés et l'utilisateur vient de Reward (`returnTo === "reading"`)** :
   - CTA Primaire : `📖 Article suivant / Épisode suivant` (court-circuite le retour inutile sur l'écran Reward).
   - CTA Secondaire : `🏠 Retour à l'accueil`.
3. **Si tous les mots sont révisés et l'utilisateur vient de Home (`returnTo === "home"`)** :
   - CTA Primaire : La **Next Best Action de la Home** (Reprendre l'article en cours si existant, sinon Mission du jour).
   - CTA Secondaire : `🏠 Retour à l'accueil`.

---

## 6. Mobile UX

### Analyse de l'interface actuelle sur smartphone (375px / 390px)
* **Structure visuelle** :
  - Conteneur centré verticalement (`minHeight: '80vh'`).
  - Carte blanche / surface sombre avec padding généreux (40px 20px).
  - Éléments très espacés (icône 🎉 4rem, titre 1.8rem, marge 32px, bouton 16px padding).
* **Touch Target & Ergonomie** :
  - Le bouton unique « Back » mesure environ 52px de hauteur et prend 100% de la largeur du conteneur (max 600px). Il est très facile à toucher au pouce.
  - En revanche, l'espace d'écran vertical est largement sous-exploité.
* **Effort cognitif & moteur pour continuer** :
  - **Pour lire un nouvel article après SRS** : 
    1. Tap sur « Back » (retour Home).
    2. Attente de la transition.
    3. Scroll vers le bas si la mission ou les recommandations sont sous la ligne de flottaison.
    4. Tap sur l'article.
    -> **Total : 3 à 4 interactions distinctes**.
* **Hiérarchie cible recommandée pour mobile** :
  - Haut de carte : Résumé d'impact compact (Titre + XP gagné + Score + Statut de la file de révision).
  - Bas de carte : **Deux boutons verticaux clairement hiérarchisés** :
    - Bouton plein primaire (hauteur 50px) : Prochaine action (ex. « Continuer l'épisode 2 » ou « Revoir les 5 mots suivants »).
    - Bouton discret outline ou ghost (hauteur 44px) : « Retour à l'accueil ».

---

## 7. Interaction avec Home / Mission / Continue

Pour garantir une intégrité parfaite de l'architecture logicielle :
* **Pas de logique Next Best Action dupliquée** :
  - Comme recommandé dans le précédent audit (`FURAGO_RETENTION_NEXT_BEST_ACTION_AUDIT.md`), une fonction pure dans `src/lib/home.ts` (ou un nouveau module `retention.ts`) doit centraliser le calcul de la prochaine action prioritaire de l'utilisateur.
  - L'écran post-SRS doit simplement interroger cette même fonction pour déterminer quelle CTA proposer en sortie de session.
* **Respect strict des règles métier** :
  - **Daily Mission** : Si `!isMissionCompletedToday`, la mission doit rester une priorité majeure de rétention.
  - **Continue** : Si un article est commencé à plus de 5% (`selectContinueArticle`), il doit être proposé directement avec son titre et son ratio de complétion.
  - **Series** : Si l'utilisateur vient de terminer un épisode dans une série, l'épisode suivant doit avoir la priorité absolue sur tout article générique.
  - **Streak & Progression** : La session SRS incrémente l'XP quotidien de révision (+10 XP via `vocabReviewXPDate`), ce qui doit être répercuté visuellement sans délai.

---

## 8. Analytics disponibles

### Événements existants (`src/lib/analytics.ts`)
* `srs_session_started` : Paramètre `{ due_count: number }`.
* `srs_session_completed` : Paramètres `{ reviewed_count: number, correct_count: number }`.
* `home_cta_clicked` : Paramètres `{ cta_type: "continue" | "mission" | "srs" | "recommendation", position: number }`.
* `article_started` : Paramètres `{ article_id: string, source: "home_continue" | "home_mission" | "catalog" | "recommendation" }`.
* `mission_completed` : Paramètre `{ article_id: string }`.

### Gaps analytiques identifiés pour le post-SRS
1. **Absence de suivi de sortie post-SRS** :
   - Le clic sur « 戻る / Back » sur l'écran L2930 ne déclenche aucun événement. Il est impossible de mesurer si l'utilisateur quitte l'application juste après avoir révisé (churn / session drop).
2. **Absence de tracking de la source post-SRS dans `article_started`** :
   - Le type `source` dans `article_started` n'inclut ni `"post_srs"`, ni `"reward"`.
3. **Absence de tracking de clic sur l'écran Reward** :
   - Le clic sur « 🔄 単語を復習する » depuis l'écran Reward (L2010) n'émet aucun événement analytique de type `reward_cta_clicked`. On ne peut mesurer le taux de conversion du pont Article → SRS que par déduction indirecte (`article_completed` suivi de `srs_session_started`).

---

## 9. Recommandation

### Recommandation Principale
Transformer l'écran de complétion SRS d'un écran terminal passif en un **Hub de Transition d'Engagement** :
1. **Corriger impérativement le bug P0** : Remplacer `if (vocabReviewReturnTo === "words")` par la vérification du type de mot révisé afin que `recordReviewResult` s'exécute pour TOUTES les sessions SRS (Home, Reward et Wordbook).
2. **Afficher l'état réel de la file SRS** :
   - Si des mots sont encore dus : Afficher « Il vous reste X mots à revoir » avec un bouton primaire « 🔄 Continuer les révisions (+5) ».
   - Si tous les mots sont révisés : Afficher « 🎉 Toutes vos révisions sont à jour ! ».
3. **Proposer une Next Best Action contextualisée en CTA Principale** :
   - Si la file SRS est vide et que l'utilisateur vient de **Reward** : Proposer directement « 📖 Épisode suivant » ou « 📖 Article suivant » plutôt que de le renvoyer vers l'écran Reward.
   - Si la file SRS est vide et que l'utilisateur vient de **Home** : Proposer l'action prioritaire de la Home (Reprendre l'article en cours ou Faire la mission du jour).
4. **Reléguer le retour en arrière en CTA Secondaire** :
   - Un bouton secondaire « 🏠 Accueil » ou « ← Retour » garantit que l'utilisateur n'est jamais bloqué, tout en favorisant la continuité de lecture en un seul tap.

---

## 10. Priorité

| Priorité | Périmètre | Justification |
| :---: | :--- | :--- |
| **P0** | **Correction de l'enregistrement `recordReviewResult`** | Bloquant technique majeur : les révisions faites depuis la Home ou Reward sont actuellement ignorées par le moteur de persistance. |
| **P1** | **Affichage des mots restants et bouton "Revoir 5 mots de plus"** | Résout l'incompréhension de l'utilisateur quand il a plus de 5 mots dus. |
| **P1** | **CTA Next Best Action sur l'écran de fin SRS** | Supprime le cul-de-sac ergonomique et relance immédiatement la session de lecture. |
| **P1** | **Optimisation du flux post-Reward** | Évite le retour redondant vers l'écran de complétion d'un article déjà terminé. |
| **P2** | **Feedback enrichi (Score + XP + Streak)** | Renforce la dopamine loop et la gamification post-révision. |
| **P2** | **Ajout des événements Analytics post-SRS** | Permet de monitorer précisément le taux de rebond et la conversion de session post-révision. |

---

## 11. Conclusion

Le système SRS de Furago possède un algorithme d'espacement fonctionnel et une intégration prometteuse avec les articles. Cependant, la phase post-SRS souffre d'un défaut critique d'enregistrement des données (P0) et d'une conception d'interface en « cul-de-sac » (P1) qui interrompt le flux d'engagement de l'apprenant. 

En éliminant le bug de mise à jour et en connectant l'écran de fin SRS à la logique *Next Best Action* du produit, Furago transformera la fin d'une révision en un tremplin naturel vers la lecture d'un nouvel article, renforçant considérablement la rétention quotidienne et la durée moyenne de session.
