/**
 * DA-25: Unit tests for the serializeDeck() pure function extracted from
 * showResolvedModel.ts.
 *
 * Covers:
 * - Valid objects → valid JSON string
 * - Circular references → '[Circular]' string, no throw
 * - Function values → stripped from output
 * - Edge cases: null, arrays, nested objects, deeply nested circular
 */

import { expect } from 'chai';
import { serializeDeck } from '../../../src/commands/showResolvedModel';

describe('serializeDeck', () => {
    describe('valid objects', () => {
        it('serializes a simple flat object to valid JSON', () => {
            const input = { name: 'test', count: 42, active: true };
            const json = serializeDeck(input);
            const parsed = JSON.parse(json);
            expect(parsed.name).to.equal('test');
            expect(parsed.count).to.equal(42);
            expect(parsed.active).to.equal(true);
        });

        it('serializes a deck-like object with nested slides array', () => {
            const input = {
                filePath: '/demo.deck.md',
                slides: [{ index: 0, id: 'intro', content: '# Hello' }],
                metadata: { title: 'Demo' },
                currentSlideIndex: 0,
                state: 'active',
            };
            const json = serializeDeck(input);
            const parsed = JSON.parse(json) as typeof input;
            expect(parsed.filePath).to.equal('/demo.deck.md');
            expect(parsed.slides).to.have.length(1);
            expect(parsed.metadata.title).to.equal('Demo');
        });

        it('serializes an empty object to {}', () => {
            const json = serializeDeck({});
            const parsed = JSON.parse(json);
            expect(parsed).to.deep.equal({});
        });

        it('preserves null values in the output', () => {
            const input = { a: null, b: 'hello' };
            const json = serializeDeck(input);
            const parsed = JSON.parse(json) as typeof input;
            expect(parsed.a).to.equal(null);
            expect(parsed.b).to.equal('hello');
        });

        it('preserves arrays of primitives', () => {
            const input = { cues: ['First', 'Second', 'Third'], count: 3 };
            const json = serializeDeck(input);
            const parsed = JSON.parse(json) as typeof input;
            expect(parsed.cues).to.deep.equal(['First', 'Second', 'Third']);
        });

        it('preserves arrays of objects', () => {
            const input = {
                slides: [
                    { index: 0, id: 'a' },
                    { index: 1, id: 'b' },
                ],
            };
            const json = serializeDeck(input);
            const parsed = JSON.parse(json) as typeof input;
            expect(parsed.slides).to.have.length(2);
            expect(parsed.slides[1].id).to.equal('b');
        });
    });

    describe('circular reference handling', () => {
        it('replaces a direct circular reference with "[Circular]" and does not throw', () => {
            const obj: Record<string, unknown> = { name: 'root' };
            obj['self'] = obj; // direct cycle
            expect(() => serializeDeck(obj)).not.to.throw();
            const json = serializeDeck(obj);
            const parsed = JSON.parse(json) as Record<string, unknown>;
            expect(parsed['self']).to.equal('[Circular]');
            expect(parsed['name']).to.equal('root');
        });

        it('replaces a nested circular reference at the correct depth', () => {
            const parent: Record<string, unknown> = { label: 'parent' };
            const child: Record<string, unknown> = { label: 'child', parent };
            parent['child'] = child; // parent → child → parent
            const json = serializeDeck(parent);
            const parsed = JSON.parse(json) as Record<string, unknown>;
            const childParsed = parsed['child'] as Record<string, unknown>;
            expect(childParsed['label']).to.equal('child');
            expect(childParsed['parent']).to.equal('[Circular]');
        });
    });

    describe('function stripping', () => {
        it('omits function values from the serialized output', () => {
            const input = {
                name: 'deck',
                getValue: () => 42,
                title: 'My Talk',
            };
            const json = serializeDeck(input);
            const parsed = JSON.parse(json) as Record<string, unknown>;
            expect(parsed['name']).to.equal('deck');
            expect(parsed['title']).to.equal('My Talk');
            expect(Object.prototype.hasOwnProperty.call(parsed, 'getValue')).to.be.false;
        });
    });
});
