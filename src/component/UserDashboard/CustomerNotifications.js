import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { format, parseISO } from 'date-fns';
import { FaBell, FaTrash, FaCheckCircle, FaCircle } from 'react-icons/fa';

const Notifications = () => {
  const [storeId, setStoreId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isStoreOwner, setIsStoreOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  // Fetch user data and notifications
  useEffect(() => {
    const fetchUserDataAndNotifications = async () => {
      try {
        const user_email = localStorage.getItem('user_email');
        console.log('User email from localStorage:', user_email);
        if (!user_email) throw new Error('Please log in.');

        // Check if user is store owner
        console.log('Querying stores for email:', user_email);
        const { data: storeData, error: storeError } = await supabase
          .from('stores')
          .select('id')
          .eq('email_address', user_email)
          .maybeSingle();
        if (storeError) {
          console.error('Store query error:', storeError);
          throw new Error(`Error checking store owner: ${storeError.message}`);
        }

        if (storeData) {
          console.log('User is store owner for store_id:', storeData.id);
          setIsStoreOwner(true);
          setStoreId(storeData.id);
          console.log('Final storeId:', storeData.id);
          console.log('Querying store_users for email:', user_email);
          const { data: userData, error: userError } = await supabase
            .from('store_users')
            .select('id')
            .eq('email_address', user_email)
            .eq('store_id', storeData.id)
            .maybeSingle();
          if (userError) {
            console.error('User query error:', userError);
            throw new Error(`Error fetching user data: ${userError.message}`);
          }
          setUserId(userData?.id || 0); // Default userId 0 for store owners
          console.log('UserId set to:', userData?.id || 0);
        } else {
          console.log('User is not store owner, querying store_users for email:', user_email);
          const { data: userData, error: userError } = await supabase
            .from('store_users')
            .select('id, store_id')
            .eq('email_address', user_email)
            .maybeSingle();
          if (userError) {
            console.error('User query error:', userError);
            throw new Error(`Error fetching user data: ${userError.message}`);
          }
          if (!userData) {
            console.error('No user found for email:', user_email);
            throw new Error('User not found in store_users.');
          }
          console.log('User data:', userData);
          setUserId(userData.id);
          setStoreId(userData.store_id);
          console.log('Final storeId:', userData.store_id);
        }

        // Fetch notifications
        if (storeId) {
          console.log('Fetching notifications for store_id:', storeId, 'user_id:', userId);
          const { data, error } = await supabase
            .from('user_notifications')
            .select('id, user_id, type, message, related_id, related_table, is_read, created_at, store_users!user_id(full_name)')
            .eq('store_id', storeId)
            .or(isStoreOwner ? `store_id.eq.${storeId}` : `user_id.eq.${userId}`)
            .order('created_at', { ascending: false });
          if (error) throw new Error(`Error fetching notifications: ${error.message}`);
          setNotifications(data || []);
          setUnreadCount(data.filter((n) => !n.is_read).length);
          console.log('Notifications:', data);
        }
      } catch (err) {
        console.error('fetchUserDataAndNotifications error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUserDataAndNotifications();
  }, [storeId, userId, isStoreOwner]);

  // Mark notification as read/unread
  const handleToggleRead = async (notificationId, currentIsRead) => {
    try {
      console.log(`Toggling read status for notification: ${notificationId}, current is_read: ${currentIsRead}`);
      const { error } = await supabase
        .from('user_notifications')
        .update({ is_read: !currentIsRead, updated_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('store_id', storeId);
      if (error) throw new Error(`Error updating notification: ${error.message}`);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: !currentIsRead } : n
        )
      );
      setUnreadCount((prev) => (currentIsRead ? prev + 1 : prev - 1));
      console.log(`Notification ${notificationId} marked as ${!currentIsRead ? 'read' : 'unread'}`);
    } catch (err) {
      console.error('handleToggleRead error:', err);
    }
  };

  // Delete notification
  const handleDeleteNotification = async (notificationId) => {
    try {
      console.log('Deleting notification:', notificationId);
      const { error } = await supabase
        .from('user_notifications')
        .delete()
        .eq('id', notificationId)
        .eq('store_id', storeId);
      if (error) throw new Error(`Error deleting notification: ${error.message}`);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      setUnreadCount((prev) => prev - notifications.find((n) => n.id === notificationId).is_read ? prev : prev - 1);
      console.log('Notification deleted:', notificationId);
    } catch (err) {
      console.error('handleDeleteNotification error:', err);
    }
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentNotifications = notifications.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(notifications.length / itemsPerPage);

  return (
    <div className="w-full bg-white dark:bg-gray-900 p-4 mt-24">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-indigo-800 dark:text-white">
          Notifications
          {unreadCount > 0 && (
            <span
              className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full"
              aria-label={`You have ${unreadCount} unread notifications`}
            >
              {unreadCount}
            </span>
          )}
        </h2>
        <button
          onClick={() => setShowNotificationModal(true)}
          className="p-2 text-indigo-600 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-indigo-100"
          aria-label="View notifications"
        >
          <FaBell className="w-6 h-6" />
        </button>
      </div>
      {error && (
        <p className="text-red-500 mb-4" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <div className="flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <Dialog open={showNotificationModal} onClose={() => setShowNotificationModal(false)} className="relative z-50">
          <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel className="w-full max-w-lg rounded-lg bg-white dark:bg-gray-800 p-6 max-h-[80vh] overflow-y-auto">
              <DialogTitle className="text-lg font-bold text-indigo-800 dark:text-indigo-200">
                Notifications
                {unreadCount > 0 && (
                  <span
                    className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full"
                    aria-label={`${unreadCount} unread notifications`}
                  >
                    {unreadCount}
                  </span>
                )}
              </DialogTitle>
              <button
                onClick={() => setShowNotificationModal(false)}
                className="absolute top-2 right-2 text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100"
                aria-label="Close notifications"
              >
                ✕
              </button>
              <div className="mt-4">
                {currentNotifications.length === 0 ? (
                  <p className="text-center text-gray-500 dark:text-gray-400" role="status">
                    No notifications found.
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {currentNotifications.map((notification) => (
                      <li
                        key={notification.id}
                        className={`p-4 rounded-md border ${
                          notification.is_read
                            ? 'bg-gray-100 dark:bg-gray-700'
                            : 'bg-indigo-50 dark:bg-indigo-900 border-indigo-300 dark:border-indigo-600'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-medium text-indigo-800 dark:text-indigo-200">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {format(parseISO(notification.created_at), 'PPP HH:mm')}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Type: {notification.type}
                              {notification.store_users?.full_name &&
                                ` | User: ${notification.store_users.full_name}`}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleToggleRead(notification.id, notification.is_read)}
                              className="text-indigo-600 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-indigo-100"
                              aria-label={
                                notification.is_read
                                  ? 'Mark notification as unread'
                                  : 'Mark notification as read'
                              }
                            >
                              {notification.is_read ? (
                                <FaCircle className="w-5 h-5" />
                              ) : (
                                <FaCheckCircle className="w-5 h-5" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDeleteNotification(notification.id)}
                              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                              aria-label="Delete notification"
                            >
                              <FaTrash className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {totalPages > 1 && (
                <div className="mt-4 flex justify-center gap-4">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md disabled:bg-gray-300 dark:disabled:bg-gray-600"
                    aria-label="Previous page"
                  >
                    Previous
                  </button>
                  <span className="text-indigo-800 dark:text-indigo-200" aria-label={`Page ${currentPage} of ${totalPages}`}>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md disabled:bg-gray-300 dark:disabled:bg-gray-600"
                    aria-label="Next page"
                  >
                    Next
                  </button>
                </div>
              )}
              <button
                onClick={() => setShowNotificationModal(false)}
                className="mt-6 w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                aria-label="Close notifications"
              >
                Close
              </button>
            </DialogPanel>
          </div>
        </Dialog>
      )}
    </div>
  );
};

export default Notifications;