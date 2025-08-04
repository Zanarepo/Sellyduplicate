import React, { useState, useEffect, useCallback, Component } from 'react';
import { supabase } from '../../supabaseClient';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FaSave, FaUserEdit, FaSync, FaTrash, FaSearch } from 'react-icons/fa';
import DashboardAccess from '../Ops/DashboardAccess';

// Error boundary for ToastContainer
class ToastErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return null; // Silently fail to prevent breaking the UI
    }
    return this.props.children;
  }
}

// Role-to-feature mapping
const roleFeatureMap = {
  account: ['expenses', 'debts', 'receipts', 'sales summary'],
  sales: ['sales', 'products', 'inventory', 'receipts', 'returns'],
  'store manager': ['sales', 'products', 'inventory', 'receipts', 'returns', 'expenses', 'unpaid supplies', 'debts', 'customers', 'suppliers'],
  marketing: ['customers'],
  admin: ['sales', 'products', 'inventory', 'receipts', 'returns', 'expenses', 'unpaid supplies', 'debts', 'customers', 'suppliers'],
};

// Available features for manual override
const availableFeatures = [
  'sales',
  'Products & Pricing Tracker',
  'inventory',
  'receipts',
  'returns',
  'expenses',
  'unpaid supplies',
  'debts',
  'customers',
  'Suppliers',
  'Sales Summary',
];

