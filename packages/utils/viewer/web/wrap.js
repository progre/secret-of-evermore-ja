/**
 * ゲームの自動の折り返しを再現する。サーバーとブラウザーの両方が使う。
 * 単語を置くたびに、その行の幅の合計を上限と比べる。超える単語は次の行へ送る（`cc9f4f`）。
 * 日本語は 1 字ずつ、英数字はスペースまでを 1 単語として扱う。
 */

/** 字間。ゲームはウィンドウを設定するときにこの値を書き込む（`ccd941`） */
export const spacing = 1;

const words = /[\x21-\x7e]+|[^]/gu;

/**
 * @param {string} line
 * @param {number} limit
 * @param {(char: string) => number} advanceOf 字間を含む字の送り幅
 * @returns {string[]}
 */
function wrapLine(line, limit, advanceOf) {
  const lines = [""];
  let width = 0;
  for (const word of line.match(words) ?? []) {
    const wordWidth = Array.from(word).reduce((sum, char) => sum + advanceOf(char), 0);
    // 単語 1 つで上限を超えるときは、送っても収まらないので送らない（`cc9f65`）。
    // スペースは単語の区切りとして前の行の末尾に残し、次の行の頭には置かない
    const fits = width + wordWidth <= limit || wordWidth > limit;
    if (width > 0 && !fits && word !== " ") {
      lines.push("");
      width = 0;
    }
    lines[lines.length - 1] += word;
    width += wordWidth;
  }
  return lines;
}

/**
 * @param {string} text
 * @param {number | null} limit
 * @param {(char: string) => number} advanceOf
 * @returns {string}
 */
export function wrapText(text, limit, advanceOf) {
  if (limit == null) {
    return text;
  }
  return text.split("\n").flatMap((line) => wrapLine(line, limit, advanceOf)).join("\n");
}
