/** 原文と訳文を、ゲームのフォントのドットそのままで canvas に描く */

import { wrapText } from "./wrap.js";

/** 拡大率 100% のときの、1 ドットあたりの物理ピクセル数 */
const baseScale = 2;
const lineHeight = 12;
/** フォントに字形が無い文字の送り幅。サーバーが送る送り幅と同じく、字間の 1 を含む */
const missingAdvance = 11;
const ink = "#e0e0e0";
/** スクリプトのウィンドウの左の余白（`ccd941` が `+0x0A` に置く値） */
const leftMargin = 4;
/** 前の文から続く部分の字の色 */
const dimInk = "#707070";
const windowColor = "#2c3440";
/** ウィンドウの行数を超えた行の背景 */
const overflowColor = "#5a2a2a";

/** キーは `source`（原版のフォント）と `target`（日本語のフォント） */
let glyphs = { source: {}, target: {} };
/** 1 ドットの CSS ピクセル数 */
let dotSize = 1;
/** どのウィンドウに出るか分からない文を折り返す幅（ドット）。セルの幅から求める */
let cellLimit = null;

export function setGlyphs(next) {
  glyphs = next;
}

/** 1 ドットを整数の物理ピクセルにする。端数があると、ドットごとに太さが変わる */
function updateDotSize() {
  const ratio = globalThis.devicePixelRatio;
  dotSize = Math.max(1, Math.round(baseScale * ratio)) / ratio;
  document.documentElement.style.setProperty("--dot", dotSize + "px");
}

updateDotSize();
globalThis.addEventListener("resize", updateDotSize);

/** `pixels` はセルの幅（CSS ピクセル）。折り返す幅が変わったら true を返す */
export function setCellWidth(pixels) {
  const next = Math.max(1, Math.floor(pixels / dotSize));
  const changed = next !== cellLimit;
  cellLimit = next;
  return changed;
}

function advanceOf(font, char) {
  return font[char]?.advance ?? missingAdvance;
}

/** どのウィンドウに出るか分からない文（`limit` が null）は、セルの幅で折り返す */
export function wrapForCell(text, fontName, limit) {
  const font = glyphs[fontName];
  return limit == null ? wrapText(text, cellLimit, (char) => advanceOf(font, char)) : text;
}

function lineWidth(font, line) {
  return Array.from(line).reduce((width, char) => width + advanceOf(font, char), 0);
}

function drawGlyph(context, glyph, penX, lineTop) {
  glyph.rows.forEach((bits, row) => {
    Array.from({ length: glyph.width }, (_, column) => column)
      .filter((column) => (bits >> (glyph.width - 1 - column)) & 1)
      .forEach((column) => {
        context.fillRect(penX + glyph.left + column, lineTop + glyph.top + row, 1, 1);
      });
  });
}

function drawChar(context, glyph, penX, lineTop) {
  if (glyph == null) {
    context.strokeRect(penX + 0.5, lineTop + 0.5, missingAdvance - 1, lineHeight - 1);
    return;
  }
  drawGlyph(context, glyph, penX, lineTop);
}

/**
 * 行の書き始めの X。canvas の 0 はウィンドウの左の余白の右端にあたる。
 * ゲームは中央寄せの X を（上限 − 行の幅）÷ 2 とし、左の余白を足さない（`cca18b`）。
 * このため中央寄せの行は、余白の分だけ左に寄る
 */
function alignedX(align, limit, width) {
  if (align === "center") {
    return Math.floor((limit - width) / 2) - leftMargin;
  }
  return align === "right" ? limit - width : 0;
}

function drawText(canvas) {
  const font = glyphs[canvas.dataset.font];
  const context = canvas.getContext("2d");
  if (canvas.dataset.limit != null) {
    const width = Number(canvas.dataset.limit);
    const windowHeight = canvas.dataset.windowLines == null
      ? canvas.height
      : Number(canvas.dataset.windowLines) * lineHeight;
    context.fillStyle = windowColor;
    context.fillRect(0, 0, width, windowHeight);
    context.fillStyle = overflowColor;
    context.fillRect(0, windowHeight, width, canvas.height - windowHeight);
  }
  let remainingDim = Number(canvas.dataset.dim ?? 0);
  const aligns = JSON.parse(canvas.dataset.aligns ?? "[]");
  const limit = Number(canvas.dataset.limit ?? 0);
  canvas.dataset.text.split("\n").forEach((line, lineNumber) => {
    let penX = alignedX(aligns[lineNumber], limit, lineWidth(font, line));
    for (const char of line) {
      const color = remainingDim > 0 ? dimInk : ink;
      remainingDim--;
      context.fillStyle = color;
      context.strokeStyle = color;
      drawChar(context, font[char], penX, lineNumber * lineHeight);
      penX += advanceOf(font, char);
    }
  });
}

/** すべてを一度に描くと重いため、表示範囲の前後 1000px に入ったものだけを描く */
const observer = new IntersectionObserver((events) => {
  events.filter((event) => event.isIntersecting).forEach((event) => {
    observer.unobserve(event.target);
    drawText(event.target);
  });
}, { root: document.querySelector("#scroller"), rootMargin: "1000px" });

/**
 * `fontName` は `glyphs` のキー。
 * `limit` は 1 行の幅の上限。指定があれば、上限までの幅をウィンドウの色で塗る。
 * `windowLines` はウィンドウの行数。指定があれば、その高さの枠を描き、超えた行は別の色で塗る。
 * `dim` は先頭から薄く描く字の数（改行は数えない）。前の文から続く部分に使う。
 * `aligns` は行ごとのそろえ方（`center`、`left`、`right`）
 */
export function createCanvas(text, fontName, limit, windowLines = null, dim = 0, aligns = null) {
  const lines = text.split("\n");
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, limit ?? 0, ...lines.map((line) => lineWidth(glyphs[fontName], line)));
  if (limit != null) {
    canvas.dataset.limit = limit;
  }
  if (windowLines != null) {
    canvas.dataset.windowLines = windowLines;
  }
  canvas.height = Math.max(lines.length, windowLines ?? 0) * lineHeight;
  canvas.style.width = "calc(var(--dot) * " + canvas.width + ")";
  canvas.style.height = "calc(var(--dot) * " + canvas.height + ")";
  canvas.dataset.font = fontName;
  canvas.dataset.text = text;
  canvas.dataset.dim = dim;
  if (aligns != null) {
    canvas.dataset.aligns = JSON.stringify(aligns);
  }
  observer.observe(canvas);
  return canvas;
}
