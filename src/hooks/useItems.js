// Central portfolio state — loads items from the API (logged in) or
// localStorage (guest), auto-saves on change with a debounce, and exposes
// add / sell / delete / promote-pending mutations plus the add-item form state.
import { useState, useEffect, useRef } from 'react';
import { getPlatformFee } from '../utils/platformFees';

export const useItems = (steamId) => {
  const [items, setItems] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const saveTimerRef = useRef(null);
  const [formData, setFormData] = useState({
    itemName: '',
    purchasePrice: '',
    notes: '',
    platform: 'csfloat',
    customFee: '',
    quantity: 1,
    pending: false,
    expectedDelivery: '',
    iconUrl: null,
  });
  const [sellData, setSellData] = useState({});
  const [sellPlatform, setSellPlatform] = useState({});

  // Load items — from API when logged in, localStorage otherwise
  useEffect(() => {
    setIsLoaded(false);
    if (steamId) {
      fetch('/api/items')
        .then(r => r.json())
        .then(({ items, firstLogin }) => {
          if (firstLogin) {
            // Key never written — migrate any existing localStorage items so
            // they aren't lost when the user logs in for the first time.
            try {
              const local = localStorage.getItem('cs2-trading-items');
              const localItems = local ? JSON.parse(local) : [];
              setItems(Array.isArray(localItems) ? localItems : []);
            } catch {
              setItems([]);
            }
          } else {
            setItems(Array.isArray(items) ? items : []);
          }
          setIsLoaded(true);
        })
        .catch(() => setIsLoaded(true));
    } else {
      try {
        const saved = localStorage.getItem('cs2-trading-items');
        if (saved) setItems(JSON.parse(saved));
      } catch {}
      setIsLoaded(true);
    }
  }, [steamId]);

  // Save items — API (debounced) when logged in, localStorage otherwise
  useEffect(() => {
    if (!isLoaded) return;
    if (steamId) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        fetch('/api/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        }).catch(() => {});
      }, 1500);
      return () => clearTimeout(saveTimerRef.current);
    } else {
      try {
        localStorage.setItem('cs2-trading-items', JSON.stringify(items));
      } catch {}
    }
  }, [items, isLoaded, steamId]);

  const handleAddItem = () => {
    if (!formData.itemName || !formData.purchasePrice) return;

    const purchaseDate = new Date();
    const quantity = Math.max(1, parseInt(formData.quantity) || 1);
    const isPending = !!formData.pending;
    // Default expected delivery = exactly 7 days (168 hours) — Steam trade protection window.
    const expectedDelivery = isPending
      ? formData.expectedDelivery
        ? new Date(formData.expectedDelivery).getTime()
        : Date.now() + 7 * 24 * 60 * 60 * 1000
      : null;

    const newItems = Array.from({ length: quantity }, (_, i) => ({
      id: Date.now() + i,
      itemName: formData.itemName,
      purchasePrice: parseFloat(formData.purchasePrice),
      notes: formData.notes,
      datePurchased: purchaseDate.toISOString().split('T')[0],
      sold: false,
      salePrice: null,
      platform: formData.platform,
      profit: null,
      profitPercent: null,
      pending: isPending,
      expectedDelivery,
      iconUrl: formData.iconUrl || null,
    }));

    setItems([...newItems, ...items]);
    setFormData({
      itemName: '', purchasePrice: '', notes: '', platform: 'csfloat',
      quantity: 1, pending: false, expectedDelivery: '', iconUrl: null, customFee: '',
    });
  };

  const handleSellItem = (id, platform, customFee) => {
    const salePrice = parseFloat(sellData[id]);
    if (!salePrice || salePrice <= 0) return;

    const fee = getPlatformFee(platform, customFee);
    const now = Date.now();

    setItems(items.map(item => {
      if (item.id === id) {
        const netSalePrice = salePrice * (1 - fee);
        const profit = netSalePrice - item.purchasePrice;
        const profitPercent = (profit / item.purchasePrice) * 100;

        return {
          ...item,
          sold: true,
          salePrice,
          soldPlatform: platform,
          profit,
          profitPercent,
          dateSold: new Date(now).toISOString().split('T')[0],
          // Full epoch ms so multiple sells on the same day sort
          // correctly in Recent Sales / by-profit views.
          soldAt: now,
        };
      }
      return item;
    }));

    setSellData({ ...sellData, [id]: '' });
  };

  const handleDeleteItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  // ── Direct (non-form) helpers used by the Steam-sync "Handle Items" modal.
  // These bypass the controlled formData / sellData state so we can drive
  // them imperatively from outside the form components.
  const addItemDirect = ({
    itemName, purchasePrice, platform = 'csfloat', notes = '',
    iconUrl = null, pending = false, expectedDelivery = null,
  }) => {
    if (!itemName || !purchasePrice) return null;
    const newItem = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      itemName,
      purchasePrice: parseFloat(purchasePrice),
      notes,
      datePurchased: new Date().toISOString().split('T')[0],
      sold: false,
      salePrice: null,
      platform,
      profit: null,
      profitPercent: null,
      pending,
      expectedDelivery,
      iconUrl,
    };
    setItems(prev => [newItem, ...prev]);
    return newItem.id;
  };

  // Promote a pending purchase to active (when the trade hold ends or the
  // Steam sync sees the item land in the inventory). Updates iconUrl if the
  // sync gave us one, since manual adds may not have had it.
  const promotePendingItem = (id, { iconUrl } = {}) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      return {
        ...item,
        pending: false,
        expectedDelivery: null,
        // Refresh datePurchased to reflect actual delivery for accurate
        // hold-time history.
        datePurchased: new Date().toISOString().split('T')[0],
        iconUrl: iconUrl || item.iconUrl || null,
      };
    }));
  };

  const handleAddTransaction = ({ type, platform, amount, feePercent }) => {
    const feeAmt = Math.round(amount * feePercent / 100 * 100) / 100;
    const now = Date.now();
    const PLATFORM_LABELS = {
      buff163: 'Buff163', csfloat: 'CSFloat', csmoney: 'CS.MONEY',
      skinswap: 'SkinSwap', dmarket: 'DMarket', youpin: 'Youpin', skins: 'Skins.com',
    };
    const platformLabel = PLATFORM_LABELS[platform] || platform;
    const newItem = {
      id: now,
      itemName: `${platformLabel} ${type === 'deposit' ? 'Deposit' : 'Withdrawal'}`,
      purchasePrice: 0,
      salePrice: 0,
      profit: -feeAmt,
      profitPercent: -feePercent,
      sold: true,
      soldAt: now,
      dateSold: new Date(now).toISOString().split('T')[0],
      datePurchased: new Date(now).toISOString().split('T')[0],
      platform,
      notes: '',
      pending: false,
      isTransaction: true,
      transactionType: type,
      transactionAmount: amount,
      transactionFeePercent: feePercent,
      iconUrl: null,
    };
    setItems(prev => [newItem, ...prev]);
  };

  // Bulk delete by IDs (used by the select-mode toolbar).
  const handleBulkDelete = (ids) => {
    if (!ids || ids.length === 0) return;
    const toRemove = new Set(ids);
    setItems(prev => prev.filter(item => !toRemove.has(item.id)));
  };

  const sellItemDirect = (id, salePrice, platform = 'csfloat', customFee) => {
    const price = parseFloat(salePrice);
    if (!price || price <= 0) return false;
    const fee = getPlatformFee(platform, customFee);
    const now = Date.now();
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const netSalePrice = price * (1 - fee);
      const profit = netSalePrice - item.purchasePrice;
      const profitPercent = (profit / item.purchasePrice) * 100;
      return {
        ...item,
        sold: true,
        salePrice: price,
        soldPlatform: platform,
        profit,
        profitPercent,
        dateSold: new Date(now).toISOString().split('T')[0],
        soldAt: now,
      };
    }));
    return true;
  };

  return {
    items,
    setItems,
    formData,
    setFormData,
    sellData,
    setSellData,
    sellPlatform,
    setSellPlatform,
    handleAddItem,
    handleSellItem,
    handleDeleteItem,
    addItemDirect,
    sellItemDirect,
    promotePendingItem,
    handleBulkDelete,
    handleAddTransaction,
  };
};