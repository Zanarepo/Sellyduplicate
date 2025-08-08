import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Fallback for Heroicons
let MagnifyingGlassIcon, CalendarIcon, XMarkIcon, BuildingStorefrontIcon;
try {
  ({ MagnifyingGlassIcon, CalendarIcon, XMarkIcon, BuildingStorefrontIcon } = require('@heroicons/react/24/outline'));
} catch (e) {
  console.warn('Heroicons not installed. Please run `npm install @heroicons/react`. Using text fallback.');
  MagnifyingGlassIcon = () => <span>🔍</span>;
  CalendarIcon = () => <span>📅</span>;
  XMarkIcon = () => <span>❌</span>;
  BuildingStorefrontIcon = () => <span>🏪</span>;
}

export default function GeneralLedger() {
  const ownerId = Number(localStorage.getItem('owner_id')) || null;
  const [storeId, setStoreId] = useState(localStorage.getItem('store_id') || '');
  const [stores, setStores] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const entriesPerPage = 10;

  // Fetch stores
  useEffect(() => {
    if (!ownerId) {
      toast.error('No owner ID found. Please log in.');
      setStores([]);
      setIsLoading(false);
      return;
    }
    async function fetchStores() {
      setIsLoading(true);
      const { data: storeData, error: storeErr } = await supabase
        .from('stores')
        .select('id, shop_name')
        .eq('owner_user_id', ownerId);
      if (storeErr) {
        toast.error('Error fetching stores: ' + storeErr.message);
        console.error('Store fetch error:', storeErr, { ownerId });
        setStores([]);
        setIsLoading(false);
        return;
      }
      console.log('Fetched stores:', storeData);
      setStores(storeData || []);
      if (storeData.length === 0) {
        toast.warn('No stores found for this owner.');
      } else if (!storeId && storeData.length > 0) {
        setStoreId(storeData[0].id);
        localStorage.setItem('store_id', storeData[0].id);
      }
      setIsLoading(false);
    }
    fetchStores();
  }, [ownerId, storeId]);

  // Fetch ledger entries
  const fetchLedger = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('general_ledger')
      .select('*')
      .eq('store_id', storeId)
      .order('transaction_date', { ascending: false });

    if (error) {
      toast.error('Couldn’t load transactions: ' + error.message);
      console.error('Ledger fetch error:', error, { storeId });
    } else {
      console.log('Fetched ledger entries:', data);
      setLedgerEntries(data || []);
      setFilteredEntries(data || []);
    }
    setIsLoading(false);
  }, [storeId]);

  // Run fetchLedger when storeId changes
  useEffect(() => {
    if (!storeId) {
      toast.error('No store selected. Please choose a store.');
      setLedgerEntries([]);
      setFilteredEntries([]);
      return;
    }
    fetchLedger();
  }, [storeId, fetchLedger]);

  // Filter entries
  useEffect(() => {
    const filtered = ledgerEntries.filter(entry => {
      const matchesSearch = searchTerm
        ? entry.description.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      const matchesAccount = accountFilter
        ? entry.account === accountFilter
        : true;
      const matchesDate =
        (!dateRange.start || new Date(entry.transaction_date) >= new Date(dateRange.start)) &&
        (!dateRange.end || new Date(entry.transaction_date) <= new Date(dateRange.end));
      return matchesSearch && matchesAccount && matchesDate;
    });

    setFilteredEntries(filtered);
    setCurrentPage(1);
  }, [searchTerm, accountFilter, dateRange, ledgerEntries]);

  // Calculate totals
  const totals = filteredEntries.reduce(
    (acc, entry) => ({
      totalDebit: acc.totalDebit + (entry.debit || 0),
      totalCredit: acc.totalCredit + (entry.credit || 0),
    }),
    { totalDebit: 0, totalCredit: 0 }
  );

  // Pagination
  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = filteredEntries.slice(indexOfFirstEntry, indexOfLastEntry);
  const totalPages = Math.ceil(filteredEntries.length / entriesPerPage);

  const paginate = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setAccountFilter('');
    setDateRange({ start: '', end: '' });
    setCurrentPage(1);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto dark:bg-gray-900 dark:text-white space-y-6">
      <ToastContainer />
      <h2 className="text-2xl sm:text-3xl font-bold text-center text-white bg-gradient-to-r from-indigo-500 to-indigo-700 py-4 rounded-lg">
        Money Tracker (General Ledger)
      </h2>
      <div className="flex flex-col gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative w-full sm:w-1/4">
            <BuildingStorefrontIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 hover:text-indigo-500 transition-colors" />
            <select
              value={storeId}
              onChange={(e) => {
                const newStoreId = e.target.value;
                setStoreId(newStoreId);
                localStorage.setItem('store_id', newStoreId);
              }}
              className="w-full pl-10 p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 text-sm"
              aria-label="Select store"
              title="Select store"
            >
              <option value="">Select a store</option>
              {stores.map(store => (
                <option key={store.id} value={store.id}>{store.shop_name}</option>
              ))}
            </select>
          </div>
          <div className="relative w-full sm:w-1/4">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 hover:text-indigo-500 transition-colors" />
            <input
              type="text"
              placeholder="Search by description (e.g., 'phone' or 'John')"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 text-sm"
              aria-label="Search by description"
              title="Search by description"
            />
          </div>
          <div className="relative w-full sm:w-1/4">
            <select
              value={accountFilter}
              onChange={e => setAccountFilter(e.target.value)}
              className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 text-sm"
              aria-label="Filter by money type"
              title="Filter by money type"
            >
              <option value="">All Money Types</option>
              <option value="Cash">Cash (Money Received)</option>
              <option value="Revenue">Sales Income</option>
              <option value="Inventory">Stock Value</option>
              <option value="COGS">Cost of Goods Sold</option>
              <option value="Accounts Receivable">Money Owed to You</option>
              <option value="Accounts Payable">Money You Owe</option>
            </select>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-1/4">
            <div className="relative flex-1">
              <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 hover:text-indigo-500 transition-colors" />
              <input
                type="date"
                value={dateRange.start}
                onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                placeholder="Start Date"
                className="w-full pl-10 p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 text-sm"
                aria-label="Start date"
                title="Start date"
              />
            </div>
            <div className="relative flex-1">
              <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 hover:text-indigo-500 transition-colors" />
              <input
                type="date"
                value={dateRange.end}
                onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                placeholder="End Date"
                className="w-full pl-10 p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 text-sm"
                aria-label="End date"
                title="End date"
              />
            </div>
          </div>
        </div>
        <button
          onClick={clearFilters}
          className="flex items-center justify-center w-full sm:w-auto px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-sm hover:scale-105 transition-transform"
          aria-label="Clear filters"
          title="Clear filters"
        >
          <XMarkIcon className="h-5 w-5 mr-2 hover:text-indigo-500 transition-colors" />
          Clear Filters
        </button>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
        <div className="flex justify-between items-center mb-4" aria-live="polite">
          <div className="text-lg font-semibold text-green-600 dark:text-green-400">
            Money In: ₦{totals.totalDebit.toFixed(2)}
          </div>
          <div className="text-lg font-semibold text-red-600 dark:text-red-400">
            Money Out: ₦{totals.totalCredit.toFixed(2)}
          </div>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
              Loading transactions...
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
              No transactions found. Try a different store, search, or filters.
            </div>
          ) : (
            <>
              <table className="min-w-full text-sm">
                <thead className="bg-indigo-100 dark:bg-indigo-900 text-gray-900 dark:text-indigo-200 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium border-b dark:border-gray-700">Date</th>
                    <th className="text-left px-4 py-3 font-medium border-b dark:border-gray-700">Money Type</th>
                    <th className="text-left px-4 py-3 font-medium border-b dark:border-gray-700">Description</th>
                    <th className="text-right px-4 py-3 font-medium border-b dark:border-gray-700">Money In (₦)</th>
                    <th className="text-right px-4 py-3 font-medium border-b dark:border-gray-700">Money Out (₦)</th>
                  </tr>
                </thead>
                <tbody>
                  {currentEntries.map(entry => (
                    <tr
                      key={entry.id}
                      className="border-b dark:border-gray-700 hover:bg-indigo-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <td className="px-4 py-3">{new Date(entry.transaction_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3">{entry.account}</td>
                      <td className="px-4 py-3">{entry.description}</td>
                      <td className="px-4 py-3 text-right">
                        {entry.debit ? `₦${entry.debit.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {entry.credit ? `₦${entry.credit.toFixed(2)}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex flex-row flex-wrap justify-between items-center mt-4 px-4 gap-4">
                <div className="text-xs text-gray-600 dark:text-gray-300">
                  Showing {indexOfFirstEntry + 1} to {Math.min(indexOfLastEntry, filteredEntries.length)} of {filteredEntries.length} transactions
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => paginate(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 rounded-lg text-xs font-medium ${
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
                      className={`px-3 py-1 rounded-lg text-xs font-medium ${
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
                    className={`px-3 py-1 rounded-lg text-xs font-medium ${
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
    </div>
  );
}