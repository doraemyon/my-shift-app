import {mkdir, readFile, rename, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fetchHolidayYear} from './holiday-source.mjs';

const currentYear = Number(new Intl.DateTimeFormat('en', {
  timeZone: 'Asia/Seoul', year: 'numeric',
}).format(new Date()));
const years = Array.from({length: 5}, (_, index) => currentYear - 2 + index);
const directory = resolve('holidays');
const retrievedOn = new Date().toISOString().slice(0, 10);
await mkdir(directory, {recursive: true});

for (const year of years) {
  const data = await fetchHolidayYear(year, process.env.KASI_SERVICE_KEY);
  if (!data) {
    if (year <= currentYear) throw new Error('Official holidays are unavailable for ' + year + '.');
    console.log('Official holidays for ' + year + ' have not been published yet.');
    continue;
  }
  const path = resolve(directory, year + '.json');
  const content = JSON.stringify({...data, retrievedOn}, null, 2) + '\n';
  let previous;
  try {
    previous = await readFile(path, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (content !== previous) {
    await writeFile(path + '.tmp', content);
    await rename(path + '.tmp', path);
  }
  console.log(year + ': checked ' + Object.keys(data.days).length + ' official holidays.');
}
