import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, ExternalLink, Edit, Globe, Server, Trash2 } from 'lucide-react';
import axios from 'axios';

const GlassCard = ({ children, className = '' }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`
      backdrop-blur-xl bg-white/5 rounded-2xl border border-white/10 
      shadow-[0_8px_32px_rgba(0,0,0,0.12)] hover:shadow-[0_12px_48px_rgba(0,0,0,0.2)]
      transition-all duration-300 ${className}
    `}
  >
    {children}
  </motion.div>
);

const StatusBadge = ({ status }) => {
  const getStatusConfig = (status) => {
    switch (status) {
      case 'Live':
        return {
          bg: 'bg-green-500/20',
          text: 'text-green-400',
          border: 'border-green-500/30',
          glow: 'shadow-green-500/25'
        };
      case 'Pending':
        return {
          bg: 'bg-yellow-500/20',
          text: 'text-yellow-400',
          border: 'border-yellow-500/30',
          glow: 'shadow-yellow-500/25'
        };
      case 'Failed':
        return {
          bg: 'bg-red-500/20',
          text: 'text-red-400',
          border: 'border-red-500/30',
          glow: 'shadow-red-500/25'
        };
      default:
        return {
          bg: 'bg-gray-500/20',
          text: 'text-gray-400',
          border: 'border-gray-500/30',
          glow: 'shadow-gray-500/25'
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span className={`
      inline-flex items-center px-3 py-1 rounded-full text-xs font-medium
      ${config.bg} ${config.text} ${config.border} border
      shadow-lg ${config.glow}
    `}>
      <span className="w-2 h-2 rounded-full bg-current mr-2 animate-pulse"></span>
      {status}
    </span>
  );
};

const PlatformIcon = ({ platform }) => {
  switch (platform) {
    case 'aws_s3':
    case 'digital_ocean':
      return <Server className="w-5 h-5 text-orange-400" />;
    case 'netlify':
      return <Globe className="w-5 h-5 text-cyan-400" />;
    default:
      return <Server className="w-5 h-5 text-gray-400" />;
  }
};

const Websites = () => {
  const [websites, setWebsites] = useState([]);
  const [filteredWebsites, setFilteredWebsites] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWebsites();
  }, []);

  useEffect(() => {
    const lowerTerm = searchTerm.toLowerCase();
    const filtered = websites.filter(website => {
      const nameMatch = website.productName?.toLowerCase().includes(lowerTerm);
      const domainMatch = website.subdomain?.toLowerCase().includes(lowerTerm);
      return nameMatch || domainMatch;
    });
    setFilteredWebsites(filtered);
  }, [searchTerm, websites]);

  const handleDelete = async (websiteId) => {
    if (!window.confirm("Are you sure? This will delete the live website permanently.")) {
      return;
    }

    try {
      // Optimistic UI update
      const originalWebsites = [...websites];
      const originalFiltered = [...filteredWebsites];
      
      setWebsites(websites.filter(w => w._id !== websiteId));
      setFilteredWebsites(filteredWebsites.filter(w => w._id !== websiteId));

      const token = localStorage.getItem('token');
      await axios.delete(`/api/websites/${websiteId}`, {
        headers: { 'x-auth-token': token }
      });
    } catch (error) {
      console.error("Delete failed", error);
      alert("Failed to delete website from server.");
      fetchWebsites(); // Re-fetch on failure
    }
  };

  const fetchWebsites = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/websites', {
        headers: {
          'x-auth-token': token
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setWebsites(data);
        setFilteredWebsites(data);
      } else {
        console.error('Failed to fetch websites');
      }
    } catch (error) {
      console.error('Error fetching websites:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2">My Websites</h1>
          <p className="text-gray-400">Manage and edit your deployed websites</p>
        </motion.div>

        {/* Search Bar */}
        <GlassCard className="mb-6 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by product name or subdomain..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg 
                       text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500/50 
                       focus:bg-white/10 transition-all duration-200"
            />
          </div>
        </GlassCard>

        {/* Websites Table */}
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-gray-400 font-medium">Product</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Platform</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Status</th>
                  <th className="text-right p-4 text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWebsites.map((website, index) => (
                  <motion.tr
                    key={website._id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors duration-200"
                  >
                    <td className="p-4">
                      <div>
                        <div className="text-white font-medium">{website.productName}</div>
                        {website.subdomain && (
                          <div className="text-gray-400 text-sm">{website.subdomain}</div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <PlatformIcon platform={website.platform} />
                        <span className="text-gray-300 capitalize">
                          {website.platform?.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <StatusBadge status={website.status} />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        {website.status === 'Live' && website.url && (
                          <motion.a
                            href={website.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="p-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 
                                     rounded-lg transition-colors duration-200"
                            title="View Live Site"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </motion.a>
                        )}
                        <motion.a
                          href={`/edit-website/${website._id}`}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="p-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 
                                   rounded-lg transition-colors duration-200"
                          title="Edit Site"
                        >
                          <Edit className="w-4 h-4" />
                        </motion.a>
                        <motion.button
                          onClick={() => handleDelete(website._id)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 
                                   rounded-lg transition-colors duration-200"
                          title="Delete Website"
                        >
                          <Trash2 className="w-4 h-4" />
                        </motion.button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            
            {filteredWebsites.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-2">
                  {searchTerm ? 'No websites found matching your search' : 'No websites deployed yet'}
                </div>
                {!searchTerm && (
                  <div className="text-gray-500 text-sm">
                    Create your first campaign to deploy websites
                  </div>
                )}
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default Websites;
