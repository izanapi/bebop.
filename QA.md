# 検証記録 — 2026-10-05

## 実施済み

- TypeScript型検査、静的ビルド、7件の自動テストに合格。
- 12キー × 6種類の和音 × 4テンポ（288条件）で音域、休符を含む拍数、音の重複、演奏イベントの整合性を確認。シードによる再現、移調表示と実音の分離も検証。
- 6進行 × 4テンポ × 30シード（720フレーズ）の音程、密度、休符などを集計。評価用13ソロとの比較は研究レポートに記載。学習・調整用43ソロとは録音単位で分離。
- 同一音列を80・140・200・280 BPMで、量子化／固定2対1／研究モデルの3方式に変換した12個の伴奏付きWAVを生成。標準音量の最大ピークは約0.345でクリッピングなし。
- Codex内蔵ブラウザで375×667、390×844、430×932の縦画面を確認。主要操作と2小節の譜面が画面内に収まる。
- 8小節のページ切り替え、1小節4コード、連続生成、手入力の表示、E♭移調譜、ヘ音記号とC2〜C4の低音域を確認。
- カウントイン、再生、停止、ループを操作。2周目以降にループを解除した場合は現在の周回の終わりまで再生するよう修正し、回帰テストで確認。
- WebMCPの生成と読み取りを実際のページで実行。無効入力では元フレーズを保持。ブラウザのコンソールにアプリ由来のエラーなし。

## 未確認・限界

- iPhone実機のSafari、音声割り込み、バックグラウンドからの復帰、Bluetooth等の出力経路は未検証。割り込み時には停止し、再生ボタンから再開する実装。
- 人間の演奏家によるブラインド試聴や練習での有用性評価は未実施。統計と生成規則の検査を、自然さやタイム感の知覚的な改善の証明とは扱わない。
- 低速域や少数のテンポ群は推定を含む。奏者ごとの分布は分析データに残すが、初版に奏者スタイル選択はない。
- WJazzDはソロの資料であり、伴奏との裏拍の一致をこのDBから直接測定したわけではない。伴奏タイミングは研究に基づく設計。
- 音色はローカル合成。録音の奏法や特定奏者の音色を再現するものではない。
- 異名同音の表記は簡略化している。複雑な変化和音では、同じ実音でも読譜上さらに適切な綴りがあり得る。

再実行方法はREADME、数値・出典・生成規則との対応はpublic/research/index.htmlを参照。

## 更新検証：全体譜・キー・お気に入り

- 10件の自動テストに合格。12キーの移調で音程関係・リズム・分数コードのベースが保たれることを確認。
- 保存した音符の完全一致、不正データの拒否、利用者間の分離、名前変更、論理削除と復元、認証・同一オリジンの検証を実施。
- ローカルブラウザの375×667、390×844、430×932で8小節の同時表示（縦スクロールなし）、B♭への移調、保存、名前変更、ページ再読み込み後の復元、削除と取り消しを確認。
- 初版の2小節ページ送りを廃止。再生中も全体を固定表示し、現在の音符と小節を強調する。
- iPhone実機は引き続き未検証。375pxの譜面は全体の流れを追うための縮小表示で、紙の譜面と同等の読譜サイズではない。

2026-10-05 / generator 2.4:
- Paired final corpus audit: 720 examples/version, fixed fresh seeds 2001–2030, 6 presets, 80/140/200/280 BPM; note counts, range, beat totals, approach resolutions and audio overlap assertions passed.
- 20 tests, TypeScript check and production build passed.
- Local browser: startup seed 20261005, repeated Generate, 8-bar rhythm changes all rendered without the prior IncompleteVoice failure.
- Human/expert listening quality and iPhone hardware interruptions are not verified. A/B preview is for review, not evidence of expert approval.

2026-10-05 / reharmony 1.0:
- 23 tests passed, including unchanged standard-mode output, 12-key substitutions, beat totals, narrow ranges, deterministic seeds, paired trading harmony, favorite roundtrip and transposition of both progressions.
- Typecheck and production build passed.
- Local browser: adventure selection shows G7 → Db7 while input remains original; key change transposes both, favorite save succeeds, playback starts.
- Chord choice is a conservative practice rule, not a corpus-estimated preference; musician listening assessment and iPhone hardware are not claimed.

Adventure 2.0: 24 tests passed. Reharmonization uses a deterministic variable count, disjoint changed-source/destination pairs, max 3 changes per block. Pitch elaboration preserves all onset/duration/rest/triplet events; bounded connected approaches resolve by semitone. Standard path untouched. Existing favorites remain literal saved phrases.
