import React from 'react';
import { FaTimes } from 'react-icons/fa';

const ScannerModal = ({
  showScanner,
  notifications,
  externalScannerMode,
  setExternalScannerMode,
  setScannerError,
  setScannerLoading,
  manualInputRef,
  scannerLoading,
  scannerError,
  scannerDivRef,
  videoRef,
  manualInput,
  setManualInput,
  handleManualInputKeyDown,
  handleManualInput,
  stopScanner,
  setShowScanner,
  setScannerTarget,
  setScannerBuffer,
}) => {
  if (!showScanner) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-lg max-w-[90vw] sm:max-w-md w-full relative">
        {/* Close Button */}
        <button
          type="button"
          onClick={() => {
            stopScanner();
            setShowScanner(false);
            setScannerTarget(null);
            setScannerError(null);
            setScannerLoading(false);
            setManualInput('');
            setExternalScannerMode(false);
            setScannerBuffer('');
          }}
          className="absolute top-3 right-3 p-2 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
          aria-label="Close scanner modal"
        >
          <FaTimes className="text-gray-800 dark:text-gray-200 w-5 h-5" />
        </button>

        {/* Notifications */}
        <div className="fixed top-4 right-4 space-y-2 z-[1000] max-w-[80vw] sm:max-w-xs">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-3 rounded-lg shadow-lg text-white text-sm font-medium ${
                notification.type === 'success'
                  ? 'bg-green-600'
                  : notification.type === 'error'
                  ? 'bg-red-600'
                  : notification.type === 'warning'
                  ? 'bg-yellow-600'
                  : 'bg-blue-600'
              }`}
            >
              {notification.message}
            </div>
          ))}
        </div>

        {/* Modal Content */}
        <h2 className="text-lg sm:text-xl font-semibold mb-3 text-gray-900 dark:text-white">
          Scan Barcode ID
        </h2>

        <div className="mb-4">
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={externalScannerMode}
              onChange={() => {
                setExternalScannerMode((prev) => !prev);
                setScannerError(null);
                setScannerLoading(!externalScannerMode);
                if (manualInputRef.current) {
                  manualInputRef.current.focus();
                }
              }}
              className="h-5 w-5 text-indigo-600 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 focus:ring-indigo-500"
            />
            <span>Use External Barcode Scanner</span>
          </label>
        </div>

        {!externalScannerMode && (
          <>
            {scannerLoading && (
              <div className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
                Initializing scanner...
              </div>
            )}
            {scannerError && (
              <div className="text-red-600 dark:text-red-400 mb-4 text-sm">{scannerError}</div>
            )}
            <div
              id="scanner"
              ref={scannerDivRef}
              className="relative w-full h-48 sm:h-64 mb-4 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden"
            >
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[200px] sm:w-[250px] h-[80px] sm:h-[100px] border-2 border-red-500 bg-transparent opacity-50"></div>
              </div>
            </div>
          </>
        )}

        {externalScannerMode && (
          <div className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
            Waiting for external scanner input... Scan a barcode to proceed.
          </div>
        )}

        <div className="mb-4 px-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Or Enter Barcode Manually
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              ref={manualInputRef}
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={handleManualInputKeyDown}
              placeholder="Enter barcode"
              className="flex-1 p-3 border rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm"
            />
            <button
              type="button"
              onClick={handleManualInput}
              className="p-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200 shadow-md"
              aria-label="Submit barcode"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              stopScanner();
              setShowScanner(false);
              setScannerTarget(null);
              setScannerError(null);
              setScannerLoading(false);
              setManualInput('');
              setExternalScannerMode(false);
              setScannerBuffer('');
            }}
            className="p-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200 shadow-md"
            aria-label="Close scanner"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScannerModal;