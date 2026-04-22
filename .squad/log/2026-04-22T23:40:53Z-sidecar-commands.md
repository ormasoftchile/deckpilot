# Session Log: Sidecar Command Routing Implementation

**Date:** 2026-04-22T23:40:53Z

## Summary

De Unamuno implemented sidecar-aware command routing. All deck commands now work from `.deck.md` or `.deck.yaml` files. 877 tests passing.

**Commands updated:**
- `openPresentation`
- `validateDeck`
- `extractMetadataToSidecar`
- `showResolvedDeckModel`

**Helper:** `resolveDeckUri()` in `src/extension.ts` handles file resolution and error messaging.

## Results

✅ No regressions  
✅ TypeScript strict mode passing  
✅ User can now edit `.deck.yaml` and trigger deck commands without switching to `.deck.md`
