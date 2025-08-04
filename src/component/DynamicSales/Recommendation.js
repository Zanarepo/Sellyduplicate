
import { useState, useEffect } from "react";
import { supabase } from '../../supabaseClient';

function RestockRecommendations() {
  const [recommendations, setRecommendations] = useState([]);
  const [, setStoreId] = useState(null);
  const [storeName, setStoreName] = useState(null);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    const fetchStoreIdAndRecommendations = async () => {
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

        // Fetch recommendations for the specific store
        const { data, error } = await supabase
          .from("restock_recommendations")
          .select("id, dynamic_product_id, product_name, month, quantity_sold, recommendation, created_at")
          .eq("store_id", storeId)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) {
          setError("Error fetching recommendations: " + error.message);
          return;
        }

        // Deduplicate recommendations by dynamic_product_id, store_id, and month
        const uniqueRecommendations = [];
        const seen = new Set();
        for (const rec of data) {
          const key = `${rec.dynamic_product_id}-${rec.store_id}-${rec.month}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueRecommendations.push(rec);
          }
        }
        setRecommendations(uniqueRecommendations);

        // Subscribe to real-time INSERT events for the specific store
        const subscription = supabase
          .channel("restock_recommendations")
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "restock_recommendations",
              filter: `store_id=eq.${storeId}`,
            },
            (payload) => {
              setRecommendations((prev) => {
                const newRec = payload.new;
                const key = `${newRec.dynamic_product_id}-${newRec.store_id}-${newRec.month}`;
                if (seen.has(key)) {
                  return prev; // Skip duplicate
                }
                seen.add(key);
                return [newRec, ...prev.slice(0, 49)];
              });
            }
          )
          .subscribe();

        return () => supabase.removeChannel(subscription);
      } catch (err) {
        setError("Unexpected error: " + err.message);
      }
    };
    fetchStoreIdAndRecommendations();
  }, []);

  // Handle deletion of a recommendation
  const handleDelete = async (id) => {
    try {
      const { error } = await supabase
        .from("restock_recommendations")
        .delete()
        .eq("id", id);
      if (error) {
        setError("Error deleting recommendation: " + error.message);
        return;
      }
      setRecommendations((prev) => prev.filter((rec) => rec.id !== id));
    } catch (err) {
      setError("Unexpected error during deletion: " + err.message);
    }
  };

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentRecommendations = recommendations.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(recommendations.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  if (error) {
    return (
      <div className="p-4 text-center text-red-600 dark:text-red-400 text-sm md:text-base">
        Error: {error}
      </div>
    );
  }

  return (
  <div className="w-full dark:bg-gray-900">
    <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6 text-gray-800 dark:text-white">
      Market Demands Recommendations for {storeName || "Store"}
    </h2>
    {recommendations.length ? (
      <div className="space-y-6">
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <thead className="bg-indigo-600 dark:bg-indigo-800 text-white dark:text-white">
              <tr>
                <th className="py-3 px-4 text-left text-xs sm:text-sm font-semibold uppercase">Product</th>
                <th className="py-3 px-4 text-left text-xs sm:text-sm font-semibold uppercase">Month</th>
                <th className="py-3 px-4 text-left text-xs sm:text-sm font-semibold uppercase">Quantity Sold</th>
                <th className="py-3 px-4 text-left text-xs sm:text-sm font-semibold uppercase">Recommendation</th>
                <th className="py-3 px-4 text-left text-xs sm:text-sm font-semibold uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {currentRecommendations.map((rec, i) => (
                <tr
                  key={`${rec.id}-${i}`}
                  className={`border-b border-gray-200 dark:border-gray-700 ${
                    i % 2 === 0 ? "bg-gray-50 dark:bg-gray-900" : "bg-white dark:bg-gray-800"
                  } hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
                >
                  <td className="py-3 px-4 text-xs sm:text-sm text-gray-700 dark:text-white">{rec.product_name}</td>
                  <td className="py-3 px-4 text-xs sm:text-sm text-gray-700 dark:text-white">{rec.month}</td>
                  <td className="py-3 px-4 text-xs sm:text-sm text-gray-700 dark:text-white">{rec.quantity_sold} units</td>
                  <td
                    className={`py-3 px-4 text-xs sm:text-sm font-medium ${
                      rec.recommendation.includes("Restock")
                        ? "text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300 rounded-full px-2 py-1 inline-block"
                        : "text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300 rounded-full px-2 py-1 inline-block"
                    }`}
                  >
                    {rec.recommendation}
                  </td>
                  <td className="py-3 px-4 text-xs sm:text-sm">
                    <button
                      onClick={() => handleDelete(rec.id)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, recommendations.length)} of {recommendations.length} entries
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
        No restock recommendations available.
      </p>
    )}
  </div>
);
}

export default RestockRecommendations;