import { assertEquals } from "@std/assert";
import { alignMarks, stripAlignMarks, wrapAligned } from "./align.ts";

const center = alignMarks.get("center");
const left = alignMarks.get("left");
const right = alignMarks.get("right");

Deno.test("印を抜いて折り返し、行ごとのそろえ方を返す", () => {
  const wrapAt3 = (text: string) => text.replace(/([^\n]{3})(?=[^\n])/g, "$1\n");
  assertEquals(
    wrapAligned("あ" + center + "いうえ\nお" + right + "\n" + left + "か", wrapAt3),
    { text: "あいう\nえ\nお\nか", aligns: ["center", "center", "right", "left"] },
  );
});

Deno.test("印を抜く", () => {
  assertEquals(stripAlignMarks(center + "あ" + right), "あ");
});
