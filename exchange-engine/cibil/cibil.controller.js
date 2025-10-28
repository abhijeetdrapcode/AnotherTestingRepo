import { getConsumerReportService } from './cibil.service';

export const getConsumerReport = async (req, res, next) => {
  try {
    const { body, projectId, db, environment, enableAuditTrail, headers, user, project } = req;
    const { dateFormat } = project;
    const {
      collection,
      firstNameField,
      middleNameField,
      lastNameField,
      birthDateField,
      genderField,
      panNumberField,
      telephoneNumberField,
      lineOneField,
      lineTwoField,
      stateField,
      pinCodeField,
      itemId,
      saveResponseField,
    } = body;
    if (!collection) return res.status(400).send({ code: 400, message: 'Collection is required' });
    if (!itemId) return res.status(400).send({ code: 400, message: 'Item ID is required' });
    const response = await getConsumerReportService(
      db,
      projectId,
      environment,
      enableAuditTrail,
      headers,
      user,
      collection,
      firstNameField,
      middleNameField,
      lastNameField,
      birthDateField,
      genderField,
      panNumberField,
      telephoneNumberField,
      lineOneField,
      lineTwoField,
      stateField,
      pinCodeField,
      itemId,
      saveResponseField,
      dateFormat,
    );
    return res.status(response.code).send(response);
  } catch (error) {
    console.error('Error in getConsumerReport:', error);
    next(error);
  }
};
