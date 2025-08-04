import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaUser,
  FaBars,
  FaTimes,
  FaQrcode,
  FaBarcode,
  FaIdBadge,
  FaBell,
  FaCrown,
  FaHome,
  FaRobot,
  FaUsersCog,
  FaUserShield,
} from 'react-icons/fa';
import { supabase } from '../../supabaseClient';
import { authDB, queueOperation, syncPendingOperations } from '../../authDB';
import { toast } from 'react-toastify';
import UserOnboardingTour from './UserOnboardingTour';
import Employees from './Employees';
import Profile from './Profile';
import Notifications from './Notifications';
import PricingFeatures from '../Payments/PricingFeatures';
import ERetailStores from './ERetailStores';
import AIpowerInsights from './AIpowerInsights';
import AdminOps from './AdminOps';
import StoreAdmins from './StoreAdmins';
import Variex from './Variex'

// Helper function to fetch table data
async function fetchTableData(table, storeId) {
  if (navigator.onLine) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('store_id', storeId);
    if (!error && data) {
      await authDB[table].bulkPut(data);
      return data;
    }
    toast.error(`Failed to fetch ${table} data`);
    return [];
  } else {
    const data = await authDB[table].where('store_id').equals(storeId).toArray();
    if (data.length > 0) {
      toast.info(`Offline: Using cached ${table} data`);
      return data;
    }
    toast.error(`Offline: No cached ${table} data available`);
    return [];
  }
}

