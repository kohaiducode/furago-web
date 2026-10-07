# Audit Accessibilité P2 & Gestion des erreurs TTS (Furago)

## 1. Executive Summary

Cet audit identifie les problèmes d'accessibilité P2 restants liés aux contrôles "icon-only" et à la robustesse du moteur TTS (Text-To-Speech). Le projet traite globalement bien les attributs de base (titres, rôles), mais présente des améliorations nécessaires sur la précision des noms accessibles (usage exclusif de `title` sans `aria-label`) et la consistance de l'UI en cas d'absence ou d'échec du TTS.

**Résultat : 0 P1 / 4 P2 identifiés.**
Aucun fichier source n'a été modifié lors de cet audit.

## 2. Icon-only controls

Le tableau ci-dessous liste les contrôles composés uniquement d'icônes visuelles (SVG ou caractères) et analyse leur nom accessible.

| Fichier | Composant | Ligne | Contrôle | Nom accessible actuel | Problème | Sévérité | Correction minimale |
| ------- | --------- | ----: | -------- | --------------------- | -------- | -------- | ------------------- |
| `FuragoApp.tsx` | Lead Modal (Close) | 4100 | `<button> × </button>` | *Aucun* | Caractère `×` prononcé littéralement ("croix" / "fois") sans contexte. Aucun `title` ou `aria-label`. | P2 | Ajouter `aria-label="Fermer"` (ou via i18n). |
| `FuragoApp.tsx` | Dict Audio Pronunciation | 3147, 3312, 3456 | `<button> <svg>... </button>` | `title={t.words.listenPronunciation}` | `title` n'est pas toujours restitué de manière fiable comme nom principal par tous les lecteurs d'écran. | P2 | Ajouter `aria-label={t.words.listenPronunciation}`. |
| `FuragoApp.tsx` | Dict Save To List | 3429 | `<button> <svg>... </button>` | `title={t.dict.saveToList}` | Idem. | P2 | Ajouter `aria-label={t.dict.saveToList}`. |
| `FuragoApp.tsx` | Audio Player (Prev/Next/Restart) | 3536, 3567, 3632 | `<button> <svg>... </button>` | `title={t.reading...}` | Idem. | P2 | Dupliquer le contenu du `title` dans un `aria-label`. |

*Note: L'ajout de `aria-label` est préférable à la seule présence de `title` pour assurer une compatibilité maximale.*

## 3. Play/Pause

**Contrôle analysé :** Audio Panel Play/Pause (`FuragoApp.tsx` : 3598)
* **Comportement actuel :** Le contrôle possède uniquement `title={t.reading.playPause}` (ex: "Play / Pause"). L'icône SVG change visuellement, mais le nom accessible reste statique.
* **Problème :** Un lecteur d'écran ne perçoit pas le changement d'état ou l'action immédiate proposée par le bouton (ex: "Lire" vs "Suspendre").
* **Sévérité :** P2
* **Correction recommandée :** 
  * *Option 1 :* Ajouter l'attribut `aria-pressed={isPlaying && !isPaused}`. C'est la solution la plus simple sans modifier les fichiers de traduction.
  * *Option 2 :* Utiliser un `aria-label` dynamique si des traductions séparées sont ajoutées (ex: `aria-label={isPlaying ? "Pause" : "Play"}`).

## 4. Other Audio Controls

Les autres contrôles audio du player (Precedent, Suivant, Recommencer) utilisent également un attribut `title` statique. Contrairement au Play/Pause, leur action ne bascule pas (toggle), le texte de `title` est donc sémantiquement correct. Il suffit de l'appliquer via `aria-label` (cf. section 2) pour s'assurer qu'il soit bien restitué.

## 5. TTS Error Handling

L'implémentation de la lecture TTS est gérée via `SpeechSynthesisUtterance`. Voici l'analyse de sa robustesse aux erreurs :

