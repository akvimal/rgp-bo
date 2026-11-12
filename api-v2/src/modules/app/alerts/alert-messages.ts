export type Lang = 'en' | 'ta';
export const LANGUAGES: Lang[] = ['en', 'ta'];

interface Message { title: string; body: string; }

/**
 * What each alert says, in each language. A notification stores only its code and parameters; the words are chosen when it is
 * read, so one alert shows in the reader's own language. Anything missing in a language falls back to English.
 * The Tamil is a draft for a native speaker to review before it ships.
 */
const CATALOGUE: Record<string, Record<Lang, Message>> = {
  deposit_due_amount: {
    en: { title: 'Bank deposit due: {store}', body: 'The cash balance is {balance}, which is {excess} over the limit. Bank it and record the deposit.' },
    ta: { title: 'வங்கியில் பணம் செலுத்த வேண்டும்: {store}', body: 'பண இருப்பு {balance}; வரம்பை விட {excess} அதிகம். வங்கியில் செலுத்தி பதிவு செய்யவும்.' },
  },
  deposit_due_schedule: {
    en: { title: 'Bank deposit due: {store}', body: 'Cash of {balance} has not been banked since {since}. Bank it and record the deposit.' },
    ta: { title: 'வங்கியில் பணம் செலுத்த வேண்டும்: {store}', body: '{balance} பணம் {since} முதல் வங்கியில் செலுத்தப்படவில்லை. வங்கியில் செலுத்தி பதிவு செய்யவும்.' },
  },
  deposit_due_amount_vault: {
    en: { title: 'Bank deposit due: {store}', body: 'The vault holds {balance}, which is {excess} over the limit. Bank it from the vault page.' },
    ta: { title: 'வங்கியில் பணம் செலுத்த வேண்டும்: {store}', body: 'பெட்டகத்தில் {balance} உள்ளது; வரம்பை விட {excess} அதிகம். பெட்டகப் பக்கத்திலிருந்து வங்கியில் செலுத்தவும்.' },
  },
  deposit_due_schedule_vault: {
    en: { title: 'Bank deposit due: {store}', body: 'The vault holds {balance}, not banked since {since}. Bank it from the vault page.' },
    ta: { title: 'வங்கியில் பணம் செலுத்த வேண்டும்: {store}', body: 'பெட்டகத்தில் {balance} உள்ளது; {since} முதல் வங்கியில் செலுத்தப்படவில்லை. பெட்டகப் பக்கத்திலிருந்து வங்கியில் செலுத்தவும்.' },
  },
  licence_expiring: {
    en: { title: '{type} licence ends on {date}: {store}', body: '{days} days left. Renew it and add the new dates under Store settings.' },
    ta: { title: '{type} உரிமம் {date} அன்று முடிகிறது: {store}', body: '{days} நாட்கள் மீதமுள்ளன. புதுப்பித்து புதிய தேதிகளை கடை அமைப்புகளில் சேர்க்கவும்.' },
  },
  licence_expired: {
    en: { title: '{type} licence ended on {date}: {store}', body: 'It ended {days} days ago. Renew it and add the new dates under Store settings.' },
    ta: { title: '{type} உரிமம் {date} அன்று முடிந்துவிட்டது: {store}', body: '{days} நாட்களுக்கு முன் முடிந்தது. புதுப்பித்து புதிய தேதிகளை கடை அமைப்புகளில் சேர்க்கவும்.' },
  },
  registration_expiring: {
    en: { title: 'Pharmacist registration ends on {date}: {person}', body: '{days} days left. Update the registration under Users once it is renewed.' },
    ta: { title: 'மருந்தாளர் பதிவு {date} அன்று முடிகிறது: {person}', body: '{days} நாட்கள் மீதமுள்ளன. புதுப்பித்த பின் பயனர்கள் பகுதியில் பதிவைப் புதுப்பிக்கவும்.' },
  },
  registration_expired: {
    en: { title: 'Pharmacist registration ended on {date}: {person}', body: 'It ended {days} days ago. Update the registration under Users once it is renewed.' },
    ta: { title: 'மருந்தாளர் பதிவு {date} அன்று முடிந்துவிட்டது: {person}', body: '{days} நாட்களுக்கு முன் முடிந்தது. புதுப்பித்த பின் பயனர்கள் பகுதியில் பதிவைப் புதுப்பிக்கவும்.' },
  },
  gst_rate_change_soon: {
    en: { title: 'GST changes on {date}: {what}', body: 'GST becomes {rate}% in {days} days. Review the stock and prices it affects under GST > Rate changes, and decide whether to pass the saving on to customers.' },
    ta: { title: 'ஜிஎஸ்டி {date} அன்று மாறுகிறது: {what}', body: 'ஜிஎஸ்டி {days} நாட்களில் {rate}% ஆக மாறுகிறது. பாதிக்கப்படும் இருப்பு மற்றும் விலைகளை ஜிஎஸ்டி > விகித மாற்றங்களில் பார்த்து, சேமிப்பை வாடிக்கையாளர்களுக்கு வழங்குவதா என்பதை முடிவு செய்யவும்.' },
  },
  gst_filing_due: {
    en: { title: 'GST for {month} is not closed', body: 'The usual date to file {month} is the 11th, in {days} days. Close the month under GST once the return is filed.' },
    ta: { title: '{month} க்கான ஜிஎஸ்டி மூடப்படவில்லை', body: '{month} தாக்கல் செய்ய வழக்கமான தேதி 11, {days} நாட்களில். வருமானம் தாக்கல் செய்த பின் ஜிஎஸ்டி பக்கத்தில் மாதத்தை மூடவும்.' },
  },
  gst_filing_late: {
    en: { title: 'GST for {month} is past the usual date', body: 'The usual date to file {month} was the 11th, {days} days ago, and the month is not closed. File it and close the month under GST.' },
    ta: { title: '{month} க்கான ஜிஎஸ்டி வழக்கமான தேதியைக் கடந்துவிட்டது', body: '{month} தாக்கல் செய்ய வழக்கமான தேதி 11, {days} நாட்களுக்கு முன், மாதம் மூடப்படவில்லை. தாக்கல் செய்து ஜிஎஸ்டி பக்கத்தில் மாதத்தை மூடவும்.' },
  },
  shift_open_long: {
    en: { title: 'A shift is still open: {store}', body: '{name} has been open for {hours} hours. Close it to count the cash.' },
    ta: { title: 'ஒரு ஷிப்ட் இன்னும் திறந்திருக்கிறது: {store}', body: '{name} {hours} மணி நேரமாகத் திறந்துள்ளது. பணத்தை எண்ண அதை மூடவும்.' },
  },
  compliance_escalated: {
    en: { title: '{item} has gone {days} days without being done: {store}', body: 'It was due on {date}. Open Compliance to see who owns it, and either get it done or decide on a waiver.' },
    ta: { title: '{item} {days} நாட்களாக செய்யப்படவில்லை: {store}', body: '{date} அன்று செய்ய வேண்டியது. இணக்கம் பக்கத்தில் யாருடையது என்று பார்த்து, செய்து முடிக்கவும் அல்லது விலக்கு குறித்து முடிவு செய்யவும்.' },
  },
  compliance_parked: {
    en: { title: 'A parked bill is still waiting: {store}', body: 'A bill parked on {date} has not been finished or discarded. Ask whoever parked it to complete it or discard it.' },
    ta: { title: 'நிறுத்தி வைத்த பில் இன்னும் காத்திருக்கிறது: {store}', body: '{date} அன்று நிறுத்தி வைத்த பில் முடிக்கப்படவில்லை அல்லது நீக்கப்படவில்லை. நிறுத்தியவரிடம் அதை முடிக்க அல்லது நீக்கச் சொல்லுங்கள்.' },
  },
  customer_reveals_many: {
    en: { title: '{person} has shown {count} customers\' details in {hours} hours', body: 'Showing full contact details is meant for serving a customer, a few at a time. Ask {person} what it was for, and check the reveal log in the audit trail.' },
    ta: { title: '{person} {hours} மணி நேரத்தில் {count} வாடிக்கையாளர் விவரங்களைக் காட்டியுள்ளார்', body: 'முழு தொடர்பு விவரங்களைக் காட்டுவது வாடிக்கையாளருக்குச் சேவை செய்ய, சிலவற்றுக்கு மட்டும். {person} இடம் இது எதற்கு என்று கேட்டு, தணிக்கைப் பதிவில் காட்டிய பதிவைப் பார்க்கவும்.' },
  },
  customer_lookups_many: {
    en: { title: '{person} has looked up {count} customers in {hours} hours', body: 'That is far more than serving customers needs, and can mean numbers are being read out one by one. Ask {person} about it.' },
    ta: { title: '{person} {hours} மணி நேரத்தில் {count} வாடிக்கையாளர்களைத் தேடியுள்ளார்', body: 'வாடிக்கையாளருக்குச் சேவை செய்ய இது தேவையானதை விட மிக அதிகம்; எண்கள் ஒவ்வொன்றாகப் படிக்கப்படுவதாக இருக்கலாம். {person} இடம் கேளுங்கள்.' },
  },
  customer_data_taken: {
    en: { title: '{person} downloaded or tried to print customer data {count} times in {hours} hours', body: 'Downloads and print attempts are kept in the audit trail. Check what was taken and why.' },
    ta: { title: '{person} {hours} மணி நேரத்தில் வாடிக்கையாளர் தரவை {count} முறை பதிவிறக்கினார் அல்லது அச்சிட முயன்றார்', body: 'பதிவிறக்கங்களும் அச்சு முயற்சிகளும் தணிக்கைப் பதிவில் உள்ளன. எது எடுக்கப்பட்டது, ஏன் என்று பாருங்கள்.' },
  },
  weekly_review_unsigned: {
    en: { title: 'Weekly review not signed: {store}', body: 'The week starting {date} has not been reviewed. Check its discounts, cancelled bills and returns, then sign it on the Weekly review page.' },
    ta: { title: 'வாராந்திர மதிப்பாய்வு கையொப்பமிடப்படவில்லை: {store}', body: '{date} அன்று தொடங்கிய வாரம் மதிப்பாய்வு செய்யப்படவில்லை. அதன் தள்ளுபடிகள், ரத்து செய்த பில்கள் மற்றும் திருப்பங்களைச் சரிபார்த்து, வாராந்திர மதிப்பாய்வுப் பக்கத்தில் கையொப்பமிடவும்.' },
  },
  stock_count_overdue: {
    en: { title: 'No stock count for {days} days: {store}', body: 'The last completed count was on {date}. Start the next category count.' },
    ta: { title: '{days} நாட்களாக இருப்பு எண்ணிக்கை இல்லை: {store}', body: 'கடைசியாக முடிந்த எண்ணிக்கை {date}. அடுத்த வகை எண்ணிக்கையைத் தொடங்கவும்.' },
  },
  customer_request_arrived: {
    en: { title: '{product} has arrived for {customer}', body: '{qty} received at {store}. Call {customer} {phone} and then close the request on the Requests page.' },
    ta: { title: '{customer} கேட்ட {product} வந்துவிட்டது', body: '{store} இல் {qty} பெறப்பட்டது. {customer} {phone} ஐ அழைத்து, பின்னர் கோரிக்கைகள் பக்கத்தில் கோரிக்கையை மூடவும்.' },
  },
  stock_count_never: {
    en: { title: 'No stock count has ever been completed: {store}', body: 'Book stock has never been checked against the shelf. Start a count.' },
    ta: { title: 'இதுவரை இருப்பு எண்ணிக்கை முடிக்கப்படவில்லை: {store}', body: 'புத்தக இருப்பு அலமாரியுடன் ஒருபோதும் சரிபார்க்கப்படவில்லை. எண்ணிக்கையைத் தொடங்கவும்.' },
  },
  negative_stock: {
    en: { title: 'Products with negative stock: {count}', body: 'More was sold or written off than was bought for {count} products ({units} units short). Enter the missing purchases or count them.' },
    ta: { title: 'எதிர்மறை இருப்பு உள்ள பொருட்கள்: {count}', body: '{count} பொருட்களுக்கு வாங்கியதை விட அதிகம் விற்கப்பட்டது அல்லது கழிக்கப்பட்டது ({units} அலகுகள் குறைவு). விடுபட்ட கொள்முதலை உள்ளிடவும் அல்லது எண்ணவும்.' },
  },
  expired_stock: {
    en: { title: 'Expired stock on the shelf: {value}', body: '{batches} batches are past their expiry date and still count as stock. Pull them and return or write them off.' },
    ta: { title: 'அலமாரியில் காலாவதியான இருப்பு: {value}', body: '{batches} தொகுதிகள் காலாவதி தேதியைத் தாண்டியும் இருப்பில் உள்ளன. அவற்றை எடுத்து திருப்பி அனுப்பவும் அல்லது கழிக்கவும்.' },
  },
  disposal_unconfirmed: {
    en: { title: 'Out-pass {pass} approved {days} days ago: goods not confirmed gone ({store})', body: '{qty} units are held: still on the books, not saleable. Hand the goods over or destroy them, then confirm the out-pass so the stock drops (or cancel it if it will not go ahead).' },
    ta: { title: 'வெளியேற்ற அனுமதி {pass} {days} நாட்களுக்கு முன் ஒப்புதல்: பொருட்கள் வெளியேறியதாக உறுதிப்படுத்தவில்லை ({store})', body: '{qty} அலகுகள் நிறுத்தி வைக்கப்பட்டுள்ளன: கணக்கில் உள்ளன, விற்க முடியாது. பொருட்களை ஒப்படைத்து அல்லது அழித்து, பின் அனுமதியை உறுதிப்படுத்தவும் (நடக்காவிட்டால் ரத்து செய்யவும்).' },
  },
  adjustment_other: {
    en: { title: 'Unexplained write-offs: {value} in 30 days', body: '{count} adjustments were given the reason "Other". Ask for the proper reason on each.' },
    ta: { title: 'விளக்கமில்லாத கழிவுகள்: 30 நாட்களில் {value}', body: '{count} மாற்றங்களுக்கு "Other" என்ற காரணம் கொடுக்கப்பட்டுள்ளது. ஒவ்வொன்றிற்கும் சரியான காரணத்தைக் கேட்கவும்.' },
  },
  todo_soon: {
    en: { title: 'To-do coming up on {date}: {title}', body: 'Open the To-dos page to do it, or change the day.' },
    ta: { title: '{date} அன்று செய்ய வேண்டியது: {title}', body: 'செய்ய வேண்டியவை பக்கத்தைத் திறந்து செய்யவும் அல்லது நாளை மாற்றவும்.' },
  },
  todo_due: {
    en: { title: 'To-do due now: {title}', body: 'It is due on {date}. Tick it off on the To-dos page when it is done.' },
    ta: { title: 'இப்போது செய்ய வேண்டியது: {title}', body: '{date} அன்று செய்ய வேண்டியது. முடிந்ததும் செய்ய வேண்டியவை பக்கத்தில் குறிக்கவும்.' },
  },
  todo_overdue: {
    en: { title: 'To-do is {days} days late: {title}', body: 'It was due on {date}. Do it, or change the day.' },
    ta: { title: 'செய்ய வேண்டியது {days} நாட்கள் தாமதம்: {title}', body: '{date} அன்று செய்திருக்க வேண்டும். செய்து முடிக்கவும் அல்லது நாளை மாற்றவும்.' },
  },
  todo_escalated: {
    en: { title: 'To-do {days} days late: {title}', body: '{person} has not done it yet. It was due on {date}.' },
    ta: { title: 'செய்ய வேண்டியது {days} நாட்கள் தாமதம்: {title}', body: '{person} இன்னும் செய்யவில்லை. {date} அன்று செய்திருக்க வேண்டும்.' },
  },
  feedback_reply: {
    en: { title: 'Reply to your report: {title}', body: 'There is a reply or a change of status ({status}). Open Help and feedback to read it.' },
    ta: { title: 'உங்கள் அறிக்கைக்குப் பதில்: {title}', body: 'ஒரு பதில் அல்லது நிலை மாற்றம் ({status}) உள்ளது. படிக்க உதவி மற்றும் கருத்து பக்கத்தைத் திறக்கவும்.' },
  },
  feedback_waiting: {
    en: { title: 'Report waiting for an answer: {title}', body: '{person} sent a {kind} about {module}. Open the Inbox in Help and feedback to reply.' },
    ta: { title: 'பதிலுக்காகக் காத்திருக்கும் அறிக்கை: {title}', body: '{person} {module} பற்றி ஒரு {kind} அனுப்பினார். பதில் அளிக்க உதவி மற்றும் கருத்து பக்கத்தின் பெட்டியைத் திறக்கவும்.' },
  },
  kpi_behind: {
    en: { title: 'KPI behind pace: {measure}', body: '{evidence}. At this point in the month you are at {progress}% of the pace needed. Have a look at My KPI to see what to do.' },
    ta: { title: 'KPI பின்தங்கியுள்ளது: {measure}', body: '{evidence}. மாதத்தின் இந்த நிலையில் தேவையான வேகத்தில் {progress}% மட்டுமே உள்ளது. என் KPI பக்கத்தில் பார்க்கவும்.' },
  },
  kpi_rating_due: {
    en: { title: 'KPI ratings to give for {period}: {count}', body: '{count} ratings that only a manager can give are still missing, and payroll is waiting. Open Rate staff.' },
    ta: { title: '{period} க்கான KPI மதிப்பீடுகள்: {count}', body: 'மேலாளர் மட்டுமே கொடுக்கக்கூடிய {count} மதிப்பீடுகள் இன்னும் இல்லை; சம்பளம் காத்திருக்கிறது. ஊழியர் மதிப்பீடு பக்கத்தைத் திறக்கவும்.' },
  },
  outage_kit_overdue: {
    en: { title: 'Outage kit not checked for {days} days: {store}', body: 'Last checked on {date}. Tick off the weekly checklist on the Outage kit page and print a fresh price list.' },
    ta: { title: 'மின்தடை தயார்நிலை {days} நாட்களாகச் சரிபார்க்கப்படவில்லை: {store}', body: 'கடைசியாகச் சரிபார்த்தது {date}. மின்தடை தயார்நிலைப் பக்கத்தில் வாராந்திரப் பட்டியலைச் சரிபார்த்து புதிய விலைப் பட்டியலை அச்சிடவும்.' },
  },
  outage_kit_never: {
    en: { title: 'Outage kit has never been checked: {store}', body: 'If the power goes, billing stops. Open the Outage kit page, tick off the checklist and print the price list.' },
    ta: { title: 'மின்தடை தயார்நிலை இதுவரை சரிபார்க்கப்படவில்லை: {store}', body: 'மின்சாரம் போனால் பில்லிங் நின்றுவிடும். மின்தடை தயார்நிலைப் பக்கத்தைத் திறந்து பட்டியலைச் சரிபார்த்து விலைப் பட்டியலை அச்சிடவும்.' },
  },
  pricing_cuts: {
    en: { title: 'Prices above the legal limit: {count}', body: '{count} products are priced so that a bill would charge more than the MRP. Bring them down in Products > Pricing policy.' },
    ta: { title: 'சட்ட வரம்பை மீறிய விலைகள்: {count}', body: '{count} பொருட்களின் விலை, பில் MRP ஐ விட அதிகமாக வசூலிக்கும்படி உள்ளது. பொருட்கள் > விலைக் கொள்கையில் குறைக்கவும்.' },
  },
  pricing_raises: {
    en: { title: 'Prices out of policy: {count}', body: '{count} products are below their floor markup or deeper than their discount cap ({held} held for the next step). Review them in Products > Pricing policy.' },
    ta: { title: 'விலைக் கொள்கையை மீறிய விலைகள்: {count}', body: '{count} பொருட்கள் குறைந்தபட்ச லாப வரம்புக்குக் கீழே அல்லது அனுமதித்த தள்ளுபடியை விட அதிகமாக உள்ளன ({held} அடுத்த படிக்காகக் காத்திருக்கின்றன). பொருட்கள் > விலைக் கொள்கையில் பார்க்கவும்.' },
  },
  pricing_unpriced: {
    en: { title: 'Products with stock and no price: {count}', body: '{count} products are in stock but have no sale price, so they cannot be sold properly. Give them the suggested price in Products > Pricing policy.' },
    ta: { title: 'இருப்பு உள்ள ஆனால் விலை இல்லாத பொருட்கள்: {count}', body: '{count} பொருட்கள் இருப்பில் உள்ளன ஆனால் விற்பனை விலை இல்லை, அதனால் சரியாக விற்க முடியாது. பொருட்கள் > விலைக் கொள்கையில் பரிந்துரைத்த விலையை வழங்கவும்.' },
  },
  pricing_check: {
    en: { title: 'Products to check: {count}', body: '{count} products have a pack size or cost that looks wrong, so their prices cannot be judged. Check them in Products > Pack check.' },
    ta: { title: 'சரிபார்க்க வேண்டிய பொருட்கள்: {count}', body: '{count} பொருட்களின் பேக் அளவு அல்லது விலை தவறாகத் தெரிகிறது, அதனால் அவற்றின் விலையை மதிப்பிட முடியவில்லை. பொருட்கள் > பேக் சரிபார்ப்பில் பார்க்கவும்.' },
  },
  approvals_pending: {
    en: { title: '{count} stock adjustments waiting for approval: {store}', body: 'The oldest has waited {hours} hours.' },
    ta: { title: '{count} இருப்பு மாற்றங்கள் ஒப்புதலுக்குக் காத்திருக்கின்றன: {store}', body: 'பழமையானது {hours} மணி நேரமாகக் காத்திருக்கிறது.' },
  },
  approvals_pending_one: {
    en: { title: 'A stock adjustment is waiting for approval: {store}', body: 'It has waited {hours} hours.' },
    ta: { title: 'ஒரு இருப்பு மாற்றம் ஒப்புதலுக்குக் காத்திருக்கிறது: {store}', body: '{hours} மணி நேரமாகக் காத்திருக்கிறது.' },
  },
};

