import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function FinancialReports() {
  const storeId = localStorage.getItem('store_id');
  const [reportType, setReportType] = useState('balance_sheet');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [reportData, setReportData] = useState({});

  useEffect(() => {
    if (!storeId) {
      toast.error('Store ID is missing.');
      return;
    }
    fetchReportData();
  }, [storeId, reportType, dateRange]);

  async function fetchReportData() {
    if (reportType === 'balance_sheet') {
      const { data: ledger, error: ledgerError } = await supabase
        .from('general_ledger')
        .select('*')
        .eq('store_id', storeId)
        .gte('transaction_date', dateRange.start || '1900-01-01')
        .lte('transaction_date', dateRange.end || '9999-12-31');
      if (ledgerError) {
        toast.error('Failed to fetch ledger data: ' + ledgerError.message);
        return;
      }
      const balances = ledger.reduce((acc, entry) => {
        acc[entry.account] = (acc[entry.account] || 0) + (entry.debit || 0) - (entry.credit || 0);
        return acc;
      }, {});
      setReportData({
        assets: {
          Inventory: balances['Inventory'] || 0,
          'Accounts Receivable': balances['Accounts Receivable'] || 0,
          Cash: balances['Cash'] || 0,
        },
        liabilities: {
          'Accounts Payable': balances['Accounts Payable'] || 0,
        },
        equity: {
          'Retained Earnings':
            (balances['Revenue'] || 0) -
            (balances['COGS'] || 0) -
            (balances['Bad Debt Expense'] || 0),
        },
      });
    } else if (reportType === 'income_statement') {
      const { data: ledger, error: ledgerError } = await supabase
        .from('general_ledger')
        .select('*')
        .eq('store_id', storeId)
        .in('account', ['Revenue', 'COGS', 'Bad Debt Expense'])
        .gte('transaction_date', dateRange.start || '1900-01-01')
        .lte('transaction_date', dateRange.end || '9999-12-31');
      if (ledgerError) {
        toast.error('Failed to fetch ledger data: ' + ledgerError.message);
        return;
      }
      const balances = ledger.reduce((acc, entry) => {
        acc[entry.account] = (acc[entry.account] || 0) + (entry.debit || 0) - (entry.credit || 0);
        return acc;
      }, {});
      setReportData({
        revenue: balances['Revenue'] || 0,
        cogs: balances['COGS'] || 0,
        expenses: {
          'Bad Debt Expense': balances['Bad Debt Expense'] || 0,
        },
        netIncome: (balances['Revenue'] || 0) - (balances['COGS'] || 0) - (balances['Bad Debt Expense'] || 0),
      });
    }
  }

  return (
    <div className="p-4 space-y-6 dark:bg-gray-900 dark:text-white">
      <ToastContainer />
      <h2 className="text-2xl font-bold text-center">Financial Reports</h2>
      <div className="flex flex-col sm:flex-row gap-4">
        <select
          value={reportType}
          onChange={e => setReportType(e.target.value)}
          className="w-full sm:w-1/3 p-2 border rounded dark:bg-gray-900 dark:border-gray-600 dark:text-white"
        >
          <option value="balance_sheet">Balance Sheet</option>
          <option value="income_statement">Income Statement</option>
        </select>
        <div className="flex gap-2">
          <input
            type="date"
            value={dateRange.start}
            onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
            className="p-2 border rounded dark:bg-gray-900 dark:border-gray-600 dark:text-white"
          />
          <input
            type="date"
            value={dateRange.end}
            onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
            className="p-2 border rounded dark:bg-gray-900 dark:border-gray-600 dark:text-white"
          />
        </div>
      </div>
      <div className="space-y-4">
        {reportType === 'balance_sheet' && (
          <div>
            <h3 className="text-xl font-semibold">Balance Sheet</h3>
            <div className="space-y-2">
              <h4 className="font-semibold">Assets</h4>
              {Object.entries(reportData.assets || {}).map(([key, value]) => (
                <p key={key} className="ml-4">{key}: ₦{value.toFixed(2)}</p>
              ))}
              <h4 className="font-semibold">Liabilities</h4>
              {Object.entries(reportData.liabilities || {}).map(([key, value]) => (
                <p key={key} className="ml-4">{key}: ₦{value.toFixed(2)}</p>
              ))}
              <h4 className="font-semibold">Equity</h4>
              {Object.entries(reportData.equity || {}).map(([key, value]) => (
                <p key={key} className="ml-4">{key}: ₦{value.toFixed(2)}</p>
              ))}
            </div>
          </div>
        )}
        {reportType === 'income_statement' && (
          <div>
            <h3 className="text-xl font-semibold">Income Statement</h3>
            <div className="space-y-2">
              <p>Revenue: ₦{(reportData.revenue || 0).toFixed(2)}</p>
              <p>Cost of Goods Sold: ₦{(reportData.cogs || 0).toFixed(2)}</p>
              <h4 className="font-semibold">Expenses</h4>
              {Object.entries(reportData.expenses || {}).map(([key, value]) => (
                <p key={key} className="ml-4">{key}: ₦{value.toFixed(2)}</p>
              ))}
              <p className="font-semibold">Net Income: ₦{(reportData.netIncome || 0).toFixed(2)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}