# BEBOP — phrase studies

コード進行から2〜8小節のビバップ練習フレーズを生成するWebアプリ。TypeScript / VexFlow 5 / Web Audio。外部AI API、アカウント登録、録音アップロードは不要です。

## 起動

Node.js 24以降、pnpmを使用します。

```sh
pnpm install
pnpm run build
pnpm run dev
```

`http://127.0.0.1:4173` を開いてください。`dist/` はビルド済みです。ローカル開発はSQLite（`.sites-runtime/practice.sqlite`）、配信先はD1にお気に入りを保存します。ローカルのテスト用ユーザーは本番の保存内容とは別です。静的ファイルだけの配信ではお気に入りは使えません。

## 検証

```sh
pnpm run typecheck
pnpm run test
node research/validate.ts
python3 research/report.py
pnpm run build
```

`research/validate.ts` は720フレーズの検証結果と12個のWAV試聴比較を出力します。`public/research/index.html` が研究レポート、`QA.md` が実施したUI検証と未確認事項です。

## 分析を再実行

Python 3標準ライブラリだけで実行できます。元資料をアプリの公開ディレクトリの外に保存してください。

```sh
mkdir -p ../../work/research/raw
curl -fL https://jazzomat.hfm-weimar.de/download/downloads/wjazzd.db -o ../../work/research/raw/wjazzd.db
curl -fL https://jazzomat.hfm-weimar.de/download/downloads/RELEASE2.0_mid_unquant.zip -o ../../work/research/raw/midi.zip
python3 research/analyze.py --raw ../../work/research/raw --out public/research
node research/validate.ts
python3 research/report.py
pnpm run build
```

元資料のSHA-256とライセンスは`analysis.json`に記録しています。分析結果・モデルはODbL 1.0、元DBの個別内容はDbCL 1.0。アプリコードはMIT。原音源や市販の採譜は同梱していません。

譜面描画にVexFlow（MIT）、同梱フォントにBravuraとAcademico（SIL OFL）を使用します。各ライセンスは`public/research/`に収録しています。

## 構造と設計上の区別

- `src/music.ts`: コード解析、シード付き旋律文法、統計の重み付け、演奏タイミング、伴奏。
- `src/score.ts`: SVG五線譜。小節をまたぐ音はタイで分割。極端な音域では8va/8vb・15ma/15mbを小節単位で表示します。
- `src/audio.ts`, `src/sound.ts`: Web Audioの150ms先読み／25ms更新、停止と割り込み、ローカル合成音色。試聴WAVも同じサンプルを使用。
- `src/main.ts`: 1画面UIと2個のWebMCPツール。8小節までを2小節×4段で表示します。
- `research/`: DB・MIDI解析、録音単位の43/13分割、モデル比較と試聴生成。

研究は設計の根拠であり、このアプリの知覚的品質の証明ではありません。旋律文法のフレーズ長、跳躍制限、アクセント、低速域の上限密度は練習用の設計です。テンポ別タイミングの補間、音程の重み、gate比は調整用43ソロから作っています。評価用13ソロをパラメータ作成に使いません。

主要な三和音・七の和音、6/9、9/11/13、sus2/4、dim、aug、m7b5、属和音の変化音、分数コードに対応します。コード進行入力は実音です。移調譜は表示だけを変え、再生音は変えません。シードに加えて進行・生成時BPM・音域・モデル版が同じなら同じ音符を再現できます。

## 配信

`dist/server/index.js`をWorkerとして配置し、D1の`DB`を割り当てます。Drizzleで生成した`drizzle/`のSQLはSitesが適用します。画面と研究資料はWorkerに同梱しています。`.openai/hosting.json`はこのSitesの配信先情報です。ZIPを別のホスティングで使う際は、このファイルをそのまま別Sitesの識別に使わないでください。

## キーとお気に入り

メイン画面のキー選択はコードと音列を実音で移調し、音域も同じ幅で移します。設定のB♭・E♭・Fは表示専用の移調譜です。手入力した進行ではキーは移調の基準となり、自動の調性判定は行いません。

「☆ 保存」で音符そのもの、進行、BPM、音域、キー、生成シードとモデル版を保存します。お気に入りで名前変更・呼び出し・削除・直後の取り消しができます。保存はサインインした利用者単位で分離します。公開範囲は従来どおり本人限定です。

`src/favorites-api.ts`は利用者ID、同一オリジン、入力サイズと音符データを検証し、prepared statementでD1にアクセスします。`db/schema.ts`変更後は `pnpm exec drizzle-kit generate` で追加マイグレーションを生成してください。既存の適用済みマイグレーションは変更しません。

## 2026-10-05 生成器2.0の調査と検証

`public/research/review-v2.html` に追加資料・数値比較・制約を記録しています。ビルド後の `/research/review-v2.html` で旧版と新版を共通タイミングでA/B再生できます。8小節表示・メイン画面のキー選択・お気に入りは維持しています。

