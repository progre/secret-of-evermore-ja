/**
 * 部屋のスクリプトから呼び出しを辿り、ウィンドウを設定する箇所ごとに、そこへ出る文を集める。
 * あわせて、同じウィンドウへ続けて出す文の組を集める。
 * スクリプトは先頭から順に読み、終わりに来たら覚えておいた分岐先から読み直す。
 */

import { read8, roomCount, roomScripts } from "./address.ts";
import { decode, type Instruction, type WindowSetting } from "./decode/instruction.ts";
import { Flow } from "./flow.ts";

/**
 * ウィンドウを設定する箇所。
 * `preset` は共通スクリプトの型を `a3` で呼ぶ箇所で、`patchAt` は型の番号のバイト。
 * `inline` は設定を直に書く箇所で、`patchAt` は高さのバイト。
 * `shared` は型を別の命令で呼ぶ箇所、`default` は既定のウィンドウ。
 */
export type WindowSite = {
  kind: "preset" | "inline" | "shared" | "default";
  patchAt: number;
  window: WindowSetting;
  messages: Set<number>;
};

export type Survey = {
  sites: WindowSite[];
  /** 1 行のウィンドウに出る知らせ */
  queued: Set<number>;
  /** 文ごとの、同じウィンドウで直前に出しうる文 */
  previous: Map<number, Set<number>>;
  unknownInstructions: number;
};

type State = Map<number, WindowSite>;

/** スクリプトを辿った結果。文を出したかと、設定したウィンドウの番号 */
type Effect = { printed: boolean; opened: Set<number> };

const callPreset = 0xa3;
/** 条件を持たない分岐。次の命令へは流れない */
const jump = 0x04;
const defaultWindow = { opcode: 0x48, slot: 0, x: 2, y: 2, width: 0x1c, height: 0x0a };

/** 型は「ウィンドウの設定 1 つと終端」だけからなる共通スクリプト */
function presetAt(rom: Uint8Array, address: number): WindowSetting | null {
  const first = decode(rom, address);
  return first.window != null && first.next != null && read8(rom, first.next) === 0
    ? first.window
    : null;
}

export function survey(rom: Uint8Array): Survey {
  const sites = new Map<number, WindowSite>();
  const queued = new Set<number>();
  const effects = new Map<string, { state: State; effect: Effect }>();
  const previous = new Map<number, Set<number>>();
  const visiting = new Set<string>();
  let unknownInstructions = 0;

  const siteOf = (site: Omit<WindowSite, "messages">) => {
    const known = sites.get(site.patchAt) ?? { ...site, messages: new Set<number>() };
    sites.set(site.patchAt, known);
    return known;
  };

  const callSite = (at: number, address: number): WindowSite | null => {
    const window = presetAt(rom, address);
    if (window == null) {
      return null;
    }
    const isPresetCall = read8(rom, at) === callPreset;
    return siteOf({
      kind: isPresetCall ? "preset" : "shared",
      patchAt: isPresetCall ? at + 1 : address + 5,
      window,
    });
  };

  /** ウィンドウを設定すると書き位置が初期化されるため、そのウィンドウの直前の文を忘れる */
  const open = (effect: Effect, flow: Flow, slot: number) => {
    effect.opened.add(slot);
    flow.reset(slot);
  };

  const apply = (
    at: number,
    instruction: Instruction,
    state: State,
    flow: Flow,
    effect: Effect,
    depth: number,
  ) => {
    const { window, text } = instruction;
    if (window != null) {
      state.set(window.slot, siteOf({ kind: "inline", patchAt: at + 5, window }));
      open(effect, flow, window.slot);
    }
    if (instruction.defaultWindow) {
      state.set(0, siteOf({ kind: "default", patchAt: at, window: defaultWindow }));
      open(effect, flow, 0);
    }
    if (text?.queued) {
      queued.add(text.message);
    } else if (text != null) {
      state.get(text.slot)?.messages.add(text.message);
      flow.text(text.slot, text.message);
      effect.printed = true;
    }
    for (const call of instruction.calls) {
      const site = callSite(at, call.address);
      if (site != null) {
        state.set(site.window.slot, site);
        open(effect, flow, site.window.slot);
        continue;
      }
      const called = walk(call.address, state, depth + 1);
      called.opened.forEach((slot) => open(effect, flow, slot));
      if (called.printed) {
        // 呼び出したスクリプトで出た文は呼び出し側の流れに載らないため、直前の文が分からなくなる
        flow.stop();
        effect.printed = true;
      }
    }
  };

  const walkBody = (start: number, state: State, depth: number): Effect => {
    const targets: number[] = [];
    const flow = new Flow(previous);
    const effect: Effect = { printed: false, opened: new Set() };
    let at: number | null = start;
    for (let count = 0; count < 20000 && at != null; count++) {
      flow.arrive(at);
      const instruction = decode(rom, at);
      if (!instruction.known) {
        unknownInstructions++;
      }
      targets.push(...instruction.branches);
      instruction.branches.forEach((target) => flow.branch(target));
      apply(at, instruction, state, flow, effect, depth);
      if (instruction.next == null || read8(rom, at) === jump) {
        flow.stop();
      }
      const current: number = at;
      at = instruction.next ?? targets.filter((t) => t > current).sort((a, b) => a - b).at(0) ??
        null;
    }
    return effect;
  };

  /**
   * 呼び出したスクリプトの中でウィンドウを開くことがある。そのため、ウィンドウの状態を呼び出し側へ持ち帰る。
   * 辿れなかったスクリプトは、文を出したものとして扱う
   */
  const walk = (start: number, state: State, depth: number): Effect => {
    const unknown = { printed: true, opened: new Set<number>() };
    if (depth > 6) {
      return unknown;
    }
    const key = start + ":" + Array.from(state, ([slot, site]) => slot + "@" + site.patchAt);
    const cached = effects.get(key);
    if (cached != null) {
      state.clear();
      cached.state.forEach((site, slot) => state.set(slot, site));
      return cached.effect;
    }
    if (visiting.has(key)) {
      return unknown;
    }
    visiting.add(key);
    const effect = walkBody(start, state, depth);
    effects.set(key, { state: new Map(state), effect });
    return effect;
  };

  for (let room = 0; room < roomCount; room++) {
    roomScripts(rom, room).forEach((script) => walk(script, new Map(), 0));
  }
  return { sites: Array.from(sites.values()), queued, previous, unknownInstructions };
}
