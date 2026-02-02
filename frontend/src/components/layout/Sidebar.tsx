import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Network,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '../../stores/authStore';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: string;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: '대시보드', path: '/' },
  { icon: Network, label: '업무 그래프', path: '/graph' },
];

export const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = location.pathname === item.path;
    const Icon = item.icon;

    return (
      <button
        onClick={() => navigate(item.path)}
        className={clsx(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
          'hover:bg-sidebar-hover group',
          isActive && 'bg-sidebar-hover text-[#7952B3]',
          !isActive && 'text-gray-400'
        )}
      >
        <Icon
          size={20}
          className={clsx(
            'flex-shrink-0 transition-colors',
            isActive ? 'text-[#7952B3]' : 'text-gray-400 group-hover:text-gray-200'
          )}
        />
        {!collapsed && (
          <span
            className={clsx(
              'flex-1 text-left text-sm font-medium transition-colors',
              isActive ? 'text-white' : 'group-hover:text-gray-200'
            )}
          >
            {item.label}
          </span>
        )}
        {!collapsed && item.badge && (
          <span className="px-2 py-0.5 text-xs bg-[#7952B3]/20 text-[#7952B3] rounded-full">
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <aside
      className={clsx(
        'h-screen bg-sidebar-bg flex flex-col transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-gray-800">
        <div className={clsx('flex items-center gap-3', collapsed && 'justify-center w-full')}>
          <div className="w-8 h-8 bg-[#7952B3] rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">PI</span>
          </div>
          {!collapsed && (
            <span className="text-white font-semibold text-sm">PI Management</span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {/* Main Navigation */}
        <div className="space-y-1">
          {navItems.map((item) => (
            <NavLink key={item.path} item={item} />
          ))}
        </div>
      </nav>

      {/* User Section */}
      <div className="p-3 border-t border-gray-800">
        {!collapsed ? (
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 bg-[#7952B3] rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {user?.name?.charAt(0) || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.organization}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="로그아웃"
            >
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="로그아웃"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="p-3 flex items-center justify-center text-gray-400 hover:text-white border-t border-gray-800 transition-colors"
      >
        {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>
    </aside>
  );
};
