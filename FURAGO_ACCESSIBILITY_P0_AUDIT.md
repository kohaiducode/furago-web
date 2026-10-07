# Audit d'Accessibilité : Clavier et Modales

## 1. Executive Summary

Cet audit se concentre strictement sur l'accessibilité au clavier et la gestion des modales dans `FuragoApp.tsx`. 
L'inspection révèle que la navigation principale est bloquée pour les utilisateurs navigant au clavier. Les éléments de vocabulaire interactifs sont implémentés via des balises non sémantiques (`div`, `span`, `h3`) sans gestion du focus ni des événements clavier. Par ailleurs, toutes les modales de l'application (Filtres, Newsletter, Listes) souffrent d'une absence de séquestration du focus (focus trap), de l'impossibilité de les fermer avec la touche `Escape`, et d'un manque d'attributs ARIA. 

La majorité des problèmes identifiés sont de niveau P0 (bloquants).

---

## 2. Éléments de vocabulaire interactifs

Trois types d'éléments interactifs posent problème dans `src/components/FuragoApp.tsx` :

### A. TargetVocabularyItem (En-tête d'article)
* **Élément HTML :** `<div onClick=...>` (ligne 131)
* **Action :** Ouvre la popup du dictionnaire.
* **Accessible au clavier :** Non.
* **Focusable :** Non.
* **Activation par Enter/Space :** Non (aucun `onKeyDown`).
* **Sémantique :** `role` et `tabIndex` absents.
* **Zone cliquable :** Bonne taille (`padding: 10px 14px`).
* **Risque de régression `<button>` :** Faible. Remplacer par un `<button type="button">` nécessitera d'ajouter un reset CSS pour retirer les bordures et fonds par défaut du navigateur, mais la structure Flexbox actuelle restera intacte.

### B. Mots cliquables dans le texte (renderInteractiveContent)
* **Élément HTML :** `<span onClick=...>` (ligne 1633)
* **Action :** Ouvre la popup du dictionnaire pour le mot cliqué.
* **Accessible au clavier :** Non.
* **Focusable :** Non.
* **Activation par Enter/Space :** Non.
* **Sémantique :** `role` et `tabIndex` absents.
* **Risque de régression `<button>` :** Modéré. Remplacer le `span` par un `<button>` nécessite un soin particulier sur les styles CSS (`all: unset; display: inline; cursor: pointer; font: inherit;`) pour éviter de casser le flux (line-height, marges) du paragraphe.

### C. Mots dans la liste de vocabulaire (Vue "words")
* **Élément HTML :** `<h3 onClick=... className="tap-word">` (ligne 2938)
* **Action :** Ouvre la popup du dictionnaire.
* **Accessible au clavier :** Non.
* **Sémantique :** Utilisation incorrecte d'un titre comme élément de bouton.

*Priorité de correction : Il est indispensable d'utiliser des éléments `<button>` natifs pour ces actions afin de bénéficier gratuitement du focus, du comportement Enter/Space et de la sémantique pour les lecteurs d'écran.*

---

## 3. Modal de filtre des catégories

Inspection du modal de filtre (`filterModalType` dans `FuragoApp.tsx`, ligne ~1926 & ~3539) :