| Fichier | Fonction | Scénario d'erreur | Comportement actuel | Problème | Sévérité | Correction recommandée |
| ------- | -------- | ----------------- | ------------------- | -------- | -------- | ---------------------- |
| `FuragoApp.tsx` | `handlePlayPause` / `playNextInQueue` | **API TTS non disponible** (`speechSynthesis` absent de `window`) | La fonction retourne silencieusement en début d'appel, mais `isPlaying` a déjà été passé à `true`. | L'interface bascule en état de lecture (icône Pause) mais aucun son n'est émis et la progression reste bloquée. (Désynchronisation UI/Audio). | P2 | Vérifier la disponibilité de l'API *avant* de basculer l'état `isPlaying` à `true`. |
| `FuragoApp.tsx` | `utterance.onerror` | **Interruption due au `cancel()`** (ex: clic sur Pause ou Next) | Dans certains navigateurs, `cancel()` déclenche l'événement `onerror` (avec `error="canceled"` ou `"interrupted"`). Le gestionnaire actuel réinitialise tout (arrêt). | Un clic sur "Pause" pourrait provoquer l'arrêt total de la lecture au lieu de simplement la suspendre, perdant la position de l'utilisateur. | P2 | Filtrer dans `onerror` : `if (e.error === 'canceled' || e.error === 'interrupted') return;`. |
| `FuragoApp.tsx` | `utterance.onerror` | **Échec réel du TTS en cours de lecture** | L'événement réinitialise `isPlaying` et `isPaused` à `false` et supprime le surlignage. | L'état UI redevient bien cohérent (arrêt). Cependant, l'utilisateur n'a aucun feedback pour expliquer pourquoi la lecture s'est arrêtée. | Amélioration | Afficher un petit toast d'erreur non-bloquant. |

## 6. UI State Consistency

Globalement, l'interface retrouve bien un état cohérent lors d'une erreur soulevée par `onerror`. La seule faille majeure de consistance d'état se situe lors de l'absence totale de l'API TTS (le navigateur ne supporte pas l'API ou l'utilisateur l'a bloquée), où l'interface reste visuellement figée sur "Lecture en cours" indéfiniment.

## 7. False Positives / Already Correct

Les éléments suivants ont été inspectés et sont déjà corrects :
* **Bouton Fermeture Modale Dictionnaire** (`FuragoApp.tsx`: 3473) : Possède déjà `aria-label="Fermer"`.
* **Bouton Fermeture Modale Filtre** (`FuragoApp.tsx`: 3792) : Possède déjà `aria-label="Fermer"`.
* **Boutons Prononciation isolée (`speakWord`)** : Ces méthodes interceptent silencieusement les échecs et ne sont liées à aucun état UI critique (pas de désynchronisation de l'UI si l'appel échoue).

## 8. Priorités

* **P1** : Aucun.
* **P2** :
  1. Gérer l'état UI quand `speechSynthesis` est absent (empêcher `isPlaying = true`).
  2. Filtrer les erreurs `"canceled"`/`"interrupted"` dans `onerror` pour préserver le comportement de la fonction Pause.
  3. Ajouter un attribut `aria-label` aux contrôles "icon-only" (player audio, dictionnaire, et modale Lead).
  4. Ajouter `aria-pressed` au bouton Play/Pause.
* **Améliorations facultatives** : Ajouter un Toast d'information lors d'une erreur inattendue du TTS en pleine lecture.

## 9. Correctifs minimaux recommandés

1. `aria-label` : Copier les valeurs des props `title` vers `aria-label` pour les SVG listés. Ajouter `aria-label="Fermer"` au bouton Lead (`×`).
2. `aria-pressed` : Ajouter `aria-pressed={isPlaying && !isPaused}` au bouton Play/Pause.
3. `UI Sync` : Déplacer le `setIsPlaying(true)` après avoir vérifié que `speechSynthesis` existe, ou vérifier l'existence avant de déclencher `playNextInQueue()`.
4. `onerror robustesse` : Ajouter `if (e.error === 'canceled' || e.error === 'interrupted') return;` au début de `utterance.onerror`.

## 10. Risques de régression

Les correctifs recommandés ciblent de la sémantique pure (attributs ARIA) et des conditions d'état existantes. Le risque de régression visuelle ou fonctionnelle est quasi-nul. Il est cependant recommandé de bien tester la pause après avoir ignoré `"canceled"` dans `onerror` afin de vérifier que la gestion interne (basée sur `isPausedRef`) s'occupe bien de figer le progrès.

## 11. Conclusion

L'implémentation audio et TTS est fonctionnellement robuste mais nécessite un ajustement des états d'erreur limitant les désynchronisations de l'UI. Au niveau accessibilité sémantique, la migration de simples attributs `title` vers une prise en charge systématique via `aria-label` ou `aria-pressed` viendra achever la validation P2 des contrôles interactifs compacts.
