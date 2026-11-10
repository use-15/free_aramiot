'use strict';

/**
 * SAMPLE DATA — DEVELOPMENT ONLY
 * ==============================
 * Every document created here is placeholder content for building and reviewing
 * the site. It is NOT verified organizational information and must be replaced
 * through the Phase 2 admin dashboard before the site is published.
 *
 * Impact statistics are seeded with value 0 and an explicit "not verified"
 * description. Real figures must only be entered by the organization.
 */

const Organization = require('../models/Organization');
const Page = require('../models/Page');
const Category = require('../models/Category');
const Article = require('../models/Article');
const Project = require('../models/Project');
const Program = require('../models/Program');
const TeamMember = require('../models/TeamMember');
const Publication = require('../models/Publication');
const Resource = require('../models/Resource');
const ImpactStatistic = require('../models/ImpactStatistic');

const SAMPLE_NOTICE =
  'Sample content for development. Replace it with verified ARAMIOT information before launch.';

/** Build editable page HTML. Kept intentionally simple for a future rich-text editor. */
function pageContent(intro, blocks = []) {
  const parts = [`<p class="lead">${intro}</p>`, `<p class="content-notice"><em>${SAMPLE_NOTICE}</em></p>`];

  for (const block of blocks) {
    if (block.heading) parts.push(`<h2>${block.heading}</h2>`);
    if (block.text) parts.push(`<p>${block.text}</p>`);
    if (block.list) parts.push(`<ul>${block.list.map((item) => `<li>${item}</li>`).join('')}</ul>`);
  }

  return parts.join('\n');
}

const organization = {
  name: 'ARAMIOT',
  tagline: 'Health, education and advocacy for healthier, educated and empowered communities.',
  description:
    'ARAMIOT is a community-oriented initiative working across three interconnected areas: health, education and advocacy. We believe that access to health information, quality education and the protection of fundamental rights are essential to inclusive, resilient communities.',
  story:
    'This is sample organizational text. The verified history of ARAMIOT — founding, milestones and the communities it works with — should be written and approved by the organization, then entered through the admin dashboard.',
  mission:
    'To promote healthier, educated and empowered communities through accessible health information, inclusive education, research and human rights advocacy.',
  vision:
    'A society where every individual can access essential health knowledge, meaningful educational opportunities and fundamental rights without discrimination.',
  values: ['Community participation', 'Evidence and research', 'Inclusion and equity', 'Accountability'],
  contactEmail: 'contact@example.org',
  contactPhone: '+000 000 0000',
  address: {
    street: 'Sample address',
    city: 'Sample city',
    region: '',
    postalCode: '',
    country: 'Sample country',
  },
  socialLinks: {},
};

