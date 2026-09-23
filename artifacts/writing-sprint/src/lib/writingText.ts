/** Match the server's whitespace-based score for all writing scripts. */
export function countWritingWords(text: string): number {
  return text.match(/\S+/g)?.length ?? 0;
}

const BLOCK_TAG = /^(P|DIV|LI|H[1-6]|PRE|BLOCKQUOTE|TR|TD|TH)$/;

/** Native editing/undo can leave a bare text node before a paragraph. The
 * boundary before that paragraph matters just as much as its trailing break. */
export function editorPlainText(element: HTMLElement): string {
  const isBlock = (node: Node) => node.nodeType === 1 && BLOCK_TAG.test((node as Element).tagName);
  const read = (node: Node): string => {
    if (node.nodeType === 3) return node.textContent ?? "";
    if (node.nodeType === 1 && (node as Element).tagName === "BR") return "\n";
    let text = "";
    for (const child of Array.from(node.childNodes)) {
      if (isBlock(child) && text && !text.endsWith("\n")) text += "\n";
      text += read(child);
    }
    return isBlock(node) && !text.endsWith("\n") ? text + "\n" : text;
  };
  return read(element).replace(/\u00a0/g, " ");
}
