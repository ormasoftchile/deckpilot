import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const SKILLS_SUBDIR = path.join('resources', 'skills');
const TARGET_SUBDIR = path.join('.github', 'skills');
const OFFERED_KEY = 'deckPilot.authoringSkillsOffered';

interface InstallResult {
    written: string[];
    skipped: string[];
    overwritten: string[];
}

async function collectFiles(dir: string): Promise<string[]> {
    const out: string[] = [];
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...(await collectFiles(full)));
        } else if (entry.isFile()) {
            out.push(full);
        }
    }
    return out;
}

async function readIfExists(file: string): Promise<string | undefined> {
    try {
        return await fs.promises.readFile(file, 'utf-8');
    } catch {
        return undefined;
    }
}

export async function installAuthoringSkills(context: vscode.ExtensionContext): Promise<void> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        void vscode.window.showWarningMessage(
            'Deckpilot: open a folder before installing authoring skills.'
        );
        return;
    }

    let workspaceRoot: string;
    if (folders.length === 1) {
        workspaceRoot = folders[0].uri.fsPath;
    } else {
        const pick = await vscode.window.showWorkspaceFolderPick({
            placeHolder: 'Install Deckpilot authoring skills into which folder?'
        });
        if (!pick) {
            return;
        }
        workspaceRoot = pick.uri.fsPath;
    }

    const sourceRoot = path.join(context.extensionPath, SKILLS_SUBDIR);
    if (!fs.existsSync(sourceRoot)) {
        void vscode.window.showErrorMessage(
            `Deckpilot: skill bundle missing at ${sourceRoot}. This is a packaging bug — please report it.`
        );
        return;
    }

    const sourceFiles = await collectFiles(sourceRoot);
    const result: InstallResult = { written: [], skipped: [], overwritten: [] };
    const conflicts: { src: string; dest: string; rel: string }[] = [];

    for (const src of sourceFiles) {
        const rel = path.relative(sourceRoot, src);
        const dest = path.join(workspaceRoot, TARGET_SUBDIR, rel);
        const existing = await readIfExists(dest);
        if (existing === undefined) {
            const fresh = await fs.promises.readFile(src, 'utf-8');
            await fs.promises.mkdir(path.dirname(dest), { recursive: true });
            await fs.promises.writeFile(dest, fresh, 'utf-8');
            result.written.push(rel);
            continue;
        }
        const fresh = await fs.promises.readFile(src, 'utf-8');
        if (existing === fresh) {
            result.skipped.push(rel);
        } else {
            conflicts.push({ src, dest, rel });
        }
    }

    if (conflicts.length > 0) {
        const choice = await vscode.window.showWarningMessage(
            `Deckpilot: ${conflicts.length} existing skill file(s) differ from the bundled version. Overwrite?`,
            { modal: true, detail: conflicts.map(c => c.rel).join('\n') },
            'Overwrite',
            'Skip'
        );
        if (choice === 'Overwrite') {
            for (const c of conflicts) {
                const fresh = await fs.promises.readFile(c.src, 'utf-8');
                await fs.promises.writeFile(c.dest, fresh, 'utf-8');
                result.overwritten.push(c.rel);
            }
        } else {
            for (const c of conflicts) {
                result.skipped.push(c.rel);
            }
        }
    }

    await context.globalState.update(OFFERED_KEY, true);

    const total = result.written.length + result.overwritten.length;
    if (total === 0 && result.skipped.length > 0) {
        void vscode.window.showInformationMessage(
            `Deckpilot: authoring skills already up to date (${result.skipped.length} files).`
        );
        return;
    }

    const target = path.join(TARGET_SUBDIR, 'deckpilot-authoring', 'SKILL.md');
    const action = await vscode.window.showInformationMessage(
        `Deckpilot: installed ${total} authoring skill file(s) under ${TARGET_SUBDIR}/. Ask Copilot to "create a deck" or "convert this markdown to a deck" to use them.`,
        'Open SKILL.md'
    );
    if (action === 'Open SKILL.md') {
        const uri = vscode.Uri.file(path.join(workspaceRoot, target));
        await vscode.window.showTextDocument(uri);
    }
}

export async function maybeOfferAuthoringSkillsInstall(
    context: vscode.ExtensionContext
): Promise<void> {
    if (context.globalState.get<boolean>(OFFERED_KEY) === true) {
        return;
    }
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return;
    }
    const root = folders[0].uri.fsPath;
    const marker = path.join(root, TARGET_SUBDIR, 'deckpilot-authoring', 'SKILL.md');
    if (fs.existsSync(marker)) {
        await context.globalState.update(OFFERED_KEY, true);
        return;
    }

    const choice = await vscode.window.showInformationMessage(
        'Deckpilot can install authoring skills so Copilot Chat knows how to create, convert, and enrich decks in this workspace.',
        'Install',
        'Not now',
        "Don't ask again"
    );

    if (choice === 'Install') {
        await installAuthoringSkills(context);
    } else if (choice === "Don't ask again") {
        await context.globalState.update(OFFERED_KEY, true);
    }
}
