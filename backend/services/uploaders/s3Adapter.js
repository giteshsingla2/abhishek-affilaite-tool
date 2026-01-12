const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const uploadToS3 = async (fileContent, subDomain, credentials, campaign) => {
  const { platform, region, accessKey, secretKey } = credentials;
  const { bucketName, rootFolder } = campaign;

  let s3Options = {
    region,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
  };

  // If the platform is DigitalOcean, set the custom endpoint
  if (platform === 'digital_ocean') {
    s3Options.endpoint = `https://${region}.digitaloceanspaces.com`;
  }

  const s3Client = new S3Client(s3Options);

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

module.exports = { uploadToS3 };
