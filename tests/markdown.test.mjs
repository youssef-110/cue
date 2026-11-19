// Run: node --test tests/markdown.test.mjs  (Node 23.6+ strips the .ts types itself)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseInline, parseMarkdown, toggleCheck } from '../src/lib/markdown.ts'

test('only http(s) links become links', () => {
  assert.deepEqual(parseInline('[a](https://x.io)'), [{ t: 'link', href: 'https://x.io', c: [{ t: 'text', v: 'a' }] }])
  assert.deepEqual(parseInline('[a](javascript:alert(1))'), [{ t: 'text', v: '[a](javascript:alert(1)' }, { t: 'text', v: ')' }])
})

test('html stays plain text', () => {
  assert.deepEqual(parseMarkdown('<img src=x onerror=alert(1)>'), [{ t: 'p', lines: [[{ t: 'text', v: '<img src=x onerror=alert(1)>' }]] }])
})

test('inline styles, snake_case untouched', () => {
  assert.deepEqual(parseInline('**b** *i* `c` my_var_name'), [
    { t: 'b', c: [{ t: 'text', v: 'b' }] },
    { t: 'text', v: ' ' },
    { t: 'i', c: [{ t: 'text', v: 'i' }] },
    { t: 'text', v: ' ' },
    { t: 'code', v: 'c' },
    { t: 'text', v: ' my_var_name' },
  ])
})

test('blocks: headings, lists, checklists, code', () => {
  const md = '# Title\n- [ ] todo\n- [x] done\n- plain\n\n1. one\n```\n<b>x</b>\n```'
  const b = parseMarkdown(md)
  assert.equal(b[0].t, 'h')
  assert.deepEqual(b[1].items.map((i) => [i.check, i.line]), [[false, 1], [true, 2], [undefined, 3]])
  assert.equal(b[2].t, 'ol')
  assert.deepEqual(b[3], { t: 'code', v: '<b>x</b>' })
  assert.equal(toggleCheck(md, 1).split('\n')[1], '- [x] todo')
  assert.equal(toggleCheck(md, 2).split('\n')[2], '- [ ] done')
})
