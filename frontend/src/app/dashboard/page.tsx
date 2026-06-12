'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useTasks, useCreateTask, useUpdateTask } from '@/hooks/useTasks';
import { Task, TaskFilters } from '@/types';
import TaskCard from '@/components/tasks/TaskCard';
import TaskFiltersBar from '@/components/tasks/TaskFilters';
import TaskForm from '@/components/tasks/TaskForm';
import TaskDetailModal from '@/components/tasks/TaskDetailModal';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { Plus, ClipboardList, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, isLoading: authLoading } = useAuth();

  const [filters, setFilters] = useState<TaskFilters>({ page: 1, limit: 12 });
  const [showCreate, setShowCreate] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [viewTask, setViewTask] = useState<Task | null>(null);

  const { data, isLoading, isError } = useTasks(filters);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  useWebSocket(token);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login');
  }, [authLoading, isAuthenticated, router]);

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-64px)]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const tasks = data?.tasks || [];
  const pagination = data?.pagination;

  const stats = {
    total: pagination?.total || 0,
    done: tasks.filter((t) => t.status === 'done').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    overdue: tasks.filter((t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length,
  };

  const handleCreateSubmit = async (formData: any) => {
    await createTask.mutateAsync(formData);
    setShowCreate(false);
  };

  const handleEditSubmit = async (formData: any) => {
    if (!editTask) return;
    await updateTask.mutateAsync({ id: editTask.id, ...formData });
    setEditTask(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Good {getGreeting()}, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Here&apos;s what&apos;s on your plate today
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          New Task
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Tasks', value: stats.total, icon: ClipboardList, color: 'text-slate-500' },
          { label: 'Completed', value: stats.done, icon: CheckCircle2, color: 'text-emerald-500' },
          { label: 'In Progress', value: stats.inProgress, icon: Clock, color: 'text-blue-500' },
          { label: 'Overdue', value: stats.overdue, icon: AlertCircle, color: 'text-red-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700"
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-6">
        <TaskFiltersBar filters={filters} onChange={setFilters} />
      </div>

      {/* Task list */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
          <h3 className="font-medium text-slate-900 dark:text-white mb-1">Failed to load tasks</h3>
          <p className="text-sm text-slate-500">Please try refreshing the page</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ClipboardList className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="font-medium text-slate-900 dark:text-white mb-1">
            {Object.values(filters).some(Boolean) ? 'No tasks match your filters' : 'No tasks yet'}
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            {Object.values(filters).some(Boolean)
              ? 'Try changing your filters'
              : 'Create your first task to get started'}
          </p>
          {!filters.search && !filters.status && !filters.priority && (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" />
              Create Task
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={(t) => setEditTask(t)}
                onView={(t) => setViewTask(t)}
              />
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.total_pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page === 1}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page || 1) - 1 }))}
              >
                Previous
              </Button>
              <span className="text-sm text-slate-500 dark:text-slate-400 px-3">
                Page {filters.page} of {pagination.total_pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page === pagination.total_pages}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page || 1) + 1 }))}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Create task modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Task">
        <TaskForm
          onSubmit={handleCreateSubmit}
          onCancel={() => setShowCreate(false)}
          isLoading={createTask.isPending}
        />
      </Modal>

      {/* Edit task modal */}
      {editTask && (
        <Modal isOpen={!!editTask} onClose={() => setEditTask(null)} title="Edit Task">
          <TaskForm
            initialData={editTask}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditTask(null)}
            isLoading={updateTask.isPending}
          />
        </Modal>
      )}

      {/* Task detail modal */}
      {viewTask && (
        <TaskDetailModal
          task={viewTask}
          isOpen={!!viewTask}
          onClose={() => setViewTask(null)}
          onEdit={(t) => { setViewTask(null); setEditTask(t); }}
        />
      )}
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
