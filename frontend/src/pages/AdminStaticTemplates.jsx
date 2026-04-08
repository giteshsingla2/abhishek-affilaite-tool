import React, { useState, useEffect, useCallback } from 'react';
import axios from '../lib/axiosInstance';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Save, Trash2, Edit, X, Loader, Image as ImageIcon, FileCode } from 'lucide-react';

const AdminStaticTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const fetchTemplates = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/static-templates', {
        headers: { 'x-auth-token': token },
      });
      setTemplates(response.data);
    } catch (err) {
      setError('Failed to fetch templates.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const openModal = async (template = null) => {
    if (template) {
      // Fetch full template with htmlContent when editing
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`/api/static-templates/${template._id}`, {
          headers: { 'x-auth-token': token },
        });
        setSelectedTemplate(res.data);
      } catch (err) {
        console.error('Failed to fetch full template');
        setSelectedTemplate(template);
      }
    } else {
      setSelectedTemplate(null);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedTemplate(null);
  };

  const handleFormSubmit = async (formData) => {
    const token = localStorage.getItem('token');
    const config = { headers: { 'x-auth-token': token } };
    try {
      if (selectedTemplate && selectedTemplate._id) {
        await axios.put(`/api/static-templates/${selectedTemplate._id}`, formData, config);
      } else {
        await axios.post('/api/static-templates', formData, config);
      }
      fetchTemplates();
      closeModal();
    } catch (err) {
      console.error('Failed to save template', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    setIsDeleting(id);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/static-templates/${id}`, { headers: { 'x-auth-token': token } });
      setTemplates(templates.filter(t => t._id !== id));
    } catch (err) {
      console.error('Failed to delete template', err);
      setError('Failed to delete template.');
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="p-6 min-h-screen text-white">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Static Templates</h1>
          <p className="text-gray-400 mt-1">High-conversion fixed layouts with AI content injection</p>
        </div>
        <button onClick={() => openModal()} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow-lg shadow-blue-500/20">
          <Plus size={20} />
          <span>Add New Template</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64"><Loader className="animate-spin text-blue-400" size={32}/></div>
      ) : error ? (
        <div className="text-red-400 bg-red-500/20 p-4 rounded-lg">{error}</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-20 bg-white/5 rounded-2xl border border-dashed border-white/10 text-gray-500">
           No static templates found. Create your first one!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {templates.map(template => (
            <motion.div key={template._id} layout className="bg-white/5 border border-white/10 rounded-xl overflow-hidden flex flex-col group hover:border-blue-500/50 transition-all duration-300 shadow-xl">
              {template.thumbnailUrl ? (
                <img src={template.thumbnailUrl} alt={template.name} className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                    <FileCode className="text-gray-600" size={48} />
                </div>
              )}
              <div className="p-4 flex-grow flex flex-col">
                <div className="flex justify-between items-start mb-2">
                   <h3 className="font-bold text-white text-lg line-clamp-1">{template.name}</h3>
                   <span className="bg-blue-500/20 text-blue-300 text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-blue-500/30">
                      {template.category}
                   </span>
                </div>
                <p className="text-gray-500 text-xs mb-4">
                   Added: {new Date(template.createdAt).toLocaleDateString()}
                </p>
                
                <div className="flex justify-end items-center gap-2 mt-auto pt-4 border-t border-white/5">
                  <button onClick={() => openModal(template)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/10"><Edit size={16}/></button>
                  <button 
                    onClick={() => handleDelete(template._id)} 
                    disabled={isDeleting === template._id}
                    className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors border border-red-500/10 disabled:opacity-50">
                      {isDeleting === template._id ? <Loader className="animate-spin" size={16}/> : <Trash2 size={16}/>}
                    </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {isModalOpen && <StaticTemplateModal template={selectedTemplate} onClose={closeModal} onSubmit={handleFormSubmit} />}
      </AnimatePresence>
    </div>
  );
};

const StaticTemplateModal = ({ template, onClose, onSubmit }) => {
    const [formData, setFormData] = useState({
        name: template?.name || '',
        category: template?.category || '',
        thumbnailUrl: template?.thumbnailUrl || '',
        jsonPrompt: template?.jsonPrompt || '',
        htmlContent: template?.htmlContent || '',
        requiredCsvHeaders: template?.requiredCsvHeaders?.join(', ') || '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const submissionData = {
          ...formData,
          requiredCsvHeaders: formData.requiredCsvHeaders.split(',').map(h => h.trim()).filter(h => h),
        };
        await onSubmit(submissionData);
        setIsSubmitting(false);
    };

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4"
            onClick={onClose}
        >
            <motion.div 
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-5xl max-h-[90vh] shadow-2xl flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-6 border-b border-white/10 shrink-0">
                    <h2 className="text-2xl font-bold text-white">{template ? 'Edit Static Template' : 'Create Static Template'}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10"><X size={20} className="text-gray-400"/></button>
                </div>
                
                <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Template Name</label>
                            <input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
                            <select name="category" value={formData.category} onChange={handleChange} required className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="" disabled className="bg-gray-900">Select Category</option>
                                <option value="review" className="bg-gray-900">Review</option>
                                <option value="listicle" className="bg-gray-900">Listicle</option>
                                <option value="vsl" className="bg-gray-900">VSL</option>
                                <option value="comparison" className="bg-gray-900">Comparison</option>
                                <option value="advertorial" className="bg-gray-900">Advertorial</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">Thumbnail URL</label>
                          <input type="text" name="thumbnailUrl" value={formData.thumbnailUrl} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">Required CSV Headers</label>
                          <input type="text" name="requiredCsvHeaders" value={formData.requiredCsvHeaders} onChange={handleChange} placeholder="e.g. name, description, affiliate_url, price_1" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          <p className="text-[10px] text-gray-500 mt-1 italic">Comma separated headers for dynamic mapping</p>
                      </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">AI JSON Prompt (Hydrates with CSV values)</label>
                        <textarea 
                          name="jsonPrompt" 
                          value={formData.jsonPrompt} 
                          onChange={handleChange} 
                          required 
                          rows="15" 
                          placeholder="Tell AI what JSON structure to return. Use {{csv_column}} for placeholders."
                          className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        ></textarea>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Full HTML Template (Hydrates with JSON & CSV values)</label>
                        <textarea 
                          name="htmlContent" 
                          value={formData.htmlContent} 
                          onChange={handleChange} 
                          required 
                          rows="20" 
                          placeholder="Paste full HTML code. Use {{slot_key}} for both CSV and JSON placeholders."
                          className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        ></textarea>
                    </div>

                    <div className="flex justify-end pt-4 pb-2">
                        <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:translate-y-0 active:scale-95">
                            {isSubmitting ? <Loader className="animate-spin" size={20}/> : <Save size={20} />}
                            <span>{isSubmitting ? 'Saving...' : 'Save Static Template'}</span>
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
};

export default AdminStaticTemplates;
