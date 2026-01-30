import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Save, Trash2, Edit, X, Loader, Image as ImageIcon } from 'lucide-react';

const AdminTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(null); // stores ID of template being deleted
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const fetchTemplates = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/admin/templates', {
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

  const openModal = (template = null) => {
    setSelectedTemplate(template);
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
      if (selectedTemplate) {
        // Update
        await axios.put(`/api/admin/templates/${selectedTemplate._id}`, formData, config);
      } else {
        // Create
        await axios.post('/api/admin/templates', formData, config);
      }
      fetchTemplates(); // Refresh list
      closeModal();
    } catch (err) {
      console.error('Failed to save template', err);
      // You can set a form-specific error state here
    }
  };
  
  const handleDelete = async (id) => {
    setIsDeleting(id);
    try {
        const token = localStorage.getItem('token');
        await axios.delete(`/api/admin/templates/${id}`, { headers: { 'x-auth-token': token } });
        setTemplates(templates.filter(t => t._id !== id));
    } catch (err) {
        console.error('Failed to delete template', err);
        setError('Failed to delete template.');
    } finally {
        setIsDeleting(null);
    }
  };

  return (
    <div className="p-6 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Manage AI Templates</h1>
        <button onClick={() => openModal()} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
          <Plus size={20} />
          <span>Add New Template</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64"><Loader className="animate-spin text-purple-400" size={32}/></div>
      ) : error ? (
        <div className="text-red-400 bg-red-500/20 p-4 rounded-lg">{error}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {templates.map(template => (
            <motion.div key={template._id} layout className="bg-white/5 border border-white/10 rounded-xl overflow-hidden flex flex-col">
              {template.thumbnailUrl ? (
                <img src={template.thumbnailUrl} alt={template.name} className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 bg-white/5 flex items-center justify-center">
                    <ImageIcon className="text-gray-500" size={48} />
                </div>
              )}
              <div className="p-4 flex-grow flex flex-col">
                <h3 className="font-bold text-white text-lg mb-2 flex-grow">{template.name}</h3>
                {template.requiredCsvHeaders && template.requiredCsvHeaders.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {template.requiredCsvHeaders.map(header => (
                      <span key={header} className="bg-purple-500/20 text-purple-300 text-xs font-medium px-2 py-1 rounded-full">{header}</span>
                    ))}
                  </div>
                )}
                <div className="flex justify-end items-center gap-2 mt-4">
                  <button onClick={() => openModal(template)} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"><Edit size={16}/></button>
                  <button 
                    onClick={() => handleDelete(template._id)} 
                    disabled={isDeleting === template._id}
                    className="p-2 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors disabled:opacity-50">
                      {isDeleting === template._id ? <Loader className="animate-spin" size={16}/> : <Trash2 size={16}/>}
                    </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {isModalOpen && <TemplateModal template={selectedTemplate} onClose={closeModal} onSubmit={handleFormSubmit} />}
      </AnimatePresence>
    </div>
  );
};

const TemplateModal = ({ template, onClose, onSubmit }) => {
    const [formData, setFormData] = useState({
        name: template?.name || '',
        thumbnailUrl: template?.thumbnailUrl || '',
        systemPrompt: template?.systemPrompt || '',
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-gray-800 border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl relative"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-6 border-b border-white/10">
                    <h2 className="text-2xl font-bold text-white">{template ? 'Edit Template' : 'Create New Template'}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10"><X size={20} className="text-gray-400"/></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">Template Name</label>
                        <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    </div>
                    <div>
                        <label htmlFor="thumbnailUrl" className="block text-sm font-medium text-gray-300 mb-1">Thumbnail URL</label>
                        <input type="text" name="thumbnailUrl" id="thumbnailUrl" value={formData.thumbnailUrl} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    </div>
                    <div>
                        <label htmlFor="systemPrompt" className="block text-sm font-medium text-gray-300 mb-1">System Prompt</label>
                        <textarea name="systemPrompt" id="systemPrompt" value={formData.systemPrompt} onChange={handleChange} required rows="10" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"></textarea>
                    </div>
                    <div>
                        <label htmlFor="requiredCsvHeaders" className="block text-sm font-medium text-gray-300 mb-1">Required CSV Headers (comma-separated)</label>
                        <input type="text" name="requiredCsvHeaders" id="requiredCsvHeaders" value={formData.requiredCsvHeaders} onChange={handleChange} placeholder="e.g., name, price, description, affiliate_url" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    </div>
                    <div className="flex justify-end pt-4">
                        <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50">
                            {isSubmitting ? <Loader className="animate-spin" size={20}/> : <Save size={20} />}
                            <span>{isSubmitting ? 'Saving...' : 'Save Template'}</span>
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
};

export default AdminTemplates;
