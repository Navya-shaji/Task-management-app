'use client';

import { useState } from 'react';
import { Task } from '@/types';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import {
  cn,
  formatDate,
  isOverdue,
  PRIORITY_COLORS,
  STATUS_COLORS,
  STATUS_LABELS,
  PRIORITY_LABELS,
} from '@/lib/utils';
import { useUpdateTask, useDeleteTask } from '@/hooks/useTasks';
import { Calendar, Paperclip, Pencil, Trash2, CheckCircle2, Clock } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onView: (task: Task) => void;
}

export default function TaskCard({ task, onEdit, onView }: TaskCardProps) {
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleToggleDone = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    updateTask.mutate({ id: task.id, status: newStatus });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) {
      deleteTask.mutate(task.id);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  const overdue = isOverdue(task.due_date) && task.status !== 'done';

  return (
    <div
      className={cn(
        'group relative bg-white dark:bg-slate-800 rounded-xl border transition-all duration-200 cursor-pointer hover:shadow-md hover:-translate-y-0.5',
        task.status === 'done'
          ? 'border-slate-200 dark:border-slate-700 opacity-75'
          : overdue
          ? 'border-red-300 dark:border-red-800'
          : 'border-slate-200 dark:border-slate-700'
      )}
      onClick={() => onView(task)}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <button
              onClick={handleToggleDone}
              className={cn(
                'mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                task.status === 'done'
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : 'border-slate-300 dark:border-slate-600 hover:border-primary-500'
              )}
              aria-label={task.status === 'done' ? 'Mark incomplete' : 'Mark complete'}
            >
              {task.status === 'done' && <CheckCircle2 className="w-3 h-3" />}
            </button>

            <h3
              className={cn(
                'font-medium text-slate-900 dark:text-white leading-snug line-clamp-2',
                task.status === 'done' && 'line-through text-slate-400'
              )}
            >
              {task.title}
            </h3>
          </div>

          {/* Actions */}
          <div
            className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(task); }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950 transition-colors"
              aria-label="Edit task"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDelete}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                confirmDelete
                  ? 'text-red-600 bg-red-50 dark:bg-red-950'
                  : 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950'
              )}
              aria-label={confirmDelete ? 'Click again to confirm' : 'Delete task'}
              title={confirmDelete ? 'Click again to confirm delete' : 'Delete task'}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-3 ml-7">
            {task.description}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 ml-7">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={STATUS_COLORS[task.status]}>{STATUS_LABELS[task.status]}</Badge>
            <Badge className={PRIORITY_COLORS[task.priority]}>{PRIORITY_LABELS[task.priority]}</Badge>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0">
            {task.attachment_count !== undefined && task.attachment_count > 0 && (
              <span className="flex items-center gap-1">
                <Paperclip className="w-3 h-3" />
                {task.attachment_count}
              </span>
            )}
            {task.due_date && (
              <span
                className={cn(
                  'flex items-center gap-1',
                  overdue && 'text-red-500 font-medium'
                )}
              >
                {overdue ? <Clock className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                {formatDate(task.due_date)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
