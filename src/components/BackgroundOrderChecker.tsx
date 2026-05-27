import { useEffect, useMemo, useRef } from 'react';
import { useConditionalOrderStore } from '../stores/conditionalOrderStore';
import { usePortfolioStore } from '../stores/portfolioStore';
import { useQuotes } from '../hooks/useStockData';
import { canTrade } from '../utils/marketHours';

/**
 * Runs at App level. Continuously checks pending conditional orders
 * against live quotes and executes them when triggers fire.
 * Works regardless of which page the user is viewing.
 */
export default function BackgroundOrderChecker() {
  const orders = useConditionalOrderStore((s) => s.orders);
  const markExecuted = useConditionalOrderStore((s) => s.markExecuted);
  const buy = usePortfolioStore((s) => s.buy);
  const sell = usePortfolioStore((s) => s.sell);

  // Symbols that need quote monitoring
  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status === 'pending'),
    [orders]
  );

  const watchSymbols = useMemo(
    () => [...new Set(pendingOrders.map((o) => o.symbol))],
    [pendingOrders]
  );

  // Fetch quotes for watched symbols (15s refresh for faster trigger detection)
  const { quotes } = useQuotes(watchSymbols, 15_000);

  const quoteMap = useMemo(() => {
    const m: Record<string, typeof quotes[0]> = {};
    quotes.forEach((q) => { m[q.symbol] = q; });
    return m;
  }, [quotes]);

  // Track market open/close state per symbol to detect transition
  const marketWasOpen = useRef<Record<string, boolean>>({});

  // Check and execute triggers
  useEffect(() => {
    if (pendingOrders.length === 0) return;

    pendingOrders.forEach((order) => {
      const marketStatus = canTrade(order.symbol);
      const isOpen = marketStatus.ok;
      const wasOpen = marketWasOpen.current[order.symbol] ?? false;

      // Update tracking
      marketWasOpen.current[order.symbol] = isOpen;

      // All orders require market to be open
      if (!isOpen) return;

      const q = quoteMap[order.symbol];
      const price = q?.regularMarketPrice ?? 0;
      if (price <= 0) return;

      let shouldExecute = false;

      if (order.triggerType === 'market_open') {
        // Execute on market transition: closed → open (market just opened)
        // If market was already open when order created, wait for next open session
        shouldExecute = !wasOpen;
      } else if (order.triggerType === 'price_le') {
        shouldExecute = price <= order.triggerPrice;
      } else if (order.triggerType === 'price_ge') {
        shouldExecute = price >= order.triggerPrice;
      }

      if (!shouldExecute) return;

      // Execute trade
      if (order.type === 'buy') {
        const cost = order.shares * price;
        const currentBalance = usePortfolioStore.getState().balance;
        if (cost <= currentBalance) {
          const ok = buy(order.symbol, order.shares, price);
          if (ok) markExecuted(order.id, price);
        }
      } else {
        const currentHoldings = usePortfolioStore.getState().holdings;
        const holding = currentHoldings.find((h) => h.symbol === order.symbol);
        if (holding && holding.shares >= order.shares) {
          const ok = sell(order.symbol, order.shares, price);
          if (ok) markExecuted(order.id, price);
        }
      }
    });
  }, [pendingOrders, quoteMap, buy, sell, markExecuted]);

  return null;
}
