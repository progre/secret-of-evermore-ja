import { encodeScript, parseTranslation, readAll } from "@features/dialog";
import {
  originalCodec,
  relocatedOriginalCodec,
  shiftJisCodec,
  stripSpeakers,
} from "@features/encoding";
import { checkFits, dialogAddress } from "./layout.ts";

/**
 * 日本語の台本を ROM へ書き込む形へ変換し、本文 `text.bin` とポインタ `ptr.bin` を書き出す。
 * 話者の印は書き込まない。書き出した後に読み直し、印を除いた台本と一致することを確かめる。
 * 値が `false` の件には、原版の ROM の文を日本語版の制御コードに移し替えて書き込む。
 */
export async function insertDialog(basePath: string): Promise<void> {
  const scriptPath = "data/dialog-ja.toml";
  const outDir = "build";

  const translation = parseTranslation(await Deno.readTextFile(scriptPath));
  const originals = readAll(await Deno.readFile(basePath));
  const script = new Map(
    Array.from(translation, ([index, text]) => [
      index,
      text === false ? keptText(originals[index], index) : stripSpeakers(text),
    ]),
  );
  const address = await dialogAddress(outDir);
  const result = encodeScript(script, address, shiftJisCodec);
  await checkFits(outDir, result.packed.text.length);

  await Deno.writeFile(outDir + "/text.bin", result.packed.text);
  await Deno.writeFile(outDir + "/ptr.bin", result.packed.pointers);

  if (result.missing.size > 0) {
    console.warn("Unsupported characters in dialog: " + Array.from(result.missing).join(""));
  }
  if (result.mismatched.length > 0) {
    throw new Error(
      "Dialog does not round-trip: " + result.mismatched.slice(0, 10).join(", "),
    );
  }
}

/**
 * 原版のバイト列を、日本語版で同じように表示される文字列にする。
 * 日本語版は制御コードを別の値へ移しているため、原版のバイト列をそのままは使えない。
 * 固定テキストの未訳の文字列と同じく、制御コードだけを移し替え、表示文字は原版のバイトのまま残す。
 * 移し替えたバイト列を日本語の符号で読み、書き戻して同じバイト列にならなければ止める
 */
function keptText(original: Uint8Array, index: number): string {
  const relocated = relocatedOriginalCodec.encode(originalCodec.decode(original)).bytes;
  const text = shiftJisCodec.decode(relocated);
  const bytes = shiftJisCodec.encode(text).bytes;
  if (bytes.length !== relocated.length || bytes.some((byte, at) => byte !== relocated[at])) {
    throw new Error("Dialog #" + index + " cannot keep the original text");
  }
  return text;
}
