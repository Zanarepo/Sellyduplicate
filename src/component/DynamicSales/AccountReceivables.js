import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Fallback for Heroicons in case the package is not installed
let MagnifyingGlassIcon, CalendarIcon, XMarkIcon;
try {
  ({ MagnifyingGlassIcon, CalendarIcon, XMarkIcon } = require('@heroicons/react/24/outline'));
} catch (e) {
  console.warn('Heroicons not installed. Please run `npm install @heroicons/react`. Using text fallback.');
  MagnifyingGlassIcon = () => <span>🔍</span>;
  CalendarIcon = () => <span>📅</span>;
  XMarkIcon = () => <span>❌</span>;
}

export default function AccountsReceivable() {
  const storeId = localStorage.getItem('store_id');
  const [arEntries, setArEntries] = useState([]);
  const [filteredAr, setFilteredAr] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [agingFilter, setAgingFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const entriesPerPage = 10;

  useEffect(() => {
    if (!storeId) {
      toast.error('No store selected. Please choose a store.');
      return;
    }
    fetchArEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  useEffect(() => {
    const filtered = arEntries.filter(entry => {
      const matchesSearch = searchTerm
        ? entry.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      const daysOverdue = Math.floor(
        (new Date() - new Date(entry.date)) / (1000 * 60 * 60 * 24)
      );
      const matchesAging = agingFilter
        ? (agingFilter === '0-30' && daysOverdue <= 30) ||
          (agingFilter === '31-60' && daysOverdue > 30 && daysOverdue <= 60) ||
          (agingFilter === '61-90' && daysOverdue > 60 && daysOverdue <= 90) ||
          (agingFilter === '90+' && daysOverdue > 90)
        : true;
      return matchesSearch && matchesAging;
    });
    setFilteredAr(filtered);
    setCurrentPage(1); // Reset to page 1 when filters change
  }, [searchTerm, agingFilter, arEntries]);

  async function fetchArEntries() {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('debts')
      .select('*')
      .eq('store_id', storeId)
      .gt('remaining_balance', 0)
      .order('date', { ascending: false });
    if (error) {
      toast.error('Can’t load debts: ' + error.message);
    } else {
      console.log('Fetched data:', data); // Debug log (remove in production)
      setArEntries(data || []);
      setFilteredAr(data || []);
    }
    setIsLoading(false);
  }

  async function fetchCustomerDetails(customerId) {
    const { data, error } = await supabase
      .from('customer')
      .select('fullname, phone_number, address')
      .eq('id', customerId)
      .single();
    if (error) {
      toast.error('Can’t load customer details: ' + error.message);
      return null;
    }
    return data;
  }

  const handleCustomerClick = async (entry) => {
    const customerDetails = await fetchCustomerDetails(entry.customer_id);
    if (customerDetails) {
      setSelectedCustomer({
        ...customerDetails,
        customer_name: entry.customer_name,
      });
      setIsCustomerModalOpen(true);
    }
  };

  const handleProductClick = (entry) => {
    console.log('Selected entry:', entry); // Debug log (remove in production)
    let deviceIds = [];
    let sizes = [];
    let totalQty = 'Not provided';

    // Parse qty (used differently based on case)
    if (entry.qty) {
      totalQty = isNaN(parseInt(entry.qty, 10))
        ? 'Not provided'
        : parseInt(entry.qty, 10);
    }

    // Check for multiple items (device_id as comma-separated string)
    if (
      entry.device_id &&
      entry.device_id.trim() !== '' &&
      entry.device_id.includes(',')
    ) {
      deviceIds = Array.isArray(entry.device_id)
        ? entry.device_id
        : String(entry.device_id).split(',');
      // Use device_sizes as a comma-separated string for multiple items, if available
      sizes = entry.device_sizes && entry.device_sizes.trim() !== ''
        ? String(entry.device_sizes).split(',')
        : new Array(deviceIds.length).fill('Not provided');
      // Ensure sizes array matches deviceIds length
      sizes = sizes.length >= deviceIds.length
        ? sizes.slice(0, deviceIds.length)
        : [...sizes, ...new Array(deviceIds.length - sizes.length).fill('Not provided')];
    }
    // Check for single item (device_id as single string)
    else if (
      entry.device_id &&
      entry.device_id.trim() !== ''
    ) {
      deviceIds = [String(entry.device_id)];
      sizes = [entry.device_sizes && entry.device_sizes.trim() !== ''
        ? String(entry.device_sizes)
        : 'Not provided'];
    }

    const items = deviceIds.length > 0
      ? deviceIds.map((id, index) => ({
          device_id: id?.trim() || 'Not provided',
          size: sizes[index]?.trim() || 'Not provided',
          qty: entry.device_id && entry.device_id.includes(',') ? 1 : totalQty,
        }))
      : [{ device_id: 'Not provided', size: 'Not provided', qty: totalQty }];

    setSelectedProduct({
      product_name: entry.product_name || 'Unknown',
      items,
    });
    setIsProductModalOpen(true);
  };

  const closeCustomerModal = () => {
    setIsCustomerModalOpen(false);
    setSelectedCustomer(null);
  };

  const closeProductModal = () => {
    setIsProductModalOpen(false);
    setSelectedProduct(null);
  };

  // Handle Escape key to close modals
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        closeCustomerModal();
        closeProductModal();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  // Calculate totals
  const totals = filteredAr.reduce(
    (acc, entry) => {
      const daysOverdue = Math.floor(
        (new Date() - new Date(entry.date)) / (1000 * 60 * 60 * 24)
      );
      return {
        totalOwed: acc.totalOwed + (entry.remaining_balance || 0),
        overdue90Plus: acc.overdue90Plus + (daysOverdue > 90 ? entry.remaining_balance || 0 : 0),
      };
    },
    { totalOwed: 0, overdue90Plus: 0 }
  );

  // Pagination logic
  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = filteredAr.slice(indexOfFirstEntry, indexOfLastEntry);
  const totalPages = Math.ceil(filteredAr.length / entriesPerPage);

  const paginate = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setAgingFilter('');
    setCurrentPage(1);
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto dark:bg-gray-900 dark:text-white space-y-6">
      <ToastContainer />
      <h2 className="text-2xl sm:text-3xl font-bold text-center text-white bg-gradient-to-r from-indigo-400 to-indigo-600 py-4 rounded-lg">
        Money Owed to You
      </h2>
      <div className="flex flex-col gap-4 bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative w-full sm:w-1/2">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 hover:text-indigo-500 transition-colors" />
            <input
              type="text"
              placeholder="Search for a customer (e.g., 'Anna')"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 text-lg"
              aria-label="Search for a customer"
              title="Search for a customer"
            />
          </div>
          <div className="relative w-full sm:w-1/4">
            <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 hover:text-indigo-500 transition-colors" />
            <select
              value={agingFilter}
              onChange={e => setAgingFilter(e.target.value)}
              className="w-full pl-10 p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 text-lg"
              aria-label="Select overdue range"
              title="Filter by overdue range"
            >
              <option value="">All Overdue Ranges</option>
              <option value="0-30">Up to 30 Days</option>
              <option value="31-60">31-60 Days</option>
              <option value="61-90">61-90 Days</option>
              <option value="90+">Over 90 Days</option>
            </select>
          </div>
        </div>
        <button
          onClick={clearFilters}
          className="flex items-center justify-center w-full sm:w-auto px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-lg hover:scale-105 transition-transform"
          aria-label="Clear all filters"
          title="Reset all filters"
        >
          <XMarkIcon className="h-5 w-5 mr-2 hover:text-indigo-500 transition-colors" />
          Clear Filters
        </button>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6">
        <div className="bg-indigo-50 dark:bg-indigo-900 p-4 rounded-lg border border-indigo-200 dark:border-indigo-700 mb-4" aria-live="polite">
          <div className="flex flex-col sm:flex-row justify-around items-center gap-4">
            <div className="flex items-center text-lg font-semibold text-green-600 dark:text-green-400">
              Total Money Owed: ₦{totals.totalOwed.toFixed(2)}
            </div>
            <div className="flex items-center text-lg font-semibold text-red-600 dark:text-red-400">
              Overdue 90+ Days: ₦{totals.overdue90Plus.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-lg">
              Loading your debts...
            </div>
          ) : filteredAr.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-lg">
              No debts found. Try a different search or filter!
            </div>
          ) : (
            <>
              <table className="min-w-full text-lg">
                <thead className="bg-indigo-100 dark:bg-indigo-900 text-gray-900 dark:text-indigo-200 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium border-b dark:border-gray-700">Date</th>
                    <th className="text-left px-4 py-3 font-medium border-b dark:border-gray-700">Customer</th>
                    <th className="text-left px-4 py-3 font-medium border-b dark:border-gray-700">Item</th>
                    <th className="text-right px-4 py-3 font-medium border-b dark:border-gray-700">Amount Owed (₦)</th>
                    <th className="text-right px-4 py-3 font-medium border-b dark:border-gray-700">Still Owed (₦)</th>
                    <th className="text-right px-4 py-3 font-medium border-b dark:border-gray-700">Days Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {currentEntries.map(entry => {
                    const daysOverdue = Math.floor(
                      (new Date() - new Date(entry.date)) / (1000 * 60 * 60 * 24)
                    );
                    return (
                      <tr
                        key={entry.id}
                        className="border-b dark:border-gray-700 hover:bg-indigo-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <td className="px-4 py-3">{new Date(entry.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleCustomerClick(entry)}
                            className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 underline focus:ring-2 focus:ring-indigo-500"
                            aria-label={`View details for ${entry.customer_name}`}
                          >
                            {entry.customer_name}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleProductClick(entry)}
                            className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 underline focus:ring-2 focus:ring-indigo-500"
                            aria-label={`View details for ${entry.product_name}`}
                          >
                            {entry.product_name}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">₦{entry.owed.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">₦{entry.remaining_balance.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">{daysOverdue} days</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex flex-row flex-wrap justify-between items-center mt-4 px-4 gap-4">
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Showing {indexOfFirstEntry + 1} to {Math.min(indexOfLastEntry, filteredAr.length)} of {filteredAr.length} debts
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => paginate(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 rounded-lg text-sm font-medium ${
                      currentPage === 1
                        ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-800 dark:hover:bg-indigo-700'
                    }`}
                    aria-label="Previous page"
                  >
                    Previous
                  </button>
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => paginate(i + 1)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium ${
                        currentPage === i + 1
                          ? 'bg-indigo-600 text-white dark:bg-indigo-800 dark:text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                      aria-label={`Page ${i + 1}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => paginate(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1 rounded-lg text-sm font-medium ${
                      currentPage === totalPages
                        ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-800 dark:hover:bg-indigo-700'
                    }`}
                    aria-label="Next page"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      {isCustomerModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" role="dialog" aria-label="Customer details modal">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Customer Details</h3>
              <button
                onClick={closeCustomerModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:ring-2 focus:ring-indigo-500"
                aria-label="Close customer details modal"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4 text-lg">
              <p>
                <span className="font-semibold text-gray-900 dark:text-gray-100">Name:</span>{' '}
                {selectedCustomer.fullname}
              </p>
              <p>
                <span className="font-semibold text-gray-900 dark:text-gray-100">Phone Number:</span>{' '}
                {selectedCustomer.phone_number || 'Not provided'}
              </p>
              <p>
                <span className="font-semibold text-gray-900 dark:text-gray-100">Address:</span>{' '}
                {selectedCustomer.address || 'Not provided'}
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={closeCustomerModal}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 dark:bg-indigo-800 dark:hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {isProductModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" role="dialog" aria-label="Product details modal">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Product Details: {selectedProduct.product_name}</h3>
              <button
                onClick={closeProductModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:ring-2 focus:ring-indigo-500"
                aria-label="Close product details modal"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <table className="min-w-full text-lg">
                <thead className="bg-indigo-100 dark:bg-indigo-900 text-gray-900 dark:text-indigo-200">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Item ID</th>
                    <th className="text-left px-4 py-2 font-medium">Size</th>
                    <th className="text-right px-4 py-2 font-medium">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedProduct.items.map((item, index) => (
                    <tr key={index} className="border-b dark:border-gray-700">
                      <td className="px-4 py-2">{item.device_id}</td>
                      <td className="px-4 py-2">{item.size}</td>
                      <td className="px-4 py-2 text-right">{item.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={closeProductModal}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 dark:bg-indigo-800 dark:hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}