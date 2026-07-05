export type MermaidTheme = 'auto' | 'default' | 'dark' | 'neutral';

export function resolveMermaidTheme(theme?: string): MermaidTheme {
  switch (theme) {
    case 'auto':
      return 'auto';
    case 'dark':
    case 'midnight':
      return 'dark';
    case 'contrast':
      return 'neutral';
    case 'light':
    case 'default':
    case 'minimal':
    case 'blueprint':
    case 'editorial':
      return 'default';
    default:
      return 'auto';
  }
}
