import { assertEquals } from "@std/assert";
import { shiftJisCodec, shiftJisTable } from "./shift_jis.ts";

Deno.test("ASCII と全角の字と制御コードの書き込みと読み戻し", () => {
  const text = "あ:<{page}{hero}";
  const bytes = shiftJisCodec.encode(text).bytes;
  assertEquals(bytes, Uint8Array.of(0x82, 0xa0, 0x3a, 0x3c, 0x06, 0x01));
  assertEquals(shiftJisCodec.decode(bytes), text);
});

Deno.test("収録していない文字を知らせる", () => {
  const encoded = shiftJisCodec.encode("あ😀");
  assertEquals(encoded.missing, ["😀"]);
  assertEquals(encoded.bytes, Uint8Array.of(0x82, 0xa0));
});

Deno.test("グリフを用意する字は JIS X 0208 の 6879 字で、第二水準も本来の符号になる", () => {
  assertEquals(shiftJisTable.size, 6879);
  assertEquals(shiftJisTable.get("隕"), 0xe8a6);
});
