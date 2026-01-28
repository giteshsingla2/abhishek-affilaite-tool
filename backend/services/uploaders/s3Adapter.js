const { S3Client, PutObjectCommand, ListBucketsCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const getS3Client = (credentials) => {
  const { platform, region, accessKey, secretKey } = credentials;
  
  console.log(`[DEBUG] Initializing S3Client for ${platform}. Region: ${region}, AccessKey length: ${accessKey?.length}`);

  if (!region) {
    throw new Error(`Region is required for ${platform === 'digital_ocean' ? 'DigitalOcean' : 'AWS S3'}`);
  }

  if (!accessKey || !secretKey) {
    throw new Error(`Access Key and Secret Key are required for ${platform === 'digital_ocean' ? 'DigitalOcean' : 'AWS S3'}. Please check if the credentials were saved correctly.`);
  }

  let s3Options = {
    region,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
    // Add forcePathStyle for DigitalOcean or if needed for certain S3 regions
    forcePathStyle: platform === 'digital_ocean' ? true : false,
  };

  if (platform === 'digital_ocean') {
    // DigitalOcean endpoint format: https://${region}.digitaloceanspaces.com
    s3Options.endpoint = `https://${region}.digitaloceanspaces.com`;
  }

  return new S3Client(s3Options);
};

const uploadToS3 = async (fileContent, subDomain, credentials, campaign) => {
  const { platform, region } = credentials;
  const { bucketName, rootFolder } = campaign;

  const s3Client = getS3Client(credentials);

  const params = {
    Bucket: bucketName,
    Key: rootFolder ? `${rootFolder}/${subDomain}/index.html` : `${subDomain}/index.html`,
    Body: fileContent,
    ACL: 'public-read', // Make the file publicly accessible
    ContentType: 'text/html',
  };

  try {
    const data = await s3Client.send(new PutObjectCommand(params));
    console.log('Successfully uploaded to S3/DO:', data);

    // Construct the URL of the uploaded file
    let url;
    const keyPath = rootFolder ? `${rootFolder}/${subDomain}/index.html` : `${subDomain}/index.html`;

    if (platform === 'digital_ocean') {
      url = `https://${bucketName}.${region}.digitaloceanspaces.com/${keyPath}`;
    } else { // AWS S3
      url = `https://${bucketName}.s3.${region}.amazonaws.com/${keyPath}`;
    }
    return { success: true, url };

  } catch (err) {
    console.error('Error uploading to S3/DO:', err);
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
