import moment from 'moment';

export const preparePayloadForCibilRequest = async (
  data,
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
  credentials,
  dateFormat,
) => {
  const { memberRefId, enquiryMemberUserId, enquiryPassword } = credentials;
  const firstName = data[firstNameField] || '';
  const middleName = data[middleNameField] || '';
  const lastName = data[lastNameField] || '';
  const birthDate = data[birthDateField] || '';
  const gender = data[genderField] || '';
  const panNumber = data[panNumberField] || '';
  let telephoneNumber = data[telephoneNumberField] || '';
  if (!telephoneNumber || !telephoneNumber.startsWith('+91')) {
    return { code: 400, message: 'Mobile number must include country code +91' };
  }
  telephoneNumber = telephoneNumber.replace(/^\+91[\s-]*/, '').replace(/\s+/g, '');
  const line1 = data[lineOneField] || '';
  const line2 = data[lineTwoField] || '';
  const state = data[stateField] || '';
  const pinCode = data[pinCodeField] || '';
  const stateCode = stateCodesMapping[state] || '';
  const genderCode = genderMapping[gender] || '0';
  let formattedBirthDate = '';
  if (birthDate) {
    const parsedDate = moment(birthDate, dateFormat, true);
    if (!parsedDate.isValid()) {
      return {
        code: 400,
        message: `Invalid date format: expected ${dateFormat}, got ${birthDate}`,
      };
    }
    formattedBirthDate = parsedDate.format('DDMMYYYY');
  }
  return {
    serviceCode: 'CAS10001',
    monitoringDate: new Date().toISOString().slice(0, 10).split('-').join(''),
    consumerInputSubject: {
      tuefHeader: {
        headerType: 'TUEF',
        version: '12',
        memberRefNo: memberRefId,
        gstStateCode: stateCode,
        enquiryMemberUserId,
        enquiryPassword,
        enquiryPurpose: '10',
        enquiryAmount: '000049500',
        scoreType: '08',
        outputFormat: '03',
        responseSize: '1',
        ioMedia: 'CC',
        authenticationMethod: 'L',
      },
      names: [
        {
          index: 'N01',
          firstName,
          middleName,
          lastName,
          birthDate: formattedBirthDate,
          gender: genderCode,
        },
      ],
      ids: [
        {
          index: 'I01',
          idNumber: panNumber,
          idType: '01',
        },
      ],
      telephones: [
        {
          index: 'T01',
          telephoneNumber,
          telephoneType: '01',
        },
      ],
      addresses: [
        {
          index: 'A01',
          line1,
          line2,
          stateCode,
          pinCode,
          addressCategory: '01',
          residenceCode: '01',
        },
      ],
    },
  };
};

const stateCodesMapping = {
  'Jammu & Kashmir': '01',
  'Himachal Pradesh': '02',
  Punjab: '03',
  Chandigarh: '04',
  Uttarakhand: '05',
  Haryana: '06',
  Delhi: '07',
  Rajasthan: '08',
  'Uttar Pradesh': '09',
  Bihar: '10',
  Sikkim: '11',
  'Arunachal Pradesh': '12',
  Nagaland: '13',
  Manipur: '14',
  Mizoram: '15',
  Tripura: '16',
  Meghalaya: '17',
  Assam: '18',
  'West Bengal': '19',
  Jharkhand: '20',
  Odisha: '21',
  Chhattisgarh: '22',
  'Madhya Pradesh': '23',
  Gujarat: '24',
  'Daman & Diu': '25',
  'Dadra & Nagar Haveli': '26',
  Maharashtra: '27',
  'Andhra Pradesh': '28',
  Karnataka: '29',
  Goa: '30',
  Lakshadweep: '31',
  Kerala: '32',
  'Tamil Nadu': '33',
  Pondicherry: '34',
  'Andaman & Nicobar Islands': '35',
  Telangana: '36',
  Ladakh: '38',
  'APO Address': '99',
};

const genderMapping = {
  'Not Disclosed': '0',
  Female: '1',
  Male: '2',
  Transgender: '3',
};
