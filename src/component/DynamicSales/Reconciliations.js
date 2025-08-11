import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import 'tailwindcss/tailwind.css';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

// Helper to download CSV
const downloadCSV = (data, filename) => {
  const csv = [
    ['Check Date', 'Store', 'Period', 'Payment Method', 'Expected Amount', 'Actual Amount', 'Discrepancy', 'Status', 'Notes'],
    ...data.map(item => [
      item.check_date,
      item.store_name,
      item.period,
      item.payment_method,
      item.expected_amount,
      item.actual_amount,
      item.discrepancy,
      item.status,
      item.notes || '',
    ]),
  ]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
};

// Normalize payment method for display
const normalizePaymentMethod = (method) => {
  if (!method) return 'Unknown';
  if (method.toLowerCase() === 'Cash') return 'Cash';
  return method
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Denormalize for database
const denormalizePaymentMethod = (method) => {
  if (!method) return 'Unknown';
  if (method.toLowerCase() === 'cash') return 'Cash';
  return method;
};

const Reconciliation = () => {
  const ownerId = Number(localStorage.getItem('owner_id')) || null;
  const [storeId, setStoreId] = useState(localStorage.getItem('store_id') || '');
  const [stores, setStores] = useState([]);
  const [sales, setSales] = useState([]);
  const [reconciliationChecks, setReconciliationChecks] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [timePeriod, setTimePeriod] = useState('daily');
  const [checkDate, setCheckDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [currency, setCurrency] = useState('NGN');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState(null);
  const [newCheck, setNewCheck] = useState({
    payment_method: '',
    expected_amount: 0,
    actual_amount: 0,
    notes: '',
    status: 'pending',
  });
  const [showChecks, setShowChecks] = useState(false);
  const [showPayments, setShowPayments] = useState(false);

  const currencySymbols = useMemo(() => ({
    NGN: '₦',
    USD: '$',
    GBP: '£',
    EUR: '€',
  }), []);

  // Format currency
  const formatCurrency = useCallback((value) => `${currencySymbols[currency]}${Number(value || 0).toFixed(2)}`, [currency, currencySymbols]);

  // Stable payment methods for modal
  const allPaymentMethods = useMemo(() => ['Cash', 'Card', 'Bank Transfer', 'Wallet'], []);

  // Fetch stores
  const fetchStores = useCallback(async () => {
    if (!ownerId) {
      toast.error('No owner ID found. Please log in.');
      setStores([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data: storeData, error: storeErr } = await supabase
        .from('stores')
        .select('id, shop_name')
        .eq('owner_user_id', ownerId);
      if (storeErr) throw storeErr;
      setStores(storeData || []);
      if (storeData.length === 0) {
        toast.warn('No stores found for this owner.');
      } else if (!storeId && storeData.length > 0) {
        setStoreId(storeData[0].id);
        localStorage.setItem('store_id', storeData[0].id);
      }
    } catch (error) {
      toast.error('Error fetching stores: ' + error.message);
      console.error('Store fetch error:', error);
      setStores([]);
    } finally {
      setIsLoading(false);
    }
  }, [ownerId, storeId]);

 const fetchPaymentMethods = useCallback(async () => {
  if (!storeId) {
    setPaymentMethods(allPaymentMethods);
    return;
  }
  setIsLoading(true);
  try {
    const { data, error } = await supabase
      .from('dynamic_sales')
      .select('payment_method')
      .eq('store_id', storeId)
      .not('payment_method', 'is', null);
    if (error) throw error;
    const uniqueMethods = [...new Set(data.map(item => normalizePaymentMethod(item.payment_method)))];
    const combinedMethods = [...new Set([...allPaymentMethods, ...uniqueMethods])].sort();
    setPaymentMethods(combinedMethods);
    console.log('Fetched payment methods:', combinedMethods); // Debugging
  } catch (error) {
    toast.error('Error fetching payment methods: ' + error.message);
    console.error('Payment methods fetch error:', error, { storeId });
    setPaymentMethods(allPaymentMethods);
  } finally {
    setIsLoading(false);
  }
}, [storeId, allPaymentMethods]);


  // Fetch sales
 const fetchSales = useCallback(async () => {
  if (!storeId || !checkDate) {
    setSales([]);
    return;
  }
  setIsLoading(true);
  try {
    let query = supabase
      .from('dynamic_sales')
      .select('id, sold_at, payment_method, amount, status, customer_name')
      .eq('store_id', storeId);

    // Define date range based on timePeriod
    let startDate, endDate;
    if (timePeriod === 'daily') {
      startDate = startOfDay(new Date(checkDate));
      endDate = endOfDay(new Date(checkDate));
    } else if (timePeriod === 'weekly') {
      startDate = startOfWeek(new Date(checkDate), { weekStartsOn: 1 });
      endDate = endOfWeek(new Date(checkDate), { weekStartsOn: 1 });
    } else if (timePeriod === 'monthly') {
      startDate = startOfMonth(new Date(checkDate));
      endDate = endOfMonth(new Date(checkDate));
    }

    query = query
      .gte('sold_at', format(startDate, 'yyyy-MM-dd HH:mm:ss'))
      .lte('sold_at', format(endDate, 'yyyy-MM-dd HH:mm:ss'));

    if (selectedPaymentMethod && selectedPaymentMethod !== 'All Payment Methods') {
      const denormalizedMethod = denormalizePaymentMethod(selectedPaymentMethod);
      query = query.eq('payment_method', denormalizedMethod);
      console.log('Filtering sales by payment_method:', denormalizedMethod); // Debugging
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) {
      toast.warn('No sales data found for the selected filters.');
      console.log('No sales found for filters:', { storeId, checkDate, timePeriod, selectedPaymentMethod }); // Debugging
    }
    setSales(data || []);
  } catch (error) {
    toast.error('Error loading sales: ' + error.message);
    console.error('Sales fetch error:', error, { storeId, checkDate, timePeriod, selectedPaymentMethod });
    setSales([]);
  } finally {
    setIsLoading(false);
  }
}, [storeId, checkDate, timePeriod, selectedPaymentMethod]);


  // Fetch reconciliation checks
const fetchReconciliationChecks = useCallback(async () => {
  if (!storeId) {
    setReconciliationChecks([]);
    return;
  }
  setIsLoading(true);
  try {
    const { data, error } = await supabase
      .from('reconciliation_checks')
      .select(`
        id, store_id, check_date, period, payment_method, expected_amount, actual_amount, discrepancy, notes, status, created_at,
        stores (shop_name)
      `)
      .eq('store_id', storeId)
      .order('check_date', { ascending: false });
    if (error) throw error;
    setReconciliationChecks(data || []);
  } catch (error) {
    toast.error('Error loading reconciliation checks: ' + error.message);
    console.error('Checks fetch error:', error);
    setReconciliationChecks([]);
  } finally {
    setIsLoading(false);
  }
}, [storeId]);

  // Aggregate sales by payment method
  const salesByPaymentMethod = useMemo(() => {
    return sales.reduce((acc, sale) => {
      const method = normalizePaymentMethod(sale.payment_method || 'Unknown');
      acc[method] = acc[method] || { amount: 0, count: 0 };
      acc[method].amount += sale.amount;
      acc[method].count += 1;
      return acc;
    }, {});
  }, [sales]);

  // Calculate total sales amount
  const totalSalesAmount = useMemo(() => {
    return Object.values(salesByPaymentMethod).reduce((sum, { amount }) => sum + amount, 0);
  }, [salesByPaymentMethod]);

  // Calculate total discrepancies
  const totalDiscrepancy = useMemo(() => {
    return reconciliationChecks.reduce((sum, check) => sum + (check.discrepancy || 0), 0);
  }, [reconciliationChecks]);

  // Calculate discrepancies by payment method
  const discrepanciesByPaymentMethod = useMemo(() => {
    return reconciliationChecks.reduce((acc, check) => {
      const method = normalizePaymentMethod(check.payment_method);
      acc[method] = acc[method] || 0;
      acc[method] += check.discrepancy || 0;
      return acc;
    }, {});
  }, [reconciliationChecks]);

  // Detect suspicious patterns
  const suspiciousPatterns = useMemo(() => {
    const patterns = [];
    if (salesByPaymentMethod['Cash'] && salesByPaymentMethod['Cash'].amount > totalSalesAmount * 0.5) {
      patterns.push('High cash transactions detected (>50% of total sales). Verify cash deposits.');
    }
    const nonSoldSales = sales.filter(s => s.status !== 'sold').length;
    if (nonSoldSales > sales.length * 0.1) {
      patterns.push('Frequent non-sold transactions detected. Check for voids or cancellations.');
    }
    return patterns;
  }, [salesByPaymentMethod, totalSalesAmount, sales]);

  // Chart data for expected vs actual
  const chartData = useMemo(() => ({
    labels: paymentMethods,
    datasets: [
      {
        label: `Expected Money (${currencySymbols[currency]})`,
        data: paymentMethods.map(method => salesByPaymentMethod[method]?.amount || 0),
        backgroundColor: '#10B981',
      },
      {
        label: `Actual Money (${currencySymbols[currency]})`,
        data: paymentMethods.map(method => {
          const check = reconciliationChecks.find(c => normalizePaymentMethod(c.payment_method) === method && c.check_date === checkDate);
          return check ? check.actual_amount : 0;
        }),
        backgroundColor: '#3B82F6',
      },
    ],
  }), [paymentMethods, salesByPaymentMethod, reconciliationChecks, checkDate, currencySymbols, currency]);

 const handleAddCheck = useCallback(async () => {
  if (!storeId || !newCheck.payment_method || !checkDate) {
    toast.error('Please select a store, payment method, and check date.');
    return;
  }
  setIsLoading(true);
  try {
    let expectedAmount;
    if (newCheck.payment_method === 'All Payment Methods') {
      expectedAmount = totalSalesAmount;
    } else {
      expectedAmount = salesByPaymentMethod[newCheck.payment_method]?.amount || newCheck.expected_amount;
    }
    const { error } = await supabase
      .from('reconciliation_checks')
      .insert({
        store_id: storeId,
        check_date: checkDate,
        period: timePeriod,
        payment_method: denormalizePaymentMethod(newCheck.payment_method).toLowerCase(),
        expected_amount: expectedAmount,
        actual_amount: newCheck.actual_amount,
        notes: newCheck.notes,
        status: newCheck.status,
      });
    if (error) throw error;
    toast.success('Reconciliation check added successfully!');
    setShowAddModal(false);
    setNewCheck({ payment_method: '', expected_amount: 0, actual_amount: 0, notes: '', status: 'pending' });
    await fetchReconciliationChecks();
  } catch (error) {
    toast.error('Error adding check: ' + error.message);
    console.error('Add check error:', error);
  } finally {
    setIsLoading(false);
  }
}, [storeId, checkDate, timePeriod, newCheck, totalSalesAmount, salesByPaymentMethod, fetchReconciliationChecks]);



const handleEditCheck = useCallback(async () => {
  if (!selectedCheck) return;
  setIsLoading(true);
  try {
    const { error } = await supabase
      .from('reconciliation_checks')
      .update({
        actual_amount: selectedCheck.actual_amount,
        notes: selectedCheck.notes,
        status: selectedCheck.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedCheck.id);
    if (error) throw error;
    toast.success('Reconciliation check updated successfully!');
    setShowEditModal(false);
    setSelectedCheck(null);
    await fetchReconciliationChecks();
  } catch (error) {
    toast.error('Error updating check: ' + error.message);
    console.error('Edit check error:', error);
  } finally {
    setIsLoading(false);
  }
}, [selectedCheck, fetchReconciliationChecks]);

  // Handle deleting check
  const handleDeleteCheck = useCallback(async () => {
    if (!selectedCheck) return;
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('reconciliation_checks')
        .delete()
        .eq('id', selectedCheck.id);
      if (error) throw error;
      toast.success('Reconciliation check deleted successfully!');
      setShowDeleteModal(false);
      setSelectedCheck(null);
      await fetchReconciliationChecks();
    } catch (error) {
      toast.error('Error deleting check: ' + error.message);
      console.error('Delete check error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCheck, fetchReconciliationChecks]);

  // Initial fetch
  useEffect(() => {
    if (!ownerId) {
      toast.error('Please log in to view your stores.');
      setStores([]);
      setSales([]);
      setReconciliationChecks([]);
      setPaymentMethods([]);
      return;
    }
    fetchStores();
  }, [ownerId, fetchStores]);

  // Fetch data when filters change
  useEffect(() => {
    if (storeId) {
      fetchPaymentMethods();
      fetchSales();
      fetchReconciliationChecks();
    }
  }, [storeId, checkDate, timePeriod, selectedPaymentMethod, fetchPaymentMethods, fetchSales, fetchReconciliationChecks]);

  // Pre-populate expected amount in modal
  useEffect(() => {
    if (newCheck.payment_method) {
      const expected = newCheck.payment_method === 'All Payment Methods'
        ? totalSalesAmount
        : salesByPaymentMethod[newCheck.payment_method]?.amount || 0;
      setNewCheck(prev => ({ ...prev, expected_amount: expected }));
    }
  }, [newCheck.payment_method, salesByPaymentMethod, totalSalesAmount]);

  return (
    <div className="p-4 sm:p-6 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen transition-all duration-300">
      <ToastContainer />
      <h2 className="text-2xl sm:text-3xl font-bold text-center text-white bg-gradient-to-r from-indigo-500 to-indigo-700 py-4 rounded-lg">
        Check Your Money
      </h2>

      {!ownerId && (
        <div className="mt-6 text-center text-red-600">
          Please log in to access this page.
        </div>
      )}

      {ownerId && stores.length === 0 && !isLoading && (
        <div className="mt-6 text-center text-gray-600">
          No stores found. Please create a store to proceed.
        </div>
      )}

      {/* Filters */}
      {ownerId && stores.length > 0 && (
        <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 bg-white p-6 rounded-xl shadow-lg">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="store-filter">
              Store
            </label>
            <select
              id="store-filter"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
              value={storeId}
              onChange={(e) => {
                const newStoreId = e.target.value;
                setStoreId(newStoreId);
                localStorage.setItem('store_id', newStoreId);
                setSelectedPaymentMethod('');
              }}
              aria-label="Select Store"
              disabled={isLoading}
            >
              <option value="">Select a store</option>
              {stores.map(store => (
                <option key={store.id} value={store.id}>{store.shop_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="time-period">
              Time Period
            </label>
            <select
              id="time-period"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
              value={timePeriod}
              onChange={(e) => {
                setTimePeriod(e.target.value);
                setSelectedPaymentMethod('');
              }}
              aria-label="Select Time Period"
              disabled={isLoading}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="check-date">
              Check Date
            </label>
            <input
              id="check-date"
              type="date"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
              value={checkDate}
              onChange={(e) => {
                setCheckDate(e.target.value);
                setSelectedPaymentMethod('');
              }}
              aria-label="Select Check Date"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="payment-method-filter">
              Payment Method
            </label>
            <select
              id="payment-method-filter"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              aria-label="Select Payment Method"
              disabled={isLoading}
            >
              <option value="">All Payment Methods</option>
              {paymentMethods.map(method => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="currency-filter">
              Currency
            </label>
            <select
              id="currency-filter"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              aria-label="Select Currency"
              disabled={isLoading}
            >
              <option value="NGN">Naira (₦)</option>
              <option value="USD">US Dollar ($)</option>
              <option value="GBP">British Pound (£)</option>
              <option value="EUR">Euro (€)</option>
            </select>
          </div>
          <button
            className="col-span-1 sm:col-span-2 md:col-span-1 mt-6 bg-indigo-600 text-white p-3 rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 transition transform hover:scale-105"
            onClick={() => {
              if (!storeId || !checkDate) {
                toast.error('Please select a store and check date.');
                return;
              }
              fetchSales();
              fetchReconciliationChecks();
            }}
            aria-label="Apply Filters"
            disabled={isLoading}
          >
            Apply Filters
          </button>
          <button
            className="col-span-1 sm:col-span-2 md:col-span-1 mt-6 bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 transition transform hover:scale-105"
            onClick={() => {
              if (!storeId || !checkDate) {
                toast.error('Please select a store and check date.');
                return;
              }
              setShowAddModal(true);
              setNewCheck({
                payment_method: selectedPaymentMethod || '',
                expected_amount: selectedPaymentMethod && salesByPaymentMethod[selectedPaymentMethod]
                  ? salesByPaymentMethod[selectedPaymentMethod].amount
                  : 0,
                actual_amount: 0,
                notes: '',
                status: 'pending',
              });
            }}
            aria-label="Add New Check"
            disabled={isLoading}
          >
            Add New Check
          </button>
          <button
            className="col-span-1 sm:col-span-2 md:col-span-1 mt-6 bg-gray-600 text-white p-3 rounded-lg hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 transition transform hover:scale-105"
            onClick={() => downloadCSV(
              reconciliationChecks.map(c => ({
                ...c,
                store_name: c.stores.shop_name,
                payment_method: normalizePaymentMethod(c.payment_method),
              })),
              `reconciliation_checks_${format(new Date(), 'yyyy-MM-dd')}.csv`
            )}
            aria-label="Export to CSV"
            disabled={isLoading}
          >
            Export to CSV
          </button>
        </div>
      )}

      {/* Total Sales Card */}
      {storeId && !isLoading && (
        <div className="mb-8 bg-white p-6 rounded-xl shadow-md">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Total Sales Amount</h3>
          {sales.length === 0 ? (
            <p className="text-gray-500 text-center">No sales data available for the selected filters.</p>
          ) : (
            <div className="bg-gray-50 p-4 rounded-md text-center shadow-sm">
              <p className="text-lg font-bold text-green-600">{formatCurrency(totalSalesAmount)}</p>
              <p className="text-xs text-gray-500">
                {selectedPaymentMethod || 'All Payment Methods'} ({sales.length} transactions)
              </p>
            </div>
          )}
        </div>
      )}

      {/* Sales by Payment Method Cards */}
      {storeId && !isLoading && Object.keys(salesByPaymentMethod).length > 0 && (
        <div className="mb-8 bg-white p-6 rounded-xl shadow-md">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Sales by Payment Method</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(salesByPaymentMethod).map(([method, data]) => (
              <div key={method} className="bg-gray-50 p-4 rounded-md text-center shadow-sm">
                <h4 className="text-sm font-medium text-gray-700">{method}</h4>
                <p className="text-lg font-bold text-green-600">{formatCurrency(data.amount)}</p>
                <p className="text-xs text-gray-500">{data.count} transaction(s)</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sales Table */}
      {storeId && !isLoading && (
        <div className="mb-8 bg-white p-6 rounded-xl shadow-md">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">All Sales</h3>
          {sales.length === 0 ? (
            <p className="text-gray-500 text-center">No sales found for the selected filters. Check store, date, or period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-3 text-left text-gray-700 font-semibold">Date</th>
                    <th className="p-3 text-left text-gray-700 font-semibold">Payment Method</th>
                    <th className="p-3 text-left text-gray-700 font-semibold">Amount ({currencySymbols[currency]})</th>
                    <th className="p-3 text-left text-gray-700 font-semibold">Customer</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map(sale => (
                    <tr key={sale.id} className="border-t hover:bg-gray-50 transition">
                      <td className="p-3">{format(new Date(sale.sold_at), 'yyyy-MM-dd HH:mm')}</td>
                      <td className="p-3">{normalizePaymentMethod(sale.payment_method)}</td>
                      <td className="p-3">{formatCurrency(sale.amount)}</td>
                      <td className="p-3">{sale.customer_name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Suspicious Patterns */}
      {suspiciousPatterns.length > 0 && !isLoading && (
        <div className="mb-8 bg-yellow-100 p-6 rounded-xl shadow-md">
          <h3 className="text-lg font-semibold text-yellow-700 mb-2">⚠️ Things to Check</h3>
          <ul className="list-disc pl-5 text-yellow-700">
            {suspiciousPatterns.map((pattern, index) => (
              <li key={index}>{pattern}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Money Received by Payment Method (Chart) */}
      {storeId && !isLoading && (
        <div className="mb-8 bg-white p-6 rounded-xl shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Money Received by Payment Method</h3>
            <button
              onClick={() => setShowPayments(!showPayments)}
              className="text-sm text-indigo-600 hover:underline focus:outline-none"
            >
              {showPayments ? 'Hide Chart' : 'Show Chart'}
            </button>
          </div>
          {showPayments && (
            paymentMethods.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  {paymentMethods.map(method => (
                    <div key={method} className="bg-gray-50 p-4 rounded-md text-center shadow-sm">
                      <h4 className="text-sm font-medium text-gray-700 truncate">{method}</h4>
                      <p className="text-lg font-bold text-green-600 truncate">
                        {formatCurrency(salesByPaymentMethod[method]?.amount || 0)}
                      </p>
                      <p className="text-xs text-gray-500">{salesByPaymentMethod[method]?.count || 0} transactions</p>
                    </div>
                  ))}
                </div>
                <Bar
                  data={chartData}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { position: 'top' },
                      tooltip: { enabled: true },
                    },
                  }}
                />
              </>
            ) : (
              <p className="text-gray-500 text-center">No sales data available for the selected filters.</p>
            )
          )}
        </div>
      )}

      {/* Total Discrepancies Card */}
      {storeId && !isLoading && reconciliationChecks.length > 0 && (
        <div className="mb-8 bg-white p-6 rounded-xl shadow-md">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Total Discrepancies</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-md text-center shadow-sm">
              <h4 className="text-sm font-medium text-gray-700">All Methods</h4>
              <p className={`text-lg font-bold ${totalDiscrepancy > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(totalDiscrepancy)}
              </p>
            </div>
            {Object.entries(discrepanciesByPaymentMethod).map(([method, discrepancy]) => (
              <div key={method} className="bg-gray-50 p-4 rounded-md text-center shadow-sm">
                <h4 className="text-sm font-medium text-gray-700">{method}</h4>
                <p className={`text-lg font-bold ${discrepancy > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(discrepancy)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reconciliation Checks Table */}
      {storeId && !isLoading && (
        <div className="bg-white p-6 rounded-xl shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Saved Checks</h3>
            <div className="text-sm font-semibold text-gray-700">
              Total Discrepancy: <span className={totalDiscrepancy > 0 ? 'text-red-600' : 'text-green-600'}>
                {formatCurrency(totalDiscrepancy)}
              </span>
            </div>
            <button
              onClick={() => setShowChecks(!showChecks)}
              className="text-sm text-indigo-600 hover:underline focus:outline-none"
            >
              {showChecks ? 'Hide Table' : 'Show Table'}
            </button>
          </div>
          {showChecks && (
            reconciliationChecks.length === 0 ? (
              <p className="text-gray-500 text-center">No reconciliation checks found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-3 text-left text-gray-700 font-semibold">Date</th>
                      <th className="p-3 text-left text-gray-700 font-semibold">Store</th>
                      <th className="p-3 text-left text-gray-700 font-semibold">Period</th>
                      <th className="p-3 text-left text-gray-700 font-semibold">Payment Method</th>
                      <th className="p-3 text-left text-gray-700 font-semibold">Expected ({currencySymbols[currency]})</th>
                      <th className="p-3 text-left text-gray-700 font-semibold">Actual ({currencySymbols[currency]})</th>
                      <th className="p-3 text-left text-gray-700 font-semibold">Discrepancy ({currencySymbols[currency]})</th>
                      <th className="p-3 text-left text-gray-700 font-semibold">Status</th>
                      <th className="p-3 text-left text-gray-700 font-semibold">Notes</th>
                      <th className="p-3 text-left text-gray-700 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconciliationChecks.map(check => (
                      <tr key={check.id} className="border-t hover:bg-gray-50 transition">
                        <td className="p-3">{check.check_date}</td>
                        <td className="p-3">{check.stores.shop_name}</td>
                        <td className="p-3 capitalize">{check.period}</td>
                        <td className="p-3">{normalizePaymentMethod(check.payment_method)}</td>
                        <td className="p-3">{formatCurrency(check.expected_amount)}</td>
                        <td className="p-3">{formatCurrency(check.actual_amount)}</td>
                        <td className={`p-3 ${check.discrepancy > 0 ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                          {formatCurrency(check.discrepancy)}
                        </td>
                        <td className="p-3 capitalize">{check.status}</td>
                        <td className="p-3">{check.notes || '-'}</td>
                        <td className="p-3 flex space-x-2">
                          <button
                            className="text-indigo-600 hover:text-indigo-800"
                            onClick={() => {
                              setSelectedCheck(check);
                              setShowEditModal(true);
                            }}
                            aria-label={`Edit check for ${normalizePaymentMethod(check.payment_method)}`}
                          >
                            Edit
                          </button>
                          <button
                            className="text-red-600 hover:text-red-800"
                            onClick={() => {
                              setSelectedCheck(check);
                              setShowDeleteModal(true);
                            }}
                            aria-label={`Delete check for ${normalizePaymentMethod(check.payment_method)}`}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}

      {/* Add Check Modal */}
      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Add New Check</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Payment Method</label>
                <select
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  value={newCheck.payment_method}
                  onChange={(e) => setNewCheck({ ...newCheck, payment_method: e.target.value })}
                  disabled={isLoading || !storeId}
                  aria-label="Select Payment Method for Check"
                >
                  <option value="">Select method</option>
                  <option value="All Payment Methods">All Payment Methods</option>
                  {paymentMethods.map(method => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Money You Should Have ({currencySymbols[currency]})</label>
                <input
                  type="number"
                  className="w-full p-2 border rounded-lg bg-gray-100"
                  value={newCheck.expected_amount}
                  disabled
                  aria-label="Expected Amount"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Money You Have ({currencySymbols[currency]})</label>
                <input
                  type="number"
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  value={newCheck.actual_amount}
                  onChange={(e) => setNewCheck({ ...newCheck, actual_amount: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g., 950.00"
                  aria-label="Actual Amount"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <select
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  value={newCheck.status}
                  onChange={(e) => setNewCheck({ ...newCheck, status: e.target.value })}
                  aria-label="Select Status"
                >
                  <option value="pending">Pending</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  value={newCheck.notes}
                  onChange={(e) => setNewCheck({ ...newCheck, notes: e.target.value })}
                  placeholder="e.g., Checked cash deposit slip"
                  aria-label="Notes"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-2">
              <button
                className="bg-gray-500 text-white p-2 rounded-lg hover:bg-gray-600 focus:ring-2 focus:ring-gray-500"
                onClick={() => setShowAddModal(false)}
                aria-label="Cancel"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500"
                onClick={handleAddCheck}
                aria-label="Save Check"
                disabled={isLoading}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Check Modal */}
      {showEditModal && selectedCheck && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Edit Check</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Payment Method</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded-lg bg-gray-100"
                  value={normalizePaymentMethod(selectedCheck.payment_method)}
                  disabled
                  aria-label="Payment Method"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Money You Should Have ({currencySymbols[currency]})</label>
                <input
                  type="number"
                  className="w-full p-2 border rounded-lg bg-gray-100"
                  value={selectedCheck.expected_amount}
                  disabled
                  aria-label="Expected Amount"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Money You Have ({currencySymbols[currency]})</label>
                <input
                  type="number"
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  value={selectedCheck.actual_amount}
                  onChange={(e) => setSelectedCheck({ ...selectedCheck, actual_amount: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g., 950.00"
                  aria-label="Actual Amount"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <select
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  value={selectedCheck.status}
                  onChange={(e) => setSelectedCheck({ ...selectedCheck, status: e.target.value })}
                  aria-label="Select Status"
                >
                  <option value="pending">Pending</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  value={selectedCheck.notes || ''}
                  onChange={(e) => setSelectedCheck({ ...selectedCheck, notes: e.target.value })}
                  placeholder="e.g., Updated after bank confirmation"
                  aria-label="Notes"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-2">
              <button
                className="bg-gray-500 text-white p-2 rounded-lg hover:bg-gray-600 focus:ring-2 focus:ring-gray-500"
                onClick={() => setShowEditModal(false)}
                aria-label="Cancel"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500"
                onClick={handleEditCheck}
                aria-label="Save Check"
                disabled={isLoading}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedCheck && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Delete Check?</h3>
            <p className="text-gray-600">
              Are you sure you want to delete the check for {normalizePaymentMethod(selectedCheck.payment_method)} on {selectedCheck.check_date}? This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end space-x-2">
              <button
                className="bg-gray-500 text-white p-2 rounded-lg hover:bg-gray-600 focus:ring-2 focus:ring-gray-500"
                onClick={() => setShowDeleteModal(false)}
                aria-label="Cancel"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                className="bg-red-600 text-white p-2 rounded-lg hover:bg-red-700 focus:ring-2 focus:ring-red-500"
                onClick={handleDeleteCheck}
                aria-label="Delete Check"
                disabled={isLoading}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-indigo-500"></div>
        </div>
      )}
    </div>
  );
};

export default Reconciliation;