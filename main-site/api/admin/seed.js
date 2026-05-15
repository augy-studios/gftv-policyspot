// api/admin/seed.js
// URL pattern mirrors the live Gitbook at policy.globalfurry.tv:
//   /the-charter                     → charter index
//   /the-charter/citation            → Citation page
//   /the-charter/definitions         → Definitions page
//   /the-charter/article-i           → Article I (all subsections rendered inline)
//   /the-charter/article-i#name      → Article I, Name section (anchor)
//   /the-charter/first-schedule      → First Schedule page
//
// `anchor` = the id fragment for subsections within their parent article page.
// `parent_slug` = slug of the article this subsection belongs to.

const {
    getSupabaseClient
} = require('../../lib/supabase');
const {
    validateSession
} = require('../../lib/auth');
const {
    ok,
    err,
    handleOptions
} = require('../../lib/response');

const SECTIONS = [

    // ── Standalone pages ───────────────────────────────────────────────────────

    {
        number: null,
        title: 'Citation',
        slug: 'citation',
        anchor: null,
        type: 'page',
        parent_slug: null,
        order_index: 1,
        content: `This Charter may be cited as **"the Charter of Global Furry Television"** or **"the Charter."**`
    },

    {
        number: null,
        title: 'Definitions',
        slug: 'definitions',
        anchor: null,
        type: 'page',
        parent_slug: null,
        order_index: 2,
        content: `In this Charter, unless it is otherwise provided or the context otherwise requires, the following terms have the meanings assigned below.

**"Active electoral quorum"** means the total voting strength of all actively contributing Team Members and Officers eligible to vote under Section 23. An active vote-eligible Personnel is defined by, within the past two (2) months preceding a meeting:
- Consistent participation in projects, initiatives, or assigned responsibilities;
- Regular attendance or meaningful presence at meetings, where applicable;
- Active engagement in organisational communications, coordination, or support activities;
- Responsiveness and availability in carrying out responsibilities;
- Continuity and reliability in contributing to ongoing work;
- Any other relevant conduct demonstrating active involvement in the Organisation.

Exceptions include cases of extenuating circumstances, such as serious illness, injury or death of the Personnel or their immediate family; mental health, welfare, or safety-related crises; sudden loss of housing or urgent relocation needs; unexpected legal matters requiring significant attention; or other unforeseen circumstances deemed appropriate by Officers.

GFTV recognises that participation may vary due to personal, professional, or situational factors. Personnel who are not actively contributing shall not be penalised solely on that basis. However, the exercise of voting rights, influence in decision-making, and inclusion in quorum shall be limited to those who meet the criteria of active participation under this Charter.

Inactive Personnel shall retain their status within the Organisation but shall not exercise voting rights, be counted towards meeting quorums, or be required for the validity of any meeting or decision under this Charter, unless and until they meet the criteria of vote eligibility.

---

**"Bully"** means singular (ragging) or repeated acts (bullying) by one or more individuals that hurt or threaten others, be it for sexual or social reasons, through verbal, physical, social or cyber means, including but not limited to name-calling, insults, trolling, violence, discrimination, exclusion, shaming, harassment and threats, that causes physical or emotional harm to such person(s), places such person(s) in reasonable fear of harm to themselves, creates a hostile environment for such person(s), or substantially disrupts peace wherever the bullying takes place.

**"CCS Member"** means an individual part of the Core Content Support Team, who does not possess full-time membership of GFTV, but contributes to GFTV's content and initiatives in various roles and areas.

**"Court of law"** means the judicial institutions of the Republic of Singapore or whichever country or region related to the persons in dispute.

**"Furries"** mean participants of the furry fandom.

**"Furry fandom"** means a community interested in anthropomorphic characters and art.

**"Good standing"** refers to, overall, the Personnel's good commitment to GFTV's values, positive contribution to the Organization, and full compliance with the Charter and the Standards.

**"Law"** means the laws of the Republic of Singapore by default, or in such respect the laws of foreign countries implied in Section 18.3.

**"Letter of Acceptance"** or **"LOA"** means a letter confirming the acceptance of an applicant or CCS member as a personnel and full team member respectively.

**"Meeting"** means general meetings and extraordinary general meetings.

**"Officer"** means an individual who holds a position of authority in GFTV, is part of the Policy, Action and Leadership Division, and is listed in Section 17.

**"Personal identity and background"** includes, but is not limited to: their race, colour, sex, language, religion, national or social origin, property, age, nationality, marital status, disability, place of birth, place of residence within a country, sexual orientation and gender identity.

**"Personnel"** refers to Team Members, Officers and CCS Members as a whole.

**"Policy books"** refer to GFTV's set of rules and guidelines, which includes this Charter and the Standards.

**"Standards"** means specialised rules, policies, protocols, procedures, systems, or guidance governing GFTV's operations, conduct, ethics, administration, safety, accessibility, or content production, including but not limited to the Community Rules (CR), News Standards (NS), and Programme Rating System (PRS).

**"Team ID"** means a physical identification card usually worn with a lanyard that shows the fursona name, preferred photo, fursona species and customised digital name card of a Team Member or Officer of GFTV.

**"Team Member"** means a full-time member of GFTV who has completed their membership in the CCS Team and has been accepted into one of the four functional divisions of GFTV: CIO, CCS, MAWS, or PAL.`
    },

    // ── Article I ──────────────────────────────────────────────────────────────

    {
        number: 'I',
        title: 'Article I — Identity of GFTV',
        slug: 'article-i',
        anchor: null,
        type: 'article',
        parent_slug: null,
        order_index: 3,
        content: `This Article defines the identity of Global Furry Television, including its official name, operating languages, purpose, values, and objects.`
    },

    {
        number: 'I §1–5',
        title: 'Name',
        slug: 'article-i--name',
        anchor: 'name',
        type: 'subsection',
        parent_slug: 'article-i',
        order_index: 4,
        content: `The Name of this Organisation in the English language shall be **"Global Furry Television"**. Its acronym is **"GFTV"**.

The Chinese language version of the Name of this Organisation is 国际兽圈电视 (*Guójì shòu quān diànshì*), which can be used together with the English language version of the Name. Other variations are 国际兽视 (*Guójì shòushì*) and 兽视 (*Shòushì*).

The names stated in Sections 3 and 3.1 shall be used in all official documents, policies, and formal communications under this Charter.

The Organisation may be referred to in other languages for purposes of accessibility and communication. Such translations shall remain faithful to the official name stated in Section 3 and shall not constitute separate or alternative official names.

The Organisation may recognise specific translations for operational or public use. Any such recognised translation shall be approved and maintained by GFTV and shall remain anchored to the official name under this Charter.`
    },

    {
        number: 'I §6–12',
        title: 'Operating Languages',
        slug: 'article-i--operating-languages',
        anchor: 'operating-languages',
        type: 'subsection',
        parent_slug: 'article-i',
        order_index: 5,
        content: `GFTV's working languages shall be **English** and **Mandarin Chinese**.

English shall be the primary language for internal coordination, governance, and record-keeping. Mandarin Chinese shall be an equal working language.

Policies, standards, protocols, and official public resources shall be made available in both languages. If there are versions in both languages, they shall be treated as equal in intent. In the event of ambiguity or inconsistency, the English version shall prevail for the purposes of governance and interpretation under this Charter.

GFTV may produce content, communications, or materials in other languages where relevant to the intended audience, partner, or context. In GFTV Initiatives and Spaces, participants may communicate in any language as appropriate.`
    },

    {
        number: 'I §13–16',
        title: 'Purpose and Values',
        slug: 'article-i--purpose-and-values',
        anchor: 'purpose-and-values',
        type: 'subsection',
        parent_slug: 'article-i',
        order_index: 6,
        content: `This Section defines the purpose of GFTV and the values that shall guide all actions, decisions, and conduct under this Charter.

**The Purposes of GFTV** are to:
- "Produce and distribute furry fandom entertainment and news content", and
- "Facilitate cultural and community activity and exchange among participants of the furry fandom and communication between them and the general public."

**Core Identity Values:**

| Value | Chinese | Description |
|-------|---------|-------------|
| Genuine | 诚 | To serve the community with true dedication, rather than for social status. |
| Fairness | 正 | To ensure that all individuals are treated fairly and given equal opportunity, regardless of background. |
| Trust | 信 | To act with sincerity, reliability, and integrity, so as to earn and maintain the trust of the community. |
| Visionary | 前 | To explore new ways of bringing communities together and advancing GFTV's purpose. |

In carrying out its Purpose and Values, GFTV shall ensure all decisions are made independently of external opinions, public sentiment, or community pressure. Decisions shall be grounded in observable conduct, actions, and responsibilities as defined herein.`
    },

    {
        number: 'I §17',
        title: 'Objects',
        slug: 'article-i--objects',
        anchor: 'objects',
        type: 'subsection',
        parent_slug: 'article-i',
        order_index: 7,
        content: `The Objects of GFTV are to facilitate, without violating Article VI of the Charter:

1. The growth of furry fandom communities in Asia;
2. Cultural exchanges between furries in Asia and the rest of the world to build understanding and empathy among each other;
3. Spaces for healthy, civil dialogue on furry fandom topics and issues; and
4. Platforms where facts are checked, verified, separated from opinion and disseminated without political, religious or ideological influence.`
    },

    // ── Article II ─────────────────────────────────────────────────────────────

    {
        number: 'II',
        title: 'Article II — Structure',
        slug: 'article-ii',
        anchor: null,
        type: 'article',
        parent_slug: null,
        order_index: 8,
        content: `GFTV is divided into four sections, referred to by their respective acronyms in the Charter:

1. The Community Initiative and Outreach (CIO) Division;
2. The Core Content Support (CCS) Team;
3. The Media and News Division (MAWS);
4. The Policy, Action and Leadership (PAL) Division.

The Divisions and Personnel within shall work together no matter their posted roles.`
    },

    {
        number: 'II §9–10',
        title: 'Community Initiative and Outreach (CIO) Division',
        slug: 'article-ii--cio-division',
        anchor: 'cio-division',
        type: 'subsection',
        parent_slug: 'article-ii',
        order_index: 9,
        content: `**The CIO's Purpose** is to engage the furry community more deeply, and to create offline and online spaces and initiatives for such engagement.

To support and reach its Purpose, the CIO will:
- Establish and manage GFTV Initiatives and Spaces: the Online Communities (OC), Community Events (CE), Furry Convention Status Tracker (FURST) and Furry Statistics Centre (FurStat). The Community Rules (CR) will govern OC and CE. The GFTV News Standards will govern FURST and FurStat.
- Employ physical signages: the Hello Spot, Meet Spot, or Group Placards — to enhance public outreach and exposure, build connection with the general public, assist in event ushering or for ceremonial purposes — at GFTV events, mass public events such as cosplay or furry conventions, where Personnel are authorised by the Project Head or the Operations Officer.
- Collaborate with furry communities, organisers, and partners to expand community engagement and cultural exchange within GFTV's capacity.
- Ensure that no engagements violate the Charter.`
    },

    {
        number: 'II §11–12',
        title: 'Core Content Support (CCS) Team',
        slug: 'article-ii--ccs-team',
        anchor: 'ccs-team',
        type: 'subsection',
        parent_slug: 'article-ii',
        order_index: 10,
        content: `**The CCS Team's Purpose** is to:
- Give GFTV membership applicants a flexible way to contribute to GFTV in various roles and areas;
- Facilitate learning experiences and portfolio building; and
- Explore one's skill sets and abilities.

To support and reach its Purpose, the CCS will:
- Support the workflows and processes of the CIO, MAWS and PAL; and
- Employ mentorship and on-the-job learning methods for CCS Members in cooperation with Officers and Division Leaders.`
    },

    {
        number: 'II §13–14',
        title: 'Media and News (MAWS) Division',
        slug: 'article-ii--maws-division',
        anchor: 'maws-division',
        type: 'subsection',
        parent_slug: 'article-ii',
        order_index: 11,
        content: `**The Media and News (MAWS) Division's Purpose** is to produce quality informative and entertaining content on the furry fandom.

To support and reach its Purpose, the MAWS will:
- Produce content for GFTV's online content platforms according to the GFTV Programme Rating System;
- Engage in newsgathering according to the GFTV News Standards;
- Work with the CCS Team to support content creation; and
- Engage with audiences and cooperate with them and the CIO to democratise GFTV's news process, grow GFTV's communities and facilitate GFTV's growth.`
    },

    {
        number: 'II §15–16',
        title: 'Policy, Action and Leadership (PAL) Division',
        slug: 'article-ii--pal-division',
        anchor: 'pal-division',
        type: 'subsection',
        parent_slug: 'article-ii',
        order_index: 12,
        content: `**The Policy, Action and Leadership (PAL) Division's Purpose** is to direct and further GFTV's daily operations, objectives and administration to fulfil GFTV's Purpose.

To support and reach its Purpose, the PAL will have the power on behalf of GFTV to:
- Sign, execute, accept or undertake any deeds, documents, trusts or gifts that benefit or align with GFTV's Purpose subject to Article VI;
- Appoint another Team Member or Officer to fill any Officer vacancy until new candidates are elected;
- Ensure discipline among Personnel;
- Appoint sub-committees with powers to co-opt Team Members, including CCS Members;
- Manage and move all movable and immovable properties of GFTV; and
- Organise and maintain the Organisation's funds.

**Sub-committees** shall operate under the authority of the Project Head, strictly within their defined scope and authorised powers, and shall not exercise authority in matters of GFTV's governance, disciplinary matters, or policy, nor override decisions made by the Project Head or Officers, except where expressly authorised under this Charter.`
    },

    {
        number: 'II §17',
        title: 'The Officers of GFTV',
        slug: 'article-ii--officers',
        anchor: 'officers',
        type: 'subsection',
        parent_slug: 'article-ii',
        order_index: 13,
        content: `The following named Officers shall collectively form the PAL and serve as GFTV's *de facto* board of directors and the supreme decision-making authority:

**The Project Head** shall:
- Lead and direct all operations of GFTV;
- Where immediate action is required to protect safety, welfare, or organisational integrity, may act on behalf of GFTV when convening a meeting is impractical, subject to subsequent review; and
- Represent GFTV when dealing with outside persons.

**The Operations Officer** shall:
- Assist the Project Head in directing GFTV;
- In the Project Head's absence, serve in their place for the duration of such absence; and
- Where the Project Head is unavailable, conflicted, or unable to act, the Operations Officer shall assume equivalent authority under this Charter.

**Division Leaders** are Officers who oversee, coordinate, and support their respective divisions, operational areas, initiatives, Personnel, and activities within GFTV, in accordance with this Charter and the Standards.`
    },

    // ── Article III ────────────────────────────────────────────────────────────

    {
        number: 'III',
        title: 'Article III — Governance',
        slug: 'article-iii',
        anchor: null,
        type: 'article',
        parent_slug: null,
        order_index: 14,
        content: `This Article establishes the governance framework of GFTV, including national jurisdiction, the Charter and Standards, elections, and meeting procedures.`
    },

    {
        number: 'III §18',
        title: 'National Jurisdiction of GFTV',
        slug: 'article-iii--national-jurisdiction',
        anchor: 'national-jurisdiction',
        type: 'subsection',
        parent_slug: 'article-iii',
        order_index: 15,
        content: `GFTV is an organisation created within the territory of the **Republic of Singapore**. It is thus bound by and will comply with the country's laws.

GFTV's Place of Operations shall be at the residence of the Project Head or such other address as may subsequently be decided upon by the PAL.

GFTV shall carry out its activities only in places and premises with prior written approval from the relevant authorities or management, within or outside of Singapore, where applicable.

GFTV's activities outside Singapore shall not violate the laws of the foreign country where said activities occur.`
    },

    {
        number: 'III §19–22',
        title: 'The Charter and Standards',
        slug: 'article-iii--charter-and-standards',
        anchor: 'charter-and-standards',
        type: 'subsection',
        parent_slug: 'article-iii',
        order_index: 16,
        content: `The Charter shall be the supreme governing framework of GFTV, establishing its ethical and operational principles. The Standards shall be consistent with and give effect to, this Charter.

**Amendment process:**
- The Charter may be amended at a MOM specifically convened for this, with **≥80% of the active electoral quorum** present, approving with a **three-quarters (¾) majority vote**.
- Officers must notify Personnel **14 days** before holding a MOM for amendments.
- All Officers who are part of the active electoral quorum must unanimously consent to commence the vote.
- If the MOM passes the amendments, Officers have **one week** to amend all details on documents relevant to the decision.
- A MOM's decision for amending the Charter and Standards is final when passed. To reverse it, another MOM or EMOM, with ≥80% of the active electoral quorum, must approve with a ¾ majority vote.`
    },

    {
        number: 'III §23–27',
        title: 'Elections',
        slug: 'article-iii--elections',
        anchor: 'elections',
        type: 'subsection',
        parent_slug: 'article-iii',
        order_index: 17,
        content: `Unless otherwise stated, Team Members and Officers can vote and hold office if they are **above 21** and **in good standing**.

To pass resolutions at meetings, elections must always be held.

The quorum in elections — at a MOM or EMOM with the active electoral quorum present — that satisfies the 'majority' is a **two-thirds (⅔) majority**, unless otherwise stated.

Proxy voting is strictly prohibited. Personnel's vote will be abstained if they do not vote by the poll deadline.`
    },

    {
        number: 'III §28–31',
        title: 'Meetings',
        slug: 'article-iii--meetings',
        anchor: 'meetings',
        type: 'subsection',
        parent_slug: 'article-iii',
        order_index: 18,
        content: `## Scheduling of Meetings

A General Meeting, or the Meeting of Members (MOM), shall be approved based on the free time of all Personnel. The Project Head or the Operations Officer may convene a MOM once a month via video calls or in person where possible. All Personnel shall be notified of any upcoming MOM at least **14 days** before the date.

An Extraordinary Meeting of Members (EMOM) may be held if there is an urgent situation. Personnel must be notified at least **two days** in advance. The Project Head or Operations Officer may convene an EMOM for a maximum of **three times** between the last and next MOM.

## Quorum for Meetings

The MOM and EMOM quorum is the attendance of either the Project Head, the Operations Officer or both where best possible, at least two or more other Officers, three Team Members and three CCS Members.

If there is no quorum at the start of meetings, the meetings shall be adjourned for half an hour. If the quorum is still not formed, those present shall be considered a quorum but shall have no power to amend any part of the Charter and Standards.

## Meetings Cannot Be Held Solely for Votes

Meetings can set resolutions only after Personnel have discussed the issues relevant to the meeting. Officers shall produce meeting notes within one week after every meeting.`
    },

    // ── Article IV ─────────────────────────────────────────────────────────────

    {
        number: 'IV',
        title: 'Article IV — Personnel',
        slug: 'article-iv',
        anchor: null,
        type: 'article',
        parent_slug: null,
        order_index: 19,
        content: `This Article covers membership requirements, the inauguration process, personnel conduct, discipline, disputes, and procedures for outgoing personnel.`
    },

    {
        number: 'IV §32–37',
        title: 'Membership Requirements and Acceptance',
        slug: 'article-iv--membership',
        anchor: 'membership',
        type: 'subsection',
        parent_slug: 'article-iv',
        order_index: 20,
        content: `## Eligibility to Apply for Membership

Applicants are eligible for GFTV team membership if they:
- Demonstrate alignment with GFTV's Purpose, values, and community culture, including respect for the furry fandom and its spaces;
- Are not less than **17 years of age**;
- Are entirely in agreement with Article VI of the Charter.

Membership applications can only be done using the **Integrated Team Intake Portal**.

The PAL shall, within a reasonable timeframe after acknowledging receipt of an application, post the applicant's name for a period of no less than **seven (7) days** in GFTV's virtual and physical workspaces to gather feedback and objections prior to deciding on membership.

## CCS Members Are Not Full Team Members

All approved applicants will first gain membership in the Core Content Support (CCS) Team. CCS Members are not and will be distinguished from Team Members and Officers. They are free to choose their preferred fields of interest and skill sets, as well as the duration and intensity of their participation. CCS Members who demonstrate competence will, subject to Section 39, be given full membership.`
    },

    {
        number: 'IV §38',
        title: 'Inauguration Process',
        slug: 'article-iv--inauguration',
        anchor: 'inauguration',
        type: 'subsection',
        parent_slug: 'article-iv',
        order_index: 21,
        content: `Upon granting full membership, Officers will, as soon as possible within **14 days**:
- Furnish the individual a copy of the Charter, their Letter of Acceptance (LOA) and their Team ID at an in-person swearing-in ceremony;
- The Project Head, Operations Officer or both will host the ceremony with other Team Members, Officers and CCS Members;
- The individual puts their left hand on a printed copy of the Charter, then raises their right hand with their palm facing forward;
- Repeating after Officers, the individual recites the **Team Oath** and sings the **Team Anthem** according to the First Schedule.

Alternative plans shall be made if in-person plans fail, such as emailing a digital copy of the Charter and the LOA, delivering the Team ID via mail, or conducting the swearing-in ceremony on a video call.

Personnel will **not be paid a salary** — membership in GFTV is voluntary and thus does not imply a fixed monetary payout arrangement.`
    },

    {
        number: 'IV §39',
        title: 'Trusteeship',
        slug: 'article-iv--trusteeship',
        anchor: 'trusteeship',
        type: 'subsection',
        parent_slug: 'article-iv',
        order_index: 22,
        content: `Personnel trusted with GFTV's properties will become its trustees.

Trusteeship is tied to membership and shall cease if the Personnel:
- Dies or becomes a lunatic or of unsound mind;
- Is guilty of misconduct which makes them undesirable as a trustee;
- Submits a notice of resignation.`
    },

    {
        number: 'IV §40–47',
        title: 'Discipline',
        slug: 'article-iv--discipline',
        anchor: 'discipline',
        type: 'subsection',
        parent_slug: 'article-iv',
        order_index: 23,
        content: `## General Duties and Corrective Measures

All Personnel shall be bound to GFTV's Charter, Standards and procedures. Personnel shall uphold the principles of neutrality and independence under Article VI, comply with corrective and disciplinary measures, and report any possible disciplinary violations directly to the Officers.

Where conduct indicates early-stage or non-severe deviation from the Charter or Standards, Officers may apply corrective measures prior to formal disciplinary proceedings. These are limited to:
- Clarification of expected conduct;
- Verbal warning;
- Written warning issued by an Officer or authorised Personnel;
- Guidance on required corrective actions.

Corrective measures shall **not** impose suspension, demotion, or expulsion.

## Promotion

Personnel may nominate another Team Member, Officer or CCS Member who has demonstrated the skills and experience necessary for full membership or a higher position. A Personnel may be promoted at a MOM with ≥60% of the active electoral quorum present, approving with a **three-quarters (¾) majority vote**.

Promotion shall not be granted primarily or solely on the basis of popularity, technical ability, length of service, or personal closeness to existing Personnel. The meeting must be satisfied that the individual can be trusted to carry greater responsibility in accordance with this Charter.

## Penalties for Contravening the Charter

Any Personnel may be sternly warned, suspended, demoted or expelled if they:
- Act contrary to the Charter and Standards;
- Breach the confidentiality of GFTV's information;
- Bully other Personnel or any individual;
- Act in a manner that compromises neutrality, fairness, or independence in breach of Article VI;
- Engage or knowingly associate in a manner materially harmful to GFTV;
- Fail to disclose conflicts of interest;
- Fail to perform duties as an Officer;
- Make public statements derogatory or defamatory to GFTV;
- Misappropriate GFTV funds or property;
- Abuse, misuse, or exceed the authority granted under this Charter.

## Handling Disciplinary Cases

A MOM or EMOM must be convened for discipline cases and appeals. Except during an emergency action, Officers must inform the Personnel at least **seven (7) days** before the meeting is convened.

Where circumstances involve immediate risk to safety, welfare, organisational integrity, or individuals, Officers may initiate an **Emergency Action (EA)** without prior notice. Under an EA, Officers may take necessary and proportionate interim action including temporary suspension, restriction of access, or other defined measures.

The proposal to punish may be approved by **≥60% of the active electoral quorum** present, with a **three-quarters (¾) majority vote**.

## The Rights of the Personnel in Question

The Personnel subject to a disciplinary case have the rights to:
- Present their case;
- Counsel (a trusted next-of-kin, friend or Personnel they appoint);
- Appeal, within **14 days** after the meeting decided on punishment; and
- Be presumed innocent until proven guilty.`
    },

    {
        number: 'IV §48–49',
        title: 'Disputes',
        slug: 'article-iv--disputes',
        anchor: 'disputes',
        type: 'subsection',
        parent_slug: 'article-iv',
        order_index: 24,
        content: `In the event of any dispute amongst Personnel, they shall try to resolve the matter amicably using the following methods, progressively:

1. A mediation hosted by an Officer;
2. An EMOM per this Charter;
3. A Special Committee for Mediation (SCM) comprising of an EMOM quorum inclusive of the trusted individuals of the persons involved;
4. Avenues for mediation, arbitration, or other appropriate dispute resolution while consulting a qualified lawyer;
5. A court of law.

Personnel shall not release details of a dispute resolved through methods 1–4 to the public. Any Personnel found to have violated this shall be subject to disciplinary action.

Personnel who use the court of law to settle disputes shall be suspended until the case is over. When the case is over, Officers will convene an EMOM with **≥80% of the active electoral quorum** to decide with a **three-quarters (¾) majority vote** if the Personnel may resume service.`
    },

    {
        number: 'IV §50–52',
        title: 'Process for Outgoing Personnel',
        slug: 'article-iv--outgoing-personnel',
        anchor: 'outgoing-personnel',
        type: 'subsection',
        parent_slug: 'article-iv',
        order_index: 25,
        content: `## Reasons for Personnel to Leave GFTV

- Voluntary resignation: Any Team Member or CCS Member may resign by giving the Division Leader, Operations Officer or Project Head a written notice;
- Disciplinary issues if expelled under Section 44.

Any Officer may resign by writing to the Project Head. The Project Head may resign by writing to the Operations Officer.

## Outgoing Personnel's Duties Prior to Full Departure

Outgoing Personnel shall:
- Have their team membership and privileges revoked;
- Have their access to GFTV team services, spaces and assets terminated;
- Surrender to their respective Officers or destroy all GFTV properties in their possession, including team identification items, equipment, and operational paperwork;
- Remain bound by all confidentiality, data protection, and non-disclosure obligations arising from their role, including after their departure from GFTV.

## Officer Vacancies

When a vacancy in an Officer position occurs, there will be a nomination and election procedure for the vacant office within seven days. A **three-quarters (¾) majority vote**, with **≥80% of the active electoral quorum** present, will pass nominations. Before the offices of the Project Head or Operations Officer are declared vacant, new candidates must be elected and relevant powers be transferred to them.`
    },

    // ── Article V ──────────────────────────────────────────────────────────────

    {
        number: 'V',
        title: 'Article V — Finances',
        slug: 'article-v',
        anchor: null,
        type: 'article',
        parent_slug: null,
        order_index: 26,
        content: `This Article governs the financial management of GFTV, including the Officer for Finance, storage of funds, usage of funds, and financial oversight requirements.`
    },

    {
        number: 'V §53–54',
        title: 'The Officer for Finance',
        slug: 'article-v--officer-for-finance',
        anchor: 'officer-for-finance',
        type: 'subsection',
        parent_slug: 'article-v',
        order_index: 27,
        content: `The **Project Head** shall manage all of GFTV's funds, issue receipts for all payments made to GFTV, and duly sign all cheques and other financial instruments.

The **Operations Officer** shall assist the Project Head in discharging their duties, powers and responsibilities, and in the absence of the Project Head, shall act in their place.`
    },

    {
        number: 'V §55',
        title: 'Storage of Funds',
        slug: 'article-v--storage-of-funds',
        anchor: 'storage-of-funds',
        type: 'subsection',
        parent_slug: 'article-v',
        order_index: 28,
        content: `The Officer for Finance shall open a **PayPal account** as GFTV's core source of funding and shall deposit therein all monies received on behalf of GFTV.

Revenues from the following pages, accounts and programmes owned and registered by GFTV will fund the account:
- Patreon Page, funded by pledged subscribers;
- Ko-Fi Page, funded by one-off donations;
- YouTube account, funded by YouTube's Partner Program;
- Bilibili account, funded by Bilibili's monetisation program;
- Anchor Podcasts account, funded by Anchor's monetisation program.

The amount received through the platforms thereof, where best possible, shall be disclosed promptly in full and without prejudice.`
    },

    {
        number: 'V §56–58',
        title: 'Usage of Funds',
        slug: 'article-v--usage-of-funds',
        anchor: 'usage-of-funds',
        type: 'subsection',
        parent_slug: 'article-v',
        order_index: 29,
        content: `## Allowed Uses

Officers may use revenues to:
- Purchase, rent, licence, hire, or lease any movable or immovable property;
- Reimburse funds when an authorised Team Member or Officer makes authorised purchases on behalf of GFTV;
- Subsidise or absorb foreseen expenditure by attendees at programmes hosted under GFTV Initiatives and Spaces, or Personnel during their deployments.

Personnel may use personal funds to support activities where pre-approved or declared promptly thereafter, supported by records or receipts.

## Prohibited Uses

Officers may NOT use revenues to:
- Pay the fines of any former or current Personnel if convicted by a court of law;
- Engage in any trade union activity;
- Indulge in or let any political activity or purpose use GFTV's funds and premises;
- Conduct or promote fundraisers without all Officers' unanimous consent;
- Commit any action that violates the provisions of the Charter.

## Maintaining Strong Financial Oversight

GFTV shall maintain proper records and transparency in its financial activities. Transaction details and receipts shall be indefinitely kept and recorded in a shared database available to all Officers. GFTV shall publish periodic summaries of its income and expenditure.`
    },

    // ── Article VI ─────────────────────────────────────────────────────────────

    {
        number: 'VI',
        title: 'Article VI — Declaration of Independence and Freedom from Agenda',
        slug: 'article-vi',
        anchor: null,
        type: 'article',
        parent_slug: null,
        order_index: 30,
        content: `This Article establishes GFTV's commitment to operating independently of external agendas, political affiliations, and conflicts of interest.`
    },

    {
        number: 'VI §59',
        title: 'Commitment to Independence and Neutrality',
        slug: 'article-vi--independence',
        anchor: 'independence',
        type: 'subsection',
        parent_slug: 'article-vi',
        order_index: 31,
        content: `GFTV and its Personnel shall:
- Act independently of any other person, grouping or organisation;
- Not participate in or affiliate with any political party and activist group or organisation, and their activities;
- Have no financial interests or personal relationships that could conflict with their ability to serve at GFTV fairly and independently;
- Actively preserve the independence of GFTV, such as the active rejection of offers, agreements, gifts and rewards, monetary or not, that entails the sacrifice of GFTV's right to self-determination, independence and neutrality.`
    },

    {
        number: 'VI §60–62',
        title: 'Compliance with Article VI',
        slug: 'article-vi--compliance',
        anchor: 'compliance',
        type: 'subsection',
        parent_slug: 'article-vi',
        order_index: 32,
        content: `Personnel who, before their inauguration into GFTV, are affiliated with any political party or activist group, shall disassociate, leave and clear of any participation or association with such parties, groups and organisations. Personnel not following this principle shall be responsible for any consequences given by GFTV or under the law.

> **Note:** Article VI shall be **unamendable** by any manner stated in the Charter and forms the bedrock of GFTV's identity and purpose.`
    },

    // ── Article VII ────────────────────────────────────────────────────────────

    {
        number: 'VII',
        title: 'Article VII — Conflict of Interest',
        slug: 'article-vii',
        anchor: null,
        type: 'article',
        parent_slug: null,
        order_index: 33,
        content: `This Article defines conflicts of interest and establishes the procedures for declaring, managing, and resolving them.`
    },

    {
        number: 'VII §63–65',
        title: 'Definition',
        slug: 'article-vii--definition',
        anchor: 'definition',
        type: 'subsection',
        parent_slug: 'article-vii',
        order_index: 34,
        content: `A conflict of interest is when someone's personal or professional interests clash with GFTV's independent interests or affect their loyalty to GFTV, which may occur if a Personnel:
- Has a business or financial stake in a company that deals with GFTV;
- Holds a position or job in another organisation that deals with GFTV;
- Makes money from a transaction involving GFTV;
- Receives gifts from someone who deals with GFTV that is worth more than a reasonable amount; or
- Does any activity outside GFTV that interferes with the independence of their duties, competes with GFTV, harms the reputation of GFTV, uses the resources of GFTV, or implies the support of GFTV.

Participation by Personnel in external communities, organisations, projects, or events shall not, on its own, constitute a conflict of interest. However, disclosure may still be required where organisational interests, duties, confidentiality, partnerships, or considerations under Article VI may reasonably be affected.`
    },

    {
        number: 'VII §66',
        title: 'Dealing with Conflict of Interest',
        slug: 'article-vii--dealing-with-conflict',
        anchor: 'dealing-with-conflict',
        type: 'subsection',
        parent_slug: 'article-vii',
        order_index: 35,
        content: `Where a conflict of interest arises, Personnel shall immediately gather relevant information including their own name and position, the name and position of any other person or entity involved, and the nature, extent, and impact of the conflict. Personnel shall **promptly declare** the conflict of interest to their Officers **within 24 hours** of becoming aware.

Officers shall assess on a case-by-case basis whether the matter requires no further action, monitoring, mitigation measures, or formal conflict management under this Article.`
    },

    {
        number: 'VII §67',
        title: 'Suspension of Rights While Under Review',
        slug: 'article-vii--suspension-of-rights',
        anchor: 'suspension-of-rights',
        type: 'subsection',
        parent_slug: 'article-vii',
        order_index: 36,
        content: `After a conflict of interest is declared:
- Personnel shall withdraw from any decision-making, voting or involvement where a conflict of interest exists;
- Their rights to vote shall be suspended until resolved;
- Officers shall announce every time before MOMs or EMOMs begin, if the discussion topic is relevant, that a person who has declared a conflict of interest is present.

Officers shall consult the concerned parties or seek external professional advice, and communicate decisions to the concerned parties within 48 hours of declaration.`
    },

    {
        number: 'VII §68',
        title: 'Consequence for Failing to Disclose',
        slug: 'article-vii--consequence',
        anchor: 'consequence',
        type: 'subsection',
        parent_slug: 'article-vii',
        order_index: 37,
        content: `Any GFTV member or officer who fails to disclose, report, mitigate or resolve a conflict of interest may face disciplinary action under Section 44.

Any content or initiative affected by a conflict of interest may be withdrawn, corrected, or cancelled by GFTV.`
    },

    // ── Article VIII ───────────────────────────────────────────────────────────

    {
        number: 'VIII',
        title: 'Article VIII — Miscellaneous',
        slug: 'article-viii',
        anchor: null,
        type: 'article',
        parent_slug: null,
        order_index: 38,
        content: `The Headquarters of GFTV, or the "Premises", is the home address of the Project Head located in the Republic of Singapore and will be GFTV's place of operations.

Visitors and guests may enter into the Premises. However, they shall not enjoy the privileges of a Personnel. All visitors and guests to the Premises must comply with both GFTV's Charter and Standards and any applicable laws or property rules.

## Access and Participation in Initiatives and Spaces

Access to and participation in GFTV's Initiatives and Spaces is conditional and shall be conducted in a manner that ensures the safety, welfare, and orderly participation of all individuals present. GFTV may issue activity-specific instructions or requirements where necessary to ensure safety, compliance, orderly conduct, or the proper functioning of its Initiatives and Spaces. GFTV may restrict, suspend, or withdraw access where necessary to protect safety, welfare, or organisational integrity.

## External Communications and Representation

Personnel shall not:
- Represent, negotiate, or communicate on behalf of GFTV with external parties except where authorised;
- Use GFTV's name, reach, reputation, media presence, or organisational position to pressure external parties for support, resources, benefits, or favourable treatment;
- Request or demand fees, privileges, sponsorships, gifts, transport, accommodation, tickets, or special treatment from external parties as a condition for collaboration;
- Independently arrange or discuss partnerships, logistics, resources, or organisational matters outside authorised or designated channels.

The presence, participation, or attendance of Personnel at external activities shall not, on its own, constitute official representation, endorsement, partnership, or coverage by GFTV unless formally designated or communicated as such.`
    },

    // ── Article IX ─────────────────────────────────────────────────────────────

    {
        number: 'IX',
        title: 'Article IX — Dissolution',
        slug: 'article-ix',
        anchor: null,
        type: 'article',
        parent_slug: null,
        order_index: 39,
        content: `GFTV shall not be merged, acquired, or dissolved unless a MOM convened for this, with **100% of the active electoral quorum** present, approves with a **three-quarters (¾) majority vote**.

The decision, if passed, will discharge all debts and liabilities legally incurred on behalf of GFTV.

The MOM will decide how to dispose of the remaining funds, assets, records and intellectual property of GFTV, and which charity in Singapore to donate the remaining funds to if it so decides.`
    },

    // ── First Schedule ─────────────────────────────────────────────────────────

    {
        number: 'S1',
        title: 'First Schedule — Team Anthem and Oath',
        slug: 'first-schedule',
        anchor: null,
        type: 'page',
        parent_slug: null,
        order_index: 40,
        content: `## Team Anthem

**Into the World Our Paws Reach Out** / 爪子伸出 跨越世界

| English | 中文 |
|---------|------|
| Into the world, our paws reach out, | 爪子伸出，跨越世界 |
| Furries gather; doubts turn out! | 兽友聚集散疑虑！ |
| Voices blend, be a joyful band, | 欢乐乐队合声凑成 |
| Friendship's flame — forever be fanned! | 友谊之火永远扇动！ |
| Honest actions and open hearts | 言行诚实，心灵开放 |
| Bridge the gaps; tear fear apart! | 弥合鸿沟撕恐惧！ |
| With our stories, our smiles and our songs, | 我们故事、微笑、歌声之际 |
| Our team is one — forever be long! | 咱团队友爱永远在一起！ |

---

## Team Members' Oath / 队员信约

| English | 中文 |
|---------|------|
| **I swear** to connect furry communities around the world. | **我承诺——** 桥接全球兽圈社区 |
| **I swear** to build understanding with professionalism. | **我承诺——** 专业态度建立理解 |
| **I swear** to improve communities with dialogue. | **我承诺——** 促进讨论改善社区 |
| **I swear** to always serve with a genuine heart. | **我承诺——** 贯彻始终心态真诚 |`
    },
];

