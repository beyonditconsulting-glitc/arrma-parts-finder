import React, { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVendorCart } from "./src/useVendorCart";
import { vendors, type Vendor } from "./src/cart";
import { displayObservedPrice } from "./src/offers";
import { PartsTable } from "./src/components/PartsTable";
import { PhotoLookup } from "./src/components/PhotoLookup";
import { ProductImage } from "./src/components/ProductImage";
import { VendorComparison, VendorCartPanel } from "./src/components/Shopping";
import { HobbyShops } from "./src/components/HobbyShops";
import { Maintenance } from "./src/components/Maintenance";
import { Events } from "./src/components/Events";
import { Graveyard } from "./src/components/Graveyard";
import { FitmentList } from "./src/components/FitmentList";
import { RelatedProducts } from "./src/components/RelatedProducts";
import { StatusBar } from "expo-status-bar";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  Modal,
  Linking,
  Alert,
} from "react-native";
import {
  models,
  allModels,
  allVersions,
  versionsForModel,
  searchPartsByModel,
  vehicleModel,
  categories,
  catalogVehicle,
  retailerUrl,
  type Part,
} from "./src/catalog";

const red = "#e5432f";
export default function App() {
  const { cart, add, quantity, storageError } = useVendorCart();
  const [cartVendor, setCartVendor] = useState<Vendor | null>(null);
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [query, setQuery] = useState("");
  const [model, setModel] = useState(vehicleModel(catalogVehicle));
  const [version, setVersion] = useState(catalogVehicle);
  const vehicle = version === allVersions ? model : version;
  const [category, setCategory] = useState("All parts");
  const { tab: routeTab } = useLocalSearchParams<{ tab?: string }>();
  const tab = [
    "Explore",
    "Saved",
    "Graveyard",
    "Maintenance",
    "Events",
    "Shops",
  ].includes(routeTab ?? "")
    ? routeTab!
    : "Explore";
  const setTab = (next: string) => router.setParams({ tab: next });
  const [saved, setSaved] = useState<string[]>([]);
  const [selected, setSelected] = useState<Part | null>(null);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  useEffect(() => setExpandedSections([]), [selected?.id]);
  const toggleSection = (section: string) =>
    setExpandedSections((current) =>
      current.includes(section)
        ? current.filter((item) => item !== section)
        : [...current, section],
    );
  const [picker, setPicker] = useState<"model" | "version" | null>(null);
  const [visibleCount, setVisibleCount] = useState(24);
  const [resultsView, setResultsView] = useState<"table" | "cards">("table");
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  useEffect(() => setVisibleCount(24), [query, model, version, category, tab]);
  const results = searchPartsByModel(query, model, version, category).filter(
    (p) => tab !== "Saved" || saved.includes(p.id),
  );
  const toggle = (id: string) =>
    setSaved((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const openCart = (vendor: Vendor) => {
    setSelected(null);
    setCartVendor(vendor);
  };
  const manualCheckout = (vendor: Vendor, part: Part) => {
    Alert.alert(
      `Continue to ${vendor}?`,
      "This opens the retailer outside the app. Items and quantities will not transfer automatically; you must add them there.",
      [
        { text: "Stay in app", style: "cancel" },
        {
          text: "Continue manually",
          onPress: () => void open(retailerUrl(vendor, part)),
        },
      ],
    );
  };
  const open = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        "Unable to open browser",
        "Please try again when a browser is available.",
      );
    }
  };
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <View style={s.shell}>
        <View style={s.header}>
          <View style={s.logo}>
            <Text style={s.logoText}>A</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.wordmark}>
              PIT FINDER<Text style={{ color: red }}> /</Text>
            </Text>
            <Text style={s.micro}>THE ARRMA PARTS COMPANION</Text>
            <Text style={s.brandCredit}>by LitDecals.com</Text>
          </View>
          <View style={s.demo}>
            <Text style={s.demoText}>SOURCED CATALOG</Text>
          </View>
        </View>
        <Pressable
          style={{
            paddingHorizontal: 16,
            paddingVertical: 7,
            backgroundColor: "#edf0e7",
          }}
          onPress={() => openCart(vendors[0])}
          accessibilityLabel="Review vendor carts"
        >
          <Text style={s.link}>
            Vendor carts · {cart.reduce((n, line) => n + line.quantity, 0)}{" "}
            items →
          </Text>
        </Pressable>
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
        >
          {tab === "Maintenance" ? (
            <Maintenance />
          ) : tab === "Shops" ? (
            <HobbyShops open={(url) => void open(url)} />
          ) : tab === "Events" ? (
            <Events open={(url) => void open(url)} />
          ) : tab === "Graveyard" ? (
            <Graveyard />
          ) : (
            <>
              <Text style={s.title}>
                {tab === "Saved" ? "Saved parts" : "Find your part"}
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  style={[s.vehicle, { flex: 1 }]}
                  onPress={() => {
                    setVehicleQuery("");
                    setPicker("model");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose model: ${model}`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.micro}>MODEL</Text>
                    <Text style={s.vehicleName} numberOfLines={1}>
                      {model}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 22 }}>⌄</Text>
                </Pressable>
                <Pressable
                  style={[s.vehicle, { flex: 1 }]}
                  onPress={() => {
                    setVehicleQuery("");
                    setPicker("version");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose version: ${version}`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.micro}>VERSION / MODEL ID</Text>
                    <Text style={s.vehicleName} numberOfLines={1}>
                      {version}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 22 }}>⌄</Text>
                </Pressable>
              </View>
              <View style={s.search}>
                <Text style={{ fontSize: 24, color: "#7b7d80" }}>⌕</Text>
                <TextInput
                  style={s.input}
                  placeholder="Part name, catalog ID, or vehicle"
                  placeholderTextColor="#777b82"
                  value={query}
                  onChangeText={setQuery}
                  accessibilityLabel="Search parts"
                  returnKeyType="search"
                />
                {query !== "" && (
                  <Pressable
                    onPress={() => setQuery("")}
                    accessibilityLabel="Clear search"
                  >
                    <Text>✕</Text>
                  </Pressable>
                )}
              </View>
              <Text style={s.catalogNote}>
                Kraton-based catalog · Fitment verification pending · Prices are
                not live
              </Text>
              {tab === "Explore" && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.chips}
                >
                  {categories.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setCategory(c)}
                      style={[s.chip, category === c && s.activeChip]}
                    >
                      <Text
                        style={[
                          s.chipText,
                          category === c && { color: "white" },
                        ]}
                      >
                        {c}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
              <View style={s.resultsHeading}>
                <View style={{ flex: 1 }}>
                  <Text style={s.partsToggleTitle}>
                    {tab === "Saved" ? "Saved parts" : "Parts results"}
                  </Text>
                  <Text style={s.count}>{results.length} matches</Text>
                </View>
                <Pressable
                  style={s.viewSelect}
                  onPress={() => setViewMenuOpen((open) => !open)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: viewMenuOpen }}
                  accessibilityLabel={`Results view: ${resultsView === "table" ? "First 5 rows" : "Full cards"}`}
                >
                  <Text style={s.viewSelectText}>
                    {resultsView === "table" ? "First 5 rows" : "Full cards"}{" "}
                    {viewMenuOpen ? "⌃" : "⌄"}
                  </Text>
                </Pressable>
              </View>
              {viewMenuOpen && (
                <View style={s.viewMenu}>
                  {(
                    [
                      { id: "table", label: "Spreadsheet · first 5 results" },
                      { id: "cards", label: "Full cards · browse all results" },
                    ] as const
                  ).map((option) => (
                    <Pressable
                      key={option.id}
                      style={s.viewOption}
                      onPress={() => {
                        setResultsView(option.id);
                        setViewMenuOpen(false);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: resultsView === option.id,
                      }}
                    >
                      <Text style={s.viewSelectText}>{option.label}</Text>
                      <Text>{resultsView === option.id ? "✓" : ""}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {results.length === 0 && (
                <View style={s.empty}>
                  <Text style={s.sectionTitle}>Nothing in the pit yet</Text>
                  <Text style={s.subtitle}>
                    Try another search or vehicle. Tap a part’s bookmark to save
                    it for this session.
                  </Text>
                  <Pressable
                    onPress={() => {
                      setQuery("");
                      setModel(allModels);
                      setVersion(allVersions);
                      setCategory("All parts");
                      setTab("Explore");
                    }}
                  >
                    <Text style={s.link}>Explore all parts →</Text>
                  </Pressable>
                </View>
              )}
              {resultsView === "table" ? (
                <PartsTable parts={results} onSelect={setSelected} />
              ) : (
                <>
                  <View style={s.grid}>
                    {results.slice(0, visibleCount).map((p) => (
                      <View key={p.id} style={s.card}>
                        <Pressable
                          onPress={() => setSelected(p)}
                          style={s.art}
                          accessibilityLabel={`View other vehicles using ${p.name} and compare prices`}
                        >
                          <Text style={s.artLabel}>
                            {p.category.toUpperCase()}
                          </Text>
                          <ProductImage
                            key={`card-image-${p.id}`}
                            part={p}
                            compact
                          />
                          <Text style={s.artBottom}>
                            PIT / {p.brand.toUpperCase()}
                          </Text>
                        </Pressable>
                        <Pressable
                          style={s.bookmark}
                          onPress={() => toggle(p.id)}
                          accessibilityLabel={`${saved.includes(p.id) ? "Unsave" : "Save"} ${p.name}`}
                        >
                          <Text
                            style={{
                              color: saved.includes(p.id) ? red : "#555",
                              fontSize: 21,
                            }}
                          >
                            {saved.includes(p.id) ? "♥" : "♡"}
                          </Text>
                        </Pressable>
                        <View style={s.cardBody}>
                          <Text style={s.partNumber}>
                            {p.brand} · {p.manufacturerPartNumber ?? p.id}
                          </Text>
                          <Text style={s.partName}>{p.name}</Text>
                          <Text style={s.fitment}>
                            ARA8708T1 · Also listed for{" "}
                            {Math.max(0, p.fitments.length - 1)} other models.
                            Diagram check pending.
                          </Text>
                          <View style={s.cardFooter}>
                            <View>
                              <Text style={s.micro}>
                                HORIZON SNAPSHOT · NOT LIVE
                              </Text>
                              <Text style={s.partName}>
                                {displayObservedPrice(p.observedPrice)}
                              </Text>
                              <Text style={s.fitment}>
                                {p.observedPrice
                                  ? `Captured ${p.observedPrice.observedAt.slice(0, 10)}`
                                  : "No observed quote"}{" "}
                                · Stock unverified
                              </Text>
                            </View>
                            <Pressable
                              style={s.compare}
                              onPress={() => setSelected(p)}
                              accessibilityLabel={`View other vehicles using ${p.name} and compare prices`}
                            >
                              <Text style={s.compareText}>
                                View vehicles & prices →
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                  {visibleCount < results.length && (
                    <Pressable
                      style={s.saveButton}
                      onPress={() => setVisibleCount((count) => count + 24)}
                      accessibilityRole="button"
                    >
                      <Text style={s.compareText}>
                        Show more parts (
                        {Math.min(visibleCount, results.length)} of{" "}
                        {results.length})
                      </Text>
                    </Pressable>
                  )}
                </>
              )}
              <PhotoLookup
                model={model}
                version={version}
                onBarcode={setQuery}
              />
              <Text style={s.disclaimer}>
                Independent enthusiast app. Not affiliated with ARRMA or the
                listed retailers. Saved parts last for this session.
              </Text>
            </>
          )}
        </ScrollView>
        <View style={s.nav}>
          {[
            "Explore",
            "Saved",
            "Graveyard",
            "Maintenance",
            "Events",
            "Shops",
          ].map((t, i) => (
            <Pressable
              key={t}
              style={s.navItem}
              onPress={() => setTab(t)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t }}
            >
              <Text style={[s.navIcon, tab === t && { color: red }]}>
                {["⌕", "♡", "☠", "🎬", "▦", "⌂"][i]}
              </Text>
              <Text
                style={[s.navLabel, tab === t && { color: red }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {t}
                {t === "Saved" && saved.length ? ` (${saved.length})` : ""}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Modal
        visible={picker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPicker(null)}
      >
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sectionTitle}>
              {picker === "model"
                ? "Choose model"
                : "Choose version / model ID"}
            </Text>
            <Text style={s.subtitle}>
              This catalog covers 210 source-listed Kraton parts and their
              shared-model associations. Another model filter shows shared
              entries, not its full parts catalog.
            </Text>
            <TextInput
              style={[s.search, { padding: 12 }]}
              value={vehicleQuery}
              onChangeText={setVehicleQuery}
              placeholder="Find a model or model number"
              accessibilityLabel="Filter vehicle picker"
            />
            <ScrollView
              style={{ maxHeight: 400 }}
              keyboardShouldPersistTaps="handled"
            >
              {(picker === "model" ? models : versionsForModel(model))
                .filter((v) =>
                  v.toLowerCase().includes(vehicleQuery.toLowerCase().trim()),
                )
                .map((v) => (
                  <Pressable
                    key={v}
                    style={s.option}
                    onPress={() => {
                      if (picker === "model") {
                        setModel(v);
                        setVersion(allVersions);
                      } else {
                        setVersion(v);
                      }
                      setPicker(null);
                    }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        marginRight: 10,
                        fontSize: 15,
                        lineHeight: 21,
                        color:
                          (picker === "model" ? model : version) === v
                            ? red
                            : "#222",
                      }}
                    >
                      {v}
                    </Text>
                    <Text>
                      {(picker === "model" ? model : version) === v ? "✓" : "→"}
                    </Text>
                  </Pressable>
                ))}
            </ScrollView>
            <Pressable style={s.close} onPress={() => setPicker(null)}>
              <Text>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal
        visible={!!selected || cartVendor !== null}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setSelected(null);
          setCartVendor(null);
        }}
      >
        <View style={s.overlay}>
          <View style={s.sheet}>
            <ScrollView>
              {cartVendor && (
                <VendorCartPanel
                  vendor={cartVendor}
                  cart={cart}
                  onVendor={setCartVendor}
                  onQuantity={quantity}
                  onClose={() => setCartVendor(null)}
                  onManualCheckout={manualCheckout}
                  onCheckout={(url) =>
                    Alert.alert(
                      "Continue to Jenny’s RC?",
                      "This replaces the existing Jenny’s browser cart with your selected matched items and quantities. Check take-off contents, final prices and stock there before ordering.",
                      [
                        { text: "Stay in app", style: "cancel" },
                        {
                          text: "Open Jenny’s cart",
                          onPress: () => void open(url),
                        },
                      ],
                    )
                  }
                  storageError={storageError}
                />
              )}
              {!cartVendor && selected && (
                <>
                  <View style={s.section}>
                    <Text style={s.partNumber}>
                      {selected.brand} / Part:{" "}
                      {selected.manufacturerPartNumber ?? selected.id}
                    </Text>
                    <Pressable
                      onPress={() => setSelected(null)}
                      accessibilityLabel="Close comparison"
                    >
                      <Text style={{ fontSize: 24 }}>✕</Text>
                    </Pressable>
                  </View>
                  <Text style={s.bannerTitle}>{selected.name}</Text>
                  <Text style={s.subtitle}>{selected.description}</Text>
                  <ProductImage key={`image-${selected.id}`} part={selected} />
                  {storageError !== "" && (
                    <Text style={s.noticeText}>{storageError}</Text>
                  )}
                  <View style={s.accordionTop}>
                    <Text style={s.accordionHint}>
                      Tap a section to open it
                    </Text>
                    <Pressable
                      onPress={() => setExpandedSections([])}
                      accessibilityRole="button"
                      accessibilityLabel="Collapse all part detail sections"
                    >
                      <Text style={s.link}>Collapse all</Text>
                    </Pressable>
                  </View>
                  <PartSection
                    title="Compatible vehicles"
                    expanded={expandedSections.includes("fitment")}
                    onToggle={() => toggleSection("fitment")}
                  >
                    <FitmentList
                      key={`fitment-${selected.id}`}
                      part={selected}
                    />
                  </PartSection>
                  <PartSection
                    title="Price comparison & carts"
                    expanded={expandedSections.includes("vendors")}
                    onToggle={() => toggleSection("vendors")}
                  >
                    <VendorComparison
                      key={selected.id}
                      part={selected}
                      cart={cart}
                      onAdd={add}
                      onCart={openCart}
                    />
                  </PartSection>
                  <PartSection
                    title="Maintenance videos"
                    expanded={expandedSections.includes("repair")}
                    onToggle={() => toggleSection("repair")}
                  >
                    <Text style={s.fitment}>
                      Browse the official ARRMA support tutorials. Confirm your
                      exact model before using a procedure.
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setSelected(null);
                        setTab("Maintenance");
                      }}
                    >
                      <Text style={s.link}>🎬 Open Maintenance →</Text>
                    </Pressable>
                  </PartSection>
                  <PartSection
                    title="Related products & 3D prints"
                    expanded={expandedSections.includes("related")}
                    onToggle={() => toggleSection("related")}
                  >
                    <RelatedProducts
                      key={`related-${selected.id}`}
                      part={selected}
                      vehicle={vehicle}
                      open={(url) => void open(url)}
                    />
                  </PartSection>
                  <PartSection
                    title="Source & catalog information"
                    expanded={expandedSections.includes("source")}
                    onToggle={() => toggleSection("source")}
                  >
                    <Text style={s.fitment}>
                      Source: {selected.provenance.publisher} replacement-parts
                      lookup for {selected.provenance.vehicleId}. Captured{" "}
                      {selected.provenance.observedAt.slice(0, 10)}. Categories
                      are inferred from listing titles.
                    </Text>
                    <Text selectable style={s.fitment}>
                      Catalog ID: {selected.id}
                      {"\n"}Source: {selected.provenance.sourceUrl}
                    </Text>
                  </PartSection>
                  <Pressable
                    style={s.saveButton}
                    onPress={() => toggle(selected.id)}
                  >
                    <Text style={s.compareText}>
                      {saved.includes(selected.id)
                        ? "Remove from saved"
                        : "Save for later"}
                    </Text>
                  </Pressable>
                  <View style={s.notice}>
                    <Text style={s.noticeText}>
                      Retailer-listed fitment · Diagram verification pending. No
                      live quotes or stock feeds are connected. Any displayed
                      Horizon price is a dated snapshot. Catalog IDs may differ
                      from manufacturer part numbers.
                    </Text>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
function PartSection({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={s.accordion}>
      <Pressable
        style={s.accordionButton}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded }}
      >
        <Text style={s.accordionTitle}>{title}</Text>
        <Text style={s.accordionArrow}>{expanded ? "−" : "+"}</Text>
      </Pressable>
      {expanded && <View style={s.accordionBody}>{children}</View>}
    </View>
  );
}
const s = StyleSheet.create({
  accordionTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 12,
  },
  accordionHint: { color: "#687268", fontSize: 13 },
  accordion: {
    borderWidth: 1,
    borderColor: "#dfe3da",
    borderRadius: 12,
    marginBottom: 9,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  accordionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 54,
    paddingHorizontal: 14,
  },
  accordionTitle: {
    flex: 1,
    color: "#273129",
    fontSize: 16,
    fontWeight: "700",
  },
  accordionArrow: { color: "#e5432f", fontSize: 24, paddingLeft: 10 },
  accordionBody: { paddingHorizontal: 14, paddingBottom: 16 },
  safe: { flex: 1, backgroundColor: "#f8f8f5", paddingTop: 0 },
  shell: { flex: 1, width: "100%", maxWidth: 1000, alignSelf: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderColor: "#e4e4df",
  },
  logo: {
    backgroundColor: red,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
    transform: [{ skewX: "-9deg" }],
  },
  logoText: {
    color: "white",
    fontSize: 28,
    fontWeight: "900",
    fontStyle: "italic",
  },
  wordmark: { fontWeight: "900", fontSize: 17, letterSpacing: 0.5 },
  micro: { fontSize: 9, fontWeight: "700", letterSpacing: 1, color: "#777c80" },
  brandCredit: {
    fontSize: 10,
    fontWeight: "700",
    color: "#e5432f",
    marginTop: 2,
  },
  demo: { borderWidth: 1, borderColor: "#d4d7ce", padding: 6, borderRadius: 4 },
  demoText: { fontSize: 8, fontWeight: "800", color: "#697461" },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24 },
  eyebrow: {
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    marginBottom: 14,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: red },
  label: {
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: "800",
    color: "#72766f",
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    letterSpacing: -0.5,
    color: "#202521",
  },
  subtitle: {
    fontSize: 14,
    color: "#787d76",
    lineHeight: 21,
    marginVertical: 14,
  },
  vehicle: {
    marginTop: 8,
    backgroundColor: "#eeefe9",
    borderWidth: 1,
    borderColor: "#dfe1d8",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  vehicleName: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 3,
    color: "#333b31",
  },
  search: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "white",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#dedfd9",
    borderRadius: 10,
  },
  input: { flex: 1, paddingVertical: 10, fontSize: 14, color: "#252a25" },
  notice: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    backgroundColor: "#f4efdf",
    borderRadius: 8,
    marginVertical: 15,
  },
  noticeText: { fontSize: 11, lineHeight: 17, color: "#8b6c33", flex: 1 },
  catalogNote: { fontSize: 10, lineHeight: 15, color: "#8b6c33", marginTop: 8 },
  resultsHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
    marginBottom: 10,
  },
  viewSelect: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#ccd5c4",
    borderRadius: 7,
    backgroundColor: "white",
  },
  viewSelectText: { fontSize: 12, fontWeight: "700", color: "#34422c" },
  viewMenu: {
    borderWidth: 1,
    borderColor: "#d7ddd2",
    borderRadius: 8,
    backgroundColor: "white",
    marginBottom: 12,
  },
  viewOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    minHeight: 44,
  },
  partsToggle: {
    marginTop: 12,
    marginBottom: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#dfe3da",
    borderRadius: 10,
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  partsToggleTitle: { fontSize: 16, fontWeight: "800", color: "#293127" },
  chips: { gap: 8, paddingVertical: 4 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#dedfd9",
  },
  activeChip: { backgroundColor: "#283329", borderColor: "#283329" },
  chipText: { fontSize: 12, fontWeight: "600", color: "#666f64" },
  section: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: "#293127",
  },
  count: { fontSize: 11, color: "#858b81" },
  grid: { gap: 12 },
  card: {
    width: "100%",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e5e6df",
    borderRadius: 12,
    overflow: "hidden",
  },
  art: {
    height: 145,
    backgroundColor: "#e9eae4",
    padding: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  artLabel: {
    position: "absolute",
    top: 12,
    left: 12,
    fontSize: 7,
    letterSpacing: 1,
    color: "#858b7d",
  },
  partIcon: {
    fontSize: 75,
    color: "#424c40",
    fontWeight: "900",
    transform: [{ rotate: "-20deg" }],
  },
  artBottom: {
    position: "absolute",
    bottom: 12,
    left: 12,
    fontSize: 8,
    fontWeight: "800",
    color: "#989e91",
    letterSpacing: 2,
  },
  bookmark: {
    position: "absolute",
    right: 8,
    top: 7,
    padding: 8,
    backgroundColor: "#ffffffbb",
    borderRadius: 20,
  },
  cardBody: { padding: 12 },
  partNumber: {
    fontSize: 9,
    color: "#8b9185",
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  partName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#30372c",
    marginVertical: 7,
  },
  fitment: { fontSize: 10, lineHeight: 16, color: "#8b9186" },
  cardFooter: {
    borderTopWidth: 1,
    borderColor: "#eff0eb",
    paddingTop: 12,
    marginTop: 14,
    gap: 8,
  },
  price: { fontSize: 21, fontWeight: "800", color: "#30372c", marginTop: 3 },
  compare: {
    backgroundColor: red,
    borderRadius: 6,
    padding: 10,
    alignItems: "center",
  },
  compareText: { color: "white", fontSize: 12, fontWeight: "700" },
  upgradeBanner: {
    backgroundColor: "#26382c",
    borderRadius: 12,
    padding: 24,
    marginTop: 26,
  },
  bannerKicker: {
    color: "#b9c998",
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: "700",
  },
  bannerTitle: {
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: -0.8,
    marginTop: 10,
    color: "#30372c",
  },
  bannerText: {
    color: "#c1c9bd",
    fontSize: 13,
    lineHeight: 21,
    marginVertical: 12,
  },
  bannerLink: {
    color: "#e2e9cb",
    fontWeight: "700",
    fontSize: 13,
    marginTop: 5,
  },
  disclaimer: {
    fontSize: 10,
    color: "#92978d",
    lineHeight: 17,
    marginTop: 20,
    textAlign: "center",
  },
  nav: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: "#e0e3d9",
    backgroundColor: "#fafbf7",
    paddingVertical: 7,
  },
  navItem: { flex: 1, alignItems: "center", gap: 3 },
  navIcon: { fontSize: 20, color: "#8c9487" },
  navLabel: { fontSize: 9, color: "#8c9487", fontWeight: "700" },
  overlay: {
    flex: 1,
    backgroundColor: "#18211988",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  sheet: {
    backgroundColor: "#fafbf7",
    padding: 24,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "90%",
    width: "100%",
    maxWidth: 650,
  },
  option: {
    paddingVertical: 17,
    borderBottomWidth: 1,
    borderColor: "#e3e5dc",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  close: { padding: 18, alignItems: "center" },
  listing: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderColor: "#e0e3d9",
    gap: 12,
  },
  link: { color: red, fontSize: 12, fontWeight: "700", marginTop: 10 },
  saveButton: {
    backgroundColor: red,
    padding: 17,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  empty: { padding: 25, backgroundColor: "#eeefe9", borderRadius: 10 },
});
