import { generateQRService } from './qr.service';

export const generateQR = async (req, res, next) => {
  try {
    const { db, projectId, environment, body, enableAuditTrail, headers, user } = req;
    const { itemId, collection, dataField, saveQRField, codeType } = body;
    const response = await generateQRService(
      db,
      projectId,
      environment,
      enableAuditTrail,
      headers,
      user,
      itemId,
      collection,
      dataField,
      saveQRField,
      codeType,
    );
    return res.status(response.code).send(response);
  } catch (error) {
    console.error('Error generating QR code:', error);
    next(error);
  }
};
