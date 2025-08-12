import { supabase } from '../../supabaseClient';
import React, { useState, useEffect } from 'react';
import {
  FaMoneyCheckAlt, FaFileInvoiceDollar, FaClipboardList,
  FaBook, FaBoxes, FaArrowLeft, FaMoneyBillWave, FaExchangeAlt, FaLock
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
    icon: <FaMoneyBillWave className="text-2xl sm:text-5xl text-indigo-600 dark:text-indigo-400" />,
    desc: "Visualize all your finances in one place",
    component: <AllFinancialDashboard />,
    isFreemium: true,
  },
  {
    key: "payables",
    label: "Account Payable",
    icon: <FaMoneyCheckAlt className="text-2xl sm:text-5xl text-indigo-600 dark:text-indigo-400" />,
    desc: "Track and manage your outstanding payments",
    component: <AccountPayable />,
    isFreemium: false,
  },
  {
    key: "receivables",
    label: "Account Receivables",
    icon: <FaFileInvoiceDollar className="text-2xl sm:text-5xl text-indigo-600 dark:text-indigo-400" />,
    desc: "Monitor payments owed to your business",
    component: <AccountReceivables />,
    isFreemium: false,
  },
  {
    key: "reports",
    label: "Financial Reports",
    icon: <FaClipboardList className="text-2xl sm:text-5xl text-indigo-600 dark:text-indigo-400" />,
    desc: "View profit & loss, balance sheet, and cash flow",
    component: <FinancialReports />,
    isFreemium: false,
  },
  {
    key: "ledger",
    label: "General Ledger",
    icon: <FaBook className="text-2xl sm:text-5xl text-indigo-600 dark:text-indigo-400" />,
    desc: "Access all financial transactions in one place",
    component: <GeneralLedger />,
    isFreemium: true,
  },
  {
    key: "valuation",
    label: "Inventory Valuations",
    icon: <FaBoxes className="text-2xl sm:text-5xl text-indigo-600 dark:text-indigo-400" />,
    desc: "Evaluate your stock's financial worth over time",
    component: <InventoryValuations />,
    isFreemium: false,
  },
  {
    key: "reconciliations",
    label: "Reconciliations",
    icon: <FaExchangeAlt className="text-2xl sm:text-5xl text-indigo-600 dark:text-indigo-400" />,
    desc: "Audit and reconcile all your financial transactions",
    component: <Reconciliations />,
    isFreemium: true,
  },
];

