import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { RaceTrack } from "../src/components/RaceTrack";
import { countWritingWords, editorPlainText } from "../src/lib/writingText";
import { recoverWritingBaseline, sprintWords } from "../src/lib/writingProgress";

const baseline = (overrides: Partial<Parameters<typeof recoverWritingBaseline>[0]> = {}) => recoverWritingBaseline({
  totalWords: 150, restoredWords: 123, storedBaseline: 20, hasLocalDraft: true, freshSprint: false, ...overrides,
});
assert.equal(sprintWords(150, baseline({ freshSprint: true }), true), 0, "Warm-up writing starts every racer at zero");
assert.equal(sprintWords(150, baseline(), true), 130, "Reconnect retains the seven local words not received by the server");
assert.equal(sprintWords(150, baseline({ storedBaseline: null }), true), 123, "Server progress recovers when the local baseline is unavailable");
assert.equal(sprintWords(0, baseline({ totalWords: 0, hasLocalDraft: false }), true), 123, "Awaiting a cloud draft does not reset earned progress");
assert.equal(sprintWords(0, baseline({ totalWords: 0, storedBaseline: -300, restoredWords: 290 }), true), 300, "Completed chapters survive a refresh with an empty current page");
assert.equal(sprintWords(3, 10, true), 0, "Deleting warm-up text cannot produce a negative score");
assert.equal(sprintWords(150, -300, false), 0, "Waiting and countdown writing earns no sprint score");

// Minimal DOM-shaped nodes exercise the same block-boundary traversal used
// by the real contenteditable without requiring a browser in this Node suite.
const textNode = (textContent: string) => ({ nodeType: 3, textContent, childNodes: [] });
const block = (tagName: string, ...childNodes: unknown[]) => ({ nodeType: 1, tagName, childNodes });
const plain = (tree: unknown) => editorPlainText(tree as HTMLElement);
assert.equal(countWritingWords(plain(block("DIV", textNode("first"), block("P", textNode("second"))))), 2, "Bare text followed by a native paragraph remains two words");
assert.equal(plain(block("DIV", block("P", textNode("one")), block("P", textNode("two")))).trim(), "one\ntwo", "Adjacent paragraphs keep a single separating newline");
assert.equal(countWritingWords(plain(block("DIV", textNode("one"), block("BR"), textNode("two\u00a0three")))), 3, "Soft breaks and non-breaking spaces remain word boundaries");
assert.equal(countWritingWords(plain(block("DIV", block("P", textNode("你好世界")), block("P", textNode("こんにちは"))))), 2, "Non-Latin paragraphs use the server's whitespace word convention");

const participants = [
  { id: "me", name: "A", wordCount: 0, wpm: 0, isCreator: true },
  { id: "long", name: "A much longer writer name", wordCount: 0, wpm: 0, isCreator: false },
];
const html = renderToStaticMarkup(<RaceTrack participants={participants} currentParticipantId="me" durationMinutes={5} />);
const anchors = [...html.matchAll(/class="racer-anchor" style="([^"]+)"/g)].map(match => match[1]);
assert.equal(anchors.length, 2);
assert.ok(anchors.every(style => style.includes("width:48px")), "Names and badges cannot alter either vehicle's start anchor");
assert.equal(anchors[0], anchors[1], "Both lanes use identical vehicle anchoring");

const deleting = renderToStaticMarkup(<RaceTrack participants={[{ ...participants[0], wordCount: 200 }, participants[1]]} currentParticipantId="me" durationMinutes={5} localWordCount={0} />);
assert.ok(!deleting.includes("200w"), "A deleted local draft cannot keep showing a stale 200-word lead");
console.log("PASS: warm-up starts, offline reconnect, cloud restore baseline, chapter continuation, deleted words, countdown score, native paragraph boundaries, fixed car anchors and stale score display");
