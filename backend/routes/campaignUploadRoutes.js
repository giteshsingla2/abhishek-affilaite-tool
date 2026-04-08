const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/authMiddleware');
const Campaign = require('../models/Campaign');
const Credential = require('../models/Credential');
const Domain = require('../models/Domain');
const { ensureUploadDir, CSV_UPLOAD_DIR } = require('../utils/ensureUploadDir');
const { csvProcessorQueue } = require('../workers/csvProcessorWorker');
const { v4: uuidv4 } = require('uuid');

// Configure multer for CSV file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = ensureUploadDir();
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}-${Date.now()}.csv`;
        cb(null, uniqueName);
    },
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
        cb(null, true);
    } else {
        cb(new Error('Only CSV files are allowed'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50mb file size limit
});

// @route   POST /api/campaign-upload/start
// @desc    Upload CSV file and start campaign processing
// @access  Private
router.post('/start', auth, upload.single('csvFile'), async (req, res) => {
    try {
        const {
            campaignName,
            campaignType,
            templateId,
            staticTemplateId,
            platform,
            credentialId,
            bucketName,
            rootFolder,
            domainName,
            useDynamicDomain,
            model,
        } = req.body;

        // Validate required fields
        if (!campaignName || String(campaignName).trim() === '') {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ msg: 'campaignName is required' });
        }

        if (!campaignType || !['ai', 'static'].includes(campaignType)) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ msg: 'campaignType must be ai or static' });
        }

        if (campaignType === 'ai' && !templateId) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ msg: 'templateId is required for AI campaigns' });
        }

        if (campaignType === 'static' && !staticTemplateId) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ msg: 'staticTemplateId is required for static campaigns' });
        }

        if (!platform) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ msg: 'platform is required' });
        }

        if (!req.file) {
            return res.status(400).json({ msg: 'CSV file is required' });
        }

        // Validate credential ownership for non-custom-domain platforms
        if (platform !== 'custom_domain') {
            if (!credentialId) {
                fs.unlinkSync(req.file.path);
                return res.status(400).json({ msg: 'credentialId is required for this platform' });
            }

            const credential = await Credential.findById(credentialId);
            if (!credential) {
                fs.unlinkSync(req.file.path);
                return res.status(404).json({ msg: 'Credential not found' });
            }

            if (credential.userId.toString() !== req.user.id) {
                fs.unlinkSync(req.file.path);
                return res.status(403).json({ msg: 'Not authorized to use this credential' });
            }
        }

        // Validate domain for custom_domain platform single domain mode
        const isDynamicDomain = useDynamicDomain === 'true' || useDynamicDomain === true;

        if (platform === 'custom_domain' && !isDynamicDomain) {
            if (!domainName) {
                fs.unlinkSync(req.file.path);
                return res.status(400).json({ msg: 'domainName is required for single domain mode' });
            }
        }

        // Create campaign record
        const campaign = await Campaign.create({
            userId: req.user.id,
            name: String(campaignName).trim(),
            status: 'pending',
            campaignType,
            platform,
            credentialId: platform === 'custom_domain' ? null : credentialId,
            domainName: platform === 'custom_domain' ? domainName : undefined,
            templateId: campaignType === 'ai' ? templateId : undefined,
            staticTemplateId: campaignType === 'static' ? staticTemplateId : undefined,
            bucketName,
            rootFolder,
            model: model || process.env.OPENROUTER_MODEL,
            useDynamicDomain: isDynamicDomain,
            csvFilePath: req.file.path,
            totalJobs: 0,
            completedJobs: 0,
            failedJobs: 0,
            failedRows: [],
        });

        // Add single job to csv-processor-queue
        await csvProcessorQueue.add('process-csv', {
            campaignId: campaign._id.toString(),
        });

        console.log(`[CAMPAIGN_UPLOAD] Campaign ${campaign._id} created, CSV queued for processing`);

        return res.json({
            success: true,
            message: 'Campaign created. CSV is being processed in background.',
            campaignId: campaign._id,
        });

    } catch (err) {
        console.error('[CAMPAIGN_UPLOAD] Error:', err);
        if (req.file && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (e) { }
        }
        return res.status(500).json({ msg: 'Server error', error: err.message });
    }
});

// @route   GET /api/campaign-upload/:id/status
// @desc    Get campaign processing status for polling
// @access  Private
router.get('/:id/status', auth, async (req, res) => {
    try {
        const campaign = await Campaign.findById(req.params.id)
            .select('name status campaignType totalJobs completedJobs failedJobs failedRows createdAt platform')
            .lean();

        if (!campaign) {
            return res.status(404).json({ msg: 'Campaign not found' });
        }

        if (campaign.userId && campaign.userId.toString() !== req.user.id) {
            return res.status(403).json({ msg: 'Not authorized' });
        }

        const progress = campaign.totalJobs > 0
            ? Math.round(((campaign.completedJobs + campaign.failedJobs) / campaign.totalJobs) * 100)
            : 0;

        return res.json({
            campaignId: campaign._id,
            name: campaign.name,
            status: campaign.status,
            campaignType: campaign.campaignType,
            totalJobs: campaign.totalJobs,
            completedJobs: campaign.completedJobs,
            failedJobs: campaign.failedJobs,
            failedRowsCount: campaign.failedRows?.length || 0,
            progress,
            isFinished: campaign.status === 'completed' || campaign.status === 'failed',
            createdAt: campaign.createdAt,
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/campaign-upload/:id/failed-rows
// @desc    Download failed rows as CSV
// @access  Private
router.get('/:id/failed-rows', auth, async (req, res) => {
    try {
        const campaign = await Campaign.findById(req.params.id)
            .select('userId failedRows name')
            .lean();

        if (!campaign) {
            return res.status(404).json({ msg: 'Campaign not found' });
        }

        if (campaign.userId.toString() !== req.user.id) {
            return res.status(403).json({ msg: 'Not authorized' });
        }

        if (!campaign.failedRows || campaign.failedRows.length === 0) {
            return res.status(404).json({ msg: 'No failed rows found for this campaign' });
        }

        // Build CSV content from failed rows
        const rows = campaign.failedRows;
        const headers = [...Object.keys(rows[0].row), 'failure_reason'];
        const csvLines = [headers.join(',')];

        for (const item of rows) {
            const values = headers.map(h => {
                if (h === 'failure_reason') return `"${(item.reason || '').replace(/"/g, '""')}"`;
                const val = item.row[h] || '';
                return `"${String(val).replace(/"/g, '""')}"`;
            });
            csvLines.push(values.join(','));
        }

        const csvContent = csvLines.join('\n');
        const filename = `failed-rows-${campaign.name.replace(/\s+/g, '-')}-${Date.now()}.csv`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csvContent);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;