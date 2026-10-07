# Rapport de Validation — MVP Analytics Furago

## 1. Executive Summary
L'implémentation du MVP Analytics pose de bonnes fondations : elle est respectueuse de la vie privée, légère, et ne bloque jamais l'expérience utilisateur. L'architecture globale est cohérente avec les spécifications. Cependant, des lacunes critiques dans l'instrumentation de certains flux (SRS, Catalogue) et dans la gestion du cycle de vie des sessions (onglets laissés ouverts) empêchent d'exploiter pleinement les données pour répondre aux questions produit (mesure D1/D7 et efficacité de la Home). 

**Verdict : Insuffisant** en l'état pour prendre des décisions stratégiques sur l'optimisation de la Home.

## 2. Architecture Analytics Réelle
- **Fichier principal** : `src/lib/analytics.ts`
- **Fonction centrale** : `trackEvent(eventName, params)`
- **Identification (`user_id`)** : UUIDv4 généré et stocké dans le `localStorage` sous `furago_analytics_user_id`.
- **Session (`session_id`)** : UUIDv4 avec une durée de vie de 30 minutes, basée sur la clé `furago_analytics_last_active`.
- **Endpoint de collecte** : Script Google Apps (GAS) appelé via l'API `fetch` standard.
- **Format du payload** : JSON stringifié (action, event, params, user_id, session_id, timestamp) envoyé en méthode POST (`text/plain` pour éviter le preflight CORS).
- **Intégration** : L'instrumentation se fait au niveau de `src/components/FuragoApp.tsx` (handlers `onClick`, appels directs dans `openArticle`, et hooks `useEffect`).

## 3. Validation des 8 événements

| Event | Existe | Fichier | Trigger | Paramètres réels | Risque de doublon | Statut |
|---|---|---|---|---|---|---|
| `session_start` | ✅ Oui | `analytics.ts` / `FuragoApp.tsx` | `useEffect` au montage (init) | `streak`, `srs_due_count` | ❌ Faux positif : absent si l'onglet reste ouvert | ⚠️ Incomplet |
| `home_viewed` | ✅ Oui | `FuragoApp.tsx` | `useEffect` (`activeView === "home"`) | `srs_due_count`, `has_daily_mission`, `has_continue_article` | ❌ Aucun. Très protégé par `useRef`. | ✅ OK (mais rigide) |
| `home_cta_clicked` | ✅ Oui | `FuragoApp.tsx` | `onClick` sur les boutons Home | `cta_type`, `position` | ❌ Aucun | ⚠️ Manque SRS |
| `article_started` | ✅ Oui | `FuragoApp.tsx` | Fonction `openArticle` | `article_id`, `source` | ❌ Aucun | ⚠️ Manque Catalog |
| `article_completed` | ✅ Oui | `FuragoApp.tsx` | `useEffect` à l'affichage du Reward | `article_id` | ✅ Se renvoie lors d'une relecture (intentionnel) | ✅ OK |
| `srs_session_started` | ✅ Oui | `FuragoApp.tsx` | `startVocabReview` (source "learned") | `due_count` (bridé à 5) | ❌ Aucun | ⚠️ Paramètre faussé |
| `srs_session_completed`| ✅ Oui | `FuragoApp.tsx` | `useEffect` à la fin de révision | `reviewed_count`, `correct_count` | ❌ Aucun. Protégé par `analyticsFiredRef`. | ✅ OK |
| `mission_completed` | ✅ Oui | `FuragoApp.tsx` | `useEffect` identique à article_completed | `article_id` | ✅ Se renvoie lors d'une relecture (intentionnel) | ✅ OK |

## 4. Validation `user_id`
- Créé au besoin (`generateUUID`) et stocké dans le `localStorage`.
- Persiste après refresh, fermeture et réouverture.
- Reste identique lors d'une nouvelle session.
- Il s'agit d'un UUID 100% anonyme. Il n'est dérivé d'aucune donnée personnelle (ni email, ni profil, ni IP cliente).
- Si l'utilisateur efface le cache/localStorage, il est perdu (ce qui est le comportement attendu en l'absence de compte).

## 5. Validation `session_id`
- Généré à la volée par `getOrCreateSessionId()`.
- **Problème majeur identifié** : L'activité utilisateur (`updateSessionActivity`) prolonge indéfiniment la session précédente sans jamais vérifier l'expiration.
- De plus, même si un nouveau `session_id` est régénéré dynamiquement par `trackEvent` lors d'une action, cela ne déclenche **pas** l'événement `session_start` (qui n'est invoqué qu'au montage global de React).

