import { assertEquals } from "@std/assert";
import { Flow } from "./flow.ts";

Deno.test("分岐した先ごとに、同じウィンドウの直前の文を引き継ぐ", () => {
  const previous = new Map<number, Set<number>>();
  const flow = new Flow(previous);
  flow.text(0, 901);
  flow.branch(0x20);
  flow.text(0, 902);
  flow.branch(0x30);
  flow.stop();
  flow.arrive(0x20);
  flow.text(0, 903);
  flow.arrive(0x30);
  flow.text(0, 904);
  assertEquals(
    previous,
    new Map([[902, new Set([901])], [903, new Set([901])], [904, new Set([902, 903])]]),
  );
});

Deno.test("ウィンドウを設定し直すと、直前の文を忘れる", () => {
  const previous = new Map<number, Set<number>>();
  const flow = new Flow(previous);
  flow.text(0, 1);
  flow.text(1, 2);
  flow.reset(0);
  flow.text(0, 3);
  flow.text(1, 4);
  assertEquals(previous, new Map([[4, new Set([2])]]));
});
