export interface LaunchSummary {
  id: string;
  name: string;
  slug: string;
  net: string;
  windowStart: string | null;
  windowEnd: string | null;
  status: string;
  statusAbbrev: string;
  provider: string;
  providerType: string;
  rocket: string;
  rocketFamily: string;
  mission: string;
  missionType: string;
  orbit: string;
  orbitAbbrev: string;
  pad: string;
  padLocation: string;
  lat: number | null;
  lng: number | null;
  country: string;
  image: string | null;
  webcast: string | null;
  infoUrl: string | null;
  probability: number | null;
  updatedAt: string;
}

export interface TleRecord {
  noradId: string;
  name: string;
  group: string;
  line1: string;
  line2: string;
}

export interface SatelliteGroup {
  id: string;
  label: string;
  description: string;
}

export interface SyncResult {
  ok: boolean;
  upcoming: number;
  previous: number;
  embedded: number;
  stored: boolean;
  detail: string;
  ranAt: string;
}

export interface DashboardStats {
  totals: {
    upcoming: number;
    next30: number;
    completed: number;
    successRate: number;
    pads: number;
    providers: number;
  };
  monthly: { month: string; launches: number }[];
  providers: { name: string; value: number }[];
  orbits: { name: string; value: number }[];
  statuses: { name: string; value: number }[];
  nextLaunch: LaunchSummary | null;
}

export interface PadPoint {
  id: string;
  name: string;
  location: string;
  country: string;
  lat: number;
  lng: number;
  launches: number;
  next: { id: string; name: string; net: string; status: string } | null;
}
