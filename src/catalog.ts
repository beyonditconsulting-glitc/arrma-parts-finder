import catalog from "./data/kraton.js";
export type Part = {
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
export const vehicles = ["All vehicles", catalogVehicle];
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
        `${p.id} ${p.name} ${p.brand} ${p.category} ${p.vehicles.join(" ")}`
          .toLowerCase()
          .includes(t),
      ),
  );
}
export function retailerUrl(retailer: string, part: Part) {
  const q = encodeURIComponent(part.id);
  return retailer === "Horizon Hobby"
    ? part.provenance.productUrl
    : retailer === "Jenny’s RC"
      ? `https://jennysrc.com/search?q=${q}`
      : `https://www.ebay.com/sch/i.html?_nkw=${q}`;
}
