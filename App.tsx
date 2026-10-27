import React, { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVendorCart } from "./src/useVendorCart";
import { vendors, type Vendor } from "./src/cart";
import { displayObservedPrice } from "./src/offers";
import { VendorComparison, VendorCartPanel } from "./src/components/Shopping";
import { FitmentList } from "./src/components/FitmentList";
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
  vehicles,
  categories,
  catalogVehicle,
  searchParts,
  retailerUrl,
  type Part,
} from "./src/catalog";

const red = "#e5432f";
export default function App() {
  const { cart, add, quantity, storageError } = useVendorCart();
  const [cartVendor, setCartVendor] = useState<Vendor | null>(null);
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [query, setQuery] = useState("");
  const [vehicle, setVehicle] = useState(catalogVehicle);
  const [category, setCategory] = useState("All parts");
  const { tab: routeTab } = useLocalSearchParams<{ tab?: string }>();
  const tab = ["Explore", "Upgrades", "Saved"].includes(routeTab ?? "")
    ? routeTab!
    : "Explore";
  const setTab = (next: string) => router.setParams({ tab: next });
  const [saved, setSaved] = useState<string[]>([]);
  const [selected, setSelected] = useState<Part | null>(null);
  const [picker, setPicker] = useState(false);
  const [visibleCount, setVisibleCount] = useState(24);
  useEffect(() => setVisibleCount(24), [query, vehicle, category, tab]);
  const results = searchParts(
    query,
    vehicle,
    tab === "Upgrades" ? "Upgrades" : category,
  ).filter((p) => tab !== "Saved" || saved.includes(p.id));
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
          </View>
          <View style={s.demo}>
            <Text style={s.demoText}>SOURCED CATALOG</Text>
          </View>
        </View>
        <Pressable
          style={{
            paddingHorizontal: 22,
            paddingVertical: 12,
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
          <View style={s.eyebrow}>
            <View style={s.dot} />
            <Text style={s.label}>LESS SEARCHING. MORE BASHING.</Text>
          </View>
          <Text style={s.title}>
            {tab === "Saved"
              ? "Your next\npit stop."
              : tab === "Upgrades"
                ? "Built to go\nfurther."
                : "Find your part.\nGet back out."}
          </Text>
          <Text style={s.subtitle}>
            210 sourced replacement listings for ARA8708T1. Your next run starts
            here.
          </Text>
          <Pressable
            style={s.vehicle}
            onPress={() => setPicker(true)}
            accessibilityRole="button"
          >
            <View>
              <Text style={s.micro}>YOUR VEHICLE</Text>
              <Text style={s.vehicleName}>▱ {vehicle}</Text>
            </View>
            <Text style={{ fontSize: 22 }}>⌄</Text>
          </Pressable>
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
          <View style={s.notice}>
            <Text style={{ color: "#af7120", fontSize: 16 }}>ⓘ</Text>
            <Text style={s.noticeText}>
              Horizon-listed parts for ARA8708T1. Fitment is pending diagram
              verification. Only captured Horizon prices are available; no live
              three-vendor quotes. The “EXB V2” alias is not yet confirmed for
              this model ID.
            </Text>
          </View>
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
                    style={[s.chipText, category === c && { color: "white" }]}
                  >
                    {c}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          <View style={s.section}>
            <Text style={s.sectionTitle}>
              {tab === "Saved"
                ? "Saved parts"
                : tab === "Upgrades"
                  ? "Upgrade your setup"
                  : "Explore the parts bin"}
            </Text>
            <Text style={s.count}>{results.length} parts</Text>
          </View>
          {results.length === 0 && (
            <View style={s.empty}>
              <Text style={s.sectionTitle}>
                {tab === "Upgrades"
                  ? "Upgrade research is next"
                  : "Nothing in the pit yet"}
              </Text>
              <Text style={s.subtitle}>
                {tab === "Upgrades"
                  ? "No sourced upgrade records yet. We’ll add M2C, Perfect Pass and other brands when exact fitment evidence is available."
                  : "Try another search or vehicle. Tap a part’s bookmark to save it for this session."}
              </Text>
              <Pressable
                onPress={() => {
                  setQuery("");
                  setVehicle("All vehicles");
                  setCategory("All parts");
                  setTab("Explore");
                }}
              >
                <Text style={s.link}>Explore all parts →</Text>
              </Pressable>
            </View>
          )}
          <View style={s.grid}>
            {results.slice(0, visibleCount).map((p) => (
              <View key={p.id} style={s.card}>
                <Pressable
                  onPress={() => setSelected(p)}
                  style={s.art}
                  accessibilityLabel={`View other vehicles using ${p.name} and compare prices`}
                >
                  <Text style={s.artLabel}>{p.category.toUpperCase()}</Text>
                  <Text style={s.partIcon}>{p.icon}</Text>
                  <Text style={s.artBottom}>PIT / {p.brand.toUpperCase()}</Text>
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
                    {Math.max(0, p.fitments.length - 1)} other models. Diagram
                    check pending.
                  </Text>
                  <View style={s.cardFooter}>
                    <View>
                      <Text style={s.micro}>HORIZON SNAPSHOT · NOT LIVE</Text>
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
                      <Text style={s.compareText}>View vehicles & prices →</Text>
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
                Show more parts ({Math.min(visibleCount, results.length)} of{" "}
                {results.length})
              </Text>
            </Pressable>
          )}
          <View style={s.upgradeBanner}>
            <Text style={s.bannerKicker}>MAKE IT YOURS</Text>
            <Text style={[s.bannerTitle, { color: "white" }]}>
              Stock is just the start.
            </Text>
            <Text style={s.bannerText}>
              M2C, Perfect Pass and RPM upgrade records are not sourced yet. No
              compatibility claims until supporting evidence is available.
            </Text>
            <Pressable
              onPress={() => {
                setTab("Upgrades");
                setQuery("");
              }}
            >
              <Text style={s.bannerLink}>Upgrade research →</Text>
            </Pressable>
          </View>
          <Text style={s.disclaimer}>
            Independent enthusiast app. Not affiliated with ARRMA or the listed
            retailers. Saved parts last for this session.
          </Text>
        </ScrollView>
        <View style={s.nav}>
          {["Explore", "Upgrades", "Saved"].map((t, i) => (
            <Pressable
              key={t}
              style={s.navItem}
              onPress={() => setTab(t)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t }}
            >
              <Text style={[s.navIcon, tab === t && { color: red }]}>
                {["⌕", "⚡", "♡"][i]}
              </Text>
              <Text style={[s.navLabel, tab === t && { color: red }]}>
                {t}
                {t === "Saved" && saved.length ? ` (${saved.length})` : ""}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Modal
        visible={picker}
        transparent
        animationType="slide"
        onRequestClose={() => setPicker(false)}
      >
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sectionTitle}>Choose your vehicle</Text>
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
              {vehicles
                .filter((v) =>
                  v.toLowerCase().includes(vehicleQuery.toLowerCase().trim()),
                )
                .map((v) => (
                  <Pressable
                    key={v}
                    style={s.option}
                    onPress={() => {
                      setVehicle(v);
                      setPicker(false);
                    }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        marginRight: 10,
                        fontSize: 15,
                        lineHeight: 21,
                        color: vehicle === v ? red : "#222",
                      }}
                    >
                      {v}
                    </Text>
                    <Text>{vehicle === v ? "✓" : "→"}</Text>
                  </Pressable>
                ))}
            </ScrollView>
            <Pressable style={s.close} onPress={() => setPicker(false)}>
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
                  <View style={s.notice}>
                    <Text style={s.noticeText}>
                      Retailer-listed fitment · Diagram verification pending. No
                      live quotes or stock feeds are connected. Any displayed
                      Horizon price is a dated snapshot. Catalog IDs may differ
                      from manufacturer part numbers.
                    </Text>
                  </View>
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
                  {storageError !== "" && (
                    <Text style={s.noticeText}>{storageError}</Text>
                  )}
                  <FitmentList key={`fitment-${selected.id}`} part={selected} />
                  <VendorComparison
                    key={selected.id}
                    part={selected}
                    cart={cart}
                    onAdd={add}
                    onCart={openCart}
                  />
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
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8f8f5", paddingTop: 0 },
  shell: { flex: 1, width: "100%", maxWidth: 1000, alignSelf: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 22,
    gap: 10,
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
  wordmark: { fontWeight: "900", fontSize: 20, letterSpacing: 1 },
  micro: { fontSize: 9, fontWeight: "700", letterSpacing: 1, color: "#777c80" },
  demo: { borderWidth: 1, borderColor: "#d4d7ce", padding: 6, borderRadius: 4 },
  demoText: { fontSize: 8, fontWeight: "800", color: "#697461" },
  content: { padding: 22, paddingBottom: 32 },
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
    fontSize: 46,
    lineHeight: 49,
    fontWeight: "900",
    letterSpacing: -2,
    color: "#202521",
  },
  subtitle: {
    fontSize: 14,
    color: "#787d76",
    lineHeight: 21,
    marginVertical: 14,
  },
  vehicle: {
    marginTop: 12,
    backgroundColor: "#eeefe9",
    borderWidth: 1,
    borderColor: "#dfe1d8",
    padding: 16,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  vehicleName: {
    fontSize: 17,
    fontWeight: "700",
    marginTop: 6,
    color: "#333b31",
  },
  search: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "white",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#dedfd9",
    borderRadius: 10,
  },
  input: { flex: 1, paddingVertical: 17, fontSize: 14, color: "#252a25" },
  notice: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    backgroundColor: "#f4efdf",
    borderRadius: 8,
    marginVertical: 15,
  },
  noticeText: { fontSize: 11, lineHeight: 17, color: "#8b6c33", flex: 1 },
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
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    width: "48%",
    flexGrow: 1,
    minWidth: 145,
    maxWidth: 460,
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
    paddingVertical: 12,
  },
  navItem: { flex: 1, alignItems: "center", gap: 3 },
  navIcon: { fontSize: 25, color: "#8c9487" },
  navLabel: { fontSize: 10, color: "#8c9487", fontWeight: "700" },
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
