import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { Part } from "../catalog";
import { horizonBrands, horizonMetadata, getHorizonModels, getHorizonSkus, getHorizonParts, getHorizonCoverage } from "../horizonCatalog";
import { displayObservedPrice } from "../offers";
import { PartsTable } from "./PartsTable";
import { ProductImage } from "./ProductImage";

type Choice = { id: string; label: string };
export function HorizonCatalog({ onSelect }: { onSelect: (part: Part) => void }) {
  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [sku, setSku] = useState("");
  const [picker, setPicker] = useState<"brand" | "model" | "sku" | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"table" | "cards">("table");
  const [viewMenu, setViewMenu] = useState(false);
  const [visibleCount, setVisibleCount] = useState(24);
  const models = useMemo(() => brandId ? getHorizonModels(brandId) : [], [brandId]);
  const skus = useMemo(() => modelId ? getHorizonSkus(brandId, modelId) : [], [brandId, modelId]);
  const brand = horizonBrands.find((item) => item.id === brandId);
  const model = models.find((item) => item.model_id === modelId);
  const parts = useMemo(() => sku ? getHorizonParts(brandId, modelId, sku, query) : [], [brandId, modelId, sku, query]);
  const coverage = sku ? getHorizonCoverage(brandId, modelId, sku) : null;
  const choices: Choice[] = picker === "brand"
    ? horizonBrands.map((item) => ({ id: item.id, label: item.name }))
    : picker === "model"
      ? getHorizonModels(brandId, pickerQuery).map((item) => ({ id: item.model_id, label: `${item.name} · ${item.model_id}${item.discontinued ? " · Discontinued" : ""}` }))
      : skus.map((item) => ({ id: item.sku, label: `${item.sku}${item.color ? ` · ${item.color}` : ""}${item.is_fallback ? " · Source model lookup" : ""}` }));
  const filteredChoices = choices.filter((item) => item.label.toLowerCase().includes(pickerQuery.trim().toLowerCase()));
  const openPicker = (next: "brand" | "model" | "sku") => { setPickerQuery(""); setPicker(next); };
  const choose = (id: string) => {
    if (picker === "brand") { setBrandId(id); setModelId(""); setSku(""); }
    if (picker === "model") { setModelId(id); setSku(""); }
    if (picker === "sku") setSku(id);
    setQuery(""); setVisibleCount(24); setPicker(null);
  };
  return (
    <View style={s.container}>
      <Text style={s.title}>All Horizon models</Text>
      <Text style={s.note}>{horizonMetadata.brandCount} brands · {horizonMetadata.modelCount} models · {horizonMetadata.skuCount} SKU/model lookups</Text>
      <Text style={s.note}>Choose the exact brand, model and SKU to see source-listed parts and accessories. Fitment is not independently verified.</Text>
      {([
        ["brand", "1 · Brand", brand?.name ?? "Choose brand", false],
        ["model", "2 · Model", model ? `${model.name} · ${model.model_id}${model.discontinued ? " · Discontinued" : ""}` : "Choose model", !brandId],
        ["sku", "3 · Exact SKU", sku || "Choose SKU / color", !modelId],
      ] as const).map(([id, label, value, disabled]) => (
        <Pressable key={id} style={[s.selector, disabled && s.disabled]} disabled={disabled} onPress={() => openPicker(id)} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} accessibilityState={{ disabled }}>
          <Text style={s.note}>{label}</Text><Text style={s.strong}>{value} ⌄</Text>
        </Pressable>
      ))}
      {modelId !== "" && skus.length === 0 && <Text style={s.notice}>No SKU records captured for this model.</Text>}
      {coverage && <View style={s.noticeBox}>
        <Text style={s.strong}>Source-listed coverage · {coverage.status.replace(/_/g, " ")}</Text>
        <Text style={s.note}>Expected: {coverage.expectedCount ?? "Not recorded"} · Observed: {coverage.observedCount ?? "Not recorded"}</Text>
        <Text style={s.note}>{coverage.expectedCount === 0 ? "The source explicitly lists zero parts and accessories for this lookup." : coverage.expectedCount == null ? "The expected source count was not captured; missing coverage does not mean zero results." : "Counts apply to this exact SKU before search filters."}</Text>
      </View>}
      <Text style={s.note}>Captured {horizonMetadata.observedAt.slice(0, 10)} · Horizon prices are dated observations, not live quotes. Stock unverified.</Text>
      {sku !== "" && <>
        <TextInput style={s.input} value={query} onChangeText={(value) => { setQuery(value); setVisibleCount(24); }} placeholder="Search parts and accessories" accessibilityLabel="Search exact SKU parts and accessories" returnKeyType="search" />
        <View style={s.heading}><Text style={s.strong}>{parts.length} parts and accessories</Text>
          <Pressable style={s.button} onPress={() => setViewMenu(!viewMenu)} accessibilityRole="button" accessibilityState={{ expanded: viewMenu }}><Text style={s.strong}>{view === "table" ? "First 5 rows" : "Full cards"} ⌄</Text></Pressable>
        </View>
        {viewMenu && <View style={s.menu}>{([ ["table", "Spreadsheet · first 5 results"], ["cards", "Full cards · browse all results"] ] as const).map(([id, label]) => <Pressable key={id} style={s.button} onPress={() => { setView(id); setViewMenu(false); }} accessibilityRole="button" accessibilityState={{ selected: view === id }}><Text>{label}{view === id ? " ✓" : ""}</Text></Pressable>)}</View>}
        {parts.length === 0 && <Text style={s.notice}>{query.trim() ? "No parts or accessories match. Try another name or number." : coverage?.expectedCount === 0 ? "Zero source-listed parts and accessories for this lookup." : "No captured parts or accessories for this lookup. Availability is unknown."}</Text>}
        {view === "table" ? <PartsTable parts={parts} onSelect={onSelect} /> : <>
          {parts.slice(0, visibleCount).map((part) => <Pressable key={part.id} style={s.card} onPress={() => onSelect(part)} accessibilityRole="button" accessibilityLabel={`Open ${part.name} details and vendor carts`}>
            <ProductImage part={part} compact />
            <Text style={s.note}>{part.brand} · {part.manufacturerPartNumber ?? part.id}</Text>
            <Text style={s.strong}>{part.name}</Text>
            <Text style={s.note}>Source-listed for {sku} · Fitment verification pending</Text>
            <Text style={s.strong}>{displayObservedPrice(part.observedPrice)}</Text>
            <Text style={s.note}>{part.observedPrice ? `Price captured ${part.observedPrice.observedAt.slice(0, 10)}` : "No observed quote"} · Stock unverified</Text>
            <Text style={s.link}>View vehicles & prices →</Text>
          </Pressable>)}
          {visibleCount < parts.length && <Pressable style={s.button} onPress={() => setVisibleCount(visibleCount + 24)} accessibilityRole="button"><Text style={s.link}>Show more parts and accessories ({Math.min(visibleCount, parts.length)} of {parts.length})</Text></Pressable>}
        </>}
      </>}
      <Modal visible={picker !== null} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
        <View style={s.overlay}><View style={s.sheet}>
          <Text style={s.title}>Choose {picker === "sku" ? "exact SKU" : picker}</Text>
          <TextInput style={s.input} value={pickerQuery} onChangeText={setPickerQuery} placeholder={`Search ${picker === "sku" ? "SKU or color" : picker ?? ""}`} accessibilityLabel="Search Horizon choices" autoCorrect={false} />
          <FlatList data={filteredChoices} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled" renderItem={({ item }) => <Pressable style={s.option} onPress={() => choose(item.id)} accessibilityRole="button" accessibilityState={{ selected: item.id === (picker === "brand" ? brandId : picker === "model" ? modelId : sku) }}><Text style={s.strong}>{item.label}</Text></Pressable>} ListEmptyComponent={<Text style={s.notice}>No matching choices.</Text>} />
          <Pressable style={s.button} onPress={() => setPicker(null)} accessibilityRole="button"><Text style={s.strong}>Cancel</Text></Pressable>
        </View></View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  container: { gap: 10 }, title: { fontSize: 20, fontWeight: "800", color: "#293127" },
  note: { fontSize: 12, lineHeight: 18, color: "#687268" }, strong: { fontSize: 14, lineHeight: 21, fontWeight: "700", color: "#293127" },
  selector: { padding: 12, minHeight: 64, borderWidth: 1, borderColor: "#dfe1d8", backgroundColor: "#eeefe9", borderRadius: 10 }, disabled: { opacity: 0.45 },
  input: { minHeight: 48, borderWidth: 1, borderColor: "#dedfd9", borderRadius: 10, backgroundColor: "white", padding: 12, fontSize: 14, color: "#252a25" },
  noticeBox: { backgroundColor: "#f4efdf", borderRadius: 8, padding: 12, gap: 5 }, notice: { padding: 14, color: "#8b6c33", lineHeight: 20 },
  heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }, button: { minHeight: 48, padding: 12, justifyContent: "center" },
  menu: { borderWidth: 1, borderColor: "#d7ddd2", borderRadius: 8, backgroundColor: "white" },
  card: { backgroundColor: "white", padding: 14, gap: 8, borderWidth: 1, borderColor: "#e5e6df", borderRadius: 12 }, link: { color: "#e5432f", fontWeight: "700", fontSize: 13 },
  overlay: { flex: 1, backgroundColor: "#18211988", justifyContent: "flex-end", alignItems: "center" },
  sheet: { height: "85%", width: "100%", maxWidth: 650, backgroundColor: "#fafbf7", padding: 20, borderTopLeftRadius: 22, borderTopRightRadius: 22, gap: 12 },
  option: { paddingVertical: 16, borderBottomWidth: 1, borderColor: "#e3e5dc", minHeight: 52 },
});