原本（アプリには同梱しません）を `../../work/research/` に準備：
- `raw/wjazzd.db`：Weimar Jazz Database の配布DB。初版分析と同じファイルを使用。
- `independent/jtd.zip`：https://github.com/HuwCheston/Jazz-Trio-Database/releases/download/v02-zenodo/jazz-trio-database-v02.zip
- `independent/pijama-midi.zip`：https://zenodo.org/api/records/8354955/files/midi_hawthorne.zip/content
- `independent/pijama.csv`：https://raw.githubusercontent.com/almostimplemented/PiJAMA/main/pijama.csv

取得ファイルのSHA256を `public/research/audit-v2.json` のmanifestsと比較してください。PiJAMAはCC BY-NC 4.0、評価用集計のみ。JTDのMIT通知は `public/research/JTD-LICENSE.txt`、WJazzDの通知は同ディレクトリのNOTICE.txt。

```sh
python3 research/analyze_v2.py --raw ../../work/research --out public/research
node research/evaluate_v2.ts
node research/export-comparison.ts ../../outputs/bebop-comparison
pnpm test
pnpm run typecheck
pnpm run build
```

720条件／版の比較・11件の自動テストを実施。旋律の折り返しは減少しましたが、順次進行過多、同音反復・大跳躍の少なさが残ります。専門家の聴取評価は未実施。最新版のブラウザ検証は環境のサーバー起動制限で未実施。iPhone実機の割り込み・復帰も未確認。今回の公開更新はGitホストの名前解決失敗で未完了です。

## 2026-10-05 生成器2.1

追加文献を実装に反映。WJazzDビバップ43ソロの統計を維持し、長短調ii–V–I／V–Iの解決点、半音解決するエンクロージャー、冒頭リズムを保った応答、フレーズ間の音程記憶を追加しました。民謡モデルの重みやPiJAMAの旋律統計は導入していません。

`src/generator-v2.ts` は2.0比較用に固定し、通常の生成は `src/generator-v21.ts` を使います。保存済みフレーズは音符列を保持します。2.0と2.1の共通条件試聴は `/research/review-v21.html`。`node research/evaluate_v21.ts` で720条件／版を再実行できます。2.0の歴史的評価を再実行する `evaluate_v2.ts` も固定した2.0生成器を参照します。

```sh
node research/evaluate_v21.ts
node research/export-comparison.ts ../bebop-comparison-v21 public/research/comparison-v21.json
```

13件のテスト・型チェック・ビルドが通過。評価は開発用回帰比較で、専門家の盲検評価ではありません。ガイドトーン着地100%は制約の確認であり品質保証ではありません。順次進行過多は残ります。公開先のGitホストの名前解決失敗が続き、2.1の公開反映は未完了です。

## 掛け合い・無限演奏

メイン画面の練習モードで切替。
- 掛け合い：2／4小節のお手本のあと、同じ進行で伴奏のみの演奏区間。入力進行を順にたどり、端数は先頭へ循環。お手本ごとに新しいビバップフレーズ。
- 無限演奏：選択キー・長短調の練習用和声パターンから、進行とフレーズを2／4小節ごとに更新。キーは自動転調せず保持。特定曲の採譜や統計的な進行分布を再現したものではありません。
- カウントインは最初だけ。通常ループ設定とは別に停止まで継続。画面を離れると停止。表示中のフレーズは既存のお気に入りへ保存可能。

次区間を先読み生成し、音声時計に合わせて譜面を切替。保持する区間データは現在と次の最大2区間。停止時は先読み音源もキャンセル。

15件のテストで、無音の応答区間・伴奏継続・カウントイン回数・先読みと表示時刻の分離・メモリ上限・12キー長短調の自動進行を確認。型チェックとビルドも通過。ブラウザ／iPhone実機試験は環境制限のため未実施。公開更新もGit接続の名前解決失敗により未完了。

## 生成器2.2：音程と音域

コードトーンを使う短いアルペジオ、時折の広い跳躍と逆方向への順次進行、フレーズごとの使用レジスター、終端音が異なる探索候補を追加。前版を `generator-v21.ts` に保持。新規生成だけが2.2を使用します。

音域の初期値はC4〜C6を維持。1オクターブ・低め・標準・広めの設定プリセット、譜面下の実際の使用音域表示を追加。楽器固有の推奨範囲ではなく、ユーザーが実音で調整する設定です。

`node research/evaluate_v22.ts` と `python3 research/report_v22.py` で比較結果を再実行。 `/research/review-v22.html` に公開版・2.1・2.2の比較、制約、試聴例。6条件各200シード×3版＝3,600例、16件のテストを確認。跳躍量が増えたことは聴取品質の改善を保証しません。公開更新・今回の実機確認は未完了です。

## 生成器2.3：ビバップ語法の調整

