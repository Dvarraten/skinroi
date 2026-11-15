// Which page is open, kept in the URL hash (#/snipes, #/handle-items, …) so
// reload, the browser's back / forward buttons and bookmarks all work. Hash
// routes need no server rewrites and survive the Steam login redirect.
// Home has no hash.
import { useCallback, useEffect, useState } from 'react';

export const PAGE_SLUGS = {
  addItem: 'add-item',
  handleItems: 'handle-items',
  transactions: 'transactions',
  snipes: 'snipes',
  analytics: 'analytics',
  about: 'about',
};

function pageFromLocation() {
  const slug = window.location.hash.replace(/^#\/?/, '');
  return Object.keys(PAGE_SLUGS).find((key) => PAGE_SLUGS[key] === slug) || null;
}

export function usePageRoute() {
  const [page, setPage] = useState(pageFromLocation);

  useEffect(() => {
    const sync = () => setPage(pageFromLocation());
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  // navigate(null) goes Home.
  const navigate = useCallback((name) => {
    const next = PAGE_SLUGS[name] ? name : null;
    if (next === pageFromLocation()) { setPage(next); return; }
    const url = `${window.location.pathname}${window.location.search}${next ? `#/${PAGE_SLUGS[next]}` : ''}`;
    window.history.pushState(null, '', url);
    setPage(next);
  }, []);

  return [page, navigate];
}
