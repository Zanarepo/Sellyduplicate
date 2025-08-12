import { supabase } from '../../supabaseClient';
import React, { useState, useEffect } from 'react';
import { FaChartLine, FaBell, FaBoxOpen, FaLightbulb, FaShieldAlt, FaArrowLeft, FaLock } from "react-icons/fa";
import SalesTrends from '../DynamicSales/SalesTrends';
import AnomalyAlert from '../DynamicSales/AnomalyAlert';
import RestockAlerts from '../DynamicSales/RestockAlerts';
import Recommendation from '../DynamicSales/Recommendation';
import TheftBatchDetect from './TheftBatchDetect';

const tools = [
  {
    key: "sales",
    label: "Sales Insights",
    icon: <FaChartLine className="text-2xl sm:text-5xl sm:text-6xl text-indigo-600 dark:text-indigo-400" />,
    desc: "Analyze sales trends and forecasts to optimize your store",
    component: <SalesTrends />,
    isFreemium: false,
  },
  {
    key: "anomaly",
    label: "Anomaly Alerts",
    icon: <FaBell className="text-2xl sm:text-5xl sm:text-6xl text-indigo-600 dark:text-indigo-400" />,
    desc: "Detect unusual activities to protect your business",
    component: <AnomalyAlert />,
    isFreemium: true,
  },
  {
    key: "restock",
    label: "Restock Alerts",
    icon: <FaBoxOpen className="text-2xl sm:text-5xl sm:text-6xl text-indigo-600 dark:text-indigo-400" />,
    desc: "Monitor low stock items to ensure availability",
    component: <RestockAlerts />,
    isFreemium: true,
  },
  {
    key: "recommendation",
    label: "Restock Recommendations",
    icon: <FaLightbulb className="text-2xl sm:text-5xl sm:text-6xl text-indigo-600 dark:text-indigo-400" />,
    desc: "Get AI-driven recommendations for restocking items",
    component: <Recommendation />,
    isFreemium: true,
  },
  {
    key: "theft",
    label: "Theft/Audit Checks",
    icon: <FaShieldAlt className="text-2xl sm:text-5xl sm:text-6xl text-indigo-600 dark:text-indigo-400" />,
    desc: "Detect/Audit incidents in your store",
    component: <TheftBatchDetect />,
    isFreemium: false,
  },
];

export default function Insights() {
  const [shopName, setShopName] = useState('Store Owner');
  const [activeTool, setActiveTool] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [, setErrorMessage] = useState('');

  useEffect(() => {
    async function checkPremiumAccess() {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const storeId = localStorage.getItem('store_id');
        const userId = localStorage.getItem('user_id');
        const userAccessRaw = localStorage.getItem('user_access');
        let hasPremiumAccess = false;
        let fetchedShopName = 'Store Owner';

        if (!storeId) {
          setIsLoading(false);
          return;
        }

        // Fetch shop name and premium status
        const { data: storeData, error: storeError } = await supabase
          .from('stores')
          .select('shop_name, premium')
          .eq('id', storeId)
          .single();

        if (!storeError && storeData) {
          fetchedShopName = storeData.shop_name || fetchedShopName;
          const isPremiumStore = storeData.premium === true || 
                               (typeof storeData.premium === 'string' && 
                                storeData.premium.toLowerCase() === 'true');
          if (isPremiumStore) {
            hasPremiumAccess = true;
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
        console.error('Premium check error:', error.message);
        setErrorMessage('An unexpected error occurred. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    }

    checkPremiumAccess();
  }, []);

  const tool = tools.find(t => t.key === activeTool);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 w-full flex flex-col">
      {isLoading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-indigo-500"></div>
        </div>
      ) : (
        <>
          <header className="text-center mb-4 sm:mb-6 pt-4 sm:pt-6">
            <h1 className="text-lg sm:text-3xl font-bold text-indigo-800 dark:text-indigo-400">
              Insights for {shopName}
            </h1>
            {!activeTool && (
              <p className="text-gray-600 dark:text-gray-400 mt-2 text-xs sm:text-sm">
                Explore AI-driven insights to optimize your store.
              </p>
            )}
          </header>

         {!isPremium && (
                 <div className="px-3 sm:px-6 mt-2 flex flex-col sm:flex-row items-center justify-center gap-2 text-center">
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
            <div className="flex-1 flex flex-col w-full mb-4 sm:mb-6 px-4 sm:px-6">
              <button
                onClick={() => setActiveTool('')}
                className="flex items-center text-indigo-600 hover:text-indigo-800 mb-4 text-xs sm:text-base"
              >
                <FaArrowLeft className="mr-2" /> Back to Insights
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
          ) : (
            <div className="relative flex-1 px-4 sm:px-6 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
              {tools.map(t => (
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