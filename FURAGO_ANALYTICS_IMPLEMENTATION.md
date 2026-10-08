# Furago Analytics MVP - Rapport d'Implémentation

## 1. Outil choisi

**Google Sheets (via l'existant Google Apps Script)**

*Pourquoi ?*
Le projet utilise déjà un Google Apps Script (`NEXT_PUBLIC_GOOGLE_SCRIPT_URL`) pour collecter des données (leads).
Il s'agit de la solution MVP parfaite pour ce projet sans base de données dédiée, car :
1. **0 dépendance** supplémentaire.
2. Impact quasi nul sur les performances et le bundle size (utilise l'API `fetch` native).
3. Confidentialité totale : aucune donnée envoyée à un tiers commercial (Plausible, PostHog, etc.).
4. Coût zéro, idéal pour une première baseline d'événements.
5. Permet la gestion des cohortes directement avec des TCD (tableaux croisés dynamiques) sur le tableur en regroupant par `session_start` et `user_id`.

## 2. Architecture

Une couche centrale a été créée dans `src/lib/analytics.ts`.
Toutes les instrumentations de l'application passent par la fonction `trackEvent(eventName, params)`.
La fonction utilise un type strict `EventName` et une interface `AnalyticsEventParams` pour empêcher l'envoi d'événements mal formés ou de paramètres manquants.
L'envoi des requêtes `fetch` est de type "fire and forget" via un `.catch(() => {})`, garantissant que l'UI n'est jamais bloquée.

## 3. Identification anonyme

Un UUIDv4 anonyme est généré via `crypto.randomUUID()` et sauvegardé indéfiniment dans le `localStorage` sous la clé `furago_analytics_user_id`.
Aucune donnée personnelle n'est lue ni rattachée. La clé n'est jamais exposée dans l'URL.

## 4. Gestion des sessions

La règle de session : **30 minutes d'inactivité**.
Un UUID `furago_analytics_session_id` et un timestamp `furago_analytics_last_active` sont conservés. L'activité est mise à jour de manière "throttled" sur la base d'événements globaux (`visibilitychange`, `keydown`, `pointerdown`) ainsi que lors du premier chargement de l'application. Si le timeout est dépassé, un nouveau Session ID est généré.

## 5. Événements implémentés

| Event | Déclencheur | Paramètres |
| ----- | ----------- | ---------- |
| `session_start` | A la création d'un nouveau session_id (montage de FuragoApp) | `streak`, `srs_due_count` |
| `home_viewed` | Affichage de l'écran principal (dédupliqué via useRef) | `srs_due_count`, `has_daily_mission`, `has_continue_article`, `streak_state` |
| `home_cta_clicked` | Clic sur Continuer, Mission, Recommandé (sur Home) ou CTA du streak nudge (6.3-B) | `cta_type` (`continue`, `mission`, `srs`, `recommendation`, `habit_nudge`), `position` (`0` = habit nudge) |
| `article_started` | L'ouverture effective d'un article via `openArticle` | `article_id`, `source` |
| `article_completed` | Lorsque l'utilisateur atteint l'écran de complétion | `article_id` |
| `srs_session_started`| Au clic sur Réviser, lancement de la série de révision | `due_count` |
| `srs_session_completed`| Arrivée sur l'écran "Review Completed!" | `reviewed_count`, `correct_count` |
| `mission_completed` | Complétion de l'article taggé comme daily mission | `article_id` |

## 6. Points d'intégration

- **`src/lib/analytics.ts`** : cœur du MVP.
- **`src/components/FuragoApp.tsx`** :
  - Modification de `openArticle` pour supporter `source`.
  - Modification des CTAs de la Home pour appeler `trackEvent`.
  - Injection de `useEffect`s locaux pour observer passivement `activeView` et `vocabReviewIndex`.

## 7. Protection contre les doublons

1. **`home_viewed`** : sécurisé via un dictionnaire dans une `useRef` pour ne fired qu'une seule fois avec les mêmes paramètres exacts pendant le cycle de vie de la page.
2. **`srs_session_completed`** : déclenché au moment du changement d'état via un indicateur dans `useRef`.
3. **`session_start`** : conditionné par le retour direct `isNew` au moment de l'initialisation du local storage.
4. **`article_completed` / `mission_completed`** : attachés aux blocs conditionnels qui attribuent les récompenses, ces blocs incluant un test sur `sessionReward === null` afin d'éviter d'exécuter la logique plusieurs fois à cause des re-renders.

## 8. Privacy / Consentement

- **Aucun cookie** n'est utilisé.
- Données strictement anonymes (UUID randomisé) stockées dans le `localStorage`.
- L'outil choisi n'étant pas un tiers traquant l'utilisateur à des fins publicitaires, le niveau de risque est minimal. En UE (ePrivacy), la lecture du `localStorage` sans consentement reste une zone grise pour l'analytics strict, mais ce système satisfait au critère de "ne pas bloquer la mise en place du MVP derrière un système juridique complet" pour ce proof of concept.

## 9. Performance

- Appels asynchrones, `fetch` isolés de l'interface utilisateur.
- Écoute de l'activité (`pointerdown`, etc.) en mode `passive: true` avec une limite stricte (throttle > 1 minute).
- Zéro dépendance npm.

## 10. Typecheck / Lint / Build

- Validation : Typecheck strict via TypeScript (`EventName`, `AnalyticsEventParams`).
- Build : Sans erreur.

## 11. Contrôle du diff

Un seul nouveau fichier a été créé. Les modifications dans `FuragoApp.tsx` sont ciblées sur l'ajout d'analytics : `onClick`, `openArticle`, `useEffect`. Le comportement existant (NBA, SRS, flow) n'a pas été altéré.

## 12. Limites

- Le script Google Apps Script existant devra supporter l'action `log_event` sans surcharger la capacité de l'API Sheets. Si les logs dépassent la limite Google Sheets, il sera facile de brancher l'URL sur un endpoint Cloudflare ou Vercel Serverless.
- Les rechargements "durs" prolongeront la session, la condition `session_start` étant évaluée principalement côté client.

## 13. Prochaines données à observer

Une fois la baseline mesurée, observer le tunnel de complétion :
1. Taux de transformation `home_viewed` -> `article_started`
2. Ratio `article_started` -> `article_completed`
3. Cohorte "Jour 1" -> "Jour 7" (sur les Session IDs)

## 14. Statut

`PASS`
