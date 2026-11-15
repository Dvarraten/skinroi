// Add page: everything the user records by hand. Two tabs: an item they
// bought, or a deposit / withdrawal that isn't tied to one skin.
import React, { useState } from "react";
import PageHeader, { Page } from "../components/PageHeader";
import AddItemPage from "./AddItemPage";
import TransactionPage from "./TransactionPage";

const TABS = [
  { key: "item", label: "Item" },
  { key: "transaction", label: "Deposit or withdrawal" },
];

export default function AddPage({ theme, items, onAddTransaction, ...itemProps }) {
  const [tab, setTab] = useState("item");
  return (
    <Page width="max-w-5xl">
      <PageHeader
        theme={theme}
        title="Add"
        hint="Trades made on Steam show up under Trades by themselves. Use this for everything else."
      >
        <div className={`flex rounded-lg border p-0.5 ${theme.cardBorder}`} role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 h-8 rounded-md text-[13px] font-medium transition-colors ${
                tab === t.key ? theme.navActive : `${theme.subtext} ${theme.textHover}`
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </PageHeader>
      {tab === "item"
        ? <AddItemPage theme={theme} items={items} {...itemProps} />
        : <TransactionPage theme={theme} items={items} onAdd={onAddTransaction} />}
    </Page>
  );
}
