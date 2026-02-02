import { useEffect } from 'react';
import { TaskGraph } from '../components/graph/TaskGraph';
import { FilterBar } from '../components/graph/FilterBar';
import { DetailSidebar } from '../components/graph/DetailSidebar';
import { GlobalModal } from '../components/graph/GlobalModal';
import { useTaskStore } from '../stores/taskStore';

export const GraphPage = () => {
  const { selectedTaskId, fetchTasks, isLoading, error } = useTaskStore();

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
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <TaskGraph />
        </div>
        {selectedTaskId && <DetailSidebar />}
      </div>
      <GlobalModal />
    </div>
  );
};
