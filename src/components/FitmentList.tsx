import { useState } from "react";
import { View, Text, Pressable, TextInput, StyleSheet } from "react-native";
import type { Part } from "../catalog";
export function FitmentList({ part }: { part: Part }) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(12);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const other = part.fitments.filter(
    (row) => row.vehicleId !== part.provenance.vehicleId,
  );
  const matches = other.filter((row) =>
    `${row.name} ${row.vehicleId} ${row.brand}`
      .toLowerCase()
      .includes(query.toLowerCase().trim()),
  );
  const visible = matches.slice(0, limit);
  const groups = [
    {
      label: "Standard replacement — retailer-listed",
      rows: visible.filter((row) => row.relationship === "standard"),
    },
    {
      label: "Optional upgrade — not original equipment",
      rows: visible.filter((row) => row.relationship === "optional"),
    },
    {
      label: "Other or mixed source associations — check fitment",
      rows: visible.filter(
        (row) => !["standard", "optional"].includes(row.relationship),
      ),
    },
  ];
  return (
    <View>
      <Text style={s.heading}>Also listed for ({other.length})</Text>
      <Text style={s.note}>
        Same source part identity, exact model IDs. These are captured retailer
        associations, not independently verified diagram fitment. Optional
        upgrades are shown separately.
      </Text>
      {other.length > 0 ? (
        <>
          <TextInput
            style={s.search}
            value={query}
            onChangeText={(value) => {
              setQuery(value);
              setLimit(12);
            }}
            placeholder="Filter models or model numbers"
            accessibilityLabel="Filter other vehicle models"
          />
          {groups.map(
            (group) =>
              group.rows.length > 0 && (
                <View key={group.label}>
                  <Text style={s.group}>{group.label}</Text>
                  {group.rows.map((row) => (
                    <View key={row.vehicleId} style={s.row}>
                      <Text style={s.name}>{row.name}</Text>
                      <Text style={s.id}>
                        {row.brand} · {row.vehicleId}
                      </Text>
                      <Pressable
                        onPress={() =>
                          setSourceId(
                            sourceId === row.vehicleId ? null : row.vehicleId,
                          )
                        }
                      >
                        <Text style={s.link}>
                          {sourceId === row.vehicleId
                            ? "Hide evidence"
                            : "View evidence in app"}
                        </Text>
                      </Pressable>
                      {sourceId === row.vehicleId &&
                        row.sources.map((source, index) => (
                          <View key={`${source.sha256}-${index}`}>
                            <Text selectable style={s.note}>
                              Horizon Hobby · Captured{" "}
                              {source.observedAt.slice(0, 10)}
                              {"\n"}
                              {source.url}
                              {"\n"}
                              {source.locator}
                            </Text>
                          </View>
                        ))}
                    </View>
                  ))}
                </View>
              ),
          )}
          {matches.length === 0 && (
            <Text style={s.note}>No models match this filter.</Text>
          )}
          {matches.length > limit && (
            <Pressable style={s.more} onPress={() => setLimit((n) => n + 24)}>
              <Text style={s.link}>
                Show more models ({visible.length} of {matches.length})
              </Text>
            </Pressable>
          )}
        </>
      ) : (
        <Text style={s.note}>
          No additional models found in the captured source. This does not mean
          the part fits only one model.
        </Text>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  heading: { fontSize: 21, fontWeight: "800", color: "#283329", marginTop: 24 },
  note: { fontSize: 11, lineHeight: 18, color: "#737a6b", marginVertical: 9 },
  search: {
    borderWidth: 1,
    borderColor: "#d6dccf",
    borderRadius: 7,
    padding: 12,
    fontSize: 13,
    color: "#283329",
  },
  group: { fontSize: 12, fontWeight: "800", color: "#506143", marginTop: 18 },
  row: { borderBottomWidth: 1, borderColor: "#e0e5d8", paddingVertical: 13 },
  name: { fontSize: 14, fontWeight: "700", lineHeight: 21, color: "#283329" },
  id: { fontSize: 11, color: "#6c7662", marginVertical: 4 },
  link: { fontSize: 11, color: "#bd3626", fontWeight: "700", marginTop: 8 },
  more: { paddingVertical: 14 },
});