const pages = [
  {
    title: 'Organizational Overview',
    slug: 'overview',
    section: 'overview',
    excerpt: 'Who ARAMIOT is, what we do, how we work and the change we contribute to.',
    content: pageContent('ARAMIOT works across health, education and advocacy.', [
      {
        heading: 'What We Do',
        list: [
          'Share accessible, evidence-based health information with communities.',
          'Support learning through training, workshops and educational materials.',
          'Advocate for human rights, policy engagement and youth participation.',
        ],
      },
      {
        heading: 'Our Approach',
        text: 'We work with communities rather than for them: listening first, co-designing activities, documenting what happens, and sharing what we learn openly.',
      },
      {
        heading: 'Our Impact',
        text: 'Impact figures are published only once they are verified. The Our Impact section shows the statistics ARAMIOT has confirmed and released.',
      },
    ]),
  },
  {
    title: 'About ARAMIOT',
    slug: 'about',
    section: 'about',
    excerpt: 'Our story, mission, vision, values and the people behind the work.',
    content: pageContent('ARAMIOT is a community-based organization working at the intersection of health, education and advocacy.', [
      {
        heading: 'Our Story',
        text: 'The verified organizational story will replace this sample text. It should explain why ARAMIOT was founded, the communities it serves and the milestones reached so far.',
      },
      {
        heading: 'Our Values',
        list: [
          'Community participation — decisions are shaped with the people affected.',
          'Evidence and research — programmes are informed by data and documented honestly.',
          'Inclusion and equity — no one is excluded because of who they are.',
          'Accountability — resources and results are reported transparently.',
        ],
      },
    ]),
  },
  {
    title: 'Health',
    slug: 'health',
    section: 'health',
    excerpt: 'Public health, mental health, health awareness and disease prevention.',
    content: pageContent('Health information should be understandable, accessible and useful in everyday life.', [
      {
        heading: 'Public Health',
        text: 'Community-based health promotion, preventive services and practical information about healthy living.',
      },
      {
        heading: 'Mental Health',
        text: 'Awareness activities and learning materials that reduce stigma and encourage people to seek support.',
      },
      {
        heading: 'Health Awareness',
        text: 'Dialogues, campaigns and printed materials developed with community health volunteers.',
      },
      {
        heading: 'Disease Prevention',
        text: 'Prevention-focused sessions on hygiene, immunisation, non-communicable disease and early screening.',
      },
    ]),
  },
  {
    title: 'Education',
    slug: 'education',
    section: 'education',
    excerpt: 'Health education, training and workshops, research and knowledge sharing.',
    content: pageContent('Learning is the thread that connects every ARAMIOT programme.', [
      {
        heading: 'Health Education',
        text: 'Practical health literacy sessions designed with and for local communities.',
      },
      {
        heading: 'Training and Workshops',
        text: 'Short, participatory training for volunteers, teachers and community facilitators.',
      },
      {
        heading: 'Research',
        text: 'Community-level research that documents what works and what does not.',
      },
      {
        heading: 'Knowledge Sharing',
        text: 'Openly shared reports, guides and learning materials, listed in the Resources section.',
      },
    ]),
  },
  {
    title: 'Advocacy',
    slug: 'advocacy',
    section: 'advocacy',
    excerpt: 'Human rights, policy advocacy, youth advocacy and campaigns.',
    content: pageContent('Advocacy at ARAMIOT is evidence-based and community-led.', [
      {
        heading: 'Human Rights',
        text: 'Awareness of fundamental rights, with a focus on the right to health and to education.',
      },
      {
        heading: 'Policy Advocacy',
        text: 'Bringing documented community experience to local and national policy discussions.',
      },
      {
        heading: 'Youth Advocacy',
        text: 'Supporting young people to participate in decisions that affect their future.',
      },
      {
        heading: 'Campaigns',
        text: 'Time-bound public campaigns built around a single, clear ask.',
      },
    ]),
  },
  {
    title: 'Our Work',
    slug: 'our-work',
    section: 'our-work',
    excerpt: 'Projects, programmes, community initiatives and verified impact.',
    content: pageContent('Programmes and projects across the three core areas, documented as they happen.', []),
  },
  {
    title: 'Resources',
    slug: 'resources',
    section: 'resources',
    excerpt: 'Publications, reports, articles and learning materials.',
    content: pageContent('Research publications, reports and practical learning materials.', []),
  },
  {
    title: 'Get Involved',
    slug: 'get-involved',
    section: 'get-involved',
    excerpt: 'Volunteer, partner with us or support ARAMIOT initiatives.',
    content: pageContent('Sustainable community development requires collective action.', [
      {
        heading: 'Volunteer',
        text: 'Contribute time and skills across health, education, advocacy, research or communications. Applications are reviewed by the ARAMIOT team.',
      },
      {
        heading: 'Partner With Us',
        text: 'Institutions, civil society organizations and community groups can propose a partnership or joint initiative.',
      },
      {
        heading: 'Donate',
        text: 'A donations workflow is planned for a later phase. Please contact us in the meantime to discuss supporting ARAMIOT initiatives.',
      },
    ]),
  },
  {
    title: 'Contact',
    slug: 'contact',
    section: 'contact',
    excerpt: 'Contact information, partnership enquiries and the contact form.',
    content: pageContent('Send ARAMIOT a message and the team will respond as soon as possible.', []),
  },
];

const categories = [
  { name: 'Health', slug: 'health', description: 'Public health, mental health and prevention.', scopes: ['articles', 'projects', 'programs', 'publications', 'resources'] },
  { name: 'Education', slug: 'education', description: 'Health education, training and knowledge sharing.', scopes: ['articles', 'projects', 'programs', 'publications', 'resources'] },
  { name: 'Advocacy', slug: 'advocacy', description: 'Human rights, policy and youth advocacy.', scopes: ['articles', 'projects', 'programs', 'publications'] },
  { name: 'News', slug: 'news', description: 'Organizational news and announcements.', scopes: ['articles'] },
  { name: 'Public Health', slug: 'public-health', description: 'Community and preventive health topics.', parentSlug: 'health', scopes: ['articles', 'projects'] },
  { name: 'Mental Health', slug: 'mental-health', description: 'Mental health awareness and support.', parentSlug: 'health', scopes: ['articles', 'resources'] },
  { name: 'Reports', slug: 'reports', description: 'Organizational and field reports.', scopes: ['publications'] },
  { name: 'Research', slug: 'research', description: 'Research papers and policy briefs.', scopes: ['publications', 'articles'] },
  { name: 'Learning Materials', slug: 'learning-materials', description: 'Modules, guides and workshop materials.', scopes: ['resources'] },
  { name: 'Guidelines', slug: 'guidelines', description: 'Practical guidance documents.', scopes: ['resources'] },
];

