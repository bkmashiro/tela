/**
 * Tela MCP server.
 * Exposes 15 tools for creating, editing, rendering, and checking Tela documents.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { DocumentStore } from './store.js';
import { COMPONENT_REGISTRY, listComponents } from '../primitives/index.js';
import { THEME_NAMES } from '../tokens/types.js';
import { THEME_PRESETS, WARM_EDITORIAL } from '../tokens/presets.js';

const store = new DocumentStore();

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'create_document',
    description: 'Create a new empty Tela document with optional theme, mode, and language.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        theme: { type: 'string', description: 'Theme preset name', default: 'warm-editorial' },
        mode: { type: 'string', enum: ['landing', 'article', 'docs'], default: 'landing' },
        lang: { type: 'string', description: 'BCP 47 language tag', default: 'en' },
      },
    },
  },
  {
    name: 'open_document',
    description: 'Open an existing .tela file and return a document ID for editing.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Absolute path to the .tela file' },
      },
      required: ['path'],
    },
  },
  {
    name: 'save_document',
    description: 'Save a document to disk as a .tela file.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        doc_id: { type: 'string', description: 'Document ID' },
        path: { type: 'string', description: 'Optional path to save to' },
      },
      required: ['doc_id'],
    },
  },
  {
    name: 'list_documents',
    description: 'List all open Tela documents.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'add_section',
    description: 'Add a new section to a document from a .tela fragment.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        doc_id: { type: 'string' },
        tela_fragment: { type: 'string', description: '.tela notation for the new section' },
        position: { type: 'number', description: 'Index to insert at (default: end)' },
      },
      required: ['doc_id', 'tela_fragment'],
    },
  },
  {
    name: 'update_section',
    description: 'Replace a section\'s content with a new .tela fragment.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        doc_id: { type: 'string' },
        section_id: { type: 'string' },
        tela_fragment: { type: 'string' },
      },
      required: ['doc_id', 'section_id', 'tela_fragment'],
    },
  },
  {
    name: 'remove_section',
    description: 'Remove a section from a document.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        doc_id: { type: 'string' },
        section_id: { type: 'string' },
      },
      required: ['doc_id', 'section_id'],
    },
  },
  {
    name: 'reorder_sections',
    description: 'Reorder sections in a document.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        doc_id: { type: 'string' },
        section_ids: { type: 'array', items: { type: 'string' } },
      },
      required: ['doc_id', 'section_ids'],
    },
  },
  {
    name: 'set_theme',
    description: 'Change the theme of a document. Supports override syntax: "warm-editorial + color.accent.default=#C84B31".',
    inputSchema: {
      type: 'object' as const,
      properties: {
        doc_id: { type: 'string' },
        theme_spec: { type: 'string' },
      },
      required: ['doc_id', 'theme_spec'],
    },
  },
  {
    name: 'get_section',
    description: 'Get the annotated .tela notation for a specific section.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        doc_id: { type: 'string' },
        section_id: { type: 'string' },
      },
      required: ['doc_id', 'section_id'],
    },
  },
  {
    name: 'update_block',
    description: 'Update specific properties of a block by path.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        doc_id: { type: 'string' },
        path: { type: 'string', description: 'Path: "section-0.key"' },
        props: { type: 'object', description: 'Key-value pairs to update' },
      },
      required: ['doc_id', 'path', 'props'],
    },
  },
  {
    name: 'render',
    description: 'Render a document to HTML. Returns the rendered HTML.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        doc_id: { type: 'string' },
      },
      required: ['doc_id'],
    },
  },
  {
    name: 'undo',
    description: 'Undo the last mutation to a document.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        doc_id: { type: 'string' },
      },
      required: ['doc_id'],
    },
  },
  {
    name: 'list_components',
    description: 'List all available Tela components/block types.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'list_themes',
    description: 'List all available Tela theme presets.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'list_modifiers',
    description: 'List all available modifiers with their valid values.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
];

// ─── Modifier vocabulary ─────────────────────────────────────────────────────

const MODIFIER_VOCAB = [
  { name: 'pad', description: 'Padding size', values: ['xs', 'sm', 'md', 'lg', 'xl', 'section'] },
  { name: 'gap', description: 'Gap between children', values: ['xs', 'sm', 'md', 'lg', 'xl'] },
  { name: 'bg', description: 'Background token', values: ['surface.default', 'surface.elevated', 'surface.inverted', 'surface.warm'] },
  { name: 'rounded', description: 'Apply border radius', values: [] },
  { name: 'shadow', description: 'Shadow elevation', values: ['sm', 'md', 'lg'] },
  { name: 'bleed', description: 'Remove max-width constraint', values: [] },
  { name: 'aspect', description: 'Aspect ratio', values: ['16/9', '4/3', '1/1', '3/2'] },
  { name: 'float', description: 'Float element right', values: [] },
  { name: 'accent', description: 'Use accent color treatment', values: [] },
  { name: 'muted', description: 'Use muted color treatment', values: [] },
  { name: 'inverted', description: 'Use inverted color scheme', values: [] },
  { name: 'centered', description: 'Center content horizontally', values: [] },
  { name: 'role', description: 'Button role', values: ['primary', 'ghost', 'danger'] },
  { name: 'grid', description: 'Grid column count', values: ['1', '2', '3', '4', '5', '6'] },
  { name: 'split', description: 'Split ratio', values: ['50/50', '60/40', '40/60', '70/30'] },
  { name: 'sticky', description: 'Sticky positioning (nav)', values: [] },
  { name: 'id', description: 'Explicit section ID', values: [] },
  { name: 'masonry', description: 'Masonry layout (gallery)', values: [] },
];

// ─── Server setup ─────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'tela', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args ?? {}) as Record<string, unknown>;

  try {
    switch (name) {
      case 'create_document': {
        const docId = store.createDocument({
          theme: a['theme'] as string | undefined,
          mode: a['mode'] as 'landing' | 'article' | 'docs' | undefined,
          lang: a['lang'] as string | undefined,
        });
        const doc = store.getDocument(docId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              doc_id: docId,
              theme: doc.ast.frontmatter.theme,
              mode: doc.ast.frontmatter.mode,
            }),
          }],
        };
      }

      case 'open_document': {
        const docId = store.openDocument(a['path'] as string);
        const doc = store.getDocument(docId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              doc_id: docId,
              theme: doc.ast.frontmatter.theme,
              mode: doc.ast.frontmatter.mode,
              section_count: doc.ast.sections.length,
              section_ids: doc.ast.sections.map((s) => s.id),
            }),
          }],
        };
      }

      case 'save_document': {
        const savedPath = store.saveDocument(
          a['doc_id'] as string,
          a['path'] as string | undefined
        );
        return {
          content: [{ type: 'text', text: JSON.stringify({ saved_path: savedPath }) }],
        };
      }

      case 'list_documents': {
        const docs = store.listDocuments();
        return {
          content: [{ type: 'text', text: JSON.stringify(docs) }],
        };
      }

      case 'add_section': {
        const sectionId = store.addSection(
          a['doc_id'] as string,
          a['tela_fragment'] as string,
          a['position'] as number | undefined
        );
        return {
          content: [{ type: 'text', text: JSON.stringify({ section_id: sectionId }) }],
        };
      }

      case 'update_section': {
        store.updateSection(
          a['doc_id'] as string,
          a['section_id'] as string,
          a['tela_fragment'] as string
        );
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true }) }],
        };
      }

      case 'remove_section': {
        store.removeSection(a['doc_id'] as string, a['section_id'] as string);
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true }) }],
        };
      }

      case 'reorder_sections': {
        store.reorderSections(
          a['doc_id'] as string,
          a['section_ids'] as string[]
        );
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true }) }],
        };
      }

      case 'set_theme': {
        store.setTheme(a['doc_id'] as string, a['theme_spec'] as string);
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true }) }],
        };
      }

      case 'get_section': {
        const fragment = store.getSection(
          a['doc_id'] as string,
          a['section_id'] as string
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(fragment) }],
        };
      }

      case 'update_block': {
        store.updateBlock(
          a['doc_id'] as string,
          a['path'] as string,
          a['props'] as Record<string, unknown>
        );
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true }) }],
        };
      }

      case 'render': {
        const result = store.renderDocument(a['doc_id'] as string);
        return {
          content: [{ type: 'text', text: JSON.stringify({
            html: result.html,
            rendered_sections: result.renderedSections,
            section_ids: result.sectionIds,
          }) }],
        };
      }

      case 'undo': {
        const description = store.undo(a['doc_id'] as string);
        return {
          content: [{ type: 'text', text: JSON.stringify({ restored: description }) }],
        };
      }

      case 'list_components': {
        return {
          content: [{ type: 'text', text: JSON.stringify(listComponents()) }],
        };
      }

      case 'list_themes': {
        const themes = THEME_NAMES.map((name) => ({
          name,
          tokenCount: Object.keys(THEME_PRESETS[name]).length,
        }));
        return {
          content: [{ type: 'text', text: JSON.stringify(themes) }],
        };
      }

      case 'list_modifiers': {
        return {
          content: [{ type: 'text', text: JSON.stringify(MODIFIER_VOCAB) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
});

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function startMcpServer(): Promise<void> {
  store.restoreSessions();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
