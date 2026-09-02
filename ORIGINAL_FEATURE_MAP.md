# Original source migration map

The supplied file was a 5,812-line single-page HTML fragment. This rebuild separates its large four-column desktop surface into mobile screens while retaining the core game identity.

| Supplied source behavior | Mobile implementation |
| --- | --- |
| 14 original procedural boss types | All 14 retained; Frost Revenant added so every battle element has a natural visual archetype |
| Common through Mythic rarity with weighted generation | Same six names and baseline weights, with offer-based odds boosting |
| Nature, Void, Arcane, Inferno, Frost, Radiant, Blood | Same seven elements and exact advantage table |
| Cancel Wild elemental auto-win | Preserved as the first duel-resolution rule |
| Rarity, level, deterministic score, power, coinflip resolution | Preserved in that order; the final coinflip is seeded for shared multiplayer consistency |
| HP, ATK, DEF, MAG, SPD and computed power | Preserved and shown in card detail |
| Seed, variant, palette, card hash, Genesis set, mint status | Preserved as portable card DNA fields |
| Neon variant chance | Preserved at 8% |
| Binder filters and sorting | Rebuilt as search, element chips, and mobile sorting |
| Local deck save/load and JSON | Rebuilt as multiple named persistent decks plus deck JSON |
| Player A / Player B deck save buttons | Removed intentionally: only owned binder/deck-builder cards may be saved |
| Preview and mint placeholder | Card detail preview retains deterministic identity and Mint (Soon) placeholder |
| Battle arena, log, step, auto, reset | Rebuilt as a dedicated touch battle screen with step/autoplay, log, progress, result flow, and effects |
| Desktop localStorage records | Consolidated into a versioned complete local save with optional cloud sync |

The original code used canvas-generated sprites and numerous shape-specific drawing routines. The mobile renderer uses a deterministic symmetrical pixel silhouette keyed by the same stable card identity, greatly reducing APK/WebView work while keeping every saved card visually repeatable. The supplied source remains the design authority if those full legacy silhouette routines are later ported into the modular renderer.
