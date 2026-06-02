import type {
  AiAnalysis,
  Candle,
  EnrichedPosition,
  FundamentalSnapshot,
  PortfolioSummary,
  Position,
  TechnicalSnapshot,
} from '@/types';

export function enrichPositions(
  positions: Position[],
  currentPrice: number,
): EnrichedPosition[] {
  let cumShares = 0;
  let cumInvested = 0;

  return positions.map((position, index) => {
    const invested = position.shares * position.price + position.fees;
    cumShares += position.shares;
    cumInvested += invested;
    const averageCost = cumShares > 0 ? cumInvested / cumShares : 0;
    const marketValue = position.shares * currentPrice;
    const unrealized = marketValue - invested;
    const pctUnrealized = invested > 0 ? (unrealized / invested) * 100 : 0;

    return {
      ...position,
      lotNumber: index + 1,
      invested,
      cumShares,
      cumInvested,
      averageCost,
      marketValue,
      unrealized,
      pctUnrealized,
    };
  });
}

export function computePortfolioSummary(
  symbol: string,
  positions: EnrichedPosition[],
  currentPrice: number,
): PortfolioSummary | null {
  if (positions.length === 0) return null;

  const totalInvested = positions.reduce((sum, row) => sum + row.invested, 0);
  const totalShares = positions.reduce((sum, row) => sum + row.shares, 0);
  const averageCost = totalShares > 0 ? totalInvested / totalShares : 0;
  const marketValue = totalShares * currentPrice;
  const unrealized = marketValue - totalInvested;
  const pctProfitLoss = totalInvested > 0 ? (unrealized / totalInvested) * 100 : 0;

  let peak = 0;
  let maxDrawdown = 0;
  for (const row of positions) {
    const value = row.cumShares * currentPrice;
    if (value > peak) peak = value;
    if (peak > 0) maxDrawdown = Math.min(maxDrawdown, ((value - peak) / peak) * 100);
  }

  let worstLotLossPct = 0;
  let worstLotLossUsd = 0;
  let worstLotDate = '';
  let bestLotGainPct = 0;
  let bestLotDate = '';

  for (const row of positions) {
    const pct = row.pctUnrealized;
    if (pct < worstLotLossPct) {
      worstLotLossPct = pct;
      worstLotLossUsd = row.unrealized;
      worstLotDate = row.date;
    }
    if (pct > bestLotGainPct) {
      bestLotGainPct = pct;
      bestLotDate = row.date;
    }
  }

  const targetPrice = averageCost > 0 ? averageCost * 1.15 : currentPrice * 1.15;
  const targetUpsidePct = currentPrice > 0 ? ((targetPrice - currentPrice) / currentPrice) * 100 : 0;

  return {
    symbol,
    totalInvested,
    totalShares,
    averageCost,
    currentPrice,
    marketValue,
    unrealized,
    pctProfitLoss,
    maxDrawdown,
    worstLotLossPct,
    worstLotLossUsd,
    worstLotDate,
    bestLotGainPct,
    bestLotDate,
    targetPrice,
    targetUpsidePct,
  };
}

export function enrichCandles(candles: Candle[]): Candle[] {
  const closes = candles.map((row) => row.close);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = closes.map((_close, index) => {
    const fast = ema12[index] ?? null;
    const slow = ema26[index] ?? null;
    return fast === null || slow === null ? null : fast - slow;
  });
  const signal = ema(macdLine.map((value) => value ?? 0), 9);
  const rsi = rsi14(closes);

  return candles.map((row, index) => {
    const macd = macdLine[index] ?? null;
    const macdSignal = macd === null ? null : signal[index] ?? null;
    return {
      ...row,
      ma20: sma(closes, 20, index),
      ma50: sma(closes, 50, index),
      rsi14: rsi[index],
      macd,
      macdSignal,
      macdHist: macd !== null && macdSignal !== null ? macd - macdSignal : null,
    };
  });
}

export function summarizeTechnicals(candles: Candle[]): TechnicalSnapshot | null {
  const latest = candles.at(-1);
  if (!latest) return null;
  const last20 = candles.slice(-20);
  const support = Math.min(...last20.map((row) => row.low));
  const resistance = Math.max(...last20.map((row) => row.high));
  const maBullish = latest.ma20 !== null && latest.ma50 !== null && latest.ma20 !== undefined && latest.ma50 !== undefined
    ? latest.ma20 > latest.ma50 && latest.close > latest.ma20
    : false;
  const maBearish = latest.ma20 !== null && latest.ma50 !== null && latest.ma20 !== undefined && latest.ma50 !== undefined
    ? latest.ma20 < latest.ma50 && latest.close < latest.ma20
    : false;
  const macdBullish = (latest.macdHist ?? 0) > 0;
  const macdBearish = (latest.macdHist ?? 0) < 0;
  const rsi = latest.rsi14 ?? 50;

  const bullScore = Number(maBullish) + Number(macdBullish) + Number(rsi >= 45 && rsi <= 68);
  const bearScore = Number(maBearish) + Number(macdBearish) + Number(rsi > 72 || rsi < 38);
  const trend = bullScore > bearScore ? 'bullish' : bearScore > bullScore ? 'bearish' : 'neutral';
  const forecast = buildForecast(candles, latest.close, trend, rsi, latest.macdHist ?? 0);

  return {
    trend,
    rsiLabel: rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral',
    macdLabel: macdBullish ? 'Positive momentum' : macdBearish ? 'Negative momentum' : 'Flat',
    maLabel: maBullish ? 'Price above MA20/MA50' : maBearish ? 'Price below MA20/MA50' : 'Mixed moving averages',
    support,
    resistance,
    forecast,
    latest,
  };
}

