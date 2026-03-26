import { useEffect } from 'react';
import { TaskGraph } from '../components/graph/TaskGraph';
import { FilterBar } from '../components/graph/FilterBar';
import { GlobalModal } from '../components/graph/GlobalModal';
import { useTaskStore } from '../stores/taskStore';

export const GraphPage = () => {
  const { fetchTasks, isLoading, error } = useTaskStore();

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <FilterBar />
      <div className="flex-1 overflow-hidden">
        <TaskGraph />
      </div>
      <GlobalModal />
    </div>
  );
};
