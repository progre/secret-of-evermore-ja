/** TOML の文を、描くための文字列へ変える。改ページは空行で表す */

import { readPieces, scan } from "@features/encoding";
import { type Align, alignMarks } from "./align.ts";

/** 差し込みの実際の内容はゲームの進行で決まるため、読みやすさのための仮の文字を出す */
const anyEmbed = "○";
/** 折り返しの位置は、幅が最も広い名前を差し込んで決める。英語版では `mmmmmmmmm.` が最も広い */
const widestSourceName = "mmmmmmmmm.";
const sourceNames = new Map([["dog", widestSourceName], ["hero", widestSourceName]]);
/** 日本語版の名前は 9 文字まで付けられる */
const targetNames = new Map([["dog", "犬□□□□□□□□"], ["hero", "主人公□□□□□□"]]);

/** 折り返しは改行を足すだけなので、名前の字の間に改行が入っていれば分かれている */
const splitTargetNames = Array.from(
  targetNames.values(),
  (name) => new RegExp(Array.from(name).join("\n?"), "g"),
);

/** 行の頭に来てはならない記号。この記号の直前で改行すると、記号だけが次の行に送られる */
const notAtLineHead = /^[、。！？…」』）]/;
/** 台詞を `…` で始めるのは自然な書き方なので、ページの 1 行目の `…` は許す */
const notAtPageHead = /^[、。！？」』）]/;

export function hasPunctuationHead(text: string): boolean {
  return text.split("\n\n").some((page) =>
    page.split("\n").some((line, at) => (at === 0 ? notAtPageHead : notAtLineHead).test(line))
  );
}

export function hasSplitName(text: string): boolean {
  return splitTargetNames.some((pattern) =>
    Array.from(text.matchAll(pattern)).some((match) => match[0].includes("\n"))
  );
}

/**
 * `body` は前後の改行を残す。
 * 改ページで終わる文は `\n\n` で終わる。
 * 次の文を前の文の続きから書くかは、前の文の `body` の末尾が `\n\n` かどうかで決める。
 * そろえの制御コードは、`align.ts` の印として残す
 */
export function display(text: string, side: "source" | "target") {
  const names = side === "source" ? sourceNames : targetNames;
  const pieces = readPieces(text);
  const speaker = pieces.flatMap((piece) => piece.kind === "speaker" ? [piece.name] : [])[0];
  const body = scan(text).map((token, at) => {
    if (token.kind === "char") {
      return token.value;
    }
    if (token.kind === "newline") {
      return "\n";
    }
    const kind = pieces[at].kind;
    if (kind === "embed") {
      return names.get(token.body) ?? anyEmbed;
    }
    if (kind === "pageBreak") {
      return "\n\n";
    }
    return alignMarks.get(token.body as Align) ?? "";
  }).join("");
  // 選択肢の後は必ず改ページされる
  const hasChoice = scan(text).some((token) => token.kind === "token" && token.body === "choice");
  return {
    speaker: speaker ?? null,
    body: (body + (hasChoice ? "\n\n" : "")).replace(/\n{3,}/g, "\n\n"),
  };
}

export function trimLines(text: string): string {
  return text.replace(/^\n+|\n+$/g, "");
}
