const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const list = async (event) => {
  try {
    console.log('Processing list request');
    const { empresa, provincia, startDate, endDate } = event.queryStringParameters || {};
    
    let params = {
      TableName: process.env.DYNAMODB_TABLE,
      Limit: 50
    };

    let filterExpressions = [];
    let expressionAttributeValues = {};

    if (empresa) {
      filterExpressions.push('empresa = :empresa');
      expressionAttributeValues[':empresa'] = empresa;
    }

    if (provincia) {
      filterExpressions.push('provincia = :provincia');
      expressionAttributeValues[':provincia'] = provincia;
    }

    if (startDate && endDate) {
      filterExpressions.push('uploadedAt BETWEEN :startDate AND :endDate');
      expressionAttributeValues[':startDate'] = startDate;
      expressionAttributeValues[':endDate'] = endDate;
    }

    if (filterExpressions.length > 0) {
      params.FilterExpression = filterExpressions.join(' AND ');
      params.ExpressionAttributeValues = expressionAttributeValues;
    }

    const result = await dynamodb.scan(params).promise();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*'
      },
      body: JSON.stringify({
        documents: result.Items,
        count: result.Count,
        scannedCount: result.ScannedCount,
        lastEvaluatedKey: result.LastEvaluatedKey
      })
    };
  } catch (error) {
    console.error('List error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*'
      },
      body: JSON.stringify({
        error: 'Error listing documents',
        details: error.message
      })
    };
  }
};

module.exports = { list };