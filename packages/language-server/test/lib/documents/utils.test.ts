import * as assert from 'assert';
import {
    getLineAtPosition,
    extractStyleTag,
    extractScriptTags,
} from '../../../src/lib/documents/utils';
import { Position } from 'vscode-languageserver';

describe('document/utils', () => {
    describe('extractTag', () => {
        it('supports boolean attributes', () => {
            const extracted = extractStyleTag('<style test></style>');
            assert.deepStrictEqual(extracted?.attributes, { test: 'test' });
        });

        it('supports unquoted attributes', () => {
            const extracted = extractStyleTag('<style type=text/css></style>');
            assert.deepStrictEqual(extracted?.attributes, {
                type: 'text/css',
            });
        });

        it('does not extract style tag inside comment', () => {
            const text = `
                <p>bla</p>
                <!--<style>h1{ color: blue; }</style>-->
                <style>p{ color: blue; }</style>
            `;
            assert.deepStrictEqual(extractStyleTag(text), {
                content: 'p{ color: blue; }',
                attributes: {},
                start: 108,
                end: 125,
                startPos: Position.create(3, 23),
                endPos: Position.create(3, 40),
                container: { start: 101, end: 133 },
            });
        });

        it('does not extract tags starting with style/script', () => {
            // https://github.com/sveltejs/language-tools/issues/43
            // this would previously match <styles>....</style> due to misconfigured attribute matching regex
            const text = `
            <styles>p{ color: blue; }</styles>
            <p>bla</p>
            ></style>
            `;
            assert.deepStrictEqual(extractStyleTag(text), null);
        });

        it('is canse sensitive to style/script', () => {
            const text = `
            <Style></Style>
            <Script></Script>
            `;
            assert.deepStrictEqual(extractStyleTag(text), null);
            assert.deepStrictEqual(extractScriptTags(text), null);
        });

        it('only extract attribute until tag ends', () => {
            const text = `
            <script type="typescript">
            () => abc
            </script>
            `;
            const extracted = extractScriptTags(text);
            const attributes = extracted?.script?.attributes;
            assert.deepStrictEqual(attributes, { type: 'typescript' });
        });

        it('extracts style tag', () => {
            const text = `
                <p>bla</p>
                <style>p{ color: blue; }</style>
            `;
            assert.deepStrictEqual(extractStyleTag(text), {
                content: 'p{ color: blue; }',
                attributes: {},
                start: 51,
                end: 68,
                startPos: Position.create(2, 23),
                endPos: Position.create(2, 40),
                container: { start: 44, end: 76 },
            });
        });

        it('extracts style tag with attributes', () => {
            const text = `
                <style lang="scss">p{ color: blue; }</style>
            `;
            assert.deepStrictEqual(extractStyleTag(text), {
                content: 'p{ color: blue; }',
                attributes: { lang: 'scss' },
                start: 36,
                end: 53,
                startPos: Position.create(1, 35),
                endPos: Position.create(1, 52),
                container: { start: 17, end: 61 },
            });
        });

        it('extracts style tag with attributes and extra whitespace', () => {
            const text = `
                <style     lang="scss"    >  p{ color: blue; }  </style>
            `;
            assert.deepStrictEqual(extractStyleTag(text), {
                content: '  p{ color: blue; }  ',
                attributes: { lang: 'scss' },
                start: 44,
                end: 65,
                startPos: Position.create(1, 43),
                endPos: Position.create(1, 64),
                container: { start: 17, end: 73 },
            });
        });

        it('extracts top level script tag only', () => {
            const text = `
                {#if name}
                    <script>
                        console.log('not top level')
                    </script>
                {/if}
                <ul>
                    {#each cats as cat}
                        <script>
                            console.log('not top level')
                        </script>
                    {/each}
                </ul>
                {#await promise}
                    <script>
                        console.log('not top level')
                    </script>
                {:then number}
                    <script>
                        console.log('not top level')
                    </script>
                {:catch error}
                    <script>
                        console.log('not top level')
                    </script>
                {/await}
                <p>{@html <script> consolelog('not top level')</script>}</p>
                {@html mycontent}
                {@debug myvar}
                <!-- p{ color: blue; }</script> -->
                <!--<script lang="scss">
                p{ color: blue; }
                </script> -->
                <scrit>blah</scrit>
                <script>top level script</script>
            `;
            // Note: cannot test <scrit>blah</scriPt> as that breaks parse5 parsing for top level script!

            assert.deepStrictEqual(extractScriptTags(text)?.script, {
                content: 'top level script',
                attributes: {},
                start: 1212,
                end: 1228,
                startPos: Position.create(34, 24),
                endPos: Position.create(34, 40),
                container: { start: 1204, end: 1237 },
            });
        });

        it('ignores script tag in svelte:head', () => {
            // https://github.com/sveltejs/language-tools/issues/143#issuecomment-636422045
            const text = `
            <svelte:head>
                <link rel="stylesheet" href="/lib/jodit.es2018.min.css" />
                <script src="/lib/jodit.es2018.min.js"> 
                </script>
            </svelte:head>
            <p>jo</p>
            <script>top level script</script>
            <h1>Hello, world!</h1>
            <style>.bla {}</style>
            `;
            assert.deepStrictEqual(extractScriptTags(text)?.script, {
                content: 'top level script',
                attributes: {},
                start: 254,
                end: 270,
                startPos: Position.create(7, 20),
                endPos: Position.create(7, 36),
                container: { start: 246, end: 279 },
            });
        });

        it('extracts script and module script', () => {
            const text = `
            <script context="module">a</script>
            <script>b</script>
            `;
            assert.deepStrictEqual(extractScriptTags(text), {
                moduleScript: {
                    attributes: {
                        context: 'module',
                    },
                    container: {
                        end: 48,
                        start: 13,
                    },
                    content: 'a',
                    start: 38,
                    end: 39,
                    startPos: {
                        character: 37,
                        line: 1,
                    },
                    endPos: {
                        character: 38,
                        line: 1,
                    },
                },
                script: {
                    attributes: {},
                    container: {
                        end: 79,
                        start: 61,
                    },
                    content: 'b',
                    start: 69,
                    end: 70,
                    startPos: {
                        character: 20,
                        line: 2,
                    },
                    endPos: {
                        character: 21,
                        line: 2,
                    },
                },
            });
        });
    });

    describe('#getLineAtPosition', () => {
        it('should return line at position (only one line)', () => {
            assert.deepStrictEqual(getLineAtPosition(Position.create(0, 1), 'ABC'), 'ABC');
        });

        it('should return line at position (multiple lines)', () => {
            assert.deepStrictEqual(
                getLineAtPosition(Position.create(1, 1), 'ABC\nDEF\nGHI'),
                'DEF\n',
            );
        });
    });
});
