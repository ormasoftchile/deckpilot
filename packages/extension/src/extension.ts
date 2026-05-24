import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Conductor } from './conductor';
import { parseDeck } from '@deckpilot/core/parser';
import { registerAllExecutors } from './actions';
import { ActionCompletionProvider } from './providers/actionCompletionProvider';
import { ActionHoverProvider } from './providers/actionHoverProvider';
import { ActionDiagnosticProvider } from './providers/actionDiagnosticProvider';
import { DeckModelContentProvider, showResolvedDeckModel } from './commands/showResolvedModel';
import { extractMetadataToSidecar } from './commands/extractMetadata';
import {
    installAuthoringSkills,
    maybeOfferAuthoringSkillsInstall
} from './commands/installAuthoringSkills';

let conductor: Conductor | undefined;

/**
 * Resolves a deck URI from the active editor, supporting both .deck.md and .deck.yaml files.
 * 
 * - If the active editor is a .deck.md file, returns it as-is.
 * - If the active editor is a .deck.yaml sidecar, derives and returns the paired .deck.md URI.
 * - Returns undefined if no active editor, or the .deck.md file doesn't exist.
 * 
 * @param editor - The active text editor (usually from vscode.window.activeTextEditor)
 * @returns The URI of the .deck.md file, or undefined if not applicable
 */
function resolveDeckUri(editor: vscode.TextEditor | undefined): vscode.Uri | undefined {
    if (!editor) {
        return undefined;
    }

    const filePath = editor.document.uri.fsPath;
    
    // If it's already a .deck.md file, return it
    if (filePath.endsWith('.deck.md')) {
        return editor.document.uri;
    }
    
    // If it's a .deck.yaml sidecar, derive the paired .deck.md path
    if (filePath.endsWith('.deck.yaml')) {
        const deckMdPath = filePath.replace(/\.deck\.yaml$/, '.deck.md');
        
        // Verify the .deck.md file exists
        if (fs.existsSync(deckMdPath)) {
            return vscode.Uri.file(deckMdPath);
        }
    }
    
    return undefined;
}

