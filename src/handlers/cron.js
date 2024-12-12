const AWS = require('aws-sdk');
const { verifyTimestamp } = require('../utils/timestamp');
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();

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

const checkDocument = async (doc) => {
  try {
    const [ots, pdf] = await Promise.all([
      s3.getObject({
        Bucket: process.env.OTS_BUCKET,
        Key: `${doc.code}.ots`
      }).promise(),
      s3.getObject({
        Bucket: process.env.PDF_BUCKET,
        Key: doc.s3Path
      }).promise()
    ]);

    const verificationResult = await verifyTimestamp(ots.Body, pdf.Body);
    
    if (verificationResult.status === 'CONFIRMED' && doc.status !== 'CONFIRMED') {
      await dynamodb.update({
        TableName: process.env.DYNAMODB_TABLE,
        Key: { code: doc.code },
        UpdateExpression: 'SET #status = :status, timeline.confirmedAt = :confirmedAt',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': 'CONFIRMED',
          ':confirmedAt': new Date().toISOString()
        }
      }).promise();

      await addLifecycleEvent(doc.code, 'TIMESTAMP_CONFIRMED');
    } else if (verificationResult.status === 'STAMPING') {
      await addLifecycleEvent(doc.code, 'VERIFICATION_PENDING');
    }

    return verificationResult;
  } catch (error) {
    console.log(`Verification pending for document ${doc.code}`);
    await addLifecycleEvent(doc.code, 'VERIFICATION_PENDING');
    return {
      status: 'STAMPING',
      message: 'Verification pending in blockchain'
    };
  }
};

const checkPendingDocuments = async (event) => {
  try {
    const params = {
      TableName: process.env.DYNAMODB_TABLE,
      FilterExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'STAMPING'
      }
    };

    const pendingDocs = await dynamodb.scan(params).promise();
    console.log(`Found ${pendingDocs.Items.length} pending documents`);
    
    const results = await Promise.all(
      pendingDocs.Items.map(async (doc) => {
        try {
          const result = await checkDocument(doc);
          return {
            code: doc.code,
            status: result.status,
            timeline: doc.timeline
          };
        } catch (error) {
          console.log(`Verification pending for document ${doc.code}`);
          return {
            code: doc.code,
            status: 'STAMPING',
            message: 'Verification pending'
          };
        }
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Documents checked successfully',
        processed: results.length,
        results
      })
    };
  } catch (error) {
    console.error('Error in checkPendingDocuments:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Error checking pending documents'
      })
    };
  }
};

module.exports = {
  checkPendingDocuments
};