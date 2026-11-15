import { spaceWidth } from "@features/font";
import { checkWindows } from "./capacity.ts";
import { readScriptPieces } from "../shared/script.ts";
import { readWidths } from "../shared/width.ts";

/**
 * 会話がウィンドウの行数と幅に収まるかを調べる。
 * 会話ごとのウィンドウは、原版の ROM のスクリプトを解析して調べる。
 * パッチはウィンドウのスクリプトを書き換えないため、組み立てた ROM と結果は変わらない。
 * 文ごとの 1 行の幅の上限、ウィンドウの行数、同じウィンドウで直前に出しうる文は、
 * ビューアーが表示を再現するために書き出す。
 */
export async function reviewWindows(basePath: string): Promise<void> {
  const dialogPath = "data/dialog-ja.toml";
  const limitsPath = "build/line-limits.json";
  const windowLinesPath = "build/window-lines.json";
  const previousPath = "build/window-previous.json";

  const rom = await Deno.readFile(basePath);
  // 会話のウィンドウでは、スペースはフォントの幅ではなくウィンドウの送り幅で進む
  const widthOf = (await readWidths(rom)).set(" ", spaceWidth);
  const result = checkWindows(rom, await readScriptPieces(dialogPath), widthOf);
  await Deno.writeTextFile(limitsPath, JSON.stringify(Object.fromEntries(result.lineLimits)));
  await Deno.writeTextFile(
    windowLinesPath,
    JSON.stringify(Object.fromEntries(result.windowLines)),
  );
  await Deno.writeTextFile(
    previousPath,
    JSON.stringify(
      Object.fromEntries(
        Array.from(
          result.previous,
          ([message, before]) => [message, Array.from(before).sort((a, b) => a - b)],
        ),
      ),
    ),
  );

  console.log(
    "ウィンドウに収まらない文 " + result.overflows.length + " 件" +
      "（スクリプトの読めない命令 " + result.unknownInstructions + " 個）",
  );
  for (const { message, lines, capacity, site } of result.overflows) {
    console.log(
      "第 " + message + " 件: " + lines + " 行（" + capacity + " 行のウィンドウ、" +
        site.patchAt.toString(16) + "）",
    );
  }
  if (result.tallNotices.length > 0) {
    console.log("1 行のウィンドウに 2 行以上の知らせ: 第 " + result.tallNotices.join("、") + " 件");
  }
  console.log("1 行の幅を超える行 " + result.wideLines.length + " 行");
  for (const { message, line, width, limit } of result.wideLines) {
    console.log("第 " + message + " 件の " + line + " 行目: " + width + "（上限 " + limit + "）");
  }
}
