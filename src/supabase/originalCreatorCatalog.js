/** Verbatim choice IDs from the original Base44 CreatorDetails entity at commit 00640e05.
 * Labels are presentation-only; stored IDs preserve migration compatibility.
 */
export const originalCreatorCatalog=Object.freeze({
  "scene_pairings": [
    "boy_girl",
    "girl_girl",
    "boy_boy",
    "boy_boy_girl",
    "boy_girl_girl",
    "boy_boy_boy",
    "girl_girl_girl",
    "boy_girl_boy_girl",
    "group",
    "gangbang",
    "interracial",
    "trans_male_trans_female",
    "trans_male_trans_male",
    "trans_female_trans_female",
    "trans_female_boy",
    "trans_female_girl",
    "other"
  ],
  "compensation_preferences": [
    "paid",
    "trade",
    "free"
  ],
  "standard_acts": [
    "solo",
    "solo_with_toys",
    "boy_girl",
    "girl_girl",
    "boy_boy",
    "facials",
    "creampies",
    "swallowing",
    "anal",
    "interracial",
    "group",
    "orgy",
    "prints_stills",
    "feature_dancing",
    "softcore",
    "other"
  ],
  "fetish_acts": [
    "foot_jobs",
    "rimming",
    "squirting",
    "other"
  ],
  "kink_edge_acts": [
    "bondage",
    "dominant_submissive",
    "power_exchange",
    "roleplay",
    "strap_on",
    "pegging",
    "cuckold",
    "hotwife",
    "swingers",
    "toy_play",
    "other"
  ],
  "performance_positioning": [
    "top",
    "bottom",
    "versatile",
    "switch",
    "dominant",
    "submissive"
  ],
  "looking_for_genders": [
    "women",
    "men",
    "trans_women",
    "trans_men"
  ]
});
export const creatorFieldLabels=Object.freeze({
 scene_pairings:'Scene Pairings',
 compensation_preferences:'Compensation Preferences',
 standard_acts:'Standard Acts',
 fetish_acts:'Fetish Acts',
 kink_edge_acts:'Kink / Edge Acts',
 performance_positioning:'Performance Positioning',
 looking_for_genders:'Looking For'
});
export const friendlyChoice=value=>value.replaceAll('_',' ').replace(/\\b\\w/g,c=>c.toUpperCase());
