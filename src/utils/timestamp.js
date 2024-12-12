const OpenTimestamps = require('javascript-opentimestamps');
const crypto = require('crypto');

const generateTimestamp = async (buffer) => {
  try {
    console.log('Generating timestamp...');
    const detached = OpenTimestamps.DetachedTimestampFile.fromBytes(new OpenTimestamps.Ops.OpSHA256(), buffer);
    await OpenTimestamps.stamp(detached);
    const serialized = detached.serializeToBytes();
    console.log('Timestamp generated successfully');
    return serialized;
  } catch (error) {
    console.error('Error generating timestamp:', error);
    throw error;
  }
};

const verifyTimestamp = async (stampBytes, originalBuffer) => {
  try {
    console.log('Starting timestamp verification');
    const detachedOriginal = OpenTimestamps.DetachedTimestampFile.fromBytes(
      new OpenTimestamps.Ops.OpSHA256(),
      originalBuffer
    );
    console.log('Original file processed');
    const detachedStamp = OpenTimestamps.DetachedTimestampFile.deserialize(stampBytes);
    console.log('OTS file deserialized');
    const result = await OpenTimestamps.verify(detachedStamp, detachedOriginal);
    console.log('Raw verification result:', result);

    // Calcular el hash del documento original
    const documentHash = crypto.createHash('sha256')
                              .update(originalBuffer)
                              .digest('hex');

    if (!result) {
      return {
        status: 'STAMPING',
        message: 'Pending confirmation in Bitcoin blockchain',
        documentHash: documentHash,
        timestamp: null
      };
    }

    // Extraer la información detallada del timestamp
    const verificationInfo = {
      status: 'CONFIRMED',
      message: 'Document confirmed in blockchain',
      documentHash: documentHash,
      blockchain: {
        network: 'bitcoin',
        blockHeight: result.bitcoin?.height || null,
        blockHash: result.bitcoin?.merkleroot || null,
        blockTime: result.bitcoin?.timestamp ? new Date(result.bitcoin.timestamp * 1000).toISOString() : null,
        attestation: {
          type: 'BitcoinBlockHeaderAttestation',
          time: result.bitcoin?.timestamp ? new Date(result.bitcoin.timestamp * 1000).toISOString() : null
        }
      },
      verificationInstructions: {
        manual: 'Para verificar manualmente:',
        steps: [
          '1. Visita https://opentimestamps.org',
          '2. Sube el archivo original y su correspondiente .ots',
          '3. Compara el hash del documento y los detalles del bloque'
        ],
        documentHash: documentHash,
        explorer: result.bitcoin?.height ? `https://blockstream.info/block-height/${result.bitcoin.height}` : null
      }
    };
    console.log('Verification info:', verificationInfo);
    return verificationInfo;
  } catch (error) {
    console.log('Verification not yet complete:', error);
    return {
      status: 'STAMPING',
      message: 'Pending confirmation in Bitcoin blockchain',
      documentHash: crypto.createHash('sha256').update(originalBuffer).digest('hex'),
      timestamp: null
    };
  }
};

module.exports = {
  generateTimestamp,
  verifyTimestamp
};