/** サーバーから届いた状態を画面へ反映し、キー操作でスクロールする */

import { setGlyphs } from "./canvas.js";
import { applyEntries, getActiveView, rewrapForCells, showView, views } from "./views.js";

/** キーごとに移動するセリフの数 */
const keySteps = new Map([
  ["ArrowUp", -1],
  ["ArrowDown", 1],
  ["ArrowLeft", -10],
  ["ArrowRight", 10],
  ["PageUp", -100],
  ["PageDown", 100],
]);

/** 警告のあるセリフへ移るキー */
const warningKeys = new Map([
  ["n", 1],
  ["p", -1],
]);

const scroller = document.querySelector("#scroller");
const errorBar = document.querySelector("#error");
const warningCount = document.querySelector("#warning-count");

/** 画面の一番上に見えているセリフの位置。拡大率によるスクロール位置の端数は無視する */
function topPosition({ order, rows }) {
  const scrollerTop = scroller.getBoundingClientRect().top;
  const top = order.findIndex((index) =>
    rows.get(index).element.getBoundingClientRect().bottom > scrollerTop + 1
  );
  return Math.max(0, top);
}

function scrollToPosition(view, position) {
  view.rows.get(view.order[position]).element.scrollIntoView({ block: "start" });
}

/** 警告のあるセリフが、表示順で何番目にあるか */
function warningPositions(view) {
  return view.order.flatMap((index, position) =>
    view.rows.get(index).element.classList.contains("warning") ? [position] : []
  );
}

function updateWarningCount() {
  const count = warningPositions(getActiveView()).length;
  warningCount.textContent = "警告 " + count + " 件";
}

/** 画面の一番上のセリフから `step` の向きにある警告へ移る。端まで来たら反対の端へ回る */
function jumpToWarning(step) {
  const view = getActiveView();
  const positions = warningPositions(view);
  if (positions.length === 0) {
    return;
  }
  const top = topPosition(view);
  const next = step > 0
    ? positions.find((position) => position > top) ?? positions[0]
    : positions.findLast((position) => position < top) ?? positions.at(-1);
  scrollToPosition(view, next);
}

document.addEventListener("keydown", (event) => {
  const hasModifier = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
  const warningStep = warningKeys.get(event.key);
  if (warningStep != null && !hasModifier) {
    event.preventDefault();
    jumpToWarning(warningStep);
    return;
  }
  const step = keySteps.get(event.key);
  const view = getActiveView();
  if (step == null || hasModifier || view.order.length === 0) {
    return;
  }
  event.preventDefault();
  scrollToPosition(view, Math.min(view.order.length - 1, Math.max(0, topPosition(view) + step)));
});

document.querySelectorAll("#warnings button").forEach((button) => {
  button.addEventListener("click", () => jumpToWarning(Number(button.dataset.step)));
});
document.querySelectorAll("#tabs button[data-view]").forEach((tab) => {
  tab.addEventListener("click", updateWarningCount);
});

/** 表示中のタブに変更があればそれを優先し、なければ変更のあるタブへ切り替える */
function followChange(changes) {
  const change = changes.find(({ view }) => view === getActiveView()) ?? changes[0];
  if (change == null) {
    return;
  }
  showView(change.view);
  change.changed[0].scrollIntoView({ block: "center" });
}

rewrapForCells();
globalThis.addEventListener("resize", rewrapForCells);

new EventSource("/events").onmessage = (message) => {
  const state = JSON.parse(message.data);
  setGlyphs(state.glyphs);
  errorBar.textContent = state.error ?? "";
  const changes = Array.from(views, ([name, view]) => ({
    view,
    changed: applyEntries(view, state.views[name]),
  }));
  followChange(changes.filter(({ changed }) => changed.length > 0));
  updateWarningCount();
};
