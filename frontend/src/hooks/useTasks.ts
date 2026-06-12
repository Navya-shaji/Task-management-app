import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Task, TasksResponse, TaskFilters } from '@/types';
import toast from 'react-hot-toast';

export const TASKS_KEY = 'tasks';

export function useTasks(filters: TaskFilters = {}) {
  return useQuery<TasksResponse>({
    queryKey: [TASKS_KEY, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== '') params.append(k, String(v));
      });
      const res = await api.get(`/tasks?${params}`);
      return res.data;
    },
    staleTime: 30_000,
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: [TASKS_KEY, id],
    queryFn: async () => {
      const res = await api.get(`/tasks/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Task>) => {
      const res = await api.post('/tasks', data);
      return res.data.task as Task;
    },
    // Optimistic update
    onMutate: async (newTask) => {
      await queryClient.cancelQueries({ queryKey: [TASKS_KEY] });
      const previousData = queryClient.getQueriesData({ queryKey: [TASKS_KEY] });

      // Inject optimistic task
      const tempTask: Task = {
        id: `temp-${Date.now()}`,
        user_id: '',
        title: newTask.title || '',
        description: newTask.description,
        status: newTask.status || 'todo',
        priority: newTask.priority || 'medium',
        due_date: newTask.due_date,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      queryClient.setQueriesData({ queryKey: [TASKS_KEY] }, (old: TasksResponse | undefined) => {
        if (!old) return old;
        return {
          ...old,
          tasks: [tempTask, ...old.tasks],
          pagination: { ...old.pagination, total: old.pagination.total + 1 },
        };
      });

      return { previousData };
    },
    onError: (_err, _newTask, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }
      toast.error('Failed to create task');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_KEY] });
      toast.success('Task created');
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Task> & { id: string }) => {
      const res = await api.patch(`/tasks/${id}`, data);
      return res.data.task as Task;
    },
    // Optimistic update
    onMutate: async ({ id, ...updates }) => {
      await queryClient.cancelQueries({ queryKey: [TASKS_KEY] });
      const previousData = queryClient.getQueriesData({ queryKey: [TASKS_KEY] });

      queryClient.setQueriesData({ queryKey: [TASKS_KEY] }, (old: TasksResponse | undefined) => {
        if (!old) return old;
        return {
          ...old,
          tasks: old.tasks.map((t) =>
            t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t
          ),
        };
      });

      queryClient.setQueryData([TASKS_KEY, id], (old: any) => {
        if (!old) return old;
        return { ...old, task: { ...old.task, ...updates } };
      });

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([key, data]) => queryClient.setQueryData(key, data));
      }
      toast.error('Failed to update task');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_KEY] });
      toast.success('Task updated');
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tasks/${id}`);
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: [TASKS_KEY] });
      const previousData = queryClient.getQueriesData({ queryKey: [TASKS_KEY] });

      queryClient.setQueriesData({ queryKey: [TASKS_KEY] }, (old: TasksResponse | undefined) => {
        if (!old) return old;
        return {
          ...old,
          tasks: old.tasks.filter((t) => t.id !== id),
          pagination: { ...old.pagination, total: Math.max(0, old.pagination.total - 1) },
        };
      });

      return { previousData };
    },
    onError: (_err, _id, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([key, data]) => queryClient.setQueryData(key, data));
      }
      toast.error('Failed to delete task');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_KEY] });
      toast.success('Task deleted');
    },
  });
}
