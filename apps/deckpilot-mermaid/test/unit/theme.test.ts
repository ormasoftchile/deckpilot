import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { resolveMermaidTheme } from '../../src/theme';

describe('resolveMermaidTheme', () => {
  afterEach(() => {
    (vscode.window as { activeColorTheme: { kind: vscode.ColorThemeKind } }).activeColorTheme = {
      kind: vscode.ColorThemeKind.Dark,
    };
  });

  it('maps light VS Code themes to Mermaid default', () => {
    const config = resolveMermaidTheme({ attributes: { theme: 'auto' } }, vscode.ColorThemeKind.Light);

    assert.equal(config.theme, 'default');
    assert.equal(config.darkMode, false);
    assert.equal(config.themeVariables.primaryTextColor, '#1f2328');
  });

  it('maps high contrast themes to Mermaid neutral', () => {
    const config = resolveMermaidTheme(undefined, vscode.ColorThemeKind.HighContrast);

    assert.equal(config.theme, 'neutral');
    assert.equal(config.themeVariables.primaryBorderColor, '#ffff00');
  });

  it('honors fence theme overrides over VS Code auto detection', () => {
    const config = resolveMermaidTheme(
      { attributes: { theme: 'dark' } },
      vscode.ColorThemeKind.Light,
    );

    assert.equal(config.theme, 'dark');
    assert.equal(config.darkMode, true);
  });

  it('falls back to the active VS Code theme when no override is passed', () => {
    (vscode.window as { activeColorTheme: { kind: vscode.ColorThemeKind } }).activeColorTheme = {
      kind: vscode.ColorThemeKind.Light,
    };

    const config = resolveMermaidTheme({ attributes: { theme: 'auto' } });

    assert.equal(config.theme, 'default');
  });
});
