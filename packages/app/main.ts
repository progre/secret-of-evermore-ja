/**
 * 翻訳パッチを当てた ROM を組み立てる。後の工程は前の工程の生成物を読むため、この順に実行する。
 * 原版の ROM は、リポジトリーの直下に No-Intro の名前で置く。検査は `packages/utils/check/main.ts` にある。
 */

import { insertDialog } from "./dialog.ts";
import { buildFont } from "./font.ts";
import { buildNameTable } from "./name_entry.ts";
import { buildRom } from "./rom.ts";

async function main(): Promise<void> {
  const basePath = "Secret of Evermore (USA).sfc";
  await Deno.mkdir("build", { recursive: true });
  await buildFont();
  await buildNameTable();
  await insertDialog(basePath);
  await buildRom(basePath);
}

if (import.meta.main) {
  await main();
}
