import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

const StatsCard = ({ icon: Icon, label, value, children, className }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={cn(
        'relative p-6 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden',
        className
      )}
    >
      <div className="absolute top-4 right-4 text-white/30">
        <Icon size={28} />
      </div>
      <p className="text-sm text-slate-400 mb-1">{label}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
      {children}
    </motion.div>
  );
};

export default StatsCard;