export function activate(context: vscode.ExtensionContext): void {
    console.log('Deckpilot extension is now active');

    // Register all action executors
    registerAllExecutors();

    // Initialize conductor
    conductor = new Conductor(context.extensionUri);
    context.subscriptions.push(conductor);

    // Register commands
    const openPresentationDisposable = vscode.commands.registerCommand(
        'deckPilot.openPresentation',
        async () => {
            const editor = vscode.window.activeTextEditor;
            
            // Resolve deck URI (supports both .deck.md and .deck.yaml)
            const deckUri = resolveDeckUri(editor);
            
            if (!deckUri) {
                const activeFile = editor?.document.fileName;
                if (activeFile?.endsWith('.deck.yaml')) {
                    void vscode.window.showWarningMessage(
                        'No paired .deck.md file found. Create a .deck.md file alongside this sidecar.'
                    );
                } else {
                    void vscode.window.showWarningMessage('No active editor. Open a .deck.md or .deck.yaml file first.');
                }
                return;
            }

            try {
                // Load and parse the deck
                const deckDocument = await vscode.workspace.openTextDocument(deckUri);
                const content = deckDocument.getText();
                const result = await parseDeck(content, deckUri.fsPath);

                if (result.error || !result.deck) {
                    void vscode.window.showWarningMessage(result.error || 'Failed to parse presentation.');
                    return;
                }

                if (result.deck.slides.length === 0) {
                    void vscode.window.showWarningMessage('Presentation has no slides.');
                    return;
                }

                // Open the presentation
                await conductor?.openDeck(result.deck);
            } catch (error) {
                void vscode.window.showErrorMessage(
                    `Failed to open presentation: ${error instanceof Error ? error.message : 'Unknown error'}`
                );
            }
        }
    );

    const closePresentationDisposable = vscode.commands.registerCommand(
        'deckPilot.closePresentation',
        async () => {
            if (conductor?.isActive()) {
                await conductor.close();
            }
        }
    );

    const resetPresentationDisposable = vscode.commands.registerCommand(
        'deckPilot.resetPresentation',
        async () => {
            if (conductor?.isActive()) {
                await conductor.reset();
            }
        }
    );

    const nextSlideDisposable = vscode.commands.registerCommand(
        'deckPilot.nextSlide',
        async () => {
            if (conductor?.isActive()) {
                await conductor.nextSlide();
            }
        }
    );

    const previousSlideDisposable = vscode.commands.registerCommand(
        'deckPilot.previousSlide',
        async () => {
            if (conductor?.isActive()) {
                await conductor.previousSlide();
            }
        }
    );

    const openPresenterViewDisposable = vscode.commands.registerCommand(
        'deckPilot.openPresenterView',
        () => {
            conductor?.openPresenterView();
        }
    );

    // T014: Go to slide command — opens slide picker in the Webview
    const goToSlideDisposable = vscode.commands.registerCommand(
        'deckPilot.goToSlide',
        () => {
            conductor?.openSlidePicker();
        }
    );

    const validateDeckDisposable = vscode.commands.registerCommand(
        'deckPilot.validateDeck',
        async () => {
            const editor = vscode.window.activeTextEditor;
            
            // Resolve deck URI (supports both .deck.md and .deck.yaml)
            const deckUri = resolveDeckUri(editor);
            
            if (!deckUri) {
                const activeFile = editor?.document.fileName;
                if (activeFile?.endsWith('.deck.yaml')) {
                    void vscode.window.showWarningMessage(
                        'No paired .deck.md file found. Create a .deck.md file alongside this sidecar.'
                    );
                } else {
                    void vscode.window.showWarningMessage('Open a .deck.md or .deck.yaml file first to validate.');
                }
                return;
            }
            
            // Load the deck document
            const deckDocument = await vscode.workspace.openTextDocument(deckUri);
            await conductor?.validateDeck(deckDocument);
        }
    );

    const startRecordingDisposable = vscode.commands.registerCommand(
        'deckPilot.startRecording',
        async () => {
            if (!conductor?.isActive()) {
                void vscode.window.showWarningMessage('Start a presentation first before recording.');
                return;
            }
            if (conductor.isRecording()) {
                void vscode.window.showWarningMessage('Recording is already active.');
                return;
            }
            await conductor.startRecording();
            void vscode.window.showInformationMessage('🔴 Recording started');
        }
    );

    const stopRecordingDisposable = vscode.commands.registerCommand(
        'deckPilot.stopRecording',
        async () => {
            if (!conductor?.isRecording()) {
                void vscode.window.showWarningMessage('No active recording to stop.');
                return;
            }
            const session = await conductor.stopRecording();
            if (session) {
                const { RecordingSerializer } = await import('./recording/recordingSerializer');
                const { VoiceOverScriptGenerator } = await import('./recording/voiceOverScriptGenerator');
                const { CaptionsScaffoldGenerator } = await import('./recording/captionsScaffoldGenerator');

                const outputDir = path.dirname(session.deckPath);
                const serializer = new RecordingSerializer();
                const scriptGen = new VoiceOverScriptGenerator();
                const captionGen = new CaptionsScaffoldGenerator();

                const sessionFiles = await serializer.exportSession(session, outputDir);
                const scriptFiles = await scriptGen.exportScripts(session, outputDir);

                // Export SRT next to the video file if recorder was used, otherwise next to the deck
                const captionDir = session.recorder?.outputPath
                    ? path.dirname(session.recorder.outputPath)
                    : outputDir;
                const captionFile = await captionGen.exportSrt(session, captionDir);

                const allFiles = [...sessionFiles, ...scriptFiles, captionFile];
                void vscode.window.showInformationMessage(
                    `⏹️ Recording saved: ${allFiles.length} files exported`,
                    'Open Script'
                ).then(choice => {
                    if (choice === 'Open Script') {
                        const mdFile = allFiles.find(f => f.endsWith('.md'));
                        if (mdFile) {
                            void vscode.workspace.openTextDocument(mdFile).then(doc => {
                                void vscode.window.showTextDocument(doc);
                            });
                        }
                    }
                });
            }
        }
    );

    // Recording marker commands (Phase 2)
    const markRetakeDisposable = vscode.commands.registerCommand(
        'deckPilot.markRetake',
        async () => {
            if (!conductor?.isRecording()) {
                void vscode.window.showWarningMessage('No active recording.');
                return;
            }
            const note = await vscode.window.showInputBox({
                prompt: 'Retake note (optional)',
                placeHolder: 'Describe what to redo...',
            });
            conductor.markRetake(note);
            void vscode.window.showInformationMessage('🔁 Retake point marked');
        }
    );

    const toggleRecordingPauseDisposable = vscode.commands.registerCommand(
        'deckPilot.toggleRecordingPause',
        async () => {
            if (!conductor?.isRecording()) {
                return;
            }
            if (conductor.isRecordingPaused()) {
                conductor.resumeRecordingTiming();
                void vscode.window.showInformationMessage('▶️ Timing resumed');
            } else {
                conductor.pauseRecordingTiming();
                void vscode.window.showInformationMessage('⏸️ Timing paused');
            }
        }
    );

    const autoRecordDisposable = vscode.commands.registerCommand(
        'deckPilot.autoRecord',
        async () => {
            if (!conductor?.isActive()) {
                await vscode.window.showErrorMessage('Start a presentation first before auto-recording.', { modal: true });
                return;
            }
            if (conductor.isRecording() || conductor.isAutoPilotActive()) {
                await vscode.window.showErrorMessage('A recording or auto-pilot is already running.', { modal: true });
                return;
            }

            const confirm = await vscode.window.showWarningMessage(
                'Auto-Record will drive the entire presentation and record it. This may take a minute.',
                { modal: true },
                'Start'
            );
            if (confirm !== 'Start') {
                return;
            }

            void vscode.window.showInformationMessage('🤖 Auto-pilot started — recording...');
            const session = await conductor.autoRecord();
            if (session) {
                const { RecordingSerializer } = await import('./recording/recordingSerializer');
                const { VoiceOverScriptGenerator } = await import('./recording/voiceOverScriptGenerator');
                const { CaptionsScaffoldGenerator } = await import('./recording/captionsScaffoldGenerator');

                const outputDir = path.dirname(session.deckPath);
                const serializer = new RecordingSerializer();
                const scriptGen = new VoiceOverScriptGenerator();
                const captionGen = new CaptionsScaffoldGenerator();

                const sessionFiles = await serializer.exportSession(session, outputDir);
                const scriptFiles = await scriptGen.exportScripts(session, outputDir);
                const captionDir = session.recorder?.outputPath
                    ? path.dirname(session.recorder.outputPath)
                    : outputDir;
                const captionFile = await captionGen.exportSrt(session, captionDir);

                const allFiles = [...sessionFiles, ...scriptFiles, captionFile];
                void vscode.window.showInformationMessage(
                    `🤖 Auto-record complete: ${allFiles.length} files exported`,
                    'Open Script'
                ).then(choice => {
                    if (choice === 'Open Script') {
                        const mdFile = allFiles.find(f => f.endsWith('.md'));
                        if (mdFile) {
                            void vscode.workspace.openTextDocument(mdFile).then(doc => {
                                void vscode.window.showTextDocument(doc);
                            });
                        }
                    }
                });
            }
        }
    );

    const cancelAutoRecordDisposable = vscode.commands.registerCommand(
        'deckPilot.cancelAutoRecord',
        () => {
            if (conductor?.isAutoPilotActive()) {
                conductor.cancelAutoPilot();
                void vscode.window.showInformationMessage('🛑 Auto-pilot cancelled');
            }
        }
    );

    // DA-23: Extract Metadata to Sidecar — scaffold .deck.yaml from active .deck.md
    const extractMetadataToSidecarDisposable = vscode.commands.registerCommand(
        'deckpilot.extractMetadataToSidecar',
        () => extractMetadataToSidecar()
    );

    // Install authoring skills (SKILL.md bundle) into the workspace
    const installAuthoringSkillsDisposable = vscode.commands.registerCommand(
        'deckPilot.installAuthoringSkills',
        () => installAuthoringSkills(context)
    );

    // DA-24: Show Resolved Deck Model — virtual read-only JSON document
    const deckModelProvider = new DeckModelContentProvider();
    const deckModelProviderDisposable = vscode.workspace.registerTextDocumentContentProvider(
        'deckpilot-model',
        deckModelProvider
    );

    const showResolvedDeckModelDisposable = vscode.commands.registerCommand(
        'deckpilot.showResolvedDeckModel',
        () => showResolvedDeckModel(deckModelProvider)
    );

    // Register authoring assistance providers (US4)
    const documentSelector: vscode.DocumentSelector = { language: 'deck-markdown' };

    const completionProvider = new ActionCompletionProvider();
    const completionDisposable = vscode.languages.registerCompletionItemProvider(
        documentSelector,
        {
            provideCompletionItems(document, position, token, context) {
                const items = completionProvider.provideCompletionItems(document, position, token, context);
                if (!items) {
                    return undefined;
                }
                const vsItems = items.map((item) => {
                    const ci = new vscode.CompletionItem(item.label, item.kind);
                    ci.insertText = item.insertText;
                    ci.detail = item.detail;
                    ci.documentation = item.documentation;
                    if (item.range) {
                        const r = item.range;
                        ci.range = new vscode.Range(r.startLine, r.startChar, r.endLine, r.endChar);
                    }
                    // Ensure items always show regardless of typed text
                    ci.filterText = item.insertText ?? item.label;
                    return ci;
                });
                // isIncomplete: re-query on every keystroke so items aren't
                // filtered away when the typed text doesn't match any label
                return new vscode.CompletionList(vsItems, /* isIncomplete */ true);
            },
        },
        ':', '/', ' ',
    );

    const hoverProvider = new ActionHoverProvider();
    const hoverDisposable = vscode.languages.registerHoverProvider(
        documentSelector,
        {
            provideHover(document, position, token) {
                const result = hoverProvider.provideHover(document, position, token);
                if (!result) {
                    return undefined;
                }
                return new vscode.Hover(
                    result.contents.map((c) => new vscode.MarkdownString(c)),
                    result.range ? new vscode.Range(
                        result.range.start.line, result.range.start.character,
                        result.range.end.line, result.range.end.character,
                    ) : undefined,
                );
            },
        },
    );

    const diagnosticProvider = new ActionDiagnosticProvider();
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('deckPilotActions');

    function updateDiagnostics(document: vscode.TextDocument): void {
        if (document.languageId !== 'deck-markdown') {
            return;
        }
        const results = diagnosticProvider.computeDiagnostics(document);
        const vscDiags = results.map((d) => {
            const diag = new vscode.Diagnostic(
                new vscode.Range(
                    d.range.start.line, d.range.start.character,
                    d.range.end.line, d.range.end.character,
                ),
                d.message,
                d.severity as number,
            );
            diag.source = d.source;
            return diag;
        });
        diagnosticCollection.set(document.uri, vscDiags);
    }

    // Update diagnostics on document open and change
    const onChangeDisposable = vscode.workspace.onDidChangeTextDocument((e) => {
        updateDiagnostics(e.document);
    });
    const onOpenDisposable = vscode.workspace.onDidOpenTextDocument((doc) => {
        updateDiagnostics(doc);
    });
    const onCloseDisposable = vscode.workspace.onDidCloseTextDocument((doc) => {
        diagnosticCollection.delete(doc.uri);
    });

    // Update diagnostics for all currently open deck-markdown documents
    for (const doc of vscode.workspace.textDocuments) {
        updateDiagnostics(doc);
    }

    // Watch .deck.env files — re-trigger deck-markdown diagnostics on env file changes (T049)
    const envFileWatcher = vscode.workspace.createFileSystemWatcher('**/*.deck.env');
    const refreshDiagnosticsOnEnvChange = () => {
        for (const doc of vscode.workspace.textDocuments) {
            if (doc.languageId === 'deck-markdown') {
                updateDiagnostics(doc);
            }
        }
    };
    envFileWatcher.onDidChange(refreshDiagnosticsOnEnvChange);
    envFileWatcher.onDidCreate(refreshDiagnosticsOnEnvChange);
    envFileWatcher.onDidDelete(refreshDiagnosticsOnEnvChange);

    // Watch .deck.yaml sidecar files — re-trigger deck-markdown diagnostics on sidecar changes (DA-13)
    const sidecarFileWatcher = vscode.workspace.createFileSystemWatcher('**/*.deck.yaml');
    sidecarFileWatcher.onDidChange(refreshDiagnosticsOnEnvChange);
    sidecarFileWatcher.onDidCreate(refreshDiagnosticsOnEnvChange);
    sidecarFileWatcher.onDidDelete(refreshDiagnosticsOnEnvChange);

    context.subscriptions.push(
        openPresentationDisposable,
        closePresentationDisposable,
        resetPresentationDisposable,
        nextSlideDisposable,
        previousSlideDisposable,
        openPresenterViewDisposable,
        goToSlideDisposable,
        validateDeckDisposable,
        startRecordingDisposable,
        stopRecordingDisposable,
        markRetakeDisposable,
        toggleRecordingPauseDisposable,
        autoRecordDisposable,
        cancelAutoRecordDisposable,
        extractMetadataToSidecarDisposable,
        installAuthoringSkillsDisposable,
        deckModelProviderDisposable,
        showResolvedDeckModelDisposable,
        completionDisposable,
        hoverDisposable,
        diagnosticCollection,
        onChangeDisposable,
        onOpenDisposable,
        onCloseDisposable,
        envFileWatcher,
        sidecarFileWatcher,
        { dispose() { diagnosticProvider.dispose(); } }
    );

    // First-run: offer to install authoring skills into the workspace
    void maybeOfferAuthoringSkillsInstall(context);
}

export function deactivate(): void {
    console.log('Deckpilot extension is now deactivated');
    conductor?.dispose();
    conductor = undefined;
}
