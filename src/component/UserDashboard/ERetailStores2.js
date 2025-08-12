import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import {
  FaRegMoneyBillAlt,
  FaMoneyCheckAlt,
  FaBoxes,
  FaChartLine,
  FaUsers,
  FaTasks,
  FaArrowLeft,
  FaReceipt,
  FaUndoAlt,
  FaBoxOpen,
  FaSearch,
  FaLock,
} from 'react-icons/fa';
import DynamicInventory from '../DynamicSales/DynamicInventory';
import ExpenseTracker from './ExpenseTracker';
import Customers from './Customers';
import DebtTracker from './DebtTracker';
import DeviceDynamicSales from '../DynamicSales/DeviceDynamicSales';
import DynamicReturnedItems from '../VariexContents/DynamicReturnedItems';
import GadgetsUnpaidSupplies from '../UserDashboard/GadgetsUnpaidSupplies';
import DynamicSuppliersTracker from '../Ops/DynamicSuppliersTracker';
import DashboardAccess from '../Ops/DashboardAccess';
import GadgetsDynamicProducts from './GadgetsDynamicProducts';
import VsalesSummary from '../Ops/VsalesSummary';
import ReceiptQRCode from '../VariexContents/ReceiptQRCode';

const tools = [
  {
    key: 'sales',
    label: 'Sales Tracker',
    icon: <FaChartLine className="text-2xl sm:text-5xl text-indigo-600 dark:text-indigo-400" />,
    desc: 'Add your sales and see how your business is doing',
    component: <DeviceDynamicSales />,
    isFreemium: true,
  },
  {
    key: 'products',
    label: 'Products & Pricing Tracker',
    icon: <FaBoxes className="text-2xl sm:text-5xl text-indigo-600 dark:text-indigo-400" />,
    desc: 'Add and manage your store’s products, prices, and stock here',
    component: <GadgetsDynamicProducts />,
    isFreemium: false,
  },
  {
    key: 'inventory',
    label: 'Manage Inventory (Goods)',
    icon: <FaTasks className="text-2xl sm:text-5xl text-indigo-600 dark:text-indigo-400" />,
    desc: 'Keep an eye on how much goods you have sold and what is left in your store.',
    component: <DynamicInventory />,
    isFreemium: false,
  },
  {
    key: 'receipts',
    label: 'Sales Receipts',
    icon: <FaReceipt className="text-2xl sm:text-5xl text-indigo-600 dark:text-indigo-400" />,
    desc: 'Monitor and track sales.',
    component: <ReceiptQRCode />,
    isFreemium: true,
  },
  {
    key: 'returns',
    label: 'Returned Items Tracker',
    icon: <FaUndoAlt className="text-2xl sm:text-5xl text-indigo-600 dark:text-indigo-400" />,
    desc: 'Track returned items from customers.',
    component: <DynamicReturnedItems />,
    isFreemium: true,
  },
  {
    key: 'expenses',
    label: 'Expenses Tracker',
    icon: <FaRegMoneyBillAlt className="text-2xl sm:text-5xl text-indigo-600 dark:text-indigo-400" />,
    desc: 'Keep track of your stores spending.',
    component: <ExpenseTracker />,
    isFreemium: false,
  },
  {
    key: 'unpaid_supplies',
    label: 'Unpaid Supplies',
    icon: <FaBoxOpen className="text-2xl sm:text-5xl text-indigo-600 dark:text-indigo-400" />,
    desc: 'See who took goods on credit and hasn’t paid yet',
    component: <GadgetsUnpaidSupplies />,
    isFreemium: true,
  },
  {
    key: 'debts',
    label: 'Debtors',
    icon: <FaMoneyCheckAlt className="text-2xl sm:text-5xl text-indigo-600 dark:text-indigo-400" />,
    desc: 'Track debtors.',
    component: <DebtTracker />,
    isFreemium: false,
  },
  {
    key: 'suppliers',
    label: 'Suppliers & Product Tracker',
    icon: <FaSearch className="text-2xl sm:text-5xl text-indigo-600 dark:text-indigo-400" />,
    desc: 'Track product & suppliers.',
    component: <DynamicSuppliersTracker />,
    isFreemium: false,
  },
  {
    key: 'sales_summary',
    label: 'Sales Summary',
    icon: <FaChartLine className="text-2xl sm:text-5xl text-indigo-600 dark:text-indigo-400" />,
    desc: 'View a summary of your sales performance.',
    component: <VsalesSummary />,
    isFreemium: false,
  },
  {
    key: 'customers',
    label: 'Customer Manager',
    icon: <FaUsers className="text-2xl sm:text-5xl text-indigo-600 dark:text-indigo-400" />,
    desc: 'Manage your customers.',
    component: <Customers />,
    isFreemium: true,
  },
];

