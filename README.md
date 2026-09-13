# Khaos

Un navigateur web de bureau, construit avec Electron. Fenêtre sans bordure, onglets, barre d'adresse, page de démarrage — un vrai navigateur fonctionnel, pas une maquette.

## Installer et lancer

Il faut [Node.js](https://nodejs.org/) installé (version 18 ou plus récente conseillée).

```bash
npm install
npm start
```

La première installation télécharge Electron (~100-200 Mo), donc elle peut prendre une minute.

## Fonctionnalités

- **Palette de commandes** (`Ctrl/Cmd+K`) — le signe distinctif de Khaos. Une fenêtre centrale façon "quick switcher" pour sauter instantanément vers un onglet ouvert, une page de l'historique, un favori, ou déclencher une action (nouvel onglet, fenêtre privée, changer le fond d'écran, basculer le bloqueur…), sans toucher la souris. Flèches pour naviguer, Entrée pour valider, Échap pour fermer.
- Onglets multiples (créer, fermer, changer d'onglet) avec animation d'ouverture/fermeture
- Navigation : précédent / suivant / recharger / accueil
- Barre de progression animée pendant le chargement d'une page
- Barre d'adresse intelligente : tape une URL ou une recherche, Khaos devine
- Page de démarrage "Khaos" avec recherche intégrée et lignes de fracture animées
- **Fond d'écran personnalisable** (image ou GIF), bien visible — pas d'assombrissement excessif, juste un léger dégradé en bas pour la lisibilité du texte. Bouton "Fond d'écran" sur la page d'accueil, ou menu ⋮ → "Changer le fond d'écran…". Un seul calque (pas de superposition possible même avec plusieurs onglets d'accueil ouverts). "Réinitialiser le fond d'écran" pour revenir au thème sombre par défaut.
- **Raccourcis scolaires** sur la page d'accueil : EduConnect, Lycée Connecté et Pronote.
  - EduConnect et Lycée Connecté pointent directement vers les bons portails.
  - Pronote n'a pas d'adresse unique (chaque établissement a la sienne) : au premier clic sur le crayon ✎ du raccourci, renseigne l'adresse Pronote donnée par ton établissement (ex. `https://0123456a.index-education.net/pronote/`) — Khaos s'en souviendra.
- Ouverture des liens `target="_blank"` dans un nouvel onglet
- **Favoris** : étoile dans la barre d'adresse pour ajouter/retirer la page courante, barre de favoris (menu ⋮ → "Afficher la barre de favoris", ou automatique au premier favori ajouté)
- **Historique** : onglet dédié (`Ctrl/Cmd+H` ou menu ⋮ → "Historique") avec recherche et suppression totale
- **Navigation privée** : nouvelle fenêtre isolée (`Ctrl/Cmd+Shift+N` ou menu ⋮), cookies/session en mémoire uniquement, aucun historique enregistré
- **Zoom par onglet** : `Ctrl/Cmd +` / `Ctrl/Cmd -` / `Ctrl/Cmd 0`, avec indicateur visuel, réinitialisé à chaque nouvelle page
- **Réorganisation des onglets** par glisser-déposer
- **Bloqueur de traqueurs/publicités** basique, activable/désactivable depuis le menu ⋮ (liste de domaines courants — pas un remplacement d'uBlock Origin, mais coupe l'essentiel)
  - **Publicités YouTube** : les bannières et pavés publicitaires sont masqués, et les pubs vidéo sont sautées automatiquement (clic sur "Passer" dès qu'il apparaît) ou avancées instantanément jusqu'à la fin si elles ne sont pas "skippables". Limite honnête : YouTube sert ses pubs vidéo par le même réseau que le contenu normal, donc il est impossible de les bloquer par simple filtrage réseau sans casser la lecture — c'est pour ça que Khaos les laisse charger une fraction de seconde puis les saute/masque, plutôt que de les empêcher totalement. Recharge la page après avoir activé/désactivé le bloqueur pour que le changement s'applique à YouTube.
- **Téléchargements** : icône dédiée dans la barre d'outils avec badge de progression, panneau listant les fichiers avec "Ouvrir" / "Afficher dans le dossier"
- **Mode lecture** : icône livre dans la barre d'outils, extrait le contenu principal d'un article et l'affiche en typographie propre, sans distractions (`Échap` pour fermer)
- Raccourcis clavier : `Ctrl/Cmd+K` (palette de commandes), `Ctrl/Cmd+T` (nouvel onglet), `Ctrl/Cmd+W` (fermer l'onglet), `Ctrl/Cmd+L` (focus barre d'adresse), `Ctrl/Cmd+R` (recharger), `Ctrl/Cmd+D` (favori), `Ctrl/Cmd+H` (historique), `Ctrl/Cmd+Shift+N` (fenêtre privée)
- Fenêtre sans bordure avec contrôles personnalisés (réduire / agrandir / fermer)

## Structure du projet

```
khaos/
├── main.js          → processus principal Electron (fenêtres, IPC, fond d'écran, favoris, historique, téléchargements, blocage)
├── preload.js        → pont sécurisé pour la fenêtre principale
├── webview-preload.js → pont sécurisé pour les pages locales (jamais exposé aux autres sites)
├── index.html         → structure de l'interface (onglets, barre d'outils, menu, favoris, téléchargements, lecture)
├── renderer.js         → logique des onglets, navigation, favoris, zoom, téléchargements, mode lecture, animations
├── styles.css          → identité visuelle
├── home.html            → page de démarrage, raccourcis et fond d'écran
├── history.html          → page d'historique (recherche, suppression)
└── assets/fonts/          → polices embarquées (fonctionne hors-ligne)
```

## Construire un exécutable (optionnel)

Pour distribuer Khaos en tant qu'application installable (.exe, .dmg, .AppImage...), tu peux ajouter [electron-builder](https://www.electron.build/) :

```bash
npm install --save-dev electron-builder
npx electron-builder
```

## Données et vie privée

Favoris, historique et fond d'écran sont stockés localement (dossier de données de l'application, jamais envoyés en ligne). En navigation privée, aucun historique n'est enregistré et la session (cookies, connexions) est effacée à la fermeture de la fenêtre.

## Personnaliser

- Couleurs et typographies : `styles.css` et `home.html` (variables CSS en haut de fichier)
- Moteur de recherche par défaut : cherche `duckduckgo.com` dans `renderer.js` et `home.html`, remplace par le moteur de ton choix
