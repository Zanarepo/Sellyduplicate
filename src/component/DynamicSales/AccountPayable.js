import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Fallback for Heroicons
let MagnifyingGlassIcon, CalendarIcon, XMarkIcon;
try {
  ({ MagnifyingGlassIcon, CalendarIcon, XMarkIcon } = require('@heroicons/react/24/outline'));
} catch (e) {
  console.warn('Heroicons not installed. Please run `npm install @heroicons/react`. Using text fallback.');
  MagnifyingGlassIcon = () => <span>🔍</span>;
  CalendarIcon = () => <span>📅</span>;
  XMarkIcon = () => <span>❌</span>;
}

export default function AccountsPayable() {
  const storeId = localStorage.getItem('store_id');
  const [apEntries, setApEntries] = useState([]);
  const [filteredAp, setFilteredAp] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const entriesPerPage = 10;

 const fetchApEntries = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('accounts_payable')
      .select(`
        id,
        supplier_name,
        amount,
        status,
        transaction_date,
        dynamic_product_id,
        dynamic_product (name, device_id, dynamic_product_imeis, purchase_qty, device_size)
      `)
      .eq('store_id', storeId)
      .order('transaction_date', { ascending: false });
    if (error) {
      toast.error('Can’t load bills: ' + error.message);
      console.error('Supabase error:', error);
    } else {
      console.log('Fetched data:', data); // Debug log (remove in production)
      setApEntries(data || []);
      setFilteredAp(data || []);
    }
    setIsLoading(false);
}, [setIsLoading, storeId, setApEntries, setFilteredAp]);

useEffect(() => {
    if (!storeId) {
      toast.error('No store selected. Please choose a store.');
      return;
    }
    fetchApEntries();
}, [storeId, fetchApEntries]);

