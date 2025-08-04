import { useState, useEffect } from "react";
import { supabase } from '../../supabaseClient';

function AnomalyAlerts() {
  const [anomalies, setAnomalies] = useState([]);
  const [storeName, setStoreName] = useState(null);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showExplanations, setShowExplanations] = useState(true);

  useEffect(() => {
    const fetchStoreIdAndAnomalies = async () => {
      try {
        // Get store_id from local storage
        const storeId = localStorage.getItem("store_id");
        if (!storeId) {
          setError("No store ID found. Please log in again.");
          return;
        }

        // Fetch store name
        const { data: storeData, error: storeError } = await supabase
          .from("stores")
          .select("shop_name")
          .eq("id", storeId)
          .single();
        if (storeError) {
          setError("Error fetching store name: " + storeError.message);
          return;
        }
        setStoreName(storeData.shop_name);

        // Fetch anomalies
        const { data, error } = await supabase
          .from("anomalies")
          .select("*, dynamic_product(name)")
          .eq("store_id", storeId)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) {
          setError("Error Fintech Alerts: " + error.message);
          return;
        }

        // Deduplicate anomalies
        const uniqueAnomalies = [];
        const seen = new Set();
        for (const anomaly of data) {
          const key = `${anomaly.dynamic_product_id}-${anomaly.store_id}-${anomaly.quantity}-${anomaly.sold_at}-${anomaly.anomaly_type}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueAnomalies.push(anomaly);
          }
        }
        setAnomalies(uniqueAnomalies);

        // Real-time subscription
        const subscription = supabase
          .channel("anomalies")
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "anomalies",
              filter: `store_id=eq.${storeId}`,
            },
            async (payload) => {
              const newAnomaly = payload.new;
              const key = `${newAnomaly.dynamic_product_id}-${newAnomaly.store_id}-${newAnomaly.quantity}-${newAnomaly.sold_at}-${newAnomaly.anomaly_type}`;
              if (seen.has(key)) return;
              const { data: productData, error: productError } = await supabase
                .from("dynamic_product")
                .select("name")
                .eq("id", newAnomaly.dynamic_product_id)
                .single();
              if (!productError) {
                setAnomalies((prev) => {
                  seen.add(key);
                  return [{ ...newAnomaly, dynamic_product: { name: productData.name } }, ...prev.slice(0, 49)];
                });
              }
            }
          )
          .subscribe();

        return () => supabase.removeChannel(subscription);
      } catch (err) {
        setError("Unexpected error: " + err.message);
      }
    };
    fetchStoreIdAndAnomalies();
  }, []);

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentAnomalies = anomalies.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(anomalies.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  if (error) {
    return (
      <div className="text-center text-red-600 dark:text-red-400 text-xs">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="w-full dark:bg-gray-900">
      <h2 className="text-xl sm:text-2xl font-bold mb-4 text-indigo-600 dark:text-indigo-400">
        Sales Anomalies for {storeName || "Store"}
      </h2>

      {/* Anomaly Definitions with Toggle */}
      <div className="mb-4">
        <button
          onClick={() => setShowExplanations(!showExplanations)}
          className="px-2 py-0.5 sm:px-3 sm:py-1 min-w-[2.5rem] bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 dark:bg-indigo-800 dark:hover:bg-indigo-700 transition-colors text-xs"
        >
          {showExplanations ? "Hide Explanations" : "Show Explanations"}
        </button>
        {showExplanations && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md dark:border dark:border-gray-700">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-white mb-2">Understanding Anomalies</h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
              <span className="font-medium text-red-600 dark:text-red-400">High Anomaly:</span> A sale significantly larger than usual. This could mean a successful promotion, bulk order, or possible data error. <span className="font-medium">Action:</span> Check for promotions or verify data accuracy.
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              <span className="font-medium text-indigo-600 dark:text-indigo-400">Low Anomaly:</span> A sale much smaller than expected. This might indicate a stockout, low demand, or data issue. <span className="font-medium">Action:</span> Review inventory or marketing strategies.
            </p>
          </div>
        )}
      </div>

      {/* Anomalies Table */}
      {anomalies.length ? (
        <div className="w-full">
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <thead className="bg-indigo-600 dark:bg-indigo-800 text-white dark:text-white">
                <tr>
                  <th className="py-2 px-3 sm:px-4 text-left text-xs sm:text-sm font-semibold">Product</th>
                  <th className="py-2 px-3 sm:px-4 text-left text-xs sm:text-sm font-semibold">Quantity</th>
                  <th className="py-2 px-3 sm:px-4 text-left text-xs sm:text-sm font-semibold">Date</th>
                  <th className="py-2 px-3 sm:px-4 text-left text-xs sm:text-sm font-semibold">Type</th>
                </tr>
              </thead>
              <tbody>
                {currentAnomalies.map((a, i) => (
                  <tr
                    key={`${a.dynamic_product_id}-${a.store_id}-${a.quantity}-${a.sold_at}-${a.anomaly_type}-${i}`}
                    className={`border-b border-gray-200 dark:border-gray-700 ${
                      i % 2 === 0 ? "bg-gray-50 dark:bg-gray-900" : "bg-white dark:bg-gray-800"
                    } hover:bg-indigo-50 dark:hover:bg-gray-700 transition-colors`}
                  >
                    <td className="py-2 px-3 sm:px-4 text-xs sm:text-sm text-gray-700 dark:text-white">{a.dynamic_product.name}</td>
                    <td className="py-2 px-3 sm:px-4 text-xs sm:text-sm text-gray-700 dark:text-white">{a.quantity} units</td>
                    <td className="py-2 px-3 sm:px-4 text-xs sm:text-sm text-gray-700 dark:text-white">
                      {new Date(a.sold_at).toLocaleDateString()}
                    </td>
                    <td
                      className={`py-2 px-3 sm:px-4 text-xs sm:text-sm font-medium ${
                        a.anomaly_type === "High" ? "text-red-600 dark:text-red-400" : "text-indigo-600 dark:text-indigo-400"
                      }`}
                    >
                      {a.anomaly_type}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-row flex-wrap justify-between items-center mt-4 gap-4">
            <div className="text-xs text-gray-600 dark:text-gray-300">
              Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, anomalies.length)} of {anomalies.length} anomalies
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                className={`px-2 py-0.5 rounded-lg text-xs ${
                  currentPage === 1
                    ? "bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed"
                    : "bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-800 dark:hover:bg-indigo-700"
                }`}
              >
                Previous
              </button>
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i + 1}
                  onClick={() => paginate(i + 1)}
                  className={`px-2 py-0.5 rounded-lg text-xs ${
                    currentPage === i + 1
                      ? "bg-indigo-600 text-white dark:bg-indigo-800 dark:text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`px-2 py-0.5 rounded-lg text-xs ${
                  currentPage === totalPages
                    ? "bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed"
                    : "bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-800 dark:hover:bg-indigo-700"
                }`}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-gray-600 dark:text-gray-300 text-center text-xs">
          No sales anomalies detected for {storeName || "this store"}.
        </p>
      )}
    </div>
  );
}

export default AnomalyAlerts;