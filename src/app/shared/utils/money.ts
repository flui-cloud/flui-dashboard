const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: string): Intl.NumberFormat | null {
  let formatter = formatters.get(currency);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch {
      return null;
    }
    formatters.set(currency, formatter);
  }
  return formatter;
}

/** Every amount of money the same way: the currency and two decimals, whatever precision the API sent. */
export function formatMoney(
  value: number | string | null | undefined,
  currency = 'EUR',
): string {
  if (value === null || value === undefined || value === '') return '—';
  const amount = typeof value === 'number' ? value : Number.parseFloat(value);
  if (!Number.isFinite(amount)) return '—';
  return formatterFor(currency)?.format(amount) ?? `${amount.toFixed(2)} ${currency}`;
}

/** A monthly amount, as prices are quoted in the catalogue. */
export function formatMonthly(
  value: number | string | null | undefined,
  currency = 'EUR',
): string {
  const money = formatMoney(value, currency);
  return money === '—' ? money : `${money}/mo`;
}
