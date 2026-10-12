import type { Zone } from '../types';

// Same 11 placeholder zones as docs/schema/proposed_schema.sql (ids match seed order).
export const ZONES: Zone[] = [
  { id: 1, slug: 'surrey-central', name: 'Surrey Central / City Centre', municipality: 'Surrey', description: 'Public area near Surrey Central SkyTrain', lat: 49.1896, lng: -122.848 },
  { id: 2, slug: 'king-george', name: 'King George Stn', municipality: 'Surrey', description: 'Public area near King George SkyTrain', lat: 49.1828, lng: -122.8447 },
  { id: 3, slug: 'guildford', name: 'Guildford', municipality: 'Surrey', description: 'Public area near Guildford Town Centre', lat: 49.1906, lng: -122.8033 },
  { id: 4, slug: 'newton', name: 'Newton', municipality: 'Surrey', description: 'Public area near Newton Exchange', lat: 49.1324, lng: -122.8428 },
  { id: 5, slug: 'fleetwood', name: 'Fleetwood', municipality: 'Surrey', description: 'Public area near Fleetwood Town Centre', lat: 49.1531, lng: -122.7753 },
  { id: 6, slug: 'cloverdale', name: 'Cloverdale', municipality: 'Surrey', description: 'Public area near Cloverdale town centre', lat: 49.1045, lng: -122.7337 },
  { id: 7, slug: 'south-surrey-pnr', name: 'South Surrey Park & Ride', municipality: 'Surrey', description: 'Public transit park-and-ride area', lat: 49.0424, lng: -122.7783 },
  { id: 8, slug: 'morgan-crossing', name: 'Morgan Crossing / Grandview', municipality: 'Surrey', description: 'Public area near Morgan Crossing', lat: 49.0445, lng: -122.6993 },
  { id: 9, slug: 'semiahmoo', name: 'Semiahmoo Town Centre', municipality: 'Surrey', description: 'Public area near Semiahmoo Shopping Centre', lat: 49.0344, lng: -122.8015 },
  { id: 10, slug: 'white-rock-centre', name: 'White Rock Town Centre', municipality: 'White Rock', description: 'Public area near Johnston Rd & North Bluff', lat: 49.0255, lng: -122.803 },
  { id: 11, slug: 'white-rock-beach', name: 'White Rock Waterfront', municipality: 'White Rock', description: 'Public area near Marine Drive', lat: 49.017, lng: -122.8045 },
];

export const zoneById = (id: number): Zone => {
  const z = ZONES.find((x) => x.id === id);
  if (!z) throw new Error(`Unknown zone ${id}`);
  return z;
};

/** Free map link (no API key, no billing) to the zone's approximate centre. */
export const zoneMapUrl = (z: Zone) => `https://www.google.com/maps/search/?api=1&query=${z.lat},${z.lng}`;
