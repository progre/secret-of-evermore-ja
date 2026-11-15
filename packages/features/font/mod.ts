/** Fusion Pixel 10px からのゲーム用フォントの生成 */

export { buildGameFont, gameGlyphs } from "./game/build.ts";
export { widthTable } from "./game/layout.ts";
export { copyOriginalFont, originalGlyphs, originalWidths, spaceWidth } from "./game/original.ts";
export { fontRegions } from "./game/region.ts";
export type { Font, Glyph } from "./glyph.ts";