export default function StoreAdminDashboard() {
  const [storeId, setStoreId] = useState(null);
  const [shopName, setShopName] = useState('Store');
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);
  const [editingUserId, setEditingUserId] = useState(null);
  const [userRoles, setUserRoles] = useState({});
  const [userFeatures, setUserFeatures] = useState({});
  const [sortOrder, setSortOrder] = useState('asc');

  // Fetch store_id and shop_name
  useEffect(() => {
    const fetchStoreData = async () => {
      try {
        toast.dismiss(); // Clear any existing toasts
        const storeIdRaw = localStorage.getItem('store_id');
        
        // Validate storeId
        if (!storeIdRaw || storeIdRaw === 'null' || isNaN(parseInt(storeIdRaw))) {
          toast.error('Invalid or missing store ID. Please log in again.', { toastId: 'invalid-store-id' });
          setError('Invalid or missing store ID.');
          return;
        }

        const storeId = parseInt(storeIdRaw); // Convert to integer
        setStoreId(storeId);

        const { data, error } = await supabase
          .from('stores')
          .select('shop_name')
          .eq('id', storeId)
          .single();

        if (error) {
          toast.error('Failed to load store data.', { toastId: 'store-data-error' });
          setError('Failed to load store data.');
          return;
        }

        setShopName(data?.shop_name || 'Store');
      } catch (err) {
        toast.error('An error occurred while loading store data.', { toastId: 'store-data-catch' });
        setError('An error occurred while loading store data.');
      }
    };

    fetchStoreData();
  }, []);

  // Clean up toasts on component unmount
  useEffect(() => {
    return () => {
      toast.dismiss(); // Dismiss all toasts when component unmounts
    };
  }, []);

  // Load employees
  const loadEmployees = useCallback(
    async (order) => {
      try {
        toast.dismiss(); // Clear any existing toasts
        if (!storeId || isNaN(storeId)) {
          setError('No valid store ID found. Please log in again.');
          setEmployees([]);
          setFilteredEmployees([]);
          toast.error('No valid store ID found.', { toastId: 'no-store-id' });
          return;
        }

        // Fetch employees for the current store
        const { data, error } = await supabase
          .from('store_users')
          .select('id, store_id, email_address, role, allowed_features')
          .eq('store_id', storeId)
          .order('id', { ascending: order === 'asc' });
        if (error) {
          throw new Error(`Error fetching employees: ${error.message}`);
        }

        // Map employees to include shop_name
        const employeesWithShop = (data ?? []).map((employee) => ({
          ...employee,
          shop_name: shopName || 'N/A', // Use shopName from state
        }));

        setEmployees(employeesWithShop);
        setFilteredEmployees(employeesWithShop);
        setError(null);

        // Initialize userRoles and userFeatures
        const roles = {};
        const features = {};
        employeesWithShop.forEach((employee) => {
          roles[employee.id] = employee.role || '';
          features[employee.id] = employee.allowed_features || [];
        });
        setUserRoles(roles);
        setUserFeatures(features);
      } catch (err) {
        console.error(err.message);
        setEmployees([]);
        setFilteredEmployees([]);
        setError(err.message);
        toast.error(err.message, { toastId: 'load-employees-error' });
      }
    },
    [storeId, shopName]
  );

  // Filter employees based on search query
  useEffect(() => {
    const filtered = employees.filter(
      (employee) =>
        employee.email_address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.role?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredEmployees(filtered);
  }, [searchQuery, employees]);

  useEffect(() => {
    if (!storeId) {
      setError('Admin Access.');
      return;
    }
    loadEmployees(sortOrder);
  }, [storeId, sortOrder, loadEmployees]);

  const handleRoleChange = (userId, role) => {
    setUserRoles((prev) => ({ ...prev, [userId]: role }));
    // Auto-set features based on role
    setUserFeatures((prev) => ({
      ...prev,
      [userId]: roleFeatureMap[role] || [],
    }));
  };

  const handleFeatureToggle = (userId, feature) => {
    setUserFeatures((prev) => {
      const currentFeatures = prev[userId] || [];
      if (currentFeatures.includes(feature)) {
        return { ...prev, [userId]: currentFeatures.filter((f) => f !== feature) };
      }
      return { ...prev, [userId]: [...currentFeatures, feature] };
    });
  };

  const saveUserChanges = async (userId) => {
    try {
      toast.dismiss(); // Clear all toasts before saving
      const role = userRoles[userId] || null;
      const features = userFeatures[userId] || [];

      const { error } = await supabase
        .from('store_users')
        .update({ role, allowed_features: features })
        .eq('id', userId)
        .eq('store_id', storeId);

      if (error) {
        toast.error('Failed to update user.', { toastId: 'update-user-error' });
        setError('Failed to update user.');
        return;
      }

      toast.success('User updated successfully.', { toastId: 'update-user-success' });
      setEditingUserId(null);
      await loadEmployees(sortOrder);
    } catch (err) {
      toast.error('An error occurred while updating user.', { toastId: 'update-user-catch' });
      setError('An error occurred while updating user.');
    }
  };

  const handleDelete = async (userId) => {
    try {
      toast.dismiss(); // Clear all toasts before deleting
      const { error } = await supabase
        .from('store_users')
        .delete()
        .eq('id', userId)
        .eq('store_id', storeId);
      if (error) {
        toast.error('Error deleting user.', { toastId: 'delete-user-error' });
        setError('Error deleting user.');
        return;
      }
      toast.success('User deleted successfully.', { toastId: 'delete-user-success' });
      await loadEmployees(sortOrder);
    } catch (err) {
      toast.error('Error deleting user.', { toastId: 'delete-user-catch' });
      setError('Error deleting user.');
    }
  };

  const renderContent = () => {
    if (error) {
      return (
        <div className="w-full bg-white dark:bg-gray-900 p-4 max-w-7xl mx-auto mt-48">
          <div className="text-red-500 dark:text-red-400 text-sm sm:text-base">{error}</div>
        </div>
      );
    }

    return (
      <div className="w-full bg-white dark:bg-gray-900 p-4 max-w-7xl mx-auto ">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <h2 className="text-lg sm:text-2xl font-semibold text-indigo-700 dark:text-indigo-200">
            Manage Staff Access & Roles
          </h2>
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search by email or role"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-2 pl-8 border rounded bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm sm:text-base"
              />
              <FaSearch className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
            <div className="flex space-x-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  loadEmployees(sortOrder === 'asc' ? 'desc' : 'asc');
                }}
                className="flex-1 sm:flex-none flex items-center justify-center bg-indigo-600 text-white px-2 sm:px-3 py-2 rounded hover:bg-indigo-700 text-sm sm:text-base"
                title="Sort"
              >
                <FaSync className="mr-0 sm:mr-2" />
                <span className="hidden sm:inline">Sort {sortOrder === 'asc' ? 'Desc' : 'Asc'}</span>
              </button>
              <button
                onClick={() => loadEmployees(sortOrder)}
                className="flex-1 sm:flex-none flex items-center justify-center bg-indigo-600 text-white px-2 sm:px-3 py-2 rounded hover:bg-indigo-700 text-sm sm:text-base"
                title="Refresh"
              >
                <FaSync className="mr-0 sm:mr-2" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          {filteredEmployees.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
              {searchQuery ? 'No users match your search.' : 'No Staff found for this store.'}
            </p>
          ) : (
            filteredEmployees.map((user) => (
              <div
                key={user.id}
                className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <p className="text-indigo-800 dark:text-white font-medium text-sm sm:text-base">
                      {user.email_address || 'Unknown'}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">
                      Store: {user.shop_name}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">
                      Role: {userRoles[user.id] || 'None'}
                    </p>
                  </div>
                  <div className="flex space-x-2 w-full sm:w-auto">
                    <button
                      onClick={() =>
                        setEditingUserId(editingUserId === user.id ? null : user.id)
                      }
                      className="flex-1 sm:flex-none flex items-center justify-center bg-indigo-600 text-white px-3 py-2 rounded hover:bg-indigo-700 text-sm sm:text-base"
                    >
                      <FaUserEdit className="mr-2" /> {editingUserId === user.id ? 'Cancel' : 'Edit'}
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="flex-1 sm:flex-none flex items-center justify-center bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 text-sm sm:text-base"
                    >
                      <FaTrash className="mr-2" /> Delete
                    </button>
                  </div>
                </div>
                {editingUserId === user.id && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="text-gray-700 dark:text-gray-300 text-sm">Assign Role:</label>
                      <select
                        value={userRoles[user.id] || ''}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className="mt-1 p-2 border rounded w-full bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm sm:text-base"
                      >
                        <option value="">Select Role</option>
                        <option value="account">Account</option>
                        <option value="sales">Sales</option>
                        <option value="store manager">Store Manager</option>
                        <option value="marketing">Marketing</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-gray-700 dark:text-gray-300 text-sm">Features:</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                        {availableFeatures.map((feature) => (
                          <label key={feature} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={(userFeatures[user.id] || []).includes(feature)}
                              onChange={() => handleFeatureToggle(user.id, feature)}
                              className="form-checkbox text-indigo-600 h-5 w-5"
                            />
                            <span className="text-gray-700 dark:text-gray-300 text-sm">
                              {feature}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => saveUserChanges(user.id)}
                      className="flex items-center bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 w-full sm:w-auto"
                    >
                      <FaSave className="mr-2" /> Save
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 w-full px-2 sm:px-4">
      <ToastErrorBoundary>
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="colored"
          limit={1}
        />
      </ToastErrorBoundary>
      <DashboardAccess />
      <header className="text-center mb-4 sm:mb-6">
        <h1 className="text-lg sm:text-3xl font-bold text-indigo-800 dark:text-white">
          Welcome, {shopName}!
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2 text-xs sm:text-sm">
          Manage your store’s staff and their access.
        </p>
      </header>
      {renderContent()}
    </div>
  );
}