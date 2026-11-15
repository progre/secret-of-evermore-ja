import { assertEquals } from "@std/assert";
import { buildEntries, usedChars } from "./model.ts";
import { wrapText } from "./web/wrap.js";

Deno.test("話者を取り出し、制御コードを消し、差し込みを仮の文字にする", () => {
  const entries = buildEntries(
    new Map([[1, "{code96}{wait 61}Hi, {hero} and {dog}.{item}"]]),
    new Map([[1, "{@主人公}{code96}{wait 61}{hero}と{dog}。{qty}"]]),
  );
  assertEquals(entries, [
    {
      index: 1,
      speaker: "主人公",
      source: "Hi, mmmmmmmmm. and mmmmmmmmm..○",
      target: "主人公□□□□□□と犬□□□□□□□□。○",
      limit: null,
      windowLines: null,
      overflow: false,
      splitName: false,
      punctuationHead: false,
      continues: null,
      dim: { source: 0, target: 0 },
      aligns: { source: ["left"], target: ["left"] },
      raw: {
        source: "{code96}{wait 61}Hi, {hero} and {dog}.{item}",
        target: "{@主人公}{code96}{wait 61}{hero}と{dog}。{qty}",
      },
    },
  ]);
});

Deno.test("改ページを空行にし、前後の空行を除く", () => {
  const entries = buildEntries(
    new Map([[1, "{clear}A{page}\nB{page}"]]),
    new Map([[1, "{clear}あ{page}い{page}"]]),
  );
  assertEquals(entries[0].source, "A\n\nB");
  assertEquals(entries[0].target, "あ\n\nい");
});

Deno.test("片方にしかない件も番号順に並べる", () => {
  const entries = buildEntries(new Map([[2, "B"]]), new Map([[1, "あ"]]));
  assertEquals(entries, [
    {
      index: 1,
      speaker: null,
      source: "",
      target: "あ",
      limit: null,
      windowLines: null,
      overflow: false,
      splitName: false,
      punctuationHead: false,
      continues: null,
      dim: { source: 0, target: 0 },
      aligns: { source: ["left"], target: ["left"] },
      raw: { source: "", target: "あ" },
    },
    {
      index: 2,
      speaker: null,
      source: "B",
      target: "",
      limit: null,
      windowLines: null,
      overflow: false,
      splitName: false,
      punctuationHead: false,
      continues: null,
      dim: { source: 0, target: 0 },
      aligns: { source: ["left"], target: ["left"] },
      raw: { source: "B", target: "" },
    },
  ]);
});

Deno.test("原文のまま変えない件は、訳文の欄にも原文を出す", () => {
  const entries = buildEntries(new Map([[1, "THE END"]]), new Map([[1, false]]));
  assertEquals(entries[0].target, "THE END");
  assertEquals(entries[0].raw.target, "false");
});

Deno.test("上限のある文だけを、原文と訳文とも上限を超える字の前で折り返す", () => {
  const layout = {
    limits: new Map([[1, 30]]),
    windowLines: new Map(),
    previous: new Map(),
    advances: { source: () => 10, target: () => 10 },
  };
  const entries = buildEntries(
    new Map([[1, "ab cd"]]),
    new Map([[1, "あいうえ\nお"], [2, "あいうえ"]]),
    layout,
  );
  assertEquals(entries.map((entry) => entry.source), ["ab \ncd", ""]);
  assertEquals(entries.map((entry) => entry.target), ["あいう\nえ\nお", "あいうえ"]);
  assertEquals(entries.map((entry) => entry.limit), [30, null]);
});

Deno.test("折り返した訳文のページの行数が、ウィンドウの行数を超えるかを見る", () => {
  const layout = {
    limits: new Map([[1, 30], [2, 30]]),
    windowLines: new Map([[1, 2], [2, 2]]),
    previous: new Map(),
    advances: { source: () => 10, target: () => 10 },
  };
  const entries = buildEntries(
    new Map(),
    new Map([[1, "あいう{page}え"], [2, "あいうえ\nお"]]),
    layout,
  );
  assertEquals(entries.map((entry) => entry.windowLines), [2, 2]);
  assertEquals(entries.map((entry) => entry.overflow), [false, true]);
});

Deno.test("改ページせずに終えた直前の文があれば、その最後のページに続けて書く", () => {
  const layout = {
    limits: new Map([[2, 20], [3, 20], [5, 20]]),
    windowLines: new Map(),
    previous: new Map([[2, [1]], [3, [2]], [5, [4]]]),
    advances: { source: () => 10, target: () => 10 },
  };
  const entries = buildEntries(
    new Map([[1, "A{page}B "], [2, "C"]]),
    new Map([[1, "あ{page}い"], [2, "うえ"], [3, "お"], [4, "か{page}"], [5, "き"]]),
    layout,
  );
  const byIndex = new Map(entries.map((entry) => [entry.index, entry]));
  assertEquals(byIndex.get(2)?.target, "いう\nえ");
  assertEquals(byIndex.get(2)?.source, "B \nC");
  assertEquals(byIndex.get(2)?.dim, { source: 2, target: 1 });
  assertEquals(byIndex.get(2)?.continues, 1);
  assertEquals(byIndex.get(3)?.target, "いう\nえお");
  assertEquals(byIndex.get(5)?.target, "き");
  assertEquals(byIndex.get(5)?.continues, null);
});

Deno.test("選択肢の後は必ず改ページされるため、次の文は続きにならない", () => {
  const entries = buildEntries(
    new Map(),
    new Map([[1, "あ\n{choice}はい。\n{choice}いいえ。"], [2, "い"]]),
    {
      limits: new Map(),
      windowLines: new Map(),
      previous: new Map([[2, [1]]]),
      advances: { source: () => 10, target: () => 10 },
    },
  );
  assertEquals(entries.map((entry) => entry.target), ["あ\nはい。\nいいえ。", "い"]);
  assertEquals(entries.map((entry) => entry.continues), [null, null]);
});

Deno.test("前の文から続けて書く文には、最初の文のウィンドウの行数を使う", () => {
  const entries = buildEntries(
    new Map(),
    new Map([[1, "あ"], [2, "い"], [3, "う"]]),
    {
      limits: new Map(),
      windowLines: new Map([[1, 3], [2, 1], [3, 1]]),
      previous: new Map([[2, [1]], [3, [2]]]),
      advances: { source: () => 10, target: () => 10 },
    },
  );
  assertEquals(entries.map((entry) => entry.windowLines), [3, 3, 3]);
});

Deno.test("英数字は単語ごとに送り、上限より長い単語は送らない", () => {
  const advanceOf = () => 10;
  assertEquals(wrapText("あAB CD", 40, advanceOf), "あAB \nCD");
  assertEquals(wrapText("あABCDE", 40, advanceOf), "あABCDE");
  assertEquals(wrapText("ABC D", 30, advanceOf), "ABC \nD");
});

Deno.test("訳文に使う文字を集める", () => {
  const entries = buildEntries(new Map(), new Map([[1, "あ\nあ"], [2, "い"]]));
  assertEquals(usedChars(entries.map((entry) => entry.target)), ["あ", "い"]);
});
