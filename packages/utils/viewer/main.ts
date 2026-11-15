/**
 * 翻訳の確認用ビューアー。原文と訳文を並べて表示し、ファイルの更新を即時に反映する。
 * 使い方: deno task viewer
 * deno task check で、次のファイルを先に作っておく。
 * - build/dialog-en.toml、build/fixed-en.toml: 原文
 * - build/line-limits.json: 会話ごとの 1 行の幅の上限
 * - build/window-lines.json: 会話ごとのウィンドウの行数
 * - build/window-previous.json: 会話ごとの、同じウィンドウで直前に出しうる会話
 */

import { parseTranslation, translatedTexts } from "@features/dialog";
import type { Glyph } from "@features/font";
import { loadFonts, pickGlyphs } from "./fonts.ts";
import { buildEntries, type Layout } from "./model.ts";

const fontPath = "vendor/fusion-pixel-font/fusion-pixel-10px-proportional-ja.bdf";
const romPath = "Secret of Evermore (USA).sfc";
const limitsPath = "build/line-limits.json";
const windowLinesPath = "build/window-lines.json";
const previousPath = "build/window-previous.json";
const dialogPaths = { source: "build/dialog-en.toml", target: "data/dialog-ja.toml" };
const fixedPaths = { source: "build/fixed-en.toml", target: "data/fixed-ja.toml" };
const watchedPaths = [
  ...[dialogPaths, fixedPaths].flatMap(({ source, target }) => [source, target]),
  limitsPath,
  windowLinesPath,
  previousPath,
];
const watchedDirectories = ["build", "data"];
const scriptNames = ["canvas.js", "client.js", "views.js", "wrap.js"];
const port = 8765;
/** 1 回の保存で届く複数の通知をまとめる */
const debounceMilliseconds = 50;

type Entries = ReturnType<typeof buildEntries>;

type State = {
  views: { dialog: Entries; fixed: Entries };
  /** 原文は原版のフォントで、訳文は日本語のフォントで描く */
  glyphs: Record<string, Record<string, Glyph>>;
  error: string | null;
};

const encoder = new TextEncoder();
const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();
const fonts = loadFonts(await Deno.readTextFile(fontPath), await Deno.readFile(romPath));
const advances = { source: fonts.source.advanceOf, target: fonts.target.advanceOf };
let state: State = {
  views: { dialog: [], fixed: [] },
  glyphs: { source: {}, target: {} },
  error: null,
};

/** 会話の番号をキーとする表 */
async function readByMessage<T>(path: string): Promise<Map<number, T>> {
  const values: Record<string, T> = JSON.parse(await Deno.readTextFile(path));
  return new Map(Object.entries(values).map(([message, value]) => [Number(message), value]));
}

/** TOML の解析に時間がかかるため、内容が変わったファイルだけを解析する */
const parsedScripts = new Map<string, { text: string; script: Map<number, string | false> }>();

async function readScript(path: string): Promise<Map<number, string | false>> {
  const text = await Deno.readTextFile(path);
  const parsed = parsedScripts.get(path);
  if (parsed?.text === text) {
    return parsed.script;
  }
  const script = parseTranslation(text);
  parsedScripts.set(path, { text, script });
  return script;
}

async function readEntries(
  paths: { source: string; target: string },
  layout: Layout | null,
): Promise<Entries> {
  const [sources, targets] = await Promise.all([
    readScript(paths.source),
    readScript(paths.target),
  ]);
  return buildEntries(translatedTexts(sources), targets, layout);
}

/** 書きかけで読めないあいだは、前回の内容を残してエラーだけを出す */
async function reload(): Promise<void> {
  try {
    const layout = {
      limits: await readByMessage<number>(limitsPath),
      windowLines: await readByMessage<number>(windowLinesPath),
      previous: await readByMessage<number[]>(previousPath),
      advances,
    };
    const [dialog, fixed] = await Promise.all([
      readEntries(dialogPaths, layout),
      readEntries(fixedPaths, null),
    ]);
    const entries = [...dialog, ...fixed];
    const glyphs = {
      source: pickGlyphs(fonts.source, entries.map((entry) => entry.source)),
      target: pickGlyphs(fonts.target, entries.map((entry) => entry.target)),
    };
    state = { views: { dialog, fixed }, glyphs, error: null };
  } catch (error) {
    state = { ...state, error: String(error) };
  }
}

function frame(): Uint8Array {
  return encoder.encode("data: " + JSON.stringify(state) + "\n\n");
}

function eventStream(): Response {
  let controller: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(created) {
      controller = created;
      clients.add(created);
      created.enqueue(frame());
    },
    cancel() {
      clients.delete(controller);
    },
  });
  return new Response(body, { headers: { "content-type": "text/event-stream" } });
}

async function staticFile(name: string): Promise<Response> {
  const body = await Deno.readFile(new URL("./web/" + name, import.meta.url));
  const contentType = name.endsWith(".html") ? "text/html" : "text/javascript";
  return new Response(body, { headers: { "content-type": contentType + "; charset=utf-8" } });
}

function route(request: Request): Promise<Response> | Response {
  const { pathname } = new URL(request.url);
  if (pathname === "/") {
    return staticFile("page.html");
  }
  if (scriptNames.some((name) => pathname === "/" + name)) {
    return staticFile(pathname.slice(1));
  }
  if (pathname === "/events") {
    return eventStream();
  }
  return new Response("Not Found", { status: 404 });
}

async function watchScripts(): Promise<void> {
  const names = watchedPaths.map((path) => "/" + path.split("/").at(-1));
  let timer: ReturnType<typeof setTimeout> | undefined;
  // エディターが置き換えで保存しても追えるよう、ファイルではなくフォルダーを監視する
  for await (const event of Deno.watchFs(watchedDirectories, { recursive: false })) {
    if (!event.paths.some((path) => names.some((name) => path.endsWith(name)))) {
      continue;
    }
    clearTimeout(timer);
    timer = setTimeout(async () => {
      await reload();
      const message = frame();
      clients.forEach((client) => client.enqueue(message));
    }, debounceMilliseconds);
  }
}

async function main(): Promise<void> {
  await reload();
  Deno.serve({ hostname: "127.0.0.1", port }, route);
  await watchScripts();
}

if (import.meta.main) {
  await main();
}
