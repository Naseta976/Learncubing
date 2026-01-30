# Rubik's Cube 3D

Un petit module réutilisable pour afficher un Rubik's Cube 3D sur une page web en utilisant three.js.

---

## 🚀 Aperçu
- **Module** : `src/rubyx.js` — exporte `createRubik(container, options)`.
- **API** : la fonction retourne un objet `{ doMove, scramble(times), reset() }`.
- **Couleurs** : configurables via des **hex** (avec `#`) : U, D, R, L, F, B.

---

## Installation et exécution (développement)
1. Si vous utilisez npm + Vite (recommandé pour développement local) :

```bash
npm install
npm run dev
```

2. Ouvrir `http://localhost:5173`.

> Remarque : le fichier `src/rubyx.js` utilise actuellement des imports CDN de `three` (pratique pour intégration rapide). Si vous préférez une dépendance via npm, remplacez les imports dans `src/rubyx.js` par :
>
> ```js
> import * as THREE from 'three';
> import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
> ```
> puis installez `three` : `npm install three`.

---

## Intégration rapide (copier-coller)
Collez ce minimum dans votre page HTML (sans bundler) :

```html
<div id="container" style="width:100%;height:400px"></div>
<script type="module">
  import { createRubik } from './src/rubyx.js';
  createRubik(document.getElementById('container'), {
    colors: {
      U: '#ffffff', // haut
      D: '#ffff00', // bas
      R: '#ff0000', // droite
      L: '#ff8c00', // gauche
      F: '#0000ff', // avant
      B: '#00aa00'  // arrière
    }
  });
</script>
```

Si vous utilisez un bundler (Vite, webpack), importez `createRubik` depuis `./src/rubyx.js` dans votre code source JS.

---

## API & exemples
- `createRubik(container, options)`
  - `container` : élément DOM (obligatoire)
  - `options.colors` : objet avec clés `U,D,R,L,F,B` ayant des valeurs hex (ex: `'#ff0000'`)
  - `options.keyboard` : bool (default `true`) pour activer/désactiver les raccourcis clavier
  - `options.touch` : bool (default `true`) pour activer/désactiver les interactions tactiles/souris
  - retourne : `{ doMove, setKeyboardEnabled, setTouchEnabled, scramble, reset, destroy }`

Exemples :
```js
const rubik = createRubik(document.getElementById('container'), { keyboard: true, touch: true });
// contrôles JS
rubik.doMove('R', 1); // tourner Right
rubik.scramble(25);    // mélanger 25 mouvements
rubik.reset();         // réinitialiser
// activer/désactiver clavier ou tactile
rubik.setKeyboardEnabled(false);
rubik.setTouchEnabled(true);
// nettoyer
rubik.destroy();
```

---

## Personnalisation des couleurs
Les couleurs attendues sont des strings hex, ex: `'#ffffff'`. Le mapping logique :
- U : Up (face supérieure)
- D : Down (face inférieure)
- R : Right
- L : Left
- F : Front
- B : Back

---

## Dépannage rapide
- Si rien n'apparaît, vérifiez la console du navigateur pour des erreurs (import ou CORS).
- Si vous utilisez un bundler et que `three` est manquant, installez `three` via npm et adaptez les imports.

---

## Licence
MIT — libre d'utilisation et modification.
