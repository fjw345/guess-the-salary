import cityCatalog from '../data/cities.json' with { type: 'json' };
import { searchCatalog } from './catalog-search.js';
import type { CityRecord } from './types.js';

export const knownCities = cityCatalog as CityRecord[];

export function searchCities(query: string, cities = knownCities, limit = 8): CityRecord[] {
  return searchCatalog(query, cities, (city) => [city.province], limit);
}