// Mapping for common variations in allowed_dashboard and users_dashboard
const featureKeyMapping = {
  'products & pricing tracker': 'products',
  'products': 'products',
  'product tracker': 'products',
  'products tracker': 'products',
  'dynamic products': 'products',
  'suppliers & product tracker': 'suppliers',
  'suppliers': 'suppliers',
  'supplier': 'suppliers',
  'sales summary': 'sales_summary',
  'unpaid supplies': 'unpaid_supplies',
};

export default function DynamicDashboard() {
  const [shopName, setShopName] = useState('Store Owner');
  const [activeTool, setActiveTool] = useState(null);
  const [allowedFeatures, setAllowedFeatures] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchAllowedFeatures = async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      const storeId = localStorage.getItem('store_id');
      const userId = localStorage.getItem('user_id');
      const userAccessRaw = localStorage.getItem('user_access');
      let hasPremiumAccess = false;
      let fetchedShopName = 'Store Owner';
      let features = [];

      if (!storeId) {
        setErrorMessage('Please log in to access the dashboard.');
        setIsLoading(false);
        return;
      }

      localStorage.removeItem(`features_${storeId}`);

      // Fetch shop name, allowed features, and premium status
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('shop_name, allowed_features, premium')
        .eq('id', storeId)
        .single();

      if (storeError) {
        setErrorMessage('Failed to load feature permissions. Please try again.');
        setAllowedFeatures([]);
        setIsLoading(false);
        return;
      }

      fetchedShopName = storeData?.shop_name || 'Store Owner';
      const isPremiumStore = storeData.premium === true || 
                           (typeof storeData.premium === 'string' && 
                            storeData.premium.toLowerCase() === 'true');
      if (isPremiumStore) {
        hasPremiumAccess = true;
      }

      // Parse allowed features
      if (Array.isArray(storeData?.allowed_features)) {
        features = storeData.allowed_features
          .map((item) => {
            const normalized = item?.trim().toLowerCase();
            return featureKeyMapping[normalized] || normalized;
          })
          .filter(Boolean);
      } else if (storeData?.allowed_features === '' || storeData?.allowed_features === '""') {
        features = [];
      } else if (typeof storeData?.allowed_features === 'string') {
        try {
          const parsed = JSON.parse(storeData.allowed_features);
          if (Array.isArray(parsed)) {
            features = parsed
              .map((item) => {
                const normalized = item?.trim().toLowerCase();
                return featureKeyMapping[normalized] || normalized;
              })
              .filter(Boolean);
          } else {
            setErrorMessage('Contact Support or your org. Admin to Unlock.');
            features = [];
          }
        } catch (e) {
          setErrorMessage('Contact Support or your org. Admin to Unlock.');
          features = [];
        }
      } else {
        setErrorMessage('Contact Support or your org. Admin to Unlock.');
        features = [];
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
      setAllowedFeatures(features);
      if (!hasPremiumAccess) {
        setErrorMessage('Some features are available only for premium users. Please upgrade your store’s subscription.');
      }
    } catch (err) {
      setErrorMessage('An error occurred while loading permissions. Please try again.');
      setAllowedFeatures([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllowedFeatures();
  }, []);

  useEffect(() => {
    if (!isLoading && activeTool && !allowedFeatures.includes(activeTool)) {
      setActiveTool(null);
    }
  }, [allowedFeatures, isLoading, activeTool]);

  const handleToolClick = (key) => {
    const tool = tools.find((t) => t.key === key);
    if (!allowedFeatures.includes(key)) {
      setErrorMessage(`Access Denied: ${tool.label} is not enabled for your store. Contact your admin to unlock this feature.`);
      return;
    }
    if (!tool.isFreemium && !isPremium) {
      setErrorMessage(`Access Denied: ${tool.label} is a premium feature. Please upgrade your subscription.`);
      return;
    }
    setActiveTool(key);
    setErrorMessage('');
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-indigo-500"></div>
        </div>
      );
    }

    if (activeTool) {
      const tool = tools.find((t) => t.key === activeTool);
      if (!allowedFeatures.includes(activeTool)) {
        return (
          <div className="w-full bg-white dark:bg-gray-900 p-4">
            <div className="text-red-500 dark:text-red-400">
              Access Denied: You do not have permission to view {tool.label}. Contact your admin to unlock this feature.
            </div>
          </div>
        );
      }
      if (!tool.isFreemium && !isPremium) {
        return (
          <div className="w-full bg-white dark:bg-gray-900 p-4 text-center text-gray-600 dark:text-gray-400">
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
        <div className="w-full bg-white dark:bg-gray-900 p-4">
          <div className="mb-4 sm:mb-6">
            <button
              onClick={() => setActiveTool(null)}
              className="flex items-center text-indigo-600 hover:text-indigo-800 mb-4 text-xs sm:text-base"
            >
              <FaArrowLeft className="mr-2" /> Back
            </button>
            <h2 className="text-lg sm:text-2xl font-semibold text-indigo-700 dark:text-indigo-400">
              {tool.label}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">{tool.desc}</p>
          </div>
          {React.cloneElement(tool.component, { setActiveTool })}
        </div>
      );
    }

    return (
      <div className="relative flex-1 px-4 sm:px-6 grid grid-cols-3 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
        {tools.map((t) => (
          <div
            key={t.key}
            className={`relative flex flex-col items-center justify-center bg-white dark:bg-gray-800 p-2 sm:p-6 rounded-xl shadow h-32 sm:h-48 transition ${
              (t.isFreemium || isPremium) && allowedFeatures.includes(t.key) ? 'hover:shadow-lg cursor-pointer' : 'cursor-not-allowed'
            }`}
            onClick={() => handleToolClick(t.key)}
            title={
              (t.isFreemium || isPremium) && allowedFeatures.includes(t.key)
                ? t.desc
                : `Locked: ${t.label}: Premium feature or Contact your admin to unlock.`
            }
          >
            {t.icon}
            <span className="mt-2 text-xs sm:text-base font-medium text-indigo-800 dark:text-indigo-400">
              {t.label}
            </span>
            {(!t.isFreemium && !isPremium) || !allowedFeatures.includes(t.key) ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200/20 dark:bg-gray-700/20 rounded-xl">
                <FaLock className="text-red-300 dark:text-red-500 text-2xl sm:text-3xl" />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 w-full flex flex-col">
      <DashboardAccess />
      <header className="text-center mb-4 sm:mb-6 pt-4 sm:pt-6">
        <h1 className="text-lg sm:text-3xl font-bold text-indigo-800 dark:text-indigo-400">
          Welcome, {shopName}!
        </h1>
        {!activeTool && (
          <p className="text-gray-600 dark:text-gray-400 mt-2 text-xs sm:text-sm">
            Choose a tool to continue.
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


      {errorMessage && (
        <div className="text-center text-red-500 dark:text-red-400 mb-4 text-xs sm:text-sm">
          {errorMessage}
        </div>
      )}
      {renderContent()}
      <div className="p-4">
        <button
          onClick={() => {
            localStorage.removeItem(`features_${localStorage.getItem('store_id')}`);
            fetchAllowedFeatures();
          }}
          className="text-indigo-600 dark:text-indigo-400 text-sm underline hover:text-indigo-800 dark:hover:text-indigo-300"
        >
          Refresh Permissions
        </button>
      </div>
    </div>
  );
}