import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Toaster } from 'react-hot-toast';

export const MainLayout = () => {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1b1b1b',
            color: '#fff',
          },
          success: {
            iconTheme: {
              primary: '#25a35a',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#cc333e',
              secondary: '#fff',
            },
          },
        }}
      />
    </div>
  );
};