export function buildAiAnalysis(
  symbol: string,
  technical: TechnicalSnapshot | null,
  summary: PortfolioSummary | null,
  fundamentals: FundamentalSnapshot | null = null,
): AiAnalysis {
  const latest = technical?.latest;
  const rsi = latest?.rsi14 ?? 50;
  const macdHist = latest?.macdHist ?? 0;
  const price = latest?.close ?? summary?.currentPrice ?? 0;
  const averageCost = summary?.averageCost ?? 0;

  const reasons: string[] = [];
  const technicalScore = scoreTechnical(technical);
  const fundamentalScore = scoreFundamentals(fundamentals);
  const valuationScore = scoreValuation(fundamentals, price);
  const analystScore = scoreAnalyst(fundamentals, price);
  const totalScore = Math.round(
    technicalScore * 0.35
    + fundamentalScore * 0.25
    + valuationScore * 0.20
    + analystScore * 0.20,
  );
  const signal: AiAnalysis['signal'] = totalScore >= 68 ? 'BUY' : totalScore <= 42 ? 'SELL' : 'HOLD';
  const confidence = Math.min(90, Math.max(45, Math.round(50 + Math.abs(totalScore - 50) * 0.8)));

  if (technical?.trend === 'bullish' && rsi < 70 && macdHist > 0) {
    reasons.push('Trend and MACD momentum are aligned to the upside.');
  } else if (technical?.trend === 'bearish' || rsi > 72) {
    reasons.push('Momentum is weakening or RSI is stretched for a swing setup.');
  } else {
    reasons.push('Signals are mixed, so confirmation is more important than chasing price.');
  }

  if (technical) {
    reasons.push(`${technical.maLabel}; RSI is ${rsi.toFixed(1)} (${technical.rsiLabel}).`);
    reasons.push(`Near-term support is around $${technical.support.toFixed(2)} and resistance is around $${technical.resistance.toFixed(2)}.`);
  }
  if (summary) {
    const spread = averageCost > 0 ? ((price - averageCost) / averageCost) * 100 : 0;
    reasons.push(`Portfolio average cost is $${averageCost.toFixed(2)}, current spread ${spread >= 0 ? '+' : ''}${spread.toFixed(2)}%.`);
  }
  if (fundamentals) {
    const targetSpread = fundamentals.priceTarget && price > 0 ? ((fundamentals.priceTarget - price) / price) * 100 : null;
    reasons.push(`${fundamentals.companyName}: ${fundamentals.rating} rating, ROE ${formatMaybePct(fundamentals.roe)}, FCF yield ${formatMaybePct(fundamentals.fcfYield)}.`);
    if (targetSpread !== null) {
      reasons.push(`Analyst 1M/quarter target proxy is ${targetSpread >= 0 ? '+' : ''}${targetSpread.toFixed(2)}% from spot (${fundamentals.analystCount} inputs).`);
    }
  }

  return {
    symbol,
    signal,
    confidence,
    totalScore,
    technicalScore,
    fundamentalScore,
    valuationScore,
    analystScore,
    summary: `${signal} bias from blended technical, fundamental, valuation, and analyst scoring for ${symbol}. Treat this as decision support, not financial advice.`,
    reasons,
    risk: technical
      ? `Invalidation zone: watch a decisive break below $${technical.support.toFixed(2)}.`
      : 'No technical history available, so position sizing should stay conservative.',
    swingSetup: signal === 'BUY'
      ? 'Look for pullback entries near MA20/support with a tight risk level.'
      : signal === 'SELL'
        ? 'Reduce exposure on failed bounces or weakness below support.'
        : 'Wait for price to reclaim momentum or approach support with improving volume.',
    generatedAt: new Date().toISOString(),
    fundamentals,
  };
}

function scoreTechnical(technical: TechnicalSnapshot | null): number {
  if (!technical?.latest) return 50;
  const rsi = technical.latest.rsi14 ?? 50;
  const macd = technical.latest.macdHist ?? 0;
  let score = technical.trend === 'bullish' ? 68 : technical.trend === 'bearish' ? 38 : 52;
  if (rsi < 30) score += 10;
  else if (rsi > 75) score -= 12;
  else if (rsi >= 45 && rsi <= 65) score += 5;
  score += macd > 0 ? 7 : macd < 0 ? -7 : 0;
  return clampScore(score);
}

