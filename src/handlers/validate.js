const AWS = require('aws-sdk');
const { verifyTimestamp } = require('../utils/timestamp');
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();

const getPresignedUrls = async (code, s3Path) => {
  const pdfUrl = await s3.getSignedUrlPromise('getObject', {
    Bucket: process.env.PDF_BUCKET,
    Key: s3Path,
    Expires: 3600
  });
  
  const otsUrl = await s3.getSignedUrlPromise('getObject', {
    Bucket: process.env.OTS_BUCKET,
    Key: `${code}.ots`,
    Expires: 3600
  });
  
  return { pdfUrl, otsUrl };
};

const addLifecycleEvent = async (code, event) => {
  const now = new Date().toISOString();
  await dynamodb.update({
    TableName: process.env.DYNAMODB_TABLE,
    Key: { code },
    UpdateExpression: 'SET lifecycle = list_append(if_not_exists(lifecycle, :empty), :newEvent)',
    ExpressionAttributeValues: {
      ':empty': [],
      ':newEvent': [{
        event,
        timestamp: now
      }]
    }
  }).promise();
};

const validate = async (event) => {
  try {
    const { code } = event.pathParameters;
    
    const result = await dynamodb.get({
      TableName: process.env.DYNAMODB_TABLE,
      Key: { code }
    }).promise();

    if (!result.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'Document not found'
        })
      };
    }

    try {
      const [ots, pdf] = await Promise.all([
        s3.getObject({
          Bucket: process.env.OTS_BUCKET,
          Key: `${code}.ots`
        }).promise(),
        s3.getObject({
          Bucket: process.env.PDF_BUCKET,
          Key: result.Item.s3Path
        }).promise()
      ]);

      const verificationResult = await verifyTimestamp(ots.Body, pdf.Body);
      const urls = await getPresignedUrls(code, result.Item.s3Path);

      // Update status if confirmed
      if (verificationResult.status === 'CONFIRMED' && result.Item.status !== 'CONFIRMED') {
        await dynamodb.update({
          TableName: process.env.DYNAMODB_TABLE,
          Key: { code },
          UpdateExpression: 'SET #status = :status, timeline.confirmedAt = :confirmedAt',
          ExpressionAttributeNames: {
            '#status': 'status'
          },
          ExpressionAttributeValues: {
            ':status': 'CONFIRMED',
            ':confirmedAt': new Date().toISOString()
          }
        }).promise();
        
        await addLifecycleEvent(code, 'TIMESTAMP_CONFIRMED');
      }

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          code,
          status: verificationResult.status,
          verified: verificationResult.status === 'CONFIRMED',
          documentHash: result.Item.documentHash,
          timestamp: {
            bitcoin: verificationResult.blockchain
          },
          timeline: result.Item.timeline,
          lifecycle: result.Item.lifecycle || [],
          downloads: {
            pdf: urls.pdfUrl,
            ots: urls.otsUrl
          },
          documentInfo: {
            filename: result.Item.filename,
            empresa: result.Item.empresa,
            provincia: result.Item.provincia,
            emisionesCO2: result.Item.emisionesCO2,
            consumoEnergia: result.Item.consumoEnergia,
            certificador: result.Item.certificador,
            propietario: result.Item.propietario,
            certificacion: result.Item.certificacion
          }
        })
      };
    } catch (verifyError) {
      console.log('Verification error:', verifyError);
      
      const urls = await getPresignedUrls(code, result.Item.s3Path);
      await addLifecycleEvent(code, 'VERIFICATION_CHECK');
      
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          code,
          status: 'STAMPING',
          documentHash: result.Item.documentHash,
          message: 'Document is still in stamping process. Please try again later.',
          timeline: result.Item.timeline,
          lifecycle: result.Item.lifecycle || [],
          downloads: {
            pdf: urls.pdfUrl,
            ots: urls.otsUrl
          },
          documentInfo: {
            filename: result.Item.filename,
            empresa: result.Item.empresa,
            provincia: result.Item.provincia,
            emisionesCO2: result.Item.emisionesCO2,
            consumoEnergia: result.Item.consumoEnergia,
            certificador: result.Item.certificador,
            propietario: result.Item.propietario,
            certificacion: result.Item.certificacion
          },
          estimatedTime: 'The stamping process usually takes between 30-60 minutes'
        })
      };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Error validating document',
        details: error.message
      })
    };
  }
};

module.exports = { validate };