/** 台本の 2 ファイルを、画面に出す件の一覧へ変換する */

import { type Align, stripAlignMarks, wrapAligned } from "./align.ts";
import { display, hasPunctuationHead, hasSplitName, trimLines } from "./display.ts";
import { wrapText } from "./web/wrap.js";

type Side = "source" | "target";

export type Entry = {
  index: number;
  speaker: string | null;
  source: string;
  target: string;
  /** 1 行の幅の上限（ドット）。表示するウィンドウを特定できなかった文は null */
  limit: number | null;
  /** 表示するウィンドウの行数。特定できなかった文は null */
  windowLines: number | null;
  /** 折り返した後の訳文のページに、ウィンドウの行数を超えるものがある */
  overflow: boolean;
  /** 折り返した後の訳文で、主人公か犬の名前が 2 行に分かれている */
  splitName: boolean;
  /** 折り返した後の訳文で、`、` や `。` などの記号が行の頭に来ている */
  punctuationHead: boolean;
  /** 訳文が続きから書かれる、直前の文の番号 */
  continues: number | null;
  /** `source` と `target` の先頭のうち、直前の文の字の数。改行は数えない */
  dim: Record<Side, number>;
  /** `source` と `target` の行ごとのそろえ方。改ページの空行も 1 行に数える */
  aligns: Record<Side, Align[]>;
  /** TOML に書かれたままの文。制御コードも含む */
  raw: { source: string; target: string };
};

/** 改ページは空行で表している */
function maxPageLines(text: string): number {
  return Math.max(...text.split("\n\n").map((page) => page.split("\n").length));
}

function countChars(text: string): number {
  return Array.from(stripAlignMarks(text).replaceAll("\n", "")).length;
}

type AdvanceOf = (char: string) => number;

/**
 * 文ごとの 1 行の幅の上限、ウィンドウの行数、同じウィンドウで直前に出しうる文と、
 * 原文と訳文それぞれの字の送り幅（字間を含む）
 */
export type Layout = {
  limits: Map<number, number>;
  windowLines: Map<number, number>;
  previous: Map<number, number[]>;
  advances: Record<Side, AdvanceOf>;
};

type Prefix = { from: number | null; text: string };

/**
 * 改ページせずに終えた文の次の文は、同じウィンドウで前の文の最後の位置から書かれる。
 * 直前の文が複数ありうるときは、番号の最も小さい文を使う
 */
function prefixes(bodies: Map<number, string>, previous: Map<number, number[]>) {
  const flows = new Map<number, string>();
  const visiting = new Set<number>();
  const prefixOf = (index: number): Prefix => {
    const from = (previous.get(index) ?? []).find((before) => bodies.has(before));
    if (from == null || visiting.has(from)) {
      return { from: null, text: "" };
    }
    const text = flowOf(from).split("\n\n").at(-1) ?? "";
    return text === "" ? { from: null, text } : { from, text };
  };
  const flowOf = (index: number): string => {
    const known = flows.get(index);
    if (known != null) {
      return known;
    }
    visiting.add(index);
    const flow = prefixOf(index).text + (bodies.get(index) ?? "");
    visiting.delete(index);
    flows.set(index, flow);
    return flow;
  };
  return prefixOf;
}

/**
 * `layout` があれば、原文と訳文をゲームと同じ位置で折り返す。
 * 上限が無い文は折り返さない。
 * 訳文が `false` の会話は、ゲームでは原文が出る。そのため訳文の欄にも原文を出す
 */
export function buildEntries(
  sources: Map<number, string>,
  targets: Map<number, string | false>,
  layout: Layout | null = null,
): Entry[] {
  const indexes = Array.from(new Set([...sources.keys(), ...targets.keys()]));
  const sourceOf = (index: number) => display(sources.get(index) ?? "", "source");
  const shown = {
    source: new Map(indexes.map((index) => [index, sourceOf(index)])),
    target: new Map(indexes.map((index) => {
      const target = targets.get(index);
      return [index, target === false ? sourceOf(index) : display(target ?? "", "target")];
    })),
  };
  const bodies = (side: Side) =>
    new Map(Array.from(shown[side], ([index, { body }]) => [index, body]));
  const previous = layout?.previous ?? new Map();
  const prefixOf = {
    source: prefixes(bodies("source"), previous),
    target: prefixes(bodies("target"), previous),
  };
  /** 続きの文は、間にウィンドウの設定が無いため、続きの先頭の文と同じウィンドウに出る */
  const headOf = (index: number): number => {
    const seen = new Set([index]);
    let head = index;
    for (let from = prefixOf.target(head).from; from != null && !seen.has(from);) {
      seen.add(from);
      head = from;
      from = prefixOf.target(head).from;
    }
    return head;
  };
  return indexes.sort((a, b) => a - b).map((index) => {
    const limit = layout?.limits.get(index) ?? null;
    const text = (side: Side) => {
      const flow = trimLines(prefixOf[side](index).text + (shown[side].get(index)?.body ?? ""));
      return wrapAligned(
        flow,
        (stripped) => layout == null ? stripped : wrapText(stripped, limit, layout.advances[side]),
      );
    };
    const source = text("source");
    const target = text("target");
    const targetText = target.text;
    const windowLines = layout?.windowLines.get(headOf(index)) ?? null;
    return {
      index,
      speaker: shown.target.get(index)?.speaker ?? null,
      source: source.text,
      target: targetText,
      limit,
      windowLines,
      overflow: windowLines != null && maxPageLines(targetText) > windowLines,
      splitName: hasSplitName(targetText),
      punctuationHead: hasPunctuationHead(targetText),
      continues: prefixOf.target(index).from,
      dim: {
        source: countChars(prefixOf.source(index).text),
        target: countChars(prefixOf.target(index).text),
      },
      aligns: { source: source.aligns, target: target.aligns },
      raw: { source: sources.get(index) ?? "", target: String(targets.get(index) ?? "") },
    };
  });
}

/** 改行を除く、`texts` に現れる文字 */
export function usedChars(texts: string[]): string[] {
  return Array.from(new Set(texts.flatMap((text) => Array.from(text.replaceAll("\n", "")))));
}
