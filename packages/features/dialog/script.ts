/**
 * 台本ファイルの読み込み。件番号を鍵、本文を値とする TOML である。
 * 固定テキストの訳文も同じ形式で書く。
 * 台本ファイルを書き出すのは、検査の工程で原文を `build/` へ書き出すときだけである。
 * そのため、書き出しの処理は `packages/utils/check/script.ts` に置いている。
 */

import { parse as parseToml } from "@std/toml";

/**
 * 会話の訳文を読む。値が `false` の件は、原文のまま変えない件である。
 * 書き忘れた件と区別するため、変えない件も省かずに書く。
 */
export function parseTranslation(source: string): Map<number, string | false> {
  const table = parseToml(source);
  return new Map(
    Object.entries(table).map((pair): [number, string | false] => {
      if (typeof pair[1] !== "string" && pair[1] !== false) {
        throw new Error("第 " + pair[0] + " 件が文字列でも false でもない");
      }
      return [Number(pair[0]), pair[1]];
    }),
  );
}

/** 原文と固定テキストの訳文を読む。どの件も文字列で書く */
export function parseScript(source: string): Map<number, string> {
  const script = parseTranslation(source);
  const kept = Array.from(script).find((pair) => pair[1] === false);
  if (kept != null) {
    throw new Error("第 " + kept[0] + " 件が文字列ではない");
  }
  return translatedTexts(script);
}

/** 原文のまま変えない件を除く */
export function translatedTexts(script: Map<number, string | false>): Map<number, string> {
  return new Map(
    Array.from(script).flatMap((pair): [number, string][] => {
      const text = pair[1];
      return text === false ? [] : [[pair[0], text]];
    }),
  );
}
