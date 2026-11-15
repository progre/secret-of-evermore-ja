/**
 * 原版のフォント。フォントブロックは 2 つあり、それぞれ 2 バイトの見出しと
 * 24 バイトのグリフ 128 個の後ろに、幅テーブル 128 バイトが続く。
 */

import type { Glyph } from "../glyph.ts";

const largeFont = 0x40000;
const blockSize = 0xc82;
const glyphHeight = 12;
const glyphBytes = glyphHeight * 2;
export const fontBlocksSize = blockSize * 2;

/** 幅テーブルの添字は文字コードから `0x20` を引いた値になる（`cca53a` の `SBC #$0x20`） */
export function originalWidths(rom: Uint8Array): Uint8Array {
  const start = largeFont + 2 + 128 * 24;
  return rom.slice(start, start + 128);
}

/**
 * スペース（`0x20`）の送り幅で、字間を含まない。
 * 描画ルーチンはスペースのグリフを描かずに、次の字の位置をウィンドウの `+0x04` の値だけ右へ進める（`cca534`）。
 * 会話のウィンドウでは `ccd941` が `+0x04` に 4 を書き込む
 */
export const spaceWidth = 4;

/**
 * 会話用のフォントの、表示文字（`0x21`-`0x7F`）のグリフ。キーは文字コード。
 * 送り幅は幅テーブルの値で、字間を含まない。
 * グリフは 16x12 で、左半分の 12 行の後ろに右半分の 12 行が続く
 */
export function originalGlyphs(rom: Uint8Array): Map<number, Glyph> {
  const widths = originalWidths(rom);
  const indexes = Array.from({ length: 0x80 - 0x21 }, (_, index) => index + 1);
  return new Map(indexes.map((index) => {
    const start = largeFont + 2 + index * glyphBytes;
    const rows = Array.from(
      { length: glyphHeight },
      (_, row) => (rom[start + row] << 8) | rom[start + glyphHeight + row],
    );
    return [0x20 + index, { advance: widths[index], width: 16, left: 0, top: 0, rows }];
  }));
}

/**
 * 原版フォントを拡張領域の `to` へ写す。日本語と同じバンクに置くことで、
 * グリフ参照のバンクを書き換えてもメニューなどの英語表示が壊れない。
 */
export function copyOriginalFont(rom: Uint8Array, to: number): void {
  rom.set(rom.subarray(largeFont, largeFont + fontBlocksSize), to);
}
