import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { CalendarIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function FinancialReports() {
  const storeId = localStorage.getItem('store_id');
  const [reportType, setReportType] = useState('money_snapshot');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [reportData, setReportData] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const entriesPerPage = 10;
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!storeId) {
      toast.error('No store selected. Please choose a store.');
      return;
    }
    fetchReportData();
  }, [storeId, reportType, dateRange]);

  async function fetchReportData() {
    setIsLoading(true);
    if (reportType === 'money_snapshot') {
      const { data: ledger, error: ledgerError } = await supabase
        .from('general_ledger')
        .select('*')
        .eq('store_id', storeId)
        .gte('transaction_date', dateRange.start || '1900-01-01')
        .lte('transaction_date', dateRange.end || '9999-12-31');
      if (ledgerError) {
        toast.error('Can’t load data: ' + ledgerError.message);
        setReportData({});
        setIsLoading(false);
        return;
      }
      const balances = ledger.reduce((acc, entry) => {
        acc[entry.account] = (acc[entry.account] || 0) + (entry.debit || 0) - (entry.credit || 0);
        return acc;
      }, {});
      const assetsTotal = (balances['Inventory'] || 0) + (balances['Accounts Receivable'] || 0) + (balances['Cash'] || 0);
      const liabilitiesTotal = balances['Accounts Payable'] || 0;
      const equityTotal = (balances['Revenue'] || 0) - (balances['COGS'] || 0) - (balances['Bad Debt Expense'] || 0);
      setReportData({
        entries: ledger,
        assets: {
          'Cash': balances['Cash'] || 0,
          'Inventory (Stock)': balances['Inventory'] || 0,
          'Money Owed to You': balances['Accounts Receivable'] || 0,
        },
        liabilities: {
          'Money You Owe': balances['Accounts Payable'] || 0,
        },
        equity: {
          'Your Business Value': equityTotal,
        },
        totals: {
          assets: assetsTotal,
          liabilities: liabilitiesTotal,
          equity: equityTotal,
        },
      });
    } else if (reportType === 'earnings_report') {
      const { data: ledger, error: ledgerError } = await supabase
        .from('general_ledger')
        .select('*')
        .eq('store_id', storeId)
        .in('account', ['Revenue', 'COGS', 'Bad Debt Expense'])
        .gte('transaction_date', dateRange.start || '1900-01-01')
        .lte('transaction_date', dateRange.end || '9999-12-31');
      if (ledgerError) {
        toast.error('Can’t load data: ' + ledgerError.message);
        setReportData({});
        setIsLoading(false);
        return;
      }
      const balances = ledger.reduce((acc, entry) => {
        acc[entry.account] = (acc[entry.account] || 0) + (entry.debit || 0) - (entry.credit || 0);
        return acc;
      }, {});
      const netIncome = (balances['Revenue'] || 0) - (balances['COGS'] || 0) - (balances['Bad Debt Expense'] || 0);
      setReportData({
        entries: ledger,
        revenue: balances['Revenue'] || 0,
        cogs: balances['COGS'] || 0,
        expenses: {
          'Bad Debts': balances['Bad Debt Expense'] || 0,
        },
        netIncome: netIncome,
        totals: {
          revenue: balances['Revenue'] || 0,
          cogs: balances['COGS'] || 0,
          expenses: balances['Bad Debt Expense'] || 0,
          netIncome: netIncome,
        },
      });
    }
    setCurrentPage(1);
    setIsLoading(false);
  }

  // Pagination logic
  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = (reportData.entries || []).slice(indexOfFirstEntry, indexOfLastEntry);
  const totalPages = Math.ceil((reportData.entries || []).length / entriesPerPage);

  const paginate = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const clearFilters = () => {
    setReportType('money_snapshot');
    setDateRange({ start: '', end: '' });
    setCurrentPage(1);
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto dark:bg-gray-900 dark:text-white space-y-6">
      <ToastContainer />
      <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 dark:text-gray-100 bg-gradient-to-r from-indigo-500 to-indigo-700 text-white py-4 rounded-lg">
        Money Overview
      </h2>
      <div className="flex flex-col gap-4 bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
        <div className="flex flex-col sm:flex-row gap-4">
          <select
            value={reportType}
            onChange={e => setReportType(e.target.value)}
            className="w-full sm:w-1/3 p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 text-lg"
            aria-label="Select report type"
          >
            <option value="money_snapshot">Money Snapshot (What You Own & Owe)</option>
            <option value="earnings_report">Earnings Report (Your Sales & Profit)</option>
          </select>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative w-full sm:w-auto">
              <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="date"
                value={dateRange.start}
                onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-full pl-10 p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 text-lg"
                aria-label="Start date"
                title="Pick a start date"
              />
            </div>
            <div className="relative w-full sm:w-auto">
              <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="date"
                value={dateRange.end}
                onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-full pl-10 p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 text-lg"
                aria-label="End date"
                title="Pick an end date"
              />
            </div>
          </div>
        </div>
        <button
          onClick={clearFilters}
          className="flex items-center justify-center w-full sm:w-auto px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-lg hover:scale-105 transition-transform"
          aria-label="Clear all filters"
        >
          <XMarkIcon className="h-5 w-5 mr-2" />
          Clear Filters
        </button>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6">
        {isLoading ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-lg">
            Loading your money overview...
          </div>
        ) : !reportData.entries || reportData.entries.length === 0 ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-lg">
            No data yet? Try a different date range!
          </div>
        ) : (
          <>
            {reportType === 'money_snapshot' && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Money Snapshot</h3>
                <div className="bg-indigo-50 dark:bg-indigo-900 p-4 rounded-lg" aria-live="polite">
                  <div className="flex flex-col sm:flex-row justify-around items-center gap-4">
                    <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                      Total Money You Own: ₦{(reportData.totals?.assets || 0).toFixed(2)}
                    </div>
                    <div className="text-lg font-semibold text-red-600 dark:text-red-400">
                      Total Money You Owe: ₦{(reportData.totals?.liabilities || 0).toFixed(2)}
                    </div>
                    <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                      Your Business Value: ₦{(reportData.totals?.equity || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">Money You Own</h4>
                    {Object.entries(reportData.assets || {}).map(([key, value]) => (
                      <p key={key} className="ml-4 text-gray-700 dark:text-gray-300">
                        {key}: <span className={value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                          ₦{value.toFixed(2)}
                        </span>
                      </p>
                    ))}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">Money You Owe</h4>
                    {Object.entries(reportData.liabilities || {}).map(([key, value]) => (
                      <p key={key} className="ml-4 text-gray-700 dark:text-gray-300">
                        {key}: <span className={value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                          ₦{value.toFixed(2)}
                        </span>
                      </p>
                    ))}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">Your Business Value</h4>
                    {Object.entries(reportData.equity || {}).map(([key, value]) => (
                      <p key={key} className="ml-4 text-gray-700 dark:text-gray-300">
                        {key}: <span className={value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                          ₦{value.toFixed(2)}
                        </span>
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {reportType === 'earnings_report' && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Earnings Report</h3>
                <div className="bg-indigo-50 dark:bg-indigo-900 p-4 rounded-lg" aria-live="polite">
                  <div className="flex flex-col sm:flex-row justify-around items-center gap-4">
                    <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                      Total Sales Income: ₦{(reportData.totals?.revenue || 0).toFixed(2)}
                    </div>
                    <div className="text-lg font-semibold text-red-600 dark:text-red-400">
                      Total Costs & Expenses: ₦{((reportData.totals?.cogs || 0) + (reportData.totals?.expenses || 0)).toFixed(2)}
                    </div>
                    <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                      Your Profit: ₦{(reportData.totals?.netIncome || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-gray-700 dark:text-gray-300">
                    Sales Income: <span className="text-green-600 dark:text-green-400">₦{(reportData.revenue || 0).toFixed(2)}</span>
                  </p>
                  <p className="text-gray-700 dark:text-gray-300">
                    Cost of Sales: <span className="text-red-600 dark:text-red-400">₦{(reportData.cogs || 0).toFixed(2)}</span>
                  </p>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">Expenses</h4>
                  {Object.entries(reportData.expenses || {}).map(([key, value]) => (
                    <p key={key} className="ml-4 text-gray-700 dark:text-gray-300">
                      {key}: <span className="text-red-600 dark:text-red-400">₦{value.toFixed(2)}</span>
                    </p>
                  ))}
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    Your Profit: <span className={reportData.netIncome >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      ₦{(reportData.netIncome || 0).toFixed(2)}
                    </span>
                  </p>
                </div>
              </div>
            )}
            <div className="flex flex-row flex-wrap justify-between items-center mt-4 px-4 gap-4">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Showing {indexOfFirstEntry + 1} to {Math.min(indexOfLastEntry, reportData.entries?.length || 0)} of {reportData.entries?.length || 0} transactions
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
  );
}