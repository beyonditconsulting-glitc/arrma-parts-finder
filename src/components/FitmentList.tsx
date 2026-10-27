import { useState } from "react";
import { View, Text, Pressable, TextInput, StyleSheet } from "react-native";
import type { Part } from "../catalog";
import { fitmentPage } from "../fitment-list";

export function FitmentList({ part }: { part: Part }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const result = fitmentPage(
    part.fitments,
    part.provenance.vehicleId,
    query,
    page,
  );
  const changePage = (next: number) => {
    setPage(next);
    setSourceId(null);
  };
  return (
    <View>
      <Text accessibilityRole="header" style={s.heading}>
        Other source-listed vehicles ({result.otherCount})
      </Text>
      <Text style={s.note}>
        Exact source model IDs for the same part. These are captured retailer
        associations, not manufacturer-verified fitment. Versions, color
        variants and successor models are not inferred from a shared family
        name.
      </Text>
      <Text style={s.note}>{part.associationCoverage}</Text>
      {result.otherCount > 0 ? (
        <>
          <TextInput
            style={s.search}
            value={query}
            onChangeText={(value) => {
              setQuery(value);
              setPage(0);
              setSourceId(null);
            }}
            placeholder="Filter models or exact source model IDs"
            accessibilityLabel="Filter other source-listed vehicle models"
          />
          {query.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear vehicle filter"
              onPress={() => {
                setQuery("");
                changePage(0);
              }}
            >
              <Text style={s.link}>Clear filter</Text>
            </Pressable>
          )}
          <Text style={s.note}>
            {result.matchCount} of {result.otherCount} captured associations
            match.
            {"\n"}
            {result.groups
              .map(
                (group) =>
                  `${group.key === "other" ? "Other/mixed" : group.key === "standard" ? "Standard" : "Optional"}: ${group.matchCount}`,
              )
              .join(" · ")}
            {"\n"}Standard entries appear first, then optional, then
            other/mixed. These counts cover this captured list, not all
            compatible vehicles.
          </Text>
          {result.groups.map(
            (group) =>
              group.rows.length > 0 && (
                <View key={group.key}>
                  <Text accessibilityRole="header" style={s.group}>
                    {group.label} ({group.rows.length} shown /{" "}
                    {group.matchCount} matching)
                  </Text>
                  {group.rows.map((row) => (
                    <View key={row.vehicleId} style={s.row}>
                      <Text style={s.name}>{row.name}</Text>
                      <Text selectable style={s.id}>
                        {row.brand} · {row.vehicleId}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${sourceId === row.vehicleId ? "Hide" : "View"} evidence for ${row.vehicleId}`}
                        accessibilityState={{
                          expanded: sourceId === row.vehicleId,
                        }}
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
                        (row.sources.length ? (
                          row.sources.map((source, index) => (
                            <View key={`${source.sha256}-${index}`}>
                              <Text selectable style={s.note}>
                                {part.provenance.publisher} · Captured{" "}
                                {source.observedAt.slice(0, 10)}
                                {"\n"}
                                {source.url}
                                {"\n"}
                                {source.locator}
                                {"\n"}Source SHA-256: {source.sha256}
                              </Text>
                            </View>
                          ))
                        ) : (
                          <Text style={s.note}>
                            Source evidence is missing for this association.
                            Fitment is unverified.
                          </Text>
                        ))}
                    </View>
                  ))}
                </View>
              ),
          )}
          {result.matchCount === 0 ? (
            <Text style={s.note}>
              No captured models match this filter. Missing results do not
              establish incompatibility.
            </Text>
          ) : (
            <View style={s.pagination}>
              <Text style={s.note}>
                Showing {result.start}–{result.end} of {result.matchCount}
                {"\n"}Page {result.page + 1} of {result.pageCount} · 5 per page
              </Text>
              {result.pageCount > 1 && (
                <View style={s.controls}>
                  <Pressable
                    style={s.button}
                    accessibilityRole="button"
                    accessibilityLabel="Previous five vehicle associations"
                    disabled={result.page === 0}
                    accessibilityState={{ disabled: result.page === 0 }}
                    onPress={() => changePage(result.page - 1)}
                  >
                    <Text style={[s.link, result.page === 0 && s.disabled]}>
                      ← Previous
                    </Text>
                  </Pressable>
                  <Pressable
                    style={s.button}
                    accessibilityRole="button"
                    accessibilityLabel="Next five vehicle associations"
                    disabled={result.page + 1 >= result.pageCount}
                    accessibilityState={{
                      disabled: result.page + 1 >= result.pageCount,
                    }}
                    onPress={() => changePage(result.page + 1)}
                  >
                    <Text
                      style={[
                        s.link,
                        result.page + 1 >= result.pageCount && s.disabled,
                      ]}
                    >
                      Next →
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
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
  pagination: { paddingVertical: 10 },
  controls: { flexDirection: "row", justifyContent: "space-between", gap: 16 },
  button: { paddingVertical: 10, paddingHorizontal: 8, minHeight: 44 },
  disabled: { color: "#92988c" },
});
