"""Build the research report from measured artifacts. No external dependencies."""
import pathlib,json,html,shutil
root=pathlib.Path(__file__).resolve().parents[1]; out=root/'public/research'
a=json.loads((out/'analysis.json').read_text());e=json.loads((out/'evaluation.json').read_text())
def f(x,d=3):return '—' if x is None else f'{x:.{d}f}'
rows=''.join(f"<tr><td>{b['low']}–{min(b['high']-1,320)}</td><td>{b['solos']}</td><td>{b['on']['n']} / {b['off']['n']}</td><td>{f(b['on']['median'])}</td><td>{f(b['off']['median'])}</td><td>{f(b['off']['q25'])}–{f(b['off']['q75'])}</td><td>{f(b['density']['median'])}</td></tr>" for b in a['tempoBins'])
sources=[
 ('Love, 2012','https://mtosmt.org/issues/mto.12.18.3/mto.12.18.3.love.html','Parkerのブルースを、旋律の道筋とフレーズ配置の両面から分析。休符や小節をまたぐ連続性を重視する根拠。','まずフレーズの長さと輪郭を決める。初版の6〜12拍という長さは練習用の設計であり、論文の12小節構造の再現ではない。'),
 ('Frieler, 2019 — Constructing Jazz Lines','https://jazzforschung.hfm-weimar.de/wp-content/uploads/2019/06/JazzforschungHeute2019_Frieler-Constructing-Jazz-Lines.pdf','音程列を順次進行、半音進行、アプローチ、アルペジオなどに分類。単純な一次遷移だけでは豊かな構造の説明が難しいという結果も重要。','音程頻度は候補の重みとして使い、輪郭・和声・着地・解決の制約を合わせる。WBAそのものの完全実装ではない。'),
 ('Gillick, Tang & Keller, 2009 — Learning Jazz Grammars','https://ai.stanford.edu/~kdtang/papers/smc09-jazzgrammar.pdf','音の役割と旋律の輪郭を抽象化し、新しい和声へ適用する生成研究。本文を確認。2007年論文の公式配布先は証明書不一致で取得できず、その方式を展開した本論文を採用。','コード音・色彩音・アプローチ・休符を区別。初版は独自の制約付き確率文法で、論文のクラスタリング学習を再実装したものではない。'),
 ('Friberg & Sundström, 2002 / KTH実演ページ','https://www.speech.kth.se/music/performance/Texts/ensemble_swing.htm','スウィング比とソロ／伴奏の発音位置はテンポに関係する。伴奏とソロで同じ比率とは限らない。','ソロの拍上・裏拍位置を別々にモデル化し、ライドの裏拍をソロに合わせる。この伴奏裏拍は研究を参考にした合成上の仮定。'),
 ('Datseris et al., 2019','https://arxiv.org/abs/1904.03442','演奏の微細な揺れを大きくすることが、必ずしもスウィング感の向上につながらないという聴取実験。','無作為なタイミング揺れを初期値に加えない。'),
 ('Nelias et al., 2022','https://www.nature.com/articles/s42005-022-00995-z','拍上の系統的な遅れと、ソロ／伴奏の裏拍の同期を検討。WJazzDの観察とピアノによる聴取実験を組み合わせる。','拍上と裏拍の位置を直接指定し、別のスウィング補正を二重適用しない。奏者差や低速域の不確実性は残す。')]
