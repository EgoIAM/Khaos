# Khaos
<<<<<<< HEAD

Un navigateur web de bureau, construit avec Electron. Fenêtre sans bordure, onglets, barre d'adresse, page de démarrage — un vrai navigateur fonctionnel, pas une maquette.

## Installer et lancer

Il faut [Node.js](https://nodejs.org/) installé (version 18 ou plus récente conseillée).

```bash
npm install
npm start
```

La première installation télécharge Electron (~100-200 Mo), donc elle peut prendre une minute.

## Fonctionnalités

- Onglets multiples (créer, fermer, changer d'onglet) avec animation d'ouverture/fermeture
- Navigation : précédent / suivant / recharger / accueil
- Barre de progression animée pendant le chargement d'une page
- Barre d'adresse intelligente : tape une URL ou une recherche, Khaos devine
- Page de démarrage "Khaos" avec recherche intégrée et lignes de fracture animées
- **Fond d'écran personnalisable** (image ou GIF) : bouton "Fond d'écran" sur la page d'accueil, ou menu ⋮ en haut à droite → "Changer le fond d'écran…". Il s'applique à la page d'accueil et, en transparence, à la barre d'outils du navigateur. "Réinitialiser le fond d'écran" pour revenir au thème sombre par défaut.
- **Raccourcis scolaires** sur la page d'accueil : EduConnect, Lycée Connecté et Pronote.
  - EduConnect et Lycée Connecté pointent directement vers les bons portails.
  - Pronote n'a pas d'adresse unique (chaque établissement a la sienne) : au premier clic sur le crayon ✎ du raccourci, renseigne l'adresse Pronote donnée par ton établissement (ex. `https://0123456a.index-education.net/pronote/`) — Khaos s'en souviendra.
- Ouverture des liens `target="_blank"` dans un nouvel onglet
- Raccourcis clavier : `Ctrl/Cmd+T` (nouvel onglet), `Ctrl/Cmd+W` (fermer l'onglet), `Ctrl/Cmd+L` (focus barre d'adresse), `Ctrl/Cmd+R` (recharger)
- Fenêtre sans bordure avec contrôles personnalisés (réduire / agrandir / fermer)

## Structure du projet

```
khaos/
├── main.js          → processus principal Electron (fenêtre, IPC, fond d'écran)
├── preload.js        → pont sécurisé pour la fenêtre principale
├── webview-preload.js → pont sécurisé pour la page d'accueil (jamais exposé aux autres sites)
├── index.html         → structure de l'interface (onglets, barre d'outils, menu)
├── renderer.js         → logique des onglets, navigation, animations, menu
├── styles.css          → identité visuelle
├── home.html            → page de démarrage, raccourcis et fond d'écran
└── assets/fonts/         → polices embarquées (fonctionne hors-ligne)
```

## Construire un exécutable (optionnel)

Pour distribuer Khaos en tant qu'application installable (.exe, .dmg, .AppImage...), tu peux ajouter [electron-builder](https://www.electron.build/) :

```bash
npm install --save-dev electron-builder
npx electron-builder
```

## Personnaliser

- Couleurs et typographies : `styles.css` et `home.html` (variables CSS en haut de fichier)
- Moteur de recherche par défaut : cherche `duckduckgo.com` dans `renderer.js` et `home.html`, remplace par le moteur de ton choix
=======
Khaos is a modern browser designed for schools, focused on security, customization, and a fast student experience. Currently in beta, Khaos is actively developed and may contain bugs, incomplete features, and temporary limitations.
>>>>>>> 1a489672a55185250d596315bd41840a2c2234c6
