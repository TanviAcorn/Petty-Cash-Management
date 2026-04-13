import { useState, useMemo } from 'react';

/**
 * Returns sorted items + a toggle function + current direction.
 * @param {Array} items - array of objects or strings
 * @param {string} key - object key to sort by (default: 'name')
 */
export default function useSortedItems(items = [], key = 'name') {
  const [asc, setAsc] = useState(true);
  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const av = String(typeof a === 'string' ? a : (a[key] || '')).toLowerCase();
      const bv = String(typeof b === 'string' ? b : (b[key] || '')).toLowerCase();
      return asc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [items, asc, key]);
  return { sorted, asc, toggle: () => setAsc(p => !p) };
}
