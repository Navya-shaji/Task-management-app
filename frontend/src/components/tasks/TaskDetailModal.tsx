'use client';

import { useState, useRef } from 'react';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { useTask } from '@/hooks/useTasks';
import { Task, ActivityLog, Attachment } from '@/types';
import {
  formatDate,
  formatRelative,
  PRIORITY_COLORS,
  STATUS_COLORS,
  STATUS_LABELS,
  PRIORITY_LABELS,
} from '@/lib/utils';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { TASKS_KEY } from '@/hooks/useTasks';
import { Paperclip, Upload, Trash2, Clock, User, Activity } from 'lucide-react';

interface TaskDetailModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (task: Task) => void;
}

export default function TaskDetailModal({ task, isOpen, onClose, onEdit }: TaskDetailModalProps) {
  const { data, isLoading, refetch } = useTask(task.id);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'attachments' | 'activity'>('details');

  const attachments: Attachment[] = data?.attachments || [];
  const activity: ActivityLog[] = data?.activity || [];

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post(`/tasks/${task.id}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('File uploaded');
      refetch();
      queryClient.invalidateQueries({ queryKey: [TASKS_KEY] });
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      await api.delete(`/tasks/${task.id}/attachments/${attachmentId}`);
      toast.success('Attachment removed');
      refetch();
      queryClient.invalidateQueries({ queryKey: [TASKS_KEY] });
    } catch {
      toast.error('Failed to remove attachment');
    }
  };

  const tabs = [
    { id: 'details', label: 'Details' },
    { id: 'attachments', label: `Attachments (${attachments.length})` },
    { id: 'activity', label: `Activity (${activity.length})` },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <div className="flex flex-col gap-4">
        {/* Task Header */}
        <div>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white leading-snug">
              {task.title}
            </h2>
            <Button variant="outline" size="sm" onClick={() => onEdit(task)}>
              Edit
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Badge className={STATUS_COLORS[task.status]}>{STATUS_LABELS[task.status]}</Badge>
            <Badge className={PRIORITY_COLORS[task.priority]}>{PRIORITY_LABELS[task.priority]}</Badge>
            {task.due_date && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Due {formatDate(task.due_date)}
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 dark:border-slate-700">
          <div className="flex gap-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <>
            {activeTab === 'details' && (
              <div className="space-y-4">
                {task.description ? (
                  <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                    {task.description}
                  </p>
                ) : (
                  <p className="text-sm text-slate-400 italic">No description provided.</p>
                )}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Created</span>
                    <p className="text-slate-900 dark:text-white font-medium">{formatDate(task.created_at)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Updated</span>
                    <p className="text-slate-900 dark:text-white font-medium">{formatRelative(task.updated_at)}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'attachments' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Attach images, PDFs, or documents
                  </p>
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleUpload}
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      isLoading={uploading}
                    >
                      <Upload className="w-4 h-4" />
                      Upload
                    </Button>
                  </div>
                </div>

                {attachments.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No attachments yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Paperclip className="w-4 h-4 text-slate-400 shrink-0" />
                          <div className="min-w-0">
                            <a
                              href={`${process.env.NEXT_PUBLIC_API_URL}${att.url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-primary-600 hover:underline truncate block"
                            >
                              {att.original_name}
                            </a>
                            <p className="text-xs text-slate-400">
                              {(att.size / 1024).toFixed(1)} KB · {formatRelative(att.created_at)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {activity.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No activity yet</p>
                  </div>
                ) : (
                  activity.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 text-sm">
                      <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center shrink-0 mt-0.5">
                        <User className="w-3 h-3 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-slate-900 dark:text-white">
                          {log.user_name || 'Unknown'}
                        </span>{' '}
                        <span className="text-slate-500 dark:text-slate-400">
                          {log.action === 'created'
                            ? 'created this task'
                            : `changed ${log.field_name} from "${log.old_value}" to "${log.new_value}"`}
                        </span>
                        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatRelative(log.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
