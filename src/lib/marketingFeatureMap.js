/**
 * Marketing feature map — single source of truth for which features to advertise.
 * Uses live feature flags to determine visibility.
 * Pages: Landing, Pricing, HowItWorks
 */

export const MARKETING_FEATURES = {
  messaging: {
    flag: 'messaging',
    label: 'Messaging',
    description: 'Direct in-app messaging with verified members',
    sections: ['Landing', 'HowItWorks', 'Pricing'],
  },
  collaborations: {
    flag: 'collaborations',
    label: 'Collaborations',
    description: 'Manage multi-participant projects with contracts and consent tracking',
    sections: ['Landing', 'HowItWorks', 'Pricing'],
  },
  testing: {
    flag: 'testing',
    label: 'Health Testing',
    description: 'Verified health testing integration before collaborations',
    sections: ['Landing', 'HowItWorks', 'Pricing'],
  },
  contracts: {
    flag: 'contracts',
    label: 'Digital Contracts',
    description: 'Sign, store, and manage digital agreements with consent tracking',
    sections: ['Landing', 'HowItWorks', 'Pricing'],
  },
  verification: {
    flag: 'verification',
    label: 'Identity Verification',
    description: 'Age and identity verification for community trust',
    sections: ['Landing', 'HowItWorks'],
  },
  hosting_marketplace: {
    flag: 'hosting_marketplace',
    label: 'Hosting & Location Booking',
    description: 'List, discover, and book verified spaces for content production',
    sections: ['Landing', 'HowItWorks', 'Pricing'],
  },
  pro_host: {
    flag: 'pro_host_tier',
    label: 'Pro Host Subscription',
    description: 'Enhanced hosting tools, priority support, and revenue optimization',
    sections: ['Pricing'],
  },
  discovery: {
    flag: 'discovery',
    label: 'Discovery & Matching',
    description: 'Find verified collaborators, photographers, and service providers',
    sections: ['Landing', 'HowItWorks', 'Pricing'],
  },
  galleries: {
    flag: 'galleries',
    label: 'Portfolio Galleries',
    description: 'Share work securely with permission-based access control',
    sections: ['Landing', 'HowItWorks'],
  },
  representation: {
    flag: 'representation',
    label: 'Agent & Studio Representation',
    description: 'Manage professional representation and revenue splits',
    sections: ['Landing', 'HowItWorks'],
  },
  community: {
    flag: 'friends_system',
    label: 'Community & Trust Network',
    description: 'Build trusted professional networks with friends and trusted contacts',
    sections: ['Landing', 'HowItWorks'],
  },
};

/**
 * Get enabled features for a specific page.
 * @param {string} pageName - 'Landing', 'Pricing', 'HowItWorks'
 * @param {function} useFeatureFlag - Hook or function to check flag status
 * @returns {array} - Enabled features for this page
 */
export function getEnabledFeaturesForPage(pageName, useFeatureFlag) {
  return Object.entries(MARKETING_FEATURES)
    .filter(([key, feature]) => {
      if (!feature.sections.includes(pageName)) return false;
      return useFeatureFlag(feature.flag);
    })
    .map(([key, feature]) => feature);
}

/**
 * Get all enabled features (no page filter).
 * @param {function} useFeatureFlag - Hook or function to check flag status
 * @returns {array} - All enabled features
 */
export function getEnabledFeatures(useFeatureFlag) {
  return Object.entries(MARKETING_FEATURES)
    .filter(([key, feature]) => useFeatureFlag(feature.flag))
    .map(([key, feature]) => feature);
}