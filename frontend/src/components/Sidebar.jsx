import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, Globe, KeyRound, Settings } from 'lucide-react';
import { cn } from '../lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/websites', label: 'My Websites', icon: Globe },
  { href: '/credentials', label: 'Credentials', icon: KeyRound },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const Sidebar = () => {
  return (
    <aside className="fixed top-0 left-0 h-full w-64 bg-white/5 backdrop-blur-xl border-r border-white/10 p-6 flex flex-col">
      <div className="flex items-center gap-2 mb-12">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
          AffiliateEngine
        </h1>
      </div>

      <div className="flex flex-col justify-between flex-grow">
        <nav className="flex flex-col gap-2">
          <NavLink
            to="/create-campaign"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-white font-semibold transition-colors',
                'bg-gradient-to-r from-blue-500 to-purple-600 hover:opacity-90',
                isActive && 'ring-2 ring-purple-400'
              )
            }
          >
            <PlusCircle size={20} />
            <span>Create New Campaign</span>
          </NavLink>

          <div className="h-px bg-white/10 my-4"></div>

          {navItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg text-slate-200 hover:bg-white/10 hover:text-white transition-all',
                  isActive && 'bg-white/10 text-white border-l-4 border-purple-500 pl-3'
                )
              }
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User Profile Section can go here */}
      </div>
    </aside>
  );
};

export default Sidebar;
