import { useState, useEffect, useCallback } from 'react';
import { api, type TaskInfo } from '../lib/api';

export const useTaskManager = () => {
  const [tasks, setTasks] = useState<TaskInfo[]>([]);

  const fetchTasks = useCallback(async () => {
    const res = await api.tasks.list();
    if (res.success && res.data) {
      setTasks(res.data.data);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const activeTasks = tasks.filter(t => t.status === 'pending' || t.status === 'running');
  const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'failed');

  return {
    tasks,
    activeTasks,
    completedTasks,
    refresh: fetchTasks
  };
};