export const MESSAGE_CODES = Object.keys(CATALOGUE);

const money = (n: any) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

/** the kinds of store licence, named for a person */
const LICENCE_TYPES: Record<string, Record<Lang, string>> = {
  RETAIL_20_21: { en: 'Retail drug', ta: 'சில்லறை மருந்து' },
  SHOP_EST: { en: 'Shop and establishment', ta: 'கடை மற்றும் நிறுவனம்' },
  TRADE: { en: 'Trade', ta: 'வர்த்தக' },
  WHOLESALE_20B_21B: { en: 'Wholesale drug', ta: 'மொத்த மருந்து' },
  FSSAI: { en: 'FSSAI', ta: 'FSSAI' },
  OTHER: { en: 'Other', ta: 'பிற' },
};

/** the value of a parameter as it reads in a message: money, dates as 12 Nov 2026, licence kinds by name, the rest as is */
function show(key: string, v: any, lang: Lang): string {
  if (v === null || v === undefined) return '';
  if (key === 'type' && LICENCE_TYPES[String(v)]) return LICENCE_TYPES[String(v)][lang];
  if (['balance', 'excess', 'value'].includes(key)) return money(v);
  if (['date', 'since'].includes(key) && /^\d{4}-\d{2}-\d{2}/.test(String(v))) {
    const d = new Date(String(v).slice(0, 10) + 'T00:00:00Z');
    return `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  return String(v);
}

/** the title and body of an alert in the reader's language (English when there is no text in that language) */
export function render(code: string, params: Record<string, any>, lang: Lang | string = 'en'): Message {
  const entry = CATALOGUE[code];
  if (!entry) return { title: code, body: '' };
  const m = entry[lang as Lang] || entry.en;
  const l: Lang = entry[lang as Lang] ? (lang as Lang) : 'en';
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (_, k) => show(k, params?.[k], l));
  return { title: fill(m.title), body: fill(m.body) };
}