// Validate data based on table schema
function validateData(table, data) {
  const requiredFields = {
    dynamic_product: ['name', 'selling_price', 'store_id', 'device_id', 'device_size'],
    dynamic_sales: ['dynamic_product_id', 'quantity', 'unit_price', 'store_id', 'device_id', 'device_size'],
    dynamic_inventory: ['dynamic_product_id', 'quantity', 'store_id'],
    receipts: ['sales_amount', 'sales_qty', 'product_id', 'store_id'],
    sale_groups: ['store_id'],
    notifications: ['activity_type', 'table_name', 'store_id'],
    stores: ['shop_name', 'email_address'],
    store_users: ['store_id', 'email_address', 'role'],
    store_owners: ['full_name', 'email'],
    customer: ['store_id', 'fullname'],
    debts: ['store_id', 'customer_id', 'dynamic_product_id', 'owed', 'device_id', 'device_sizes'],
    debt_payments: ['store_id', 'debt_id', 'payment_amount'],
  };

  const required = requiredFields[table] || [];
  for (const field of required) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

// Helper function to perform operations
async function performOperation({ table, action, data, store_id }) {
  try {
    // Validate data
    const validationError = validateData(table, data);
    if (validationError) {
      throw new Error(validationError);
    }

    if (navigator.onLine) {
      if (action === 'insert') {
        const { data: result, error } = await supabase.from(table).insert({ ...data, store_id }).select().single();
        if (!error && result) {
          await authDB[table].put(result);
          toast.success(`Added ${table} successfully`);
          return result;
        }
      } else if (action === 'update') {
        const primaryKey = 'id';
        const { data: result, error } = await supabase
          .from(table)
          .update(data)
          .eq(primaryKey, data[primaryKey])
          .select()
          .single();
        if (!error && result) {
          await authDB[table].put(result);
          toast.success(`Updated ${table} successfully`);
          return result;
        }
      } else if (action === 'delete') {
        const primaryKey = 'id';
        const { error } = await supabase.from(table).delete().eq(primaryKey, data[primaryKey]);
        if (!error) {
          await authDB[table].delete(data[primaryKey]);
          toast.success(`Deleted ${table} successfully`);
          return { [primaryKey]: data[primaryKey] };
        }
      }
      throw new Error(`Failed to ${action} ${table}`);
    } else {
      await queueOperation({ table, action, data, store_id });
      if (action === 'insert') {
        const tempId = `temp-${Date.now()}`;
        const tempData = { ...data, id: tempId, store_id };
        await authDB[table].put(tempData);
        toast.info(`Queued ${action} for ${table} offline`);
        return tempData;
      } else if (action === 'update') {
        await authDB[table].put({ ...data, store_id });
        toast.info(`Queued ${action} for ${table} offline`);
        return data;
      } else if (action === 'delete') {
        const primaryKey = 'id';
        await authDB[table].delete(data[primaryKey]);
        toast.info(`Queued ${action} for ${table} offline`);
        return { [primaryKey]: data[primaryKey] };
      }
    }
  } catch (err) {
    console.error(`Error performing ${action} on ${table}:`, err);
    toast.error(`Failed to ${action} ${table}: ${err.message}`);
    throw err;
  }
}

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('AI Insights');
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [allowedFeatures, setAllowedFeatures] = useState([]);
  const [allowedDashboards, setAllowedDashboards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Fetch allowed features and dashboards
  useEffect(() => {
    const fetchAllowedData = async () => {
      try {
        setIsLoading(true);
        const storeId = localStorage.getItem('store_id');
        const email = localStorage.getItem('user_email');
        const type = 'team';

        if (!storeId || !email) {
          console.warn('Missing store_id or user_email');
          navigate('/login');
          return;
        }

        let features = [];
        let dashboards = [];
        if (navigator.onLine) {
          const { data, error } = await supabase
            .from('stores')
            .select('id, shop_name, allowed_features, allowed_dashboard')
            .eq('id', storeId)
            .single();
          if (!error && data) {
            await authDB.logins.put({
              email,
              store_id: storeId,
              type,
              allowed_features: data.allowed_features,
              allowed_dashboard: data.allowed_dashboard,
            });
            // Process allowed_features
            features = Array.isArray(data.allowed_features)
              ? data.allowed_features.map(item => item.trim().toLowerCase())
              : typeof data.allowed_features === 'string'
              ? data.allowed_features.includes('[')
                ? JSON.parse(data.allowed_features || '[]').map(item => item.trim().toLowerCase())
                : data.allowed_features.split(',').map(item => item.trim().toLowerCase())
              : [];
            // Process allowed_dashboard
            dashboards = Array.isArray(data.allowed_dashboard)
              ? data.allowed_dashboard.map(item => item.trim().toLowerCase())
              : typeof data.allowed_dashboard === 'string'
              ? data.allowed_dashboard.split(',').map(item => item.trim().toLowerCase())
              : [];
            await syncPendingOperations();
          }
        } else {
          const user = await authDB.logins
            .where('[email+store_id+type]')
            .equals([email, storeId, type])
            .first();
          if (user) {
            toast.info('Offline: Using cached data');
            // Process cached allowed_features
            features = Array.isArray(user.allowed_features)
              ? user.allowed_features.map(item => item.trim().toLowerCase())
              : typeof user.allowed_features === 'string'
              ? user.allowed_features.includes('[')
                ? JSON.parse(user.allowed_features || '[]').map(item => item.trim().toLowerCase())
                : user.allowed_features.split(',').map(item => item.trim().toLowerCase())
              : [];
            // Process cached allowed_dashboard
            dashboards = Array.isArray(user.allowed_dashboard)
              ? user.allowed_dashboard.map(item => item.trim().toLowerCase())
              : typeof user.allowed_dashboard === 'string'
              ? user.allowed_dashboard.split(',').map(item => item.trim().toLowerCase())
              : [];
          } else {
            toast.error('Offline: No cached data available');
            features = [];
            dashboards = [];
          }
        }

        setAllowedFeatures(features);
        setAllowedDashboards(dashboards);
      } catch (err) {
        console.error('Error:', err);
        toast.error('Error loading dashboard');
        setAllowedFeatures([]);
        setAllowedDashboards([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllowedData();
  }, [navigate]);

  // Sync on online event
  useEffect(() => {
    const handleOnline = () => {
      syncPendingOperations();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Check if tour has been shown before
  useEffect(() => {
    const hasSeenTour = localStorage.getItem('hasSeenTour');
    if (!hasSeenTour) {
      setIsTourOpen(true);
    }
  }, []);

  // Set default tab to an accessible one
  useEffect(() => {
    if (!isLoading) {
      if (
        (activeTab === 'Fix Scan' && !allowedDashboards.includes('fix_scan')) ||
        (activeTab === 'Flex Scan' && !allowedDashboards.includes('flex_scan')) ||
        (activeTab === 'AI Insights' && !allowedDashboards.includes('ai_insights')) ||
        (activeTab === 'Admin Ops' && !allowedDashboards.includes('admin_ops'))
      ) {
        console.log(`${activeTab} not allowed, falling back to Home`);
        setActiveTab('Home');
      }
    }
  }, [allowedDashboards, allowedFeatures, isLoading, activeTab]);

  // Toggle dark mode
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Close tour and mark as seen
  const handleTourClose = () => {
    setIsTourOpen(false);
    localStorage.setItem('hasSeenTour', 'true');
  };

  // Render main content based on active tab
  const renderContent = () => {
    if (isLoading) {
      return <div className="w-full bg-white dark:bg-gray-900 p-4">Loading...</div>;
    }

    const storeId = localStorage.getItem('store_id');

    switch (activeTab) {
      case 'Flex Scan':
        if (!allowedDashboards.includes('flex_scan')) {
          return <div className="w-full bg-white dark:bg-gray-900 p-4">Access Denied: You do not have permission to view Flex Scan.</div>;
        }
        return (
          <div className="w-full bg-white dark:bg-gray-900 p-4">
            <Variex   fetchTableData={fetchTableData} performOperation={performOperation} storeId={storeId} />
          </div>
        );
      case 'Fix Scan':
        if (!allowedDashboards.includes('fix_scan')) {
          return <div className="w-full bg-white dark:bg-gray-900 p-4">Access Denied: You do not have permission to view Fix Scan.</div>;
        }
        return (
          <div className="w-full bg-white dark:bg-gray-900 p-4">
            <ERetailStores fetchTableData={fetchTableData} performOperation={performOperation} storeId={storeId} />
          </div>
        );
      case 'AI Insights':
        if (!allowedDashboards.includes('ai_insights')) {
          return <div className="w-full bg-white dark:bg-gray-900 p-4">Access Denied: You do not have permission to view AI Insights.</div>;
        }
        return (
          <div className="w-full bg-white dark:bg-gray-900 p-4">
            <AIpowerInsights fetchTableData={fetchTableData} performOperation={performOperation} storeId={storeId} />
          </div>
        );
      case 'Admin Ops':
        if (!allowedDashboards.includes('admin_ops')) {
          return <div className="w-full bg-white dark:bg-gray-900 p-4">Access Denied: You do not have permission to view Admin Ops.</div>;
        }
        return (
          <div className="w-full bg-white dark:bg-gray-900 p-4">
            <AdminOps fetchTableData={fetchTableData} performOperation={performOperation} storeId={storeId} />
          </div>
        );
      case 'Notifications':
        return (
          <div className="w-full bg-white dark:bg-gray-900 p-4">
            <Notifications fetchTableData={fetchTableData} performOperation={performOperation} storeId={storeId} />
          </div>
        );
      case 'Store Admins':
        return (
          <div className="w-full bg-white dark:bg-gray-900 p-4">
            <StoreAdmins fetchTableData={fetchTableData} performOperation={performOperation} storeId={storeId} />
          </div>
        );
      case 'Employees':
        return (
          <div className="w-full bg-white dark:bg-gray-900 p-4">
            <Employees fetchTableData={fetchTableData} performOperation={performOperation} storeId={storeId} />
          </div>
        );
      case 'Upgrade':
        return (
          <div className="w-full bg-white dark:bg-gray-900 p-4">
            <PricingFeatures />
          </div>
        );
      case 'Profile':
        return (
          <div className="w-full bg-white dark:bg-gray-900 p-4">
            <Profile />
          </div>
        );
      default:
        return (
          <div className="w-full bg-white dark:bg-gray-900 p-4">
            Dashboard Content
          </div>
        );
    }
  };

  // Handle navigation click
  const handleNavClick = (tab) => {
    if (tab === 'Home') {
      navigate('/');
    } else {
      if (
        (tab === 'Fix Scan' && !allowedDashboards.includes('fix_scan')) ||
        (tab === 'Flex Scan' && !allowedDashboards.includes('flex_scan')) ||
        (tab === 'AI Insights' && !allowedDashboards.includes('ai_insights')) ||
        (tab === 'Admin Ops' && !allowedDashboards.includes('admin_ops'))
      ) {
        setActiveTab(tab); // Allow selection to show "Access Denied"
        return;
      }
      setActiveTab(tab);
      setSidebarOpen(false);
    }
  };

  // Navigation items
  const navItems = [
    { name: 'Home', icon: FaHome, aria: 'Home: Go to the landing page', dataTour: 'home' },
    {
      name: 'Flex Scan',
      icon: FaBarcode,
      aria: 'Flex Scan: Access your store management tools',
      dataTour: 'toolkits',
      disabled: !allowedDashboards.includes('flex_scan'),
    },
    {
      name: 'Fix Scan',
      icon: FaQrcode,
      aria: 'Fix Scan: Fixed barcode scanning',
      dataTour: 'fix-scan',
      disabled: !allowedDashboards.includes('fix_scan'),
    },
    {
      name: 'AI Insights',
      icon: FaRobot,
      aria: 'AI Insights: Access AI-powered insights',
      dataTour: 'ai-insights',
      disabled: !allowedDashboards.includes('ai_insights'),
    },
    {
      name: 'Admin Ops',
      icon: FaUserShield,
      aria: 'Admin Operations: Manage store operations',
      dataTour: 'admin-ops',
      disabled: !allowedDashboards.includes('admin_ops'),
    },
    {
      name: 'Notifications',
      icon: FaBell,
      aria: 'Notifications: Stay updated with store-related notifications',
      dataTour: 'notifications',
    },
    {
      name: 'Employees',
      icon: FaIdBadge,
      aria: 'Employees: Manage your employees',
      dataTour: 'colleagues',
    },
    {
      name: 'Store Admins',
      icon: FaUsersCog,
      aria: 'Manage your staff and assign roles',
      dataTour: 'store-admins',
    },
    {
      name: 'Profile',
      icon: FaUser,
      aria: 'Profile: View and edit your profile',
      dataTour: 'profile',
    },
    {
      name: 'Upgrade',
      icon: FaCrown,
      aria: 'Upgrade: Upgrade your plan for more features',
      dataTour: 'upgrade',
    },
  ];

  // Toggle sidebar
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Onboarding Tour */}
      <UserOnboardingTour
        isOpen={isTourOpen}
        onClose={handleTourClose}
        setActiveTab={setActiveTab}
      />
      {/* Sidebar */}
      <aside
        className={`fixed md:static top-0 left-0 h-full transition-all duration-300 bg-white dark:bg-gray-900 z-40 ${
          sidebarOpen ? 'w-64' : 'w-0 md:w-16'
        } ${sidebarOpen ? 'block' : 'hidden md:block'}`}
      >
        <div className="p-4 md:p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-xl font-bold text-indigo-800 dark:text-white ${sidebarOpen ? 'block' : 'hidden'}`}>
              Menu
            </h2>
            {/* Mobile Close Button */}
            <button
              onClick={toggleSidebar}
              className="text-indigo-800 dark:text-indigo-200 md:hidden"
              aria-label="Close sidebar"
            >
              <FaTimes size={24} />
            </button>
          </div>
          <nav className="pt-4">
            <ul className="space-y-2">
              {navItems.map((item) => (
                <li
                  key={item.name}
                  data-tour={item.name.toLowerCase().replace(' ', '-')}
                  onClick={() => !item.disabled && handleNavClick(item.name)}
                  className={`flex items-center p-2 rounded cursor-pointer transition ${
                    item.disabled
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-indigo-200 dark:hover:bg-indigo-600'
                  } ${activeTab === item.name ? 'bg-indigo-200 dark:bg-indigo-600' : ''}`}
                  aria-label={item.aria}
                  title={item.disabled ? 'This feature is locked' : item.aria}
                >
                  <item.icon
                    className={`text-indigo-800 dark:text-indigo-200 ${sidebarOpen ? 'mr-3' : 'mx-auto'}`}
                  />
                  <span className={`text-indigo-800 dark:text-indigo-200 ${sidebarOpen ? 'block' : 'hidden'}`}>
                    {item.name}
                    {item.disabled && sidebarOpen && (
                      <span className="ml-2 text-xs text-red-500">(Locked)</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="flex-1 flex flex-col justify-between">
          {/* Dark/Light Mode Toggle */}
          <div
            data-tour="dark-mode"
            className={`p-4 md:p-4 mt-auto flex items-center justify-between ${sidebarOpen ? 'block' : 'hidden md:flex'}`}
          >
            <span className={`text-indigo-800 dark:text-indigo-200 ${sidebarOpen ? 'block' : 'hidden'}`}>
              {darkMode ? 'Dark Mode' : 'Light Mode'}
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only"
                checked={darkMode}
                onChange={() => setDarkMode(!darkMode)}
              />
              <div className="w-11 h-6 bg-indigo-800 dark:bg-gray-600 rounded-full transition-colors duration-300">
                <span
                  className={`absolute left-1 top-1 bg-white dark:bg-indigo-200 w-4 h-4 rounded-full transition-transform duration-300 ${
                    darkMode ? 'translate-x-5' : ''
                  }`}
                ></span>
              </div>
            </label>
          </div>
        </div>
      </aside>

      {/* Floating Toggle Button (Desktop Only) */}
      <button
        onClick={toggleSidebar}
        className={`fixed top-4 md:top-4 transition-all duration-300 z-50 rounded-full p-2 bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 md:block hidden ${
          sidebarOpen ? 'left-64' : 'left-4'
        }`}
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {sidebarOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
      </button>

      {/* Main Content */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          sidebarOpen ? 'md:ml-64' : 'md:ml-0'
        }`}
      >
        {/* Mobile Header */}
        <header className="flex md:hidden items-center justify-between p-4 bg-white dark:bg-gray-800">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-indigo-800 dark:text-indigo-200"
            aria-label="Open sidebar"
          >
            <FaBars size={24} />
          </button>
          <h1 className="text-xl font-bold text-indigo-800 dark:text-indigo-200">
            {activeTab}
          </h1>
          <button
            onClick={() => {
              localStorage.removeItem('hasSeenTour');
              setIsTourOpen(true);
            }}
            className="text-indigo-800 dark:text-indigo-200 text-sm"
          >
            Restart Tour
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-4">{renderContent()}</main>
      </div>
    </div>
  );
};

export default Dashboard;