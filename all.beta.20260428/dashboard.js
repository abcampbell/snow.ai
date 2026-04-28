(function () {
  const analysis = window.ALL_BETA_ANALYSIS;
  const equity = analysis.equity;
  const macro = analysis.macro;
  const beta = analysis.beta;
  const NS = "http://www.w3.org/2000/svg";

  const palette = {
    sea: "#2e6f95",
    amber: "#c97c1a",
    rose: "#a23e48",
    mint: "#4d908e",
    stone: "#64727b",
    ink: "#143642",
  };
  const betaColors = {
    "SPY baseline": "#143642",
    "Constructed benchmark 1x": "#2e6f95",
    "Constructed benchmark 2x": "#5b8fb9",
    "Constructed benchmark 3x": "#c97c1a",
    "Retirement-cap optimizer": "#7b6d8d",
    "SPY + funds optimizer": "#4d908e",
    "Funds-only optimizer": "#a23e48",
    "ALLW": "#6c7a89",
    "RPAR": "#588157",
    "UPAR": "#8a6f40",
    "NTSX": "#264653",
    "RSSB": "#7f5539",
    "REMIX": "#7b6d8d",
  };

  const pct = (value, digits = 2) => `${(value * 100).toFixed(digits)}%`;
  const bps = (value) => `${Math.round(value * 10000)} bps`;
  const absBps = (value) => `${Math.round(Math.abs(value) * 10000)} bps`;
  const equityCurve = (sigma, rho, n) => sigma * Math.sqrt(rho + (1 - rho) / n);
  const benefitCaptured = (sigma, rho, n) => {
    const start = equityCurve(sigma, rho, 1);
    const asymptote = sigma * Math.sqrt(rho);
    const current = equityCurve(sigma, rho, n);
    return (start - current) / Math.max(start - asymptote, 1e-12);
  };
  const diversificationCount = (sigma, rho, threshold = 0.9, maxStocks = 300) => {
    for (let n = 1; n <= maxStocks; n += 1) {
      if (benefitCaptured(sigma, rho, n) >= threshold) return n;
    }
    return maxStocks;
  };
  const shortFactorLabel = (label) => ({
    "U.S. Equities": "US Eq",
    "DM ex-US Equities": "DM ex-US",
    "EM Equities": "EM Eq",
    "Long Treasuries": "Long Tsy",
    "TIPS / IL Bonds": "TIPS",
    "IG Credit": "IG Credit",
    "HY Credit": "HY Credit",
    "EM Sovereign Bonds": "EM Bonds",
    "Broad Commodities": "Commodities",
    "Gold": "Gold",
    "U.S. REITs": "REITs",
    "EM FX": "EM FX"
  }[label] || label.replace("U.S. ", "").replace(" / IL Bonds", ""));
  const formatWeightMix = (weights, limit = 3) => Object.entries(weights)
    .filter(([, value]) => value > 0.01)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([asset, value]) => `${asset} ${pct(value, 0)}`)
    .join(", ");
  const formatTickerMix = (rows, limit = 3) => rows
    .slice(0, limit)
    .map((row) => `${row.ticker} ${pct(row.weight, 0)}`)
    .join(", ");

  function svgEl(tag, attrs = {}, text = null) {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    if (text !== null) {
      el.textContent = text;
    }
    return el;
  }

  function append(parent, child) {
    parent.appendChild(child);
    return child;
  }

  function createLinearScale(domainMin, domainMax, rangeMin, rangeMax) {
    const span = domainMax - domainMin || 1;
    return (value) => rangeMin + ((value - domainMin) / span) * (rangeMax - rangeMin);
  }

  function createLogScale(domainMin, domainMax, rangeMin, rangeMax) {
    const safeMin = Math.max(domainMin, 1e-6);
    const safeMax = Math.max(domainMax, safeMin * 10);
    const minLog = Math.log10(safeMin);
    const maxLog = Math.log10(safeMax);
    const span = maxLog - minLog || 1;
    return (value) => {
      const safeValue = Math.max(value, safeMin);
      return rangeMin + ((Math.log10(safeValue) - minLog) / span) * (rangeMax - rangeMin);
    };
  }

  function linePath(points) {
    return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point[0].toFixed(2)} ${point[1].toFixed(2)}`).join(" ");
  }

  function areaPath(points, baselineY) {
    if (!points.length) return "";
    return `${linePath(points)} L ${points[points.length - 1][0].toFixed(2)} ${baselineY.toFixed(2)} L ${points[0][0].toFixed(2)} ${baselineY.toFixed(2)} Z`;
  }

  function makeSvg(containerId, width = 760, height = 340) {
    const container = document.getElementById(containerId);
    if (!container) return null;
    const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": containerId });
    container.innerHTML = "";
    container.appendChild(svg);
    return { svg, width, height };
  }

  function drawAxes(svg, box, xTicks, yTicks, xScale, yScale, xFormatter, yFormatter, xLabel, yLabel) {
    const midY = box.top + (box.bottom - box.top) / 2;
    yTicks.forEach((tick) => {
      const y = yScale(tick);
      append(svg, svgEl("line", { x1: box.left, y1: y, x2: box.right, y2: y, class: "grid-line" }));
      append(svg, svgEl("text", { x: box.left - 10, y: y + 4, "text-anchor": "end", class: "axis-text" }, yFormatter(tick)));
    });

    xTicks.forEach((tick) => {
      const x = xScale(tick);
      append(svg, svgEl("line", { x1: x, y1: box.top, x2: x, y2: box.bottom, class: "grid-line" }));
      append(svg, svgEl("text", { x, y: box.bottom + 18, "text-anchor": "middle", class: "axis-text" }, xFormatter(tick)));
    });

    append(svg, svgEl("line", { x1: box.left, y1: box.bottom, x2: box.right, y2: box.bottom, class: "domain-line" }));
    append(svg, svgEl("line", { x1: box.left, y1: box.top, x2: box.left, y2: box.bottom, class: "domain-line" }));
    append(svg, svgEl("text", { x: box.left + (box.right - box.left) / 2, y: box.bottom + 40, "text-anchor": "middle", class: "axis-label" }, xLabel));
    append(svg, svgEl("text", { x: 18, y: midY, "text-anchor": "middle", class: "axis-label", transform: `rotate(-90 18 ${midY})` }, yLabel));
  }

  function drawNote(svg, x, y, color, text) {
    append(svg, svgEl("text", {
      x,
      y,
      fill: color,
      "font-size": 11,
      "font-family": "Arial, sans-serif"
    }, text));
  }

  function renderHero() {
    const betaCountValue = beta && beta.mode !== "unavailable" ? `${beta.fund_count} funds` : "n/a";
    const metrics = [
      { label: "Equity beta floor", value: pct(equity.asymptote_vol) },
      { label: "Macro construction", value: "PCA + factor ERC" },
      { label: "Five-factor capture", value: pct(macro.pca.cumulative_explained_variance_ratio[4]) },
      { label: "Beta funds", value: betaCountValue },
      { label: "Optimizer", value: beta && beta.mode !== "unavailable" ? "DR / gross <= 3x" : "Unavailable" },
    ];
    document.getElementById("hero-metrics").innerHTML = metrics.map((metric) => `
      <div class="metric">
        <span class="label">${metric.label}</span>
        <span class="value">${metric.value}</span>
      </div>
    `).join("");
    document.getElementById("hero-quote").textContent =
      "Thirty stocks do not give you thirty bets. They give you one very clean one. If you want another bet, you need another source of risk.";
  }

  function renderFacts() {
    document.getElementById("equity-facts").innerHTML = [
      {
        label: "90% benefit",
        value: equity.n_for_90pct_of_available_diversification,
        copy: "stocks to capture about 90% of the available single-name diversification benefit"
      },
      {
        label: "95% benefit",
        value: equity.n_for_95pct_of_available_diversification,
        copy: "stocks to get very close to the asymptote"
      },
      {
        label: "10 bps cutoff",
        value: equity.marginal_threshold_hits["10"],
        copy: "the next stock falls below a 10 bps marginal volatility benefit"
      },
      {
        label: "Beta floor",
        value: pct(equity.asymptote_vol),
        copy: "the systematic equity volatility left after diversification has done its job"
      }
    ].map((fact) => `
      <article class="fact">
        <span class="label">${fact.label}</span>
        <span class="value">${fact.value}</span>
        <p>${fact.copy}</p>
      </article>
    `).join("");

    const pca = macro.pca;
    const factorErc = pca.factor_erc;
    const firstFactor = pca.components[0];
    document.getElementById("macro-facts").innerHTML = [
      {
        label: "Proxy window",
        value: macro.start_date && macro.end_date ? `${macro.start_date.slice(0, 4)}-${macro.end_date.slice(0, 4)}` : "fallback",
        copy: "union of the Rose proxy histories; covariance is estimated from pairwise overlaps because the sleeve histories end on different dates"
      },
      {
        label: "Five factors",
        value: pct(pca.cumulative_explained_variance_ratio[4], 1),
        copy: "By the fifth principal component, almost all of the sleeve variance is already explained."
      },
      {
        label: "Six-factor map",
        value: pct(pca.cumulative_explained_variance_ratio[5], 1),
        copy: "Six factors clear the 95% threshold, which is the practical macro factor count hiding under the 12 sleeves."
      },
      {
        label: "Dominant factor",
        value: `${firstFactor.code} ${pct(firstFactor.explained_variance_ratio, 1)}`,
        copy: `${firstFactor.economic_label} is the single biggest latent driver before the factor ERC rebalance spreads risk away from it.`
      }
    ].map((fact) => `
      <article class="fact">
        <span class="label">${fact.label}</span>
        <span class="value">${fact.value}</span>
        <p>${fact.copy}</p>
      </article>
    `).join("");

    document.getElementById("equity-formula").textContent =
      `${equity.formula} -> as N grows, the (1-rho)/N term dies, but the rho term survives. That surviving term is equity beta.`;

    document.getElementById("macro-sequence").innerHTML = pca.components.slice(0, 7).map((component) => {
      const positives = component.top_positive.map((entry) => `${entry.sleeve} ${entry.loading.toFixed(2)}`).join(", ");
      const negatives = component.top_negative.length
        ? ` Negative: ${component.top_negative.map((entry) => `${entry.sleeve} ${entry.loading.toFixed(2)}`).join(", ")}.`
        : "";
      return `<li><strong>${component.code} - ${component.economic_label}:</strong> Explains ${pct(component.explained_variance_ratio, 1)}. ${component.summary} Positive: ${positives}.${negatives}</li>`;
    }).join("");

    if (beta && beta.mode !== "unavailable") {
      const optimization = beta.optimization;
      const baseline = optimization.portfolios["SPY baseline"];
      const constructed1x = optimization.portfolios["Constructed benchmark 1x"];
      const constructed2x = optimization.portfolios["Constructed benchmark 2x"];
      const constructed3x = optimization.portfolios["Constructed benchmark 3x"];
      const retirementCap = optimization.portfolios["Retirement-cap optimizer"];
      const bestBalanced = beta.fund_factor_view.best_balanced_fund;
      const mostDiversifying = beta.fund_factor_view.most_diversifying_to_spy;
      const bestFee = beta.fund_factor_view.best_fee_efficient_diversifier;
      const dynamicTop5 = beta.dynamic_fund_backtest;
      document.getElementById("beta-facts").innerHTML = [
        {
          label: "Accessible Window",
          value: `${optimization.accessible_growth_chart.start_date.slice(0, 4)}-${optimization.accessible_growth_chart.end_date.slice(0, 4)}`,
          copy: beta.correlation_window_note
        },
        {
          label: "Most Diversifying To SPY",
          value: mostDiversifying.ticker,
          copy: `${mostDiversifying.fund_name} removes about ${Math.round(mostDiversifying.vol_reduction_bps)} bps of annualized SPY volatility in the simple two-asset long-only min-vol blend.`
        },
        {
          label: "Best Diversifier Per Fee",
          value: bestFee.ticker,
          copy: `${bestFee.fund_name} delivers the most SPY-volatility reduction per unit of stated fee in the simple two-asset blend test.`
        },
        {
          label: "Rolling Top-5 Funds",
          value: `${dynamicTop5.max_funds} fund cap`,
          copy: `Monthly rebalanced on a trailing ${dynamicTop5.lookback_months}-month window at a 16% target vol. Latest mix: ${formatTickerMix(dynamicTop5.latest_active_funds)}.`
        },
        {
          label: "Closest To Equal Factor Mix",
          value: bestBalanced.ticker,
          copy: `${bestBalanced.fund_name} has the flattest spread across the first six principal-factor fingerprints in this sleeve-based similarity test.`
        },
        {
          label: "1x Vol Reduction",
          value: `${Math.round((baseline.annualized_vol - constructed1x.annualized_vol) * 10000)} bps`,
          copy: "Annualized volatility reduction versus 100% SPY when the raw sleeve optimizer has to stay fully invested and long-only."
        },
        {
          label: "Scale Invariance",
          value: optimization.constructed_scale_check_2x < 0.001 && optimization.constructed_scale_check < 0.001 ? "1x = 2x = 3x mix" : "mix changes with leverage",
          copy: `Under max-diversification-ratio, the 2x and 3x constructions keep the same normalized weights as 1x unless you add a return, financing, or concentration view. Current 2x drift is ${(optimization.constructed_scale_check_2x * 100).toFixed(2)}%.`
        },
        {
          label: "Retirement 100% Cap",
          value: `${Math.round((baseline.annualized_vol - retirementCap.annualized_vol) * 10000)} bps`,
          copy: `If the account cannot borrow and total weights must stay at 100%, the combined sleeve-plus-fund optimizer cuts SPY-relative vol by this amount while using embedded-leverage funds where they help.`
        }
      ].map((fact) => `
        <article class="fact">
          <span class="label">${fact.label}</span>
          <span class="value">${fact.value}</span>
          <p>${fact.copy}</p>
        </article>
      `).join("");

      const staticSummary = optimization.portfolio_order.map((label) => {
        const stats = optimization.portfolios[label];
        const extra = label === "Constructed benchmark 3x"
          ? `Gross exposure ${stats.gross_exposure.toFixed(2)}x. Mix: ${formatWeightMix(stats.weights, 4)}.`
          : `Mix: ${formatWeightMix(stats.weights, 4)}.`;
        return `<li><strong>${label}:</strong> Vol ${pct(stats.annualized_vol, 1)}. CAGR ${pct(stats.annualized_return, 1)}. Sharpe ${stats.sharpe.toFixed(2)}. Effective bets ${stats.effective_bets.toFixed(2)}. ${extra}</li>`;
      });
      const dynamicSummary = dynamicTop5.monthly_observations > 0
        ? `<li><strong>Rolling top-5 funds, 16% target vol:</strong> CAGR ${pct(dynamicTop5.annualized_return, 1)}. Realized vol ${pct(dynamicTop5.annualized_vol, 1)}. Max drawdown ${pct(dynamicTop5.max_drawdown, 1)}. Avg leverage ${dynamicTop5.average_leverage.toFixed(2)}x. Latest rebalance ${dynamicTop5.latest_rebalance_date}. Mix: ${formatTickerMix(dynamicTop5.latest_active_funds, 5)}.</li>`
        : `<li><strong>Rolling top-5 funds, 16% target vol:</strong> Not enough monthly history to form the rebalanced portfolio yet.</li>`;
      document.getElementById("beta-portfolio-summary").innerHTML = [...staticSummary, dynamicSummary].join("");

      document.getElementById("beta-rose-links").innerHTML = [
        `<li><a href="${beta.fund_notebook_url}">Rose beta fund notebook</a> - ${beta.manifest_map_code}</li>`,
        `<li><a href="${optimization.rose.notebook_url}">Rose optimized portfolio notebook</a> - ${optimization.rose.notebook_code}</li>`,
        `<li>${optimization.rose.map_code} with one row per asset and one weight column per construction</li>`,
      ].join("");

      document.getElementById("beta-fee-ranking").innerHTML = beta.fund_factor_view.raw_diversification_rankings.slice(0, 5).map((row) => {
        const feeText = row.fee_percent == null ? "n/a" : pct(row.fee_percent, 2);
        return `<li><strong>${row.ticker}:</strong> removes ${Math.round(row.vol_reduction_bps)} bps of annualized SPY vol in the long-only two-asset min-vol blend. Fund weight ${pct(row.fund_weight, 0)}, corr to SPY ${row.spy_correlation.toFixed(2)}, fee ${feeText}.</li>`;
      }).join("");
    }
  }

  function renderEquityAbsoluteChart() {
    const chart = makeSvg("equity-absolute-chart", 1120, 400);
    if (!chart) return;
    const { svg, width, height } = chart;
    const box = { left: 62, right: width - 190, top: 18, bottom: height - 52 };
    const nValues = equity.n;
    const sigma = equity.assumptions.single_stock_vol;
    const historicalRho = equity.assumptions.average_pairwise_correlation;
    const scenarios = [
      { rho: 0.5, label: "rho = 0.5", pill: "rho = 0.5", color: palette.rose, dash: "8 6", width: 2.2 },
      { rho: historicalRho, label: "historical average", pill: `historical average (rho = ${historicalRho.toFixed(1)})`, color: palette.sea, dash: null, width: 5.2, emphasize: true },
      { rho: 0.2, label: "rho = 0.2", pill: "rho = 0.2", color: palette.mint, dash: "8 6", width: 2.2 },
      { rho: 0.1, label: "rho = 0.1", pill: "rho = 0.1", color: palette.amber, dash: "8 6", width: 2.2 },
    ];
    const allVols = scenarios.flatMap((scenario) => nValues.map((n) => equityCurve(sigma, scenario.rho, n) * 100));
    const yMin = Math.max(0, Math.min(...allVols) - 0.8);
    const yMax = Math.max(...allVols) + 0.8;
    const xScale = createLinearScale(1, nValues[nValues.length - 1], box.left, box.right);
    const yScale = createLinearScale(yMin, yMax, box.bottom, box.top);
    const yTicks = [6, 8, 10, 12, 14, 16, 18, 20].filter((tick) => tick >= Math.floor(yMin) && tick <= Math.ceil(yMax));

    drawAxes(
      svg,
      box,
      [1, 10, 20, 30, 50, 100, 200, 300],
      yTicks,
      xScale,
      yScale,
      (value) => value,
      (value) => `${value}%`,
      "Number of stocks",
      "Annualized vol"
    );

    const summaryItems = [];

    scenarios.forEach((scenario) => {
      const vols = nValues.map((n) => equityCurve(sigma, scenario.rho, n) * 100);
      const points = nValues.map((n, index) => [xScale(n), yScale(vols[index])]);
      append(svg, svgEl("path", {
        d: linePath(points),
        fill: "none",
        stroke: scenario.color,
        "stroke-width": scenario.width,
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
        ...(scenario.dash ? { "stroke-dasharray": scenario.dash } : {})
      }));

      const n90 = diversificationCount(sigma, scenario.rho, 0.9, nValues[nValues.length - 1]);
      const markerX = xScale(n90);
      const markerY = yScale(equityCurve(sigma, scenario.rho, n90) * 100);
      append(svg, svgEl("line", {
        x1: markerX,
        y1: markerY + 6,
        x2: markerX,
        y2: box.bottom,
        stroke: scenario.color,
        "stroke-width": scenario.emphasize ? 2.4 : 1.4,
        "stroke-dasharray": scenario.dash || "4 4",
        opacity: scenario.emphasize ? 0.9 : 0.65
      }));
      append(svg, svgEl("circle", {
        cx: markerX,
        cy: markerY,
        r: scenario.emphasize ? 5.5 : 4.3,
        fill: "#ffffff",
        stroke: scenario.color,
        "stroke-width": scenario.emphasize ? 3 : 2
      }));
      summaryItems.push({
        color: scenario.color,
        label: scenario.pill,
        n90,
        emphasize: scenario.emphasize,
      });
    });

    const labelX = box.right + 16;
    scenarios.forEach((scenario, index) => {
      const endY = yScale(equityCurve(sigma, scenario.rho, 285) * 100);
      append(svg, svgEl("text", {
        x: labelX,
        y: endY + 5,
        fill: scenario.color,
        "font-size": scenario.emphasize ? 16 : 13,
        "font-weight": scenario.emphasize ? "700" : "500",
        "font-family": "Arial, sans-serif"
      }, scenario.label));
      if (scenario.emphasize) {
        append(svg, svgEl("text", {
          x: labelX,
          y: endY + 24,
          fill: palette.stone,
          "font-size": 11,
          "font-family": "Arial, sans-serif"
        }, `about ${summaryItems[index].n90} stocks for 90% diversification`));
      }
    });

    document.getElementById("equity-absolute-summary").innerHTML = summaryItems.map((item) => `
      <span class="threshold-pill"${item.emphasize ? ' style="border-color: rgba(46,111,149,0.25); background: rgba(46,111,149,0.08);"' : ""}>
        <span class="threshold-dot" style="background:${item.color}"></span>
        <span>${item.label}</span>
        <strong>${item.n90} stocks</strong>
      </span>
    `).join("");
  }

  function renderEquityBenefitChart() {
    const chart = makeSvg("equity-benefit-chart");
    if (!chart) return;
    const { svg, width, height } = chart;
    const box = { left: 56, right: width - 18, top: 12, bottom: height - 48 };
    const nValues = equity.n;
    const benefit = equity.benefit_captured.map((value) => value * 100);
    const xScale = createLinearScale(1, nValues[nValues.length - 1], box.left, box.right);
    const yScale = createLinearScale(0, 100, box.bottom, box.top);

    drawAxes(
      svg,
      box,
      [1, 10, 20, 30, 50, 100, 200, 300],
      [0, 25, 50, 75, 90, 95, 100],
      xScale,
      yScale,
      (value) => value,
      (value) => `${value}%`,
      "Number of stocks",
      "Benefit captured"
    );

    const points = nValues.map((n, index) => [xScale(n), yScale(benefit[index])]);
    append(svg, svgEl("path", {
      d: areaPath(points, box.bottom),
      fill: "rgba(77, 144, 142, 0.16)",
      stroke: "none"
    }));
    append(svg, svgEl("path", {
      d: linePath(points),
      fill: "none",
      stroke: palette.mint,
      "stroke-width": 3,
      "stroke-linejoin": "round",
      "stroke-linecap": "round"
    }));

    [90, 95].forEach((threshold) => {
      const y = yScale(threshold);
      append(svg, svgEl("line", {
        x1: box.left,
        y1: y,
        x2: box.right,
        y2: y,
        stroke: threshold === 90 ? palette.amber : palette.rose,
        "stroke-width": 1.3,
        "stroke-dasharray": "6 4"
      }));
    });

    [
      { n: equity.n_for_90pct_of_available_diversification, label: "90%" },
      { n: equity.n_for_95pct_of_available_diversification, label: "95%" }
    ].forEach((item) => {
      const x = xScale(item.n);
      const y = yScale(benefit[item.n - 1]);
      append(svg, svgEl("circle", { cx: x, cy: y, r: 5, fill: palette.ink }));
      drawNote(svg, x + 6, y - 6, palette.ink, `${item.label} by N=${item.n}`);
    });
  }

  function renderEquityMarginalChart() {
    const chart = makeSvg("equity-marginal-chart");
    if (!chart) return;
    const { svg, width, height } = chart;
    const box = { left: 56, right: width - 18, top: 12, bottom: height - 48 };
    const nValues = equity.n.slice(1);
    const marginal = equity.marginal_reduction.slice(1).map((value) => value * 10000);
    const xScale = createLinearScale(2, nValues[nValues.length - 1], box.left, box.right);
    const yScale = createLogScale(0.01, Math.max(...marginal), box.bottom, box.top);

    drawAxes(
      svg,
      box,
      [2, 5, 10, 20, 30, 50, 100, 200, 300],
      [0.01, 0.1, 1, 5, 10, 50, 100],
      xScale,
      yScale,
      (value) => value,
      (value) => `${value}`,
      "Nth stock added",
      "Reduction in bps"
    );

    const points = nValues.map((n, index) => [xScale(n), yScale(marginal[index])]);
    append(svg, svgEl("path", {
      d: linePath(points),
      fill: "none",
      stroke: palette.amber,
      "stroke-width": 3,
      "stroke-linejoin": "round",
      "stroke-linecap": "round"
    }));

    [10, 5, 1].forEach((threshold) => {
      const y = yScale(threshold);
      append(svg, svgEl("line", {
        x1: box.left,
        y1: y,
        x2: box.right,
        y2: y,
        stroke: threshold === 10 ? palette.rose : (threshold === 5 ? palette.mint : palette.stone),
        "stroke-width": 1.3,
        "stroke-dasharray": "6 4"
      }));
    });
  }

  function renderEquityDecompositionChart() {
    const chart = makeSvg("equity-decomposition-chart");
    if (!chart) return;
    const { svg, width, height } = chart;
    const box = { left: 52, right: width - 12, top: 20, bottom: height - 54 };
    const selectedN = [1, 5, 10, 20, 30, 50, 100];
    const sigma2 = Math.pow(equity.assumptions.single_stock_vol, 2);
    const rho = equity.assumptions.average_pairwise_correlation;
    const systematic = sigma2 * rho;
    const bandWidth = (box.right - box.left) / selectedN.length;
    const barWidth = Math.min(54, bandWidth * 0.56);
    const yScale = createLinearScale(0, 100, box.bottom, box.top);

    drawAxes(
      svg,
      box,
      selectedN,
      [0, 25, 50, 75, 100],
      createLinearScale(1, selectedN[selectedN.length - 1], box.left + bandWidth / 2, box.right - bandWidth / 2),
      yScale,
      (value) => value,
      (value) => `${value}%`,
      "Number of stocks",
      "Share of total variance"
    );

    selectedN.forEach((n, index) => {
      const idio = sigma2 * (1 - rho) / n;
      const total = systematic + idio;
      const systematicShare = systematic / total * 100;
      const centerX = box.left + bandWidth * index + bandWidth / 2;
      const x = centerX - barWidth / 2;
      const sysTop = yScale(systematicShare);
      const totalVol = Math.sqrt(total);

      append(svg, svgEl("rect", {
        x, y: sysTop, width: barWidth, height: box.bottom - sysTop,
        fill: palette.rose, rx: 10, ry: 10
      }));
      append(svg, svgEl("rect", {
        x, y: box.top, width: barWidth, height: sysTop - box.top,
        fill: palette.mint, rx: 10, ry: 10
      }));
      append(svg, svgEl("text", {
        x: centerX, y: box.top - 4, "text-anchor": "middle", class: "axis-text"
      }, pct(totalVol)));
    });
  }

  function renderMacroAbsoluteChart() {
    const chart = makeSvg("macro-absolute-chart");
    if (!chart) return;
    const { svg, width, height } = chart;
    const box = { left: 56, right: width - 18, top: 12, bottom: height - 48 };
    const steps = macro.steps.map((step) => step.step);
    const vols = macro.steps.map((step) => step.ann_vol * 100);
    const xScale = createLinearScale(1, steps[steps.length - 1], box.left, box.right);
    const yScale = createLinearScale(Math.min(...vols) - 0.5, Math.max(...vols) + 0.6, box.bottom, box.top);

    const coreStartX = xScale(2) - ((xScale(2) - xScale(1)) * 0.45);
    const coreEndX = xScale(5) + ((xScale(2) - xScale(1)) * 0.45);
    append(svg, svgEl("rect", {
      x: coreStartX,
      y: box.top,
      width: coreEndX - coreStartX,
      height: box.bottom - box.top,
      fill: "rgba(201, 124, 26, 0.08)",
      rx: 18,
      ry: 18
    }));

    drawAxes(
      svg,
      box,
      steps,
      [5.5, 6, 7, 8, 9, 10],
      xScale,
      yScale,
      (value) => value,
      (value) => `${value}%`,
      "Sleeve-addition step",
      "Annualized vol"
    );

    const points = steps.map((step, index) => [xScale(step), yScale(vols[index])]);
    append(svg, svgEl("path", {
      d: linePath(points),
      fill: "none",
      stroke: palette.sea,
      "stroke-width": 3,
      "stroke-linejoin": "round",
      "stroke-linecap": "round"
    }));

    points.forEach((point, index) => {
      append(svg, svgEl("circle", { cx: point[0], cy: point[1], r: 5, fill: palette.sea }));
      const label = shortFactorLabel(macro.steps[index].added_factor);
      const yOffset = index % 2 === 0 ? -8 : 18;
      drawNote(svg, point[0] - 18, point[1] + yOffset, palette.ink, label);
    });

    append(svg, svgEl("line", {
      x1: xScale(5),
      y1: box.top,
      x2: xScale(5),
      y2: box.bottom,
      stroke: palette.amber,
      "stroke-width": 1.5,
      "stroke-dasharray": "6 4"
    }));
    append(svg, svgEl("line", {
      x1: xScale(1),
      y1: box.top,
      x2: xScale(1),
      y2: box.bottom,
      stroke: palette.stone,
      "stroke-width": 1.2,
      "stroke-dasharray": "4 5",
      opacity: 0.55
    }));
    drawNote(svg, xScale(1) - 18, box.top + 14, palette.stone, "step 1 = equity beta");
    drawNote(svg, xScale(2.55), box.top + 14, palette.amber, "steps 2-5 = All Weather core");
    drawNote(svg, xScale(5) + 10, box.top + 14, palette.stone, "step 6+ = extensions");
  }

  function renderMacroMarginalChart() {
    const chart = makeSvg("macro-marginal-chart");
    if (!chart) return;
    const { svg, width, height } = chart;
    const box = { left: 56, right: width - 18, top: 16, bottom: height - 56 };
    const steps = macro.steps.slice(1);
    const values = steps.map((step) => step.marginal_reduction * 10000);
    const rawMin = Math.min(0, ...values);
    const rawMax = Math.max(0, ...values);
    const span = Math.max(rawMax - rawMin, 40);
    const minY = rawMin - span * 0.12;
    const maxY = rawMax + span * 0.12;
    const band = (box.right - box.left) / steps.length;
    const yScale = createLinearScale(minY, maxY, box.bottom, box.top);
    const tickCandidates = Array.from({ length: 5 }, (_, index) => rawMin + ((rawMax - rawMin) * index) / 4);
    const yTicks = [...new Set([rawMin, ...tickCandidates, 0, rawMax].map((value) => Number(value.toFixed(1))))].sort((left, right) => left - right);

    yTicks.forEach((tick) => {
      const y = yScale(tick);
      append(svg, svgEl("line", { x1: box.left, y1: y, x2: box.right, y2: y, class: "grid-line" }));
      append(svg, svgEl("text", { x: box.left - 10, y: y + 4, "text-anchor": "end", class: "axis-text" }, `${Math.round(tick)} bps`));
    });
    append(svg, svgEl("line", { x1: box.left, y1: yScale(0), x2: box.right, y2: yScale(0), class: "domain-line" }));

    steps.forEach((step, index) => {
      const value = values[index];
      const x = box.left + band * index + band * 0.18;
      const widthBar = band * 0.64;
      const y = value >= 0 ? yScale(value) : yScale(0);
      const heightBar = Math.abs(yScale(value) - yScale(0));
      append(svg, svgEl("rect", {
        x, y, width: widthBar, height: Math.max(heightBar, 1.5),
        fill: value >= 0 ? palette.amber : palette.rose, rx: 10, ry: 10
      }));
      append(svg, svgEl("text", {
        x: x + widthBar / 2, y: box.bottom + 18, "text-anchor": "middle", class: "axis-text"
      }, `${step.step}`));
      append(svg, svgEl("text", {
        x: x + widthBar / 2, y: value >= 0 ? y - 6 : y + heightBar + 14, "text-anchor": "middle", class: "axis-text"
      }, shortFactorLabel(step.added_factor)));
      append(svg, svgEl("text", {
        x: x + widthBar / 2, y: value >= 0 ? y - 20 : y + heightBar + 28, "text-anchor": "middle", class: "axis-text"
      }, `${value >= 0 ? "-" : "+"}${Math.round(Math.abs(value))} bps`));
    });

    drawNote(
      svg,
      box.left + 4,
      box.top + 2,
      palette.stone,
      "Positive bars mean the next sleeve lowered total portfolio volatility from the prior step. Negative bars mean it raised vol slightly in this sequence."
    );

    append(svg, svgEl("text", { x: box.left + (box.right - box.left) / 2, y: height - 16, "text-anchor": "middle", class: "axis-label" }, "Factor-addition step"));
    append(svg, svgEl("text", { x: 18, y: box.top + (box.bottom - box.top) / 2, "text-anchor": "middle", class: "axis-label", transform: `rotate(-90 18 ${box.top + (box.bottom - box.top) / 2})` }, "Change in annualized portfolio vol (bps)"));
  }

  function renderMacroDimensionChart() {
    const chart = makeSvg("macro-dimension-chart");
    if (!chart) return;
    const { svg, width, height } = chart;
    const box = { left: 56, right: width - 18, top: 12, bottom: height - 48 };
    const steps = macro.steps.map((step) => step.step);
    const dims = macro.steps.map((step) => step.effective_dimension);
    const xScale = createLinearScale(1, steps[steps.length - 1], box.left, box.right);
    const yScale = createLinearScale(1, Math.max(...dims) + 0.3, box.bottom, box.top);

    drawAxes(
      svg,
      box,
      steps,
      [1, 1.5, 2, 2.5, 3, 3.5],
      xScale,
      yScale,
      (value) => value,
      (value) => value.toFixed(1),
      "Sleeve-addition step",
      "Effective dimension"
    );

    const points = steps.map((step, index) => [xScale(step), yScale(dims[index])]);
    append(svg, svgEl("path", {
      d: linePath(points),
      fill: "none",
      stroke: palette.mint,
      "stroke-width": 3,
      "stroke-linejoin": "round",
      "stroke-linecap": "round"
    }));
    points.forEach((point) => append(svg, svgEl("circle", { cx: point[0], cy: point[1], r: 5, fill: palette.mint })));
  }

  function renderMacroHeatmap() {
    const chartHeight = Math.max(420, macro.selected_order.length * 34 + 96);
    const chart = makeSvg("macro-heatmap-chart", 920, chartHeight);
    if (!chart) return;
    const { svg, width, height } = chart;
    const labels = macro.selected_order;
    const matrix = macro.correlation_matrix;
    const left = 180;
    const top = 40;
    const size = Math.min(width - left - 24, height - top - 32);
    const cell = size / labels.length;

    function colorFor(value) {
      if (value >= 0) {
        const alpha = 0.16 + Math.abs(value) * 0.50;
        return `rgba(201, 124, 26, ${alpha.toFixed(3)})`;
      }
      const alpha = 0.16 + Math.abs(value) * 0.50;
      return `rgba(46, 111, 149, ${alpha.toFixed(3)})`;
    }

    labels.forEach((label, row) => {
      append(svg, svgEl("text", {
        x: left - 10,
        y: top + row * cell + cell / 2 + 4,
        "text-anchor": "end",
        class: "axis-text"
      }, shortFactorLabel(label)));
    });

    labels.forEach((label, col) => {
      append(svg, svgEl("text", {
        x: left + col * cell + cell / 2,
        y: 18,
        "text-anchor": "middle",
        class: "axis-text",
        transform: `rotate(-28 ${left + col * cell + cell / 2} 18)`
      }, shortFactorLabel(label)));
    });

    labels.forEach((rowLabel, row) => {
      labels.forEach((colLabel, col) => {
        const value = matrix[rowLabel][colLabel];
        const x = left + col * cell;
        const y = top + row * cell;
        append(svg, svgEl("rect", {
          x, y, width: cell - 2, height: cell - 2,
          fill: colorFor(value),
          stroke: "rgba(20, 54, 66, 0.08)",
          "stroke-width": 1,
          rx: 10,
          ry: 10
        }));
        append(svg, svgEl("text", {
          x: x + cell / 2 - 1,
          y: y + cell / 2 + 4,
          "text-anchor": "middle",
          class: "axis-text"
        }, value.toFixed(2)));
      });
    });
  }

  function renderMacroScreeChart() {
    const pca = macro.pca;
    const explained = pca.explained_variance_ratio.map((value) => value * 100);
    const cumulative = pca.cumulative_explained_variance_ratio.map((value) => value * 100);
    const chart = makeSvg("macro-scree-chart", 920, 340);
    if (!chart) return;
    const { svg, width, height } = chart;
    const box = { left: 56, right: width - 18, top: 16, bottom: height - 52 };
    const components = explained.map((_, index) => index + 1);
    const xScale = createLinearScale(1, components.length, box.left, box.right);
    const yScale = createLinearScale(0, 100, box.bottom, box.top);
    const band = (box.right - box.left) / components.length;

    drawAxes(
      svg,
      box,
      components,
      [0, 20, 40, 60, 80, 90, 95, 100],
      xScale,
      yScale,
      (value) => `PC${value}`,
      (value) => `${value}%`,
      "Principal component",
      "Variance explained"
    );

    components.forEach((component, index) => {
      const x = xScale(component) - band * 0.28;
      const y = yScale(explained[index]);
      append(svg, svgEl("rect", {
        x,
        y,
        width: band * 0.56,
        height: box.bottom - y,
        fill: palette.sea,
        rx: 8,
        ry: 8
      }));
    });

    const cumulativePoints = components.map((component, index) => [xScale(component), yScale(cumulative[index])]);
    append(svg, svgEl("path", {
      d: linePath(cumulativePoints),
      fill: "none",
      stroke: palette.amber,
      "stroke-width": 3,
      "stroke-linejoin": "round",
      "stroke-linecap": "round"
    }));
    cumulativePoints.forEach((point) => append(svg, svgEl("circle", { cx: point[0], cy: point[1], r: 4.5, fill: palette.amber })));

    [90, 95].forEach((threshold) => {
      append(svg, svgEl("line", {
        x1: box.left,
        y1: yScale(threshold),
        x2: box.right,
        y2: yScale(threshold),
        stroke: threshold === 90 ? palette.stone : palette.rose,
        "stroke-width": 1.2,
        "stroke-dasharray": "6 4"
      }));
    });
    drawNote(svg, xScale(pca.factors_for_95pct_variance) + 8, yScale(96), palette.rose, `95% by PC${pca.factors_for_95pct_variance}`);
  }

  function renderMacroLoadingsChart() {
    const pca = macro.pca;
    const components = pca.components.slice(0, 7);
    const sleeves = macro.selected_order;
    const chartHeight = 430;
    const chart = makeSvg("macro-loadings-chart", 1040, chartHeight);
    if (!chart) return;
    const { svg, width, height } = chart;
    const left = 220;
    const top = 42;
    const rightPad = 20;
    const bottomPad = 36;
    const cellWidth = (width - left - rightPad) / sleeves.length;
    const cellHeight = (height - top - bottomPad) / components.length;
    const maxAbs = Math.max(...components.flatMap((component) => sleeves.map((sleeve) => Math.abs(component.loadings[sleeve]))), 0.01);

    function colorFor(value) {
      const alpha = 0.12 + (Math.abs(value) / maxAbs) * 0.72;
      if (value >= 0) return `rgba(201, 124, 26, ${Math.min(alpha, 0.84).toFixed(3)})`;
      return `rgba(46, 111, 149, ${Math.min(alpha, 0.84).toFixed(3)})`;
    }

    sleeves.forEach((label, index) => {
      append(svg, svgEl("text", {
        x: left + index * cellWidth + cellWidth / 2,
        y: 18,
        "text-anchor": "middle",
        class: "axis-text",
        transform: `rotate(-28 ${left + index * cellWidth + cellWidth / 2} 18)`
      }, shortFactorLabel(label)));
    });

    components.forEach((component, rowIndex) => {
      append(svg, svgEl("text", {
        x: left - 12,
        y: top + rowIndex * cellHeight + cellHeight / 2 + 4,
        "text-anchor": "end",
        class: "axis-text"
      }, `${component.code} ${component.economic_label}`));
      sleeves.forEach((sleeve, colIndex) => {
        const value = component.loadings[sleeve];
        const x = left + colIndex * cellWidth;
        const y = top + rowIndex * cellHeight;
        append(svg, svgEl("rect", {
          x, y, width: cellWidth - 2, height: cellHeight - 2,
          fill: colorFor(value),
          stroke: "rgba(20, 54, 66, 0.08)",
          "stroke-width": 1,
          rx: 8,
          ry: 8
        }));
        append(svg, svgEl("text", {
          x: x + cellWidth / 2,
          y: y + cellHeight / 2 + 4,
          "text-anchor": "middle",
          class: "axis-text"
        }, value.toFixed(2)));
      });
    });
  }

  function renderMacroFactorRiskChart() {
    const factorErc = macro.pca.factor_erc;
    const labels = factorErc.factor_labels;
    const variance = labels.map((label) => factorErc.variance_share[label] * 100);
    const risk = labels.map((label) => factorErc.risk_contributions[label] * 100);
    const chart = makeSvg("macro-factor-risk-chart", 920, 340);
    if (!chart) return;
    const { svg, width, height } = chart;
    const box = { left: 56, right: width - 18, top: 16, bottom: height - 60 };
    const band = (box.right - box.left) / labels.length;
    const yScale = createLinearScale(0, Math.max(...variance, ...risk) + 8, box.bottom, box.top);

    [0, 10, 20, 30, 40, 50, 60].forEach((tick) => {
      const y = yScale(tick);
      append(svg, svgEl("line", { x1: box.left, y1: y, x2: box.right, y2: y, class: "grid-line" }));
      append(svg, svgEl("text", { x: box.left - 10, y: y + 4, "text-anchor": "end", class: "axis-text" }, `${tick}%`));
    });
    append(svg, svgEl("line", { x1: box.left, y1: box.bottom, x2: box.right, y2: box.bottom, class: "domain-line" }));

    labels.forEach((label, index) => {
      const center = box.left + band * index + band / 2;
      const rawY = yScale(variance[index]);
      const riskY = yScale(risk[index]);
      append(svg, svgEl("rect", {
        x: center - band * 0.26,
        y: rawY,
        width: band * 0.24,
        height: box.bottom - rawY,
        fill: "rgba(108, 122, 137, 0.45)",
        rx: 8,
        ry: 8
      }));
      append(svg, svgEl("rect", {
        x: center + band * 0.02,
        y: riskY,
        width: band * 0.24,
        height: box.bottom - riskY,
        fill: "rgba(201, 124, 26, 0.92)",
        rx: 8,
        ry: 8
      }));
      append(svg, svgEl("text", {
        x: center,
        y: box.bottom + 18,
        "text-anchor": "middle",
        class: "axis-text"
      }, label.replace(/^PC\d+\s/, "")));
    });

    append(svg, svgEl("text", { x: box.left + 10, y: box.top + 12, fill: palette.stone, "font-size": 11, "font-family": "Arial, sans-serif" }, "Gray = raw variance share"));
    append(svg, svgEl("text", { x: box.left + 160, y: box.top + 12, fill: palette.amber, "font-size": 11, "font-family": "Arial, sans-serif" }, "Amber = factor ERC risk share"));
    append(svg, svgEl("text", { x: box.left + (box.right - box.left) / 2, y: height - 16, "text-anchor": "middle", class: "axis-label" }, "Principal factor"));
    append(svg, svgEl("text", { x: 18, y: box.top + (box.bottom - box.top) / 2, "text-anchor": "middle", class: "axis-label", transform: `rotate(-90 18 ${box.top + (box.bottom - box.top) / 2})` }, "Share of total risk"));
  }

  function renderMacroFactorBacktestChart() {
    const backtests = macro.factor_backtests;
    const dates = backtests.dates;
    const seriesMap = backtests.series;
    const labels = Object.keys(seriesMap);
    const chart = makeSvg("macro-factor-backtest-chart", 760, 330);
    if (!chart) return;
    const { svg, width, height } = chart;
    const box = { left: 56, right: width - 18, top: 14, bottom: height - 48 };
    const xScale = createLinearScale(0, dates.length - 1, box.left, box.right);
    const allValues = labels.flatMap((label) => seriesMap[label]);
    const yScale = createLinearScale(Math.min(...allValues) * 0.96, Math.max(...allValues) * 1.03, box.bottom, box.top);
    const tickIndexes = [0, Math.floor((dates.length - 1) / 2), dates.length - 1];

    drawAxes(
      svg,
      box,
      tickIndexes,
      [80, 100, 120, 140, 160, 180, 200].filter((tick) => tick >= Math.floor(Math.min(...allValues) / 20) * 20 && tick <= Math.ceil(Math.max(...allValues) / 20) * 20),
      xScale,
      yScale,
      (value) => dates[value].slice(0, 4),
      (value) => `${Math.round(value)}`,
      "Common factor window",
      "Index level"
    );

    labels.forEach((label) => {
      const points = seriesMap[label].map((value, index) => [xScale(index), yScale(value)]);
      append(svg, svgEl("path", {
        d: linePath(points),
        fill: "none",
        stroke: label.includes("Best hindsight") ? palette.rose : palette.sea,
        "stroke-width": 3,
        "stroke-linejoin": "round",
        "stroke-linecap": "round"
      }));
    });

    labels.forEach((label, index) => {
      append(svg, svgEl("text", {
        x: box.left + 10,
        y: box.top + 14 + index * 16,
        fill: label.includes("Best hindsight") ? palette.rose : palette.sea,
        "font-size": 11,
        "font-family": "Arial, sans-serif"
      }, label.replace(" @ 16% vol", "")));
    });
  }

  function renderBetaCorrelationChart() {
    if (!beta || beta.mode === "unavailable") return;
    const labels = beta.fund_order;
    const benchmarks = beta.benchmark_order;
    const chartHeight = Math.max(520, labels.length * 28 + 110);
    const chart = makeSvg("beta-correlation-chart", 1320, chartHeight);
    if (!chart) return;
    const { svg, width, height } = chart;
    const left = 118;
    const top = 74;
    const rightPad = 24;
    const bottomPad = 34;
    const cellWidth = (width - left - rightPad) / benchmarks.length;
    const cellHeight = (height - top - bottomPad) / labels.length;

    function colorFor(value) {
      if (Number.isNaN(value)) {
        return "rgba(108, 122, 137, 0.12)";
      }
      if (value >= 0) {
        const alpha = 0.12 + Math.abs(value) * 0.56;
        return `rgba(201, 124, 26, ${alpha.toFixed(3)})`;
      }
      const alpha = 0.12 + Math.abs(value) * 0.56;
      return `rgba(46, 111, 149, ${alpha.toFixed(3)})`;
    }

    benchmarks.forEach((label, index) => {
      append(svg, svgEl("text", {
        x: left + index * cellWidth + cellWidth / 2,
        y: 28,
        "text-anchor": "middle",
        class: "axis-text",
        transform: `rotate(-28 ${left + index * cellWidth + cellWidth / 2} 28)`
      }, label));
    });

    labels.forEach((label, row) => {
      append(svg, svgEl("text", {
        x: left - 10,
        y: top + row * cellHeight + cellHeight / 2 + 4,
        "text-anchor": "end",
        class: "axis-text"
      }, label));
      benchmarks.forEach((benchmark, col) => {
        const value = beta.correlation_matrix[label][benchmark];
        const x = left + col * cellWidth;
        const y = top + row * cellHeight;
        append(svg, svgEl("rect", {
          x, y, width: cellWidth - 2, height: cellHeight - 2,
          fill: colorFor(value),
          stroke: "rgba(20, 54, 66, 0.08)",
          "stroke-width": 1,
          rx: 8,
          ry: 8
        }));
        append(svg, svgEl("text", {
          x: x + cellWidth / 2,
          y: y + cellHeight / 2 + 4,
          "text-anchor": "middle",
          class: "axis-text"
        }, Number.isNaN(value) ? "n/a" : value.toFixed(2)));
      });
    });
  }

  function renderBetaFactorAffinityChart() {
    if (!beta || beta.mode === "unavailable") return;
    const factorView = beta.fund_factor_view;
    const rows = factorView.rows;
    const factors = factorView.factor_order;
    const chartHeight = Math.max(520, rows.length * 28 + 110);
    const chart = makeSvg("beta-factor-affinity-chart", 980, chartHeight);
    if (!chart) return;
    const { svg, width, height } = chart;
    const left = 118;
    const top = 52;
    const rightPad = 24;
    const bottomPad = 34;
    const cellWidth = (width - left - rightPad) / factors.length;
    const cellHeight = (height - top - bottomPad) / rows.length;

    function colorFor(value) {
      if (value >= 0) {
        const alpha = 0.12 + Math.abs(value) * 0.56;
        return `rgba(201, 124, 26, ${alpha.toFixed(3)})`;
      }
      const alpha = 0.12 + Math.abs(value) * 0.56;
      return `rgba(46, 111, 149, ${alpha.toFixed(3)})`;
    }

    factors.forEach((label, index) => {
      append(svg, svgEl("text", {
        x: left + index * cellWidth + cellWidth / 2,
        y: 22,
        "text-anchor": "middle",
        class: "axis-text",
        transform: `rotate(-18 ${left + index * cellWidth + cellWidth / 2} 22)`
      }, label.replace(/^PC\d+\s/, "")));
    });

    rows.forEach((row, rowIndex) => {
      append(svg, svgEl("text", {
        x: left - 10,
        y: top + rowIndex * cellHeight + cellHeight / 2 + 4,
        "text-anchor": "end",
        class: "axis-text"
      }, row.ticker));
      factors.forEach((factor, colIndex) => {
        const value = row.factor_similarity[factor];
        const x = left + colIndex * cellWidth;
        const y = top + rowIndex * cellHeight;
        append(svg, svgEl("rect", {
          x, y, width: cellWidth - 2, height: cellHeight - 2,
          fill: colorFor(value),
          stroke: "rgba(20, 54, 66, 0.08)",
          "stroke-width": 1,
          rx: 8,
          ry: 8
        }));
        append(svg, svgEl("text", {
          x: x + cellWidth / 2,
          y: y + cellHeight / 2 + 4,
          "text-anchor": "middle",
          class: "axis-text"
        }, value.toFixed(2)));
      });
    });
  }

  function renderBetaWeightsChart() {
    if (!beta || beta.mode === "unavailable") return;
    const optimization = beta.optimization;
    const rows = optimization.display_asset_rows;
    const columns = optimization.portfolio_columns;
    const chartHeight = Math.max(480, rows.length * 30 + 170);
    const chart = makeSvg("beta-weights-chart", 920, chartHeight);
    if (!chart) return;
    const { svg, width, height } = chart;
    const left = 150;
    const top = 92;
    const rightPad = 24;
    const bottomPad = 44;
    const cellWidth = (width - left - rightPad) / columns.length;
    const cellHeight = (height - top - bottomPad) / rows.length;
    const maxWeight = Math.max(...rows.flatMap((row) => columns.map((column) => row[column.weight_column])), 0.01);
    const framework = optimization.framework;

    function colorFor(value) {
      const alpha = 0.08 + (Math.max(value, 0) / maxWeight) * 0.72;
      return `rgba(201, 124, 26, ${Math.min(alpha, 0.82).toFixed(3)})`;
    }

    append(svg, svgEl("rect", {
      x: 18,
      y: 12,
      width: width - 36,
      height: 58,
      fill: "rgba(20, 54, 66, 0.04)",
      stroke: "rgba(20, 54, 66, 0.10)",
      "stroke-width": 1,
      rx: 12,
      ry: 12
    }));
    append(svg, svgEl("text", {
      x: 30,
      y: 31,
      fill: palette.ink,
      "font-size": 11,
      "font-family": "Arial, sans-serif",
      "font-weight": "700"
    }, framework.objective_formula));
    append(svg, svgEl("text", {
      x: 30,
      y: 48,
      fill: palette.stone,
      "font-size": 10.5,
      "font-family": "Arial, sans-serif"
    }, `Risk model: ${framework.risk_model}`));
    append(svg, svgEl("text", {
      x: 30,
      y: 64,
      fill: palette.stone,
      "font-size": 10.5,
      "font-family": "Arial, sans-serif"
    }, `Constraints: ${framework.constraint_set.join(" | ")}`));

    columns.forEach((column, index) => {
      append(svg, svgEl("text", {
        x: left + index * cellWidth + cellWidth / 2,
        y: 76,
        "text-anchor": "middle",
        class: "axis-text"
      }, column.label.replace(" optimizer", "")));
    });

    rows.forEach((row, rowIndex) => {
      append(svg, svgEl("text", {
        x: left - 10,
        y: top + rowIndex * cellHeight + cellHeight / 2 + 4,
        "text-anchor": "end",
        class: "axis-text"
      }, row.asset_label));
      columns.forEach((column, colIndex) => {
        const value = row[column.weight_column];
        const x = left + colIndex * cellWidth;
        const y = top + rowIndex * cellHeight;
        append(svg, svgEl("rect", {
          x, y, width: cellWidth - 2, height: cellHeight - 2,
          fill: colorFor(value),
          stroke: "rgba(20, 54, 66, 0.08)",
          "stroke-width": 1,
          rx: 8,
          ry: 8
        }));
        append(svg, svgEl("text", {
          x: x + cellWidth / 2,
          y: y + cellHeight / 2 + 4,
          "text-anchor": "middle",
          class: "axis-text"
        }, value >= 0.005 ? value.toFixed(2) : ""));
      });
    });
  }

  function renderBetaGrowthChart() {
    if (!beta || beta.mode === "unavailable") return;
    const optimization = beta.optimization;
    const dates = optimization.accessible_growth_chart.dates;
    const seriesMap = optimization.accessible_growth_chart.series;
    const labels = Object.keys(seriesMap);
    const chart = makeSvg("beta-growth-chart", 760, 330);
    if (!chart) return;
    const { svg, width, height } = chart;
    const box = { left: 56, right: width - 18, top: 14, bottom: height - 48 };
    const xScale = createLinearScale(0, dates.length - 1, box.left, box.right);
    const allValues = labels.flatMap((label) => seriesMap[label]);
    const yScale = createLinearScale(Math.min(...allValues) * 0.96, Math.max(...allValues) * 1.03, box.bottom, box.top);
    const tickIndexes = [0, Math.floor((dates.length - 1) / 2), dates.length - 1];

    drawAxes(
      svg,
      box,
      tickIndexes,
      [100, 150, 200, 250, 300, 350, 400].filter((tick) => tick >= Math.floor(Math.min(...allValues) / 50) * 50 && tick <= Math.ceil(Math.max(...allValues) / 50) * 50),
      xScale,
      yScale,
      (value) => dates[value].slice(0, 4),
      (value) => `${Math.round(value)}`,
      "Common benchmark window",
      "Index level"
    );

      const colorMap = {
      "SPY baseline": palette.ink,
      "Constructed benchmark 1x": palette.sea,
      "Constructed benchmark 2x": "#5b8fb9",
      "Constructed benchmark 3x": palette.amber,
      "Retirement-cap optimizer": "#7b6d8d",
      "SPY + funds optimizer": palette.mint,
      "Funds-only optimizer": palette.rose,
    };

    labels.forEach((label) => {
      const points = seriesMap[label].map((value, index) => [xScale(index), yScale(value)]);
      append(svg, svgEl("path", {
        d: linePath(points),
        fill: "none",
        stroke: colorMap[label],
        "stroke-width": 3,
        "stroke-linejoin": "round",
        "stroke-linecap": "round"
      }));
    });

    labels.forEach((label, index) => {
      append(svg, svgEl("text", {
        x: box.left + 10,
        y: box.top + 14 + index * 16,
        fill: colorMap[label],
        "font-size": 11,
        "font-family": "Arial, sans-serif"
      }, label));
    });
  }

  function renderBetaFlagshipChart() {
    if (!beta || beta.mode === "unavailable") return;
    const comparison = beta.optimization.flagship_comparison;
    const dates = comparison.dates;
    const seriesMap = comparison.series;
    const labels = Object.keys(seriesMap);
    const chart = makeSvg("beta-flagship-chart", 760, 330);
    if (!chart) return;
    const { svg, width, height } = chart;
    const box = { left: 56, right: width - 18, top: 14, bottom: height - 48 };
    const xScale = createLinearScale(0, dates.length - 1, box.left, box.right);
    const allValues = labels.flatMap((label) => seriesMap[label]);
    const yScale = createLinearScale(Math.min(...allValues) * 0.96, Math.max(...allValues) * 1.03, box.bottom, box.top);
    const tickIndexes = [0, Math.floor((dates.length - 1) / 2), dates.length - 1];

    drawAxes(
      svg,
      box,
      tickIndexes,
      [90, 100, 110, 120, 130, 140, 150].filter((tick) => tick >= Math.floor(Math.min(...allValues) / 10) * 10 && tick <= Math.ceil(Math.max(...allValues) / 10) * 10),
      xScale,
      yScale,
      (value) => dates[value].slice(0, 7),
      (value) => `${Math.round(value)}`,
      "Short common overlap window",
      "Index level"
    );

    labels.forEach((label) => {
      const points = seriesMap[label].map((value, index) => [xScale(index), yScale(value)]);
      append(svg, svgEl("path", {
        d: linePath(points),
        fill: "none",
        stroke: betaColors[label] || palette.stone,
        "stroke-width": 3,
        "stroke-linejoin": "round",
        "stroke-linecap": "round"
      }));
    });

    labels.forEach((label, index) => {
      append(svg, svgEl("text", {
        x: box.left + 10 + (index % 2) * 170,
        y: box.top + 14 + Math.floor(index / 2) * 16,
        fill: betaColors[label] || palette.stone,
        "font-size": 11,
        "font-family": "Arial, sans-serif"
      }, label));
    });
  }

  function finalizeText() {
    const macroWindow = macro.start_date && macro.end_date
      ? `Rose proxy window: ${macro.start_date} to ${macro.end_date}.`
      : "Rose proxy window unavailable in fallback mode.";
    document.getElementById("build-stamp").textContent = `Generated ${analysis.generated_at_utc}. ${macroWindow}`;
  }

  renderHero();
  renderFacts();
  renderEquityAbsoluteChart();
  renderEquityBenefitChart();
  renderEquityMarginalChart();
  renderEquityDecompositionChart();
  renderMacroScreeChart();
  renderMacroLoadingsChart();
  renderMacroFactorRiskChart();
  renderMacroFactorBacktestChart();
  renderBetaCorrelationChart();
  renderBetaFactorAffinityChart();
  renderBetaWeightsChart();
  renderBetaGrowthChart();
  renderBetaFlagshipChart();
  finalizeText();
})();
