export type SelectOption = { value: string; label: string };

const countryCodes = [
  'AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ','BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BV','BW','BY','BZ','CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN','CO','CR','CU','CV','CW','CX','CY','CZ','DE','DJ','DK','DM','DO','DZ','EC','EE','EG','EH','ER','ES','ET','FI','FJ','FK','FM','FO','FR','GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY','HK','HM','HN','HR','HT','HU','ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT','JE','JM','JO','JP','KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ','LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY','MA','MC','MD','ME','MF','MG','MH','MK','ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ','NA','NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ','OM','PA','PE','PF','PG','PH','PK','PL','PM','PN','PR','PS','PT','PW','PY','QA','RE','RO','RS','RU','RW','SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SY','SZ','TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO','TR','TT','TV','TW','TZ','UA','UG','UM','US','UY','UZ','VA','VC','VE','VG','VI','VN','VU','WF','WS','YE','YT','ZA','ZM','ZW',
];

const regionNames = new Intl.DisplayNames(['en-GB'], { type: 'region' });

export const marketOptions: SelectOption[] = [
  'Global','Africa','Southern Africa','East Africa','West Africa','Europe','European Union','Middle East','North America','Latin America','Asia-Pacific',
].map(value => ({ value, label: value })).concat(
  countryCodes
    .map(code => ({ value: regionNames.of(code) || code, label: `${regionNames.of(code) || code} (${code})` }))
    .sort((a, b) => a.value.localeCompare(b.value)),
);

export const currencyOptions: SelectOption[] = [
  ['AED','UAE dirham'],['AUD','Australian dollar'],['BWP','Botswana pula'],['CAD','Canadian dollar'],['CHF','Swiss franc'],['CNY','Chinese yuan'],['DKK','Danish krone'],['EUR','Euro'],['GBP','Pound sterling'],['GHS','Ghanaian cedi'],['HKD','Hong Kong dollar'],['INR','Indian rupee'],['JPY','Japanese yen'],['KES','Kenyan shilling'],['MUR','Mauritian rupee'],['MZN','Mozambican metical'],['NAD','Namibian dollar'],['NGN','Nigerian naira'],['NOK','Norwegian krone'],['NZD','New Zealand dollar'],['QAR','Qatari riyal'],['SAR','Saudi riyal'],['SEK','Swedish krona'],['SGD','Singapore dollar'],['SZL','Swazi lilangeni'],['TZS','Tanzanian shilling'],['UGX','Ugandan shilling'],['USD','US dollar'],['XOF','West African CFA franc'],['ZAR','South African rand'],['ZMW','Zambian kwacha'],['ZWL','Zimbabwe Gold'],
].map(([value, label]) => ({ value, label: `${value} — ${label}` }));
