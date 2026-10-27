import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Part } from "../catalog";

type Product = { id: number; name: string; permalink: string };
const modelNames = ["Kraton", "Typhon", "Outcast", "Senton", "Granite", "Mojave", "Talion", "Vorteks", "Gorgon", "Infraction", "Felony", "Fireteam", "Notorious", "Big Rock"];
function findModel(part: Part): string | null {
  const source = `${part.provenance.vehicleId} ${part.vehicles.join(" ")} ${part.description}`;
  return modelNames.find((model) => new RegExp(`\\b${model}\\b`, "i").test(source)) ?? null;
}
function isLitUrl(url: string): boolean {
  try { const parsed = new URL(url); return parsed.protocol === "https:" && (parsed.hostname === "litdecals.com" || parsed.hostname === "www.litdecals.com"); } catch { return false; }
}
export function RelatedProducts({ part, vehicle, open }: { part: Part; vehicle: string; open: (url: string) => void }) {
  const model = modelNames.find((name) => new RegExp(`\\b${name}\\b`, "i").test(vehicle)) ?? findModel(part);
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load() {
      setProducts([]);
      if (!model) { setStatus("ready"); return; }
      setStatus("loading");
      try {
        const terms = [part.manufacturerPartNumber ?? part.id, model];
        const responses = await Promise.all(terms.map((term) => fetch(`https://litdecals.com/wp-json/wc/store/v1/products?search=${encodeURIComponent(term)}&per_page=8`, { signal: controller.signal })));
        if (responses.some((response) => !response.ok)) throw new Error("Store unavailable");
        const batches: unknown[] = await Promise.all(responses.map((response) => response.json()));
        if (batches.some((batch) => !Array.isArray(batch))) throw new Error("Unexpected store response");
        const items = (batches as unknown[][]).flat().filter((item): item is Product => {
          if (!item || typeof item !== "object") return false;
          const value = item as Record<string, unknown>;
          return typeof value.id === "number" && typeof value.name === "string" && typeof value.permalink === "string" && isLitUrl(value.permalink);
        }).filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index);
        if (active) { setProducts(items); setStatus("ready"); }
      } catch { if (active) setStatus("unavailable"); }
    }
    void load();
    return () => { active = false; controller.abort(); };
  }, [model, part.id, part.manufacturerPartNumber]);
  return <View style={styles.section}>
    <Text style={styles.heading}>Related products & 3D prints</Text>
    <Text style={styles.note}>Suggestions are related to the vehicle, not confirmed replacements for this part. Check the exact version and fit before buying or printing.</Text>
    <Text style={styles.title}>Lit Decals {model ? `· ${model}` : "· ARRMA"}</Text>
    {status === "loading" && <Text style={styles.note}>Searching Lit Decals…</Text>}
    {status === "unavailable" && <Text style={styles.note}>Product search is unavailable right now. Browse Lit Decals below.</Text>}
    {status === "ready" && products.length === 0 && <Text style={styles.note}>No matching products found in this search.</Text>}
    {products.map((product) => <Pressable key={product.id} onPress={() => open(product.permalink)} accessibilityRole="link"><Text style={styles.link}>{product.name} →</Text></Pressable>)}
    <Pressable onPress={() => open("https://litdecals.com/arrma-mafia-shop/")} accessibilityRole="link"><Text style={styles.link}>Browse Lit Decals →</Text></Pressable>
    <Text style={styles.title}>3D-printed options</Text>
    {model === "Kraton" && <Pressable onPress={() => open("https://www.mjm3dsolutions.com/shop/p/kraton-6s-body-skid-kit")} accessibilityRole="link"><Text style={styles.link}>MJM · Kraton 6S body skid kit (EXB compatible) →</Text><Text style={styles.note}>Vehicle-related accessory; choose the body version on MJM’s product page.</Text></Pressable>}
    <Pressable onPress={() => open("https://www.mjm3dsolutions.com/shop/for-arrma")} accessibilityRole="link"><Text style={styles.link}>Browse MJM’s ARRMA products →</Text></Pressable>
    <Pressable onPress={() => open("https://www.thingiverse.com/search")} accessibilityRole="link"><Text style={styles.link}>Search Thingiverse designs →</Text></Pressable>
    <Pressable onPress={() => open(model === "Kraton" ? "https://cults3d.com/en/tags/kraton" : "https://cults3d.com/")} accessibilityRole="link"><Text style={styles.link}>Browse Cults3D designs →</Text></Pressable>
    <Text style={styles.note}>Thingiverse and Cults3D provide designs to print; check each design’s license and compatibility. Links open the provider’s site.</Text>
  </View>;
}
const styles = StyleSheet.create({ section: { marginVertical: 18, padding: 16, borderWidth: 1, borderColor: "#dfe3da", borderRadius: 14 }, heading: { fontSize: 22, fontWeight: "800", color: "#273129" }, title: { fontSize: 18, fontWeight: "700", color: "#273129", marginTop: 16, marginBottom: 6 }, note: { color: "#687268", fontSize: 14, lineHeight: 20, marginVertical: 5 }, link: { color: "#e5432f", fontSize: 16, fontWeight: "700", paddingVertical: 7 } });
