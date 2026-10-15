# Audit Analytics : Mesure de la Rétention Furago

## 1. Executive Summary
L'audit du code source de Furago révèle une absence totale de système analytique (Product Analytics) permettant de mesurer l'utilisation réelle de l'application et la rétention. À l'exception d'un système de capture d'emails (Lead Gen) vers un Google Script, aucun événement lié à la navigation, aux interactions UI, aux sessions ou à la rétention n'est tracké. La vérification objective de la nouvelle hiérarchie de la Home est donc impossible en l'état. Il est nécessaire de déployer un système "Minimum Viable Analytics" avant de modifier l'UX.

## 2. Système Analytics actuel
Aucun système de Product Analytics n'est installé.
- **Firebase Analytics, Google Analytics (GA4), PostHog, Mixpanel, Amplitude, Plausible, Umami, Vercel Analytics :** Absents du `package.json` et des imports.
- **Fonctions custom (`track`, `logEvent`, etc.) :** Absentes de l'application cliente.
- L'unique appel réseau (fetch) est dédié à la fonctionnalité "Lead Generation" (enregistrement d'email) vers Google Apps Script.

## 3. Événements existants
**Zéro événement analytique** n'est actuellement envoyé.
Aucune trace d'événements de clic, de navigation, d'affichage, ou de progression.

## 4. Funnel Home
Le funnel `session_start -> Home affichée -> premier CTA cliqué` **ne peut pas être mesuré.**
Impossible de distinguer quel est le premier CTA cliqué (Continue, Mission, SRS, Recommendation).

## 5. Funnel Mission
Le funnel `Mission affichée -> Mission commencée -> Mission terminée` **ne peut pas être mesuré.**
Impossible de mesurer l'impression, le clic, la progression, la complétion ou l'abandon.

## 6. Funnel SRS
Le funnel `SRS disponible -> Review ouverte -> mots révisés -> session terminée` **ne peut pas être mesuré.**
Les statistiques de session et la progression (mots dus, justes/faux) sont sauvegardés localement (localStorage), mais ne remontent vers aucun outil d'analyse. Impossible d'étudier le comportement d'abandon du SRS.

## 7. Funnel Article
Le funnel `Article affiché -> Article commencé -> Article terminé -> vocabulaire gagné` **ne peut pas être mesuré.**
L'application mémorise le scroll (`articleProgress` dans `UserState`) et l'article terminé localement, mais n'envoie aucun événement d'impression, d'ouverture, de progression ou d'abandon.

## 8. Rétention D1 / D7 / D30
**Impossible à calculer.**
Le localStorage conserve un `lastActivityDate`, un `currentStreak` et un `longestStreak` à des fins d'UX (gamification), mais ces données restent dans le navigateur. Il n'y a pas d'événement de type `session_start` avec un `user_id` persistant envoyé à un serveur, rendant tout calcul de cohorte ou de rétention par jour (D1, D7, D30) irréalisable.
- *Ce qui est mesurable :* Rien pour le Product/Data.
- *Ce qui nécessite un événement supplémentaire :* Un système identifiant de façon anonyme un utilisateur (ex: UUID généré localement) et l'envoi d'un événement `session_start`.

## 9. Données utilisateur envoyées
Actuellement, **aucune donnée utilisateur n'est envoyée à des fins d'analytics**.
Les seules données exportées sont celles saisies explicitement par l'utilisateur dans la modale d'inscription (Email, Prénom, Niveau, Catégories) envoyées à Google Sheets.
Les données pertinentes (niveau CEFR, XP, streak, nombre de mots SRS dus, article ID en cours) sont confinées au navigateur (`UserState`).

## 10. Consentement / Privacy
Il n'existe actuellement **aucune gestion du consentement** :
- Pas de bannière cookies.
- Pas d'opt-in / opt-out.
- Pas de privacy settings.
*Risque identifié :* Lors de l'intégration du futur système Analytics (même respectueux de la vie privée comme PostHog/Plausible/Umami), il faudra implémenter une gestion du consentement pour être conforme au RGPD et aux lois sur la protection des données, ou choisir une solution "cookieless" totalement anonymisée selon la juridiction visée.

## 11. Gaps Analytics
Voici les événements manquants classés par priorité :

| Événement proposé | Pourquoi | Priorité | Paramètres minimaux |
| ----------------- | -------- | -------- | ------------------- |
| `session_start` | Identifier les sessions et calculer la rétention (D1/D7/D30) | **P0** | `user_id` (UUID local), `session_id`, `streak`, `srs_due_count` |
| `home_viewed` | Mesurer l'exposition aux différents blocs de la Home | **P0** | `srs_due_count`, `has_daily_mission`, `has_continue_article` |
| `home_cta_clicked` | Savoir quel bouton est choisi en premier (Question 1) | **P0** | `cta_type` (continue, mission, srs, recommendation), `position` |
| `article_started` | Début de l'activité principale | **P1** | `article_id`, `source` (home_continue, home_mission, catalog) |
| `article_completed` | Fin d'activité et succès (Question 3) | **P1** | `article_id`, `duration_seconds` |
| `srs_session_started` | Engagement avec la rétention de vocabulaire (Question 5) | **P1** | `due_count` |
| `srs_session_completed`| Fin de session de révision | **P1** | `reviewed_count`, `correct_count`, `duration_seconds` |
| `mission_completed` | Succès de l'objectif quotidien (Question 6) | **P2** | `article_id` |

## 12. Minimum Viable Analytics recommandé
Pour éviter une instrumentation excessive tout en répondant aux questions business, l'instrumentation doit se limiter à :
1. Générer et stocker un UUID persistant anonyme dans le `localStorage`.
2. Envoyer **`session_start`** (pour les cohortes D1/D7).
3. Envoyer **`home_cta_clicked`** (pour départager Continue, Mission, SRS).
4. Envoyer **`activity_completed`** (article fini ou SRS fini).

## 13. Données nécessaires pour Next Best Action
Pour comparer objectivement les CTA (SRS vs Mission vs Continue) et répondre aux questions 2, 4 et 7 :
- **Taux de clic :** Ratio `home_cta_clicked` / `home_viewed` par `cta_type`.
- **Taux de complétion :** Ratio `activity_completed` / `home_cta_clicked` par `cta_type` (mesure la frustration vs réussite).
- **Retour D1/D7 par CTA :** Croisement du premier `cta_type` cliqué lors d'une session (Jour 0) avec la présence d'un événement `session_start` aux Jours 1 et 7 pour le même `user_id`. (Nécessite impérativement le paramètre `user_id`).

## 14. Priorités
1. Choisir l'outil Analytics (ex: PostHog pour l'intégration facile avec Next.js et la gestion de cohortes / rétention).
2. Définir une fonction `trackEvent(eventName, properties)` branchée sur l'outil choisi.
3. Générer un `user_id` UUID unique stocké dans le `localStorage` pour lier les sessions d'un même navigateur sans données personnelles.
4. Implémenter le "Minimum Viable Analytics" (session_start, home_cta_clicked, activity_completed).
5. (Optionnel selon l'outil) Mettre en place un bandeau de consentement ou utiliser le mode "cookieless" / IP maské.

## 15. Conclusion
Furago est actuellement complètement aveugle sur son utilisation. Modifier l'UX de la Home dès maintenant reviendrait à naviguer à vue. Avant toute refonte de la hiérarchie (`1. SRS, 2. Mission, 3. Continue, 4. Recos`), il est impératif d'intégrer un tracking minimal pour établir une "baseline" de l'existant. Cela permettra de comparer la performance de l'ancienne et de la nouvelle version via A/B testing ou test séquentiel (avant/après).
