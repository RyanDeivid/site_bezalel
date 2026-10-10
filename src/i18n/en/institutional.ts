import type { institutional as base } from '../pt-BR/institutional.ts';
import type { Widen } from '../types.ts';

export const institutional: Widen<typeof base> = {
  about: {
    eyebrow: 'About',
    title: 'Knowledge is only complete when it becomes creation.',
    lead: 'Bezalel is an educational intelligence platform: it connects people to reliable learning opportunities and transparently explains where every piece of information comes from.',
    missionTitle: 'Mission',
    mission:
      'Help people discover what is worth learning, understand the skills each opportunity develops and build their paths with verifiable information — no noise, no empty promises.',
    nameTitle: 'The meaning of the name',
    name: [
      'The name comes from an ancient craftsman remembered for combining wisdom, understanding and skill to build with excellence — someone who turned knowledge into work.',
      'That is the idea the platform carries: discovering and learning are the beginning; the goal is to build. Discover. Learn. Build.',
    ],
    reliabilityTitle: 'Why reliability matters',
    reliability: [
      'Course information ages fast: prices change, certificates stop being free, cohorts close. A catalog that does not say when it was checked says almost nothing.',
      'That is why every Bezalel record shows the official source, the date of the last check and exactly what was — and was not — confirmed. When the source does not say, Bezalel does not make it up.',
    ],
    agentsTitle: 'The role of the agents',
    agents:
      'Specialized agents split the work into auditable stages: Scout discovers, Verifier validates and publishes, Atlas relates skills, Trend analyzes the catalog and Sol helps you navigate. Every action produces a recorded event. In this version the agents run in demonstration mode, with a local, deterministic simulation.',
    labTitle: 'The lab',
    lab: 'The 3D lab makes this work visible: a workstation for each agent, data flows between them and an Operations Center that follows every event. Once a backend with real agents exists, the lab will reflect real activity through the same event interface.',
    commitmentsTitle: 'Transparency commitments',
    commitments: [
      'Every opportunity links to the original source.',
      'Real data and demonstration data never mix and are always labeled.',
      'Unconfirmed fields show as “Not stated”; inferences are flagged.',
      'Different indicators (courses, mentions, jobs) are never presented as equivalent.',
      'No automated collection ignores the sources’ terms of use, permissions or limits.',
      'Each agent’s limitations are publicly declared.',
    ],
    statusTitle: 'Where we are (v1.0)',
    statusReal: 'Real in this version',
    statusRealItems: ['Curated catalog of courses and certifications checked at the source', 'Search, filters and detail pages', 'Insights computed over the verified catalog', 'Assistant with transparent local rules'],
    statusDemoTitle: 'Demonstration in this version',
    statusDemoItems: ['Agent activity and Operations Center events', 'Fictional pipeline records', 'Mentions time series'],
    cta: 'Read the methodology',
  },
  methodology: {
    eyebrow: 'Methodology',
    title: 'How each piece of information reaches you',
    lead: 'Explicit criteria, auditable states and declared limits. This page describes what v1.0 actually does — and what still depends on a backend.',
    toc: 'On this page',
    curation: {
      title: 'Curation and sources',
      body: [
        'The real records in v1.0 were manually checked on 10/10/2026 on each institution’s official pages. No robot collected those pages.',
        'For each record we keep the source URL, the check date and a note on the verification scope: what was confirmed and what the page does not state.',
      ],
      sourcesTitle: 'Sources consulted',
    },
    badges: {
      title: 'What each badge means',
      items: [
        { name: 'Verified', text: 'Real record; the key information was confirmed at the official source.' },
        { name: 'Partially verified', text: 'Real record; some fields could not be confirmed and show as “Not stated”.' },
        { name: 'Outdated', text: 'The last check is older than 180 days. The record remains visible, with a warning.' },
        { name: 'Demo', text: 'Fictional demonstration data. It never represents a real course, institution or measurement.' },
      ],
    },
    rules: {
      title: 'Data entry rules',
      items: [
        'A field is only filled when the source states it. Absence becomes “Not stated”, never a guess.',
        'When the level is deduced from prerequisites or the course’s purpose, it carries the “inferred” mark.',
        'Skills are the curation’s classification based on declared content — not claims by the provider.',
        'Descriptions are original summaries in Portuguese, not copies of the source text.',
        'Structured data (schema.org) is published only for verified real records, with confirmed fields only.',
      ],
    },
    pipeline: {
      title: 'Agent pipeline',
      lead: 'Each stage has its own contract in the code (domain/pipeline). Real agents must run on the server implementing these contracts.',
    },
    checks: {
      title: 'Validation criteria',
      lead: 'Blocking criteria reject the record. Warnings do not reject, but lower the quality score.',
      blocking: 'Blocking',
      warning: 'Warning',
      criterion: 'Criterion',
      severity: 'Type',
      description: 'Description',
    },
    quality: {
      title: 'Quality score',
      body: [
        'The score ranges from 0 to 100. Up to 60 points come from validation: the record must pass every blocking criterion, and each warning costs 10 points.',
        'The other 40 points come from completeness: stated duration, certificate, skills, detailed description and level are worth 8 points each.',
        'A record can only be published with all blocking criteria met and a minimum score of 70.',
      ],
    },
    states: {
      title: 'Record states',
      lead: 'Transitions outside this flow are refused by the system.',
    },
    dedupe: {
      title: 'Deduplication',
      items: [
        'Stable identifier from the source, when available.',
        'Normalized URL: no “www”, no trailing slash, no fragment and no tracking parameters (utm_*, gclid, fbclid…).',
        'Fingerprint: normalized institution + title (no accents, case or punctuation).',
      ],
    },
    freshness: {
      title: 'Freshness',
      body: 'A record is current if its last confirmation is at most 180 days old. After that it is marked as outdated and goes back to validation.',
    },
    collection: {
      title: 'Collection policy (for future agents)',
      items: [
        'Prioritize official APIs, authorized open data and institutional pages.',
        'Respect each source’s terms of use, robots.txt, permissions and rate limits.',
        'No indiscriminate scraping: each source enters the trust registry before being consulted.',
        'Treat all external data as untrusted: nothing from a source is executed; markup is stripped and the record is rejected.',
        'Collection happens on the server, never in the visitor’s browser.',
      ],
    },
    example: {
      title: 'Example: a demonstration pipeline run',
      lead: 'The real output of the rules above applied to FICTIONAL demonstration records. States are not hand-written: they result from validation.',
      record: 'Record (fictional)',
      result: 'Result',
      reason: 'Reason',
      score: 'Score',
      duplicateOf: (reason: string) => `Duplicate (${reason})`,
      reasons: {
        url: 'same normalized URL',
        fingerprint: 'same institution and title',
        'external-id': 'same identifier',
        belowMin: 'score below 70',
        approved: 'all criteria met',
      },
    },
    limits: {
      title: 'Known limitations',
      items: [
        'The v1.0 catalog is small and manually curated; it is not a complete survey of opportunities.',
        'There is no automatic re-check: dates reflect the manual curation.',
        'Agents and events are simulated; no autonomous agent is in production.',
        'No job source is connected; no market demand indicator is computed.',
        'Static hosting: there are no user accounts, synced favorites or notifications.',
      ],
    },
  },
  legal: {
    draftBadge: 'Preliminary draft',
    draftNotice:
      'This text is a preliminary draft written for the demonstration version. It must be reviewed by a qualified professional before any public launch. The responsible entity, address and contact channel have not been defined yet.',
    updated: 'Draft version: 10/10/2026',
    tbd: 'To be defined before launch',
  },
  privacy: {
    eyebrow: 'Privacy',
    title: 'Privacy policy',
    sections: [
      {
        title: '1. Scope of this version',
        body: ['Bezalel v1.0 is a static demonstration website. There is no sign-up, login, contact form, payment or personal data collection by the platform.'],
      },
      {
        title: '2. Data stored in your browser',
        body: [
          'To remember your preferences, the site writes to your browser’s local storage: theme (light/dark), language, animation preference and dismissal of the demonstration notice. The animated intro uses session storage so it does not repeat.',
          'This data stays on your device only, is not sent to any Bezalel server and can be erased by clearing the site data in your browser.',
          'Bezalel does not use its own cookies, analytics tools, advertising pixels or trackers in this version.',
        ],
      },
      {
        title: '3. Sol assistant',
        body: [
          'In demonstration mode, questions asked to Sol are processed entirely in your browser, by local rules, and are neither sent nor stored.',
          'If the assistant later uses a backend service, this policy will be updated before the change, describing what is sent, how long it is kept and with whom it is shared.',
        ],
      },
      {
        title: '4. Hosting',
        body: [
          'The site is published on GitHub Pages. Like any web server, the hosting infrastructure may log technical access data (such as IP address) under GitHub’s own privacy policy, over which Bezalel has no control.',
        ],
      },
      {
        title: '5. External links',
        body: [
          'Records link to official pages of educational institutions. When you visit them, their policies apply. Links open in a new tab and do not pass along the page you came from.',
        ],
      },
      {
        title: '6. Controller and contact',
        body: ['The data controller and the contact channel for exercising rights (Brazil’s LGPD) will be defined before public launch.'],
      },
    ],
  },
  terms: {
    eyebrow: 'Terms',
    title: 'Terms of use',
    sections: [
      {
        title: '1. Nature of the service',
        body: [
          'Bezalel organizes and presents public information about courses, certifications and skills, citing the original source. It is an informational service: Bezalel does not offer the listed courses nor issue certificates.',
        ],
      },
      {
        title: '2. Accuracy of information',
        body: [
          'Information was checked at the official sources on the dates shown, but may change at any time. Confirm price, deadlines, requirements and certification directly at the source before enrolling.',
          'Unconfirmed fields are shown as “Not stated”. No warranty is given about content maintained by third parties.',
        ],
      },
      {
        title: '3. Demonstration data',
        body: ['Records, events and series marked with the Demo badge are fictional and exist only to demonstrate how the platform works. They must not be used for any decision.'],
      },
      {
        title: '4. No professional advice',
        body: ['The content and the Sol assistant do not constitute personalized professional, educational or career advice.'],
      },
      {
        title: '5. Intellectual property',
        body: [
          'Course names, trademarks and content belong to the respective institutions. Descriptions shown are original summaries, accompanied by a link to the source.',
          'The license of the platform’s code is yet to be defined by the project owner.',
        ],
      },
      {
        title: '6. Acceptable use',
        body: ['You may not use the platform for unlawful purposes, attempt to compromise its security or overload the hosting infrastructure.'],
      },
      {
        title: '7. Changes, responsible party and jurisdiction',
        body: ['These terms may change as the platform evolves. The responsible entity, applicable law and jurisdiction will be defined before public launch.'],
      },
    ],
  },
  notFound: {
    code: '404',
    title: 'This page does not exist — yet.',
    body: 'The address may have changed or never existed. Maybe one of these routes helps:',
    home: 'Back to home',
  },
  routeError: {
    title: 'Something went wrong opening this page',
    body: 'An unexpected error prevented it from showing. You can try again or go back home.',
    reload: 'Reload',
    home: 'Go home',
  },
};
