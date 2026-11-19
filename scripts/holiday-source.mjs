export const holidaySource = 'https://www.data.go.kr/data/15012690/openapi.do';
const upstream = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo';

export function parseKasiHolidays(payload, year) {
  const result = payload?.response;
  if (String(result?.header?.resultCode).padStart(2, '0') !== '00') {
    throw new Error('The official holiday service returned an error.');
  }
  const raw = result.body?.items?.item;
  const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (!rows.length && Number(result.body?.totalCount) === 0) return null;
  if (Number(result.body?.totalCount) !== rows.length) {
    throw new Error('The annual holiday response is incomplete.');
  }
  const days = {};
  for (const row of rows) {
    if (row.isHoliday !== 'Y') continue;
    const date = String(row.locdate);
    const key = date.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
    const parsed = new Date(key + 'T00:00:00Z');
    if (!/^\d{8}$/.test(date) || !key.startsWith(year + '-') ||
        !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== key ||
        typeof row.dateName !== 'string' || !row.dateName.trim()) {
      throw new Error('The official holiday service returned an invalid date.');
    }
    const name = row.dateName.trim();
    days[key] = days[key] && days[key] !== name ? days[key] + ' · ' + name : name;
  }
  if (Object.keys(days).length < 8) throw new Error('The annual holiday list is unexpectedly short.');
  return {year, days, source: holidaySource};
}

export async function fetchHolidayYear(year, key, fetcher = fetch) {
  if (!key?.trim()) throw new Error('The server holiday credential is missing.');
  const url = new URL(upstream);
  url.search = new URLSearchParams({
    ServiceKey: key.trim(), solYear: String(year), numOfRows: '100', _type: 'json',
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetcher(url, {signal: AbortSignal.timeout(15000), redirect: 'error'});
      if (!response.ok) throw new Error('The official holiday service is temporarily unavailable.');
      return parseKasiHolidays(await response.json(), year);
    } catch {
      if (attempt === 2) throw new Error('Could not refresh official holidays for ' + year + '.');
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}
