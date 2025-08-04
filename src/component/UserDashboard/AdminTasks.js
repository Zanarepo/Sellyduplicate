import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';

const TaskManagement = () => {
  const [storeId, setStoreId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [user_email, setUserEmail] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [staff, setStaff] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [, setCurrentUserId] = useState(null);
  const [newTask, setNewTask] = useState({
    task_name: '',
    description: '',
    status: 'Pending',
    remarks: '',
    staff_id: '',
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [modalRemarks, setModalRemarks] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);

  // Fetch user and store data using user_email
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

        // Check if user is an admin by looking in the stores table
        const { data: storeData, error: storeError } = await supabase
          .from('stores')
          .select('id')
          .eq('email_address', user_email)
          .single();
        console.log('stores query result:', storeData, 'error:', storeError?.message);

        if (storeData && !storeError) {
          // User found in stores table, they are an admin
          setIsAdmin(true);
          setStoreId(storeData.id);
          // Fetch user_id from store_users for the admin (optional, depending on your schema)
          const { data: adminUserData, error: adminUserError } = await supabase
            .from('store_users')
            .select('id')
            .eq('email_address', user_email)
            .eq('store_id', storeData.id)
            .single();
          if (adminUserError || !adminUserData) {
            // If admin is not in store_users, use a fallback or generate a user_id if needed
            // For simplicity, we'll assume admin doesn't need to be in store_users
            setUserId(null); // Or set a default/fallback user_id if required
          } else {
            setUserId(adminUserData.id);
            setCurrentUserId(adminUserData.id);
          }
        } else {
          // User is not an admin, check if they are a staff member in store_users
          const { data: userData, error: userDataError } = await supabase
            .from('store_users')
            .select('id, store_id')
            .eq('email_address', user_email)
            .single();
          console.log('store_users query result:', userData, 'error:', userDataError?.message);

          if (userDataError || !userData) {
            throw new Error(`User not found in stores or store_users: ${userDataError?.message || 'No user data'}`);
          }
          setIsStaff(true);
          setUserId(userData.id);
          setCurrentUserId(userData.id);
          setStoreId(userData.store_id);

          // Validate store_id
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

  // Fetch staff and tasks once storeId and userId are set
  useEffect(() => {
    const fetchStaffAndTasks = async () => {
      if (!storeId) return; // Skip if storeId is not set

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

        const query = supabase
          .from('tasks')
          .select('id, task_name, description, status, remarks, approval_status, staff_id, store_users!staff_id(full_name, role)')
          .eq('store_id', storeId);
        if (!isAdmin) {
          query.eq('staff_id', userId);
        }
        const { data: tasksData, error: tasksError } = await query;
        if (tasksError) {
          throw new Error(`Error fetching tasks: ${tasksError.message}`);
        }
        console.log('tasks query result:', tasksData);
        setTasks(tasksData || []);
      } catch (err) {
        console.error('fetchStaffAndTasks error:', err);
        toast.error(err.message, { toastId: 'data-error' });
        setError(err.message);
      }
    };

    fetchStaffAndTasks();
  }, [storeId, userId, isAdmin]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewTask((prev) => ({ ...prev, [name]: value }));
  };

  // Open modal with task details
  const openModal = (task) => {
    setSelectedTask(task);
    setModalRemarks(task.remarks || '');
    setIsModalOpen(true);
  };

  // Close modal
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedTask(null);
    setModalRemarks('');
  };

  // Update task status or remarks
  const handleTaskUpdate = async (taskId, updates) => {
    try {
      toast.dismiss();
      const query = supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .eq('store_id', storeId);
      if (!isAdmin) {
        query.eq('staff_id', userId);
      }
      const { error } = await query;
      if (error) {
        throw new Error(`Error updating task: ${error.message}`);
      }

      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, ...updates } : task
        )
      );
      if (updates.status) {
        toast.success(`Task status updated to "${updates.status}".`, { toastId: `status-updated-${taskId}` });
      } else if (updates.remarks) {
        toast.success('Remarks updated, pending admin approval.', { toastId: `remarks-updated-${taskId}` });
        toast.success(`New remarks added to task "${tasks.find(t => t.id === taskId)?.task_name}" for approval.`, { toastId: `admin-notify-${taskId}` });
      } else if (updates.approval_status) {
        toast.success(`Remarks ${updates.approval_status} for task "${tasks.find(t => t.id === taskId)?.task_name}".`, { toastId: `approval-${taskId}` });
      }
    } catch (err) {
      console.error('handleTaskUpdate error:', err);
      toast.error(err.message, { toastId: 'task-update-error' });
    }
  };

  // Approve or reject remarks (admin only)
  const handleApproval = async (taskId, approvalStatus) => {
    if (!isAdmin) {
      toast.error('Only admins can approve remarks.', { toastId: 'not-admin' });
      return;
    }
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updates = { approval_status: approvalStatus };
    if (approvalStatus === 'Approved' && task.status === 'In Progress') {
      updates.status = 'Completed';
    }
    await handleTaskUpdate(taskId, updates);
    closeModal();
  };

  // Delete task
  const handleDeleteTask = async (taskId) => {
    try {
      toast.dismiss();
      const query = supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('store_id', storeId);
      if (!isAdmin) {
        query.eq('staff_id', userId);
      }
      const { error } = await query;
      if (error) {
        throw new Error(`Error deleting task: ${error.message}`);
      }

      setTasks((prev) => prev.filter((task) => task.id !== taskId));
      toast.success('Task deleted successfully.', { toastId: `task-deleted-${taskId}` });
      setShowDeleteConfirm(false);
      setTaskToDelete(null);
    } catch (err) {
      console.error('handleDeleteTask error:', err);
      toast.error(err.message, { toastId: 'task-delete-error' });
    }
  };

  // Create a new task (admin only)
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('Only admins can create tasks.', { toastId: 'not-admin' });
      return;
    }
    try {
      toast.dismiss();
      if (!newTask.task_name || !newTask.staff_id) {
        toast.error('Please fill in all required fields.', { toastId: 'form-error' });
        return;
      }

      // Fetch user_id for the creator (admin) if needed
      let creatorId = userId;
      if (!creatorId) {
        const { data: creatorData, error: creatorError } = await supabase
          .from('store_users')
          .select('id')
          .eq('email_address', user_email)
          .eq('store_id', storeId)
          .single();
        if (creatorError && creatorError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          throw new Error(`Error fetching creator data: ${creatorError.message}`);
        }
        creatorId = creatorData?.id || null; // Allow null if admin is not in store_users
      }

      const { data, error } = await supabase
        .from('tasks')
        .insert([
          {
            store_id: storeId,
            staff_id: parseInt(newTask.staff_id),
            task_name: newTask.task_name,
            description: newTask.description,
            status: newTask.status,
            remarks: newTask.remarks,
            approval_status: 'Pending',
            created_by: creatorId, // May be null if admin is not in store_users
          },
        ])
        .select('id, task_name, description, status, remarks, approval_status, staff_id, store_users!staff_id(full_name, role)')
        .single();

      if (error) {
        throw new Error(`Error creating task: ${error.message}`);
      }

      setTasks((prev) => [...prev, data]);
      toast.success(`Task "${newTask.task_name}" assigned to ${staff.find(s => s.id === parseInt(newTask.staff_id))?.full_name}.`, { toastId: 'task-created' });
      toast.success(`You have been assigned a new task: "${newTask.task_name}"`, { toastId: `staff-notify-${newTask.staff_id}` });
      setNewTask({ task_name: '', description: '', status: 'Pending', remarks: '', staff_id: '' });
    } catch (err) {
      console.error('handleCreateTask error:', err);
      toast.error(err.message, { toastId: 'task-create-error' });
    }
  };

  return (
    <div className="w-full bg-white dark:bg-gray-900 ">
      <h2 className="text-2xl font-bold text-indigo-800 dark:text-white mb-4">Task Management</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {loading ? (
        <div className="flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <>
          {isAdmin && (
            <form onSubmit={handleCreateTask} className="mb-8 bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-200">Task Name</label>
                  <input
                    type="text"
                    name="task_name"
                    value={newTask.task_name}
                    onChange={handleInputChange}
                    className="mt-1 p-2 w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-200">Assign to Staff</label>
                  <select
                    name="staff_id"
                    value={newTask.staff_id}
                    onChange={handleInputChange}
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
                  <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-200">Status</label>
                  <select
                    name="status"
                    value={newTask.status}
                    onChange={handleInputChange}
                    className="mt-1 p-2 w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-200">Description</label>
                  <textarea
                    name="description"
                    value={newTask.description}
                    onChange={handleInputChange}
                    className="mt-1 p-2 w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    rows="4"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-200">Remarks</label>
                  <textarea
                    name="remarks"
                    value={newTask.remarks}
                    onChange={handleInputChange}
                    className="mt-1 p-2 w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    rows="2"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Create Task
              </button>
            </form>
          )}
          {(isAdmin || isStaff) && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left border-collapse">
                <thead>
                  <tr className="bg-indigo-100 dark:bg-indigo-800">
                    <th className="p-2 text-indigo-800 dark:text-indigo-200 text-sm md:text-base">Task Name</th>
                    <th className="p-2 text-indigo-800 dark:text-indigo-200 text-sm md:text-base">Assigned To</th>
                    <th className="p-2 text-indigo-800 dark:text-indigo-200 text-sm md:text-base">Approval Status</th>
                    <th className="p-2 text-indigo-800 dark:text-indigo-200 text-sm md:text-base">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="p-2 text-center text-gray-500 dark:text-gray-400">
                        No tasks found.
                      </td>
                    </tr>
                  ) : (
                    tasks.map((task) => (
                      <tr key={task.id} className="border-b dark:border-gray-700">
                        <td className="p-2 text-indigo-800 dark:text-indigo-200 text-sm md:text-base">{task.task_name}</td>
                        <td className="p-2 text-indigo-800 dark:text-indigo-200 text-sm md:text-base">{task.store_users?.full_name}</td>
                        <td className="p-2 text-indigo-800 dark:text-indigo-200 text-sm md:text-base">{task.approval_status}</td>
                        <td className="p-2 flex flex-col md:flex-row gap-2">
                          <button
                            onClick={() => openModal(task)}
                            className="px-2 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                          >
                            View
                          </button>
                          <button
                            onClick={() => {
                              setTaskToDelete(task.id);
                              setShowDeleteConfirm(true);
                            }}
                            className="px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          {/* Modal for task details */}
          <Dialog open={isModalOpen} onClose={closeModal} className="relative z-50">
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <DialogPanel className="w-full max-w-lg rounded-lg bg-white dark:bg-gray-800 p-6">
                <DialogTitle className="text-lg font-bold text-indigo-800 dark:text-indigo-200">
                  Task Details: {selectedTask?.task_name}
                </DialogTitle>
                <button
                  onClick={closeModal}
                  className="absolute top-2 right-2 text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100"
                >
                  ✕
                </button>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-200">Staff Role</label>
                    <p className="text-indigo-800 dark:text-indigo-200">{selectedTask?.store_users?.role || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-200">Description</label>
                    <p className="text-indigo-800 dark:text-indigo-200">{selectedTask?.description || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-200">Status</label>
                    <select
                      value={selectedTask?.status || 'Pending'}
                      onChange={(e) => handleTaskUpdate(selectedTask?.id, { status: e.target.value })}
                      className="p-1 w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      disabled={isAdmin ? (selectedTask?.approval_status !== 'Approved' && selectedTask?.status === 'In Progress') : (selectedTask?.status === 'Completed' || selectedTask?.approval_status !== 'Approved')}
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      {isAdmin && <option value="Completed">Completed</option>}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-200">Remarks</label>
                    {isAdmin ? (
                      <p className="text-indigo-800 dark:text-indigo-200">{selectedTask?.remarks || '-'}</p>
                    ) : (
                      <textarea
                        value={modalRemarks}
                        onChange={(e) => {
                          setModalRemarks(e.target.value);
                          handleTaskUpdate(selectedTask?.id, { remarks: e.target.value });
                        }}
                        className="p-1 w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        rows="4"
                      />
                    )}
                  </div>
                  {isAdmin && selectedTask?.remarks && selectedTask?.approval_status === 'Pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproval(selectedTask.id, 'Approved')}
                        className="px-2 py-1 bg-green-600 text-white rounded-md hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleApproval(selectedTask.id, 'Rejected')}
                        className="px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </div>
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
          {/* Delete Confirmation Modal */}
          <Dialog open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} className="relative z-50">
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <DialogPanel className="w-full max-w-sm rounded-lg bg-white dark:bg-gray-800 p-6">
                <DialogTitle className="text-lg font-bold text-indigo-800 dark:text-indigo-200">
                  Confirm Delete
                </DialogTitle>
                <p className="mt-2 text-indigo-800 dark:text-indigo-200">Are you sure you want to delete this task?</p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => handleDeleteTask(taskToDelete)}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded-md hover:bg-gray-400 dark:hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </DialogPanel>
            </div>
          </Dialog>
        </>
      )}
    </div>
  );
};

export default TaskManagement;