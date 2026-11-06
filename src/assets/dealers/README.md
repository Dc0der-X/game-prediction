# Casino dealers

The official visual references for the four dealers. Each is shown on her own at her own tables
(registry: `src/app/core/dealers.ts`), never as a collage and never replaced by another picture.

| Dealer | File | Tables |
|---|---|---|
| Sofia | `sofia_casino_dealer.png` | Roulette |
| Maya  | `maya_casino_dealer.png`  | Baccarat |
| Elena | `elena_casino_dealer.png` | Dragon Tiger |
| Lina  | `lina_casino_dealer.png`  | Sic Bo, Craps |

`scripts/check-dealers.mjs` runs before every build and stops it if an image is missing.
To change a dealer's look, replace her file with a new image of the same name (landscape, about 3:2).
