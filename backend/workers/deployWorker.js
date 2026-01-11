const { Worker, Queue } = require('bullmq');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from the root of the backend folder
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const Credential = require('../models/Credential');
const Template = require('../models/Template');
const Campaign = require('../models/Campaign');
const Website = require('../models/Website');
const { uploadToS3 } = require('../services/uploaders/s3Adapter');
const { uploadToNetlify } = require('../services/uploaders/netlifyAdapter');

const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
};

const deployQueue = new Queue('deploy-queue', { connection });

const stripMarkdownCodeFences = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/```html\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
};

const generateHtml = async (systemPrompt, row) => {
  const systemRole = "You are a Helpful AI Assistant who create HTML Websites with valid HTML document (no markdown, no code fences, no explanations).";

  let finalHydratedPrompt = systemPrompt;
  for (const key in row) {
    if (Object.hasOwnProperty.call(row, key)) {
      const value = row[key] || '';
      const placeholder = new RegExp(`\\{${key}\\}`, 'g');
      finalHydratedPrompt = finalHydratedPrompt.replace(placeholder, value);
    }
  }

  // Gracefully handle any remaining placeholders
  finalHydratedPrompt = finalHydratedPrompt.replace(/\{[a-zA-Z0-9_]+\}/g, '');

  try {
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'qwen/qwen3-next-80b-a3b-instruct',
      messages: [
        { role: 'system', content: systemRole },
        { role: 'user', content: finalHydratedPrompt },
      ],
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5173',
      }
    });

    let htmlContent = response.data.choices[0].message.content;
    htmlContent = stripMarkdownCodeFences(htmlContent);

    const headerCode = String(row.header_code || '').trim();
    if (headerCode) {
      htmlContent = htmlContent.replace('</head>', `${headerCode}\n</head>`);
    }

    return htmlContent;
  } catch (error) {
    console.error('Error generating HTML from OpenRouter:', error.response ? error.response.data : error.message);
    throw new Error('Failed to generate HTML content.');
  }
};

const worker = new Worker('deploy-queue', async (job) => {
  console.log(`[JOB_START] Job ${job.id} received with data:`, job.data);
  const { platform, credentialId, templateId, row, campaignId } = job.data;
  const subDomain = row?.sub_domain;

  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    throw new Error(`Campaign with ID ${campaignId} not found.`);
  }

  const website = await Website.create({
    userId: campaign.userId,
    campaignId,
    productName: row.name,
    status: 'Pending',
  });

  console.log(`[JOB_PROGRESS] ${job.id}: Initial website record created: ${website._id}.`);

  try {
        console.log(`[JOB_PROGRESS] ${job.id}: Step 1 - Fetching template...`);
    // 1. Fetch template prompt
    const template = await Template.findById(templateId);
    if (!template) {
      throw new Error(`Template with ID ${templateId} not found.`);
    }

        console.log(`[JOB_PROGRESS] ${job.id}: Step 1 - Template ${templateId} fetched successfully.`);

    console.log(`[JOB_PROGRESS] ${job.id}: Step 2 - Generating HTML content...`);
    // 2. Generate HTML content
    const htmlContent = await generateHtml(template.systemPrompt, row);

        console.log(`[JOB_PROGRESS] ${job.id}: Step 2 - HTML content generated (length: ${htmlContent.length}).`);

    console.log(`[JOB_PROGRESS] ${job.id}: Step 3 - Fetching credentials...`);
    // 3. Fetch credentials
    const credentialDoc = await Credential.findById(credentialId);
    if (!credentialDoc) {
      throw new Error(`Credential with ID ${credentialId} not found.`);
    }
    const credential = credentialDoc.getDecrypted();
    console.log(`[JOB_PROGRESS] ${job.id}: Step 3 - Credentials decrypted successfully.`);

        console.log(`[JOB_PROGRESS] ${job.id}: Step 3 - Credentials ${credentialId} fetched successfully.`);

    console.log(`[JOB_PROGRESS] ${job.id}: Step 4 - Uploading to ${platform}...`);
    // 4. Upload to the specified platform
    let result;
    switch (platform) {
      case 'aws_s3':
      case 'digital_ocean':
        result = await uploadToS3(htmlContent, subDomain, credential);
        break;
      case 'netlify':
        result = await uploadToNetlify(htmlContent, subDomain, credential);
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

        console.log(`[JOB_PROGRESS] ${job.id}: Step 4 - Upload to ${platform} completed. Result:`, result);

    if (!result.success) {
      throw new Error(result.error || 'Upload failed for an unknown reason.');
    }

        console.log(`[JOB_PROGRESS] ${job.id}: Step 5 - Updating website document with URL: ${result.url}`);
    // 5. Update website document with final data
    website.status = 'Live';
    website.url = result.url;
    website.htmlContent = htmlContent; // Save the final HTML content
    website.headerCode = String(row.header_code || '').trim(); // Save the header code from CSV
    await website.save();
    console.log(`[JOB_PROGRESS] ${job.id}: Step 5 - Website document updated successfully.`);

    console.log(`Job ${job.id} completed successfully. URL: ${result.url}`);
    return { ...result, websiteId: website._id };

  } catch (error) {
    console.error(`Job ${job.id} failed:`, error.message);
    website.status = 'Failed';
    await website.save();
    console.log(`[JOB_PROGRESS] ${job.id}: Website status updated to 'Failed'.`);
    throw error;
  }
}, { connection });

worker.on('completed', (job, result) => {
  console.log(`Job ${job.id} has completed with result:`, result);
});

worker.on('failed', (job, err) => {
  console.log(`Job ${job.id} has failed with error:`, err.message);
});

module.exports = { deployQueue };
