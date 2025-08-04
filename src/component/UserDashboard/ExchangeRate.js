import React, { useState, useEffect, useCallback, Component } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FaExchangeAlt, FaCalculator } from 'react-icons/fa';

// Error boundary for ToastContainer
class ToastErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return null; // Silently fail to prevent breaking the UI
    }
    return this.props.children;
  }
}

const CurrencyConverter = () => {
  const [rates, setRates] = useState(null);
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [targetCurrency, setTargetCurrency] = useState('EUR');
  const [amount, setAmount] = useState('');
  const [convertedAmount, setConvertedAmount] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Common currencies for dropdown (memoized to prevent re-creation)
  const currencies = React.useMemo(() => [
    'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'JPY', 'INR', 'CNY', 'MXN',
    'BRL', 'ZAR', 'NZD', 'SGD', 'HKD', 'NOK', 'SEK', 'DKK', 'TRY', 'RUB', 'NGN'
  ], []);

  // Fetch exchange rates with caching and fallback
  const fetchExchangeRates = useCallback(async (retryBase = baseCurrency) => {
    // Define cache key and timestamp at the top to ensure scope
    const cacheKey = `exchangeRates_${retryBase}`;
    const now = Date.now();
    const cacheDuration = 24 * 60 * 60 * 1000; // 24 hours in ms

    try {
      toast.dismiss(); // Clear existing toasts
      setLoading(true);
      setError(null);

      // Check for cached rates
      const cachedData = localStorage.getItem(cacheKey);
      const cachedTimestamp = localStorage.getItem(`${cacheKey}_timestamp`);

      if (cachedData && cachedTimestamp && now - parseInt(cachedTimestamp) < cacheDuration) {
        try {
          const data = JSON.parse(cachedData);
          if (data.rates && Object.keys(data.rates).length > 0) {
            setRates(data.rates);
            setLastUpdated(new Date(parseInt(cachedTimestamp)).toLocaleString());
            console.log('Using cached rates:', data.rates);
            return;
          }
        } catch (e) {
          console.error('Invalid cached data:', e);
          localStorage.removeItem(cacheKey);
          localStorage.removeItem(`${cacheKey}_timestamp`);
        }
      }

      // Fetch from primary API (exchangerate.host)
      console.log(`Fetching rates for base: ${retryBase}`);
      let response = await fetch(`https://api.exchangerate.host/latest?base=${retryBase}`);
      if (!response.ok) {
        throw new Error(`Primary API failed: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      if (!data.rates || Object.keys(data.rates).length === 0) {
        throw new Error('No rates returned from primary API');
      }

      setRates(data.rates);
      setLastUpdated(new Date().toLocaleString());
      localStorage.setItem(cacheKey, JSON.stringify(data));
      localStorage.setItem(`${cacheKey}_timestamp`, now.toString());
      console.log('Fetched rates:', data.rates);
      toast.success('Exchange rates updated.', { toastId: 'rates-updated' });
    } catch (err) {
      console.error('Primary API error:', err.message);
      // Try fallback API (frankfurter.app)
      try {
        console.log(`Falling back to frankfurter.app for base: ${retryBase}`);
        const response = await fetch(`https://api.frankfurter.app/latest?from=${retryBase}`);
        if (!response.ok) {
          throw new Error(`Fallback API failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        if (!data.rates || Object.keys(data.rates).length === 0) {
          throw new Error('No rates returned from fallback API');
        }

        setRates(data.rates);
        setLastUpdated(new Date().toLocaleString());
        localStorage.setItem(cacheKey, JSON.stringify({ rates: data.rates }));
        localStorage.setItem(`${cacheKey}_timestamp`, now.toString());
        console.log('Fetched fallback rates:', data.rates);
        toast.success('Exchange rates updated from fallback.', { toastId: 'rates-updated-fallback' });
      } catch (fallbackErr) {
        console.error('Fallback API error:', fallbackErr.message);
        setError('Failed to load exchange rates. Using cached rates if available.');
        toast.error('Failed to load exchange rates.', { toastId: 'rates-error' });

        // Fallback to cached rates
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
          try {
            const data = JSON.parse(cachedData);
            if (data.rates && Object.keys(data.rates).length > 0) {
              setRates(data.rates);
              setLastUpdated(new Date(parseInt(localStorage.getItem(`${cacheKey}_timestamp`))).toLocaleString());
              console.log('Using cached rates after failure:', data.rates);
              return;
            }
          } catch (e) {
            console.error('Invalid cached data on fallback:', e);
            localStorage.removeItem(cacheKey);
            localStorage.removeItem(`${cacheKey}_timestamp`);
          }
        }

        // If still failing and baseCurrency is not USD, retry with USD
        if (retryBase !== 'USD') {
          console.log('Retrying with base USD');
          await fetchExchangeRates('USD');
          setBaseCurrency('USD');
        } else {
          setError('No exchange rates available. Please try again later.');
          toast.error('No exchange rates available.', { toastId: 'rates-fail' });
        }
      }
    } finally {
      setLoading(false);
    }
  }, [baseCurrency]);

  // Fetch rates on mount and when base currency changes
  useEffect(() => {
    if (currencies.includes(baseCurrency)) {
      fetchExchangeRates();
    } else {
      setError('Invalid base currency selected.');
      toast.error('Invalid base currency selected.', { toastId: 'invalid-base' });
      setBaseCurrency('USD');
    }
  }, [baseCurrency, currencies, fetchExchangeRates]);

  // Handle conversion on button click
  const handleConvert = () => {
    if (!rates) {
      setError('Exchange rates not available.');
      toast.error('Exchange rates not available.', { toastId: 'convert-error' });
      return;
    }

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount.');
      toast.error('Please enter a valid amount.', { toastId: 'invalid-amount' });
      return;
    }

    const rate = rates[targetCurrency];
    if (!rate) {
      setError(`Exchange rate for ${targetCurrency} not available.`);
      toast.error(`Exchange rate for ${targetCurrency} not available.`, { toastId: 'rate-unavailable' });
      return;
    }

    const result = (parseFloat(amount) * rate).toFixed(2);
    setConvertedAmount(result);
    setError(null);
    toast.success('Conversion completed.', { toastId: 'convert-success' });
  };

  // Swap currencies
  const handleSwap = () => {
    setBaseCurrency(targetCurrency);
    setTargetCurrency(baseCurrency);
    setConvertedAmount(null); // Reset result on swap
  };

  // Handle amount input
  const handleAmountChange = (e) => {
    const value = e.target.value;
    if (value === '' || (!isNaN(value) && value >= 0)) {
      setAmount(value);
      setConvertedAmount(null); // Reset result when amount changes
    }
  };

  return (
    <div className="w-full bg-white dark:bg-gray-700 rounded-lg shadow p-4 max-w-lg mx-auto">
      <ToastErrorBoundary>
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="colored"
          limit={1}
        />
      </ToastErrorBoundary>
      <h2 className="text-lg sm:text-2xl font-semibold text-indigo-700 dark:text-indigo-200 mb-4">
        Currency Converter
      </h2>
      {error && (
        <p className="text-red-500 dark:text-red-400 text-sm mb-4">{error}</p>
      )}
      <div className="space-y-4">
        {/* Amount Input */}
        <div>
          <label className="block text-gray-700 dark:text-gray-300 text-sm mb-1">
            Amount
          </label>
          <input
            type="number"
            value={amount}
            onChange={handleAmountChange}
            placeholder="Enter amount"
            className="w-full p-2 border rounded bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm sm:text-base"
            min="0"
            step="0.01"
          />
        </div>

        {/* Currency Selection */}
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="w-full sm:w-1/2">
            <label className="block text-gray-700 dark:text-gray-300 text-sm mb-1">
              From
            </label>
            <select
              value={baseCurrency}
              onChange={(e) => {
                setBaseCurrency(e.target.value);
                setConvertedAmount(null); // Reset result on currency change
              }}
              className="w-full p-2 border rounded bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm sm:text-base"
            >
              {currencies.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSwap}
            className="p-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
            title="Swap currencies"
          >
            <FaExchangeAlt />
          </button>
          <div className="w-full sm:w-1/2">
            <label className="block text-gray-700 dark:text-gray-300 text-sm mb-1">
              To
            </label>
            <select
              value={targetCurrency}
              onChange={(e) => {
                setTargetCurrency(e.target.value);
                setConvertedAmount(null); // Reset result on currency change
              }}
              className="w-full p-2 border rounded bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm sm:text-base"
            >
              {currencies.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Convert Button */}
        <div>
          <button
            onClick={handleConvert}
            disabled={loading || !amount || isNaN(amount) || parseFloat(amount) <= 0}
            className={`w-full flex items-center justify-center p-2 rounded text-sm sm:text-base transition-colors ${
              loading || !amount || isNaN(amount) || parseFloat(amount) <= 0
                ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            <FaCalculator className="mr-2" /> Convert
          </button>
        </div>

        {/* Conversion Result */}
        <div className="mt-4">
          {loading ? (
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Loading exchange rates...
            </p>
          ) : convertedAmount ? (
            <p className="text-indigo-800 dark:text-indigo-200 text-lg font-medium">
              {amount} {baseCurrency} = {convertedAmount} {targetCurrency}
            </p>
          ) : (
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Enter an amount and click Convert
            </p>
          )}
          {lastUpdated && (
            <p className="text-gray-500 dark:text-gray-500 text-xs mt-2">
              Last updated: {lastUpdated}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CurrencyConverter;