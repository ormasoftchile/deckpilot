export const MERMAID_RENDERER_ID = 'mermaid';
export const MERMAID_RENDERER_PRIORITY = 10;
export const MERMAID_SUPPORTED_FENCE_LANGUAGES = ['mermaid'] as const;

export const mermaidCapabilities = {
  id: MERMAID_RENDERER_ID,
  priority: MERMAID_RENDERER_PRIORITY,
  supportedFenceLanguages: MERMAID_SUPPORTED_FENCE_LANGUAGES,
} as const;
