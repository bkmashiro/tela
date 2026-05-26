/**
 * Tests for the DocumentStore.
 */

import { DocumentStore } from './store.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function makeStore(): DocumentStore {
  // Use a temp dir for session storage
  return new DocumentStore(join(tmpdir(), `tela-test-${Date.now()}`));
}

describe('DocumentStore - create and render', () => {
  it('creates a document', () => {
    const store = makeStore();
    const docId = store.createDocument({ theme: 'warm-editorial', mode: 'landing' });
    expect(docId).toMatch(/^doc-/);
    const doc = store.getDocument(docId);
    expect(doc.ast.frontmatter.theme).toBe('warm-editorial');
  });

  it('renders a newly created document', () => {
    const store = makeStore();
    const docId = store.createDocument();
    const result = store.renderDocument(docId);
    expect(result.html).toContain('<!DOCTYPE html>');
    expect(result.html).toContain('New Page');
  });

  it('lists documents', () => {
    const store = makeStore();
    const id1 = store.createDocument();
    const id2 = store.createDocument();
    const docs = store.listDocuments();
    expect(docs.length).toBeGreaterThanOrEqual(2);
    expect(docs.some((d) => d.id === id1)).toBe(true);
    expect(docs.some((d) => d.id === id2)).toBe(true);
  });
});

describe('DocumentStore - section operations', () => {
  it('adds a section', () => {
    const store = makeStore();
    const docId = store.createDocument();

    const sectionId = store.addSection(docId, `features | grid(3):\n  - title: Feat 1\n    body: Body 1`);
    expect(sectionId).toBeTruthy();
    const doc = store.getDocument(docId);
    expect(doc.ast.sections.length).toBeGreaterThanOrEqual(2);
  });

  it('updates a section', () => {
    const store = makeStore();
    const docId = store.createDocument();
    const doc = store.getDocument(docId);
    const sectionId = doc.ast.sections[0].id;

    store.updateSection(docId, sectionId, `hero:\n  headline: Updated Headline\n`);
    const updatedDoc = store.getDocument(docId);
    expect(updatedDoc.ast.sections[0].block.properties['headline']).toBeDefined();
  });

  it('removes a section', () => {
    const store = makeStore();
    const docId = store.createDocument();
    const sectionId = store.addSection(docId, `prose:\n  body: Some text\n`);
    const beforeLen = store.getDocument(docId).ast.sections.length;

    store.removeSection(docId, sectionId);
    const afterLen = store.getDocument(docId).ast.sections.length;
    expect(afterLen).toBe(beforeLen - 1);
  });

  it('reorders sections', () => {
    const store = makeStore();
    const docId = store.createDocument();
    const s1 = store.addSection(docId, `prose:\n  body: First\n`);
    const s2 = store.addSection(docId, `quote:\n  text: Second\n  cite: Author\n`);

    const docBefore = store.getDocument(docId);
    const sectionIds = docBefore.ast.sections.map((s) => s.id);

    // Reverse order
    store.reorderSections(docId, sectionIds.reverse());
    const docAfter = store.getDocument(docId);
    expect(docAfter.ast.sections[0].id).toBe(sectionIds[0]);
  });
});

describe('DocumentStore - theme', () => {
  it('changes theme', () => {
    const store = makeStore();
    const docId = store.createDocument({ theme: 'warm-editorial' });
    store.setTheme(docId, 'dark-dramatic');
    const doc = store.getDocument(docId);
    expect(doc.ast.frontmatter.theme).toBe('dark-dramatic');
  });
});

describe('DocumentStore - undo', () => {
  it('undoes a mutation', () => {
    const store = makeStore();
    const docId = store.createDocument();

    const doc = store.getDocument(docId);
    const sectionId = doc.ast.sections[0].id;

    store.updateSection(docId, sectionId, `hero:\n  headline: Updated\n`);
    const description = store.undo(docId);
    expect(description).toContain('update_section');

    // After undo, headline should not be "Updated"
    const restoredDoc = store.getDocument(docId);
    const headline = restoredDoc.ast.sections[0].block.properties['headline'];
    if (headline?.type === 'string') {
      expect(headline.value).not.toBe('Updated');
    }
  });

  it('throws on undo with no history', () => {
    const store = makeStore();
    const docId = store.createDocument();
    expect(() => store.undo(docId)).toThrow('Nothing to undo');
  });
});

describe('DocumentStore - getSection', () => {
  it('returns annotated fragment', () => {
    const store = makeStore();
    const docId = store.createDocument();
    const doc = store.getDocument(docId);
    const sectionId = doc.ast.sections[0].id;

    const fragment = store.getSection(docId, sectionId);
    expect(fragment.sectionId).toBe(sectionId);
    expect(fragment.blockType).toBe('hero');
    expect(fragment.tela).toContain('hero:');
    expect(fragment.propertyPaths).toContain('headline');
  });
});
