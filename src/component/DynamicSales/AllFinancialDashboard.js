import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend } from 'chart.js';
import { format, subDays, parseISO, startOfDay, startOfWeek, startOfMonth } from 'date-fns';
import 'tailwindcss/tailwind.css';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend);

const FinancialDashboard = () => {
  const ownerId = Number(localStorage.getItem('owner_id')) || null;
  const [storeId, setStoreId] = useState(localStorage.getItem('store_id') || '');
  const [stores, setStores] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [debts, setDebts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [products, setProducts] = useState([]);
  const [storeComparison, setStoreComparison] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showProducts, setShowProducts] = useState(false);
  const [timeFilter, setTimeFilter] = useState('30d');
  const [timeGranularity, setTimeGranularity] = useState('monthly');
  const [metricFilter, setMetricFilter] = useState('All');
  const [comparisonMetric, setComparisonMetric] = useState('totalSales'); // For comparison chart
  const [currency, setCurrency] = useState('NGN');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const currencySymbols = {
    NGN: '₦',
    USD: '$',
    GBP: '£',
    EUR: '€',
  };

  // Format number with currency symbol
  const formatCurrency = (value) => `${currencySymbols[currency]}${value.toFixed(2)}`;

  // Fetch stores for dropdown, restricted to ownerId
  const fetchStores = useCallback(async () => {
    if (!ownerId) {
      toast.error('No owner ID found. Please log in.');
      setStores([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const { data: storeData, error: storeErr } = await supabase
      .from('stores')
      .select('id, shop_name')
      .eq('owner_user_id', ownerId);
    if (storeErr) {
      toast.error('Error fetching stores: ' + storeErr.message);
      setStores([]);
      setIsLoading(false);
      return;
    }
    setStores(storeData || []);
    if (storeData.length === 0) {
      toast.warn('No stores found for this owner.');
    } else if (!storeId && storeData.length > 0) {
      setStoreId(storeData[0].id);
      localStorage.setItem('store_id', storeData[0].id);
    }
    setIsLoading(false);
  }, [ownerId, storeId]);

  // Fetch sales for selected store
  const fetchSales = useCallback(async () => {
    if (!storeId) {
      setSales([]);
      return;
    }
    setIsLoading(true);
    let query = supabase
      .from('dynamic_sales')
      .select(`
        amount,
        sold_at,
        quantity,
        dynamic_product_id,
        dynamic_product (name)
      `)
      .eq('store_id', storeId)
      .eq('status', 'sold');
    
    if (timeFilter !== 'custom') {
      const start = timeFilter === '30d' ? subDays(new Date(), 30) : timeFilter === '6m' ? subDays(new Date(), 180) : subDays(new Date(), 365);
      query = query.gte('sold_at', format(start, 'yyyy-MM-dd'));
    } else if (startDate && endDate) {
      query = query.gte('sold_at', startDate).lte('sold_at', endDate);
    }

    const { data, error } = await query;
    if (error) {
      toast.error('Error loading sales: ' + error.message);
      setSales([]);
    } else {
      setSales(data || []);
    }
    setIsLoading(false);
  }, [storeId, timeFilter, startDate, endDate]);

  // Fetch expenses for selected store
  const fetchExpenses = useCallback(async () => {
    if (!storeId) {
      setExpenses([]);
      return;
    }
    setIsLoading(true);
    let query = supabase
      .from('expense_tracker')
      .select('amount, expense_type, expense_date')
      .eq('store_id', storeId);
    
    if (timeFilter !== 'custom') {
      const start = timeFilter === '30d' ? subDays(new Date(), 30) : timeFilter === '6m' ? subDays(new Date(), 180) : subDays(new Date(), 365);
      query = query.gte('expense_date', format(start, 'yyyy-MM-dd'));
    } else if (startDate && endDate) {
      query = query.gte('expense_date', startDate).lte('expense_date', endDate);
    }

    const { data, error } = await query;
    if (error) {
      toast.error('Error loading expenses: ' + error.message);
      setExpenses([]);
    } else {
      setExpenses(data || []);
    }
    setIsLoading(false);
  }, [storeId, timeFilter, startDate, endDate]);

  // Fetch debts for selected store
  const fetchDebts = useCallback(async () => {
    if (!storeId) {
      setDebts([]);
      return;
    }
    setIsLoading(true);
    let query = supabase
      .from('debts')
      .select('remaining_balance, product_name, date')
      .eq('store_id', storeId);
    
    if (timeFilter !== 'custom') {
      const start = timeFilter === '30d' ? subDays(new Date(), 30) : timeFilter === '6m' ? subDays(new Date(), 180) : subDays(new Date(), 365);
      query = query.gte('date', format(start, 'yyyy-MM-dd'));
    } else if (startDate && endDate) {
      query = query.gte('date', startDate).lte('date', endDate);
    }

    const { data, error } = await query;
    if (error) {
      toast.error('Error loading debts: ' + error.message);
      setDebts([]);
    } else {
      setDebts(data || []);
    }
    setIsLoading(false);
  }, [storeId, timeFilter, startDate, endDate]);

  // Fetch inventory and products for selected store
  const fetchInventory = useCallback(async () => {
    if (!storeId) {
      setInventory([]);
      setProducts([]);
      return;
    }
    setIsLoading(true);
    const { data: invData, error: invError } = await supabase
      .from('dynamic_inventory')
      .select('available_qty, dynamic_product_id')
      .eq('store_id', storeId);
    
    const { data: prodData, error: prodError } = await supabase
      .from('dynamic_product')
      .select('id, name, purchase_price, selling_price, store_id')
      .eq('store_id', storeId);
    
    if (invError || prodError) {
      toast.error('Error loading inventory/products: ' + (invError?.message || prodError?.message));
      setInventory([]);
      setProducts([]);
    } else {
      setInventory(invData || []);
      setProducts(prodData || []);
    }
    setIsLoading(false);
  }, [storeId]);

  // Fetch data for store comparison
  const fetchStoreComparison = useCallback(async () => {
    if (!ownerId || stores.length === 0) {
      setStoreComparison([]);
      return;
    }
    setIsLoading(true);
    const comparisonData = [];

    for (const store of stores) {
      let salesQuery = supabase
        .from('dynamic_sales')
        .select('amount, quantity, dynamic_product_id')
        .eq('store_id', store.id)
        .eq('status', 'sold');
      
      let expensesQuery = supabase
        .from('expense_tracker')
        .select('amount')
        .eq('store_id', store.id);
      
      let debtsQuery = supabase
        .from('debts')
        .select('remaining_balance')
        .eq('store_id', store.id);
      
      
      const { data: prodData } = await supabase
        .from('dynamic_product')
        .select('id, purchase_price')
        .eq('store_id', store.id);

      if (timeFilter !== 'custom') {
        const start = timeFilter === '30d' ? subDays(new Date(), 30) : timeFilter === '6m' ? subDays(new Date(), 180) : subDays(new Date(), 365);
        salesQuery = salesQuery.gte('sold_at', format(start, 'yyyy-MM-dd'));
        expensesQuery = expensesQuery.gte('expense_date', format(start, 'yyyy-MM-dd'));
        debtsQuery = debtsQuery.gte('date', format(start, 'yyyy-MM-dd'));
      } else if (startDate && endDate) {
        salesQuery = salesQuery.gte('sold_at', startDate).lte('sold_at', endDate);
        expensesQuery = expensesQuery.gte('expense_date', startDate).lte('expense_date', endDate);
        debtsQuery = debtsQuery.gte('date', startDate).lte('date', endDate);
      }

      const { data: salesData, error: salesError } = await salesQuery;
      const { data: expensesData, error: expensesError } = await expensesQuery;
      const { data: debtsData, error: debtsError } = await debtsQuery;

      if (salesError || expensesError || debtsError) {
        toast.error(`Error loading data for ${store.shop_name}: ${salesError?.message || expensesError?.message || debtsError?.message}`);
        continue;
      }

      const totalSales = salesData.reduce((sum, sale) => sum + sale.amount, 0);
      const totalExpenses = expensesData.reduce((sum, exp) => sum + exp.amount, 0);
      const totalDebts = debtsData.reduce((sum, debt) => sum + (debt.remaining_balance || 0), 0);
      const totalCOGS = salesData.reduce((sum, sale) => {
        const product = prodData.find(p => p.id === sale.dynamic_product_id);
        return sum + (product?.purchase_price || 0) * sale.quantity;
      }, 0);
      const totalProfit = totalSales - totalCOGS - totalExpenses;
      const profitMargin = totalSales ? ((totalProfit / totalSales) * 100).toFixed(2) : 0;

      comparisonData.push({
        storeId: store.id,
        storeName: store.shop_name,
        totalSales,
        totalExpenses,
        totalDebts,
        totalCOGS,
        totalProfit,
        profitMargin,
      });
    }

    setStoreComparison(comparisonData);
    setIsLoading(false);
  }, [ownerId, stores, timeFilter, startDate, endDate]);

  // Calculate metrics for selected store
  const totalSales = sales.reduce((sum, sale) => sum + sale.amount, 0);
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const totalDebts = debts.reduce((sum, debt) => sum + (debt.remaining_balance || 0), 0);
  const totalInventoryCost = inventory.reduce((sum, inv) => {
    const product = products.find(p => p.id === inv.dynamic_product_id);
    return sum + (product?.purchase_price || 0) * inv.available_qty;
  }, 0);
  const totalCOGS = sales.reduce((sum, sale) => {
    const product = products.find(p => p.id === sale.dynamic_product_id);
    return sum + (product?.purchase_price || 0) * sale.quantity;
  }, 0);
  const totalProfit = totalSales - totalCOGS - totalExpenses;
  const profitMargin = totalSales ? ((totalProfit / totalSales) * 100).toFixed(2) : 0;

  // Sales by product for selected store
  const salesByProduct = sales.reduce((acc, sale) => {
    const productName = sale.dynamic_product?.name || 'Unknown';
    if (!acc[productName]) {
      acc[productName] = { amount: 0, quantity: 0 };
    }
    acc[productName].amount += sale.amount;
    acc[productName].quantity += sale.quantity;
    return acc;
  }, {});
  const topProducts = Object.entries(salesByProduct)
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 5)
    .map(([name, data]) => ({ name, ...data }));

  // Sales trend data for selected store
  const salesByPeriod = sales.reduce((acc, sale) => {
    const date = parseISO(sale.sold_at);
    let period;
    if (timeGranularity === 'daily') {
      period = format(startOfDay(date), 'yyyy-MM-dd');
    } else if (timeGranularity === 'weekly') {
      period = format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    } else {
      period = format(startOfMonth(date), 'yyyy-MM');
    }
    acc[period] = (acc[period] || 0) + sale.amount;
    return acc;
  }, {});
  const salesTrendData = {
    labels: Object.keys(salesByPeriod).sort(),
    datasets: [{
      label: `Money Earned (${currencySymbols[currency]})`,
      data: Object.keys(salesByPeriod).sort().map(period => salesByPeriod[period]),
      borderColor: '#10B981',
      backgroundColor: 'rgba(16, 185, 129, 0.2)',
      fill: true,
    }],
  };

  // COGS vs Sales for selected store
  const cogsVsSalesData = {
    labels: ['Money Earned', 'Cost of Goods'],
    datasets: [{
      label: `Amount (${currencySymbols[currency]})`,
      data: [totalSales, totalCOGS],
      backgroundColor: ['#10B981', '#EF4444'],
    }],
  };

  // Expense breakdown for selected store
  const expenseByType = expenses.reduce((acc, exp) => {
    acc[exp.expense_type] = (acc[exp.expense_type] || 0) + exp.amount;
    return acc;
  }, {});
  const expensePieData = {
    labels: Object.keys(expenseByType),
    datasets: [{
      label: `Money Spent (${currencySymbols[currency]})`,
      data: Object.values(expenseByType),
      backgroundColor: ['#10B981', '#EF4444', '#3B82F6', '#F59E0B', '#6B7280'],
    }],
  };

  // Store comparison chart
  const comparisonChartData = {
    labels: storeComparison.map(s => s.storeName),
    datasets: [{
      label: comparisonMetric === 'profitMargin' ? 'Profit Margin (%)' : `${comparisonMetric.replace('total', '')} (${currencySymbols[currency]})`,
      data: storeComparison.map(s => s[comparisonMetric]),
      backgroundColor: comparisonMetric === 'totalSales' ? '#10B981' :
                       comparisonMetric === 'totalExpenses' ? '#EF4444' :
                       comparisonMetric === 'totalCOGS' ? '#3B82F6' :
                       comparisonMetric === 'totalDebts' ? '#F59E0B' :
                       comparisonMetric === 'totalProfit' ? '#6B7280' : '#8B5CF6',
    }],
  };

  // Best performers for comparison
  const bestPerformers = {
    totalSales: storeComparison.reduce((max, s) => s.totalSales > (max?.totalSales || 0) ? s : max, null)?.storeName,
    totalExpenses: storeComparison.reduce((min, s) => s.totalExpenses < (min?.totalExpenses || Infinity) ? s : min, null)?.storeName,
    totalCOGS: storeComparison.reduce((min, s) => s.totalCOGS < (min?.totalCOGS || Infinity) ? s : min, null)?.storeName,
    totalDebts: storeComparison.reduce((min, s) => s.totalDebts < (min?.totalDebts || Infinity) ? s : min, null)?.storeName,
    totalProfit: storeComparison.reduce((max, s) => s.totalProfit > (max?.totalProfit || 0) ? s : max, null)?.storeName,
    profitMargin: storeComparison.reduce((max, s) => s.profitMargin > (max?.profitMargin || 0) ? s : max, null)?.storeName,
  };

  // Fetch initial data
  useEffect(() => {
    if (!ownerId) {
      toast.error('Please log in to view your stores.');
      setStores([]);
      setSales([]);
      setExpenses([]);
      setDebts([]);
      setInventory([]);
      setProducts([]);
      setStoreComparison([]);
      return;
    }
    fetchStores();
  }, [ownerId, fetchStores]);

  // Fetch data when storeId or filters change
  useEffect(() => {
    if (!storeId || metricFilter === 'Comparison') {
      setSales([]);
      setExpenses([]);
      setDebts([]);
      setInventory([]);
      setProducts([]);
      return;
    }
    fetchSales();
    fetchExpenses();
    fetchDebts();
    fetchInventory();
  }, [storeId, metricFilter, fetchSales, fetchExpenses, fetchDebts, fetchInventory]);

  // Fetch store comparison data
  useEffect(() => {
    if (stores.length > 0 && metricFilter === 'Comparison') {
      fetchStoreComparison();
    }
  }, [stores, metricFilter, timeFilter, startDate, endDate, fetchStoreComparison]);

  return (
    <div className="p-8 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen transition-all duration-300">
      
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 dark:text-gray-100 bg-gradient-to-r from-indigo-500 to-indigo-700 text-white py-4 rounded-lg">
         Your Business Money Dashboard
      </h2>
      {/* Filters */}
      <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-white p-6 rounded-xl shadow-lg">
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
            }}
            aria-label="Select Store"
          >
            <option value="">Select a store</option>
            {stores.map(store => (
              <option key={store.id} value={store.id}>{store.shop_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="time-filter">
            Time Period
          </label>
          <select
            id="time-filter"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            aria-label="Select Time Period"
          >
            <option value="30d">Last 30 Days</option>
            <option value="6m">Last 6 Months</option>
            <option value="1y">Last Year</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="time-granularity">
            Sales View
          </label>
          <select
            id="time-granularity"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
            value={timeGranularity}
            onChange={(e) => setTimeGranularity(e.target.value)}
            aria-label="Select Sales Granularity"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
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
          >
            <option value="NGN">Naira (₦)</option>
            <option value="USD">US Dollar ($)</option>
            <option value="GBP">British Pound (£)</option>
            <option value="EUR">Euro (€)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="metric-filter">
            Metric
          </label>
          <select
            id="metric-filter"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
            value={metricFilter}
            onChange={(e) => setMetricFilter(e.target.value)}
            aria-label="Select Metric"
          >
            <option value="All">All Metrics</option>
            <option value="Sales">Money Earned</option>
            <option value="Expenses">Money Spent</option>
            <option value="COGS">Cost of Goods</option>
            <option value="Debts">Money Owed</option>
            <option value="Comparison">Compare Stores</option>
          </select>
        </div>
        {timeFilter === 'custom' && (
          <>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="start-date">
                Start Date
              </label>
              <input
                id="start-date"
                type="date"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                aria-label="Select Start Date"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="end-date">
                End Date
              </label>
              <input
                id="end-date"
                type="date"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                aria-label="Select End Date"
              />
            </div>
          </>
        )}
        <button
          className="col-span-1 sm:col-span-2 md:col-span-1 mt-6 bg-indigo-600 text-white p-3 rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 transition transform hover:scale-105"
          onClick={() => {
            if (metricFilter !== 'Comparison' && !storeId) {
              toast.error('Please select a store');
              return;
            }
            fetchSales();
            fetchExpenses();
            fetchDebts();
            fetchInventory();
            if (metricFilter === 'Comparison') {
              fetchStoreComparison();
            }
          }}
          aria-label="Apply Filters"
        >
          Apply Filters
        </button>
      </div>

      {/* Single Store Content */}
      {metricFilter !== 'Comparison' && storeId && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition transform hover:-translate-y-1" aria-label="Total Money Earned">
              <h2 className="text-lg font-semibold text-gray-700">Money Earned</h2>
              <p className="text-3xl font-bold text-green-600 mt-2">{formatCurrency(totalSales)}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition transform hover:-translate-y-1" aria-label="Total Money Spent">
              <h2 className="text-lg font-semibold text-gray-700">Money Spent</h2>
              <p className="text-3xl font-bold text-red-600 mt-2">{formatCurrency(totalExpenses)}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition transform hover:-translate-y-1" aria-label="Money Owed to You">
              <h2 className="text-lg font-semibold text-gray-700">Money Owed to You</h2>
              <p className="text-3xl font-bold text-yellow-600 mt-2">{formatCurrency(totalDebts)}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition transform hover:-translate-y-1" aria-label="Inventory Cost">
              <h2 className="text-lg font-semibold text-gray-700">Inventory Cost</h2>
              <p className="text-3xl font-bold text-gray-600 mt-2">{formatCurrency(totalInventoryCost)}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition transform hover:-translate-y-1" aria-label="Total Profit">
              <h2 className="text-lg font-semibold text-gray-700">Profit</h2>
              <p className="text-3xl font-bold text-indigo-600 mt-2">{formatCurrency(totalProfit)}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition transform hover:-translate-y-1" aria-label="Profit Margin">
              <h2 className="text-lg font-semibold text-gray-700">Profit Margin</h2>
              <p className="text-3xl font-bold text-purple-600 mt-2">{profitMargin}%</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {(metricFilter === 'All' || metricFilter === 'Sales') && (
              <div className="bg-white p-6 rounded-xl shadow-md">
                <h2 className="text-lg font-semibold text-gray-700 mb-4" aria-label="Sales Trend Over Time">
                  Money Earned Trend ({timeGranularity.charAt(0).toUpperCase() + timeGranularity.slice(1)})
                </h2>
                <Line data={salesTrendData} options={{ responsive: true, plugins: { legend: { position: 'top' }, tooltip: { enabled: true } } }} />
              </div>
            )}
            {(metricFilter === 'All' || metricFilter === 'Sales' || metricFilter === 'COGS') && (
              <div className="bg-white p-6 rounded-xl shadow-md">
                <h2 className="text-lg font-semibold text-gray-700 mb-4" aria-label="Sales vs Cost of Goods">
                  Money Earned vs Cost of Goods
                </h2>
                <Bar data={cogsVsSalesData} options={{ responsive: true, plugins: { legend: { position: 'top' }, tooltip: { enabled: true } } }} />
              </div>
            )}
            {(metricFilter === 'All' || metricFilter === 'Expenses') && (
              <div className="bg-white p-6 rounded-xl shadow-md">
                <h2 className="text-lg font-semibold text-gray-700 mb-4" aria-label="Expense Breakdown">
                  Money Spent Breakdown
                </h2>
                {Object.keys(expenseByType).length > 0 ? (
                  <Pie data={expensePieData} options={{ responsive: true, plugins: { legend: { position: 'top' }, tooltip: { enabled: true } } }} />
                ) : (
                  <p className="text-gray-500 text-center">No expense data available.</p>
                )}
              </div>
            )}
          </div>

          {/* Top Products Table */}
          {(metricFilter === 'All' || metricFilter === 'Sales') && (
            <div className="bg-white p-6 rounded-xl shadow-md mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-700" aria-label="Top Selling Products">
                  Top Selling Products
                </h2>
                <button
                  className="text-indigo-600 hover:text-indigo-800 font-medium transition"
                  onClick={() => setShowProducts(!showProducts)}
                  aria-label={showProducts ? 'Hide Top Products' : 'Show Top Products'}
                >
                  {showProducts ? 'Hide' : 'Show'}
                </button>
              </div>
              {showProducts && (
                <>
                  {topProducts.length === 0 ? (
                    <p className="text-gray-500 text-center">No sales data available for the selected filters.</p>
                  ) : (
                    <table className="w-full table-auto">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="p-3 text-left text-gray-700 font-semibold">Product</th>
                          <th className="p-3 text-left text-gray-700 font-semibold">Total Sales ({currencySymbols[currency]})</th>
                          <th className="p-3 text-left text-gray-700 font-semibold">Total Quantity Sold</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topProducts.map((product, index) => (
                          <tr key={index} className="border-t hover:bg-gray-50 transition">
                            <td className="p-3">{product.name}</td>
                            <td className="p-3">{formatCurrency(product.amount)}</td>
                            <td className="p-3">{product.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Store Comparison Section */}
      {metricFilter === 'Comparison' && stores.length > 1 && (
        <div className="bg-white p-8 rounded-xl shadow-lg mb-8 animate-fade-in">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center" aria-label="Store Comparison">
            Compare Your Stores
          </h2>
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="comparison-metric">
              Select Metric to Visualize
            </label>
            <select
              id="comparison-metric"
              className="w-full max-w-xs p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
              value={comparisonMetric}
              onChange={(e) => setComparisonMetric(e.target.value)}
              aria-label="Select Comparison Metric"
            >
              <option value="totalSales">Money Earned</option>
              <option value="totalExpenses">Money Spent</option>
              <option value="totalCOGS">Cost of Goods</option>
              <option value="totalDebts">Money Owed</option>
              <option value="totalProfit">Profit</option>
              <option value="profitMargin">Profit Margin</option>
            </select>
          </div>
          {storeComparison.length === 0 ? (
            <p className="text-gray-500 text-center">No comparison data available.</p>
          ) : (
            <>
              {/* Comparison Chart */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">
                  {comparisonMetric === 'totalSales' ? 'Money Earned Comparison' :
                   comparisonMetric === 'totalExpenses' ? 'Money Spent Comparison' :
                   comparisonMetric === 'totalCOGS' ? 'Cost of Goods Comparison' :
                   comparisonMetric === 'totalDebts' ? 'Money Owed Comparison' :
                   comparisonMetric === 'totalProfit' ? 'Profit Comparison' : 'Profit Margin Comparison'}
                </h3>
                <Bar data={comparisonChartData} options={{ responsive: true, plugins: { legend: { position: 'top' }, tooltip: { enabled: true } } }} />
              </div>

              {/* Comparison Table */}
              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-3 text-left text-gray-700 font-semibold">Store</th>
                      <th className="p-3 text-left text-gray-700 font-semibold">Money Earned ({currencySymbols[currency]})</th>
                      <th className="p-3 text-left text-gray-700 font-semibold">Money Spent ({currencySymbols[currency]})</th>
                      <th className="p-3 text-left text-gray-700 font-semibold">Cost of Goods ({currencySymbols[currency]})</th>
                      <th className="p-3 text-left text-gray-700 font-semibold">Money Owed ({currencySymbols[currency]})</th>
                      <th className="p-3 text-left text-gray-700 font-semibold">Profit ({currencySymbols[currency]})</th>
                      <th className="p-3 text-left text-gray-700 font-semibold">Profit Margin (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storeComparison.map((store, index) => (
                      <tr key={index} className="border-t hover:bg-gray-50 transition">
                        <td className="p-3 font-medium">{store.storeName}</td>
                        <td className={`p-3 ${store.storeName === bestPerformers.totalSales ? 'bg-green-100 font-bold' : ''}`}>
                          {formatCurrency(store.totalSales)}
                        </td>
                        <td className={`p-3 ${store.storeName === bestPerformers.totalExpenses ? 'bg-green-100 font-bold' : ''}`}>
                          {formatCurrency(store.totalExpenses)}
                        </td>
                        <td className={`p-3 ${store.storeName === bestPerformers.totalCOGS ? 'bg-green-100 font-bold' : ''}`}>
                          {formatCurrency(store.totalCOGS)}
                        </td>
                        <td className={`p-3 ${store.storeName === bestPerformers.totalDebts ? 'bg-green-100 font-bold' : ''}`}>
                          {formatCurrency(store.totalDebts)}
                        </td>
                        <td className={`p-3 ${store.storeName === bestPerformers.totalProfit ? 'bg-green-100 font-bold' : ''}`}>
                          {formatCurrency(store.totalProfit)}
                        </td>
                        <td className={`p-3 ${store.storeName === bestPerformers.profitMargin ? 'bg-green-100 font-bold' : ''}`}>
                          {store.profitMargin}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
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

export default FinancialDashboard;