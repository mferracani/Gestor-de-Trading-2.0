export function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getAssetClass(symbol = '') {
  const normalized = String(symbol).toUpperCase().replace(/\.RAW$/, '');

  if (['XAUUSD', 'XAGUSD'].includes(normalized)) return 'metals';
  if (['USOIL', 'UKOIL'].includes(normalized)) return 'oil';
  if (['NAS100', 'US30', 'US500', 'GER30', 'UK100', 'HK50', 'JPN225', 'EUSTX50'].includes(normalized)) return 'indices';
  if (/^[A-Z]{6}$/.test(normalized)) return 'forex';

  return 'other';
}

export function inferCommissionProfile(account = {}) {
  if (account.commission_profile) return account.commission_profile;

  const broker = String(account.broker || '').toLowerCase();
  if (broker.includes('alpha capital')) return 'alpha_raw';

  return 'none';
}

export function getCommissionPerSide(account = {}) {
  if (account.commission_per_side_usd != null) return toNumber(account.commission_per_side_usd);
  if (inferCommissionProfile(account) === 'alpha_raw') return 2.5;
  return 0;
}

export function estimateTradeCommission(trade = {}, account = {}) {
  const profile = inferCommissionProfile(account);
  if (profile === 'none') return 0;

  const assetClass = getAssetClass(trade.activo);
  if (profile === 'alpha_raw' && assetClass === 'indices') return 0;

  const lots = toNumber(trade.lotes);
  if (lots <= 0) return 0;

  const perSide = getCommissionPerSide(account);
  return lots * perSide * 2;
}

export function getTradeCommission(trade = {}) {
  return Math.abs(toNumber(trade.comision_usd));
}

export function getTradeSwap(trade = {}) {
  return toNumber(trade.swap_usd);
}

export function getTradeGrossPnl(trade = {}) {
  if (trade.gross_pnl_usd != null) return toNumber(trade.gross_pnl_usd);
  return toNumber(trade.pnl_usd);
}

export function getTradeNetPnl(trade = {}) {
  if (trade.net_pnl_usd != null) return toNumber(trade.net_pnl_usd);
  return getTradeGrossPnl(trade) + getTradeSwap(trade) - getTradeCommission(trade);
}

export function buildTradeFinancials(trade = {}, account = null) {
  const grossPnl = getTradeGrossPnl(trade);
  const hasManualCommission = trade.comision_usd !== '' && trade.comision_usd != null;
  const estimatedCommission = account ? estimateTradeCommission(trade, account) : 0;
  const commission = hasManualCommission ? getTradeCommission(trade) : estimatedCommission;
  const swap = getTradeSwap(trade);
  const netPnl = grossPnl + swap - commission;

  return {
    grossPnl,
    commission,
    estimatedCommission,
    commissionSource: hasManualCommission ? 'manual' : estimatedCommission > 0 ? 'auto' : 'none',
    swap,
    netPnl,
  };
}
