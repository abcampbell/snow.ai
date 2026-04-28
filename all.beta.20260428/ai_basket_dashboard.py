"""Render the AI infrastructure basket dashboard from ai_basket_returns.json."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

PROJECT_DIR = Path(__file__).parent
DATA_PATH = PROJECT_DIR / "ai_basket_returns.json"


def color_for_pct(pct: float | None) -> str:
    if pct is None:
        return "var(--muted)"
    if pct > 0:
        return "var(--good)"
    if pct < 0:
        return "var(--bad)"
    return "var(--txt)"


def fmt_pct(pct: float | None) -> str:
    if pct is None:
        return "—"
    return f"{pct:+.1f}%"


def fmt_px(p: float | None) -> str:
    if p is None:
        return "—"
    if p >= 10000:
        return f"{p:,.0f}"
    if p >= 100:
        return f"{p:,.2f}"
    return f"{p:.2f}"


def main() -> None:
    data = json.loads(DATA_PATH.read_text())
    constituents = data["constituents"]
    base_dt = data["base_trading_date"]
    cur_dt = data["current_date"]
    weighted = data.get("weighted_return_pct")

    # Sort by % change descending
    rows = sorted(constituents, key=lambda r: r.get("pct_change") or -999, reverse=True)

    # Group by theme for aggregate summary
    by_theme: dict[str, list] = {}
    for r in constituents:
        by_theme.setdefault(r["theme"], []).append(r)

    theme_summary = []
    for theme, rs in by_theme.items():
        weights = [r.get("weight") or 0 for r in rs]
        pcts = [r.get("pct_change") or 0 for r in rs]
        wt_sum = sum(weights)
        if wt_sum > 0:
            wp = sum(w * p for w, p in zip(weights, pcts)) / wt_sum
        else:
            wp = sum(pcts) / max(len(pcts), 1)
        theme_summary.append({"theme": theme, "n": len(rs), "wt": wt_sum * 100, "wpct": wp})
    theme_summary.sort(key=lambda x: -x["wpct"])

    # Build HTML
    today_iso = datetime.now().strftime("%Y-%m-%d")
    out_path = PROJECT_DIR / f"ai_basket.{today_iso.replace('-','')}.v001.html"

    rows_html = ""
    for r in rows:
        pct = r.get("pct_change")
        bar_col = color_for_pct(pct)
        bar_w = max(0, min(120, abs(pct or 0))) if pct is not None else 0
        # Bar always positioned from a center axis
        if pct is None or pct == 0:
            bar = ""
        elif pct > 0:
            bar = f'<div class="bar pos" style="width: {bar_w}%;"></div>'
        else:
            bar = f'<div class="bar neg" style="width: {bar_w}%;"></div>'

        wt = r.get("weight")
        wt_s = f"{wt*100:.1f}%" if wt is not None else "—"
        company = r.get("company_name") or r["ticker_raw"]
        what = r.get("what_it_does") or ""
        hw = r.get("hardware_node") or ""
        rationale = r.get("rationale") or ""
        full_desc = " · ".join(filter(None, [hw, what])) if (hw or what) else ""
        rationale_html = f'<div class="rationale">{rationale}</div>' if rationale else ""
        rows_html += f'''
        <tr>
          <td class="ticker">{r["ticker_raw"]}</td>
          <td class="company">{company}<div class="muted small">{full_desc}</div>{rationale_html}</td>
          <td class="theme-cell"><span class="theme-pill">{r["theme"]}</span></td>
          <td class="num">{fmt_px(r.get("cur_px"))}</td>
          <td class="num">{wt_s}</td>
          <td class="num pct" style="color: {bar_col};">{fmt_pct(pct)}</td>
          <td class="barcell"><div class="zero"></div>{bar}</td>
        </tr>'''

    theme_html = ""
    for t in theme_summary:
        col = color_for_pct(t["wpct"])
        theme_html += f'''
        <tr>
          <td class="theme-cell"><span class="theme-pill">{t["theme"]}</span></td>
          <td class="num">{t["n"]}</td>
          <td class="num">{t["wt"]:.1f}%</td>
          <td class="num heavy" style="color: {col};">{fmt_pct(t["wpct"])}</td>
        </tr>'''

    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>AI Infrastructure Basket — Returns since {base_dt}</title>
<style>
  :root {{
    --bg: #0c0c0c; --p: #171717; --p2: #1d1d1d; --line: #323232; --soft: #262626;
    --txt: #e6e6e6; --dim: #ababab; --muted: #7f7f7f;
    --good: #7fd890; --bad: #ff8d8d; --amber: #ffc266; --blue: #8fc5ff; --purple: #b189ff;
  }}
  * {{ box-sizing: border-box; }}
  html, body {{ margin: 0; min-height: 100%; background: var(--bg); color: var(--txt);
               font-family: "Segoe UI", Arial, sans-serif; font-size: 13px; }}
  .shell {{ padding: 22px 26px; max-width: 1500px; margin: 0 auto; }}
  h1 {{ margin: 0 0 6px; font-size: 24px; font-weight: 700; letter-spacing: -0.01em; }}
  h2 {{ margin: 0 0 18px; font-size: 12px; color: var(--dim); font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; }}
  h3 {{ margin: 26px 0 10px; font-size: 14px; color: var(--blue); }}
  .top {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 22px; }}
  .card {{ background: var(--p); border: 1px solid var(--line); padding: 14px; border-radius: 4px; }}
  .card .label {{ font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }}
  .card .value {{ font-size: 22px; font-weight: 700; line-height: 1.1; }}
  .card .delta {{ font-size: 11px; margin-top: 6px; color: var(--dim); }}
  .card.hero {{ border-left: 3px solid var(--good); }}
  .card.hero .value {{ color: var(--good); font-size: 30px; }}
  table {{ width: 100%; border-collapse: collapse; }}
  th {{ text-align: left; padding: 9px 10px; font-size: 11px; color: var(--dim); text-transform: uppercase;
       letter-spacing: 0.04em; border-bottom: 1px solid var(--line); background: #111; }}
  td {{ padding: 8px 10px; border-bottom: 1px solid var(--soft); font-size: 12px; vertical-align: top; }}
  td.num, th.num {{ text-align: right; font-variant-numeric: tabular-nums; }}
  td.ticker {{ font-weight: 700; font-size: 13px; color: var(--txt); }}
  td.company {{ color: var(--txt); }}
  td.company .muted.small {{ color: var(--muted); font-size: 11px; margin-top: 2px; }}
  td.company .rationale {{ color: var(--dim); font-size: 11px; margin-top: 4px; font-style: italic; }}
  td.pct {{ font-weight: 700; font-size: 13px; }}
  .theme-pill {{ display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px;
                 background: rgba(143, 197, 255, 0.10); color: var(--blue); border: 1px solid rgba(143, 197, 255, 0.20); white-space: nowrap; }}
  .barcell {{ position: relative; width: 220px; }}
  .barcell .zero {{ position: absolute; top: 8px; bottom: 8px; left: 50%; width: 1px; background: rgba(255,255,255,0.15); }}
  .bar {{ position: absolute; top: 8px; bottom: 8px; border-radius: 2px; }}
  .bar.pos {{ left: 50%; background: var(--good); }}
  .bar.neg {{ right: 50%; background: var(--bad); }}
  .heavy {{ font-weight: 700; }}
  .muted {{ color: var(--muted); }}
  .good {{ color: var(--good); }}
  .bad {{ color: var(--bad); }}
  .footer {{ margin-top: 32px; padding: 14px 0; color: var(--muted); font-size: 11px;
            border-top: 1px solid var(--soft); text-align: center; }}
</style>
</head>
<body>
<div class="shell">

  <h1>AI Infrastructure Basket</h1>
  <h2>Net returns of constituents since {base_dt}</h2>

  <div class="top">
    <div class="card hero">
      <div class="label">Weighted basket return</div>
      <div class="value">{fmt_pct(weighted)}</div>
      <div class="delta">since {base_dt}</div>
    </div>
    <div class="card">
      <div class="label">Constituents</div>
      <div class="value">{len(constituents)}</div>
      <div class="delta">across {len(by_theme)} themes</div>
    </div>
    <div class="card">
      <div class="label">Period</div>
      <div class="value">{((datetime.fromisoformat(cur_dt) - datetime.fromisoformat(base_dt)).days)}d</div>
      <div class="delta">{base_dt} → {cur_dt}</div>
    </div>
    <div class="card">
      <div class="label">Source</div>
      <div class="value" style="font-size: 14px;">snow.ai.infrastructure.basket.return</div>
      <div class="delta">Rose logic, prices via yfinance</div>
    </div>
  </div>

  <h3>By theme — weighted return</h3>
  <div class="card" style="padding: 0;">
    <table>
      <thead><tr><th>Theme</th><th class="num">N</th><th class="num">Total weight</th><th class="num">Weighted return</th></tr></thead>
      <tbody>{theme_html}</tbody>
    </table>
  </div>

  <h3>Constituents — sorted by % change since {base_dt}</h3>
  <div class="card" style="padding: 0;">
    <table>
      <thead>
        <tr>
          <th style="width: 80px;">Ticker</th>
          <th>Company / Description</th>
          <th>Theme</th>
          <th class="num">Price</th>
          <th class="num">Weight</th>
          <th class="num" style="width: 90px;">% chg</th>
          <th style="width: 220px;">Bar</th>
        </tr>
      </thead>
      <tbody>{rows_html}</tbody>
    </table>
  </div>

  <div class="footer">
    Basket logic: <code>snow.ai.infrastructure.basket.return</code> →
    <code>ai.infrastructure.basket.20251214.snow.001.map:portfolioreturns(returns, stock.weight)</code> ·
    Prices via yfinance · Period {base_dt} to {cur_dt} · Generated {today_iso}
  </div>

</div>
</body>
</html>'''

    out_path.write_text(html, encoding="utf-8")
    print(f"wrote {out_path}")
    return str(out_path)


if __name__ == "__main__":
    main()