function articleContent(intro, paragraphs = []) {
  return [`<p class="lead">${intro}</p>`, `<p class="content-notice"><em>${SAMPLE_NOTICE}</em></p>`]
    .concat(paragraphs.map((text) => `<p>${text}</p>`))
    .join('\n');
}

const articles = [
  {
    title: 'Community health awareness: why local conversations matter',
    slug: 'community-health-awareness-local-conversations',
    excerpt: 'Awareness begins with a conversation held in a language people already use.',
    categorySlug: 'public-health',
    tags: ['health', 'awareness'],
    author: 'ARAMIOT',
    publishedAt: new Date('2026-09-18T09:00:00Z'),
    content: articleContent(
      'Health awareness works best when it starts from the questions a community is already asking.',
      [
        'Sample article text. This placeholder describes how community dialogues are organised, who takes part and what participants say they find useful.',
        'Replace this text with a verified ARAMIOT article before publishing the site.',
      ]
    ),
  },
  {
    title: 'Mental health literacy in community settings',
    slug: 'mental-health-literacy-community-settings',
    excerpt: 'Reducing stigma starts with accurate, accessible language about mental health.',
    categorySlug: 'mental-health',
    tags: ['health', 'mental-health'],
    author: 'ARAMIOT',
    publishedAt: new Date('2026-08-04T09:00:00Z'),
    content: articleContent('Mental health is part of health, and community settings are where stigma is either reinforced or reduced.', [
      'Sample article text describing an awareness session, the materials used and the questions raised by participants.',
    ]),
  },
  {
    title: 'Building learning spaces that include everyone',
    slug: 'building-learning-spaces-that-include-everyone',
    excerpt: 'Practical adjustments that make workshops usable for more participants.',
    categorySlug: 'education',
    tags: ['education', 'inclusion'],
    author: 'ARAMIOT',
    publishedAt: new Date('2026-06-22T09:00:00Z'),
    content: articleContent('Inclusion is a design decision, not an afterthought.', [
      'Sample article text listing the practical adjustments ARAMIOT uses when preparing training sessions.',
    ]),
  },
  {
    title: 'Youth voices in policy dialogue',
    slug: 'youth-voices-in-policy-dialogue',
    excerpt: 'What changes when young people are in the room where decisions are made.',
    categorySlug: 'advocacy',
    tags: ['advocacy', 'youth'],
    author: 'ARAMIOT',
    publishedAt: new Date('2026-05-09T09:00:00Z'),
    content: articleContent('Participation is only meaningful when it happens before decisions are final.', [
      'Sample article text summarising a youth advocacy session and the issues participants raised.',
    ]),
  },
  {
    title: 'How we document community initiatives',
    slug: 'how-we-document-community-initiatives',
    excerpt: 'The documentation routine behind ARAMIOT reporting.',
    categorySlug: 'news',
    tags: ['research', 'transparency'],
    author: 'ARAMIOT',
    publishedAt: new Date('2026-03-14T09:00:00Z'),
    content: articleContent('Documentation is how a one-off activity becomes something others can learn from.', [
      'Sample article text describing the notes, photographs and feedback collected during an activity.',
    ]),
  },
  {
    // Draft: must never appear through the public API.
    title: 'Draft article kept for internal review',
    slug: 'draft-article-internal-review',
    excerpt: 'This article is a draft and must not be visible on the public website.',
    categorySlug: 'news',
    tags: ['internal'],
    author: 'ARAMIOT',
    status: 'draft',
    publishedAt: null,
    content: articleContent('Draft sample article used to verify that unpublished content stays hidden.', []),
  },
  {
    // Published but scheduled in the future: hidden until its date arrives.
    title: 'Scheduled announcement for the next season',
    slug: 'scheduled-announcement-next-season',
    excerpt: 'Scheduled content used to verify that future-dated articles stay hidden.',
    categorySlug: 'news',
    tags: ['internal'],
    author: 'ARAMIOT',
    status: 'published',
    publishedAt: new Date('2099-01-01T09:00:00Z'),
    content: articleContent('Scheduled sample article used to verify date-based visibility.', []),
  },
];

