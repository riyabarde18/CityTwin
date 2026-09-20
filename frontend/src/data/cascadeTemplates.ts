import { UrbanCategory, PatternDetail } from '../types';

export type RiskLevel = 'low' | 'moderate' | 'high' | 'severe';

export interface CascadeStage {
  label: string;
  detail: string;
  riskLevel: RiskLevel;
}

export interface CascadeTemplate {
  id: string;
  title: string;
  matchCategories: UrbanCategory[];
  matchKeywords: string[];
  smallObservations: string[];
  hiddenPattern: string;
  cascade: CascadeStage[];
  cityTwinResponse: string[];
}

// Encodes the escalation logic behind each of CityTwin's flagship scenarios:
// a handful of small, unrelated-looking observations that share a hidden
// mechanism, which — left alone — cascades into a materially worse outcome
// than any single report suggests. Matching a detected pattern against
// these (see matchCascadeTemplate) is what turns "why was this flagged"
// into "here's what it could become."
export const CASCADE_TEMPLATES: CascadeTemplate[] = [
  {
    id: 'drain-flood-disease',
    title: 'Blocked Drain → Flood → Disease Outbreak',
    matchCategories: ['standing_water', 'garbage'],
    matchKeywords: ['drain', 'mosquito', 'smell', 'stagnant', 'sewage'],
    smallObservations: [
      'Water remains near one drain after light rain.',
      'Residents report a bad smell.',
      'Garbage accumulates around the drain.',
      'Mosquitoes increase.',
      'Pedestrians move onto the road to avoid the puddle.',
    ],
    hiddenPattern: 'A possible drainage failure and stagnant-water zone — not just an isolated puddle.',
    cascade: [
      { label: 'Water stagnation', detail: 'Standing water persists between rain events.', riskLevel: 'low' },
      { label: 'Mosquito breeding + road flooding', detail: 'Vector breeding sites form; footpath becomes impassable.', riskLevel: 'moderate' },
      { label: 'Contaminated water enters homes', detail: 'Overflow during heavier rain reaches nearby housing.', riskLevel: 'high' },
      { label: 'Vector- and water-borne illness risk', detail: 'Dengue/malaria and gastrointestinal illness risk rises near schools and clinics.', riskLevel: 'severe' },
      { label: 'Service disruption', detail: 'School, transport, and clinic access affected.', riskLevel: 'severe' },
    ],
    cityTwinResponse: [
      'Cluster water, smell, mosquito, and garbage reports.',
      'Identify the likely blocked inlet.',
      'Mark nearby schools, clinics, and dense housing.',
      'Raise a health-risk alert.',
      'Recommend drain cleaning before heavy rain.',
    ],
  },
  {
    id: 'footpath-collision',
    title: 'Footpath Obstruction → Road Walking → Fatal Pedestrian Corridor',
    matchCategories: ['footpath_obstruction', 'pedestrian_on_road', 'accessibility_barrier'],
    matchKeywords: ['vendor', 'construction', 'parked', 'wheelchair', 'blocked'],
    smallObservations: [
      'A street vendor occupies part of the footpath.',
      'Construction material blocks another section.',
      'A parked vehicle forces pedestrians into traffic.',
      'Wheelchair users cannot pass.',
      'People cross the road repeatedly at this spot.',
    ],
    hiddenPattern: 'The footpath is functionally unusable, even though the map still labels it a sidewalk.',
    cascade: [
      { label: 'Pedestrians move onto the carriageway', detail: 'Foot traffic spills into the vehicle lane.', riskLevel: 'low' },
      { label: 'Sudden braking', detail: 'Drivers brake unexpectedly for pedestrians in the lane.', riskLevel: 'moderate' },
      { label: 'Unsafe crossings increase', detail: 'People cross at unmarked, unsafe points to avoid the obstruction.', riskLevel: 'high' },
      { label: 'Near-miss events rise', detail: 'Repeated close calls between vehicles and pedestrians.', riskLevel: 'high' },
      { label: 'Collision risk', detail: 'A serious collision becomes materially more likely.', riskLevel: 'severe' },
    ],
    cityTwinResponse: [
      'Estimate "effective sidewalk width" from images.',
      'Detect repeated pedestrian displacement.',
      'Combine near-miss reports and vehicle speed.',
      'Mark the location as a pedestrian-safety hotspot.',
      'Recommend removing one obstruction before widening the entire road.',
    ],
  },
  {
    id: 'streetlight-emergency-access',
    title: 'Broken Streetlight → Unsafe Route → Emergency Access Failure',
    matchCategories: ['unsafe_crossing'],
    matchKeywords: ['streetlight', 'light', 'dark', 'lighting', 'night', 'harassment', 'unsafe route'],
    smallObservations: [
      'One streetlight remains broken.',
      'People avoid the road after sunset.',
      'Shops close earlier than usual.',
      'Residents report harassment or theft concerns.',
      'Emergency vehicles use a longer alternate route.',
    ],
    hiddenPattern: 'The lighting failure is creating both a personal-safety problem and a service-access problem.',
    cascade: [
      { label: 'Pedestrian activity decreases', detail: 'Fewer people use the route after dark.', riskLevel: 'low' },
      { label: 'Area becomes less observable', detail: 'Reduced foot traffic removes informal surveillance ("eyes on the street").', riskLevel: 'moderate' },
      { label: 'Unsafe-route reports increase', detail: 'Residents report feeling unsafe; longer alternate routes become routine.', riskLevel: 'high' },
      { label: 'Emergency response slows', detail: 'Ambulances/fire trucks default to the longer route.', riskLevel: 'severe' },
      { label: 'Delayed emergency care', detail: 'A medical or fire emergency becomes more dangerous due to response time.', riskLevel: 'severe' },
    ],
    cityTwinResponse: [
      'Combine lighting reports, pedestrian density, route changes, and emergency locations.',
      'Calculate the population affected by one light repair.',
      'Prioritize repairs that restore access to schools, transit, clinics, and dense housing.',
    ],
  },
  {
    id: 'parking-visibility-collision',
    title: 'Illegal Parking Near Junction → Blocked Visibility → Collision Cluster',
    matchCategories: ['unsafe_crossing', 'traffic_slowdown'],
    matchKeywords: ['parking', 'parked', 'junction', 'visibility', 'honk', 'bus stop'],
    smallObservations: [
      'Vehicles park close to a turn.',
      'Buses stop outside designated areas.',
      'Drivers honk frequently.',
      'People cross between parked vehicles.',
      'Residents report near misses.',
    ],
    hiddenPattern: 'The junction has a visibility and conflict problem, not merely a parking violation.',
    cascade: [
      { label: 'Sightlines blocked', detail: 'Parked vehicles obstruct the view around the turn.', riskLevel: 'low' },
      { label: 'Late reactions', detail: 'Pedestrians and drivers react late to each other.', riskLevel: 'moderate' },
      { label: 'Unpredictable stops', detail: 'Vehicles stop suddenly; congestion spreads to nearby roads.', riskLevel: 'high' },
      { label: 'Emergency vehicles delayed', detail: 'Congestion and blocked sightlines slow emergency transit.', riskLevel: 'high' },
      { label: 'Serious crash risk', detail: 'Conditions converge toward a serious collision.', riskLevel: 'severe' },
    ],
    cityTwinResponse: [
      'Detect recurring parking geometry from images.',
      'Combine vehicle movement, horn/noise reports, and near misses.',
      'Identify dangerous visibility triangles.',
      'Recommend bollards, a no-parking zone, relocated bus stop, or a raised crossing.',
    ],
  },
  {
    id: 'crack-leak-collapse',
    title: 'Small Road Crack → Water Leakage → Road Collapse',
    matchCategories: ['damaged_surface', 'standing_water'],
    matchKeywords: ['crack', 'sinking', 'leak', 'pipeline', 'sewer', 'pothole'],
    smallObservations: [
      'A crack appears on the road.',
      'Water remains around it.',
      'The surface sinks slightly after rain.',
      'A nearby pipeline complaint is reported.',
      'Two-wheelers lose balance near the spot.',
    ],
    hiddenPattern: 'The crack may be an early sign of underground erosion or a leaking water/sewer line.',
    cascade: [
      { label: 'Road base weakens', detail: 'Water infiltrates and softens the sub-surface.', riskLevel: 'low' },
      { label: 'Crack expands', detail: 'Surface cracking spreads and deepens.', riskLevel: 'moderate' },
      { label: 'Pothole forms', detail: 'Visible surface failure develops.', riskLevel: 'high' },
      { label: 'Heavy vehicles worsen damage', detail: 'Repeated heavy loads accelerate failure.', riskLevel: 'high' },
      { label: 'Road collapse', detail: 'Part of the road gives way, endangering people, vehicles, or utility lines.', riskLevel: 'severe' },
    ],
    cityTwinResponse: [
      'Detect cracks and progressive sinking from repeated photographs.',
      'Link the location to water-leak reports.',
      'Prioritize when heavy vehicles use the road.',
      'Recommend underground inspection before resurfacing.',
    ],
  },
  {
    id: 'construction-debris-flooding',
    title: 'Construction Debris → Drain Blockage → Flash Flooding',
    matchCategories: ['garbage', 'standing_water', 'damaged_surface'],
    matchKeywords: ['construction', 'debris', 'sand', 'concrete', 'site', 'spill'],
    smallObservations: [
      'Sand and concrete waste accumulate near a construction site.',
      'Dust enters a storm drain.',
      'The drain cover is missing.',
      'Water collects around the site.',
      'Trucks spill material on the road.',
    ],
    hiddenPattern: 'A temporary construction issue is becoming a flood-amplification point.',
    cascade: [
      { label: 'Debris enters drainage', detail: 'Construction material reduces drain capacity.', riskLevel: 'low' },
      { label: 'Rainwater accumulates faster', detail: 'Reduced capacity means faster local pooling.', riskLevel: 'moderate' },
      { label: 'Roads/basements flood', detail: 'Nearby low-lying areas take on water.', riskLevel: 'high' },
      { label: 'Traffic and emergency access disrupted', detail: 'Flooded roads block routes.', riskLevel: 'high' },
      { label: 'Electrical equipment damaged', detail: 'Water exposure risks nearby electrical infrastructure.', riskLevel: 'severe' },
    ],
    cityTwinResponse: [
      'Detect construction debris from images.',
      'Connect the site to downstream drainage routes.',
      'Simulate which areas are affected if the drain loses capacity.',
      'Send the builder a prevention checklist.',
      'Escalate only if the pattern persists or rainfall risk increases.',
    ],
  },
  {
    id: 'garbage-toxic-floodwater',
    title: 'Overflowing Garbage → Blocked Drain → Toxic Floodwater',
    matchCategories: ['garbage', 'standing_water'],
    matchKeywords: ['overflow', 'burn', 'smoke', 'bin', 'stray'],
    smallObservations: [
      'A bin overflows repeatedly.',
      'Waste spreads onto the road.',
      'Plastic accumulates around a drain.',
      'Stray animals tear open bags.',
      'People burn waste nearby.',
    ],
    hiddenPattern: 'Not merely a cleanliness problem — a combined flood, air-quality, and public-health risk.',
    cascade: [
      { label: 'Drainage blocked', detail: 'Waste physically obstructs the drain.', riskLevel: 'low' },
      { label: 'Water stagnates during rain', detail: 'Blocked drainage causes pooling.', riskLevel: 'moderate' },
      { label: 'Floodwater mixes with waste', detail: 'Decomposing waste contaminates standing water.', riskLevel: 'high' },
      { label: 'Foul air + contaminated surroundings', detail: 'Residents exposed to unsanitary conditions.', riskLevel: 'high' },
      { label: 'Sanitation emergency', detail: 'Informal burning adds smoke exposure on top of a developing local sanitation emergency.', riskLevel: 'severe' },
    ],
    cityTwinResponse: [
      'Cluster garbage, drain, smell, smoke, and waterlogging observations.',
      'Predict which bins will overflow before rainfall.',
      'Recommend collection-time changes rather than only adding bins.',
      'Identify the responsible service zone.',
    ],
  },
  {
    id: 'bus-stop-crowding',
    title: 'Bus Stop Crowding → Road Spillover → Dangerous Transit Failure',
    matchCategories: ['pedestrian_on_road', 'traffic_slowdown'],
    matchKeywords: ['bus stop', 'queue', 'crowd', 'auto', 'passenger'],
    smallObservations: [
      'People wait outside the marked bus stop.',
      'Buses stop in the traffic lane.',
      'A queue extends onto the road.',
      'Autos compete for passengers.',
      'Passengers cross between moving vehicles.',
    ],
    hiddenPattern: 'The bus stop has insufficient capacity or is poorly placed.',
    cascade: [
      { label: 'Carriageway occupied', detail: 'Passengers spill onto the road at peak times.', riskLevel: 'low' },
      { label: 'Unpredictable bus stops', detail: 'Buses stop wherever the queue reaches, not at the marked bay.', riskLevel: 'moderate' },
      { label: 'Unsafe overtaking', detail: 'Vehicles overtake stopped buses from unsafe sides.', riskLevel: 'high' },
      { label: 'Congestion increases', detail: 'Traffic backs up around the stop.', riskLevel: 'high' },
      { label: 'Mass-casualty risk', detail: 'Pedestrians crossing through traffic raise the risk of a serious multi-person incident.', riskLevel: 'severe' },
    ],
    cityTwinResponse: [
      'Estimate queue length at different times.',
      'Combine passenger density and vehicle trajectories.',
      'Detect whether the stop is too small, poorly located, or poorly connected to the footpath.',
      'Recommend a bay, queue barrier, relocated stop, or timed service adjustment.',
    ],
  },
  {
    id: 'water-supply-health-crisis',
    title: 'Repeated Water Supply Interruption → Unsafe Storage → Public-Health Crisis',
    matchCategories: [],
    matchKeywords: ['water supply', 'tanker', 'shortage', 'pressure', 'storage'],
    smallObservations: [
      'Water arrives at unpredictable times.',
      'Residents store water in open containers.',
      'Low pressure is reported.',
      'Tankers queue on narrow roads.',
      'Some neighborhoods receive water much later than others.',
    ],
    hiddenPattern: 'The issue involves reliability, storage hygiene, traffic disruption, and unequal access — not just "low pressure."',
    cascade: [
      { label: 'Longer storage periods', detail: 'Households store water for extended periods to cope.', riskLevel: 'low' },
      { label: 'Container contamination', detail: 'Open, long-stored water becomes unsafe.', riskLevel: 'moderate' },
      { label: 'Tanker traffic blocks roads', detail: 'Private tankers queue on narrow streets.', riskLevel: 'moderate' },
      { label: 'Unequal shortage burden', detail: 'Low-income households face disproportionate shortages.', riskLevel: 'high' },
      { label: 'Waterborne disease cluster', detail: 'Contaminated storage risks a local outbreak.', riskLevel: 'severe' },
    ],
    cityTwinResponse: [
      'Map supply timing and pressure complaints.',
      'Detect unequal service patterns.',
      'Identify schools and clinics with unreliable supply.',
      'Recommend schedule changes, tank placement, leak repair, or emergency delivery.',
      'Add an equity score so the most-connected neighborhoods do not dominate the data.',
    ],
  },
  {
    id: 'heat-pocket-health',
    title: 'Heat Pocket → Reduced Walking → Transport Crowding → Health Emergency',
    matchCategories: ['pedestrian_on_road'],
    matchKeywords: ['heat', 'shade', 'hot', 'sun', 'asphalt'],
    smallObservations: [
      'A road has no shade.',
      'Pedestrians wait under tiny patches of shelter.',
      'Bus queues shorten because people avoid the location.',
      'Outdoor workers take breaks in traffic-side areas.',
      'Asphalt and building walls stay hot after sunset.',
    ],
    hiddenPattern: 'An unshaded corridor is functioning as a heat-exposure hotspot, changing how (and whether) people move through it.',
    cascade: [
      { label: 'Walking avoided', detail: 'Pedestrians route around the unshaded stretch.', riskLevel: 'low' },
      { label: 'Crowding shifts elsewhere', detail: 'Displaced demand crowds nearby stops/shaded routes.', riskLevel: 'moderate' },
      { label: 'Prolonged heat exposure', detail: 'Those who must use the corridor (workers, waiting passengers) face longer exposure.', riskLevel: 'high' },
      { label: 'Heat-related illness risk', detail: 'Vulnerable groups (elderly, outdoor workers) face elevated heat-stress risk.', riskLevel: 'severe' },
    ],
    cityTwinResponse: [
      'Cross-reference reports with surface temperature/shade coverage.',
      'Identify corridors with both high foot traffic and low shade.',
      'Prioritize shade structures or tree planting at the highest-exposure points.',
      'Flag transit stops needing shelter first.',
    ],
  },
];

interface CascadeMatch {
  template: CascadeTemplate;
  score: number;
  isApproximate: boolean;
}

/** Scores every template against a detected pattern's categories + free text, returns the best match. */
export const matchCascadeTemplate = (pattern: PatternDetail): CascadeMatch => {
  const categories = new Set<string>(pattern.top_categories || []);
  const text = (pattern.events || [])
    .map((e) => `${e.description} ${(e.detected_objects || []).join(' ')}`)
    .join(' ')
    .toLowerCase();

  let best: CascadeTemplate = CASCADE_TEMPLATES[0];
  let bestScore = -1;

  for (const template of CASCADE_TEMPLATES) {
    let score = 0;
    for (const cat of template.matchCategories) {
      if (categories.has(cat)) score += 2;
    }
    for (const kw of template.matchKeywords) {
      if (text.includes(kw.toLowerCase())) score += 3;
    }
    if (score > bestScore) {
      bestScore = score;
      best = template;
    }
  }

  return { template: best, score: bestScore, isApproximate: bestScore <= 0 };
};
