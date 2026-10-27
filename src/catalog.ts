import catalog from "./data/kraton.js";
export type Fitment = {
  vehicleId: string;
  name: string;
  brand: string;
  relationship: string;
  sources: {
    url: string;
    sha256: string;
    observedAt: string;
    locator: string;
  }[];
};
export type Part = {
  manufacturerPartNumber: string | null;
  fitments: Fitment[];
  associationCoverage: string;
  observedPrice: {
    amountMinor: number;
    currency: string;
    observedAt: string;
    sourceUrl: string;
  } | null;
  id: string;
  name: string;
  brand: string;
  category: string;
  vehicles: string[];
  icon: string;
  description: string;
  fitmentStatus: string;
  pricingStatus: string;
  provenance: {
    publisher: string;
    vehicleId: string;
    sourceUrl: string;
    sourceLocator: string;
    sourceSha256: string;
    observedAt: string;
    productUrl: string;
  };
};
export const catalogVehicle = catalog.vehicle;
export const vehicles = [
  "All vehicles",
  catalogVehicle,
  ...[...new Set(catalog.records.flatMap((part) => part.vehicles))]
    .filter((v) => v !== catalogVehicle)
    .sort(),
];
export const categories = [
  "All parts",
  "Suspension",
  "Drivetrain",
  "Wheels & tires",
  "Electronics",
  "Chassis & body",
  "Hardware",
  "Other",
];
export const parts: Part[] = catalog.records;
export function searchParts(
  query: string,
  vehicle: string,
  category = "All parts",
) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return parts.filter(
    (p) =>
      (vehicle === "All vehicles" || p.vehicles.includes(vehicle)) &&
      (category === "All parts" || p.category === category) &&
      terms.every((t) =>
        `${p.manufacturerPartNumber ?? ""} ${p.id} ${p.name} ${p.brand} ${p.category} ${p.vehicles.join(" ")}`
          .toLowerCase()
          .includes(t),
      ),
  );
}
export function retailerUrl(retailer: string, part: Part) {
  const q = encodeURIComponent(part.manufacturerPartNumber ?? part.id);
  return retailer === "Horizon Hobby"
    ? part.provenance.productUrl
    : retailer === "Jenny’s RC"
      ? `https://jennysrc.com/search?q=${q}`
      : `https://www.ebay.com/sch/i.html?_nkw=${q}`;
}

/** Group source vehicle labels by recognizable ARRMA model; preserve all other labels. */
export const allModels = "All models";
export const allVersions = "Any / All Versions";
const modelNames = ["BIG ROCK", "KRATON", "TYPHON", "OUTCAST", "SENTON", "GRANITE", "MOJAVE", "TALION", "VORTEKS", "GORGON", "INFRACTION", "FELONY", "FIRETEAM", "NOTORIOUS", "LIMITLESS", "FURY", "VENDETTA", "RAIDER", "FAZON", "NERO"];
export function vehicleModel(label: string): string {
  if (!/^\s*(ARRMA\b|Kraton 6S EXB \()/i.test(label)) return "Other vehicles";
  const name = modelNames.find((candidate) => new RegExp(`\\b${candidate}\\b`, "i").test(label));
  return name ? name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : "Other vehicles";
}
export const models = [allModels, ...[...new Set(vehicles.slice(1).map(vehicleModel))].sort()];
export function versionsForModel(model: string): string[] {
  return [allVersions, ...vehicles.slice(1).filter((label) => model === allModels || vehicleModel(label) === model).sort()];
}
export function searchPartsByModel(query: string, model: string, version: string, category = "All parts") {
  const candidates = searchParts(query, version === allVersions ? "All vehicles" : version, category);
  return model === allModels ? candidates : candidates.filter((part) => part.vehicles.some((label) => vehicleModel(label) === model && (version === allVersions || label === version)));
}
