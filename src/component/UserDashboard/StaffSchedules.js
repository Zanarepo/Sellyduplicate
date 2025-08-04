import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { format, parseISO, isBefore, isAfter } from 'date-fns';

const ScheduleManagement = () => {
  const [storeId, setStoreId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [, setUserEmail] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [staff, setStaff] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    staff_id: '',
    start_date: '',
    end_date: '',
    status: 'Working',
  });
  const [timeOffRequest, setTimeOffRequest] = useState({
    start_date: '',
    end_date: '',
    reason: '',
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [existingSchedule, setExistingSchedule] = useState(null);
  const [searchName, setSearchName] = useState('');
  const [searchDateStart, setSearchDateStart] = useState('');
  const [searchDateEnd, setSearchDateEnd] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);

  // Fetch user and store data
 useEffect(() => {
  const fetchUserData = async () => {
    try {
      toast.dismiss();
      const user_email = localStorage.getItem('user_email');
      console.log('localStorage user_email:', user_email ?? 'null/undefined');

      if (!user_email) {
        throw new Error('Missing user email. Please log in.');
      }
      setUserEmail(user_email);

      // Check if user is a store owner (admin)
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('id')
        .eq('email_address', user_email)
        .maybeSingle();
      console.log('stores query result:', storeData, 'error:', storeError?.message);

      if (storeData) {
        // User is an admin
        setIsAdmin(true);
        setStoreId(storeData.id);
        // Check if admin has a store_users entry (optional)
        const { data: adminUserData, error: adminUserError } = await supabase
          .from('store_users')
          .select('id')
          .eq('email_address', user_email)
          .eq('store_id', storeData.id)
          .maybeSingle();
        if (adminUserError) {
          throw new Error(`Error checking admin user in store_users: ${adminUserError.message}`);
        }
        if (adminUserData) {
          setUserId(adminUserData.id); // Set userId if admin has a store_users entry
        }
        // Note: userId may remain null for admins without a store_users entry
      } else {
        // Regular store user (staff)
        const { data: userData, error: userDataError } = await supabase
          .from('store_users')
          .select('id, store_id')
          .eq('email_address', user_email)
          .maybeSingle();
        console.log('store_users query result:', userData, 'error:', userDataError?.message);

        if (userDataError || !userData) {
          throw new Error(`User not found in stores or store_users: ${userDataError?.message || 'No user data'}`);
        }
        setIsStaff(true);
        setUserId(userData.id);
        setStoreId(userData.store_id);

        const { data: storeValidation, error: storeValidationError } = await supabase
          .from('stores')
          .select('id')
          .eq('id', userData.store_id)
          .single();
        if (storeValidationError || !storeValidation) {
          throw new Error(`Invalid store ID (${userData.store_id}): ${storeValidationError?.message || 'Store not found'}`);
        }
      }
    } catch (err) {
      console.error('fetchUserData error:', err);
      toast.error(err.message, { toastId: 'data-error' });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  fetchUserData();
}, []);


  // Fetch staff and schedules
 useEffect(() => {
  const fetchStaffAndSchedules = async () => {
    if (!storeId) return;

    try {
      const { data: storeUsers, error: usersError } = await supabase
        .from('store_users')
        .select('id, full_name, role')
        .eq('store_id', storeId);
      if (usersError) {
        throw new Error(`Error fetching staff: ${usersError.message}`);
      }
      console.log('staff query result:', storeUsers);
      setStaff(storeUsers || []);

      let query = supabase
        .from('schedules')
        .select('id, start_date, end_date, status, reason, staff_id, store_users!staff_id(full_name, role)')
        .eq('store_id', storeId);

      if (searchName) {
        query = query.ilike('store_users.full_name', `%${searchName}%`);
      }
      if (searchDateStart) {
        query = query.gte('start_date', searchDateStart);
      }
      if (searchDateEnd) {
        query = query.lte('end_date', searchDateEnd);
      }
      if (searchStatus) {
        query = query.eq('status', searchStatus);
      }

      const { data: schedulesData, error: schedulesError } = await query;
      if (schedulesError) {
        throw new Error(`Error fetching schedules: ${schedulesError.message}`);
      }
      console.log('schedules query result:', schedulesData);

      // Sort schedules: Active time-off, scheduled time-off, expired time-off, others
      const today = new Date('2025-07-19');
      const sortedSchedules = schedulesData.sort((a, b) => {
        const aIsActive = ['TimeOffRequested', 'TimeOffApproved'].includes(a.status) && !isBefore(parseISO(a.end_date), today);
        const bIsActive = ['TimeOffRequested', 'TimeOffApproved'].includes(b.status) && !isBefore(parseISO(b.end_date), today);
        const aIsScheduled = ['TimeOffRequested', 'TimeOffApproved'].includes(a.status) && isAfter(parseISO(a.start_date), today);
        const bIsScheduled = ['TimeOffRequested', 'TimeOffApproved'].includes(b.status) && isAfter(parseISO(b.start_date), today);
        const aIsExpired = ['TimeOffRejected'].includes(a.status) || isBefore(parseISO(a.end_date), today);
        const bIsExpired = ['TimeOffRejected'].includes(a.status) || isBefore(parseISO(b.end_date), today);

        if (aIsActive && !bIsActive) return -1;
        if (!aIsActive && bIsActive) return 1;
        if (aIsScheduled && !bIsScheduled) return -1;
        if (!aIsScheduled && bIsScheduled) return 1;
        if (aIsExpired && !bIsExpired) return 1;
        if (!aIsExpired && bIsExpired) return -1;
        return parseISO(a.start_date) - parseISO(b.start_date);
      });

      setSchedules(sortedSchedules || []);
    } catch (err) {
      console.error('fetchStaffAndSchedules error:', err);
      toast.error(err.message, { toastId: 'data-error' });
      setError(err.message);
    }
  };

  fetchStaffAndSchedules();
}, [storeId, searchName, searchDateStart, searchDateEnd, searchStatus]);

  // Check for existing schedule
  useEffect(() => {
    const checkExistingSchedule = async () => {
      if (isAdmin && newSchedule.staff_id && newSchedule.start_date && newSchedule.end_date) {
        const { data, error } = await supabase
          .from('schedules')
          .select('status, reason')
          .eq('store_id', storeId)
          .eq('staff_id', newSchedule.staff_id)
          .eq('start_date', newSchedule.start_date)
          .eq('end_date', newSchedule.end_date)
          .single();
        if (error && error.code !== 'PGRST116') {
          console.error('checkExistingSchedule error:', error);
          toast.error(`Error checking schedule: ${error.message}`, { toastId: 'check-error' });
        }
        setExistingSchedule(data);
      } else {
        setExistingSchedule(null);
      }
    };

    checkExistingSchedule();
  }, [newSchedule.staff_id, newSchedule.start_date, newSchedule.end_date, storeId, isAdmin]);

  // Handle form input changes
  const handleInputChange = (e, formType) => {
    const { name, value } = e.target;
    if (formType === 'schedule') {
      setNewSchedule((prev) => ({ ...prev, [name]: value }));
    } else if (formType === 'timeoff') {
      setTimeOffRequest((prev) => ({ ...prev, [name]: value }));
    } else if (formType === 'update') {
      setSelectedSchedule((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Create or update schedule (admin only)
  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('Only admins can create schedules.', { toastId: 'not-admin' });
      return;
    }
    try {
      toast.dismiss();
      if (!newSchedule.staff_id || !newSchedule.start_date || !newSchedule.end_date) {
        toast.error('Please fill in all required fields.', { toastId: 'form-error' });
        return;
      }
      if (newSchedule.start_date > newSchedule.end_date) {
        toast.error('Start date must be before or equal to end date.', { toastId: 'date-error' });
        return;
      }

      const { data, error } = await supabase
        .from('schedules')
        .upsert(
          [
            {
              store_id: storeId,
              staff_id: parseInt(newSchedule.staff_id),
              start_date: newSchedule.start_date,
              end_date: newSchedule.end_date,
              status: newSchedule.status,
              reason: null,
            },
          ],
          {
            onConflict: ['store_id', 'staff_id', 'start_date', 'end_date'],
            update: { status: newSchedule.status, reason: null, updated_at: new Date().toISOString() },
          }
        )
        .select('id, start_date, end_date, status, reason, staff_id, store_users!staff_id(full_name, role)')
        .single();

      if (error) {
        throw new Error(`Error creating schedule: ${error.message}`);
      }

      setSchedules((prev) => {
        const updatedSchedules = prev.filter(
          (s) => !(s.staff_id === parseInt(newSchedule.staff_id) && s.start_date === newSchedule.start_date && s.end_date === newSchedule.end_date)
        );
        return [...updatedSchedules, data];
      });
      toast.success(
        `Schedule updated for ${staff.find((s) => s.id === parseInt(newSchedule.staff_id))?.full_name} from ${format(
          parseISO(newSchedule.start_date),
          'PPP'
        )} to ${format(parseISO(newSchedule.end_date), 'PPP')}.`,
        { toastId: 'schedule-created' }
      );
      setNewSchedule({ staff_id: '', start_date: '', end_date: '', status: 'Working' });
      setExistingSchedule(null);
    } catch (err) {
      console.error('handleCreateSchedule error:', err);
      toast.error(err.message, { toastId: 'schedule-create-error' });
    }
  };

  // Request time-off (staff only)
  const handleTimeOffRequest = async (e) => {
    e.preventDefault();
    if (!isStaff) {
      toast.error('Only staff can request time-off.', { toastId: 'not-staff' });
      return;
    }
    try {
      toast.dismiss();
      if (!timeOffRequest.start_date || !timeOffRequest.end_date || !timeOffRequest.reason) {
        toast.error('Please provide start date, end date, and reason.', { toastId: 'form-error' });
        return;
      }
      if (timeOffRequest.start_date > timeOffRequest.end_date) {
        toast.error('Start date must be before or equal to end date.', { toastId: 'date-error' });
        return;
      }

      const { data, error } = await supabase
        .from('schedules')
        .upsert(
          [
            {
              store_id: storeId,
              staff_id: userId,
              start_date: timeOffRequest.start_date,
              end_date: timeOffRequest.end_date,
              status: 'TimeOffRequested',
              reason: timeOffRequest.reason,
            },
          ],
          {
            onConflict: ['store_id', 'staff_id', 'start_date', 'end_date'],
            update: { status: 'TimeOffRequested', reason: timeOffRequest.reason, updated_at: new Date().toISOString() },
          }
        )
        .select('id, start_date, end_date, status, reason, staff_id, store_users!staff_id(full_name, role)')
        .single();

      if (error) {
        throw new Error(`Error requesting time-off: ${error.message}`);
      }

      setSchedules((prev) => {
        const updatedSchedules = prev.filter(
          (s) => !(s.staff_id === userId && s.start_date === timeOffRequest.start_date && s.end_date === timeOffRequest.end_date)
        );
        return [...updatedSchedules, data];
      });
      toast.success(
        `Time-off requested from ${format(parseISO(timeOffRequest.start_date), 'PPP')} to ${format(
          parseISO(timeOffRequest.end_date),
          'PPP'
        )}.`,
        { toastId: 'timeoff-requested' }
      );
      setTimeOffRequest({ start_date: '', end_date: '', reason: '' });
      setIsRequestModalOpen(false);
    } catch (err) {
      console.error('handleTimeOffRequest error:', err);
      toast.error(err.message, { toastId: 'timeoff-request-error' });
    }
  };

  // Update schedule (admin only)
  const handleUpdateSchedule = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('Only admins can update schedules.', { toastId: 'not-admin' });
      return;
    }
    try {
      toast.dismiss();
      if (!selectedSchedule?.staff_id || !selectedSchedule?.start_date || !selectedSchedule?.end_date) {
        toast.error('Please fill in all required fields.', { toastId: 'form-error' });
        return;
      }
      if (selectedSchedule.start_date > selectedSchedule.end_date) {
        toast.error('Start date must be before or equal to end date.', { toastId: 'date-error' });
        return;
      }

      const { data, error } = await supabase
        .from('schedules')
        .upsert(
          [
            {
              id: selectedSchedule.id,
              store_id: storeId,
              staff_id: parseInt(selectedSchedule.staff_id),
              start_date: selectedSchedule.start_date,
              end_date: selectedSchedule.end_date,
              status: selectedSchedule.status,
              reason: selectedSchedule.status === 'Working' || selectedSchedule.status === 'Off' ? null : selectedSchedule.reason,
            },
          ],
          {
            onConflict: ['store_id', 'staff_id', 'start_date', 'end_date'],
            update: {
              status: selectedSchedule.status,
              reason: selectedSchedule.status === 'Working' || selectedSchedule.status === 'Off' ? null : selectedSchedule.reason,
              updated_at: new Date().toISOString(),
            },
          }
        )
        .select('id, start_date, end_date, status, reason, staff_id, store_users!staff_id(full_name, role)')
        .single();

      if (error) {
        throw new Error(`Error updating schedule: ${error.message}`);
      }

      setSchedules((prev) =>
        prev.map((s) => (s.id === selectedSchedule.id ? data : s))
      );
      toast.success(
        `Schedule updated for ${selectedSchedule.store_users?.full_name} from ${format(
          parseISO(selectedSchedule.start_date),
          'PPP'
        )} to ${format(parseISO(selectedSchedule.end_date), 'PPP')}.`,
        { toastId: 'schedule-updated' }
      );
      setIsUpdateModalOpen(false);
      setSelectedSchedule(null);
    } catch (err) {
      console.error('handleUpdateSchedule error:', err);
      toast.error(err.message, { toastId: 'schedule-update-error' });
    }
  };

  // Delete schedule (admin only)
  const handleDeleteSchedule = async (scheduleId) => {
    if (!isAdmin) {
      toast.error('Only admins can delete schedules.', { toastId: 'not-admin' });
      return;
    }
    if (!window.confirm('Are you sure you want to delete this schedule?')) return;

    try {
      toast.dismiss();
      const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', scheduleId)
        .eq('store_id', storeId);
      if (error) {
        throw new Error(`Error deleting schedule: ${error.message}`);
      }

      setSchedules((prev) => prev.filter((schedule) => schedule.id !== scheduleId));
      toast.success('Schedule deleted.', { toastId: `schedule-deleted-${scheduleId}` });
      setIsDetailsModalOpen(false);
    } catch (err) {
      console.error('handleDeleteSchedule error:', err);
      toast.error(err.message, { toastId: 'schedule-delete-error' });
    }
  };

  // Cancel time-off request (staff only)
  const handleCancelTimeOff = async (scheduleId) => {
    if (!isStaff || selectedSchedule?.staff_id !== userId) {
      toast.error('Only the requesting staff can cancel this time-off.', { toastId: 'not-authorized' });
      return;
    }
    try {
      toast.dismiss();
      const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', scheduleId)
        .eq('store_id', storeId);
      if (error) {
        throw new Error(`Error canceling time-off: ${error.message}`);
      }

      setSchedules((prev) => prev.filter((schedule) => schedule.id !== scheduleId));
      toast.success(
        `Time-off request canceled for ${format(parseISO(selectedSchedule.start_date), 'PPP')} to ${format(
          parseISO(selectedSchedule.end_date),
          'PPP'
        )}.`,
        { toastId: `timeoff-canceled-${scheduleId}` }
      );
      setIsDetailsModalOpen(false);
    } catch (err) {
      console.error('handleCancelTimeOff error:', err);
      toast.error(err.message, { toastId: 'timeoff-cancel-error' });
    }
  };

  // Approve or reject time-off (admin only)
  const handleTimeOffApproval = async (scheduleId, status) => {
    if (!isAdmin) {
      toast.error('Only admins can approve time-off.', { toastId: 'not-admin' });
      return;
    }
    try {
      toast.dismiss();
      const { error } = await supabase
        .from('schedules')
        .update({ status })
        .eq('id', scheduleId)
        .eq('store_id', storeId);
      if (error) {
        throw new Error(`Error updating time-off: ${error.message}`);
      }

      setSchedules((prev) =>
        prev.map((schedule) =>
          schedule.id === scheduleId ? { ...schedule, status } : schedule
        )
      );
      toast.success(
        `Time-off ${status === 'TimeOffApproved' ? 'approved' : 'rejected'} for ${selectedSchedule?.store_users?.full_name}.`,
        { toastId: `timeoff-${status}-${scheduleId}` }
      );
      setIsDetailsModalOpen(false);
    } catch (err) {
      console.error('handleTimeOffApproval error:', err);
      toast.error(err.message, { toastId: 'timeoff-approval-error' });
    }
  };

  // Open modals
  const openDetailsModal = (schedule) => {
    setSelectedSchedule(schedule);
    setIsDetailsModalOpen(true);
  };

  const openUpdateModal = (schedule) => {
    setSelectedSchedule(schedule);
    setIsUpdateModalOpen(true);
  };

  // Close modals
  const closeModal = () => {
    setIsRequestModalOpen(false);
    setIsDetailsModalOpen(false);
    setIsUpdateModalOpen(false);
    setSelectedSchedule(null);
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentSchedules = schedules.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(schedules.length / itemsPerPage);

  return (
    <div className="w-full bg-white dark:bg-gray-900">
      <h2 className="text-2xl font-bold text-indigo-800 dark:text-white mb-4">Schedule Management</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {loading ? (
        <div className="flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <>
          {/* Admin Schedule Form */}
          {isAdmin && (
            <form onSubmit={handleCreateSchedule} className="mb-8 bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-200">Staff</label>
                  <select
                    name="staff_id"
                    value={newSchedule.staff_id}
                    onChange={(e) => handleInputChange(e, 'schedule')}
                    className="mt-1 p-2 w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    required
                  >
                    <option value="">Select Staff</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} ({s.role || 'N/A'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-200">Start Date</label>
                  <input
                    type="date"
                    name="start_date"
                    value={newSchedule.start_date}
                    onChange={(e) => handleInputChange(e, 'schedule')}
                    className="mt-1 p-2 w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-200">End Date</label>
                  <input
                    type="date"
                    name="end_date"
                    value={newSchedule.end_date}
                    onChange={(e) => handleInputChange(e, 'schedule')}
                    className="mt-1 p-2 w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-200">Status</label>
                  <select
                    name="status"
                    value={newSchedule.status}
                    onChange={(e) => handleInputChange(e, 'schedule')}
                    className="mt-1 p-2 w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="Working">Working</option>
                    <option value="Off">Off</option>
                  </select>
                </div>
              </div>
              {existingSchedule && (
                <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
                  Existing schedule: {existingSchedule.status} {existingSchedule.reason ? `(Reason: ${existingSchedule.reason})` : ''}
                </p>
              )}
              <button
                type="submit"
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Update Schedule
              </button>
            </form>


          )}
         {/* Staff Time‑Off Request Button */}
{isStaff && (
  <button
    onClick={() => setIsRequestModalOpen(true)}
    className="mb-4 w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
  >
    Request Time‑Off
  </button>
)}

{/* Search Filters */}
<div className="mb-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
  {/* Name Filter */}
  <div>
    <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-200">
      Search by Name
    </label>
    <input
      type="text"
      value={searchName}
      onChange={e => setSearchName(e.target.value)}
      placeholder="Enter staff name"
      className="mt-1 p-2 w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
    />
  </div>

  {/* Start Date */}
  <div>
    <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-200">
      Start Date
    </label>
    <input
      type="date"
      value={searchDateStart}
      onChange={e => setSearchDateStart(e.target.value)}
      className="mt-1 p-2 w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
    />
  </div>

  {/* End Date */}
  <div>
    <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-200">
      End Date
    </label>
    <input
      type="date"
      value={searchDateEnd}
      onChange={e => setSearchDateEnd(e.target.value)}
      className="mt-1 p-2 w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
    />
  </div>

  {/* Status */}
  <div>
    <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-200">
      Status
    </label>
    <select
      value={searchStatus}
      onChange={e => setSearchStatus(e.target.value)}
      className="mt-1 p-2 w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
    >
      <option value="">All</option>
      <option value="Working">Working</option>
      <option value="Off">Off</option>
      <option value="TimeOffRequested">Requested</option>
      <option value="TimeOffApproved">Approved</option>
      <option value="TimeOffRejected">Rejected</option>
    </select>
  </div>
</div>

          {/* Schedules Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left border-collapse">
              <thead>
                <tr className="bg-indigo-100 dark:bg-indigo-800">
                  <th className="p-2 text-indigo-800 dark:text-indigo-200 text-sm md:text-base">Date Range</th>
                  <th className="p-2 text-indigo-800 dark:text-indigo-200 text-sm md:text-base">Staff</th>
                  <th className="p-2 text-indigo-800 dark:text-indigo-200 text-sm md:text-base">Status</th>
                  <th className="p-2 text-indigo-800 dark:text-indigo-200 text-sm md:text-base">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentSchedules.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-2 text-center text-gray-500 dark:text-gray-400">
                      No schedules found.
                    </td>
                  </tr>
                ) : (
                  currentSchedules.map((schedule) => {
                    const today = new Date('2025-07-19');
                    const isActive = ['TimeOffRequested', 'TimeOffApproved'].includes(schedule.status) && !isBefore(parseISO(schedule.end_date), today);
                    const isExpired = ['TimeOffRejected'].includes(schedule.status) || isBefore(parseISO(schedule.end_date), today);
                    const rowClass = isActive
                      ? 'bg-red-100 dark:bg-red-800'
                      : isExpired
                      ? 'bg-indigo-100 dark:bg-indigo-800'
                      : schedule.status === 'Working'
                      ? 'bg-green-100 dark:bg-green-800'
                      : 'bg-gray-100 dark:bg-gray-700';
                    return (
                      <tr key={schedule.id} className={`border-b dark:border-gray-700 ${rowClass}`}>
                        <td className="p-2 text-indigo-800 dark:text-indigo-200 text-sm md:text-base">
                          {format(parseISO(schedule.start_date), 'PPP')} - {format(parseISO(schedule.end_date), 'PPP')}
                        </td>
                        <td className="p-2 text-indigo-800 dark:text-indigo-200 text-sm md:text-base">
                          {schedule.store_users?.full_name}
                        </td>
                        <td className="p-2 text-indigo-800 dark:text-indigo-200 text-sm md:text-base">{schedule.status}</td>
                        
                       <td className="p-2">
  <div className="flex flex-col md:flex-row gap-2">
    {(isAdmin || schedule.staff_id === userId) && (
      <button
        onClick={() => openDetailsModal(schedule)}
        className="px-2 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm w-full md:w-auto"
      >
        View
      </button>
    )}
    {isAdmin && (
      <>
        <button
          onClick={() => openUpdateModal(schedule)}
          className="px-2 py-1 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 text-sm w-full md:w-auto"
        >
          Update
        </button>
        <button
          onClick={() => handleDeleteSchedule(schedule.id)}
          className="px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm w-full md:w-auto"
        >
          Delete
        </button>
      </>
    )}
  </div>
</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex justify-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md disabled:bg-gray-300 dark:disabled:bg-gray-600"
              >
                Previous
              </button>
              <span className="text-indigo-800 dark:text-indigo-200">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md disabled:bg-gray-300 dark:disabled:bg-gray-600"
              >
                Next
              </button>
            </div>
          )}
          {/* Time-Off Request Modal */}
          <Dialog open={isRequestModalOpen} onClose={closeModal} className="relative z-50">
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <DialogPanel className="w-full max-w-sm rounded-lg bg-white dark:bg-gray-800 p-6">
                <DialogTitle className="text-lg font-bold text-indigo-800 dark:text-indigo-200">
                  Request Time-Off
                </DialogTitle>
                <button
                  onClick={closeModal}
                  className="absolute top-2 right-2 text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100"
                >
                  ✕
                </button>
                <form onSubmit={handleTimeOffRequest} className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-200">Start Date</label>
                    <input
                      type="date"
                      name="start_date"
                      value={timeOffRequest.start_date}
                      onChange={(e) => handleInputChange(e, 'timeoff')}
                      className="mt-1 p-2 w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-200">End Date</label>
                    <input
                      type="date"
                      name="end_date"
                      value={timeOffRequest.end_date}
                      onChange={(e) => handleInputChange(e, 'timeoff')}
                      className="mt-1 p-2 w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-200">Reason</label>
                    <textarea
                      name="reason"
                      value={timeOffRequest.reason}
                      onChange={(e) => handleInputChange(e, 'timeoff')}
                      className="mt-1 p-2 w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      rows="4"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  >
                    Submit Request
                  </button>
                </form>
              </DialogPanel>
            </div>
          </Dialog>
          {/* Schedule Details Modal */}
          <Dialog open={isDetailsModalOpen} onClose={closeModal} className="relative z-50">
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <DialogPanel className="w-full max-w-sm rounded-lg bg-white dark:bg-gray-800 p-6">
                <DialogTitle className="text-lg font-bold text-indigo-800 dark:text-indigo-200">
                  Schedule Details: {selectedSchedule?.store_users?.full_name}
                </DialogTitle>
                <button
                  onClick={closeModal}
                  className="absolute top-2 right-2 text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100"
                >
                  ✕
                </button>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-200">Date Range</label>
                    <p className="text-indigo-800 dark:text-indigo-200">
                      {selectedSchedule
                        ? `${format(parseISO(selectedSchedule.start_date), 'PPP')} - ${format(
                            parseISO(selectedSchedule.end_date),
                            'PPP'
                          )}`
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-200">Status</label>
                    <p className="text-indigo-800 dark:text-indigo-200">{selectedSchedule?.status || '-'}</p>
                  </div>
                  {selectedSchedule?.reason && (
                    <div>
                      <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-200">Reason</label>
                      <p className="text-indigo-800 dark:text-indigo-200">{selectedSchedule.reason}</p>
                    </div>
                  )}
                  {isAdmin && selectedSchedule?.status === 'TimeOffRequested' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTimeOffApproval(selectedSchedule.id, 'TimeOffApproved')}
                        className="px-2 py-1 bg-green-600 text-white rounded-md hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleTimeOffApproval(selectedSchedule.id, 'TimeOffRejected')}
                        className="px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {isStaff && selectedSchedule?.staff_id === userId && selectedSchedule?.status === 'TimeOffRequested' && (
                    <button
                      onClick={() => handleCancelTimeOff(selectedSchedule.id)}
                      className="px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      Cancel Request
                    </button>
                  )}
                </div>
                <button
                  onClick={closeModal}
                  className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Close
                </button>
              </DialogPanel>
            </div>
          </Dialog>
          {/* Update Schedule Modal */}
          <Dialog open={isUpdateModalOpen} onClose={closeModal} className="relative z-50">
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <DialogPanel className="w-full max-w-sm rounded-lg bg-white dark:bg-gray-800 p-6">
                <DialogTitle className="text-lg font-bold text-indigo-800 dark:text-indigo-200">
                  Update Schedule: {selectedSchedule?.store_users?.full_name}
                </DialogTitle>
                <button
                  onClick={closeModal}
                  className="absolute top-2 right-2 text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100"
                >
                  ✕
                </button>
                <form onSubmit={handleUpdateSchedule} className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-200">Start Date</label>
                    <input
                      type="date"
                      name="start_date"
                      value={selectedSchedule?.start_date || ''}
                      onChange={(e) => handleInputChange(e, 'update')}
                      className="mt-1 p-2 w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-200">End Date</label>
                    <input
                      type="date"
                      name="end_date"
                      value={selectedSchedule?.end_date || ''}
                      onChange={(e) => handleInputChange(e, 'update')}
                      className="mt-1 p-2 w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-200">Status</label>
                    <select
                      name="status"
                      value={selectedSchedule?.status || ''}
                      onChange={(e) => handleInputChange(e, 'update')}
                      className="mt-1 p-2 w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="Working">Working</option>
                      <option value="Off">Off</option>
                      <option value="TimeOffRequested">Time-Off Requested</option>
                      <option value="TimeOffApproved">Time-Off Approved</option>
                      <option value="TimeOffRejected">Time-Off Rejected</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-200">Reason</label>
                    <textarea
                      name="reason"
                      value={selectedSchedule?.reason || ''}
                      onChange={(e) => handleInputChange(e, 'update')}
                      className="mt-1 p-2 w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      rows="4"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  >
                    Update Schedule
                  </button>
                </form>
              </DialogPanel>
            </div>
          </Dialog>
        </>
      )}
    </div>
  );
};

export default ScheduleManagement;