## 6. Validation de la capacité D1 / D7
- **Possible techniquement** : Les événements d'une même cohorte peuvent être reliés au même `user_id` à travers plusieurs jours.
- **Réalité actuelle** : Les calculs de rétention seront **fortement sous-évalués**. Si un utilisateur revient au Jour 1 ou au Jour 7 sans rafraîchir l'onglet, aucun événement `session_start` n'est déclenché pour ce nouveau jour. La cohorte semblera avoir abandonné l'application, alors qu'ils l'utilisent depuis un onglet conservé en arrière-plan.

## 7. Validation de l'horodatage
- **Côté client uniquement** : Le timestamp est généré par `new Date().toISOString()` juste avant l'envoi.
- **Risques** : Sensible aux horloges locales incorrectes. Ne permet pas un ordonnancement garanti absolu au niveau serveur, mais la chronologie interne des actions de l'utilisateur lors d'une session reste exploitable.

## 8. Risques de doublons
L'application est exceptionnellement bien protégée contre les doublons accidentels :
- **useRef (analyticsFiredRef)** : Garantit qu'un événement comme `home_viewed` ou `srs_session_completed` n'est envoyé qu'une seule fois par cycle de vie de vue. Un retour arrière sur la Home ne redéclenche l'événement que si l'état (donc la clé du cache) a changé.
- **sessionReward === null** : Garantit qu'une completion d'article ne s'envoie qu'une seule fois par session de lecture, même avec des re-renders React.

## 9. Résilience réseau (Échec du tracking)
- Totalement résilient. L'appel `fetch().catch(() => {})` avale silencieusement toutes les erreurs (timeout, indisponibilité, offline, 4xx, 5xx).
- Le tracking ne bloquera jamais une navigation, ni la validation d'une mission, et ne provoquera aucune erreur React.

## 10. Endpoint / Google Apps Script
- L'endpoint public reçoit un payload sans authentification (conception assumée pour ce MVP).
- Pas de blocage côté client, mais la limite de quota de Google Sheets pourrait être exposée au spam.

## 11. Privacy
- **Conforme.** Aucune donnée personnelle, email, prénom, nom ou contenu de profil n'est transmise. Seuls des identifiants techniques (`uuid`, `article_id`) et des données statistiques (scores, streaks) transitent.

## 12. Peut-on mesurer les questions Business ?
*Basé sur le code existant et fonctionnel* :

- **Q1 : Quel est le premier CTA cliqué sur Home ?** → **NON**. Le CTA "Réviser" (SRS) n'est pas tracké dans `home_cta_clicked`.
- **Q2 : Quel CTA produit le plus de completions ?** → **PARTIELLEMENT**. Les articles ouverts depuis le catalogue ne déclenchent aucun événement `article_started` avec leur source, créant un trou noir d'attribution.
- **Q3 : Quel CTA produit le meilleur retour D1 ?** → **PARTIELLEMENT**. (Sessions aveugles si l'onglet reste ouvert).
- **Q4 : Quel CTA produit le meilleur retour D7 ?** → **PARTIELLEMENT**. (Idem Q3).
- **Q5 : Les utilisateurs avec SRS dû ouvrent-ils réellement SRS ?** → **NON**. Aucun tracking de ce clic CTA spécifique.
- **Q6 : Les utilisateurs avec Mission disponible la terminent-ils ?** → **OUI**. `home_viewed` confirme la disponibilité, `mission_completed` confirme la réussite.

## 13. Gaps à corriger

| Problème | Impact | Priorité | Correction minimale |
|---|---|---|---|
| Clic sur le CTA SRS non tracké | Les données de la Home sont amputées de leur CTA le plus important. | **P0** | Ajouter `trackEvent("home_cta_clicked", ...)` dans `startVocabReview` ou au niveau du bouton. |
| Ouverture depuis le Catalogue non trackée | Impossible de différencier le trafic organique du trafic Home. | **P0** | Passer la source `"catalog"` à `openArticle` dans le rendu de la liste. |
| Sessions fantômes (onglet actif ignoré) | Faussent complètement les métriques D1/D7. | **P1** | Faire de `getOrCreateSessionId` le seul responsable de l'update de `last_active`, ou déclencher `session_start` au réveil de la page. |
| `due_count` sur SRS bridé à 5 | Le paramètre envoie la limite de la session, pas la vraie charge de l'utilisateur. | **P2** | Passer `dueWords.length` complet au paramètre `due_count`. |
| `home_viewed` trop strict | Un retour utilisateur sur la Home ne compte pas comme une "vue" si l'état n'a pas muté. | **P2** | Gérer la réinitialisation de `analyticsFiredRef` quand on quitte la vue Home. |

## 14. Suffisance du MVP Analytics
**Insuffisant.** Bien que l'infrastructure technique soit robuste, l'absence des événements pour le bouton SRS et le Catalogue, couplée au dysfonctionnement du renouvellement de session sur longue durée, rendent la donnée inexploitable pour évaluer correctement la Home ou la rétention globale. Ces ajustements (P0 et P1) sont requis avant de lancer des analyses de cohorte.
