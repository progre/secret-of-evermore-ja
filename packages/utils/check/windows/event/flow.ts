/**
 * 同じウィンドウへ続けて出す文の組を、命令の流れに沿って集める。
 * 文が改ページで終わらないとき、ゲームは次の文を、前の文を書き終えた位置から続けて書く。
 * 書く位置を戻すのはウィンドウの初期化（`cc:acb3`）と `8c:af2b` だけで、文の表示（`cc:9e03`）は戻さない。
 */

/** ウィンドウの番号ごとの、直前に出した文の候補 */
type Last = Map<number, Set<number>>;

function merge(into: Last, from: Last): void {
  from.forEach((messages, slot) => {
    into.set(slot, new Set([...(into.get(slot) ?? []), ...messages]));
  });
}

export class Flow {
  #last: Last = new Map();
  readonly #pending = new Map<number, Last>();
  /** 文ごとの、同じウィンドウで直前に出しうる文 */
  readonly #previous: Map<number, Set<number>>;

  constructor(previous: Map<number, Set<number>>) {
    this.#previous = previous;
  }

  /** 分岐先へ流れが届いたら、分岐した時点の候補を合わせる */
  arrive(at: number): void {
    const pending = this.#pending.get(at);
    if (pending != null) {
      merge(this.#last, pending);
      this.#pending.delete(at);
    }
  }

  branch(target: number): void {
    const pending = this.#pending.get(target) ?? new Map();
    merge(pending, this.#last);
    this.#pending.set(target, pending);
  }

  /** 流れが次の命令へ続かないか、続いても直前の文が分からなくなった */
  stop(): void {
    this.#last = new Map();
  }

  reset(slot: number): void {
    this.#last.delete(slot);
  }

  text(slot: number, message: number): void {
    this.#last.get(slot)?.forEach((before) => {
      const known = this.#previous.get(message) ?? new Set();
      this.#previous.set(message, known.add(before));
    });
    this.#last.set(slot, new Set([message]));
  }
}
