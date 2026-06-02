export const fmtInt = (n: number): string => Math.round(n).toLocaleString('en-US');

export const fmtUsd = (n: number, d = 2): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmtThb = fmtUsd;

export const fmtPct = (n: number, d = 2): string =>
  (n >= 0 ? '+' : '') + n.toFixed(d) + '%';

export const fmtShares = (n: number): string =>
  n.toLocaleString('en-US', { maximumFractionDigits: 6 });

export const fmtDateShort = (yyyyMmDd: string): string => {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  return date.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
};
