import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaMoneyBillWave,
  FaBell,
  FaUser,
  FaBars,
  FaTimes,
  FaStore,
  FaBarcode,
  FaQrcode,
  FaIdBadge,
  FaCrown,
  FaHome,
} from 'react-icons/fa';
import OnboardingTour from './DashboardTour';
import Test from '../UserDashboard/Test';
import WhatsapUsers from '../UserDashboard/WhatsapUsers';
import MyStores from '../Ops/MyStores';
import Profile from '../UserDashboard/Profile';
import StoreOwnersEmployees from '../UserDashboard/StoreOwnersEmployees';
import MultiSales from './MultiSales';
import MultiInventory from './MultiInventory';
import StoreNotications from './StoreNotications';
import MultiDebt from './MultiDebt';
import PricingFeatures from '../Payments/PricingFeatures';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('My Stores');
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Default open on desktop
  const [isTourOpen, setIsTourOpen] = useState(false);
  const navigate = useNavigate();

  // Check if tour has been shown before
  useEffect(() => {
    const hasSeenTour = localStorage.getItem('hasSeenTour');
    if (!hasSeenTour) {
      setIsTourOpen(true);
    }
  }, []);

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
    switch (activeTab) {
      case 'My Stores':
        return (
          <div className="w-full bg-white dark:bg-gray-900 p-4">
            <MyStores />
          </div>
        );
      case 'Multi Sales':
        return (
          <div className="w-full bg-white dark:bg-gray-900 p-4">
            <MultiSales />
          </div>
        );
      case 'Multi Inventory':
        return (
          <div className="w-full bg-white dark:bg-gray-900 p-4">
            <MultiInventory />
          </div>
        );
      case 'Multi Debts':
        return (
          <div className="w-full bg-white dark:bg-gray-900 p-4">
            <MultiDebt />
          </div>
        );
      case 'VDashboard':
        return (
          <div className="w-full bg-white dark:bg-gray-900 p-4">
            {/* Placeholder for VDashboard content */}
            VDashboard Content
          </div>
        );
      case 'Test':
        return (
          <div className="w-full bg-white dark:bg-gray-900 p-4">
            <Test />
          </div>
        );
      case 'Upgrade':
        return (
          <div className="w-full bg-white dark:bg-gray-900 p-4">
            <PricingFeatures />
          </div>
        );
      case 'Variex':
        return (
          <div className="w-full bg-white dark:bg-gray-900 p-4">
            {/* Placeholder for Variex content */}
            Variex Content
          </div>
        );
      case 'Employees':
        return (
          <div className="w-full bg-white dark:bg-gray-900 p-4">
            <StoreOwnersEmployees />
          </div>
        );
      case 'Profile':
        return (
          <div className="w-full bg-white dark:bg-gray-900 p-4">
            <Profile />
          </div>
        );
      case 'Store Notifications':
        return (
          <div className="w-full bg-white dark:bg-gray-800 p-4">
            <StoreNotications />
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

  // Handle navigation click: update active tab and close sidebar on mobile
  const handleNavClick = (tab) => {
    if (tab === 'Home') {
      navigate('/');
    } else {
      setActiveTab(tab);
      setSidebarOpen(false); // Close sidebar on mobile
    }
  };

  // Toggle sidebar
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <WhatsapUsers />
      {/* Onboarding Tour */}
      <OnboardingTour
        isOpen={isTourOpen}
        onClose={handleTourClose}
        setActiveTab={setActiveTab}
      />
      {/* Sidebar */}
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
            {/* Mobile Close Button */}
            <button
              onClick={toggleSidebar}
              className="text-indigo-800 dark:text-indigo-200 md:hidden"
              aria-label="Close sidebar"
            >
              <FaTimes size={24} />
            </button>
          </div>
          <nav className="mt-8 pt-4">
            <ul className="space-y-2">
              {[
                { name: 'Home', icon: FaHome, aria: 'Home: Go to the landing page' },
                { name: 'My Stores', icon: FaStore, aria: 'Stores Dashboard: Manage your stores and their details' },
                { name: 'Multi Sales', icon: FaQrcode, aria: 'Sales Dashboard: View and analyze sales across stores' },
                { name: 'Multi Inventory', icon: FaBarcode, aria: 'Inventory Dashboard: Manage inventory across all stores' },
                { name: 'Multi Debts', icon: FaMoneyBillWave, aria: 'Debtors Dashboard: Track and manage debts' },
                { name: 'Store Notifications', icon: FaBell, aria: 'Notifications: View store-related notifications' },
                { name: 'Upgrade', icon: FaCrown, aria: 'Upgrade: Upgrade your plan for more features' },
                { name: 'Employees', icon: FaIdBadge, aria: 'Employees: Manage store employees' },
                { name: 'Profile', icon: FaUser, aria: 'Profile: View and edit your profile' },
              ].map((item) => (
                <li
                  key={item.name}
                  data-tour={item.name.toLowerCase().replace(' ', '-')}
                  onClick={() => handleNavClick(item.name)}
                  className={`flex items-center p-2 rounded cursor-pointer hover:bg-indigo-200 dark:hover:bg-indigo-600 transition ${
                    activeTab === item.name ? 'bg-indigo-200 dark:bg-indigo-600' : ''
                  }`}
                  aria-label={item.aria}
                >
                  <item.icon className={`text-indigo-800 dark:text-indigo-200 ${sidebarOpen ? 'mr-3' : 'mx-auto'}`} />
                  <span className={`text-indigo-800 dark:text-indigo-200 ${sidebarOpen ? 'block' : 'hidden'}`}>
                    {item.name}
                  </span>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        {/* Dark/Light Mode Toggle */}
        <div
          data-tour="dark-mode"
          className={`p-6 mt-auto flex items-center justify-between ${sidebarOpen ? 'block' : 'flex'}`}
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
          sidebarOpen ? 'md:ml-64' : 'md:ml-16'
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
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-4">{renderContent()}</main>
      </div>
    </div>
  );
};

export default Dashboard;