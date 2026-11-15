// Add page: everything the user records by hand. Two tabs: an item they
// bought, or a deposit / withdrawal that isn't tied to one skin.
import React, { useState } from "react";
import PageHeader, { Page } from "../components/PageHeader";
import { Segmented } from "../components/ui";
import AddItemPage from "./AddItemPage";
import TransactionPage from "./TransactionPage";

const TABS = [
  { value: "item", label: "Item" },
  { value: "transaction", label: "Deposit or withdrawal" },
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
        <Segmented theme={theme} value={tab} onChange={setTab} options={TABS} ariaLabel="What to add" />
      </PageHeader>
      {tab === "item"
        ? <AddItemPage theme={theme} items={items} {...itemProps} />
        : <TransactionPage theme={theme} items={items} onAdd={onAddTransaction} />}
    </Page>
  );
}
