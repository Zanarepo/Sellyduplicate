import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaMoneyBillWave,
  FaUser,
  FaBars,
  FaTimes,
  FaBarcode,
  FaQrcode,
  FaBell,
  FaIdBadge,
  FaHome,
  FaRobot,
  FaUserShield,
} from 'react-icons/fa';
import { supabase } from '../../supabaseClient';
import StoreUsersTour from './StoreUsersTour';
import WhatsapUsers from './WhatsapUsers';
import StoreUserProfile from './StoreUsersProfile';
import Colleagues from './Colleagues';
import StoresSalesSummary from '../Ops/StoresSalesSummary';
import Notifications from './Notifications';
import StoreUsersVariex from './StoreUsersVariex';
import UsersERetailStores from './UsersERetailStores';
import AIpowerInsights from './AIpowerInsights';
import AdminOps from './AdminOps';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('Fix Scan');
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [allowedDashboards, setAllowedDashboards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Fetch allowed dashboards from Supabase using store_id from local storage
  useEffect(() => {
    const fetchAllowedDashboards = async () => {
      try {
        setIsLoading(true);
        const storeId = localStorage.getItem('store_id');
        if (!storeId) {
          console.warn('No store_id found in local storage');
          navigate('/login');
          return;
        }

        const { data, error } = await supabase
          .from('stores')
          .select('allowed_dashboard')
          .eq('id', storeId)
          .single();

        if (error) {
          console.error('Error fetching allowed dashboards:', error);
          setAllowedDashboards([]);
          return;
        }

        // Debug: Log raw data
        console.log('Raw allowed_dashboard data:', data?.allowed_dashboard);

        // Handle different data formats
        let dashboards = [];
        if (Array.isArray(data?.allowed_dashboard)) {
          dashboards = data.allowed_dashboard.map(item => item.trim().toLowerCase());
        } else if (typeof data?.allowed_dashboard === 'string') {
          dashboards = data.allowed_dashboard.split(',').map(item => item.trim().toLowerCase());
        } else {
          console.warn('Unexpected allowed_dashboard format:', data?.allowed_dashboard);
        }

        // Debug: Log processed dashboards
        console.log('Processed allowedDashboards:', dashboards);

        setAllowedDashboards(dashboards);
      } catch (err) {
        console.error('Unexpected error:', err);
        setAllowedDashboards([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllowedDashboards();
  }, [navigate]);

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
      if (activeTab === 'Fix Scan' && !allowedDashboards.includes('fix_scan')) {
        console.log('Fix Scan not allowed, falling back to Home');
        setActiveTab('Home');
      } else if (activeTab === 'Flex Scan' && !allowedDashboards.includes('flex_scan')) {
        console.log('Flex Scan not allowed, falling back to Home');
        setActiveTab('Home');
      }
    }
  }, [allowedDashboards, isLoading, activeTab]);

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
      return <div className="w-full bg-white dark:bg-gray-900 rounded-lg shadow p-4">Loading...</div>;
    }

    switch (activeTab) {
      case 'Sales Summary':
        if (!allowedDashboards.includes('sales_summary')) {
          return (
            <div className="w-full bg-white dark:bg-gray-900 rounded-lg shadow p-4">
              Access Denied: You do not have permission to view Sales Summary.
            </div>
          );
        }
        return (
          <div className="w-full bg-white dark:bg-gray-900 rounded-lg shadow p-4">
            <StoresSalesSummary />
          </div>
        );
      case 'AI Insights':
        if (!allowedDashboards.includes('ai_insights')) { 
          return (
            <div className="w-full bg-white dark:bg-gray-900 rounded-lg shadow p-4">
              Access Denied: You do not have permission to view AI Insights.
            </div>
          );
        }
        return (
          <div className="w-full bg-white dark:bg-gray-900 rounded-lg shadow p-4">
            <AIpowerInsights />
          </div>
        );

      case 'Flex Scan':
        if (!allowedDashboards.includes('flex_scan')) {
          return (
            <div className="w-full bg-white dark:bg-gray-900 rounded-lg shadow p-4">
              Access Denied: You do not have permission to view Flex Scan.
            </div>
          );
        }
        

        return (
          <div className="w-full bg-white dark:bg-gray-900 rounded-lg shadow p-4">
            <StoreUsersVariex />
          </div>
        );
      case 'Fix Scan':
        if (!allowedDashboards.includes('fix_scan')) {
          return (
            <div className="w-full bg-white dark:bg-gray-900 rounded-lg shadow p-4">
              Access Denied: You do not have permission to view Fix Scan.
            </div>
          );
        }
        return (
          <div className="w-full bg-white dark:bg-gray-900 rounded-lg shadow p-4">
            <UsersERetailStores />
          </div>
        );
      case 'Admin Ops':
        if (!allowedDashboards.includes('admin_ops')) {
          return (
            <div className="w-full bg-white dark:bg-gray-900 rounded-lg shadow p-4">
              Access Denied: You do not have permission to view Admin Operations.
            </div>
          );
        } 
        return (
          <div className="w-full bg-white dark:bg-gray-900 rounded-lg shadow p-4">
            <AdminOps/>
          </div>
        );



      case 'Profile':
        return (
          <div className="w-full bg-white dark:bg-gray-700 rounded-lg shadow p-4">
            <StoreUserProfile />
          </div>
        );
      case 'Colleagues':
        return (
          <div className="w-full bg-white dark:bg-gray-700 rounded-lg shadow p-4">
            <Colleagues />
          </div>
        );
      case 'Notifications':
        return (
          <div className="w-full bg-white dark:bg-gray-900 rounded-lg shadow p-4">
            <Notifications />
          </div>
        );
      default:
        return (
          <div className="w-full bg-white dark:bg-gray-900 rounded-lg shadow p-4">
            Dashboard Content
          </div>
        );
    }
  };

  // Handle navigation click: update active tab and close sidebar on mobile
  const handleNavClick = (tab) => {
    if (tab === 'Home') {
      navigate('/');
    } else {
      if (
        (tab === 'Fix Scan' && !allowedDashboards.includes('fix_scan')) ||
        (tab === 'Flex Scan' && !allowedDashboards.includes('flex_scan')) ||
        (tab === 'AI Insights' && !allowedDashboards.includes('ai_insights'))||
        (tab === 'Admin Ops' && !allowedDashboards.includes('admin_ops'))||
        (tab === 'Sales Summary' && !allowedDashboards.includes('sales_summary')) ||
        (tab === 'Notifications' && !allowedDashboards.includes('notifications')) ||
        (tab === 'Colleagues' && !allowedDashboards.includes('colleagues')) ||
        (tab === 'Profile' && !allowedDashboards.includes('profile'))
      ) {
        setActiveTab(tab); // Allow selection to show "Access Denied"
        return;
      }
      setActiveTab(tab);
      setSidebarOpen(false);
    }
  };

  // Navigation items (always include Fix Scan and Flex Scan)
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
      name: 'Sales Summary',
      icon: FaMoneyBillWave,
      aria: 'Sales Dashboard: View and analyze sales data',
      dataTour: 'sales-summary',
      
    },
    {
      name: 'Notifications',
      icon: FaBell,
      aria: 'Notifications: Stay updated with store-related notifications',
      dataTour: 'notifications',
    },
    {
      name: 'Colleagues',
      icon: FaIdBadge,
      aria: 'Colleagues: Manage your colleagues',
      dataTour: 'colleagues',
    },
    {
      name: 'Profile',
      icon: FaUser,
      aria: 'Profile: View and edit your profile',
      dataTour: 'profile',
    },
  ];

  // Toggle sidebar
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 mt-24">
      <WhatsapUsers />
      <StoreUsersTour
        isOpen={isTourOpen}
        onClose={handleTourClose}
        setActiveTab={setActiveTab}
      />
      <aside
        className={`fixed md:static top-0 left-0 h-full transition-all duration-300 bg-gray-100 dark:bg-gray-800 z-40 ${
          sidebarOpen ? 'w-64' : 'w-0 md:w-16'
        } ${sidebarOpen ? 'block' : 'hidden md:block'}`}
      >
        <div className="p-4 md:p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-xl font-bold text-indigo-800 dark:text-indigo-200 ${sidebarOpen ? 'block' : 'hidden'}`}>
              Menu
            </h2>
            <button
              onClick={toggleSidebar}
              className="text-indigo-800 dark:text-indigo-200 md:hidden"
              aria-label="Close sidebar"
            >
              <FaTimes size={24} />
            </button>
          </div>
          <nav className="pt-8">
            <ul className="space-y-2">
              {navItems.map((item) => (
                <li
                  key={item.name}
                  data-tour={item.dataTour}
                  onClick={() => !item.disabled && handleNavClick(item.name)}
                  className={`flex items-center p-2 rounded cursor-pointer transition ${
                    item.disabled
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-indigo-300 dark:hover:bg-indigo-600'
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
        <div
          className={`p-4 md:p-6 mt-auto flex items-center justify-between ${sidebarOpen ? 'block' : 'hidden md:flex'}`}
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
      </aside>

      <button
        onClick={toggleSidebar}
        className={`fixed top-4 md:top-4 transition-all duration-300 z-50 rounded-full p-2 bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 md:block hidden ${
          sidebarOpen ? 'left-64' : 'left-4'
        }`}
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {sidebarOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
      </button>

      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          sidebarOpen ? 'md:ml-64' : 'md:ml-0'
        }`}
      >
        <header className="flex md:hidden items-center justify-between p-4 bg-white dark:bg-gray-800">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-indigo-800 dark:text-indigo-200"
            aria-label="Open sidebar"
          >
            <FaBars size={24} />
          </button>
          <h1 className="text-xl font-bold text-indigo-800 dark:text-indigo-200">{activeTab}</h1>
          <button
            onClick={() => {
              localStorage.removeItem('hasSeenTour');
              setIsTourOpen(true);
            }}
            className="text-indigo-800 dark:text-indigo-200 text-sm"
          >
           
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-4">{renderContent()}</main>
      </div>
    </div>
  );
};

export default Dashboard;