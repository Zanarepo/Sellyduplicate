import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function GeneralLedger() {
  const storeId = localStorage.getItem('store_id');
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    if (!storeId) {
      toast.error('Store ID is missing.');
      return;
    }
    fetchLedger();
  }, [storeId]);

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
  }, [searchTerm, accountFilter, dateRange, ledgerEntries]);

  async function fetchLedger() {
    const { data, error } = await supabase
      .from('general_ledger')
      .select('*')
      .eq('store_id', storeId)
      .order('transaction_date', { ascending: false });
    if (error) {
      toast.error('Failed to fetch ledger: ' + error.message);
    } else {
      setLedgerEntries(data || []);
      setFilteredEntries(data || []);
    }
  }

  return (
    <div className="p-4 space-y-6 dark:bg-gray-900 dark:text-white">
      <ToastContainer />
      <h2 className="text-2xl font-bold text-center">General Ledger</h2>
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Search transactions..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full sm:w-1/3 p-2 border rounded dark:bg-gray-900 dark:border-gray-600 dark:text-white"
        />
        <select
          value={accountFilter}
          onChange={e => setAccountFilter(e.target.value)}
          className="w-full sm:w-1/3 p-2 border rounded dark:bg-gray-900 dark:border-gray-600 dark:text-white"
        >
          <option value="">All Accounts</option>
          <option value="Inventory">Inventory</option>
          <option value="Accounts Payable">Accounts Payable</option>
          <option value="Accounts Receivable">Accounts Receivable</option>
          <option value="Revenue">Revenue</option>
          <option value="COGS">COGS</option>
          <option value="Cash">Cash</option>
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
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border rounded-lg">
          <thead className="bg-gray-100 dark:bg-gray-700 dark:text-indigo-400">
            <tr>
              <th className="text-left px-4 py-2 border-b">Date</th>
              <th className="text-left px-4 py-2 border-b">Account</th>
              <th className="text-left px-4 py-2 border-b">Description</th>
              <th className="text-right px-4 py-2 border-b">Debit</th>
              <th className="text-right px-4 py-2 border-b">Credit</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.map(entry => (
              <tr key={entry.id} className="hover:bg-gray-100 dark:hover:bg-gray-600">
                <td className="px-4 py-2 border-b">{new Date(entry.transaction_date).toLocaleDateString()}</td>
                <td className="px-4 py-2 border-b">{entry.account}</td>
                <td className="px-4 py-2 border-b">{entry.description}</td>
                <td className="px-4 py-2 border-b text-right">
                  {entry.debit ? `₦${entry.debit.toFixed(2)}` : '-'}
                </td>
                <td className="px-4 py-2 border-b text-right">
                  {entry.credit ? `₦${entry.credit.toFixed(2)}` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}