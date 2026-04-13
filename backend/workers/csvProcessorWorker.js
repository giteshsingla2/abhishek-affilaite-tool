const { Worker, Queue } = require('bullmq');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const Campaign = require('../models/Campaign');
const Template = require('../models/Template');
const StaticTemplate = require('../models/StaticTemplate');
const Domain = require('../models/Domain');

const connection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
};

// Import existing queues
const { deployQueue, staticDeployQueue } = require('./deployWorker');

const csvProcessorQueue = new Queue('csv-processor-queue', { connection });

const csvProcessorWorker = new Worker('csv-processor-queue', async (job) => {
    const { campaignId } = job.data;

    console.log(`[CSV_PROCESSOR] Starting processing for campaign: ${campaignId}`);

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
    }

    // Mark campaign as queuing
    campaign.status = 'queuing';
    await campaign.save();

    const csvFilePath = campaign.csvFilePath;

    if (!csvFilePath || !fs.existsSync(csvFilePath)) {
        campaign.status = 'failed';
        await campaign.save();
        throw new Error(`CSV file not found at path: ${csvFilePath}`);
    }

    // Fetch template to get required headers
    let requiredHeaders = [];
    let templateDoc = null;

    if (campaign.campaignType === 'static') {
        const templateIds = campaign.staticTemplateId;
        if (!templateIds || templateIds.length === 0) {
            campaign.status = 'failed';
            campaign.errorMessage = 'No templates assigned to campaign';
            await campaign.save();
            throw new Error('No templates assigned to campaign');
        }
        // Fetch all templates
        const staticTemplates = await StaticTemplate.find({ _id: { $in: templateIds } });
        if (!staticTemplates || staticTemplates.length === 0) {
            campaign.status = 'failed';
            await campaign.save();
            throw new Error(`No StaticTemplates found for IDs: ${templateIds.join(', ')}`);
        }
        // Use first template's headers for validation (they're guaranteed identical)
        templateDoc = staticTemplates[0];
        requiredHeaders = templateDoc.requiredCsvHeaders || [];
        // Store full list for later round-robin queuing
        campaign._staticTemplates = staticTemplates;
    } else {
        templateDoc = await Template.findById(campaign.templateId);
        if (!templateDoc) {
            campaign.status = 'failed';
            await campaign.save();
            throw new Error(`Template ${campaign.templateId} not found`);
        }
        requiredHeaders = templateDoc.requiredCsvHeaders || [];
    }

    // Fetch allowed domains if dynamic domain mode
    let allowedDomains = null;
    if (campaign.platform === 'custom_domain' && campaign.useDynamicDomain) {
        const userDomains = await Domain.find({ userId: campaign.userId });
        allowedDomains = new Set(userDomains.map(d => d.domain));
    }

    // Read and process CSV row by row using streams
    const validRows = [];
    const failedRows = [];

    await new Promise((resolve, reject) => {
        fs.createReadStream(csvFilePath)
            .pipe(parse({
                columns: true,
                skip_empty_lines: true,
                trim: true,
                bom: true,
                relax_column_count: true,
                relax_quotes: true
            }))

            .on('data', (row) => {
                try {
                    // Validate required headers
                    const missing = requiredHeaders.filter(
                        h => !row[h] || String(row[h]).trim() === ''
                    );

                    if (missing.length > 0) {
                        failedRows.push({
                            row,
                            reason: `Missing required fields: ${missing.join(', ')}`,
                        });
                        return;
                    }

                    // Validate sub_domain exists
                    if (!row.sub_domain || String(row.sub_domain).trim() === '') {
                        failedRows.push({
                            row,
                            reason: 'Missing sub_domain field',
                        });
                        return;
                    }

                    // Validate dynamic domain ownership
                    if (campaign.platform === 'custom_domain' && campaign.useDynamicDomain) {
                        const cleanDomain = String(row.domain || '').trim().toLowerCase();
                        if (!cleanDomain || !allowedDomains.has(cleanDomain)) {
                            failedRows.push({
                                row,
                                reason: `Domain not registered or not owned: ${row.domain}`,
                            });
                            return;
                        }
                        row.domain = cleanDomain;
                    }

                    validRows.push(row);
                } catch (err) {
                    failedRows.push({ row, reason: 'Row processing error: ' + err.message });
                }
            })
            .on('end', resolve)
            .on('error', async (err) => {
                try {
                    campaign.status = 'failed';
                    campaign.errorMessage = err.message;
                    campaign.failedRows = failedRows;
                    await campaign.save();
                } catch (saveErr) {
                    console.error('[CSV_PROCESSOR] Failed to save error state:', saveErr.message);
                }
                reject(err);
            });
    });


    console.log(`[CSV_PROCESSOR] Campaign ${campaignId}: ${validRows.length} valid rows, ${failedRows.length} invalid rows`);

    if (validRows.length === 0) {
        campaign.status = 'failed';
        campaign.failedRows = failedRows;
        campaign.totalJobs = 0;
        await campaign.save();

        // Cleanup CSV file
        try { fs.unlinkSync(csvFilePath); } catch (e) { console.error('Failed to delete CSV:', e.message); }

        throw new Error('No valid rows found in CSV after validation');
    }

    // Update campaign with total jobs count and failed rows
    campaign.totalJobs = validRows.length;
    campaign.failedRows = failedRows;
    campaign.status = 'processing';
    await campaign.save();

    // Queue individual deploy jobs
    for (let rowIndex = 0; rowIndex < validRows.length; rowIndex++) {
        const row = validRows[rowIndex];
        if (campaign.campaignType === 'static') {
            // Round-robin template assignment
            const templateIds = campaign.staticTemplateId;
            const assignedTemplateId = templateIds[rowIndex % templateIds.length];
            await staticDeployQueue.add('static-deploy-job', {
                campaignMode: 'static_template',
                campaignId: campaign._id,
                staticTemplateId: assignedTemplateId,
                platform: campaign.platform,
                credentialId: campaign.platform === 'custom_domain' ? null : campaign.credentialId,
                domainName: campaign.useDynamicDomain ? row.domain : campaign.domainName,
                row,
                bucketName: campaign.bucketName,
                rootFolder: campaign.rootFolder,
                model: campaign.model || process.env.OPENROUTER_MODEL,
            });
        } else {
            await deployQueue.add('deploy-job', {
                campaignId: campaign._id,
                platform: campaign.platform,
                credentialId: campaign.platform === 'custom_domain' ? null : campaign.credentialId,
                domainName: campaign.useDynamicDomain ? row.domain : campaign.domainName,
                templateId: campaign.templateId,
                row,
                bucketName: campaign.bucketName,
                rootFolder: campaign.rootFolder,
                model: campaign.model || process.env.OPENROUTER_MODEL,
            });
        }
    }

    console.log(`[CSV_PROCESSOR] Campaign ${campaignId}: All ${validRows.length} jobs queued successfully`);

    // Cleanup CSV file after queuing
    try {
        fs.unlinkSync(csvFilePath);
        console.log(`[CSV_PROCESSOR] Deleted CSV file: ${csvFilePath}`);
    } catch (e) {
        console.error('[CSV_PROCESSOR] Failed to delete CSV file:', e.message);
    }

    return { totalJobs: validRows.length, failedRows: failedRows.length };

}, { connection });

csvProcessorWorker.on('completed', (job, result) => {
    console.log(`[CSV_PROCESSOR] Job ${job.id} completed:`, result);
});

csvProcessorWorker.on('failed', (job, err) => {
    console.error(`[CSV_PROCESSOR] Job ${job.id} failed:`, err.message);
});

module.exports = { csvProcessorQueue };