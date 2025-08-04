
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const SalesTrends = () => {
  const [trends, setTrends] = useState([]);
  const [selectedMonthTopProduct, setSelectedMonthTopProduct] = useState(null);
  const [selectedMonthTopProducts, setSelectedMonthTopProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCharts, setShowCharts] = useState(true);
  const [storeId] = useState(localStorage.getItem('store_id') || null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    // Default to previous month
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().slice(0, 7); // Format: YYYY-MM
  });
  const [rangeFilter, setRangeFilter] = useState('single'); // Options: single, last3, last6, last9, last12, all

  useEffect(() => {
    const fetchData = async () => {
      if (!storeId) {
        setError('No store selected. Please log in or select a store.');
        setLoading(false);
        return;
      }

      try {
        // Fetch sales trends
        const { data: trendsData, error: trendsError } = await supabase
          .from('sales_trends')
          .select('month, total_quantity, monthly_growth, top_products')
          .eq('store_id', parseInt(storeId))
          .order('month', { ascending: true })
          .limit(100);

        if (trendsError) throw trendsError;

        // Fetch valid product IDs for this store from dynamic_sales
        const { data: salesData, error: salesError } = await supabase
          .from('dynamic_sales')
          .select('dynamic_product_id')
          .eq('store_id', parseInt(storeId))
          .gte('sold_at', '2025-01-01T00:00:00Z')
          .lte('sold_at', '2025-12-31T23:59:59Z');

        if (salesError) throw salesError;

        const validProductIds = new Set(salesData.map(sale => sale.dynamic_product_id.toString()));

        // Calculate start and end dates for the selected month
        const [year, month] = selectedMonth.split('-');
        const startDate = `${year}-${month}-01T00:00:00Z`;
        const endDate = new Date(year, month, 0).toISOString().slice(0, 10) + 'T23:59:59Z';

        // Fetch sales for the selected month
        const { data: monthData, error: monthError } = await supabase
          .from('dynamic_sales')
          .select('dynamic_product_id, quantity')
          .eq('store_id', parseInt(storeId))
          .gte('sold_at', startDate)
          .lte('sold_at', endDate);

        if (monthError) throw monthError;

        // Aggregate sales for the selected month
        const monthSalesAggregated = monthData.reduce((acc, sale) => {
          const productId = sale.dynamic_product_id.toString();
          acc[productId] = (acc[productId] || 0) + parseInt(sale.quantity);
          return acc;
        }, {});

        // Find top product for the selected month
        const topMonthProduct = Object.entries(monthSalesAggregated).reduce(
          (max, [id, qty]) => (parseInt(qty) > parseInt(max.qty) ? { id, qty } : max),
          { id: null, qty: 0 }
        );

        // Get top 5 products for the selected month
        const topFiveMonthProducts = Object.entries(monthSalesAggregated)
          .sort(([, qtyA], [, qtyB]) => parseInt(qtyB) - parseInt(qtyA))
          .slice(0, 5)
          .reduce((acc, [id, qty]) => ({ ...acc, [id]: qty }), {});

        // Fetch product names for valid products
        const productIds = [
          ...new Set([
            ...trendsData.flatMap(trend => Object.keys(trend.top_products || {}).filter(id => validProductIds.has(id))),
            ...Object.keys(monthSalesAggregated),
          ].filter(id => id).map(id => parseInt(id))),
        ];
        const { data: productsData, error: productsError } = await supabase
          .from('dynamic_product')
          .select('id, name')
          .in('id', productIds);

        if (productsError) throw productsError;

        const productMap = new Map(productsData.map(p => [p.id.toString(), p.name || `Unknown Product ${p.id}`]));

        // Process trends with store-specific top products
        const processedTrends = trendsData.map(trend => {
          const topProductsWithNames = {};
          for (const [id, qty] of Object.entries(trend.top_products || {})) {
            if (validProductIds.has(id)) {
              const name = productMap.get(id);
              if (name) {
                topProductsWithNames[name] = qty;
              }
            }
          }
          const topProduct = Object.entries(topProductsWithNames).reduce(
            (max, [name, qty]) => (parseInt(qty) > parseInt(max.qty) ? { name, qty } : max),
            { name: null, qty: 0 }
          );
          return {
            ...trend,
            top_products: topProductsWithNames,
            top_product: topProduct.name ? `${topProduct.name}: ${topProduct.qty}` : 'No sales',
          };
        });

        // Remove duplicates
        const uniqueTrends = Array.from(
          new Map(processedTrends.map(t => [t.month, t])).values()
        );

        // Set top product for the selected month
        const monthTopProductName = topMonthProduct.id ? productMap.get(topMonthProduct.id) : null;
        setSelectedMonthTopProduct(
          monthTopProductName && topMonthProduct.qty > 0
            ? { name: monthTopProductName, quantity: topMonthProduct.qty }
            : null
        );

        // Set top 5 products for the selected month with names
        const monthTopProductsWithNames = {};
        for (const [id, qty] of Object.entries(topFiveMonthProducts)) {
          const name = productMap.get(id) || `Unknown Product ${id}`;
          monthTopProductsWithNames[name] = qty;
        }
        setSelectedMonthTopProducts(monthTopProductsWithNames);

        setTrends(uniqueTrends);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch sales trends: ' + err.message);
        setLoading(false);
      }
    };
    fetchData();
  }, [storeId, selectedMonth]);

  // Filter trends based on rangeFilter
  const getFilteredTrends = () => {
    if (rangeFilter === 'all') return trends;
    if (rangeFilter === 'single') return trends.filter((trend) => trend.month === selectedMonth);
    
    const monthsToShow = parseInt(rangeFilter.replace('last', '')) || 12;
    const endDate = new Date(selectedMonth + '-01');
    const startDate = new Date(endDate);
    startDate.setMonth(endDate.getMonth() - monthsToShow + 1);
    const startMonth = startDate.toISOString().slice(0, 7);
    
    return trends.filter((trend) => trend.month >= startMonth && trend.month <= selectedMonth);
  };

  // Prepare data for Monthly Growth Chart
  const growthChartData = {
    labels: getFilteredTrends().map((t) => t.month),
    datasets: [
      {
        label: 'Monthly Growth (%)',
        data: getFilteredTrends().map((t) => Math.min(Math.max(t.monthly_growth * 100, -100), 100)),
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.2)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // Prepare data for Top Products Chart (Selected Month)
  const topProductsChartData = {
    labels: Object.keys(selectedMonthTopProducts),
    datasets: [
      {
        label: `Top Products in ${new Date(selectedMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}`,
        data: Object.values(selectedMonthTopProducts),
        backgroundColor: '#4f46e5',
        borderColor: '#4f46e5',
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { font: { size: 12 } } },
      tooltip: { enabled: true },
    },
    scales: {
      y: { beginAtZero: true, ticks: { font: { size: 10 }, color: '#000', dark: '#fff' } },
      x: { ticks: { font: { size: 10 }, color: '#000', dark: '#fff' } },
    },
  };

  // Insights for Monthly Growth
  const growthInsight = getFilteredTrends().length > 0 ? (
    getFilteredTrends().filter((t) => t.month === selectedMonth).length > 0 ? (
      getFilteredTrends().filter((t) => t.month === selectedMonth)[0].monthly_growth > 0 ? (
        <p className="text-green-600 dark:text-green-400">
          ⬆ Positive growth in {selectedMonth}: {Math.round(getFilteredTrends().filter((t) => t.month === selectedMonth)[0].monthly_growth * 100)}% increase.
        </p>
      ) : (
        <p className="text-red-600 dark:text-red-400">
          ⬇ Negative or no growth in {selectedMonth}: {Math.round(getFilteredTrends().filter((t) => t.month === selectedMonth)[0].monthly_growth * 100)}%.
        </p>
      )
    ) : (
      <p className="text-gray-600 dark:text-gray-300">No growth data available for {new Date(selectedMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}.</p>
    )
  ) : (
    <p className="text-gray-600 dark:text-gray-300">No growth data available.</p>
  );

  // Insights for Top Products (Selected Month)
  const topProductNames = Object.keys(selectedMonthTopProducts)
    .sort((a, b) => parseInt(selectedMonthTopProducts[b]) - parseInt(selectedMonthTopProducts[a]))
    .slice(0, 5);
  const totalTopProductsQuantity = Object.entries(selectedMonthTopProducts)
    .filter(([name]) => topProductNames.includes(name))
    .reduce((sum, [, qty]) => sum + parseInt(qty || 0), 0);
  const topProductsInsight = topProductNames.length > 0 ? (
    <p className={totalTopProductsQuantity > 10 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300'}>
      {totalTopProductsQuantity > 10 ? '⬆ ' : ''}Top products in {new Date(selectedMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}: {topProductNames.join(', ')}
    </p>
  ) : (
    <p className="text-gray-600 dark:text-gray-300">No top products data available for {new Date(selectedMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}.</p>
  );

  // Selected Month Top Product Insight
  const monthTopProductInsight = selectedMonthTopProduct ? (
    <p className={selectedMonthTopProduct.quantity > 10 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300'}>
      {selectedMonthTopProduct.quantity > 10 ? '⬆ ' : ''}Top product in {new Date(selectedMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}: {selectedMonthTopProduct.name} ({selectedMonthTopProduct.quantity} units)
    </p>
  ) : (
    <p className="text-gray-600 dark:text-gray-300">No sales data available for {new Date(selectedMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}.</p>
  );

  // Generate month options for dropdown (last 12 months)
  const monthOptions = [];
  const currentDate = new Date();
  for (let i = 0; i < 12; i++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const value = date.toISOString().slice(0, 7);
    const label = date.toLocaleString('default', { month: 'long', year: 'numeric' });
    monthOptions.push({ value, label });
  }

  // Options for range filter dropdown
  const rangeOptions = [
    { value: 'single', label: 'Selected Month' },
    { value: 'last3', label: 'Last 3 Months' },
    { value: 'last6', label: 'Last 6 Months' },
    { value: 'last9', label: 'Last 9 Months' },
    { value: 'last12', label: 'Last 12 Months' },
    { value: 'all', label: 'All Months' },
  ];

  if (!storeId) {
    return (
      <div className="container mx-auto p-4 sm:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <h1 className="text-2xl sm:text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-4">Sales Trends</h1>
        <div className="text-center py-4 text-red-600 dark:text-red-400">
          Please log in or select a store to view sales trends.
        </div>
      </div>
    );
  }

  if (loading) return <div className="text-center py-4 text-gray-600 dark:text-gray-300">Loading...</div>;
  if (error) return <div className="text-center py-4 text-red-600 dark:text-red-400">{error}</div>;
return (
  <div className="w-full bg-white dark:bg-gray-900 min-h-screen">
    <h1 className="text-2xl sm:text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-4">Sales Trends</h1>

    <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:space-x-4">
      <div>
        <label htmlFor="month-select" className="mr-2 text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-200">
          Select Month:
        </label>
        <select
          id="month-select"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-4 py-2 border rounded-lg text-sm sm:text-base bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600"
        >
          {monthOptions.map((option) => (
            <option key={option.value} value={option.value} className="bg-white dark:bg-gray-800 dark:text-white">
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="range-select" className="mr-2 text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-200">
          Show Trends:
        </label>
        <select
          id="range-select"
          value={rangeFilter}
          onChange={(e) => setRangeFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg text-sm sm:text-base bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600"
        >
          {rangeOptions.map((option) => (
            <option key={option.value} value={option.value} className="bg-white dark:bg-gray-800 dark:text-white">
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>

    <button
      onClick={() => setShowCharts(!showCharts)}
      className="mb-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 dark:bg-indigo-800 dark:hover:bg-indigo-700 transition-colors text-sm sm:text-base"
    >
      {showCharts ? 'Hide Charts' : 'Show Charts'}
    </button>

    <div className="mb-6">
      <h2 className="text-lg sm:text-xl font-semibold text-indigo-600 dark:text-indigo-400 mb-2">
        {new Date(selectedMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })} Top Product
      </h2>
      {monthTopProductInsight}
    </div>

    <div className="overflow-x-auto mb-8">
      <table className="w-full table-auto bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <thead>
          <tr className="bg-indigo-600 dark:bg-indigo-800 text-white dark:text-white text-xs sm:text-sm">
            <th className="w-1/3 px-2 py-2 sm:px-3 sm:py-2 text-left whitespace-nowrap">Month</th>
            <th className="w-1/3 px-2 py-2 sm:px-3 sm:py-2 text-left whitespace-nowrap">Total Quantity</th>
            <th className="w-1/3 px-2 py-2 sm:px-3 sm:py-2 text-left whitespace-nowrap">Monthly Growth</th>
          </tr>
        </thead>
        <tbody>
          {getFilteredTrends().length > 0 ? (
            getFilteredTrends().map((trend, index) => (
              <tr key={index} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs sm:text-sm">
                <td className="w-1/3 px-2 py-2 sm:px-3 sm:py-2 text-left whitespace-nowrap text-gray-900 dark:text-white">{trend.month}</td>
                <td className="w-1/3 px-2 py-2 sm:px-3 sm:py-2 text-left whitespace-nowrap text-gray-900 dark:text-white">{trend.total_quantity}</td>
                <td className="w-1/3 px-2 py-2 sm:px-3 sm:py-2 text-left whitespace-nowrap">
                  <span className={trend.monthly_growth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                    {trend.monthly_growth >= 0 ? '⬆' : '⬇'} {Math.round(trend.monthly_growth * 100)}%
                  </span>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="3" className="text-center py-4 text-gray-600 dark:text-gray-300">
                No data available for {rangeFilter === 'single'
                  ? new Date(selectedMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })
                  : `the selected range`}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>

    {showCharts && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 dark:text-white p-4 rounded-lg shadow-md">
          <h2 className="text-lg sm:text-xl font-semibold text-indigo-600 dark:text-white mb-2">Monthly Growth</h2>
          <div className="h-64 sm:h-80">
            <Line data={growthChartData} options={chartOptions} />
          </div>
          <div className="mt-2 text-sm">{growthInsight}</div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
          <h2 className="text-lg sm:text-xl font-semibold text-indigo-600 dark:text-white mb-2">
            Top Products in {new Date(selectedMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h2>
          <div className="h-64 sm:h-80">
            <Bar data={topProductsChartData} options={chartOptions} />
          </div>
          <div className="mt-2 text-sm">{topProductsInsight}</div>
        </div>
      </div>
    )}
  </div>
);
};

export default SalesTrends;
