/** タブごとの一覧の管理。行の差し替えとタブの切り替えを扱う */

import { createCanvas, setCellWidth, wrapForCell } from "./canvas.js";

const scroller = document.querySelector("#scroller");
const tabs = Array.from(document.querySelectorAll("#tabs button[data-view]"));

function createView(tab) {
  return {
    tab,
    list: document.querySelector("#" + tab.dataset.view),
    /** セリフの番号をキーとする、表示中の内容と要素の表 */
    rows: new Map(),
    /** 表示順に並べたセリフの番号 */
    order: [],
    scrollTop: 0,
  };
}

/** キーはタブの名前で、サーバーから届く状態のキーと揃える */
export const views = new Map(tabs.map((tab) => [tab.dataset.view, createView(tab)]));
let activeView = views.get("dialog");

export function getActiveView() {
  return activeView;
}

export function showView(view) {
  if (view === activeView) {
    return;
  }
  activeView.scrollTop = scroller.scrollTop;
  activeView.list.hidden = true;
  activeView.tab.classList.remove("active");
  activeView = view;
  view.list.hidden = false;
  view.tab.classList.add("active");
  scroller.scrollTop = view.scrollTop;
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => showView(views.get(tab.dataset.view)));
});

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

/**
 * `windowLines` があれば、ページごとに枠を描く。枠の幅と高さはゲームのウィンドウに合わせる。
 * 前の文から続く部分は、改ページを含まないため最初のページに収まる
 */
function createCanvases(text, fontName, entry) {
  const { limit, windowLines } = entry;
  const dim = entry.dim[fontName];
  // セルの幅で折り返し直す文は行が変わるため、そろえ方を当てない
  const aligns = limit == null ? null : entry.aligns[fontName];
  const wrapped = wrapForCell(text, fontName, limit);
  if (windowLines == null) {
    return [createCanvas(wrapped, fontName, limit, null, dim, aligns)];
  }
  return splitPages(wrapped, aligns).map((page, pageNumber) => {
    const canvas = createCanvas(
      page.lines.join("\n"),
      fontName,
      limit,
      windowLines,
      pageNumber === 0 ? dim : 0,
      page.aligns,
    );
    canvas.classList.add("page");
    return canvas;
  });
}

/** 改ページの空行で、行とそろえ方をページごとに分ける */
function splitPages(text, aligns) {
  const pages = [{ lines: [], aligns: [] }];
  text.split("\n").forEach((line, at) => {
    if (line === "") {
      pages.push({ lines: [], aligns: [] });
      return;
    }
    pages.at(-1).lines.push(line);
    pages.at(-1).aligns.push(aligns?.[at] ?? "left");
  });
  const filled = pages.filter((page) => page.lines.length > 0);
  return filled.length > 0 ? filled : [{ lines: [""], aligns: ["left"] }];
}

/** 描画の下に、TOML に書かれたままの文を出す。canvas の字はブラウザーのページ内検索で探せないため */
function createTextCell(text, fontName, entry, raw) {
  const cell = createElement("div", "", "");
  cell.append(...createCanvases(text, fontName, entry), createElement("pre", "raw", raw));
  return cell;
}

function warningsOf(entry) {
  return [
    entry.overflow ? ["ウィンドウに収まらない"] : [],
    entry.splitName ? ["名前の途中で改行"] : [],
    entry.punctuationHead ? ["行頭に記号"] : [],
  ].flat();
}

function createRow(entry) {
  const warnings = warningsOf(entry);
  const article = createElement("article", warnings.length > 0 ? "warning" : "", "");
  const continues = entry.continues == null ? [] : ["#" + entry.continues + " の続き"];
  const number = ["#" + entry.index, ...continues, ...warnings].join(" ");
  article.append(
    createElement("div", "number", number),
    createElement("div", "speaker", entry.speaker ?? ""),
    createTextCell(entry.source, "source", entry, entry.raw.source),
    createTextCell(entry.target, "target", entry, entry.raw.target),
  );
  return article;
}

function replaceRow(view, entry, json) {
  const element = createRow(entry);
  view.rows.get(entry.index)?.element.replaceWith(element);
  view.rows.set(entry.index, { json, element });
  return element;
}

/**
 * 原文または訳文の 1 列の幅（CSS ピクセル）。
 * 一覧の幅から、page.html の article の左右の padding（16px ずつ）と列の間（16px）を引き、2 で割る
 */
function columnWidth() {
  return (activeView.list.clientWidth - 16 * 3) / 2;
}

/** 列の幅が変わったら、どのウィンドウに出るか分からない文の行だけを作り直す */
export function rewrapForCells() {
  if (!setCellWidth(columnWidth())) {
    return;
  }
  views.forEach((view) => {
    view.rows.forEach(({ json }) => {
      const entry = JSON.parse(json);
      if (entry.limit == null) {
        replaceRow(view, entry, json);
      }
    });
  });
}

/** 変更された行の要素を返す。初回の読み込みは変更として扱わない */
export function applyEntries(view, entries) {
  const isFirst = view.rows.size === 0;
  const changed = entries.flatMap((entry) => {
    const json = JSON.stringify(entry);
    return view.rows.get(entry.index)?.json === json ? [] : [replaceRow(view, entry, json)];
  });
  view.order = entries.map((entry) => entry.index);
  const shown = new Set(view.order);
  Array.from(view.rows.keys()).filter((index) => !shown.has(index)).forEach((index) => {
    view.rows.delete(index);
  });
  view.list.replaceChildren(...entries.map((entry) => view.rows.get(entry.index).element));
  if (isFirst || changed.length === 0) {
    return [];
  }
  view.list.querySelectorAll(".changed").forEach((element) => {
    element.classList.remove("changed");
  });
  changed.forEach((element) => element.classList.add("changed"));
  return changed;
}
