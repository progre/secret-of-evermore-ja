# Secret of Evermore 非公式日本語化パッチ

SNES「Secret of Evermore」(北米版) の非公式日本語化パッチです。

## 使い方

1. [Releases] から `soe-ja.bps` を入手します。
2. ROM の SHA-256 が次の値と同じことを確かめます。

   ```text
   17c864a76d498feb6479eee8e7d6807b951c66225033228622bb66754baab1db
   ```

   ツールによっては、違う ROM に適用してもエラーになりません。

3. BPS に対応したツールで、ROM に `soe-ja.bps` を適用します。

   例: [Rom Patcher JS](https://www.marcrobledo.com/RomPatcher.js/)

[Releases]: https://github.com/progre/secret-of-evermore-jp/releases

## ビルド

### 必要なもの

- [Deno](https://deno.com/)（2.9.7 で動作を確認しています）
- [Fusion Pixel Font](https://github.com/TakWolf/fusion-pixel-font)
  - 配置先: `vendor/fusion-pixel-font/fusion-pixel-10px-proportional-ja.bdf`
- 上記の SHA-256 の ROM
  - 配置先: `/Secret of Evermore (USA).sfc`

### 手順

```sh
deno task check
deno task build
```

`build/soe-ja.sfc` が出力されます。

## ビューアー

原文と訳文を、ゲームのウィンドウと同じ大きさの枠で並べて表示します。
訳文のファイルの更新をリアルタイムに反映します。

```sh
deno task check
deno task viewer
```

起動したら、ブラウザーで <http://127.0.0.1:8765> を開いてください。

- 「会話」と「固定テキスト」のタブで、表示する訳文を切り替えられます。
- 「▲」「▼」か `p`、`n` のキーで、前後の警告へ移れます。
  - 警告には、ウィンドウからのはみ出し、名前の途中の改行、行頭の句読点などがあります。
