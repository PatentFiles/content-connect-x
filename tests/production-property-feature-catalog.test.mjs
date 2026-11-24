/** Contract for the identical production venue filters in both Connect X apps. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {PROPERTY_FEATURE_GROUPS,AMENITY_IDS,ACCESSIBILITY_IDS,FEATURE_LABELS,validFeatureSelection,selectedFeatures,matchesPropertyFeatures} from '../supabase/functions/_shared/propertyFeatureCatalog.mjs';

const expected=[
  [
    "Space Essentials",
    [
      "Wi-Fi",
      "Air conditioning",
      "Heating",
      "Off Street Parking",
      "Private entrance",
      "Multiple rooms",
      "Bedroom",
      "Bathroom",
      "Kitchen",
      "Outdoor space",
      "Natural light",
      "Entire Place"
    ]
  ],
  [
    "Production Features",
    [
      "Professional lighting",
      "Camera equipment",
      "Microphones",
      "Multiple camera angles",
      "Monitors",
      "Tripods / stands",
      "Soundproofing",
      "Makeup station",
      "Wardrobe",
      "Backdrops",
      "Props",
      "On-site crew"
    ]
  ],
  [
    "Outdoor & Main Attractions",
    [
      "Swimming pool",
      "Hot tub",
      "Private yard",
      "Patio",
      "Balcony",
      "Rooftop",
      "Garden",
      "Beach access",
      "Scenic views",
      "Outdoor shower",
      "Fire pit",
      "Multiple outdoor areas"
    ]
  ],
  [
    "Space Style",
    [
      "Luxury",
      "Modern",
      "Minimalist",
      "Glamorous",
      "Industrial",
      "Rustic",
      "Tropical",
      "Mansion",
      "Penthouse",
      "Loft",
      "Villa",
      "Studio"
    ]
  ],
  [
    "Privacy & Production",
    [
      "Fully private property",
      "No shared spaces",
      "No on-site owner",
      "Secluded location",
      "Secure parking",
      "Discreet location",
      "Noise-friendly",
      "Extended shooting hours",
      "Production crew allowed",
      "Multiple performers allowed",
      "Equipment allowed"
    ]
  ],
  [
    "Accessibility",
    [
      "Step-free entrance",
      "Accessible parking",
      "Wide entrances",
      "Elevator",
      "Accessible bathroom",
      "Step-free bathroom",
      "Accessible bedroom",
      "Accessible shower"
    ]
  ]
];
test('exact approved labels, section order and counts',()=>{
 assert.deepEqual(PROPERTY_FEATURE_GROUPS.map(g=>[g.title,g.items.map(([,label])=>label)]),expected);
 assert.deepEqual(PROPERTY_FEATURE_GROUPS.map(g=>g.items.length),[12,12,12,12,11,8]);
 assert.equal(AMENITY_IDS.length,59);
 assert.equal(ACCESSIBILITY_IDS.length,8);
 assert.equal(new Set([...AMENITY_IDS,...ACCESSIBILITY_IDS]).size,67);
 assert.equal(Object.keys(FEATURE_LABELS).length,67);
});
test('retired filters cannot be selected or sent as valid features',()=>{
 for(const key of ['free_parking','washer','dryer','hair_dryer','iron','breakfast','tv']){
  assert.equal(validFeatureSelection([key],AMENITY_IDS),false);
  assert.equal(validFeatureSelection([key],ACCESSIBILITY_IDS),false);
 }
 assert.deepEqual(selectedFeatures(['wifi','free_parking','wifi','washer'],AMENITY_IDS),['wifi']);
 assert.equal(validFeatureSelection(AMENITY_IDS,AMENITY_IDS),true);
 assert.equal(validFeatureSelection(ACCESSIBILITY_IDS,ACCESSIBILITY_IDS),true);
});
test('search matches every selected production and accessibility feature',()=>{
 const venue={amenities:['wifi','lighting_equipment','off_street_parking'],accessibility_features:['step_free_access']};
 assert.equal(matchesPropertyFeatures(venue,['wifi','lighting_equipment'],['step_free_access']),true);
 assert.equal(matchesPropertyFeatures(venue,['wifi','pool'],[]),false);
 assert.equal(matchesPropertyFeatures(venue,[],['accessible_shower']),false);
 assert.equal(matchesPropertyFeatures(venue,['free_parking'],[]),false);
});
