/**
 * DA-23: Extract Metadata to Sidecar command
 *
 * Scaffolds a `.deck.yaml` from an existing inline `.deck.md` by pulling
 * deck-level metadata and any per-slide metadata that has been authored
 * (cues, duration, checkpoint).
 *
 * MVP scope (R3): action links are NOT extracted from the markdown body.
 * That lives in the renderer/authoring layer, not the parser extraction layer.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as vscode from 'vscode';
import { parseDeck } from '@deckpilot/core/parser';
import type { Deck } from '@deckpilot/core/models/deck';
import type { SidecarFile, SidecarSlide } from '@deckpilot/core/models/sidecar';

/**
 * Pure function: build the YAML content for a sidecar file from a resolved Deck.
 * Separated from VS Code I/O so it can be unit-tested.
 */
export function buildSidecarContent(deck: Deck): string {
    const sidecar: SidecarFile = {};

    // Deck-level metadata
    if (deck.metadata.title !== undefined || deck.metadata.theme !== undefined) {
        sidecar.deck = {};
        if (deck.metadata.title !== undefined) {
            sidecar.deck.title = deck.metadata.title;
        }
        if (deck.metadata.theme !== undefined) {
            sidecar.deck.theme = deck.metadata.theme;
        }
    }

    // Recording section — only if any field is present
    const rec = deck.metadata.recording;
    if (rec && Object.keys(rec).length > 0) {
        sidecar.recording = { ...rec };
    }

    // Export section — only if any field is present
    const exp = deck.metadata.export;
    if (exp && Object.keys(exp).length > 0) {
        sidecar.export = { ...exp };
    }

    // Per-slide metadata — skip slides with nothing to export
    const sidecarSlides: SidecarSlide[] = [];
    for (const slide of deck.slides) {
        const hasMetadata =
            (slide.cues && slide.cues.length > 0) ||
            slide.duration !== undefined ||
            slide.checkpoint !== undefined ||
            (slide.sidecarActions && slide.sidecarActions.length > 0);

        if (!hasMetadata) {
            continue;
        }

        if (!slide.id) {
            // Slide must have an id to be referenceable in the sidecar
            continue;
        }

        const entry: SidecarSlide = { id: slide.id };
        if (slide.cues && slide.cues.length > 0) {
            entry.cues = [...slide.cues];
        }
        if (slide.duration !== undefined) {
            entry.duration = slide.duration;
        }
        if (slide.checkpoint !== undefined) {
            entry.checkpoint = slide.checkpoint;
        }
        // Re-export any sidecar actions that were already present (round-trip preservation).
        // R3 applies to inline markdown body extraction only — sidecar-sourced actions are fine to re-emit.
        if (slide.sidecarActions && slide.sidecarActions.length > 0) {
            entry.actions = [...slide.sidecarActions];
        }
        sidecarSlides.push(entry);
    }

    if (sidecarSlides.length > 0) {
        sidecar.slides = sidecarSlides;
    }

    return yaml.dump(sidecar, { lineWidth: 120, quotingType: '"', forceQuotes: false });
}

/**
 * VS Code command handler: extracts metadata from the active `.deck.md` file
 * and writes a companion `.deck.yaml` sidecar.
 * 
 * Can be triggered from either the .deck.md file or its .deck.yaml sidecar.
 */
export async function extractMetadataToSidecar(): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
        void vscode.window.showErrorMessage('No active editor. Open a .deck.md or .deck.yaml file first.');
        return;
    }

    let filePath = editor.document.uri.fsPath;

    // If triggered from a .deck.yaml sidecar, derive the .deck.md path
    if (filePath.endsWith('.deck.yaml')) {
        filePath = filePath.replace(/\.deck\.yaml$/, '.deck.md');
        
        // Verify the .deck.md file exists
        if (!fs.existsSync(filePath)) {
            void vscode.window.showErrorMessage(
                'No paired .deck.md file found. Create a .deck.md file alongside this sidecar.'
            );
            return;
        }
    } else if (!filePath.endsWith('.deck.md')) {
        void vscode.window.showErrorMessage('Active file is not a .deck.md or .deck.yaml file.');
        return;
    }

    const sidecarPath = filePath.replace(/\.deck\.md$/, '.deck.yaml');

    // Confirm overwrite if sidecar already exists
    if (fs.existsSync(sidecarPath)) {
        const choice = await vscode.window.showWarningMessage(
            `${path.basename(sidecarPath)} already exists. Overwrite?`,
            { modal: false },
            'Overwrite',
        );
        if (choice !== 'Overwrite') {
            return;
        }
    }

    // Parse the deck to get the fully merged Deck object
    let deck: Deck;
    try {
        const content = editor.document.getText();
        const result = await parseDeck(content, filePath);
        if (result.error || !result.deck) {
            void vscode.window.showErrorMessage(
                `Failed to parse deck: ${result.error ?? 'Unknown error'}`,
            );
            return;
        }
        deck = result.deck;
    } catch (err) {
        void vscode.window.showErrorMessage(
            `Failed to parse deck: ${err instanceof Error ? err.message : String(err)}`,
        );
        return;
    }

    // Build and write the YAML
    const yamlContent = buildSidecarContent(deck);
    try {
        fs.writeFileSync(sidecarPath, yamlContent, 'utf8');
    } catch (err) {
        void vscode.window.showErrorMessage(
            `Failed to write sidecar file: ${err instanceof Error ? err.message : String(err)}`,
        );
        return;
    }

    // Open the generated file in the editor
    const doc = await vscode.workspace.openTextDocument(sidecarPath);
    await vscode.window.showTextDocument(doc);
}
