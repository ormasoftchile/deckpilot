/**
 * Merge engine — combines parsed Slide[] with a loaded SidecarFile into
 * enriched Slide[]. Pure function; no file I/O, no VS Code API calls.
 *
 * DA-05: Sidecar merge engine.
 *
 * Precedence: inline value (already on Slide) > sidecar value > global defaults.
 */

import type { Slide } from '../models/slide';
import type { DeckMetadata } from '../models/deck';
import type { SidecarFile, SidecarSlide } from '../models/sidecar';
import { mapSidecarActionsToInteractiveElements } from './sidecarActionMapper';

/**
 * Merge sidecar slide entries into a parsed Slide array.
 *
 * - Slides with no matching sidecar entry pass through unchanged.
 * - Sidecar entries with no matching slide ID are silently skipped.
 * - Returns a new array; input slides are not mutated.
 */
export function mergeSidecarIntoSlides(slides: Slide[], sidecar: SidecarFile): Slide[] {
  if (!sidecar.slides || sidecar.slides.length === 0) {
    return slides;
  }

  const sidecarMap = new Map<string, SidecarSlide>(
    sidecar.slides.map(s => [s.id, s])
  );

  return slides.map(slide => {
    if (!slide.id) {
      return slide;
    }

    const sidecarSlide = sidecarMap.get(slide.id);
    if (!sidecarSlide) {
      return slide;
    }

    const merged: Slide = { ...slide };

    // cues: apply sidecar cues only when slide has none
    if (sidecarSlide.cues !== undefined && merged.cues === undefined) {
      merged.cues = sidecarSlide.cues;
    }

    // duration: apply sidecar value only when slide has none
    if (sidecarSlide.duration !== undefined && merged.duration === undefined) {
      merged.duration = sidecarSlide.duration;
    }

    // checkpoint: apply sidecar value only when slide has none
    if (sidecarSlide.checkpoint !== undefined && merged.checkpoint === undefined) {
      merged.checkpoint = sidecarSlide.checkpoint;
    }

    // sidecarActions: store raw entries, then render as clickable interactive elements
    // (source='sidecar') appended after slide content. This ensures the presenter
    // controls when actions fire — never auto-executed on slide entry.
    if (sidecarSlide.actions !== undefined) {
      merged.sidecarActions = sidecarSlide.actions;

      const sidecarElements = mapSidecarActionsToInteractiveElements(sidecarSlide.actions, slide.index);
      if (sidecarElements.length > 0) {
        merged.interactiveElements = [...merged.interactiveElements, ...sidecarElements];
        // Each sidecar element with fragment=true will be injected as an additional
        // fragment step (after existing fragments). Update fragmentCount so the
        // Conductor knows the correct total number of reveal steps.
        const fragmentingCount = sidecarElements.filter(el => el.fragment !== false).length;
        if (fragmentingCount > 0) {
          merged.fragmentCount = slide.fragmentCount + fragmentingCount;
        }
      }
    }

    return merged;
  });
}

/**
 * Merge sidecar deck-level metadata into a DeckMetadata object.
 *
 * - Inline values already present on `metadata` take precedence.
 * - Returns a new object; input metadata is not mutated.
 */
export function mergeSidecarDeckMetadata(metadata: DeckMetadata, sidecar: SidecarFile): DeckMetadata {
  if (!sidecar.deck && !sidecar.recording && !sidecar.export) {
    return metadata;
  }

  const merged: DeckMetadata = { ...metadata };

  if (sidecar.deck) {
    if (sidecar.deck.title !== undefined && merged.title === undefined) {
      merged.title = sidecar.deck.title;
    }

    if (sidecar.deck.theme !== undefined && merged.theme === undefined) {
      merged.theme = sidecar.deck.theme;
    }
  }

  // recording: field-by-field merge — sidecar as base, inline wins per field
  if (sidecar.recording !== undefined) {
    merged.recording = { ...sidecar.recording, ...(merged.recording ?? {}) };
  }

  // export: field-by-field merge — sidecar as base, inline wins per field
  if (sidecar.export !== undefined) {
    merged.export = { ...sidecar.export, ...(merged.export ?? {}) };
  }

  return merged;
}
