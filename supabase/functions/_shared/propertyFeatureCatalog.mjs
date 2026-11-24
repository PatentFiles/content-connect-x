/** Approved production venue feature catalog. Keep all six sections in this
 * order. These are host-declared facts, not inferred accessibility, privacy
 * or permission guarantees. Booking authorization and permitted uses are separate.
 */
export const PROPERTY_FEATURE_GROUPS=Object.freeze([
  {
    "title": "Space Essentials",
    "items": [
      [
        "wifi",
        "Wi-Fi"
      ],
      [
        "air_conditioning",
        "Air conditioning"
      ],
      [
        "heating",
        "Heating"
      ],
      [
        "off_street_parking",
        "Off Street Parking"
      ],
      [
        "private_entrance",
        "Private entrance"
      ],
      [
        "free_parking",
        "Free parking"
      ],
      [
        "multiple_rooms",
        "Multiple rooms"
      ],
      [
        "bedroom",
        "Bedroom"
      ],
      [
        "bathroom",
        "Bathroom"
      ],
      [
        "kitchen",
        "Kitchen"
      ],
      [
        "outdoor_space",
        "Outdoor space"
      ],
      [
        "natural_light",
        "Natural light"
      ],
      [
        "entire_place",
        "Entire Place"
      ]
    ]
  },
  {
    "title": "Production Features",
    "items": [
      [
        "lighting_equipment",
        "Professional lighting"
      ],
      [
        "camera_equipment",
        "Camera equipment"
      ],
      [
        "microphones",
        "Microphones"
      ],
      [
        "multiple_camera_angles",
        "Multiple camera angles"
      ],
      [
        "monitor",
        "Monitors"
      ],
      [
        "tripods_stands",
        "Tripods / stands"
      ],
      [
        "soundproofing",
        "Soundproofing"
      ],
      [
        "makeup_station",
        "Makeup station"
      ],
      [
        "wardrobe",
        "Wardrobe"
      ],
      [
        "backdrops",
        "Backdrops"
      ],
      [
        "props",
        "Props"
      ],
      [
        "on_site_staff",
        "On-site crew"
      ]
    ]
  },
  {
    "title": "Outdoor & Main Attractions",
    "items": [
      [
        "pool",
        "Swimming pool"
      ],
      [
        "hot_tub",
        "Hot tub"
      ],
      [
        "private_yard",
        "Private yard"
      ],
      [
        "patio",
        "Patio"
      ],
      [
        "balcony",
        "Balcony"
      ],
      [
        "rooftop",
        "Rooftop"
      ],
      [
        "garden",
        "Garden"
      ],
      [
        "beach_access",
        "Beach access"
      ],
      [
        "scenic_views",
        "Scenic views"
      ],
      [
        "outdoor_shower",
        "Outdoor shower"
      ],
      [
        "fire_pit",
        "Fire pit"
      ],
      [
        "multiple_outdoor_areas",
        "Multiple outdoor areas"
      ]
    ]
  },
  {
    "title": "Space Style",
    "items": [
      [
        "luxury",
        "Luxury"
      ],
      [
        "modern",
        "Modern"
      ],
      [
        "minimalist",
        "Minimalist"
      ],
      [
        "glamorous",
        "Glamorous"
      ],
      [
        "industrial",
        "Industrial"
      ],
      [
        "rustic",
        "Rustic"
      ],
      [
        "tropical",
        "Tropical"
      ],
      [
        "mansion",
        "Mansion"
      ],
      [
        "penthouse",
        "Penthouse"
      ],
      [
        "loft",
        "Loft"
      ],
      [
        "villa",
        "Villa"
      ],
      [
        "studio",
        "Studio"
      ]
    ]
  },
  {
    "title": "Privacy & Production",
    "items": [
      [
        "fully_private_property",
        "Fully private property"
      ],
      [
        "no_shared_spaces",
        "No shared spaces"
      ],
      [
        "no_on_site_owner",
        "No on-site owner"
      ],
      [
        "secluded_location",
        "Secluded location"
      ],
      [
        "secure_parking",
        "Secure parking"
      ],
      [
        "discreet_location",
        "Discreet location"
      ],
      [
        "noise_friendly",
        "Noise-friendly"
      ],
      [
        "extended_shooting_hours",
        "Extended shooting hours"
      ],
      [
        "production_crew_allowed",
        "Production crew allowed"
      ],
      [
        "multiple_performers_allowed",
        "Multiple performers allowed"
      ],
      [
        "equipment_allowed",
        "Equipment allowed"
      ]
    ]
  },
  {
    "title": "Accessibility",
    "items": [
      [
        "step_free_access",
        "Step-free entrance"
      ],
      [
        "disabled_parking",
        "Accessible parking"
      ],
      [
        "wide_entrance",
        "Wide entrances"
      ],
      [
        "elevator",
        "Elevator"
      ],
      [
        "accessible_bathroom",
        "Accessible bathroom"
      ],
      [
        "step_free_bathroom",
        "Step-free bathroom"
      ],
      [
        "accessible_bedroom",
        "Accessible bedroom"
      ],
      [
        "accessible_shower",
        "Accessible shower"
      ]
    ]
  }
]);
export const amenityGroups=PROPERTY_FEATURE_GROUPS.slice(0,5);
export const accessibility=PROPERTY_FEATURE_GROUPS[5].items;
export const AMENITY_IDS=Object.freeze(amenityGroups.flatMap(g=>g.items.map(([id])=>id)));
export const ACCESSIBILITY_IDS=Object.freeze(accessibility.map(([id])=>id));
export const FEATURE_LABELS=Object.freeze(Object.fromEntries(PROPERTY_FEATURE_GROUPS.flatMap(g=>g.items)));
export function validFeatureSelection(values,allowed){
 return Array.isArray(values)&&values.length<=allowed.length&&values.every(v=>typeof v==='string'&&allowed.includes(v));
}
export function selectedFeatures(values,allowed){
 return Array.isArray(values)?[...new Set(values.filter(v=>typeof v==='string'&&allowed.includes(v)))]:[];
}
export function matchesPropertyFeatures(property,amenities=[],access=[]){
 return amenities.every(id=>property?.amenities?.includes(id))&&access.every(id=>property?.accessibility_features?.includes(id));
}
