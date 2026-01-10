const { Worker, Queue } = require('bullmq');
const axios = require('axios');
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
  const enforcedSystem = `${systemPrompt}\n\nIMPORTANT REQUIREMENTS:\n- Output ONLY a complete, valid HTML document (no markdown, no code fences, no explanations).\n- Use TailwindCSS via CDN in <head> (https://cdn.tailwindcss.com).\n- Use Tailwind utility classes throughout.\n- Include a clear call-to-action linking to the affiliate URL.\n- Do not include <script> tags except the Tailwind CDN script.\n`;

  const userPrompt = [
    `name: ${row.name}`,
    `description: ${row.description}`,
    `price: ${row.price}`,
    `image_url: ${row.image_url}`,
    `affiliate_url: ${row.affiliate_url}`,
    `logo_url: ${row.logo_url}`,
    `sub_domain: ${row.sub_domain}`,
    `meta_keywords: ${row.meta_keywords}`,
  ].join('\n');

  try {
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'openai/gpt-4o',
      messages: [
        { role: 'system', content: enforcedSystem },
        { role: 'user', content: userPrompt },
      ],
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });

    let htmlContent = response.data.choices[0].message.content;
    htmlContent = stripMarkdownCodeFences(htmlContent);

    // Injection: Add header_code before </head> if provided
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

  console.log(`Processing job ${job.id} for platform: ${platform}, websiteId: ${website._id}`);

  try {
    // 1. Fetch template prompt
    const template = await Template.findById(templateId);
    if (!template) {
      throw new Error(`Template with ID ${templateId} not found.`);
    }

    // 2. Generate HTML content
    const htmlContent = await generateHtml(template.systemPrompt, row);

    // 3. Fetch credentials
    const credential = await Credential.findById(credentialId);
    if (!credential) {
      throw new Error(`Credential with ID ${credentialId} not found.`);
    }

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

    if (!result.success) {
      throw new Error(result.error || 'Upload failed for an unknown reason.');
    }

    // 5. Update website document with final data
    website.status = 'Live';
    website.url = result.url;
    website.htmlContent = htmlContent; // Save the final HTML content
    website.headerCode = String(row.header_code || '').trim(); // Save the header code from CSV
    await website.save();

    console.log(`Job ${job.id} completed successfully. URL: ${result.url}`);
    return { ...result, websiteId: website._id };

  } catch (error) {
    console.error(`Job ${job.id} failed:`, error.message);
    website.status = 'Failed';
    await website.save();
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
