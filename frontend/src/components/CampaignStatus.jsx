import React, { useState, useEffect, useCallback } from 'react';
import axios from '../lib/axiosInstance';
import { CheckCircle, XCircle, Loader, Download, AlertTriangle } from 'lucide-react';

const CampaignStatus = ({ campaignId, onComplete }) => {
    const [status, setStatus] = useState(null);
    const [error, setError] = useState('');

    const fetchStatus = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`/api/campaign-upload/${campaignId}/status`, {
                headers: { 'x-auth-token': token },
            });
            setStatus(res.data);

            if (res.data.isFinished) {
                if (onComplete) onComplete(res.data);
            }
        } catch (err) {
            setError('Failed to fetch campaign status');
        }
    }, [campaignId, onComplete]);

    useEffect(() => {
        if (!campaignId) return;

        fetchStatus();

        const interval = setInterval(() => {
            fetchStatus();
        }, 3000);

        return () => clearInterval(interval);
    }, [campaignId, fetchStatus]);

    // Stop polling when finished
    useEffect(() => {
        if (status?.isFinished) {
            // polling already stopped because we clear interval on unmount
            // but we need to stop it here too
        }
    }, [status]);

    // Restart polling with auto-stop
    useEffect(() => {
        if (!campaignId) return;

        let interval = null;

        const poll = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`/api/campaign-upload/${campaignId}/status`, {
                    headers: { 'x-auth-token': token },
                });
                setStatus(res.data);

                if (res.data.isFinished) {
                    clearInterval(interval);
                    if (onComplete) onComplete(res.data);
                }
            } catch (err) {
                setError('Failed to fetch campaign status');
                clearInterval(interval);
            }
        };

        poll(); // immediate first call
        interval = setInterval(poll, 3000);

        return () => clearInterval(interval);
    }, [campaignId]);

    const handleDownloadFailedRows = () => {
        const token = localStorage.getItem('token');
        window.open(`/api/campaign-upload/${campaignId}/failed-rows`, '_blank');
    };

    if (error) {
        return (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 flex items-center gap-2">
                <AlertTriangle size={18} />
                {error}
            </div>
        );
    }

    if (!status) {
        return (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 flex items-center justify-center gap-3 text-white">
                <Loader className="animate-spin text-purple-400" size={20} />
                <span>Loading campaign status...</span>
            </div>
        );
    }

    const getStatusColor = () => {
        switch (status.status) {
            case 'completed': return 'border-green-500/30 bg-green-500/5';
            case 'failed': return 'border-red-500/30 bg-red-500/5';
            case 'processing': return 'border-purple-500/30 bg-purple-500/5';
            case 'queuing': return 'border-blue-500/30 bg-blue-500/5';
            default: return 'border-white/10 bg-white/5';
        }
    };

    const getStatusIcon = () => {
        switch (status.status) {
            case 'completed': return <CheckCircle className="text-green-400" size={22} />;
            case 'failed': return <XCircle className="text-red-400" size={22} />;
            default: return <Loader className="animate-spin text-purple-400" size={22} />;
        }
    };

    const getStatusLabel = () => {
        switch (status.status) {
            case 'pending': return 'Waiting to start...';
            case 'queuing': return 'Reading CSV and queuing jobs...';
            case 'processing': return 'Generating and deploying websites...';
            case 'completed': return 'Campaign completed!';
            case 'failed': return 'Campaign failed';
            default: return status.status;
        }
    };

    return (
        <div className={`border rounded-2xl p-6 space-y-5 ${getStatusColor()}`}>
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    {getStatusIcon()}
                    <div>
                        <p className="font-bold text-white text-lg">{status.name}</p>
                        <p className="text-sm text-gray-400">{getStatusLabel()}</p>
                    </div>
                </div>
                {status.isFinished && (
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${status.status === 'completed'
                            ? 'bg-green-500/20 text-green-400 border-green-500/30'
                            : 'bg-red-500/20 text-red-400 border-red-500/30'
                        }`}>
                        {status.status}
                    </span>
                )}
            </div>

            {/* Progress Bar */}
            {status.totalJobs > 0 && (
                <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-400">
                        <span>Progress</span>
                        <span>{status.progress}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${status.status === 'completed' ? 'bg-green-500' : 'bg-purple-500'
                                }`}
                            style={{ width: `${status.progress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Counters */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/5 rounded-xl p-3 text-center border border-white/10">
                    <p className="text-2xl font-bold text-white">{status.totalJobs}</p>
                    <p className="text-xs text-gray-400 mt-1">Total Sites</p>
                </div>
                <div className="bg-green-500/10 rounded-xl p-3 text-center border border-green-500/20">
                    <p className="text-2xl font-bold text-green-400">{status.completedJobs}</p>
                    <p className="text-xs text-gray-400 mt-1">Completed</p>
                </div>
                <div className="bg-red-500/10 rounded-xl p-3 text-center border border-red-500/20">
                    <p className="text-2xl font-bold text-red-400">{status.failedJobs}</p>
                    <p className="text-xs text-gray-400 mt-1">Failed</p>
                </div>
            </div>

            {/* Failed rows info and download */}
            {status.failedRowsCount > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2 text-yellow-300">
                        <AlertTriangle size={16} />
                        <span className="text-sm">
                            {status.failedRowsCount} row{status.failedRowsCount > 1 ? 's' : ''} failed validation and were skipped
                        </span>
                    </div>
                    <button
                        onClick={handleDownloadFailedRows}
                        className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 rounded-lg text-sm transition-colors border border-yellow-500/30"
                    >
                        <Download size={14} />
                        Download Failed Rows
                    </button>
                </div>
            )}

            {/* Not finished indicator */}
            {!status.isFinished && (
                <p className="text-xs text-gray-500 text-center">
                    Auto-refreshing every 3 seconds...
                </p>
            )}
        </div>
    );
};

export default CampaignStatus;