const projects = [
  {
    title: 'Community Health Awareness Initiative',
    slug: 'community-health-awareness-initiative',
    summary: 'Awareness sessions and materials developed with community health volunteers.',
    description:
      'Sample project description. Replace it with the verified purpose, scope and results of this initiative.',
    objectives: [
      'Increase understanding of preventive health practices.',
      'Strengthen the confidence of community health volunteers.',
    ],
    activities: ['Community dialogues', 'Printed awareness materials', 'Volunteer briefings'],
    location: 'Sample district',
    startDate: new Date('2026-01-15'),
    endDate: new Date('2026-06-30'),
    categorySlug: 'health',
  },
  {
    title: 'Learning Support Programme',
    slug: 'learning-support-programme',
    summary: 'Training and learning materials for community facilitators.',
    description:
      'Sample project description covering the training cycle, the participants and the materials produced.',
    objectives: ['Deliver practical training to community facilitators.', 'Publish the materials openly.'],
    activities: ['Workshops', 'Facilitator handbook', 'Follow-up sessions'],
    location: 'Sample district',
    startDate: new Date('2026-02-01'),
    endDate: null,
    categorySlug: 'education',
  },
  {
    title: 'Youth Advocacy Sessions',
    slug: 'youth-advocacy-sessions',
    summary: 'Structured sessions supporting young people to engage in policy discussions.',
    description:
      'Sample project description explaining how the sessions were organised and what participants produced.',
    objectives: ['Build advocacy skills among young participants.', 'Document the issues raised.'],
    activities: ['Facilitated sessions', 'Policy dialogue', 'Documentation'],
    location: 'Sample district',
    startDate: new Date('2025-09-01'),
    endDate: new Date('2026-03-31'),
    categorySlug: 'advocacy',
  },
];

const programs = [
  {
    title: 'Community Health Dialogues',
    slug: 'community-health-dialogues',
    description:
      'Sample programme description for an ongoing series of community health conversations.',
    objectives: ['Create a recurring space for health questions.', 'Connect communities with local services.'],
    activities: ['Monthly dialogues', 'Referral information'],
    targetAudience: 'Community members and local health volunteers',
    location: 'Sample district',
    categorySlug: 'health',
  },
  {
    title: 'Training and Workshops',
    slug: 'training-and-workshops',
    description:
      'Sample programme description for short, participatory training delivered to partners and volunteers.',
    objectives: ['Strengthen practical skills.', 'Share ARAMIOT learning materials.'],
    activities: ['One-day workshops', 'Facilitator training'],
    targetAudience: 'Volunteers, teachers and partner organizations',
    location: 'Sample district',
    categorySlug: 'education',
  },
];

const teamMembers = [
  {
    name: 'Sample Team Member',
    position: 'Executive Director',
    biography: 'Sample profile. Replace with the verified biography of the Executive Director.',
    department: 'Leadership',
    displayOrder: 1,
  },
  {
    name: 'Sample Team Member',
    position: 'Programme Lead',
    biography: 'Sample profile. Replace with the verified biography of the Programme Lead.',
    department: 'Programmes',
    displayOrder: 2,
  },
  {
    name: 'Sample Team Member',
    position: 'Advocacy Lead',
    biography: 'Sample profile. Replace with the verified biography of the Advocacy Lead.',
    department: 'Advocacy',
    displayOrder: 3,
  },
];

const publications = [
  {
    title: 'Community Health Awareness: A Field Report',
    slug: 'community-health-awareness-field-report',
    abstract:
      'Sample abstract for a field report describing community health awareness activities, methods and observations.',
    authors: ['ARAMIOT (sample)'],
    publicationType: 'report',
    categorySlug: 'reports',
    publicationDate: new Date('2026-03-20'),
  },
  {
    title: 'Barriers to Health Information Access',
    slug: 'barriers-to-health-information-access',
    abstract:
      'Sample abstract for a research paper on the practical barriers people face when looking for health information.',
    authors: ['ARAMIOT (sample)'],
    publicationType: 'research-paper',
    categorySlug: 'research',
    publicationDate: new Date('2026-05-11'),
  },
  {
    title: 'Policy Brief: Youth Participation',
    slug: 'policy-brief-youth-participation',
    abstract:
      'Sample abstract for a policy brief on youth participation in local decision-making.',
    authors: ['ARAMIOT (sample)'],
    publicationType: 'policy-brief',
    categorySlug: 'research',
    publicationDate: new Date('2026-07-02'),
  },
];

