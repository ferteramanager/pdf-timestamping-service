const AWS = require('aws-sdk');
const { generateTimestamp } = require('../utils/timestamp');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();

const generateCode = (hash) => {
  const uuid = uuidv4().substring(0, 8);
  const hashPart = hash.substring(0, 8);
  return `${hashPart}-${uuid}`.toUpperCase();
};

const upload = async (event) => {
  try {
    const pdfContent = Buffer.from(event.body, 'base64');
    const headers = event.headers;
    const filename = headers['x-filename'];
    const empresa = headers['x-empresa'];
    const provincia = headers['x-provincia'];
    const emisionesCO2 = parseFloat(headers['x-emisiones-co2'] || '0');
    const consumoEnergia = parseFloat(headers['x-consumo-energia'] || '0');
    const certificadorEmail = headers['x-certificador-email'];
    const certificadorName = headers['x-certificador-name'];

    const now = new Date().toISOString();
    const hash = crypto.createHash('sha256').update(pdfContent).digest('hex');
    const code = generateCode(hash);
    const timestamp = await generateTimestamp(pdfContent);

    // Store PDF
    await s3.putObject({
      Bucket: process.env.PDF_BUCKET,
      Key: `${code}/${filename}`,
      Body: pdfContent,
      ContentType: 'application/pdf'
    }).promise();

    // Store OTS
    await s3.putObject({
      Bucket: process.env.OTS_BUCKET,
      Key: `${code}.ots`,
      Body: timestamp,
      ContentType: 'application/vnd.opentimestamps.ots'
    }).promise();

    // Store metadata
    const item = {
      code,
      documentHash: hash,
      filename,
      empresa,
      provincia,
      emisionesCO2,
      consumoEnergia,
      status: 'STAMPING',
      timeline: {
        uploadedAt: now,
        stampingStartedAt: now,
        confirmedAt: null,
        lastVerificationAt: now
      },
      certificador: {
        email: certificadorEmail,
        name: certificadorName,
        timestamp: now
      },
      s3Path: `${code}/${filename}`
    };

    await dynamodb.put({
      TableName: process.env.DYNAMODB_TABLE,
      Item: item
    }).promise();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        code,
        message: 'Document processed successfully',
        documentHash: hash,
        status: 'STAMPING',
        timeline: item.timeline
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Error processing document'
      })
    };
  }
};

module.exports = { upload };