import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Part } from "../catalog";
import { displayObservedPrice } from "../offers";

export function PartsTable({
  parts,
  onSelect,
}: {
  parts: Part[];
  onSelect: (part: Part) => void;
}) {
  const rows = parts.slice(0, 5);
  if (!rows.length) return null;
  return (
    <View>
      <View style={s.table}>
        <View style={s.header}>
          <Text style={[s.column, s.number, s.label]}>PART #</Text>
          <Text style={[s.column, s.description, s.label]}>DESCRIPTION</Text>
          <Text style={[s.column, s.price, s.label]}>HORIZON*</Text>
        </View>
        {rows.map((part, index) => (
          <Pressable
            key={part.id}
            onPress={() => onSelect(part)}
            style={({ pressed }) => [
              s.row,
              index % 2 === 1 && s.striped,
              pressed && s.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${part.manufacturerPartNumber ?? part.id}, ${part.name}, ${displayObservedPrice(part.observedPrice)}. Open part details.`}
          >
            <View style={[s.column, s.number]}>
              <Text style={s.partNumber} numberOfLines={2}>
                {part.manufacturerPartNumber ?? part.id}
              </Text>
              <Text style={s.brand} numberOfLines={1}>
                {part.brand}
              </Text>
            </View>
            <Text style={[s.column, s.description, s.name]} numberOfLines={2}>
              {part.name}
            </Text>
            <Text style={[s.column, s.price, s.amount]}>
              {part.observedPrice
                ? displayObservedPrice(part.observedPrice).replace(
                    / observed$/,
                    "",
                  )
                : "Unavailable"}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.note}>
        Showing {rows.length} of {parts.length} matches · Tap a row for details.
      </Text>
      <Text style={s.disclaimer}>
        *Captured Horizon prices, not live. Stock unverified. Dates and other
        vendors appear in part details.
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  table: {
    borderWidth: 1,
    borderColor: "#d7ddd2",
    borderRadius: 9,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    backgroundColor: "#283329",
    alignItems: "center",
    paddingVertical: 11,
  },
  label: { fontSize: 9, letterSpacing: 0.5, color: "#fff", fontWeight: "800" },
  column: { paddingHorizontal: 9 },
  number: { width: "28%" },
  description: { width: "46%" },
  price: { width: "26%", textAlign: "right" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 62,
    borderTopWidth: 1,
    borderColor: "#e7ebe2",
    paddingVertical: 10,
  },
  striped: { backgroundColor: "#f1f4ed" },
  pressed: { backgroundColor: "#e2eadb" },
  partNumber: {
    fontSize: 11,
    fontWeight: "800",
    color: "#283329",
    fontVariant: ["tabular-nums"],
  },
  brand: { fontSize: 9, color: "#7d8675", marginTop: 4 },
  name: { fontSize: 12, color: "#323a2d", lineHeight: 17 },
  amount: {
    fontSize: 12,
    fontWeight: "700",
    color: "#283329",
    fontVariant: ["tabular-nums"],
  },
  note: { fontSize: 11, color: "#5a6950", marginTop: 10 },
  disclaimer: { fontSize: 10, color: "#8b6c33", lineHeight: 15, marginTop: 6 },
});