2.2で強くなりすぎた3度進行の優遇を弱め、フレーズ途中のコードトーンへ半音で解決するアプローチを追加。既存の囲みと解決を保護し、装飾後の音列をモチーフ記憶へ反映。音域・タイミングモデルは維持。

`node research/evaluate_v23.ts` で6進行×4テンポ×30シード／版を比較。`/research/review-v23.html` に2.2／2.3共通タイミングの試聴と全結果を掲載。16件の機能テスト、型チェック、ビルドを確認。聴取品質の改善を数値だけで保証するものではありません。

## 生成器2.4：ビバップ資料との厳格比較

`/research/review-v24.html` に方法、出典、条件別結果、旧2.3との同一音色A/Bを掲載。
WJazzDのBEBOP56ソロを再抽出し、43ソロで調整、以前にも参照した13ソロは再利用参照として明記。
完全な4/8小節窓に切り、同一フレーズ内・発音間隔1拍以下の音程と、拍頭の和声音、接続、反復、実際のフレーズ終音を比較。
窓同士は独立ではなく、曲・和声・楽器も一致しないため、差を品質の証明とはしません。

拍頭のコード音加点と短い11thへの抑制を弱め、連続する方向反転を抑制。後付け半音アプローチを減らし、既存の囲み・解決を保護。
最終シード2001〜2030、6進行×4テンポの720例／版で、拍頭コード音率の中央値81.8%→66.7%、方向反転46.2%→39.3%。
順次進行72.9%と短い反復の多さ、限定的なリズム、強制的なガイドトーン着地は残ります。
専門家の盲検聴取は未実施。A/B固定例は2017で事前指定し、除外していません。
音域・演奏タイミング・伴奏・保存済みフレーズは維持します。

```sh
python3 research/audit_reference.py
node research/evaluate_v24.ts
python3 research/report_v24.py
pnpm test
pnpm typecheck
pnpm build
```

元DBのパスは上記の分析再実行と同じ。ノート単位の参照抽出は`../../work/research/audit-reference-v24.json`にのみ保存し、配布しません。
公開JSONは窓単位・ソロ単位の派生統計と生成例。20件のテスト・型チェック・ビルドが通過。
過去の版の節にある公開失敗は当時の記録です。2.3と譜面修正版は公開済み。

## 少し冒険：和声解釈1.0

メイン画面の「標準／少し冒険」。標準は2.4の音列をそのまま保ちます。
少し冒険は入力の着地を保ち、1区間1か所だけ、V7→裏コードまたは次の和音直前への属七挿入を行います。
伴奏・旋律・譜面は同じ変更後の進行を使用。譜面下に元→変更後を表示。入力は元進行を保つため生成のたびに変更が累積しません。
分数コード・不適切な着地・挿入用の拍がない箇所は避け、候補がなければ元進行を使用。
掛け合いの応答はお手本と同じ和声。お気に入りは元進行と演奏進行を両方保存し、キー変更で両方を移調。

裏コードの着地を生成器に明示するのは冒険モードだけ。代理コードの頻度は練習用の設計で、コーパスから推定した頻度ではありません。
理論の参照：University of Tennessee, Tritone Substitution (https://musictheorymaterials.utk.edu/composition-index-tritone-sub/) と Berklee, Voice Leading for Guitar (https://online.berklee.edu/takenote/voice-leading-for-guitar/)。
旋律だけ別和声を匂わせるモードや「多め」は今回含めません。

## 冒険2.0：和声と旋律の語彙

「少し冒険」を「冒険」へ。和声の変更は長さに応じて1〜3か所から抽選し、変更元と着地が重なる候補は除外します。候補がなければ和声は維持。
旋律には上方／下方からの囲み込み、2音の連続半音アプローチを追加。元の音数・発音位置・音価・休符・三連符を維持する音高だけの処理で、音域、既存の解決、フレーズ境界、着地を保護します。
標準の生成経路は変更していません。設計上の語彙追加であり、ビバップの知覚的品質の改善を実証したものではありません。
24テスト、型チェック、ビルドが通過。60シードで複数の和声変更数が現れること、旋律装飾前後でリズムが完全一致することを確認。

## 自動進行の更新

掛け合い・入力進行は従来どおり入力の区間を順に使用。掛け合い・進行も更新は新しい進行でお手本を演奏し、応答では同じ進行とフレーズを保持してソロを消す。次のお手本で更新する。
無限演奏も同じ自動進行ライブラリを使う。長短調×2/4小節それぞれ8種類、計32種類の練習用編集進行。一巡前の重複を避け、可能な限り開始ルートも変える。選択キーは保つ。進行自体は有限で、フレーズと冒険の変形を毎回生成する。コーパス由来の頻度分布とは主張しない。
25テスト、型チェック、ビルド通過。12キー、長短調、2/4小節の再現性・進行の多様性、24往復の掛け合いで応答の一致を検証。
