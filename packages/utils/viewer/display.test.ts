import { assertEquals } from "@std/assert";
import { hasPunctuationHead, hasSplitName } from "./display.ts";

Deno.test("主人公と犬の名前の字の間に改行が入っているかを見る", () => {
  assertEquals(
    ["主人公□□□□□□", "あ主人公□□\n□□□□", "あ\n犬□□□□□□□□"].map(hasSplitName),
    [false, true, false],
  );
});

Deno.test("記号が行の頭に来るかを見る。ページの 1 行目の … は許す", () => {
  assertEquals(
    ["あいう。", "あいうえ\n。", "あ\n！", "あ\n\n」", "…あ\n\n…い", "あ\n…い"]
      .map(hasPunctuationHead),
    [false, true, true, true, false, true],
  );
});
