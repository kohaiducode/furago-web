# Rapport de Validation Finale — MVP Analytics Furago

**Date** : 7 Octobre 2026  
**Statut** : Validation Post-Correctifs P0/P1  
**Mode** : Lecture Seule (Strictly Read-Only)

---

## 1. Executive Summary

À la suite de l'implémentation des correctifs critiques P0/P1 documentés dans `FURAGO_ANALYTICS_P0_P1_FIX.md`, une revue exhaustive et systématique en lecture seule du codebase (`src/lib/analytics.ts` et `src/components/FuragoApp.tsx`) a été menée.

Les trois dysfonctionnements critiques qui bloquaient l'exploitation des données ont été résolus :
1. **CTA SRS sur la Home** : Deux boutons d'action SRS ("復習する" et "保存した単語を練習する") sont désormais instrumentés avec `home_cta_clicked` (`cta_type: "srs"`).
2. **Attribution du Catalogue** : Les clics d'ouverture depuis la liste du catalogue transmettent désormais formellement `source: "catalog"` dans `article_started`.
3. **Cycle de vie de session et mesure D1/D7** : La détection d'expiration (inactivité > 30 min) via les écouteurs d'activité (`pointerdown`, `keydown`, `visibilitychange`) et l'interception proactive dans `trackEvent` garantissent le renouvellement du `session_id` et l'émission d'un `session_start` unique, même si l'onglet reste ouvert en arrière-plan pendant plusieurs jours.