function scoreFundamentals(f: FundamentalSnapshot | null): number {
  if (!f) return 50;
  let score = 50;
  if ((f.roe ?? 0) > 0.18) score += 14;
  else if ((f.roe ?? 0) > 0.08) score += 7;
  else if ((f.roe ?? 0) < 0.03) score -= 8;
  if ((f.roic ?? 0) > 0.12) score += 10;
  else if ((f.roic ?? 0) < 0.04) score -= 8;
  if ((f.currentRatio ?? 0) > 1.5) score += 5;
  if ((f.netDebtToEbitda ?? 99) < 1) score += 6;
  if (f.ratingScore >= 4) score += 8;
  else if (f.ratingScore <= 2) score -= 8;
  return clampScore(score);
}

function scoreValuation(f: FundamentalSnapshot | null, price: number): number {
  if (!f) return 50;
  let score = 50;
  if ((f.fcfYield ?? 0) > 0.04) score += 14;
  else if ((f.fcfYield ?? 0) > 0.015) score += 6;
  else if ((f.fcfYield ?? 0) < 0.005) score -= 10;
  if ((f.evToSales ?? 999) < 8) score += 8;
  else if ((f.evToSales ?? 0) > 18) score -= 10;
  if ((f.evToFcf ?? 999) < 35) score += 8;
  else if ((f.evToFcf ?? 0) > 70) score -= 8;
  if (f.priceTarget && price > 0) {
    const upside = (f.priceTarget - price) / price;
    if (upside > 0.15) score += 10;
    else if (upside < -0.10) score -= 10;
  }
  return clampScore(score);
}

function scoreAnalyst(f: FundamentalSnapshot | null, price: number): number {
  if (!f || !f.priceTarget || price <= 0) return 50;
  const upside = (f.priceTarget - price) / price;
  let score = 50 + upside * 120;
  if (f.analystCount >= 15) score += 6;
  else if (f.analystCount <= 3) score -= 5;
  return clampScore(score);
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function formatMaybePct(value: number | null): string {
  return value === null ? 'n/a' : `${(value * 100).toFixed(2)}%`;
}

function sma(values: number[], window: number, index: number): number | null {
  if (index + 1 < window) return null;
  const slice = values.slice(index + 1 - window, index + 1);
  return slice.reduce((sum, value) => sum + value, 0) / window;
}

function buildForecast(
  candles: Candle[],
  currentPrice: number,
  trend: TechnicalSnapshot['trend'],
  rsi: number,
  macdHist: number,
) {
  const lookback = candles.slice(-30);
  const first = lookback.at(0)?.close ?? currentPrice;
  const last = lookback.at(-1)?.close ?? currentPrice;
  const momentum30 = first > 0 ? (last - first) / first : 0;
  const rsiAdjustment = rsi < 30 ? 0.025 : rsi > 70 ? -0.025 : 0;
  const macdAdjustment = macdHist > 0 ? 0.015 : macdHist < 0 ? -0.015 : 0;
  const trendAdjustment = trend === 'bullish' ? 0.025 : trend === 'bearish' ? -0.025 : 0;
  const monthlyReturn = clamp(momentum30 * 0.45 + rsiAdjustment + macdAdjustment + trendAdjustment, -0.18, 0.18);
  return ([1, 3, 6] as const).map((months) => {
    const price = currentPrice * Math.pow(1 + monthlyReturn, months);
    return {
      horizon: `${months}M` as '1M' | '3M' | '6M',
      price,
      changePct: currentPrice > 0 ? ((price - currentPrice) / currentPrice) * 100 : 0,
      confidence: Math.max(35, Math.round(72 - months * 5 - Math.abs(monthlyReturn) * 50)),
    };
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function ema(values: number[], window: number): Array<number | null> {
  const k = 2 / (window + 1);
  const out: Array<number | null> = [];
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    const value = values[i]!;
    if (i + 1 < window) {
      out.push(null);
      continue;
    }
    if (prev === null) {
      prev = values.slice(i + 1 - window, i + 1).reduce((sum, row) => sum + row, 0) / window;
    } else {
      prev = value * k + prev * (1 - k);
    }
    out.push(prev);
  }
  return out;
}

function rsi14(values: number[]): Array<number | null> {
  const out: Array<number | null> = Array(values.length).fill(null);
  if (values.length < 15) return out;
  for (let i = 14; i < values.length; i++) {
    let gain = 0;
    let loss = 0;
    for (let j = i - 13; j <= i; j++) {
      const diff = values[j]! - values[j - 1]!;
      if (diff >= 0) gain += diff;
      else loss -= diff;
    }
    const avgGain = gain / 14;
    const avgLoss = loss / 14;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}
