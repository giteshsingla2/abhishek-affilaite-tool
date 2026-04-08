import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Globe, KeyRound, Globe2, FileText, Loader,
  ExternalLink, CheckCircle, XCircle, Clock, Server, User,
  Shield, BarChart2
} from 'lucide-react';

const StatCard = ({ icon: Icon, label, value, color = 'purple' }) => {
  const colorMap = {
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/20',
    green: 'bg-green-500/20 text-green-400 border-green-500/20',
    red: 'bg-red-500/20 text-red-400 border-red-500/20',
    yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
    cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/20',
  };
  return (
    <div className={`p-4 rounded-xl border ${colorMap[color]} flex items-center gap-4`}>
      <div className="p-2 rounded-lg bg-white/5">
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const config = {
    Live: 'bg-green-500/20 text-green-400 border-green-500/30',
    Pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    Failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${config[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5"></span>
      {status}
    </span>
  );
};

const SectionCard = ({ title, icon: Icon, children, count }) => (
  <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
    <div className="flex items-center justify-between p-4 border-b border-white/10">
      <div className="flex items-center gap-2 text-white font-semibold">
        <Icon size={18} className="text-purple-400" />
        {title}
      </div>
      {count !== undefined && (
        <span className="bg-purple-500/20 text-purple-300 text-xs font-bold px-2 py-1 rounded-full">
          {count}
        </span>
      )}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const AdminUserOverview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/admin/users/${id}/overview`, {
        headers: { 'x-auth-token': token },
      });
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to load user data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="animate-spin text-purple-400" size={40} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-red-400 text-lg">{error}</p>
        <button onClick={() => navigate('/admin/users')} className="flex items-center gap-2 text-purple-400 hover:underline">
          <ArrowLeft size={16} /> Back to Users
        </button>
      </div>
    );
  }

  const { user, stats, credentials, domains, websites, staticWebsites } = data;

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'websites', label: `Websites (${websites.length})` },
    { key: 'static', label: `Static Sites (${staticWebsites.length})` },
    { key: 'credentials', label: `Credentials (${credentials.length})` },
    { key: 'domains', label: `Domains (${domains.length})` },
  ];

  return (
    <div className="min-h-screen p-6 text-white">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/admin/users')}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-bold">User Overview</h1>
            <p className="text-gray-400 text-sm mt-1">Viewing data for {user.email}</p>
          </div>
        </motion.div>

        {/* User Info Banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6 flex items-center justify-between flex-wrap gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
              {user.role === 'superadmin'
                ? <Shield size={24} className="text-yellow-400" />
                : user.role === 'admin'
                ? <Shield size={24} className="text-purple-400" />
                : <User size={24} className="text-blue-400" />}
            </div>
            <div>
              <p className="text-lg font-bold text-white">{user.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                  user.role === 'superadmin'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : user.role === 'admin'
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {user.role}
                </span>
                <span className="text-gray-500 text-xs">
                  Joined {new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6 text-center">
            <div>
              <p className="text-2xl font-bold text-white">{stats.totalWebsites + stats.totalStaticWebsites}</p>
              <p className="text-xs text-gray-400">Total Sites</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-400">{stats.totalWebsitesLive + stats.totalStaticLive}</p>
              <p className="text-xs text-gray-400">Live</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-400">{stats.totalCredentials}</p>
              <p className="text-xs text-gray-400">Credentials</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-cyan-400">{stats.totalDomains}</p>
              <p className="text-xs text-gray-400">Domains</p>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                activeTab === tab.key
                  ? 'bg-purple-600 border-purple-500 text-white'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <StatCard icon={Globe} label="Websites Live" value={stats.totalWebsitesLive} color="green" />
            <StatCard icon={XCircle} label="Websites Failed" value={stats.totalWebsitesFailed} color="red" />
            <StatCard icon={Clock} label="Websites Pending" value={stats.totalWebsitesPending} color="yellow" />
            <StatCard icon={BarChart2} label="Total Websites" value={stats.totalWebsites} color="purple" />
            <StatCard icon={FileText} label="Static Sites Live" value={stats.totalStaticLive} color="green" />
            <StatCard icon={XCircle} label="Static Sites Failed" value={stats.totalStaticFailed} color="red" />
            <StatCard icon={Clock} label="Static Sites Pending" value={stats.totalStaticPending} color="yellow" />
            <StatCard icon={BarChart2} label="Total Static Sites" value={stats.totalStaticWebsites} color="blue" />
            <StatCard icon={KeyRound} label="Saved Credentials" value={stats.totalCredentials} color="cyan" />
            <StatCard icon={Globe2} label="Custom Domains" value={stats.totalDomains} color="purple" />
          </motion.div>
        )}

        {/* WEBSITES TAB */}
        {activeTab === 'websites' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <SectionCard title="AI Websites" icon={Globe} count={websites.length}>
              {websites.length === 0 ? (
                <p className="text-gray-500 text-center py-6">No websites found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-400">
                        <th className="text-left py-3 px-2">Product</th>
                        <th className="text-left py-3 px-2">Platform</th>
                        <th className="text-left py-3 px-2">Domain</th>
                        <th className="text-left py-3 px-2">Status</th>
                        <th className="text-left py-3 px-2">Created</th>
                        <th className="text-left py-3 px-2">URL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {websites.map(site => (
                        <tr key={site._id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-3 px-2 text-white font-medium">{site.productName}</td>
                          <td className="py-3 px-2 text-gray-400 capitalize">{site.platform?.replace(/_/g, ' ')}</td>
                          <td className="py-3 px-2 text-gray-400">{site.subdomain || '-'}</td>
                          <td className="py-3 px-2"><StatusBadge status={site.status} /></td>
                          <td className="py-3 px-2 text-gray-500 text-xs">{new Date(site.createdAt).toLocaleDateString()}</td>
                          <td className="py-3 px-2">
                            {site.url ? (
                              <a href={site.url} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 flex items-center gap-1">
                                <ExternalLink size={12} /> View
                              </a>
                            ) : <span className="text-gray-600">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </motion.div>
        )}

        {/* STATIC WEBSITES TAB */}
        {activeTab === 'static' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <SectionCard title="Static Websites" icon={FileText} count={staticWebsites.length}>
              {staticWebsites.length === 0 ? (
                <p className="text-gray-500 text-center py-6">No static websites found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-400">
                        <th className="text-left py-3 px-2">Product</th>
                        <th className="text-left py-3 px-2">Platform</th>
                        <th className="text-left py-3 px-2">Domain</th>
                        <th className="text-left py-3 px-2">Status</th>
                        <th className="text-left py-3 px-2">Created</th>
                        <th className="text-left py-3 px-2">URL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staticWebsites.map(site => (
                        <tr key={site._id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-3 px-2 text-white font-medium">{site.productName}</td>
                          <td className="py-3 px-2 text-gray-400 capitalize">{site.platform?.replace(/_/g, ' ')}</td>
                          <td className="py-3 px-2 text-gray-400">{site.subdomain || '-'}</td>
                          <td className="py-3 px-2"><StatusBadge status={site.status} /></td>
                          <td className="py-3 px-2 text-gray-500 text-xs">{new Date(site.createdAt).toLocaleDateString()}</td>
                          <td className="py-3 px-2">
                            {site.url ? (
                              <a href={site.url} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 flex items-center gap-1">
                                <ExternalLink size={12} /> View
                              </a>
                            ) : <span className="text-gray-600">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </motion.div>
        )}

        {/* CREDENTIALS TAB */}
        {activeTab === 'credentials' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <SectionCard title="Saved Credentials" icon={KeyRound} count={credentials.length}>
              {credentials.length === 0 ? (
                <p className="text-gray-500 text-center py-6">No credentials saved.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {credentials.map(cred => (
                    <div key={cred._id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-white/5 rounded-lg">
                          <Server size={16} className="text-orange-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-white">{cred.name}</p>
                          <p className="text-xs text-gray-400 capitalize">{cred.platform?.replace(/_/g, ' ').toUpperCase()}</p>
                        </div>
                      </div>
                      {cred.region && (
                        <p className="text-xs text-gray-500 mt-1">Region: {cred.region}</p>
                      )}
                      {cred.cdnUrl && (
                        <p className="text-xs text-gray-500 mt-1 truncate">CDN: {cred.cdnUrl}</p>
                      )}
                      <p className="text-xs text-gray-600 mt-2">Added {new Date(cred.createdAt).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </motion.div>
        )}

        {/* DOMAINS TAB */}
        {activeTab === 'domains' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <SectionCard title="Custom Domains" icon={Globe2} count={domains.length}>
              {domains.length === 0 ? (
                <p className="text-gray-500 text-center py-6">No custom domains added.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {domains.map(domain => (
                    <div key={domain._id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                      <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                        <Globe2 size={16} className="text-cyan-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-white">{domain.domain}</p>
                        <p className="text-xs text-gray-500">Added {new Date(domain.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </motion.div>
        )}

      </div>
    </div>
  );
};

export default AdminUserOverview;