module.exports = async (req, res) => {
    if (handleOptions(req, res)) return;
    if (req.method !== 'POST') return err(res, 'Method not allowed', 405);
    const user = await validateSession(req);
    if (!user || !user.is_admin) return err(res, 'Forbidden', 403);
    const supabase = getSupabaseClient();

    // First pass: upsert all rows without parent_id; collect slug→id
    const slugToId = {};
    const results = [];

    for (const s of SECTIONS) {
        const {
            data,
            error
        } = await supabase
            .from('gftvpolicy_sections')
            .upsert({
                number: s.number,
                title: s.title,
                slug: s.slug,
                anchor: s.anchor,
                type: s.type,
                parent_id: null,
                order_index: s.order_index,
                content: s.content,
                is_published: true,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'slug'
            })
            .select('id, slug')
            .single();

        if (error) {
            results.push({
                slug: s.slug,
                error: error.message
            });
        } else {
            slugToId[s.slug] = data.id;
            results.push({
                slug: s.slug,
                id: data.id
            });
        }
    }

    // Second pass: patch parent_id for subsections
    for (const s of SECTIONS) {
        if (s.parent_slug && slugToId[s.parent_slug] && slugToId[s.slug]) {
            await supabase
                .from('gftvpolicy_sections')
                .update({
                    parent_id: slugToId[s.parent_slug]
                })
                .eq('id', slugToId[s.slug]);
        }
    }

    return ok(res, {
        seeded: results.length,
        results
    });
};