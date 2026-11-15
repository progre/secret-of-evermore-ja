import { parseTranslation, translatedTexts } from "@features/dialog";
import { scan, shiftJisTable } from "@features/encoding";
import { buildGameFont } from "@features/font";

/**
 * ゲームのフォント形式のグリフデータ `font.bin`、幅テーブル `width.bin`、
 * 第 1 バイトの先頭位置表 `lead-offset.bin` を書き出す。
 * フォントに字形が無い字を訳文で使うと、ゲームでは空白になる。そうした字が訳文にあれば警告する。
 */
export async function buildFont(): Promise<void> {
  const bdfPath = "vendor/fusion-pixel-font/fusion-pixel-10px-proportional-ja.bdf";
  const scriptPaths = ["data/dialog-ja.toml", "data/fixed-ja.toml"];
  const outDir = "build";

  const font = buildGameFont(await Deno.readTextFile(bdfPath), shiftJisTable);
  await Deno.writeFile(outDir + "/font.bin", font.built.glyphs);
  await Deno.writeFile(outDir + "/width.bin", font.built.widths);
  await Deno.writeFile(outDir + "/lead-offset.bin", font.leadTable);

  const scripts = await Promise.all(scriptPaths.map((path) => Deno.readTextFile(path)));
  const used = usedChars(
    scripts.flatMap((text) => Array.from(translatedTexts(parseTranslation(text)).values())),
  );
  const missing = font.built.missing.filter((char) => used.has(char));
  if (missing.length > 0) {
    console.warn("Characters without glyphs in translations: " + missing.join(""));
  }
}

function usedChars(texts: string[]): Set<string> {
  return new Set(
    texts.flatMap((text) =>
      scan(text).flatMap((token) => token.kind === "char" ? [token.value] : [])
    ),
  );
}
