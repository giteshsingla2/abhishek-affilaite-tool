import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, Trash2, Download, ChevronDown, ChevronUp, RefreshCw, Wand2, Layout } from 'lucide-react';
import axios from 'axios';
import CampaignStatus from '../components/CampaignStatus';

const GlassCard = ({ children, className = '' }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`backdrop-blur-xl bg-white/5 rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.12)] transition-all duration-300 ${className}`}
  >
    {children}
  </motion.div>
);

const StatusBadge = ({ status }) => {
  const config = {
    completed:  { bg: 'bg-green-500/20',  text: 'text-green-400',  border: 'border-green-500/30'  },
    processing: { bg: 'bg-blue-500/20',   text: 'text-blue-400',   border: 'border-blue-500/30'   },
    queuing:    { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
    pending:    { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    failed:     { bg: 'bg-red-500/20',    text: 'text-red-400',    border: 'border-red-500/30'    },
  };
  const c = config[status] || config.pending;
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-2 h-2 rounded-full bg-current mr-2 ${['processing','queuing','pending'].includes(status) ? 'animate-pulse' : ''}`}></span>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const ProgressBar = ({ completed, failed, total }) => {
  if (!total) return <span className="text-gray-500 text-xs">—</span>;
  const completedPct = Math.round((completed / total) * 100);
  const failedPct    = Math.round((failed    / total) * 100);
  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="flex-1 bg-white/10 rounded-full h-2 overflow-hidden">
        <div className="h-full flex">
          <div className="bg-green-500 transition-all duration-500" style={{ width: `${completedPct}%` }} />
          <div className="bg-red-500   transition-all duration-500" style={{ width: `${failedPct}%`    }} />
        </div>
      </div>
      <span className="text-xs text-gray-400 whitespace-nowrap">{completed + failed}/{total}</span>
    </div>
  );
};

const Campaigns = () => {
  const [campaigns, setCampaigns]         = useState([]);
  const [loading, setLoading]             = useState(true);
  const [searchInput, setSearchInput]     = useState('');
  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState('');
  const [typeFilter, setTypeFilter]       = useState('');
  const [pagination, setPagination]       = useState({ total: 0, page: 1, pages: 1, limit: 20 });
  const [currentPage, setCurrentPage]     = useState(1);
  const [expandedId, setExpandedId]       = useState(null);
  const [deletingId, setDeletingId]       = useState(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setCurrentPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const token  = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: currentPage,
        limit: 20,
        ...(statusFilter && { status: statusFilter }),
        ...(typeFilter   && { type:   typeFilter   }),
      });
      const res = await axios.get(`/api/campaigns-list?${params}`, {
        headers: { 'x-auth-token': token },
      });
      // Client-side filter for name search (names aren't indexed for regex on server)
      let rows = res.data.campaigns || [];
      if (search.trim()) {
        const term = search.toLowerCase();
        rows = rows.filter(c => c.name.toLowerCase().includes(term));
      }
      setCampaigns(rows);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error('Failed to fetch campaigns', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, typeFilter, search]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  // Auto-refresh every 8s if any campaign is still running
  useEffect(() => {
    const hasActive = campaigns.some(c => ['pending','queuing','processing'].includes(c.status));
    if (!hasActive) return;
    const interval = setInterval(fetchCampaigns, 8000);
    return () => clearInterval(interval);
  }, [campaigns, fetchCampaigns]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this campaign record? This does not remove deployed websites.')) return;
    setDeletingId(id);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/campaigns-list/${id}`, { headers: { 'x-auth-token': token } });
      setCampaigns(prev => prev.filter(c => c._id !== id));
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed to delete campaign');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadFailedRows = (id) => {
    window.open(`/api/campaign-upload/${id}/failed-rows`, '_blank');
  };

  const toggleExpand = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const formatDate = (iso) => new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Campaigns</h1>
            <p className="text-gray-400">Track all your bulk deployment campaigns and their progress</p>
          </div>
          <button
            onClick={fetchCampaigns}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </motion.div>

        {/* Filters */}
        <GlassCard className="mb-6 p-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by campaign name..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500/50 transition-all"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500/50 transition-all"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="queuing">Queuing</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <select
              value={typeFilter}
              onChange={e => { setTypeFilter(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500/50 transition-all"
            >
              <option value="">All types</option>
              <option value="ai">Auto AI</option>
              <option value="static">Templatic</option>
            </select>
          </div>
        </GlassCard>

        {/* Table */}
        <GlassCard className="overflow-hidden">
          {loading && campaigns.length === 0 ? (
            <div className="flex justify-center items-center py-20">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <p className="mb-1">No campaigns found</p>
              <p className="text-sm">Start a campaign from the Create Campaign page</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-4 text-gray-400 font-medium text-sm">Campaign</th>
                    <th className="text-left p-4 text-gray-400 font-medium text-sm">Type</th>
                    <th className="text-left p-4 text-gray-400 font-medium text-sm">Status</th>
                    <th className="text-left p-4 text-gray-400 font-medium text-sm">Progress</th>
                    <th className="text-left p-4 text-gray-400 font-medium text-sm">Results</th>
                    <th className="text-left p-4 text-gray-400 font-medium text-sm">Created</th>
                    <th className="text-right p-4 text-gray-400 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((campaign, index) => (
                    <React.Fragment key={campaign._id}>
                      <motion.tr
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x:  0  }}
                        transition={{ delay: index * 0.04 }}
                        className={`border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${expandedId === campaign._id ? 'bg-white/5' : ''}`}
                        onClick={() => toggleExpand(campaign._id)}
                      >
                        {/* Name + platform */}
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {expandedId === campaign._id
                              ? <ChevronUp size={14} className="text-gray-400 flex-shrink-0" />
                              : <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
                            }
                            <div>
                              <p className="text-white font-medium">{campaign.name}</p>
                              <p className="text-gray-500 text-xs capitalize mt-0.5">{campaign.platform?.replace(/_/g, ' ')}</p>
                            </div>
                          </div>
                        </td>

                        {/* Type badge */}
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                            campaign.campaignType === 'static'
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                              : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                          }`}>
                            {campaign.campaignType === 'static'
                              ? <Layout size={11} />
                              : <Wand2 size={11} />
                            }
                            {campaign.campaignType === 'static' ? 'Templatic' : 'Auto AI'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="p-4" onClick={e => e.stopPropagation()}>
                          <StatusBadge status={campaign.status} />
                        </td>

                        {/* Progress bar */}
                        <td className="p-4">
                          <ProgressBar
                            completed={campaign.completedJobs}
                            failed={campaign.failedJobs}
                            total={campaign.totalJobs}
                          />
                        </td>

                        {/* Result counts */}
                        <td className="p-4">
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-green-400 font-medium">{campaign.completedJobs} live</span>
                            {campaign.failedJobs > 0 && (
                              <span className="text-red-400 font-medium">{campaign.failedJobs} failed</span>
                            )}
                          </div>
                        </td>

                        {/* Date */}
                        <td className="p-4">
                          <span className="text-gray-400 text-sm">{formatDate(campaign.createdAt)}</span>
                        </td>

                        {/* Actions */}
                        <td className="p-4" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            {campaign.failedJobs > 0 && campaign.status === 'completed' && (
                              <button
                                onClick={() => handleDownloadFailedRows(campaign._id)}
                                title="Download failed rows CSV"
                                className="p-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg border border-yellow-500/20 transition-all"
                              >
                                <Download size={14} />
                              </button>
                            )}
                            {['completed', 'failed'].includes(campaign.status) && (
                              <button
                                onClick={() => handleDelete(campaign._id)}
                                disabled={deletingId === campaign._id}
                                className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20 transition-all disabled:opacity-50"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>

                      {/* Expanded row — live CampaignStatus for active, summary for finished */}
                      {expandedId === campaign._id && (
                        <tr className="border-b border-white/5">
                          <td colSpan={7} className="px-6 py-4 bg-white/3">
                            {['pending', 'queuing', 'processing'].includes(campaign.status) ? (
                              <CampaignStatus
                                campaignId={campaign._id}
                                onComplete={() => fetchCampaigns()}
                              />
                            ) : (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div className="bg-white/5 rounded-xl p-3 text-center border border-white/10">
                                  <p className="text-xl font-bold text-white">{campaign.totalJobs}</p>
                                  <p className="text-xs text-gray-400 mt-1">Total sites</p>
                                </div>
                                <div className="bg-green-500/10 rounded-xl p-3 text-center border border-green-500/20">
                                  <p className="text-xl font-bold text-green-400">{campaign.completedJobs}</p>
                                  <p className="text-xs text-gray-400 mt-1">Live</p>
                                </div>
                                <div className="bg-red-500/10 rounded-xl p-3 text-center border border-red-500/20">
                                  <p className="text-xl font-bold text-red-400">{campaign.failedJobs}</p>
                                  <p className="text-xs text-gray-400 mt-1">Failed</p>
                                </div>
                                <div className="bg-blue-500/10 rounded-xl p-3 text-center border border-blue-500/20">
                                  <p className="text-xl font-bold text-blue-400 capitalize">{campaign.platform?.replace(/_/g, ' ')}</p>
                                  <p className="text-xs text-gray-400 mt-1">Platform</p>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
                  <p className="text-sm text-gray-400">
                    Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setCurrentPage(1)} disabled={pagination.page === 1} className="px-2 py-1 rounded text-sm text-gray-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">«</button>
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={pagination.page === 1} className="px-3 py-1 rounded text-sm text-gray-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Prev</button>
                    {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                      const start = Math.max(1, Math.min(pagination.page - 2, pagination.pages - 4));
                      const pageNum = start + i;
                      return (
                        <button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`px-3 py-1 rounded text-sm transition-colors ${pageNum === pagination.page ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-white/10'}`}>{pageNum}</button>
                      );
                    })}
                    <button onClick={() => setCurrentPage(p => Math.min(pagination.pages, p + 1))} disabled={pagination.page === pagination.pages} className="px-3 py-1 rounded text-sm text-gray-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next</button>
                    <button onClick={() => setCurrentPage(pagination.pages)} disabled={pagination.page === pagination.pages} className="px-2 py-1 rounded text-sm text-gray-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">»</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
};

export default Campaigns;