export default function Finance() {
  const [shopName, setShopName] = useState('Store');
  const [activeTool, setActiveTool] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [, setErrorMessage] = useState('');

  useEffect(() => {
    async function checkAuthorizationAndFetchShopName() {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const storeId = localStorage.getItem('store_id');
        const userId = localStorage.getItem('user_id');
        const ownerId = localStorage.getItem('owner_id');
        const userAccessRaw = localStorage.getItem('user_access');
        let hasPremiumAccess = false;
        let fetchedShopName = 'Store';

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

        // Fetch shop name and premium status
        if (storeId) {
          const { data: storeData, error: storeError } = await supabase
            .from('stores')
            .select('shop_name, premium')
            .eq('id', storeId)
            .single();

          if (storeError) {
            console.error('Error fetching shop name:', storeError.message);
          } else if (storeData) {
            fetchedShopName = storeData.shop_name || fetchedShopName;
            const isPremiumStore = storeData.premium === true || 
                                 (typeof storeData.premium === 'string' && 
                                  storeData.premium.toLowerCase() === 'true');
            if (isPremiumStore) {
              hasPremiumAccess = true;
            }
          }
        }

        // If not premium yet and user_id is present, check associated stores via store_users
        if (!hasPremiumAccess && userId) {
          const { data: userStores, error: userStoresError } = await supabase
            .from('store_users')
            .select('store_id')
            .eq('id', userId);

          if (!userStoresError && userStores?.length > 0) {
            const associatedStoreIds = userStores.map((us) => us.store_id);

            // Query premium status for associated stores
            const { data: premiumStores, error: premiumStoresError } = await supabase
              .from('stores')
              .select('id, shop_name, premium')
              .in('id', associatedStoreIds)
              .eq('premium', true);

            if (!premiumStoresError && premiumStores?.length > 0) {
              hasPremiumAccess = true;
              fetchedShopName = premiumStores[0].shop_name || fetchedShopName;
            }
          }
        }

        // If user_access is present, cross-check store_ids for premium
        if (!hasPremiumAccess && userAccessRaw) {
          try {
            const userAccess = JSON.parse(userAccessRaw);
            const accessStoreIds = userAccess?.store_ids || [];

            if (accessStoreIds.length > 0) {
              const { data: premiumAccessStores, error: premiumAccessError } = await supabase
                .from('stores')
                .select('id, shop_name, premium')
                .in('id', accessStoreIds)
                .eq('premium', true);

              if (!premiumAccessError && premiumAccessStores?.length > 0) {
                hasPremiumAccess = true;
                fetchedShopName = premiumAccessStores[0].shop_name || fetchedShopName;
              }
            }
          } catch (parseError) {
            console.error('Error parsing user_access:', parseError.message);
          }
        }

        setShopName(fetchedShopName);
        setIsPremium(hasPremiumAccess);
        if (!hasPremiumAccess) {
          setErrorMessage('Some features are available only for premium users. Please upgrade your store’s subscription.');
        }
      } catch (error) {
        console.error('Authorization check error:', error.message);
        setErrorMessage('An unexpected error occurred. Please try again later.');
        setIsAuthorized(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkAuthorizationAndFetchShopName();
  }, []);

  const tool = financeTools.find(t => t.key === activeTool);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 w-full flex flex-col">
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
          <header className="text-center mb-4 sm:mb-6 pt-4 sm:pt-6">
            <h1 className="text-lg sm:text-3xl font-bold text-indigo-800 dark:text-indigo-400">
              Finance Dashboard for {shopName}
            </h1>
            {!activeTool && (
              <p className="text-gray-600 dark:text-gray-400 mt-2 text-xs sm:text-sm">
                Manage payables, receivables, reports, and valuations.
              </p>
            )}
          </header>

        {!isPremium && (
               <div className="px-3 sm:px-6 mt-4 flex flex-col sm:flex-row items-center justify-center gap-2 text-center">
                 <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 text-xs sm:text-sm font-medium px-2 py-1 rounded-full">
                   <FaLock className="text-yellow-600 text-xs" /> Want to Access More Features? Upgrade to Premium!
                 </span>
                 <a
                   href="/upgrade"
                   target="_blank"
                   rel="noopener noreferrer"
                   className="bg-indigo-600 text-white font-medium text-xs sm:text-sm py-1.5 px-3 rounded-lg hover:bg-indigo-700 transition"
                 >
                   Upgrade Now
                 </a>
               </div>
             )}

          {activeTool ? (
            <div className="flex-1 flex flex-col w-full">
              <div className="px-4 sm:px-6">
                <button
                  onClick={() => setActiveTool('')}
                  className="flex items-center text-indigo-600 hover:text-indigo-800 mb-4 text-xs sm:text-base"
                >
                  <FaArrowLeft className="mr-2" /> Back to Finance Tools
                </button>
                <h2 className="text-lg sm:text-2xl font-semibold text-indigo-800 dark:text-indigo-400">
                  {tool.label}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">{tool.desc}</p>
                {tool.isFreemium || isPremium ? (
                  <div className="w-full mt-4">
                    {React.cloneElement(tool.component, { setActiveTool })}
                  </div>
                ) : (
                  <div className="mt-4 text-center text-gray-600 dark:text-gray-400">
                    <FaLock className="text-2xl sm:text-3xl mb-2" />
                    <p>This feature is available only for premium users. Please upgrade your store’s subscription.</p>
                    <a
                      href="/upgrade"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-3 bg-indigo-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-indigo-700 transition"
                    >
                      Upgrade to Premium
                    </a>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="relative flex-1 px-4 sm:px-6 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
              {financeTools.map(t => (
                <div
                  key={t.key}
                  className={`relative flex flex-col items-center justify-center bg-white dark:bg-gray-800 p-3 sm:p-6 rounded-xl shadow h-36 sm:h-48 transition ${
                    t.isFreemium || isPremium ? 'hover:shadow-lg cursor-pointer' : 'cursor-not-allowed'
                  }`}
                  onClick={t.isFreemium || isPremium ? () => setActiveTool(t.key) : null}
                  title={t.isFreemium || isPremium ? '' : 'Upgrade to premium to access this feature'}
                >
                  {t.icon}
                  <span className="mt-2 text-xs sm:text-base font-medium text-indigo-800 dark:text-indigo-400">
                    {t.label}
                  </span>
                  <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm text-center mt-1">
                    {t.desc}
                  </p>
                  {!t.isFreemium && !isPremium && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-200/20 dark:bg-gray-700/20 rounded-xl">
                      <FaLock className="text-red-300 dark:text-red-500 text-lg sm:text-xl" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}