import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import {
  FaRegMoneyBillAlt,
  FaMoneyCheckAlt,
  FaBoxes,
  FaChartLine,
  FaTasks,
  FaArrowLeft,
  FaReceipt,
  FaUndoAlt,
  FaBoxOpen,
  FaSearch,
  FaLock,
} from 'react-icons/fa';
import DynamicInventory from '../DynamicSales/DynamicInventory';
import AttendantsDynamicSales from '../UserDashboard/AttendantsDynamicSales';
import ExpenseTracker from './ExpenseTracker';
import DebtTracker from './DebtTracker';
import AttendantsUnpaidSupplies from './AttendantsUnpaidSupplies';
import UserGadgetsDynamicProducts from './UserGadgetsDynamicProducts';
import DynamicReceipts from '../VariexContents/DynamicReceipts';
import DynamicReturnedItems from '../VariexContents/DynamicReturnedItems';
import DynamicSuppliersTracker from '../Ops/DynamicSuppliersTracker';
import VsalesSummary from '../Ops/VsalesSummary';


const tools = [
  {
    key: 'sales',
    label: 'Sales Tracker',
    icon: <FaChartLine className="text-2xl sm:text-5xl text-indigo-600" />,
    desc: 'Add your sales and see how your business is doing',
    component: <AttendantsDynamicSales />,
  },
  {
    key: 'Dynamic Products',
    label: 'Products & Pricing Tracker',
    icon: <FaBoxes className="text-2xl sm:text-5xl text-indigo-600" />,
    desc: 'Add and manage your store’s products, prices, and stock here',
    component: <UserGadgetsDynamicProducts />,
  },
  {
    key: 'inventory',
    label: 'Manage Inventory (Goods)',
    icon: <FaTasks className="text-2xl sm:text-5xl text-indigo-600" />,
    desc: 'Keep an eye on how much goods you have sold and what is left in your store.',
    component: <DynamicInventory />,
  },
  {
    key: 'receipts',
    label: 'Sales Receipts',
    icon: <FaReceipt className="text-2xl sm:text-5xl text-indigo-600" />,
    desc: 'Monitor and track sales.',
    component: <DynamicReceipts />,
  },
  {
    key: 'returns',
    label: 'Returned Items Tracker',
    icon: <FaUndoAlt className="text-2xl sm:text-5xl text-indigo-600" />,
    desc: 'Track returned items from customers.',
    component: <DynamicReturnedItems />,
  },
  {
    key: 'expenses',
    label: 'Expenses Tracker',
    icon: <FaRegMoneyBillAlt className="text-2xl sm:text-5xl text-indigo-600" />,
    desc: 'Keep track of your stores spending.',
    component: <ExpenseTracker />,
  },
  {
    key: 'unpaid supplies',
    label: 'Unpaid Supplies',
    icon: <FaBoxOpen className="text-2xl sm:text-5xl text-indigo-600" />,
    desc: 'See who took goods on credit and hasn’t paid yet',
    component: <AttendantsUnpaidSupplies />,
  },
  {
    key: 'debts',
    label: 'Debtors',
    icon: <FaMoneyCheckAlt className="text-2xl sm:text-5xl text-indigo-600" />,
    desc: 'Track debtors.',
    component: <DebtTracker />,
  },

{
    key: 'sales_summary',
    label: 'Sales Summary',
    icon: <FaChartLine className="text-2xl sm:text-5xl sm:text-6xl text-indigo-600" />,
    desc: 'View a summary of your sales performance.',
    component: <VsalesSummary />,
  },



  {
    key: 'Suppliers',
    label: 'Suppliers & Product Tracker',
    icon: <FaSearch className="text-2xl sm:text-5xl text-indigo-600" />,
    desc: 'Track product & suppliers.',
    component: <DynamicSuppliersTracker />,
  },
];

// Mapping to align store owner keys to store user keys
const featureKeyMapping = {
  'products & pricing tracker': 'Dynamic Products',
  'products': 'Dynamic Products',
  'product tracker': 'Dynamic Products',
  'products tracker': 'Dynamic Products',
 'suppliers & product tracker': 'Suppliers',
  'suppliers': 'Suppliers',
  'supplier': 'Suppliers',
  'sales summary': 'sales_summary',

};