refs=''.join(f'<li><a href="{u}" target="_blank" rel="noopener">{html.escape(t)}</a><p>{html.escape(finding)}</p><p class="muted">実装：{html.escape(impl)}</p></li>' for t,u,finding,impl in sources)
audio=''.join(f'<section><h3>{bpm} BPM</h3>'+''.join(f'<label>{name}<audio controls preload="none" src="example-{bpm}-{mode}.wav"></audio></label>' for mode,name in [('model','データ参照'),('straight','均等八分音符'),('triplet','固定2対1')])+'</section>' for bpm in [80,140,200,280])
performers=''.join(f'<tr><td>{html.escape(p)}</td><td>{sum(r["performer"]==p for r in a["solos"] if r["style"]=="BEBOP")}</td></tr>' for p in sorted(set(r['performer'] for r in a['solos'] if r['style']=='BEBOP')))
report=f'''<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BEBOP / research notebook</title>
<style>body{{font:16px/1.85 -apple-system,BlinkMacSystemFont,sans-serif;color:#202630;background:#f9fafb;margin:0 auto;padding:26px 20px 80px;max-width:850px}}h1{{font:500 24px ui-monospace,monospace}}h2{{font-size:20px;font-weight:500;margin-top:44px;border-top:1px solid #ccd0d6;padding-top:20px}}h3{{font-size:17px}}a{{color:#315bb6;text-underline-offset:3px}}.muted,small{{color:#626b78}}table{{border-collapse:collapse;font-size:14px;white-space:nowrap}}td,th{{padding:8px;border-bottom:1px solid #d7dbe1;text-align:left}}.table{{overflow:auto}}li{{margin-bottom:24px}}audio{{display:block;width:100%;height:36px;margin:8px 0 20px}}.audio{{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:28px}}code{{overflow-wrap:anywhere}}.notice{{border-left:2px solid #6c80aa;padding-left:16px}}</style>
<a href="../../">BEBOP</a><h1>research notebook</h1><p>調査・分析日：2026-10-05 / モデル wjazzd-bebop-1.0</p>
<p>毎日の単旋律練習のための、研究と実測に基づく生成モデル。以下では、実測した値・文献の知見・練習用の設計を分けて記録します。</p>
<h2>1. 資料と生成規則</h2><ol>{refs}</ol>
<p>これらはすべて独立したデータによる追試ではありません。複数の研究が同じWJazzDを利用しています。コーパスの平均はビバップの規範でも、全楽器共通の演奏法でもありません。</p>
<h2>2. 実際に取得したデータ</h2><p><a href="https://jazzomat.hfm-weimar.de/download/download.html">Weimar Jazz Database</a> release 2.1（schema 2.2）の456ソロと、公開の非量子化MIDI 456本を取得。ビバップ分類56ソロのうち調整用43・評価用13に分割しました。同じ録音trackidは同じ側に割り当て、評価データからパラメータを作っていません。</p>
<p>分割式：<code>sha256("bebop-v1:" + trackid) の先頭8桁 mod 5 = 0</code>を評価用、それ以外を調整用とします。奏者そのものは両側に含まれるので、未知の奏者への一般化試験ではありません。</p>
<details><summary>ビバップ資料の奏者別件数</summary><table>{performers}</table></details>
<p>同一配布元のMIDIとDBは独立した資料ではありません。Parker「Billie's Bounce」は303音すべての音高と順序が一致。音価差の最大は約2 msですが、開始オフセットを除いても発音時刻差は終盤で約529 msに達しました。MIDIの書き出し精度による累積ずれの可能性があるため、微細なタイミングの分析にはDBを採用しました。全456 MIDIの構造・音数・音域・発音長も検査しました。</p>
<p>追加候補のParker Omnibook系データは、今回の取得・利用条件の確認済みコーパスには含めていません。録音や市販採譜は配布物に同梱していません。</p>
<h2>3. テンポとタイミング</h2><p>4/4の各音を、注釈付き拍時刻と次の拍との差で正規化。division=1/2の拍上と、division=2の裏拍を別に集計しました。三連符・細分音・装飾音はこの推定から除外。1ソロにつき20音以上ある統計だけを使い、ソロ内中央値→ソロ間中央値／四分位範囲（IQR）を求めています。IQRは信頼区間ではありません。</p>
<div class="table"><table><tr><th>BPM帯</th><th>調整ソロ</th><th>有効：表/裏</th><th>表拍位置</th><th>裏拍位置</th><th>裏拍 IQR</th><th>音/拍</th></tr>{rows}</table></div>
<p>位置0は拍、0.5は均等八分の裏、1は次の拍。100 BPM未満には多くの細分音があり、この抽出条件では有効なソロがありません。低速・標本の少ない帯域は推定と表示します。アプリは有効帯域の中心間を補間し、範囲外では最寄りの値に固定。三連符は別の均等三連グリッドです。</p>
<p>WJazzDの拍は注釈された基準で、伴奏ドラムの裏拍は収録されていません。アプリの伴奏裏拍の同期は文献に基づく設計であり、このDBから直接測定した値ではありません。発音長は音価そのものではなく、次音までの時間に対するgate比からモデル化します。</p>
<h2>4. 和声・旋律・サンプル進行</h2><p>各ソロについて、半音単位の音程分布、コード相対度数、拍上／フレーズ終端のコード音率、半音進行後のコード音率、音域、フレーズ長、発音間の隙間、移調に依存しない4音程列の反復率を計算しました。コード解釈が確定できないラベルは和声統計から除外し、分母をJSONに残しています。発音の隙間を、そのまま楽譜上の休符とは見なしません。</p>
<p>ii–V–Iとターンアラウンドは、Impro-Visorの和声分析研究およびDB中の短い機能的進行を参照した練習用編集。ブルース終盤はParker「Billie's Bounce」のGm–C7–F7–C7をGm7表記に拡張。リズムチェンジはGillespie／Navarro「Anthropology」のA部を比較して組み立てた練習用のリハーモナイズです。既存ソロの旋律を貼り合わせていません。</p>
<h2>5. 生成モデルの事前検証</h2><p>6進行 × 4テンポ × 30シード = {e['generated']}フレーズを生成。小節長、音域、正の発音長、半音アプローチの解決、データ分割の漏れがないことを自動検証しました。</p>
<div class="table"><table><tr><th>指標</th><th>生成</th><th>評価用13ソロ</th></tr><tr><td>音/拍 中央値</td><td>{f(e['generatedSummary']['densityMedian'])}</td><td>{f(e['holdoutSummary']['densityMedian'])}</td></tr><tr><td>2半音以下の音程率</td><td>{f(e['generatedSummary']['stepFractionMedian'])}（フレーズ中央値）</td><td>{f(e['holdoutSummary']['stepFraction'])}（全音程）</td></tr><tr><td>7半音超の跳躍率</td><td>{f(e['generatedSummary']['largeLeapFractionMedian'])}（フレーズ中央値）</td><td>{f(e['holdoutSummary']['largeLeapFraction'])}（全音程）</td></tr></table></div>
<p>生成は練習用に大きな跳躍を抑えています。集計単位が異なる比較もあるため、上記を適合度の検定や品質得点として扱いません。分布が近いことだけで「自然なビバップ」と認定することはできません。</p>
<h2>6. 同じフレーズの試聴比較</h2><p>シード20261005・同一音列で、4テンポと3種類のタイミングを比較。音色、音量、音列は各テンポ内で同じです。波形の無音・非有限値・クリップを検査済み。データ参照版の知覚的な優位性について、ジャズ演奏者による聴取評価は未実施です。</p><div class="audio">{audio}</div>
<h2>7. 再現と利用条件</h2><p class="notice">Contains information from the <a href="https://jazzomat.hfm-weimar.de/download/download.html">Weimar Jazz Database</a>, made available under the <a href="https://opendatacommons.org/licenses/odbl/1-0/">Open Database License</a>. 派生データもODbL 1.0で公開します。</p>
<p><a href="analysis.json">全分析データ</a> / <a href="model.json">アプリ用モデル</a> / <a href="evaluation.json">生成検証</a> / <a href="audition.json">試聴の音符・測定値</a> / <a href="analyze.py">分析スクリプト</a> / <a href="NOTICE.txt">出典・ライセンス</a></p>
<p>取得元、SHA-256、元DBのライセンス文はanalysis.jsonに保存。ソース一式のREADMEに再実行手順があります。</p></html>'''
(out/'index.html').write_text(report)
shutil.copyfile(root/'research/analyze.py',out/'analyze.py')
print('research report ready')
