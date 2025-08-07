import { supabase } from '../../supabaseClient';
import React, { useState, useEffect } from 'react';
import {
  FaMoneyCheckAlt, FaFileInvoiceDollar, FaClipboardList,
  FaBook, FaBoxes, FaArrowLeft
} from "react-icons/fa";

import AccountPayable from '../Finance/AccountPayable';
import AccountReceivables from '../Finance/AccountReceivables';
import FinancialReports from '../Finance/FinancialReports';
import GeneralLedger from '../Finance/GeneralLedger';
import InventoryValuations from '../Finance/InventoryValuations';

const financeTools = [
  {
    key: "payables",
    label: "Account Payable",
    icon: <FaMoneyCheckAlt className="text-2xl sm:text-5xl text-indigo-600" />,
    desc: "Track and manage your outstanding payments",
    component: <AccountPayable />,
  },
  {
    key: "receivables",
    label: "Account Receivables",
    icon: <FaFileInvoiceDollar className="text-2xl sm:text-5xl text-indigo-600" />,
    desc: "Monitor payments owed to your business",
    component: <AccountReceivables />,
  },
  {
    key: "reports",
    label: "Financial Reports",
    icon: <FaClipboardList className="text-2xl sm:text-5xl text-indigo-600" />,
    desc: "View profit & loss, balance sheet, and cash flow",
    component: <FinancialReports />,
  },
  {
    key: "ledger",
    label: "General Ledger",
    icon: <FaBook className="text-2xl sm:text-5xl text-indigo-600" />,
    desc: "Access all financial transactions in one place",
    component: <GeneralLedger />,
  },
  {
    key: "valuation",
    label: "Inventory Valuations",
    icon: <FaBoxes className="text-2xl sm:text-5xl text-indigo-600" />,
    desc: "Evaluate your stock's financial worth over time",
    component: <InventoryValuations />,
  },
];

export default function Finance() {
  const [shopName, setShopName] = useState('Store');
  const [activeTool, setActiveTool] = useState('');

  useEffect(() => {
    const storeId = localStorage.getItem('store_id');
    if (storeId) {
      supabase
        .from('stores')
        .select('shop_name')
        .eq('id', storeId)
        .single()
        .then(({ data, error }) => {
          if (!error && data?.shop_name) {
            setShopName(data.shop_name);
          }
        });
    }
  }, []);

  const tool = financeTools.find(t => t.key === activeTool);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 w-full">
      <header className="text-center mb-4 sm:mb-6">
        <h1 className="text-lg sm:text-3xl font-bold text-indigo-800 dark:text-white">
          Finance Dashboard for {shopName}
        </h1>
        {!activeTool && (
          <p className="text-gray-600 dark:text-gray-400 mt-2 text-xs sm:text-sm">
            Manage payables, receivables, reports, and valuations.
          </p>
        )}
      </header>

      {/* Tool Info and Content */}
      {activeTool ? (
        <div className="mb-4 sm:mb-6">
          <button
            onClick={() => setActiveTool(null)}
            className="flex items-center text-indigo-600 hover:text-indigo-800 mb-4 text-xs sm:text-base"
          >
            <FaArrowLeft className="mr-2" /> Back to Finance Tools
          </button>
          <h2 className="text-lg sm:text-2xl font-semibold text-indigo-800 dark:text-indigo-200">
            {tool.label}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">{tool.desc}</p>
          <div className="w-full mt-4">
            {React.cloneElement(tool.component, { setActiveTool })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
          {financeTools.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTool(t.key)}
              className="flex flex-col items-center justify-center bg-white dark:bg-gray-800 p-3 sm:p-6 rounded-xl shadow hover:shadow-lg transition h-36 sm:h-48"
            >
              {t.icon}
              <span className="mt-2 text-xs sm:text-base font-medium text-indigo-800 dark:text-white">
                {t.label}
              </span>
              <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm text-center mt-1">
                {t.desc}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
