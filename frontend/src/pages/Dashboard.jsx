import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Globe, Rocket, Database, Zap, RefreshCw, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StatsCard from '../components/StatsCard';
import { formatDistanceToNow } from 'date-fns';

const StatusBadge = ({ status }) => {
  const baseClasses = 'px-2 py-1 text-xs font-semibold rounded-full border';
  let colorClasses = '';

  switch (status) {
    case 'Live':
      colorClasses = 'bg-green-500/20 text-green-300 border-green-500/30';
      break;
    case 'Pending':
      colorClasses = 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      break;
    case 'Failed':
      colorClasses = 'bg-red-500/20 text-red-300 border-red-500/30';
      break;
    default:
      colorClasses = 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  }

  return <span className={`${baseClasses} ${colorClasses}`}>{status}</span>;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalWebsitesLive: 0, totalDeployments: 0, storageUsed: '0%', creditsRemaining: '0' });
  const [recentWebsites, setRecentWebsites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { 'x-auth-token': token } };

      const [statsRes, websitesRes] = await Promise.all([
        axios.get('/api/dashboard/stats', config),
        axios.get('/api/websites', config),
      ]);

      setStats(statsRes.data);
      setRecentWebsites(websitesRes.data.slice(0, 5)); // Get latest 5
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to fetch dashboard data');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div>
      <header className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-4xl font-bold text-white">Welcome Back!</h1>
          <p className="text-slate-400 mt-2">Here's a snapshot of your affiliate empire.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white font-bold py-2 px-4 rounded-lg transition duration-300 disabled:opacity-50 border border-white/10"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white font-bold py-2 px-4 rounded-lg transition duration-300 border border-white/10"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {error && <p className="text-red-400 mb-4">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard icon={Globe} label="Total Websites Live" value={stats.totalWebsitesLive} />
        <StatsCard icon={Rocket} label="Total Deployments" value={stats.totalDeployments} />
        <StatsCard icon={Database} label="Storage Used" value={stats.storageUsed}>
          <div className="w-full bg-slate-700 rounded-full h-2.5 mt-2">
            <div className="bg-purple-600 h-2.5 rounded-full" style={{ width: stats.storageUsed }}></div>
          </div>
        </StatsCard>
        <StatsCard icon={Zap} label="Credits Remaining" value={stats.creditsRemaining} className="text-yellow-300" />
      </div>

      <div className="mt-10">
        <h2 className="text-2xl font-bold text-white mb-4">Recent Activity</h2>
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4">
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10">
                <tr>
                  <th className="text-left p-4 font-semibold text-white/90">Project Name</th>
                  <th className="text-left p-4 font-semibold text-white/90">Status</th>
                  <th className="text-left p-4 font-semibold text-white/90">Last Updated</th>
                  <th className="text-left p-4 font-semibold text-white/90">URL</th>
                </tr>
              </thead>
              <tbody>
                {recentWebsites.map((site) => (
                  <tr key={site._id} className="border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors">
                    <td className="p-4 text-slate-200">{site.productName}</td>
                    <td className="p-4">
                      <StatusBadge status={site.status} />
                    </td>
                    <td className="p-4 text-slate-400">{formatDistanceToNow(new Date(site.createdAt))} ago</td>
                    <td className="p-4">
                      {site.url ? (
                        <a href={site.url} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">
                          View Site
                        </a>
                      ) : (
                        <span className="text-slate-500">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && recentWebsites.length === 0 && (
              <div className="text-center p-8 text-slate-500">No recent activity.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
