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

const validateCUIT = (cuit) => {
  return /^\d{11}$/.test(cuit);
};

const validateRENSPA = (renspa) => {
  return /^\d{2}\.\d{3}\.\d{1}\.\d{5}\/\d{2}$/.test(renspa);
};

const upload = async (event) => {
  try {
    console.log('Headers:', event.headers);
    console.log('Content Length:', event.body.length);
    console.log('Is Base64:', event.isBase64Encoded);

    // Manejo del contenido del PDF
    const pdfContent = event.isBase64Encoded 
      ? Buffer.from(event.body, 'base64')
      : event.body;

    console.log('PDF Content Length:', pdfContent.length);

    const headers = event.headers;
    
    // Headers existentes
    const filename = headers['x-filename'];
    const empresa = headers['x-empresa'];
    const provincia = headers['x-provincia'];
    const emisionesCO2 = parseFloat(headers['x-emisiones-co2'] || '0');
    const consumoEnergia = parseFloat(headers['x-consumo-energia'] || '0');
    const certificadorEmail = headers['x-certificador-email'];
    const certificadorName = headers['x-certificador-name'];

    // Nuevos headers
    const cuitPropietario = headers['x-cuit-propietario'];
    const nombrePropietario = headers['x-nombre-propietario'];
    const renspa = headers['x-renspa'];
    const periodoCertificado = headers['x-periodo-certificado'];
    const resultadoCertificacion = headers['x-resultado-certificacion'];

    // Validaciones
    if (!cuitPropietario || !validateCUIT(cuitPropietario)) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'CUIT inválido. Debe contener 11 dígitos'
        })
      };
    }

    if (!renspa || !validateRENSPA(renspa)) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'RENSPA inválido. Formato requerido: XX.XXX.X.XXXXX/XX'
        })
      };
    }

    const now = new Date().toISOString();
    const hash = crypto.createHash('sha256').update(pdfContent).digest('hex');
    const code = generateCode(hash);
    const timestamp = await generateTimestamp(pdfContent);

    // Store PDF con configuración mejorada
    await s3.putObject({
      Bucket: process.env.PDF_BUCKET,
      Key: `${code}/${filename}`,
      Body: pdfContent,
      ContentType: 'application/pdf',
      ContentDisposition: 'inline',
      ContentLength: pdfContent.length,
      Metadata: {
        'original-filename': filename,
        'document-hash': hash
      }
    }).promise();

    // Verificar objeto guardado
    const headObject = await s3.headObject({
      Bucket: process.env.PDF_BUCKET,
      Key: `${code}/${filename}`
    }).promise();
    
    console.log('Stored object info:', headObject);

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
      propietario: {
        cuit: cuitPropietario,
        nombre: nombrePropietario,
        renspa: renspa
      },
      certificacion: {
        periodo: periodoCertificado,
        resultado: resultadoCertificacion,
        fechaRegistro: now
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
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code,
        message: 'Document processed successfully',
        documentHash: hash,
        status: 'STAMPING',
        timeline: item.timeline,
        propietario: item.propietario,
        certificacion: item.certificacion
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Error processing document',
        details: error.message
      })
    };
  }
};

module.exports = { upload };