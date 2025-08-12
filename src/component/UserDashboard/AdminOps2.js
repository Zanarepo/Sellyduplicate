import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { FaClock, FaTasks, FaCalendarAlt, FaArrowLeft, FaLock } from 'react-icons/fa';
import StoreClocking from './StoreClocking';
import AdminTasks from './AdminTasks';
import StaffSchedules from './StaffSchedules';

const opsTools = [
  {
    key: 'clocking',
    label: 'Time Sheet Manager',
    icon: <FaClock className="text-xl sm:text-4xl md:text-5xl text-indigo-600 dark:text-indigo-400" />,
    desc: 'Track employee clock-in and clock-out times.',
    component: <StoreClocking />,
    isFreemium: true,
  },
  {
    key: 'tasks',
    label: 'Assignment Tracker',
    icon: <FaTasks className="text-xl sm:text-4xl md:text-5xl text-indigo-600 dark:text-indigo-400" />,
    desc: 'Manage and monitor staff tasks.',
    component: <AdminTasks />,
    isFreemium: false,
  },
  {
    key: 'schedules',
    label: 'Schedule Manager',
    icon: <FaCalendarAlt className="text-xl sm:text-4xl md:text-5xl text-indigo-600 dark:text-indigo-400" />,
    desc: 'Organize staff schedules efficiently.',
    component: <StaffSchedules />,
    isFreemium: false,
  },
];

export default function AdminOps() {
  const [shopName, setShopName] = useState('Store Admin');
  const [activeTool, setActiveTool] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function checkPremiumAccess() {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const storeId = localStorage.getItem('store_id');
        const userId = localStorage.getItem('user_id');
        const userAccessRaw = localStorage.getItem('user_access');
        let hasPremiumAccess = false;
        let fetchedShopName = 'Store Admin';

        if (!storeId) {
          setErrorMessage('No store assigned. Contact your admin.');
          setIsAuthorized(false);
          setIsLoading(false);
          return;
        }

        if (!userId) {
          setErrorMessage('User not authenticated. Please log in.');
          setIsAuthorized(false);
          setIsLoading(false);
          return;
        }

        // Fetch store premium status
        const { data: storeData, error: storeError } = await supabase
          .from('stores')
          .select('shop_name, premium')
          .eq('id', storeId)
          .single();

        if (storeError) {
          setErrorMessage('Failed to load store permissions.');
          setIsAuthorized(false);
          setIsLoading(false);
          return;
        }

        fetchedShopName = storeData?.shop_name || 'Store Admin';
        const isPremium = storeData.premium === true || 
                         (typeof storeData.premium === 'string' && 
                          storeData.premium.toLowerCase() === 'true');
        if (isPremium) {
          hasPremiumAccess = true;
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
        setIsAuthorized(hasPremiumAccess);
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

    checkPremiumAccess();
  }, []);

  const handleToolClick = (key) => {
    const tool = opsTools.find((t) => t.key === key);
    if (!tool.isFreemium && !isAuthorized) {
      setErrorMessage(`Access Denied: ${tool.label} is a premium feature. Please upgrade your subscription.`);
      return;
    }
    setActiveTool(key);
    setErrorMessage('');
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="w-full bg-white dark:bg-gray-900 p-4 max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-indigo-500"></div>
          </div>
        </div>
      );
    }

    if (activeTool) {
      const tool = opsTools.find((t) => t.key === activeTool);
      if (!tool.isFreemium && !isAuthorized) {
        return (
          <div className="w-full bg-white dark:bg-gray-900 p-4 max-w-7xl mx-auto text-center text-gray-600 dark:text-gray-400">
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
        );
      }
      return (
        <div className="flex-1 flex flex-col w-full max-w-7xl mx-auto">
          <div className="px-4 sm:px-6">
            <button
              onClick={() => setActiveTool('')}
              className="flex items-center text-indigo-600 hover:text-indigo-800 mb-3 sm:mb-4 text-xs sm:text-sm md:text-base"
              aria-label="Back to Operations"
            >
              <FaArrowLeft className="mr-2" /> Back to Operations
            </button>
            <h2 className="text-base sm:text-lg md:text-xl font-semibold text-indigo-600 dark:text-indigo-400">
              {tool.label}
            </h2>
            <p className="text-indigo-600 dark:text-indigo-400 text-xs sm:text-sm md:text-base mb-4">
              {tool.desc}
            </p>
          </div>
          <div className="flex-1 w-full">
            {React.cloneElement(tool.component, { setActiveTool })}
          </div>
        </div>
      );
    }

    return (
      <div className="relative flex-1 px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4 md:gap-6 max-w-7xl mx-auto overflow-hidden">
        {opsTools.map((t) => (
          <div
            key={t.key}
            className={`relative flex flex-col items-center justify-center bg-white dark:bg-gray-800 rounded-xl shadow p-4 sm:p-6 h-40 sm:h-48 md:h-56 w-full transition ${
              t.isFreemium || isAuthorized ? 'hover:shadow-lg cursor-pointer' : 'cursor-not-allowed'
            }`}
            onClick={() => handleToolClick(t.key)}
            title={
              t.isFreemium || isAuthorized ? '' : `Locked: ${t.label}: Upgrade to premium to access this feature`
            }
            aria-label={`Select ${t.label}`}
          >
            {t.icon}
            <span className="mt-2 text-xs sm:text-sm md:text-base font-medium text-indigo-600 dark:text-indigo-400">
              {t.label}
            </span>
            <p className="text-indigo-600 dark:text-indigo-400 text-xs sm:text-sm text-center mt-1">
              {t.desc}
            </p>
            {(!t.isFreemium && !isAuthorized) && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200/20 dark:bg-gray-700/20 rounded-xl">
                <FaLock className="text-red-300 dark:text-red-500 text-lg sm:text-xl" />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full min-h-screen bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
      <header className="text-center pt-4 sm:pt-6">
        <h1 className="text-base sm:text-2xl md:text-3xl font-bold text-indigo-600 dark:text-indigo-400">
          {shopName} Admin Operations
        </h1>
        <p className="text-indigo-600 dark:text-indigo-400 mt-1 text-xs sm:text-sm md:text-base">
          Manage clocking, tasks, and staff schedules in one place.
        </p>
      </header>
      {!isAuthorized && (
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
      {errorMessage && (
        <div className="text-center text-red-500 dark:text-red-400 mb-4 text-xs sm:text-sm max-w-7xl mx-auto">
          {errorMessage}
        </div>
      )}
      {renderContent()}
    </div>
  );
}