const resources = [
  {
    title: 'Health Awareness Facilitation Guide',
    slug: 'health-awareness-facilitation-guide',
    description: 'Sample description of a facilitation guide for community health awareness sessions.',
    resourceType: 'guideline',
    categorySlug: 'guidelines',
  },
  {
    title: 'Community Workshop Toolkit',
    slug: 'community-workshop-toolkit',
    description: 'Sample description of a toolkit covering planning, facilitation and follow-up.',
    resourceType: 'toolkit',
    categorySlug: 'learning-materials',
  },
  {
    title: 'Introduction to Public Health: Learning Module',
    slug: 'introduction-to-public-health-learning-module',
    description: 'Sample description of a short introductory learning module on public health concepts.',
    resourceType: 'learning-material',
    categorySlug: 'learning-materials',
  },
];

/**
 * Impact statistics are deliberately published with value 0 and an explicit note.
 * Real figures must come from the organization, never from seed data.
 */
const impactStatistics = [
  { title: 'People reached', value: 0, unit: '', displayOrder: 1 },
  { title: 'Programmes', value: 0, unit: '', displayOrder: 2 },
  { title: 'Community initiatives', value: 0, unit: '', displayOrder: 3 },
  { title: 'Volunteers', value: 0, unit: '', displayOrder: 4 },
].map((statistic) => ({
  ...statistic,
  description: 'Sample placeholder. Replace with a verified figure provided by ARAMIOT.',
  isPublished: true,
}));

/**
 * Insert the sample content set.
 * @param {{ clear?: boolean }} options clear:true empties the content collections first.
 */
async function seedDatabase({ clear = true } = {}) {
  if (clear) {
    await Promise.all([
      Organization.deleteMany({}),
      Page.deleteMany({}),
      Category.deleteMany({}),
      Article.deleteMany({}),
      Project.deleteMany({}),
      Program.deleteMany({}),
      TeamMember.deleteMany({}),
      Publication.deleteMany({}),
      Resource.deleteMany({}),
      ImpactStatistic.deleteMany({}),
    ]);
  }

  await Organization.create(organization);

  const categoriesBySlug = {};
  for (const category of categories) {
    const { parentSlug, ...fields } = category;
    const document = await Category.create(fields);
    categoriesBySlug[category.slug] = document;
    if (parentSlug) document.parentCategory = categoriesBySlug[parentSlug]._id;
    if (parentSlug) await document.save();
  }

  for (const page of pages) {
    await Page.create({ ...page, status: 'published', publishedAt: new Date('2026-01-10T09:00:00Z') });
  }

  for (const article of articles) {
    const { categorySlug, ...fields } = article;
    await Article.create({
      status: 'published',
      ...fields,
      category: categorySlug ? categoriesBySlug[categorySlug]._id : null,
    });
  }

  for (const project of projects) {
    const { categorySlug, ...fields } = project;
    await Project.create({
      status: 'published',
      ...fields,
      category: categorySlug ? categoriesBySlug[categorySlug]._id : null,
    });
  }

  for (const program of programs) {
    const { categorySlug, ...fields } = program;
    await Program.create({
      status: 'published',
      ...fields,
      category: categorySlug ? categoriesBySlug[categorySlug]._id : null,
    });
  }

  for (const member of teamMembers) {
    await TeamMember.create({ ...member, status: 'published' });
  }

  for (const publication of publications) {
    const { categorySlug, ...fields } = publication;
    await Publication.create({
      status: 'published',
      ...fields,
      category: categorySlug ? categoriesBySlug[categorySlug]._id : null,
    });
  }

  for (const resource of resources) {
    const { categorySlug, ...fields } = resource;
    await Resource.create({
      status: 'published',
      ...fields,
      category: categorySlug ? categoriesBySlug[categorySlug]._id : null,
    });
  }

  await ImpactStatistic.insertMany(impactStatistics);

  return {
    organization: 1,
    pages: pages.length,
    categories: categories.length,
    articles: articles.length,
    projects: projects.length,
    programs: programs.length,
    teamMembers: teamMembers.length,
    publications: publications.length,
    resources: resources.length,
    impactStatistics: impactStatistics.length,
    note: 'Sample data only — replace with verified ARAMIOT content.',
  };
}

module.exports = { seedDatabase, SAMPLE_NOTICE };