* **Mécanisme d'ouverture :** Clic sur les boutons de la `filters-bar`.
* **Mécanisme de fermeture :** Clic sur l'overlay (`<div className="modal-overlay" onClick={() => setFilterModalType(null)}>`).
* **Bouton Close :** Inexistant. (Les niveaux de difficulté ferment la modale au clic, mais sélectionner une catégorie ne la ferme pas, obligeant à cliquer à l'extérieur).
* **Comportement avec `Escape` :** Inexistant.
* **Focus à l'ouverture :** Non géré (le focus reste sur le bouton déclencheur).
* **Focus à la fermeture :** Non géré (le focus ne revient pas explicitement).
* **Tab / Shift+Tab :** Le focus peut sortir de la modale et se déplacer sur les éléments en arrière-plan (absence de focus trap).
* **Sémantique ARIA :** `role="dialog"` absent, `aria-modal` absent, nom accessible absent.

*Écart avec le pattern Dialog WAI-ARIA : Le comportement actuel est totalement défaillant pour un utilisateur clavier, qui se retrouve bloqué dans la modale des catégories (impossible de la fermer).*

---

## 4. Browser / Keyboard Test

*Les tests ci-dessous ont été VÉRIFIÉS PAR INSPECTION du code source (`FuragoApp.tsx`).*

### Test A : Ouvrir le modal avec clavier
* **Focus visible :** Oui sur le bouton déclencheur, mais pas transféré dans la modale.
* **Focus dans le modal :** Non.
* **Tab / Shift+Tab :** Sortent de la modale (échec).
* **Escape :** Ne ferme pas la modale (échec).

### Test B : Naviguer jusqu'à un mot de vocabulaire
* **Vérification :** Échec. Les éléments (`span`, `div`, `h3`) n'ayant pas de `tabIndex="0"`, ils sont totalement invisibles pour la navigation Tab.

### Test C : Activer un mot
* **Enter / Space :** Échec. En l'absence de gestion d'événements `onKeyDown`, l'activation au clavier est impossible.

### Test D : Fermer le modal et vérifier le retour du focus
* **Retour du focus :** Échec. Lors du démontage de la modale, aucun mécanisme ne renvoie le focus à l'élément (`document.activeElement`) l'ayant ouverte.

---

## 5. Inventaire des autres problèmes

L'inspection a révélé la répétition de ces anti-patterns d'accessibilité dans d'autres composants :

* **`onClick` sur des éléments non sémantiques :**
  * `dictOpen` popup se ferme via `document.addEventListener("mousedown")` (ligne 1256) mais n'écoute pas la touche `Escape`.
* **Modales secondaires sans focus trap ni fermeture `Escape` :**
  * Modal List Selector (`listSelectorOpen`, ligne 3650).
  * Modal de création de liste (`newListModalOpen`, ligne 3720).
  * Modal Newsletter Lead (`leadModalOpen`, ligne 3790).
* **Boutons icon-only sans `aria-label` :**
  * Boutons de contrôle audio (Play/Pause, Next, Prev, Restart) : utilisent l'attribut `title` (bien, mais un `aria-label` est préférable, ligne 3319).
  * Boutons d'action des listes de mots (Speak, Delete) : utilisent l'attribut `title` (ligne 3131).

---

## 6. Priorisation

### P0 (Bloquants)
| Problème | Composant / Fichier | Impact Utilisateur | Correction Recommandée | Complexité | Risque Régression |
|---|---|---|---|---|---|
| Mots interactifs inaccessibles | `FuragoApp.tsx` (TargetVocab, renderInteractive) | L'utilisateur clavier ne peut pas consulter les définitions. | Remplacer `span`/`div` par `<button type="button">`. | Faible | Modéré (CSS inline) |
| Filtre Catégories bloquant | `FuragoApp.tsx` (Filtres) | L'utilisateur est bloqué, ne peut ni fermer ni sortir de la modale. | Ajouter un bouton "Fermer" + gérer `Escape`. | Faible | Faible |
| Absence de Focus Trap | `FuragoApp.tsx` (Toutes les modales) | L'utilisateur interagit avec l'application "en dessous" de la modale. | Gérer le focus ou utiliser `<dialog>`. | Moyenne | Faible |

### P1 (Dégradations importantes)
| Problème | Composant / Fichier | Impact Utilisateur | Correction Recommandée | Complexité | Risque Régression |
|---|---|---|---|---|---|
| Perte de focus après fermeture | `FuragoApp.tsx` (Modales) | L'utilisateur doit recommencer sa navigation depuis le début de la page. | Stocker l'activeElement et le restaurer à la fermeture. | Faible | Faible |
| Popup Dictionnaire (Escape) | `FuragoApp.tsx` (Popup Dict) | Impossible de fermer la définition avec le clavier. | Ajouter un event listener sur la touche `Escape`. | Faible | Faible |
| Sémantique des modales | `FuragoApp.tsx` (Modales) | Mauvaise interprétation par les lecteurs d'écran. | Ajouter `role="dialog"`, `aria-modal="true"`. | Faible | Aucun |

### P2 (Améliorations)
| Problème | Composant / Fichier | Impact Utilisateur | Correction Recommandée | Complexité | Risque Régression |
|---|---|---|---|---|---|
| Icon-only buttons (aria-label) | `FuragoApp.tsx` (Audio, Actions mots) | `title` est lu, mais `aria-label` est le standard. | Remplacer/ajouter `aria-label` aux boutons d'icônes. | Faible | Aucun |

---

## 7. Proposition d'architecture de correction

Stratégie minimale (zéro nouvelle dépendance, focalisation HTML natif) :

1. **Éléments interactifs :**
   * Remplacer systématiquement `<span onClick>` et `<div onClick>` par des `<button type="button">`.
   * Appliquer une classe CSS utilitaire (ex: `.reset-btn`) contenant `all: unset; cursor: pointer;` pour garantir l'absence d'impact visuel et préserver l'agencement du texte.
2. **Modales (L'approche `<dialog>`) :**
   * Au lieu d'ajouter un système lourd de focus trap manuel et des event listeners `Escape`, migrer les conteneurs `.modal-overlay` vers la balise native `<dialog>`.
   * Ouvrir les modales avec la méthode `ref.current.showModal()`.
   * **Avantage :** Le navigateur gérera nativement l'assombrissement (via `::backdrop`), le focus trap restrictif, et la fermeture via `Escape`.
   * **Alternative si `<dialog>` est refusé :** Implémenter un hook `useFocusTrap` et un event listener `keydown` (Escape) au montage des modales.
3. **Bouton de fermeture (Filtre Catégories) :**
   * Ajouter explicitement un bouton `<button>` "Appliquer" ou "Fermer" (X) dans la modale des catégories.

---

## 8. Rappel : Sujets explicitement hors périmètre

Ce rapport ne traite **pas** des sujets suivants (qui doivent faire l'objet de travaux distincts) :
* Safe-area audio et Bottom-nav.
* Scroll restoration.
* TTS auto-scroll.
* Routing complet de l'application et refactoring global de `FuragoApp.tsx`.