export default function DynamicDashboard() {
  const [shopName, setShopName] = useState('Store Owner');
  const [activeTool, setActiveTool] = useState(null);
  const [allowedFeatures, setAllowedFeatures] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAllowedFeatures = async () => {
    try {
      setIsLoading(true);
      setError('');
      const storeId = localStorage.getItem('store_id');
      const userId = localStorage.getItem('user_id');

      if (!storeId) {
        setError('No store assigned. Contact your admin.');
        setAllowedFeatures([]);
        return;
      }

      if (!userId) {
        setError('User not authenticated. Please log in.');
        setAllowedFeatures([]);
        return;
      }

      // Fetch store features
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('shop_name, allowed_features')
        .eq('id', storeId)
        .single();

      if (storeError) {
        setError('Failed to load store permissions.');
        setAllowedFeatures([]);
        return;
      }

      setShopName(storeData?.shop_name || 'Store Owner');
      let storeFeatures = [];
      if (Array.isArray(storeData?.allowed_features)) {
        storeFeatures = storeData.allowed_features
          .map((item) => item?.trim().toLowerCase())
          .filter(Boolean);
      } else if (storeData?.allowed_features === '' || storeData?.allowed_features === '""') {
        storeFeatures = [];
      } else if (typeof storeData?.allowed_features === 'string') {
        try {
          const parsed = JSON.parse(storeData.allowed_features);
          if (Array.isArray(parsed)) {
            storeFeatures = parsed
              .map((item) => item?.trim().toLowerCase())
              .filter(Boolean);
          } else {
            setError('Invalid store feature data.');
            storeFeatures = [];
          }
        } catch (e) {
          setError('Invalid store feature data.');
          storeFeatures = [];
        }
      }

      // Fetch user features from store_users
      const { data: userData, error: userError } = await supabase
        .from('store_users')
        .select('allowed_features')
        .eq('id', userId)
        .eq('store_id', storeId)
        .single();

      if (userError) {
        setError('Failed to load user permissions.');
        setAllowedFeatures([]);
        return;
      }

      let userFeatures = [];
      if (Array.isArray(userData?.allowed_features)) {
        userFeatures = userData.allowed_features
          .map((item) => {
            const normalized = item?.trim().toLowerCase();
            return featureKeyMapping[normalized] || normalized;
          })
          .filter(Boolean);
      } else if (userData?.allowed_features === '' || userData?.allowed_features === '""') {
        userFeatures = [];
      } else if (typeof userData?.allowed_features === 'string') {
        try {
          const parsed = JSON.parse(userData.allowed_features);
          if (Array.isArray(parsed)) {
            userFeatures = parsed
              .map((item) => {
                const normalized = item?.trim().toLowerCase();
                return featureKeyMapping[normalized] || normalized;
              })
              .filter(Boolean);
          } else {
            setError('Invalid user feature data.');
            userFeatures = [];
          }
        } catch (e) {
          setError('Invalid user feature data.');
          userFeatures = [];
        }
      }

      // Intersect store and user features
      const effectiveFeatures = storeFeatures
        .map((f) => featureKeyMapping[f] || f)
        .filter((f) => userFeatures.includes(f));

      setAllowedFeatures(effectiveFeatures);
    } catch (err) {
      setError('An error occurred while loading permissions.');
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
    if (!allowedFeatures.includes(key)) {
      setError(`Access Denied: ${tools.find((t) => t.key === key).label}: Premium feature or Contact your admin to unlock.`);
      return;
    }
    setActiveTool(key);
    setError('');
  };

  const renderContent = () => {
    if (isLoading) {
      return <div className="w-full bg-white dark:bg-gray-900 p-4 max-w-7xl mx-auto">Loading...</div>;
    }

    if (activeTool) {
      const tool = tools.find((t) => t.key === activeTool);
      if (!allowedFeatures.includes(activeTool)) {
        return (
          <div className="w-full bg-white dark:bg-gray-900 p-4 max-w-7xl mx-auto">
            <div className="text-red-500 dark:text-red-400">
              Access Denied: You do not have permission to view {tool.label}. Contact your admin to unlock this feature.
            </div>
          </div>
        );
      }
      return (
        <div className="w-full bg-white dark:bg-gray-900 p-4 max-w-7xl mx-auto">
          <div className="mb-4 sm:mb-6">
            <button
              onClick={() => setActiveTool(null)}
              className="flex items-center text-indigo-600 hover:text-indigo-800 mb-4 text-xs sm:text-base"
              aria-label="Go back to tool selection"
            >
              <FaArrowLeft className="mr-2" /> Back
            </button>
            <h2 className="text-lg sm:text-2xl font-semibold text-indigo-700 dark:text-indigo-200">
              {tool.label}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">{tool.desc}</p>
          </div>
          {tool.component}
        </div>
      );
    }

    return (
      <div className="w-full bg-white dark:bg-gray-900 p-4 max-w-7xl mx-auto">
        <div className="grid grid-cols-3 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
          {tools.map((t) => (
            <button
              key={t.key}
              onClick={() => handleToolClick(t.key)}
              className={`flex flex-col items-center justify-center bg-white dark:bg-gray-800 p-2 sm:p-6 rounded-xl shadow hover:shadow-lg transition h-32 sm:h-48 ${
                !allowedFeatures.includes(t.key) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={!allowedFeatures.includes(t.key)}
              title={
                allowedFeatures.includes(t.key)
                  ? t.desc
                  : `Locked: ${t.label}: Premium feature or Contact your admin to unlock`
              }
              aria-label={`Select ${t.label}`}
            >
              <div className="relative">
                {t.icon}
                {!allowedFeatures.includes(t.key) && (
                  <FaLock className="absolute top-0 right-0 text-red-500 text-sm" />
                )}
              </div>
              <span className="mt-2 text-xs sm:text-base font-medium text-indigo-800 dark:text-white">
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 w-full px-2 sm:px-4">
      <header className="text-center mb-4 sm:mb-6">
        <h1 className="text-lg sm:text-3xl font-bold text-indigo-800 dark:text-white">
          Welcome, {shopName}!
        </h1>
        {!activeTool && (
          <p className="text-gray-600 dark:text-gray-400 mt-2 text-xs sm:text-sm">
            Choose a tool to continue.
          </p>
        )}
      </header>
      {error && (
        <div className="text-center text-red-500 dark:text-red-400 mb-4 text-xs sm:text-sm">
          {error}
        </div>
      )}
      {renderContent()}
      <div className="p-4 max-w-7xl mx-auto">
        <button
          onClick={() => {
            localStorage.removeItem(`features_${localStorage.getItem('store_id')}`);
            fetchAllowedFeatures();
          }}
          className="text-indigo-600 dark:text-indigo-400 text-sm underline hover:text-indigo-800 dark:hover:text-indigo-300"
          aria-label="Refresh permissions"
        >
          Refresh Permissions
        </button>
      </div>
    </div>
  );
}