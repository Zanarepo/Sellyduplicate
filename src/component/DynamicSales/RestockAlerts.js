import { useState, useEffect } from "react";
import { supabase } from '../../supabaseClient';

function RestockAlerts() {
  const [forecasts, setForecasts] = useState([]);
  const [, setStoreId] = useState(null);
  const [storeName, setStoreName] = useState(null);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    const fetchStoreIdAndForecasts = async () => {
      try {
        // Get store_id from local storage
        const storeId = localStorage.getItem("store_id");
        if (!storeId) {
          setError("No store ID found in local storage. Please log in again.");
          return;
        }
        setStoreId(storeId);

        // Fetch store name for display
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

        // Fetch forecasts for the specific store
        const { data, error } = await supabase
          .from("forecasts")
          .select("*")
          .eq("store_id", storeId)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) {
          setError("Error fetching forecasts: " + error.message);
          return;
        }

        // Deduplicate forecasts by dynamic_product_id, store_id, and forecast_period
        const uniqueForecasts = [];
        const seen = new Set();
        for (const forecast of data) {
          const key = `${forecast.dynamic_product_id}-${forecast.store_id}-${forecast.forecast_period}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueForecasts.push(forecast);
          }
        }
        setForecasts(uniqueForecasts);

        // Subscribe to real-time INSERT events for the specific store
        const subscription = supabase
          .channel("forecasts")
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "forecasts",
              filter: `store_id=eq.${storeId}`,
            },
            (payload) => {
              setForecasts((prev) => {
                const newForecast = payload.new;
                const key = `${newForecast.dynamic_product_id}-${newForecast.store_id}-${newForecast.forecast_period}`;
                if (seen.has(key)) {
                  return prev; // Skip duplicate
                }
                seen.add(key);
                return [newForecast, ...prev.slice(0, 49)];
              });
            }
          )
          .subscribe();

        return () => supabase.removeChannel(subscription);
      } catch (err) {
        setError("Unexpected error: " + err.message);
      }
    };
    fetchStoreIdAndForecasts();
  }, []);

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentForecasts = forecasts.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(forecasts.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  if (error) {
    return (
      <div className="p-4 text-center text-red-600 dark:text-red-400 text-sm md:text-base">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="p-0 sm:p-6 md:p-8 lg:p-0 max-w-7xl mx-auto dark:bg-gray-900">
      <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6 text-gray-800 dark:text-white">
        Restocking Recommendations for {storeName || "Store"}
      </h2>
      {forecasts.length ? (
        <div className="space-y-6">
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <thead className="bg-indigo-600 dark:bg-indigo-800 text-white dark:text-white">
                <tr>
                  <th className="py-3 px-4 text-left text-xs sm:text-sm font-semibold uppercase">Product</th>
                  <th className="py-3 px-4 text-left text-xs sm:text-sm font-semibold uppercase">Predicted Demand</th>
                  <th className="py-3 px-4 text-left text-xs sm:text-sm font-semibold uppercase">Current Stock</th>
                  <th className="py-3 px-4 text-left text-xs sm:text-sm font-semibold uppercase">Next Month</th>
                  <th className="py-3 px-4 text-left text-xs sm:text-sm font-semibold uppercase">Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {currentForecasts.map((f, i) => (
                  <tr
                    key={`${f.dynamic_product_id}-${f.store_id}-${f.forecast_period}-${i}`}
                    className={`border-b border-gray-200 dark:border-gray-700 ${
                      i % 2 === 0 ? "bg-gray-50 dark:bg-gray-900" : "bg-white dark:bg-gray-800"
                    } hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
                  >
                    <td className="py-3 px-4 text-xs sm:text-sm text-gray-700 dark:text-white">{f.product_name}</td>
                    <td className="py-3 px-4 text-xs sm:text-sm text-gray-700 dark:text-white">{f.predicted_demand} units</td>
                    <td className="py-3 px-4 text-xs sm:text-sm text-gray-700 dark:text-white">{f.current_stock} units</td>
                    <td className="py-3 px-4 text-xs sm:text-sm text-gray-700 dark:text-white">{f.forecast_period}</td>
                    <td
                      className={`py-3 px-4 text-xs sm:text-sm font-medium ${
                        f.recommendation === "Restock recommended"
                          ? "text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300 rounded-full px-2 py-1 inline-block"
                          : "text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300 rounded-full px-2 py-1 inline-block"
                      }`}
                    >
                      {f.recommendation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, forecasts.length)} of {forecasts.length} entries
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
        <p className="text-gray-600 dark:text-gray-300 text-center text-sm md:text-base">
          No restocking recommendations available.
        </p>
      )}
    </div>
  );
}

export default RestockAlerts;