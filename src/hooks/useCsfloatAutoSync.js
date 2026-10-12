// Resolves CSFloat trades in Handle Items automatically: purchases are added
// to the portfolio at the CSFloat price and sales close the exact matching
// item. See planCsfloatAutoSync for the matching rules; anything it can't
// match with certainty stays in Handle Items.
import { useEffect, useRef } from 'react';
import { planCsfloatAutoSync, addPayloadFor } from '../utils/csfloatAutoSync';

export function useCsfloatAutoSync({ enabled, pending, items, addItemDirect, sellItemDirect, dismiss }) {
  const handledRef = useRef(new Set());

  useEffect(() => {
    // Wait for the portfolio to load: an add before that would be overwritten
    // by the load, and the pending entry would already be dismissed.
    if (!enabled) return;
    const { adds, sells } = planCsfloatAutoSync(pending, items, handledRef.current);
    if (adds.length === 0 && sells.length === 0) return;

    const added = [];
    for (const entry of adds) {
      handledRef.current.add(`incoming:${entry.assetid}`);
      if (addItemDirect(addPayloadFor(entry)) != null) added.push(entry.assetid);
    }
    const sold = [];
    for (const { entry, itemId } of sells) {
      handledRef.current.add(`outgoing:${entry.assetid}`);
      if (sellItemDirect(itemId, entry.csfloatPrice, 'csfloat')) sold.push(entry.assetid);
    }
    if (added.length) dismiss(added, 'incoming');
    if (sold.length) dismiss(sold, 'outgoing');
  }, [enabled, pending, items, addItemDirect, sellItemDirect, dismiss]);
}
