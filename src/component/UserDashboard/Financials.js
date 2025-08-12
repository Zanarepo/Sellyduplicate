import { supabase } from '../../supabaseClient';
import React, { useState, useEffect } from 'react';
import {
  FaMoneyCheckAlt, FaFileInvoiceDollar, FaClipboardList,
  FaBook, FaBoxes, FaArrowLeft, FaMoneyBillWave, FaExchangeAlt
} from "react-icons/fa";
import AccountPayable from '../DynamicSales/AccountPayable';
import AccountReceivables from '../DynamicSales/AccountReceivables';
import FinancialReports from '../DynamicSales/FinancialReports';
import GeneralLedger from '../DynamicSales/GeneralLedger';
import InventoryValuations from '../DynamicSales/InventoryValuations';
import AllFinancialDashboard from '../DynamicSales/AllFinancialDashboard';
import Reconciliations from '../DynamicSales/Reconciliations';

const financeTools = [
  {
    key: "financials",
    label: "Financial Dashboard",
    icon: <FaMoneyBillWave className="text-2xl sm:text-5xl text-indigo-600" />,
    desc: "Visualize all your finances in one place",
    component: <AllFinancialDashboard />,
  },
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
  {
    key: "reconciliations",
    label: "Reconciliations",
    icon: <FaExchangeAlt className="text-2xl sm:text-5xl text-indigo-600" />,
    desc: "Audit and reconcile all your financial transactions",
    component: <Reconciliations />,
  },
];

export default function Finance() {
  const [shopName, setShopName] = useState('Store');
  const [activeTool, setActiveTool] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAuthorizationAndFetchShopName() {
      setIsLoading(true);
      try {
        const storeId = localStorage.getItem('store_id');
        const userId = localStorage.getItem('user_id');
        const ownerId = localStorage.getItem('owner_id');

        if (!storeId || !userId) {
          setIsAuthorized(false);
          setIsLoading(false);
          return;
        }

        // Fetch user role from store_users table
        const { data: userData, error: userError } = await supabase
          .from('store_users')
          .select('role')
          .eq('id', userId)
          .eq('store_id', storeId)
          .single();

        if (userError || !userData) {
          console.error('Error fetching user role:', userError?.message);
          setIsAuthorized(false);
          setIsLoading(false);
          return;
        }

        // Check if user has required role or is the owner
        const validRoles = ['account', 'manager', 'admin'];
        const isRoleValid = validRoles.includes(userData.role);
        const isOwner = userId === ownerId;
        setIsAuthorized(isRoleValid || isOwner);

        // Fetch shop name
        if (storeId) {
          const { data: storeData, error: storeError } = await supabase
            .from('stores')
            .select('shop_name')
            .eq('id', storeId)
            .single();

          if (storeError) {
            console.error('Error fetching shop name:', storeError.message);
          } else if (storeData?.shop_name) {
            setShopName(storeData.shop_name);
          }
        }
      } catch (error) {
        console.error('Authorization check error:', error.message);
        setIsAuthorized(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkAuthorizationAndFetchShopName();
  }, []);

  const tool = financeTools.find(t => t.key === activeTool);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 w-full">
      {isLoading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-indigo-500"></div>
        </div>
      ) : !isAuthorized ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md max-w-md">
            <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">
              Unauthorized Access
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Sorry, you don’t have permission to access the Finance Dashboard. Please contact your store admin or ensure you have the role of Account, Manager, or Admin.
            </p>
          </div>
        </div>
      ) : (
        <>
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
            <div className="mb-4 sm:mb-6 px-4 sm:px-6">
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
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4 px-4 sm:px-6">
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
        </>
      )}
    </div>
  );
}