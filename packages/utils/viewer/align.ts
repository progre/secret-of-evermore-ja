/**
 * `{center}`、`{left}`、`{right}` による行のそろえ。
 * ゲームは、1 行の字を集め終えてから、旗を見て書き始めの X を決める（`cca17f`）。
 * 旗は次の印を読むまで変わらない。
 * このため、行の終わりまでに読んだ印が、その行のそろえ方になる。
 */

export type Align = "center" | "left" | "right";

/** 折り返しの前に抜き出すため、本文に現れない私用領域の字で印を表す */
export const alignMarks: ReadonlyMap<Align, string> = new Map([
  ["center", ""],
  ["left", ""],
  ["right", ""],
]);

const byMark = new Map(Array.from(alignMarks, ([align, mark]) => [mark, align]));

export function stripAlignMarks(text: string): string {
  return Array.from(text).filter((char) => !byMark.has(char)).join("");
}

/** 折り返しは改行を足すだけとする。`aligns` は折り返した後の行ごとのそろえ方 */
export function wrapAligned(
  flow: string,
  wrap: (text: string) => string,
): { text: string; aligns: Align[] } {
  let state: Align = "left";
  const chars: string[] = [];
  /**
   * 添字は、印を抜いた後の字の位置。
   * 値はそろえ方で、その字より前にある最後の印で決まる。
   * 最後の字の次の位置にも値を置く
   */
  const before: Align[] = [];
  for (const char of flow) {
    const align = byMark.get(char);
    if (align != null) {
      state = align;
      continue;
    }
    before.push(state);
    chars.push(char);
  }
  before.push(state);
  const text = wrap(chars.join(""));
  const aligns: Align[] = [];
  let at = 0;
  for (const char of text) {
    if (char !== "\n") {
      at++;
      continue;
    }
    aligns.push(before[at]);
    if (chars[at] === "\n") {
      at++;
    }
  }
  aligns.push(before[at]);
  return { text, aligns };
}
