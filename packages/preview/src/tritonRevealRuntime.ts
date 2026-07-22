import type { RevealEffect, RevealTrack } from '@cristianormazabal/triton-core';

const EFFECT_CLASSES: Record<RevealEffect, string> = {
  fade: 'fade-in',
  draw: 'fade-in',
  grow: 'zoom-in',
  slide: 'fade-up',
};

export function initializeTritonRevealFragments(root: ParentNode): boolean {
  const figures = Array.from(root.querySelectorAll<HTMLElement>('figure[data-triton-reveal]'));
  let changed = false;

  figures.forEach((figure, diagramIndex) => {
    if (figure.getAttribute('data-triton-expanded') === 'true') {
      return;
    }

    const track = parseRevealTrack(figure.getAttribute('data-triton-reveal'));
    const svg = figure.querySelector<SVGSVGElement>('svg');
    if (!track?.steps.length || !svg) {
      figure.setAttribute('data-triton-expanded', 'empty');
      return;
    }

    const firstStep = track.steps[0];
    const firstKey = stepKey(diagramIndex, firstStep.index);
    figure.classList.add('fragment', 'triton-reveal-step', effectClass(firstStep.effect));
    figure.setAttribute('data-triton-step-key', firstKey);

    for (const step of track.steps) {
      const key = stepKey(diagramIndex, step.index);
      const animation = effectClass(step.effect);
      for (const id of step.enter) {
        const group = svg.querySelector<SVGElement>(`[id="${cssEscape(String(id))}"]`);
        if (!group) {
          continue;
        }
        group.classList.add('fragment', 'triton-reveal-step', animation);
        group.setAttribute('data-triton-step', String(step.index));
        group.setAttribute('data-triton-step-key', key);
      }
    }

    figure.setAttribute('data-triton-expanded', 'true');
    changed = true;
  });

  if (changed) {
    renumberFragments(root);
  }
  return changed;
}

function parseRevealTrack(raw: string | null): RevealTrack | undefined {
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as RevealTrack;
    return Array.isArray(parsed.steps) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function renumberFragments(root: ParentNode): void {
  const fragments = Array.from(root.querySelectorAll<Element>('.fragment'));
  let index = 0;
  let previousKey: string | null = null;

  for (const fragment of fragments) {
    const key = fragment.getAttribute('data-triton-step-key');
    if (!key || key !== previousKey) {
      index += 1;
    }
    fragment.setAttribute('data-fragment-index', String(index));
    previousKey = key;
  }
}

function stepKey(diagramIndex: number, stepIndex: number): string {
  return `${diagramIndex}:${stepIndex}`;
}

function effectClass(effect: RevealEffect | undefined): string {
  return EFFECT_CLASSES[effect ?? 'fade'];
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, '\\$&');
}
