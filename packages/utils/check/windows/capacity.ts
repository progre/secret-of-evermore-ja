/** 訳文の 1 ページの行数と 1 行の幅が、表示するウィンドウに収まるかを調べる */

import type { Piece } from "@core";
import { lineLimits, type WideLine, wideLines } from "./line_width.ts";
import { survey, type WindowSite } from "./event/walk.ts";

/** 1 行目は Y = 4 に置かれ、行ごとに 12 進む。Y が `高さ * 8 - 12` を超えるとページを送る */
export function linesFor(height: number): number {
  return Math.floor((height * 8 - 16) / 12) + 1;
}

/** ページごとの行数の最大。空のページは数えない */
export function maxPageLines(pieces: Piece[]): number {
  const pages = [[0]];
  for (const piece of pieces) {
    const page = pages[pages.length - 1];
    if (piece.kind === "pageBreak") {
      pages.push([0]);
    } else if (piece.kind === "newline") {
      page.push(0);
    } else if (piece.kind === "char" || piece.kind === "embed") {
      page[page.length - 1]++;
    }
  }
  return Math.max(
    0,
    ...pages.map((lines) => {
      const filled = lines.flatMap((count, index) => count > 0 ? [index] : []);
      return filled.length === 0 ? 0 : filled[filled.length - 1] - filled[0] + 1;
    }),
  );
}

type Overflow = { message: number; lines: number; capacity: number; site: WindowSite };

/** 複数の箇所に出る文は、入る行数が最も少ないウィンドウで比べる */
export function overflows(
  sites: WindowSite[],
  linesOf: (message: number) => number | null,
): Overflow[] {
  const worst = new Map<number, Overflow>();
  sites
    .flatMap((site) =>
      Array.from(site.messages, (message) => ({
        message,
        lines: linesOf(message) ?? 0,
        capacity: linesFor(site.window.height),
        site,
      }))
    )
    .filter((overflow) => overflow.lines > overflow.capacity)
    .forEach((overflow) => {
      const known = worst.get(overflow.message);
      if (known == null || overflow.capacity < known.capacity) {
        worst.set(overflow.message, overflow);
      }
    });
  return Array.from(worst.values()).sort((a, b) => a.message - b.message);
}

/** 文を表示するウィンドウの行数。複数あれば最も少ないもの。知らせ（`queued`）は 1 行のウィンドウに出る */
export function windowLines(sites: WindowSite[], queued: Set<number>): Map<number, number> {
  const lines = new Map<number, number>();
  const record = (message: number, capacity: number) => {
    lines.set(message, Math.min(lines.get(message) ?? capacity, capacity));
  };
  sites.forEach((site) => {
    site.messages.forEach((message) => record(message, linesFor(site.window.height)));
  });
  queued.forEach((message) => record(message, 1));
  return lines;
}

interface WindowCheck {
  overflows: Overflow[];
  unknownInstructions: number;
  /** 1 行のウィンドウに表示する知らせのうち、2 行以上あるもの */
  tallNotices: number[];
  wideLines: WideLine[];
  /** 文ごとの 1 行の幅の上限 */
  lineLimits: Map<number, number>;
  /** 文ごとのウィンドウの行数 */
  windowLines: Map<number, number>;
  /** 文ごとの、同じウィンドウで直前に出しうる文 */
  previous: Map<number, Set<number>>;
}

/** ROM は書き替えない。ウィンドウの高さは原版のまま使う。`widthOf` は字の幅 */
export function checkWindows(
  rom: Uint8Array,
  dialog: Map<number, Piece[]>,
  widthOf: Map<string, number>,
): WindowCheck {
  const scripts = survey(rom);
  const linesOf = (message: number) => {
    const pieces = dialog.get(message);
    return pieces == null ? null : maxPageLines(pieces);
  };
  return {
    overflows: overflows(scripts.sites, linesOf),
    unknownInstructions: scripts.unknownInstructions,
    tallNotices: Array.from(scripts.queued)
      .filter((message) => (linesOf(message) ?? 0) > 1)
      .sort((a, b) => a - b),
    wideLines: wideLines(scripts, dialog, widthOf),
    lineLimits: lineLimits(scripts),
    windowLines: windowLines(scripts.sites, scripts.queued),
    previous: scripts.previous,
  };
}
