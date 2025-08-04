
// SalesDashboard.jsx
import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../../supabaseClient";
import jsPDF from "jspdf";
import { format, startOfWeek, startOfMonth } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Constants
const CURRENCY_SYMBOLS = ["$", "€", "£", "¥", "₦"];
const ITEMS_PER_PAGE = 50;
const DATE_FORMAT = "yyyy-MM-dd";

// Utility Functions
const formatCurrency = (value, currency) =>
  `${currency}${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (date) => (date ? format(new Date(date), DATE_FORMAT) : "—");

export default function SalesDashboard() {
  // State
  const [isVisible, setIsVisible] = useState(false);
  const [salesData, setSalesData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currency, setCurrency] = useState("₦");
  const [currentPage, setCurrentPage] = useState(1);
  const [showChart, setShowChart] = useState(false);

  // Load sales data on mount
  useEffect(() => {
    const storeId = localStorage.getItem("store_id");
    async function fetchSales() {
      const { data, error } = await supabase
        .from("dynamic_sales")
        .select(
          "dynamic_product_id, quantity, unit_price, sold_at, dynamic_product(name)"
        )
        .eq("store_id", storeId)
        .order("sold_at", { ascending: false });

      if (!error) {
        setSalesData(
          data.map((sale) => ({
            productName: sale.dynamic_product.name,
            quantity: sale.quantity,
            unitPrice: parseFloat(sale.unit_price),
            soldAt: new Date(sale.sold_at),
          }))
        );
      }
    }
    fetchSales();
  }, []);

  // Filter sales data based on date range and search query
  useEffect(() => {
    let filtered = salesData;
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter((sale) => sale.soldAt >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter((sale) => sale.soldAt <= end);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((sale) =>
        sale.productName.toLowerCase().includes(query)
      );
    }
    setFilteredData(filtered);
    setCurrentPage(1);
  }, [salesData, startDate, endDate, searchQuery]);

  // Summarize sales data by product
  const summary = useMemo(() => {
    const productMap = {};
    filteredData.forEach(({ productName, quantity, unitPrice }) => {
      if (!productMap[productName]) {
        productMap[productName] = { productName, totalQty: 0, priceSum: 0 };
      }
      productMap[productName].totalQty += quantity;
      productMap[productName].priceSum += unitPrice;
    });
    return Object.values(productMap).map((item) => ({
      productName: item.productName,
      totalQty: item.totalQty,
      totalRevenue: item.priceSum * item.totalQty,
    }));
  }, [filteredData]);

  // Calculate total revenue and pagination
  const totalRevenue = useMemo(
    () => summary.reduce((sum, item) => sum + item.totalRevenue, 0),
    [summary]
  );
  const pageCount = Math.ceil(summary.length / ITEMS_PER_PAGE);
  const paginatedData = summary.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Date range presets
  const applyDatePreset = (type) => {
    const today = new Date();
    let start = today;
    if (type === "7days") start.setDate(today.getDate() - 6);
    else if (type === "week") start = startOfWeek(today, { weekStartsOn: 1 });
    else if (type === "month") start = startOfMonth(today);
    setStartDate(format(start, DATE_FORMAT));
    setEndDate(format(today, DATE_FORMAT));
  };

  // Export functions
  const downloadCSV = () => {
    const header = ["Product", "Qty Sold", "Total Revenue"];
    const rows = summary.map((item) => [
      item.productName,
      item.totalQty,
      formatCurrency(item.totalRevenue, currency),
    ]);
    const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `sales_summary_${format(new Date(), DATE_FORMAT)}.csv`;
    link.click();
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    let y = 20;
    doc.setFontSize(18);
    doc.text("Sales Summary Report", 14, y);
    y += 10;
    doc.setFontSize(10);
    doc.text(`Range: ${formatDate(startDate)} to ${formatDate(endDate)}`, 14, y);
    y += 10;
    summary.forEach((item) => {
      doc.text(
        `${item.productName} | Qty: ${item.totalQty} | Revenue: ${formatCurrency(
          item.totalRevenue,
          currency
        )}`,
        14,
        y
      );
      y += 6;
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
    });
    doc.save(`sales_summary_${format(new Date(), DATE_FORMAT)}.pdf`);
  };

  // Render toggle button if dashboard is hidden
  if (!isVisible) {
    return (
      <div className="flex justify-center p-0 ">
        <button
          onClick={() => setIsVisible(true)}
          className="px-6 py-3 bg-indigo-600 text-white rounded hover:bg-indigo-700 dark:bg-gray-900 dark:text-white"
        >
          Show Sales Summary
        </button>
      </div>
    );
  }

  // Main dashboard UI
  return (
    <div className="max-w-5xl mx-auto p-0 space-y-6 dark:bg-gray-800 dark:text-white">
      {/* Close Button */}
      <div className="flex justify-end dark:bg-gray-900 dark:text-white">
        <button
          onClick={() => setIsVisible(false)}
          className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 dark:bg-gray-900 dark:text-white"
        >
          Close
        </button>
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-center mb-4 dark:bg-gray-900 dark:text-white">Sales Summary</h1>

      {/* Date Presets */}
      <div className="space-y-4 mb-4 dark:bg-gray-900 dark:text-white">
        <div className="flex space-x-2 overflow-x-auto pb-2 ">
          {[
            { label: "Today", key: "today" },
            { label: "Last 7 Days", key: "7days" },
            { label: "This Week", key: "week" },
            { label: "This Month", key: "month" },
          ].map(({ label, key }) => (
            <button
              key={key}
              onClick={() => applyDatePreset(key)}
              className="px-3 py-1 bg-indigo-600 text-white rounded text-sm whitespace-nowrap dark:bg-gray-900 dark:text-white"
            >
              {label}
            </button>
          ))}
        </div>

        {/* Date Range Inputs */}
        <div className="flex flex-col sm:flex-row gap-2 ">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full p-2 border rounded dark:bg-gray-900 dark:text-white"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full p-2 border rounded dark:bg-gray-900 dark:text-white"
          />
          <button
            onClick={() => {
              setStartDate("");
              setEndDate("");
            }}
            className="px-4 py-2 bg-gray-200 rounded dark:bg-gray-900 dark:text-white"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Total Revenue */}
      <div className="text-right font-semibold mb-4 dark:bg-gray-900 dark:text-white">
        Total Revenue: {formatCurrency(totalRevenue, currency)}
      </div>

      {/* Search and Currency Selector */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4 dark:bg-gray-900 dark:text-white">
        <input
          type="text"
          placeholder="Search product..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:flex-1 p-2 border rounded dark:bg-gray-900 dark:text-white"
        />
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="p-2 border rounded dark:bg-gray-900 dark:text-white"
        >
          {CURRENCY_SYMBOLS.map((symbol) => (
            <option key={symbol} value={symbol}>
              {symbol}
            </option>
          ))}
        </select>
      </div>

      {/* Summary Table */}
      <div className="overflow-x-auto bg-white shadow rounded-lg mb-6 dark:bg-gray-900 dark:text-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-200 dark:bg-gray-900 dark:text-indigo-800">
            <tr>
              {["Product", "Qty Sold", "Total Revenue"].map((header) => (
                <th
                  key={header}
                  className="px-4 py-2 text-left text-sm font-semibold"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:bg-gray-900 dark:text-white">
            {paginatedData.length > 0 ? (
              paginatedData.map((item) => (
                <tr key={item.productName}>
                  <td className="px-4 py-2 text-sm">{item.productName}</td>
                  <td className="px-4 py-2 text-sm">{item.totalQty}</td>
                  <td className="px-4 py-2 text-sm">
                    {formatCurrency(item.totalRevenue, currency)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="p-4 text-center text-gray-500 ">
                  No sales in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-center gap-2 mb-6 dark:bg-gray-900 dark:text-white">
        <button
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50 dark:bg-gray-900 dark:text-white"
        >
          Prev
        </button>
        {[...Array(pageCount)].map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentPage(index + 1)}
            className={`px-3 py-1 rounded ${
              currentPage === index + 1
                ? "bg-indigo-600 text-white "
                : "bg-gray-200 hover:bg-gray-300"
            }`}
          >
            {index + 1}
          </button>
        ))}
        <button
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, pageCount))}
          disabled={currentPage === pageCount}
          className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50 dark:bg-gray-900 dark:text-white "
        >
          Next
        </button>
      </div>

      {/* Export and Chart Toggle Buttons */}
      <div className="flex justify-center gap-4 mb-6 dark:bg-gray-900 dark:text-white">
        <button
          onClick={downloadCSV}
          className="px-4 py-2 bg-green-600 text-white rounded "
        >
          CSV
        </button>
        <button
          onClick={downloadPDF}
          className="px-4 py-2 bg-red-600 text-white rounded"
        >
          PDF
        </button>
        <button
          onClick={() => setShowChart(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded"
        >
          Chart
        </button>
      </div>

      {/* Chart Modal */}
      {showChart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 ">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-3xl ">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Sales Summary Chart</h3>
              <button
                onClick={() => setShowChart(false)}
                className="text-gray-700 text-2xl leading-none "
              >
                ×
              </button>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={summary}>
                <XAxis dataKey="productName" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value, index) =>
                    index % 2 === 0 ? formatCurrency(value, currency) : value
                  }
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  formatter={(value, name) =>
                    name.includes("Total Revenue")
                      ? [formatCurrency(value, currency), `Total Revenue (${currency})`]
                      : [value, name]
                  }
                />
                <Legend
                  formatter={(name) =>
                    name.includes("Total Revenue") ? `Total Revenue (${currency})` : name
                  }
                />
                <Bar dataKey="totalQty" name="Qty Sold" fill="#10B981" />
                <Bar
                  dataKey="totalRevenue"
                  name={`Total Revenue (${currency})`}
                  fill="#6366F1"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}