**Verdict** : **EXPLOITABLE AVEC LIMITES** (Baseline exploitable immédiatement pour l'analyse des parcours et la rétention, avec des réserves documentées sur le paramètre `due_count` plafonné à 5 dans `srs_session_started` et le comptage strict de `home_viewed`).

---

## 2. Validation des 8 événements

Le tableau ci-dessous récapitule l'analyse technique des 8 événements du contrat d'interface MVP :

| Événement | Trigger & Emplacement | Conditions d'émission | Paramètres réels | Risque de doublon | Destination & Payload | Impact sur les Funnels |
|---|---|---|---|---|---|---|
| `session_start` | • Montage React (`FuragoApp.tsx:928`)<br>• Réveil inactivité (`FuragoApp.tsx:159`)<br>• Interception (`analytics.ts:125`) | `isNew === true` (nouvelle session ou >30 min d'inactivité) | `streak: number`<br>`srs_due_count: number` | **Nul** (verrouillé par mise à jour synchrone de `lastActive` en `localStorage`) | GAS via POST `action: "log_event"` | Dénominateur de base de toutes les sessions. Mesure d'engagement, rebond et rétention D1/D7. |
| `home_viewed` | `useEffect` sur changement d'état Home (`FuragoApp.tsx:1785-1797`) | `activeView === "home"` et clé d'état non encore vue | `srs_due_count: number`<br>`has_daily_mission: boolean`<br>`has_continue_article: boolean`<br>`streak_state: "none" \| "done_today" \| "at_risk" \| "broken"` | **Nul sur re-renders** (protégé par `analyticsFiredRef[key]`) | GAS via POST `action: "log_event"` | Sommet du funnel Home (impressions des modules). Sert de base pour calculer les CTR des cartes et l'exposition au habit nudge (6.3-B). |
| `home_cta_clicked` | Handlers `onClick` des cartes Home (`FuragoApp.tsx:2309, 2333, 2358, 2397, 2417`) + habit nudge (6.3-B) | Clic direct utilisateur sur un module Home actif ou sur le CTA du streak nudge | `cta_type: "continue" \| "mission" \| "srs" \| "recommendation" \| "habit_nudge"`<br>`position: number` (`0` = habit nudge) | **Nul** (1 clic utilisateur = 1 événement) | GAS via POST `action: "log_event"` | Étape charnière de conversion de la Home. Permet l'analyse comparative des modules et du nudge de rétention. |
| `article_started` | Fonction `openArticle` (`FuragoApp.tsx:1270`) | Présence obligatoire de l'argument `source` | `article_id: string`<br>`source: "home_continue" \| "home_mission" \| "catalog" \| "recommendation"` | **Nul** (filtré si navigation interne ou popstate sans source) | GAS via POST `action: "log_event"` | Début du funnel de lecture. Clé d'attribution du trafic vers les articles. |
| `article_completed` | `useEffect` de fin de lecture/quiz (`FuragoApp.tsx:863, 882`) | Fin du texte/quiz et `sessionReward === null` | `article_id: string` | **Nul au sein d'une lecture** (verrouillé par `setSessionReward`) | GAS via POST `action: "log_event"` | Fin du funnel de lecture. Permet de mesurer le taux de complétion par source d'article. |
| `srs_session_started` | Fonction `startVocabReview` (`FuragoApp.tsx:604`) | `source !== "saved"` et `learnedWords.length > 0` | `due_count: number` *(plafonné à 5 par `slice(0, 5)`)* | **Nul** (déclenché au lancement de la revue) | GAS via POST `action: "log_event"` | Début du funnel SRS. Mesure le passage à l'acte de révision. |
| `srs_session_completed` | `useEffect` d'achèvement de révision (`FuragoApp.tsx:1804`) | `vocabReviewIndex === vocabReviewWords.length` | `reviewed_count: number`<br>`correct_count: number` | **Nul** (protégé par `analyticsFiredRef['srs_completed_fired']`) | GAS via POST `action: "log_event"` | Fin du funnel SRS. Mesure la complétion et la performance d'apprentissage. |
| `mission_completed` | `useEffect` de fin de lecture (`FuragoApp.tsx:868, 888`) | Identique à `article_completed` ET `article.id === dailyArticle.id` | `article_id: string` | **Nul** (protégé par `sessionReward === null`) | GAS via POST `action: "log_event"` | Fin du funnel Mission. Mesure le succès de la mission quotidienne. |

---

## 3. Validation du cycle `session_start`

### 3.1. Analyse des trois chemins d'initialisation

L'architecture repose sur la fonction synchrone centrale `getOrCreateSessionId()` dans `src/lib/analytics.ts` :

```typescript
function getOrCreateSessionId(): { sid: string; isNew: boolean } {
  if (typeof window === "undefined") return { sid: "server", isNew: false };
  const now = Date.now();
  let sid = localStorage.getItem(SESSION_ID_KEY);
  const lastActive = localStorage.getItem(SESSION_LAST_ACTIVE_KEY);
  let isNew = false;

  if (!sid || !lastActive || now - Number(lastActive) > SESSION_TIMEOUT_MS) {
    sid = generateUUID();
    localStorage.setItem(SESSION_ID_KEY, sid);
    isNew = true;
  }

  // Update last active time
  localStorage.setItem(SESSION_LAST_ACTIVE_KEY, now.toString());
  return { sid, isNew };
}
```

Examinons les trois flux d'exécution possibles :

1. **Chemin 1 : Montage React (`checkAndTrackSessionStart`)**
   ```text
   Montage composant → checkAndTrackSessionStart() → getOrCreateSessionId()
   → [isNew === true] → trackEvent("session_start", { streak, srs_due_count })
   ```
   - Le premier appel à `getOrCreateSessionId()` génère le `sid`, écrit `SESSION_LAST_ACTIVE_KEY = now`, et retourne `isNew: true`.
   - Il invoque `trackEvent("session_start", ...)`.
   - À l'intérieur de cet appel à `trackEvent`, `getOrCreateSessionId()` est ré-appelé : cette fois, `sid` existe et `lastActive` a été mis à jour il y a moins de 1 ms. Il retourne `isNew: false`.
   - La condition d'interception `if (isNew && eventName !== "session_start")` est fausse.
   - Le payload `session_start` est envoyé à GAS une seule fois.

2. **Chemin 2 : Réveil d'activité après inactivité (`updateSessionActivity`)**
   ```text
   Événement d'activité (pointerdown / keydown / visibilitychange)
   → throttle 60s validé → updateSessionActivity() → getOrCreateSessionId()
   → [isNew === true car >30 min] → trackEvent("session_start", getSessionStartParams())
   ```
   - `getOrCreateSessionId()` constate `now - lastActive > 30 min`.
   - Un nouvel UUID de session est immédiatement écrit en `localStorage`, et `lastActive` est mis à jour à `now`.
   - `updateSessionActivity` déclenche `trackEvent("session_start")`.
   - Dans ce `trackEvent`, `getOrCreateSessionId()` retourne `isNew: false`.
   - Un unique `session_start` est émis.

3. **Chemin 3 : Interception proactive lors d'une action directe (`trackEvent`)**
   ```text
   Action utilisateur (ex: clic CTA direct après 45 min)
   → trackEvent("home_cta_clicked", ...) → getOrCreateSessionId()
   → [isNew === true] → trackEvent("session_start", getSessionStartParams())
   → puis émission de l'événement d'origine ("home_cta_clicked")
   ```
   - Si une action utilisateur survient avant que le throttle de 60s de `updateSessionActivity` n'ait réagi, `trackEvent` appelle directement `getOrCreateSessionId()`.
   - Constatant `isNew: true`, il exécute préventivement `trackEvent("session_start")` avec les paramètres extraits du `localStorage`.
   - Lors de cet appel imbriqué, `isNew` vaut `false`.
   - Le `session_start` est transmis, puis l'exécution reprend et envoie l'événement d'origine avec le même `session_id`.

### 3.2. Preuve d'absence de doublon `session_start`

**Où le premier `session_start` est créé :**
- Soit au montage (`checkAndTrackSessionStart`), soit lors du premier appel de réveil (`updateSessionActivity`), soit en interception dans `trackEvent`.

**Comment l'état est mémorisé :**
- L'état est stocké de manière synchrone et persistante dans le `localStorage` du navigateur sous les deux clés `furago_analytics_session_id` et `furago_analytics_last_active`.

**Pourquoi `trackEvent()` ne le renverra pas immédiatement :**
- L'opération d'écriture de `SESSION_LAST_ACTIVE_KEY` dans `getOrCreateSessionId()` est **synchrone** et précède immédiatement le retour de `{ sid, isNew }`. Tout appel subséquent à `getOrCreateSessionId()` dans le même tick d'exécution ou les 30 minutes suivantes trouve un timestamp `lastActive` ultra-récent, garantissant que `isNew` vaut invariablement `false`.
- De surcroît, la garde `if (isNew && eventName !== "session_start")` neutralise toute possibilité d'auto-récursion lors de l'envoi de `session_start`.

**Comportement lors du prochain événement :**
- Pour tout événement ultérieur (ex: `home_viewed`, `home_cta_clicked`), `getOrCreateSessionId()` retourne `isNew: false`. Aucun `session_start` n'est émis, et l'événement est attaché au `session_id` en cours.

---

## 4. Scénarios Session

### Scénario A : Première ouverture / Nouvelle session
```text
Ouverture app → checkAndTrackSessionStart() → isNew: true → 1x session_start
```
- Résultat : **Exactement 1 `session_start`**, suivi des événements contextuels (`home_viewed`).

### Scénario B : Rechargement (F5) à < 30 minutes
```text
Rechargement (<30 min) → checkAndTrackSessionStart() → isNew: false → 0 nouveau session_start
```
- L'ancien `session_id` est conservé, `lastActive` est mis à jour.
- Résultat : **0 nouveau `session_start`**, session continue préservée.

### Scénario C : Onglet laissé ouvert > 30 minutes, puis retour (visibilitychange)
```text
Onglet en veille 45 min → Retour utilisateur → visibilitychange
→ handleActivity() (now - lastUpdate > 60s) → updateSessionActivity()
→ getOrCreateSessionId() → isNew: true → 1x session_start
```
- Résultat : **Exactement 1 nouveau `session_start`** avec un nouveau `session_id`.

### Scénario D : > 30 minutes, retour avec premier clic direct avant toute autre action
```text
Inactivité 45 min → Clic immédiat sur un bouton Home
→ pointerdown déclenche updateSessionActivity() → isNew: true → 1x session_start
→ onClick déclenche trackEvent("home_cta_clicked") → isNew: false → 1x home_cta_clicked
```
*(Si `pointerdown` n'avait pas devancé le clic, l'interception interne dans `trackEvent` aurait produit la même séquence ordonnée : 1x `session_start` puis 1x `home_cta_clicked`).*
- Résultat : **Exactement 1 `session_start`**, aucun doublon.

### Scénario E : Nouvelle session suivie de plusieurs événements consécutifs
```text
Nouvelle session → session_start (isNew: true)
→ home_viewed (isNew: false)
→ home_cta_clicked (isNew: false)
→ article_started (isNew: false)
```
- Résultat : **Strictement 1 seul `session_start`**, tous les événements partagent le même `session_id`.

### Scénario F : Comportement multi-onglets (Multi-tabs)
- Les clés `localStorage` étant partagées de façon synchrone sur l'origine du domaine :
  - **Onglet 2 ouvert pendant que l'Onglet 1 est actif** : L'Onglet 2 lit le `session_id` existant et constate `lastActive < 30 min`. `isNew` vaut `false`. Aucun nouveau `session_start` parasite n'est envoyé ; les deux onglets partagent la même session logique.
  - **Deux onglets inactifs (>30 min) réveillés successivement** : Le premier onglet recevant l'attention utilisateur met à jour le `session_id` et `lastActive` en `localStorage`. Quand l'utilisateur bascule sur le deuxième onglet, ce dernier constate que la session est déjà fraîche et n'émet pas de second `session_start`.
  - **Limite théorique** : En l'absence de Web Locks API (`navigator.locks`), si deux onglets étaient réactivés rigoureusement dans la même milliseconde exacte, deux UUIDs pourraient temporairement entrer en compétition. Dans le cadre d'un usage humain sur un navigateur, cette situation est statistiquement négligeable.

---

## 5. Validation user_id / session_id

| Propriété | `user_id` | `session_id` |
|---|---|---|
| **Clé LocalStorage** | `furago_analytics_user_id` | `furago_analytics_session_id` |
| **Génération** | `generateUUID()` (UUIDv4) | `generateUUID()` (UUIDv4) |
| **Durée de vie** | Permanente (survit aux refresh, fermetures, redémarrages de l'OS) | Éphémère (expire après 30 minutes sans interaction) |
| **Comportement intra-session** | Identique | Identique |
| **Comportement inter-sessions** | **Identique** (ne change jamais) | **Différent** (renouvelé à chaque session) |
| **Confidentialité** | Anonyme (zéro PII, non dérivé d'IP/email) | Anonyme (UUID technique de contexte) |

**Confirmation formelle :**
- Même utilisateur = **Même `user_id`**.
- Même session = **Même `session_id`**.
- Sessions différentes d'un même utilisateur = **Même `user_id`, `session_id` distincts**.

---

## 6. Validation D1 / D7 (Rétention)

Le schéma analytique permet désormais de mesurer rigoureusement la rétention D1 et D7 :

```text
Jour 0 : user_id = "u-abc", session_id = "s-111" → session_start
Jour 1 : user_id = "u-abc", session_id = "s-222" → session_start
Jour 7 : user_id = "u-abc", session_id = "s-333" → session_start
```

### Distinction fondamentale de la métrique de rétention
> [!IMPORTANT]
> **La métrique de rétention de cohorte repose exclusivement sur la persistance de l'identifiant `user_id`, et non sur le `session_id`.**
> 
> - Le `session_id` sert à délimiter et regrouper les interactions d'une même visite de 30 minutes (taux de rebond, profondeur de session, conversion de session).
> - Le `user_id` sert à identifier l'appartenance à une cohorte (date du premier `session_start` observé pour un `user_id`) et à calculer le ratio d'utilisateurs uniques revenant à J+1 et J+7 :
>   $$\text{Rétention D1} = \frac{\text{Nombre de } user\_id \text{ de la cohorte J0 ayant émis un } session\_start \text{ à J1}}{\text{Nombre total de } user\_id \text{ de la cohorte J0}}$$
> 
> Grâce à la détection d'inactivité réveillant les onglets dormants, un utilisateur qui laisse son onglet ouvert sur son smartphone ou son PC et revient le lendemain génère bien un `session_start` avec le même `user_id`, éliminant la sous-estimation critique constatée avant le patch.

---

## 7. Validation Home CTA

Les 4 catégories d'action sur la Home sont désormais clairement distinguées dans le code de `FuragoApp.tsx` :

| Catégorie CTA | Bouton / Élément | Paramètres envoyés | Ligne de code | Action déclenchée |
|---|---|---|---|---|
| **continue** | "続きを読む" ou "次のエピソードへ" | `cta_type: "continue"`, `position: 1` | `FuragoApp.tsx:2309` | `openArticle(continueTarget, false, "home_continue")` |
| **srs** (principal) | "復習する" (quand `dueReviewCount > 0`) | `cta_type: "srs"`, `position: 2` | `FuragoApp.tsx:2333` | `startVocabReview("learned", "home")` |
| **srs** (secondaire) | "保存した単語を練習する" (quand `savedWords.length > 0`) | `cta_type: "srs"`, `position: 3` | `FuragoApp.tsx:2358` | `startVocabReview("saved", "home")` |
| **mission** | "読む" (Daily Mission non complétée) | `cta_type: "mission"`, `position: 2` | `FuragoApp.tsx:2397` | `openArticle(dailyArticle, false, "home_mission")` |
| **recommendation** | Cartes d'articles recommandés (liste de 3 max) | `cta_type: "recommendation"`, `position: 3 + i` | `FuragoApp.tsx:2417` | `openArticle(a, false, "recommendation")` |
| **habit_nudge** | CTA du streak nudge en haut de la Home (6.3-B, états `at_risk` / `broken`) | `cta_type: "habit_nudge"`, `position: 0` | `FuragoApp.tsx` (`runHabitNudgeAction`) | Exécute la Next Best Action existante : `startVocabReview("learned", "home")` / `openArticle(continueTarget \| dailyArticle, ...)` / scroll vers les recommandations |

**Validation spécifique SRS :**
Les deux boutons SRS (revue planifiée `position: 2` et mots sauvegardés `position: 3`) émettent sans ambiguïté `home_cta_clicked` avant d'invoquer `startVocabReview`. L'angle mort du module SRS sur la Home est donc totalement levé.

---

## 8. Validation Attribution Article

L'événement `article_started` est systématiquement émis lors de l'entrée dans un article via `openArticle` :

```typescript
// FuragoApp.tsx:1269-1271
if (source) {
  trackEvent("article_started", { article_id: String(article.id), source });
}
```

Vérification des 4 canaux d'entrée :
1. **Home Continue** : Appel L2310 → `source: "home_continue"` ✅
2. **Home Mission** : Appel L2398 → `source: "home_mission"` ✅
3. **Home Recommandation** : Appel L2418 → `source: "recommendation"` ✅
4. **Catalogue** : Appel L2478 (`filteredArticles.map`) → `source: "catalog"` ✅

**Comportement des flux hors-attribution :**
- L'ouverture d'un épisode suivant depuis l'écran de récompense (L2020, L2036) et la restauration via URL/popstate (L1353) appellent `openArticle` sans paramètre `source`.
- Ces flux ne polluent pas l'attribution d'acquisition des articles, ce qui évite de fausser les ratios d'engagement par canal d'entrée.

---

## 9. Questions Business

À partir de l'instrumentation validée dans le code, voici l'évaluation de faisabilité des 6 questions business :

### Q1 : Quel est le premier CTA cliqué sur la Home ?
- **Réponse** : **OUI**
- **Justification** : Tous les CTAs de la Home sans exception (`continue`, `srs`, `mission`, `recommendation`) émettent `home_cta_clicked` avec leur `cta_type` et leur `position`. En filtrant sur une session donnée le premier événement `home_cta_clicked` survenu après `session_start` ou `home_viewed`, le premier choix de l'utilisateur est déterminé avec certitude.

### Q2 : Quel CTA produit le plus grand taux de complétion ?
- **Réponse** : **OUI**
- **Justification** :
  - Pour les articles : On relie `home_cta_clicked` à `article_started(source)` puis à `article_completed` (et `mission_completed`) via le `session_id` et l'`article_id`.
  - Pour le SRS : On relie `home_cta_clicked(cta_type: "srs")` à `srs_session_started` puis à `srs_session_completed`.
  Le taux de complétion de chaque typologie de CTA est calculable.

### Q3 : Quel CTA produit le meilleur retour à J+1 (D1) ?
- **Réponse** : **OUI**
- **Justification** : À J0, le `user_id` est associé aux `home_cta_clicked` actionnés. À J+1, la présence d'un événement `session_start` pour ce même `user_id` confirme le retour. La segmentation de la rétention D1 par CTA d'entrée ou CTA dominant de J0 est parfaitement réalisable.

### Q4 : Quel CTA produit le meilleur retour à J+7 (D7) ?
- **Réponse** : **OUI**
- **Justification** : Même logique que pour Q3, garantie par la persistance indéfinie de `user_id` et la capture proactive du réveil de session à J+7.

### Q5 : Les utilisateurs ayant du SRS dû ouvrent-ils réellement le SRS ?
- **Réponse** : **OUI**
- **Justification** : `home_viewed` enregistre `srs_due_count: number`. Le passage à l'acte est enregistré par `home_cta_clicked(cta_type: "srs")` et `srs_session_started`. Le ratio d'activation $\frac{\text{Sessions avec clic SRS}}{\text{Sessions avec srs\_due\_count} > 0}$ est directement calculable.

### Q6 : Les utilisateurs avec une Mission disponible la terminent-ils ?
- **Réponse** : **OUI**
- **Justification** : L'exposition de la mission est enregistrée par `home_viewed(has_daily_mission: true)`, le clic par `home_cta_clicked(cta_type: "mission")`, et l'accomplissement par `mission_completed(article_id)`. Le funnel complet (Exposition → Clic → Lecture → Réussite) est disponible.

---

## 10. Limitations Restantes

Seules les limitations réellement constatées dans le code sont documentées :

1. **P2 — `due_count` bridé à 5 dans `srs_session_started` (`FuragoApp.tsx:602-604`) :**
   Le paramètre `due_count` transmet `wordsToReview.length` (résultat de `dueWords.slice(0, 5)`), ce qui reflète la taille du paquet révisé lors de la session (au maximum 5) et non le total réel des mots en attente dans la base de l'utilisateur (`dueWords.length`).
   *(Note d'exploitation : pour évaluer la charge réelle de révision de l'utilisateur, utiliser le champ `srs_due_count` présent dans `home_viewed` ou `session_start`).*

2. **P2 — Déduplication rigide de `home_viewed` (`FuragoApp.tsx:1787`) :**
   La clé de mémoïsation `home_viewed_${dueReviewCount}_${dailyArticle?.id}_${continueTarget?.id}` empêche tout doublon lors des re-renders React. En contrepartie, si l'utilisateur quitte la Home vers le Catalogue puis revient sur la Home sans qu'aucun état (mots dus, cible continue) n'ait changé, aucun second `home_viewed` n'est émis. Le nombre total de "vues de page Home" est donc inférieur au nombre réel de passages sur la vue, mais reflète fidèlement le nombre de configurations d'état exposées.

3. **Absence de verrou Web Locks API pour le multi-onglets :**
   La synchronisation repose sur `localStorage`. Une course concurrente milliseconde-près reste théoriquement concevable si deux onglets dormants étaient réveillés simultanément par un script ou une automatisation.

4. **Horodatage client non synchronisé serveur :**
   Le champ `timestamp` est généré par `new Date().toISOString()`. Les terminaux avec des horloges locales déréglées peuvent perturber le tri chronologique absolu global, bien que la cohérence intra-session reste préservée.

5. **Endpoint Google Apps Script sans authentification :**
   Le webhook GAS est exposé publiquement côté client sans signature HMAC ni token d'API, assumé pour ce stade MVP.

6. **Pratique des mots sauvegardés sans `srs_session_started` :**
   Le clic sur "保存した単語を練習する" émet bien `home_cta_clicked(cta_type: "srs", position: 3)`, mais n'émet pas `srs_session_started` car la fonction conditionne cet événement à `source !== "saved"`.

---

## 11. Verdict d'Exploitabilité

### Verdict : **EXPLOITABLE AVEC LIMITES**

### Justification :
1. **Éligibilité à l'exploitation immédiate** : L'infrastructure analytique permet de répondre de façon affirmative (**OUI**) aux 6 questions business fondamentales. La capture des flux de la Home, du Catalogue, et des sessions multi-jours (D1/D7) est techniquement fiable et sans doublons de session. Une collecte de baseline de référence peut démarrer dès maintenant.
2. **Réserves à respecter lors de l'analyse (Limites)** :
   - Pour analyser le retard de révision réel de l'utilisateur, utiliser `session_start.srs_due_count` ou `home_viewed.srs_due_count`, et **ne pas** se baser sur `srs_session_started.due_count` (qui plafonne à 5).
   - Pour analyser l'attractivité de la Home, privilégier le ratio de conversion $\frac{\text{home\_cta\_clicked}}{\text{home\_viewed}}$ en ayant conscience que `home_viewed` compte les états de Home uniques et non les allers-retours purs.
   - Les cohortes D1/D7 doivent être calculées par regroupement sur `user_id` et non sur `session_id`.

---

## 12. Contrôle du Diff

- **Fichiers sources modifiés lors de cette tâche** : **AUCUN** (Mode STRICTEMENT READ-ONLY respecté).
- **Fichiers créés** : Uniquement `FURAGO_ANALYTICS_FINAL_VALIDATION.md`.
- **Intégrité du code** : Aucune modification de logique, d'UI, d'endpoint, d'événement ou de Next Best Action n'a été introduite.

---

## 13. Conclusion

Le MVP Analytics de Furago est prêt pour l'entrée en phase de collecte de baseline. L'instrumentation fournit des données propres et cohérentes pour guider les prochaines itérations produit (notamment la priorisation de la Home et l'algorithme Next Best Action).
