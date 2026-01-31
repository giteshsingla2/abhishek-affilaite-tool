const { S3Client, PutObjectCommand, ListBucketsCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const getS3Client = (credentials) => {
  const { platform, region, accessKey, secretKey, accountId } = credentials;
  
  console.log(`[DEBUG] Initializing S3Client for ${platform}. Region: ${region}, AccessKey length: ${accessKey?.length}`);

  let s3Options = {
    region: platform === 'cloudflare_r2' ? 'auto' : region,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
    // forcePathStyle: true is often needed for S3-compatible providers
    forcePathStyle: platform !== 'aws_s3',
  };

  if (!s3Options.region && platform !== 'cloudflare_r2') {
    throw new Error(`Region is required for ${platform}`);
  }

  if (!accessKey || !secretKey) {
    throw new Error(`Access Key and Secret Key are required for ${platform}. Please check if the credentials were saved correctly.`);
  }

  // Set endpoints for different platforms
  if (platform === 'digital_ocean') {
    s3Options.endpoint = `https://${region}.digitaloceanspaces.com`;
  } else if (platform === 'backblaze') {
    s3Options.endpoint = `https://s3.${region}.backblazeb2.com`;
  } else if (platform === 'cloudflare_r2') {
    if (!accountId) {
      throw new Error('Account ID is required for Cloudflare R2');
    }
    s3Options.endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  }

  return new S3Client(s3Options);
};

const uploadToS3 = async (fileContent, subDomain, credentials, campaign) => {
  const { platform, region, cdnUrl } = credentials;
  const { bucketName, rootFolder } = campaign;

  const s3Client = getS3Client(credentials);

  const params = {
    Bucket: bucketName,
    Key: rootFolder ? `${rootFolder}/${subDomain}/index.html` : `${subDomain}/index.html`,
    Body: fileContent,
    ACL: 'public-read', // Note: R2/B2 might handle ACLs differently, but PutObjectCommand supports it
    ContentType: 'text/html',
  };

  try {
    const data = await s3Client.send(new PutObjectCommand(params));
    console.log(`Successfully uploaded to ${platform}:`, data);

    // Construct the URL of the uploaded file
    let url;
    const keyPath = rootFolder ? `${rootFolder}/${subDomain}/index.html` : `${subDomain}/index.html`;

    if (platform === 'digital_ocean') {
      url = `https://${bucketName}.${region}.digitaloceanspaces.com/${keyPath}`;
    } else if (platform === 'backblaze') {
      url = `https://${bucketName}.s3.${region}.backblazeb2.com/${keyPath}`;
    } else if (platform === 'cloudflare_r2') {
      if (cdnUrl) {
        url = `${cdnUrl.replace(/\/$/, '')}/${keyPath}`;
      } else {
        console.warn('[WARN] No cdnUrl provided for Cloudflare R2. URL might not be public.');
        url = `https://${bucketName}.${credentials.accountId}.r2.cloudflarestorage.com/${keyPath}`;
      }
    } else { // AWS S3
      url = `https://${bucketName}.s3.${region}.amazonaws.com/${keyPath}`;
    }
    return { success: true, url };

  } catch (err) {
    console.error(`Error uploading to ${platform}:`, err);
    return { success: false, error: err.message };
  }
};

const listBuckets = async (credentials) => {
  const s3Client = getS3Client(credentials);
  try {
    const data = await s3Client.send(new ListBucketsCommand({}));
    return data.Buckets.map((b) => b.Name);
  } catch (err) {
    console.error('Error listing buckets:', err);
    throw err;
  }
};

const listFolders = async (credentials, bucketName, prefix = "") => {
  const s3Client = getS3Client(credentials);
  try {
    const data = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucketName,
      Delimiter: '/',
      Prefix: prefix
    }));
    return (data.CommonPrefixes || []).map((p) => p.Prefix);
  } catch (err) {
    console.error('Error listing folders:', err);
    throw err;
  }
};

module.exports = { uploadToS3, listBuckets, listFolders };
