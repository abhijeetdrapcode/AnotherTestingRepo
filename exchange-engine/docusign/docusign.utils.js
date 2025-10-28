import { parseValueFromData } from 'drapcode-utility';
import { htmlToText } from 'html-to-text';
import PDFDocument from 'pdfkit';
import { saveCollectionItem } from '../item/item.service';
import { normalizeEmails } from '../email/email.service';
import { findOneCollectionService } from '../collection/collection.service';

export const findMyText = function (needle, replacement, haystackText) {
  const match = new RegExp(needle, 'ig');
  if (replacement && replacement.length > 0) {
    return haystackText.replace(match, replacement);
  } else {
    replacement = ''; //Set empty value
    return haystackText.replace(match, replacement);
  }
};

export const textToPdf = async (textContent) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      let buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        const pdfBase64 = pdfData.toString('base64');
        resolve(pdfBase64);
      });
      doc.text(textContent);
      doc.end();
    } catch (error) {
      console.error('Error:', error);
      reject(error);
    }
  });
};

export const htmlToPdf = async (htmlContent) => {
  try {
    const textContent = htmlToText(htmlContent, {
      wordwrap: 130,
    });
    const PDFDocument = await textToPdf(textContent);
    return PDFDocument;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};

export const getNameToSendEmail = (
  nameFields,
  itemDataOfTemplateCollection,
  projectConstants,
  user,
) => {
  let names = [];
  nameFields.forEach((field) => {
    const { fieldFrom, fieldName, name } = JSON.parse(field);
    let nameFieldValue = '';
    if (fieldFrom === 'collection') {
      nameFieldValue = parseValueFromData(itemDataOfTemplateCollection, fieldName || name);
    } else if (fieldFrom === 'projectConstant' && name) {
      const nameConstant = projectConstants ? projectConstants.find((e) => e.name === name) : '';
      nameFieldValue = nameConstant?.value;
    } else if (fieldFrom === 'session' && user) {
      nameFieldValue = parseValueFromData(user, fieldName || name);
    }

    if (nameFieldValue && typeof nameFieldValue === 'string') {
      names.push(nameFieldValue);
    }
  });
  return names;
};

export const handleDocusignActivityTrackers = async (
  db,
  projectId,
  enableAuditTrail,
  headers,
  response,
  user,
  emailSubject,
  emailBody,
  environment,
  envelopeId,
  envelopeStatus,
) => {
  response = response[0];
  const collectionData = await findOneCollectionService(projectId, 'docusign_activity_tracker');
  if (!collectionData) return;
  const normalizedSendTo = normalizeEmails(response.sendTo);
  const normalizedCcTo = normalizeEmails(response.ccTo);
  const normalizedBccTo = normalizeEmails(response.bccTo);
  const itemData = {
    senderId: user?.uuid || '',
    sender: user?.userName || '',
    receiver: normalizedSendTo.join(','),
    bcc: normalizedBccTo.join(','),
    cc: normalizedCcTo.join(','),
    contentLength: emailBody?.length || '',
    templateId: response?.templateId || '',
    subject: emailSubject || '',
    status: envelopeStatus,
    envelopeId: envelopeId,
    errorMessage: response?.error || '',
  };
  await saveCollectionItem(
    db,
    projectId,
    enableAuditTrail,
    collectionData,
    itemData,
    user,
    headers,
    environment,
  );
};

export const mapRecipientsToRecords = (recipients, docusignResponse) => {
  const { envelopeId, status, statusDateTime } = docusignResponse;
  const mapCategory = (list, category) => {
    return list.map((person) => ({
      envelopeId,
      status,
      statusDateTime,
      email: person.email,
      name: person.name,
      recipientId: person.recipientId,
      routingOrder: person.routingOrder,
      roleName: person.roleName,
      recipientType: category,
    }));
  };

  return [
    ...mapCategory(recipients.signers, 'signer'),
    ...mapCategory(recipients.carbonCopies, 'carbonCopy'),
    ...mapCategory(recipients.certifiedDeliveries, 'certifiedDelivery'),
  ];
};

export const flattenRecipientsResponse = (recipientsResponse, envelopeId) => {
  const result = [];

  const pushRecipients = (array) => {
    if (!Array.isArray(array)) return;
    array.forEach((r) => {
      result.push({ ...r, envelopeId });
    });
  };
  pushRecipients(recipientsResponse.signers);
  pushRecipients(recipientsResponse.carbonCopies);
  pushRecipients(recipientsResponse.certifiedDeliveries);
  return result;
};
