import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { searchUpgradeProducts, upgradeVendors, type UpgradeVendor } from "../upgradeInventory";

function VendorInventory({ vendor }: { vendor: UpgradeVendor }) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(20);
  const results = searchUpgradeProducts(vendor, query);
  return <View style={s.card}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)}>
      <Text style={s.title}>{vendor.name} · {vendor.products.length} captured listings {expanded ? "▴" : "▾"}</Text>
      <Text style={s.note}>{vendor.status === "not_captured" ? "Inventory not sourced yet" : vendor.status === "partial" ? "Partial catalog capture" : "Catalog snapshot · Not live inventory"}</Text>
    </Pressable>
    {expanded && <View>
      <Text style={s.note}>Browse this vendor’s catalog here. These are not confirmed replacements for the selected part.</Text>
      {vendor.status === "not_captured" ? <Text style={s.note}>No products imported yet. Prices, availability and compatibility are unavailable.</Text> : <>
        <TextInput style={s.input} placeholder="Search product name or SKU" accessibilityLabel={`Search ${vendor.name} inventory`} value={query} onChangeText={(value) => { setQuery(value); setLimit(20); }} />
        <Text style={s.note}>{results.length} listings found</Text>
        {results.slice(0, limit).map((product) => <View key={product.id} style={s.product}>
          <Text style={s.title}>{product.title}</Text>
          {!!product.variant && <Text style={s.note}>{product.variant}</Text>}
          {!!product.sku && <Text style={s.note}>Vendor SKU: {product.sku}</Text>}
          <Text style={s.note}>{product.price ? `${product.price.currency} ${product.price.amount} · Captured price` : "Price not captured"}</Text>
          {!!product.configurationNote && <Text style={s.note}>{product.configurationNote}</Text>}
          <Text style={s.note}>Captured {product.capturedAt.slice(0, 10)} · {product.availability === "unknown" ? "Stock not captured" : product.availability === "available" ? "Listed available at capture" : "Listed unavailable at capture"} · Recheck before purchase</Text>
          <Text style={s.note} selectable>Source: {product.productUrl}</Text>
          <Text style={s.note}>Compatibility and cart transfer not connected.</Text>
        </View>)}
        {results.length > limit && <Pressable accessibilityRole="button" onPress={() => setLimit(limit + 20)}><Text style={s.link}>Show 20 more</Text></Pressable>}
      </>}
    </View>}
  </View>;
}
export function UpgradeInventory() {
  return <View>
    <Text style={s.title}>Upgrade vendor catalogs</Text>
    <Text style={s.note}>Catalog browsing does not confirm compatibility. Captured prices and stock are dated observations; no live feeds or automatic cart transfer are connected.</Text>
    {upgradeVendors.map((vendor) => <VendorInventory key={vendor.id} vendor={vendor} />)}
    <Text style={s.note}>RPM · Inventory not sourced yet.</Text>
  </View>;
}
const s = StyleSheet.create({
  card: { padding: 14, marginVertical: 7, borderWidth: 1, borderColor: "#dfe3da", borderRadius: 12 },
  title: { fontSize: 16, fontWeight: "700", color: "#273129" },
  note: { color: "#687268", fontSize: 14, lineHeight: 20, marginVertical: 5 },
  input: { borderWidth: 1, borderColor: "#c7cec4", borderRadius: 8, padding: 12, marginVertical: 8, color: "#273129", backgroundColor: "#fff" },
  product: { borderTopWidth: 1, borderColor: "#dfe3da", paddingVertical: 12 },
  link: { color: "#e5432f", fontWeight: "700", paddingVertical: 10 },
});