useEffect(() => {
    const filtered = apEntries.filter(entry => {
      const matchesSearch = searchTerm
        ? entry.supplier_name.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      const matchesStatus = statusFilter
        ? entry.status === (statusFilter === 'Unpaid' ? 'Pending' : statusFilter === 'Part Paid' ? 'Partial' : statusFilter)
        : true;
      return matchesSearch && matchesStatus;
    });
    setFilteredAp(filtered);
    setCurrentPage(1); // Reset to page 1 when filters change
}, [searchTerm, statusFilter, apEntries]);

  async function updatePaymentStatus(id, status) {
    const newStatus = status === 'Unpaid' ? 'Pending' : status === 'Part Paid' ? 'Partial' : status;
    const { error } = await supabase
      .from('accounts_payable')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast.error('Can’t update payment status: ' + error.message);
    } else {
      toast.success('Payment status updated.');
      fetchApEntries();
    }
  }

  const handleItemClick = (entry) => {
    console.log('Selected entry:', entry); // Debug log (remove in production)
    let deviceIds = [];
    let sizes = [];
    let totalQty = 'Not provided';

    // Parse purchase_qty (used differently based on case)
    if (entry.dynamic_product?.purchase_qty) {
      totalQty = isNaN(parseInt(entry.dynamic_product.purchase_qty, 10))
        ? 'Not provided'
        : parseInt(entry.dynamic_product.purchase_qty, 10);
    }

    // Check for multiple items (dynamic_product_imeis)
    if (
      entry.dynamic_product?.dynamic_product_imeis &&
      entry.dynamic_product.dynamic_product_imeis.trim() !== ''
    ) {
      deviceIds = Array.isArray(entry.dynamic_product.dynamic_product_imeis)
        ? entry.dynamic_product.dynamic_product_imeis
        : String(entry.dynamic_product.dynamic_product_imeis).split(',');
      // Use device_size as a comma-separated string for multiple items, if available
      sizes = entry.dynamic_product?.device_size && entry.dynamic_product.device_size.trim() !== ''
        ? String(entry.dynamic_product.device_size).split(',')
        : new Array(deviceIds.length).fill('Not provided');
      // Ensure sizes array matches deviceIds length
      sizes = sizes.length >= deviceIds.length 
        ? sizes.slice(0, deviceIds.length)
        : [...sizes, ...new Array(deviceIds.length - sizes.length).fill('Not provided')];
    }
    // Check for single item (device_id, device_size)
    else if (
      entry.dynamic_product?.device_id &&
      entry.dynamic_product.device_id.trim() !== ''
    ) {
      deviceIds = [String(entry.dynamic_product.device_id)];
      sizes = [entry.dynamic_product?.device_size && entry.dynamic_product.device_size.trim() !== ''
        ? String(entry.dynamic_product.device_size)
        : 'Not provided'];
   
    }

    const items = deviceIds.length > 0
      ? deviceIds.map((id, index) => ({
          device_id: id?.trim() || 'Not provided',
          size: sizes[index]?.trim() || 'Not provided',
          qty: entry.dynamic_product?.dynamic_product_imeis && entry.dynamic_product.dynamic_product_imeis.trim() !== '' ? 1 : totalQty,
        }))
      : [{ device_id: 'Not provided', size: 'Not provided', qty: 'Not provided' }];

    setSelectedItem({
      product_name: entry.dynamic_product?.name || 'Unknown',
      items,
    });
    setIsItemModalOpen(true);
  };

  const closeItemModal = () => {
    setIsItemModalOpen(false);
    setSelectedItem(null);
  };

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        closeItemModal();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  // Calculate totals
  const totals = filteredAp.reduce(
    (acc, entry) => {
      return {
        totalOwed: acc.totalOwed + (entry.amount || 0),
        totalUnpaid: acc.totalUnpaid + (entry.status === 'Pending' ? entry.amount || 0 : 0),
      };
    },
    { totalOwed: 0, totalUnpaid: 0 }
  );

  // Pagination logic
  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = filteredAp.slice(indexOfFirstEntry, indexOfLastEntry);
  const totalPages = Math.ceil(filteredAp.length / entriesPerPage);

  const paginate = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setCurrentPage(1);
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto dark:bg-gray-900 dark:text-white space-y-6">
      <ToastContainer />
      <h2 className="text-2xl sm:text-3xl font-bold text-center text-white bg-gradient-to-r from-indigo-400 to-indigo-600 py-4 rounded-lg">
        Money You Owe
      </h2>
      <div className="bg-indigo-50 dark:bg-indigo-900 p-4 rounded-lg border border-indigo-200 dark:border-indigo-700 text-center text-lg text-gray-900 dark:text-gray-100">
        Add item details (like IMEIs and sizes) to your products to track your bills clearly! Use lists for multiple items.
      </div>
      <div className="flex flex-col gap-4 bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative w-full sm:w-1/2">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 hover:text-indigo-500 transition-colors" />
            <input
              type="text"
              placeholder="Search for a supplier (e.g., 'ABC Supplies')"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 text-lg"
              aria-label="Search for a supplier"
              title="Search for a supplier"
            />
          </div>
          <div className="relative w-full sm:w-1/4">
            <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 hover:text-indigo-500 transition-colors" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full pl-10 p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 text-lg"
              aria-label="Filter by payment status"
              title="Filter by payment status"
            >
              <option value="">All Statuses</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Paid">Paid</option>
              <option value="Part Paid">Part Paid</option>
            </select>
          </div>
        </div>
        <button
          onClick={clearFilters}
          className="flex items-center justify-center w-full sm:w-auto px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-lg hover:scale-105 transition-transform"
          aria-label="Clear filters"
          title="Clear filters"
        >
          <XMarkIcon className="h-5 w-5 mr-2 hover:text-indigo-500 transition-colors" />
          Clear Filters
        </button>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6">
        <div className="bg-indigo-50 dark:bg-indigo-900 p-4 rounded-lg border border-indigo-200 dark:border-indigo-700 mb-4" aria-live="polite">
          <div className="flex flex-col sm:flex-row justify-around items-center gap-4">
            <div className="text-lg font-semibold text-green-600 dark:text-green-400">
              Total Money Owed: ₦{totals.totalOwed.toFixed(2)}
            </div>
            <div className="text-lg font-semibold text-red-600 dark:text-red-400">
              Total Unpaid: ₦{totals.totalUnpaid.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-lg">
              Loading your bills...
            </div>
          ) : filteredAp.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-lg">
              No bills found. Try a different search or filter!
            </div>
          ) : (
            <>
              <table className="min-w-full text-lg">
                <thead className="bg-indigo-100 dark:bg-indigo-900 text-gray-900 dark:text-indigo-200 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium border-b dark:border-gray-700">Date</th>
                    <th className="text-left px-4 py-3 font-medium border-b dark:border-gray-700">Supplier</th>
                    <th className="text-left px-4 py-3 font-medium border-b dark:border-gray-700">Item</th>
                    <th className="text-right px-4 py-3 font-medium border-b dark:border-gray-700">Amount Owed (₦)</th>
                    <th className="text-left px-4 py-3 font-medium border-b dark:border-gray-700">Payment Status</th>
                    <th className="text-left px-4 py-3 font-medium border-b dark:border-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentEntries.map(entry => (
                    <tr
                      key={entry.id}
                      className="border-b dark:border-gray-700 hover:bg-indigo-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <td className="px-4 py-3">{new Date(entry.transaction_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3">{entry.supplier_name}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleItemClick(entry)}
                          className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 underline focus:ring-2 focus:ring-indigo-500"
                          aria-label={`View details for ${entry.dynamic_product?.name || 'Unknown'}`}
                        >
                          {entry.dynamic_product?.name || 'Unknown'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">₦{entry.amount.toFixed(2)}</td>
                      <td className="px-4 py-3">{entry.status === 'Pending' ? 'Unpaid' : entry.status === 'Partial' ? 'Part Paid' : entry.status}</td>
                      <td className="px-4 py-3">
                        <select
                          value={entry.status === 'Pending' ? 'Unpaid' : entry.status === 'Partial' ? 'Part Paid' : entry.status}
                          onChange={e => updatePaymentStatus(entry.id, e.target.value)}
                          className="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 text-lg"
                          aria-label={`Update payment status for ${entry.supplier_name}`}
                        >
                          <option value="Unpaid">Unpaid</option>
                          <option value="Paid">Paid</option>
                          <option value="Part Paid">Part Paid</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex flex-row flex-wrap justify-between items-center mt-4 px-4 gap-4">
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Showing {indexOfFirstEntry + 1} to {Math.min(indexOfLastEntry, filteredAp.length)} of {filteredAp.length} bills
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
      {isItemModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" role="dialog" aria-label="Item details modal">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Item Details: {selectedItem.product_name}</h3>
              <button
                onClick={closeItemModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:ring-2 focus:ring-indigo-500"
                aria-label="Close item details modal"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <table className="min-w-full text-lg">
                <thead className="bg-indigo-100 dark:bg-indigo-900 text-gray-900 dark:text-indigo-200">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Item ID (IMEI)</th>
                    <th className="text-left px-4 py-2 font-medium">Size</th>
                    <th className="text-right px-4 py-2 font-medium">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItem.items.map((item, index) => (
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
                onClick={closeItemModal}
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