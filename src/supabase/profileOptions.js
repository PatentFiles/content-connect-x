/** ISO 3166-1 country choices. The US is intentionally first; all other countries follow alphabetically. */
const ISO_CODES=`AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW XK`.split(' ');
const display=new Intl.DisplayNames(['en'],{type:'region'});
export const countries=ISO_CODES.map(code=>({code,name:display.of(code)||code})).sort((a,b)=>
 a.code==='US'?-1:b.code==='US'?1:a.name.localeCompare(b.name)
);
const named=(list)=>list.split('|');
export const regionOptions={
 US:named('Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|District of Columbia|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming'),
 CA:named('Alberta|British Columbia|Manitoba|New Brunswick|Newfoundland and Labrador|Northwest Territories|Nova Scotia|Nunavut|Ontario|Prince Edward Island|Quebec|Saskatchewan|Yukon'),
 AU:named('Australian Capital Territory|New South Wales|Northern Territory|Queensland|South Australia|Tasmania|Victoria|Western Australia'),
 GB:named('England|Northern Ireland|Scotland|Wales'),
};
export const countryName=code=>countries.find(c=>c.code===code)?.name||'United States';
export const countryCode=value=>countries.find(c=>c.code===value||c.name.toLowerCase()===String(value||'').toLowerCase())?.code||
 ({USA:'US',UK:'GB','United States of America':'US'}[value]||'US');
export const roleOptions=[
 ['creator','Creator / performer'],['photographer','Photographer'],
 ['videographer','Videographer'],['video_editor','Video editor'],
 ['agent','Agent / manager'],['studio','Studio / production team']
];
export const genderOptions=[
 ['','Prefer not to say'],['man','Man'],['woman','Woman'],
 ['trans_man','Trans man'],['trans_woman','Trans woman'],
 ['nonbinary','Nonbinary'],['genderfluid','Genderfluid'],
 ['self_describe','Self-describe']
];
export const orientationOptions=[
 ['','Prefer not to say'],['straight','Straight'],['gay','Gay'],
 ['lesbian','Lesbian'],['bisexual','Bisexual'],['pansexual','Pansexual'],
 ['queer','Queer'],['asexual','Asexual'],['questioning','Questioning'],
 ['self_describe','Self-describe']
];
export const contentCategories=[
 ['standard','Standard / mainstream'],['fetish','Fetish'],['kink_edge','Kink / BDSM']
];
export const scenePairings=[
 ['solo','Solo'],['man_woman','Man / woman'],['woman_woman','Woman / woman'],
 ['man_man','Man / man'],['group','Group / ensemble'],['nonperforming','Behind the camera']
];
export const specialties=[
 ['performer','Performing'],['photography','Photography'],['videography','Videography'],
 ['editing','Editing'],['production','Production'],['styling','Styling'],
 ['studio_host','Hosting spaces'],['dungeon_host','Dungeon / specialty set hosting']
];
