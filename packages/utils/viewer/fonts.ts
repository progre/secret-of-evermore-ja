/** 原文を描く原版のフォントと、訳文を描く日本語のフォント */

import { originalCodec, scan, shiftJisCodec, shiftJisTable } from "@features/encoding";
import {
  buildGameFont,
  type Font,
  gameGlyphs,
  type Glyph,
  originalGlyphs,
  originalWidths,
  spaceWidth,
  widthTable,
} from "@features/font";
import type { TextCodec } from "@core";
import { usedChars } from "./model.ts";
import { spacing } from "./web/wrap.js";

/** ゲームのフォントに無い字の送り幅。全角の字と同じにする */
const missingWidth = 10;
const narrowOffset = 1;
/** ゲームはスペースの字形を描かず、送るだけ */
const space: Glyph = { advance: spaceWidth, width: 0, left: 0, top: 0, rows: [] };

/** `advanceOf` は字間を含む送り幅 */
export type ViewerFont = { glyphs: Font; advanceOf: (char: string) => number };

/**
 * 原版のフォントの字形に、`codec` で 1 バイトの文字コードが表す文字を対応付ける。
 * 符号は `{` を `{{` と書き出し、1 字で表せない値は `{21}` のようなトークンにする。
 * `scan` で字だけを取り出す
 */
function byteGlyphs(rom: Uint8Array, codec: TextCodec): Font {
  return new Map(
    Array.from(originalGlyphs(rom)).flatMap(([code, glyph]) =>
      scan(codec.decode(Uint8Array.of(code)))
        .flatMap((token) => token.kind === "char" ? [[token.value, glyph] as const] : [])
    ),
  );
}

function sourceFont(rom: Uint8Array): ViewerFont {
  const glyphs = byteGlyphs(rom, originalCodec).set(" ", space);
  return { glyphs, advanceOf: (char) => (glyphs.get(char)?.advance ?? missingWidth) + spacing };
}

/**
 * 日本語版も、1 バイトの字は原版のフォントで描く。
 * 1 バイトの字は 1 ドット下げて、大文字の下端を日本語の字にそろえる（`narrow_offset.s`）
 */
function targetGlyphs(bdf: string, rom: Uint8Array): Font {
  const narrow = Array.from(
    byteGlyphs(rom, shiftJisCodec),
    ([char, glyph]) => [char, { ...glyph, top: glyph.top + narrowOffset }] as const,
  );
  return new Map([...gameGlyphs(bdf), ...narrow]).set(" ", space);
}

/** 送り幅はゲームの幅の表から取る。日本語の字は BDF から、1 バイトの字は原版の ROM から求める */
function targetFont(bdf: string, rom: Uint8Array): ViewerFont {
  const gameFont = buildGameFont(bdf, shiftJisTable);
  const widths = widthTable(
    shiftJisTable,
    shiftJisCodec,
    gameFont.built.widths,
    originalWidths(rom),
  );
  widths.set(" ", spaceWidth);
  return {
    glyphs: targetGlyphs(bdf, rom),
    advanceOf: (char) => (widths.get(char) ?? missingWidth) + spacing,
  };
}

/** `bdf` は日本語のフォント、`rom` は原版の ROM */
export function loadFonts(bdf: string, rom: Uint8Array) {
  return { source: sourceFont(rom), target: targetFont(bdf, rom) };
}

/** `texts` に現れる字のグリフ。送り幅は字間を含めた値にする */
export function pickGlyphs(font: ViewerFont, texts: string[]): Record<string, Glyph> {
  return Object.fromEntries(
    usedChars(texts).flatMap((char) => {
      const glyph = font.glyphs.get(char);
      return glyph == null ? [] : [[char, { ...glyph, advance: font.advanceOf(char) }] as const];
    }),
  );
}
