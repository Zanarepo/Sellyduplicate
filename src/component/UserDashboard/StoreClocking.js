import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { Dialog, DialogPanel, DialogTitle, DialogDescription } from '@headlessui/react';
import { format, parseISO, startOfDay, set, isAfter } from 'date-fns';
import JsBarcode from 'jsbarcode';
import Webcam from 'react-webcam';
import { BrowserMultiFormatReader, BarcodeFormat } from '@zxing/library';

const Attendance = () => {
  const [storeId, setStoreId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [, setUserEmail] = useState(null);
  const [isStoreOwner, setIsStoreOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [showConfirmDeleteAll, setShowConfirmDeleteAll] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [barcodeError, setBarcodeError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const webcamRef = useRef(null);
  const codeReader = useRef(new BrowserMultiFormatReader());
  const streamRef = useRef(null);

  // Fetch user & store data
 useEffect(() => {
  const fetchUserData = async () => {
    try {
      const user_email = localStorage.getItem('user_email');
      if (!user_email) throw new Error('Please log in.');
      setUserEmail(user_email);

      // Check if user is a store owner
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('id')
        .eq('email_address', user_email)
        .maybeSingle();
      if (storeError) throw new Error(storeError.message);

      if (storeData) {
        // User is a store owner
        setIsStoreOwner(true);
        setStoreId(storeData.id);
        // Check if admin has a store_users entry (optional)
        const { data: existingUser, error: uErr } = await supabase
          .from('store_users')
          .select('id')
          .eq('email_address', user_email)
          .eq('store_id', storeData.id)
          .maybeSingle();
        if (uErr) throw new Error(uErr.message);
        if (existingUser) setUserId(existingUser.id);
      } else {
        // Regular store user
        const { data: uData, error: ue } = await supabase
          .from('store_users')
          .select('id, store_id')
          .eq('email_address', user_email)
          .maybeSingle();
        if (ue) throw new Error(ue.message);
        if (!uData) throw new Error('User not found in store_users.');
        setUserId(uData.id);
        setStoreId(uData.store_id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  fetchUserData();
}, []); // Removed storeId from dependency array

  // Generate store barcode
  useEffect(() => {
    if (showBarcodeModal && storeId) {
      const today = format(new Date(), 'd');
      const code = `STORE-${storeId}-${today}`;
      const canvas = document.getElementById('store-barcode');
      if (canvas) {
        try {
          JsBarcode(canvas, code, {
            format: 'CODE128',
            displayValue: true,
            width: 4,
            height: 100,
            fontSize: 18,
            background: '#fff',
            lineColor: '#000',
            margin: 10,
          });
          setBarcodeError(false);
        } catch {
          setBarcodeError(true);
        }
      } else setBarcodeError(true);
    }
  }, [showBarcodeModal, storeId]);

  // Fetch attendance logs
  useEffect(() => {
    const fetchLogs = async () => {
      if (!storeId) return;
      try {
        const { data, error: e } = await supabase
          .from('attendance')
          .select('id, user_id, action, timestamp, store_users!user_id(full_name)')
          .eq('store_id', storeId)
          .order('timestamp', { ascending: false });
        if (e) throw new Error(e.message);
        setAttendanceLogs(data);
        setFilteredLogs(data);
      } catch (err) {
        setError(err.message);
      }
    };
    fetchLogs();
  }, [storeId]);

  // Filter and search functionality
  useEffect(() => {
    let filtered = attendanceLogs;

    if (actionFilter !== 'all') {
      filtered = filtered.filter((log) => log.action === actionFilter);
    }

    if (searchTerm.trim()) {
      filtered = filtered.filter(
        (log) =>
          log.store_users?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.action.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredLogs(filtered);
    setCurrentPage(1);
  }, [attendanceLogs, searchTerm, actionFilter]);

  // Delete single log
  const handleDeleteLog = async (logId) => {
    try {
      const { error: delErr } = await supabase.from('attendance').delete().eq('id', logId).eq('store_id', storeId);
      if (delErr) throw new Error(delErr.message);
      setAttendanceLogs((prev) => prev.filter((l) => l.id !== logId));
      setSuccessMessage('Log deleted successfully.');
    } catch {
      setError('Critical error deleting log.');
    }
  };

  // Delete all logs
  const handleDeleteAllLogs = async () => {
    setShowConfirmDeleteAll(false);
    try {
      const { error: delErr } = await supabase.from('attendance').delete().eq('store_id', storeId);
      if (delErr) throw new Error(delErr.message);
      setAttendanceLogs([]);
      setSuccessMessage('All logs deleted successfully.');
    } catch {
      setError('Critical error deleting all logs.');
    }
  };

  // Handle scan
  const handleScan = useCallback(
    async (err, result) => {
      if (result) {
        try {
          const scanned = result.text;
          const today = format(new Date(), 'd');
          if (scanned !== `STORE-${storeId}-${today}`) {
            setError('Invalid store barcode.');
            return;
          }
          const now = new Date();
          const hour = now.getHours();
          if (hour < 6 || hour >= 21) {
            setError('Allowed only 6 AM–9 PM.');
            return;
          }
          const { data: u } = await supabase
            .from('store_users')
            .select('id, full_name')
            .eq('id', userId)
            .eq('store_id', storeId)
            .single();
          if (!u && !isStoreOwner) {
            setError('User not found.');
            return;
          }
          const { data: lastLog } = await supabase
            .from('attendance')
            .select('action, timestamp')
            .eq('user_id', userId)
            .eq('store_id', storeId)
            .order('timestamp', { ascending: false })
            .limit(1)
            .single();
          let action = 'clock-in';
          if (lastLog) {
            const lastTime = parseISO(lastLog.timestamp);
            const cutoff = set(startOfDay(lastTime), { hours: 21, minutes: 0, seconds: 0 });
            if (lastLog.action === 'clock-in' && isAfter(now, cutoff)) action = 'clock-in';
            else action = lastLog.action === 'clock-in' ? 'clock-out' : 'clock-in';
          }
          const fullName = u ? u.full_name : 'Store Owner';
          const { data } = await supabase
            .from('attendance')
            .insert([{ store_id: storeId, user_id: userId, action, timestamp: now.toISOString() }])
            .select('id, action, timestamp, store_users!user_id(full_name)')
            .single();
          setAttendanceLogs((prev) => [data, ...prev]);
          setSuccessMessage(`${fullName} ${action} at ${format(now, 'PPP HH:mm')}.`);
        } catch (e) {
          setError(e.message);
        }
      }
    },
    [storeId, userId, isStoreOwner]
  );

  // Scanning effect
  useEffect(() => {
    let reader = null;
    if (scanning) {
      reader = codeReader.current;
      const start = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        streamRef.current = stream;
        webcamRef.current.video.srcObject = stream;
        reader.decodeFromVideoDevice(
          stream.getVideoTracks()[0].getSettings().deviceId,
          webcamRef.current.video,
          (res, err) => {
            if (res) {
              setScanning(false);
              handleScan(null, res);
            }
          },
          new Map([[BarcodeFormat.CODE_128, true]])
        );
      };
      start();
    }
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (reader) reader.reset();
    };
  }, [scanning, handleScan]);

  // Pagination
  const last = currentPage * itemsPerPage;
  const first = last - itemsPerPage;
  const currentLogs = filteredLogs.slice(first, last);
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

  const getActionColorClass = (action) => {
    return action === 'clock-in'
      ? 'text-green-800 px-2 py-1 rounded-full text-xs font-medium'
      : 'text-red-800 px-2 py-1 rounded-full text-xs font-medium';
  };

  const clearFilters = () => {
    setSearchTerm('');
    setActionFilter('all');
    setCurrentPage(1);
  };

  return (
    <div className="w-full bg-white dark:bg-gray-900">
      <h2 className="text-2xl font-bold text-indigo-800 dark:text-white mb-4">Attendance Tracking</h2>
      {successMessage && <div className="mb-4 p-2 bg-green-100 text-green-800 rounded">{successMessage}</div>}
      {error && <div className="mb-4 p-2 bg-red-100 text-red-800 rounded">{error}</div>}
      {loading ? (
        <div className="flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600" />
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-col md:flex-row gap-2 md:gap-4">
            <button
              onClick={() => setScanning(true)}
              disabled={!storeId}
              className="w-full md:w-auto px-3 py-1.5 bg-indigo-600 text-white rounded-md text-xs md:text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              Scan Store Barcode
            </button>
            {isStoreOwner && (
              <button
                onClick={() => setShowBarcodeModal(true)}
                disabled={!storeId}
                className="w-full md:w-auto px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs md:text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                Show Store Barcode
              </button>
            )}
          </div>

          {scanning && (
            <div className="mb-4 flex flex-col items-center gap-2">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: { ideal: 'environment' } }}
                className="rounded-md border"
                width={250}
                height={250}
              />
              <button
                onClick={() => setScanning(false)}
                className="px-3 py-1.5 bg-red-600 text-white rounded-md text-xs md:text-sm hover:bg-red-700"
              >
                Stop Scanning
              </button>
            </div>
          )}

          <Dialog open={showConfirmDeleteAll} onClose={() => setShowConfirmDeleteAll(false)} className="relative z-50">
            <div className="fixed inset-0 bg-black/30" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <DialogPanel className="w-full max-w-xs bg-white dark:bg-gray-800 p-6 rounded-lg">
                <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">Confirm Deletion</DialogTitle>
                <DialogDescription className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                  Delete <strong>all</strong> attendance logs? This cannot be undone.
                </DialogDescription>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={() => setShowConfirmDeleteAll(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAllLogs}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Delete All
                  </button>
                </div>
              </DialogPanel>
            </div>
          </Dialog>

          <div className="mb-4 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex flex-col md:flex-row md:items-end md:gap-4 gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Search</label>
                <input
                  type="text"
                  placeholder="User name or action"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div className="flex-1 md:w-auto">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Action</label>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="all">All</option>
                  <option value="clock-in">Clock In</option>
                  <option value="clock-out">Clock Out</option>
                </select>
              </div>
              <div className="flex-1 md:w-auto">
                <button
                  onClick={clearFilters}
                  className="w-full md:w-auto px-2 py-1 bg-gray-600 text-white rounded-md text-xs hover:bg-gray-700"
                >
                  Clear
                </button>
              </div>
            </div>
            {(searchTerm || actionFilter !== 'all') && (
              <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                Showing {filteredLogs.length} of {attendanceLogs.length} logs
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left border-collapse bg-white dark:bg-gray-800 rounded-lg shadow text-xs md:text-sm">
              <thead>
                <tr className="bg-indigo-100 dark:bg-indigo-800">
                  <th className="px-2 py-2 md:px-4 md:py-3 font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700">
                    User
                  </th>
                  <th className="px-2 py-2 md:px-4 md:py-3 font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700">
                    Action
                  </th>
                  <th className="px-2 py-2 md:px-4 md:py-3 font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700">
                    Timestamp
                  </th>
                  {isStoreOwner && (
                    <th className="px-2 py-2 md:px-4 md:py-3 font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {currentLogs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isStoreOwner ? 4 : 3}
                      className="px-2 py-6 md:px-4 md:py-8 text-center text-gray-500 dark:text-gray-400 text-xs md:text-sm"
                    >
                      {filteredLogs.length === 0 && attendanceLogs.length > 0
                        ? 'No logs match your search criteria.'
                        : 'No attendance logs found.'}
                    </td>
                  </tr>
                ) : (
                  currentLogs.map((log, index) => (
                    <tr
                      key={log.id}
                      className={`${
                        index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-900' : 'bg-white dark:bg-gray-800'
                      } hover:bg-gray-100 dark:hover:bg-gray-700`}
                    >
                      <td className="px-2 py-2 md:px-4 md:py-3 text-gray-900 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                        {log.store_users?.full_name || 'Unknown User'}
                      </td>
                      <td className="px-2 py-2 md:px-4 md:py-3 border-b border-gray-200 dark:border-gray-700">
                        <span className={`${getActionColorClass(log.action)} text-xs md:text-sm`}>
                          {log.action === 'clock-in' ? 'Clock In' : 'Clock Out'}
                        </span>
                      </td>
                      <td className="px-2 py-2 md:px-4 md:py-3 text-gray-900 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                        {format(parseISO(log.timestamp), 'PPP HH:mm')}
                      </td>
                      {isStoreOwner && (
                        <td className="px-2 py-2 md:px-4 md:py-3 border-b border-gray-200 dark:border-gray-700">
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            className="w-full md:w-auto px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs"
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-2 flex flex-col md:flex-row md:items-center md:justify-between text-xs">
              <div className="text-gray-600 dark:text-gray-400 mb-2 md:mb-0 text-center">
                Showing {first + 1} to {Math.min(last, filteredLogs.length)} of {filteredLogs.length} logs
              </div>
              <div className="flex items-center gap-1 justify-center">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <span className="px-2 py-1 bg-indigo-600 text-white rounded-md">{currentPage}</span>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          <Dialog open={showBarcodeModal} onClose={() => setShowBarcodeModal(false)} className="relative z-50">
            <div className="fixed inset-0 bg-black/30" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <DialogPanel className="w-full max-w-sm bg-white dark:bg-gray-800 p-6 rounded-lg">
                <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">Store Barcode</DialogTitle>
                <button
                  onClick={() => setShowBarcodeModal(false)}
                  className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
                <div className="mt-4 text-center">
                  {barcodeError ? (
                    <img
                      src={`https://barcode.tec-it.com/barcode.ashx?data=STORE-${storeId}-${format(new Date(), 'd')}&code=Code128`}
                      alt="Store Barcode"
                      className="mx-auto"
                    />
                  ) : (
                    <canvas id="store-barcode" className="mx-auto" />
                  )}
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Scan this barcode to clock in/out.</p>
                </div>
                <button
                  onClick={() => setShowBarcodeModal(false)}
                  className="mt-4 w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Close
                </button>
              </DialogPanel>
            </div>
          </Dialog>
        </>
      )}
    </div>
  );
};

export default Attendance;