export const vehicles = [
  "All vehicles",
  "Kraton 6S",
  "Outcast 6S",
  "Typhon 6S",
  "Senton 3S",
  "Granite 3S",
];
export type Part = {
  id: string;
  name: string;
  brand: string;
  category: string;
  vehicles: string[];
  icon: string;
  description: string;
  prices: [number, number, number];
};
// Illustrative data only. These are not verified manufacturer fitment records or offers.
export const parts: Part[] = [
  {
    id: "ARA330654",
    name: "Front suspension arms",
    brand: "ARRMA",
    category: "Suspension",
    vehicles: ["Kraton 6S", "Outcast 6S"],
    icon: "⤨",
    description:
      "Replacement lower arm set. Confirm your model revision and exploded diagram before ordering.",
    prices: [18.99, 12.5, 16.49],
  },
  {
    id: "ARA310956",
    name: "Differential gear set",
    brand: "ARRMA",
    category: "Drivetrain",
    vehicles: ["Kraton 6S", "Typhon 6S"],
    icon: "⚙",
    description:
      "Service your drivetrain. Illustrative part number and fitment association; check manufacturer documentation.",
    prices: [32.99, 24.0, 29.95],
  },
  {
    id: "ARA550059",
    name: "dBoots all-terrain tires",
    brand: "ARRMA",
    category: "Wheels & tires",
    vehicles: ["Senton 3S", "Granite 3S"],
    icon: "◉",
    description:
      "All-terrain wheel and tire set. Verify wheel hex, offset, diameter and body clearance.",
    prices: [39.99, 28.0, 35.99],
  },
  {
    id: "M2C-DEMO",
    name: "Aluminum chassis brace",
    brand: "M2C",
    category: "Upgrades",
    vehicles: ["Kraton 6S", "Outcast 6S"],
    icon: "╱",
    description:
      "Upgrade concept for aggressive bashing. Demo identifier; confirm exact chassis, wheelbase and revision with M2C.",
    prices: [89.99, 74.0, 82.5],
  },
  {
    id: "PP-DEMO",
    name: "High-torque steering servo",
    brand: "Perfect Pass",
    category: "Upgrades",
    vehicles: ["Kraton 6S", "Outcast 6S", "Typhon 6S"],
    icon: "▣",
    description:
      "Upgrade concept. Confirm servo dimensions, spline, BEC voltage and required mounting hardware with Perfect Pass.",
    prices: [119.99, 99.0, 109.99],
  },
  {
    id: "RPM-DEMO",
    name: "Heavy-duty suspension arms",
    brand: "RPM",
    category: "Upgrades",
    vehicles: ["Senton 3S", "Granite 3S"],
    icon: "⤨",
    description:
      "Flexible arm upgrade concept. Demo identifier; verify exact generation and manufacturer fitment.",
    prices: [24.99, 19.5, 22.99],
  },
];
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
  const q = encodeURIComponent(
    part.id.endsWith("DEMO") ? `${part.brand} ${part.name}` : part.id,
  );
  return retailer === "Horizon Hobby"
    ? `https://www.horizonhobby.com/search?q=${q}`
    : retailer === "Jenny’s RC"
      ? `https://jennysrc.com/search?q=${q}`
      : `https://www.ebay.com/sch/i.html?_nkw=${q}`;
}
