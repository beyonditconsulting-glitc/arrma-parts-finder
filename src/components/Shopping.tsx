import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { parts, type Part } from "../catalog";
import {
  vendors,
  vendorCartCount,
  checkoutCapability,
  type Vendor,
  type CartLine,
} from "../cart";
import { vendorOffer } from "../offers";
export function VendorComparison({
  part,
  cart,
  onAdd,
  onCart,
}: {
  part: Part;
  cart: CartLine[];
  onAdd: (vendor: Vendor, id: string) => void;
  onCart: (vendor: Vendor) => void;
}) {
  const [added, setAdded] = useState<Vendor | null>(null);
  return (
    <View>
      <Text style={s.heading}>Compare vendors</Text>
      <Text style={s.note}>
        No live quotes connected. Observed prices are snapshots, not purchase
        guarantees. Shipping and tax are not included.
      </Text>
      {vendors.map((vendor) => {
        const offer = vendorOffer(vendor, part.observedPrice);
        const count =
          cart.find((line) => line.partId === part.id && line.vendor === vendor)
            ?.quantity ?? 0;
        return (
          <View key={vendor} style={s.card}>
            <View style={s.row}>
              <Text style={s.title}>{vendor}</Text>
              <Text style={s.price}>{offer.label}</Text>
            </View>
            <Text style={s.note}>
              {offer.status === "snapshot"
                ? `Captured ${offer.price.observedAt.slice(0, 10)} · Not live · Stock unverified`
                : "No verified listing, price or stock connected."}
            </Text>
            <View style={s.row}>
              <Pressable
                style={s.button}
                onPress={() => {
                  onAdd(vendor, part.id);
                  setAdded(vendor);
                }}
                accessibilityLabel={`Add ${part.name} to ${vendor} in-app cart`}
              >
                <Text style={s.buttonText}>
                  Add to app cart{count ? ` (${count})` : ""}
                </Text>
              </Pressable>
              <Pressable onPress={() => onCart(vendor)}>
                <Text style={s.link}>
                  Review cart ({vendorCartCount(cart, vendor)})
                </Text>
              </Pressable>
            </View>
          </View>
        );
      })}
      <Text style={s.note} accessibilityLiveRegion="polite">
        {added
          ? `Saved in your ${added} in-app cart. Nothing has been sent to the retailer.`
          : "Each vendor has a separate cart saved on this device."}
      </Text>
    </View>
  );
}
export function VendorCartPanel({
  vendor,
  cart,
  onVendor,
  onQuantity,
  onClose,
  onManualCheckout,
  storageError,
}: {
  vendor: Vendor;
  cart: CartLine[];
  onVendor: (vendor: Vendor) => void;
  onQuantity: (vendor: Vendor, id: string, count: number) => void;
  onClose: () => void;
  onManualCheckout: (vendor: Vendor, part: Part) => void;
  storageError: string;
}) {
  const lines = cart.filter((line) => line.vendor === vendor);
  const capability = checkoutCapability(vendor);
  return (
    <View>
      <View style={s.row}>
        <Text style={s.heading}>Your vendor carts</Text>
        <Pressable onPress={onClose} accessibilityLabel="Close carts">
          <Text style={s.title}>✕</Text>
        </Pressable>
      </View>
      <View style={s.tabs}>
        {vendors.map((v) => (
          <Pressable
            key={v}
            onPress={() => onVendor(v)}
            style={[s.tab, v === vendor && { backgroundColor: "#283329" }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: v === vendor }}
          >
            <Text
              style={{
                color: v === vendor ? "white" : "#283329",
                fontSize: 11,
              }}
            >
              {v} ({vendorCartCount(cart, v)})
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.note}>
        Saved in this app on your device. These are not items in the retailer’s
        cart.
      </Text>
      {storageError !== "" && <Text style={s.warning}>{storageError}</Text>}
      {lines.length === 0 ? (
        <Text style={s.title}>This vendor cart is empty.</Text>
      ) : (
        lines.map((line) => {
          const part = parts.find((p) => p.id === line.partId);
          if (!part) return null;
          return (
            <View style={s.card} key={line.partId}>
              <Text style={s.title}>{part.name}</Text>
              <Text style={s.note}>
                {part.manufacturerPartNumber ?? part.id} · Quantity{" "}
                {line.quantity}
              </Text>
              <View style={s.row}>
                <View style={s.tabs}>
                  <Pressable
                    style={s.quantity}
                    onPress={() =>
                      onQuantity(vendor, part.id, line.quantity - 1)
                    }
                    accessibilityLabel={`Decrease ${part.name} quantity`}
                  >
                    <Text>−</Text>
                  </Pressable>
                  <Text>{line.quantity}</Text>
                  <Pressable
                    style={s.quantity}
                    disabled={line.quantity >= 99}
                    onPress={() =>
                      onQuantity(vendor, part.id, line.quantity + 1)
                    }
                    accessibilityLabel={`Increase ${part.name} quantity`}
                  >
                    <Text>+</Text>
                  </Pressable>
                </View>
                <Pressable onPress={() => onQuantity(vendor, part.id, 0)}>
                  <Text style={s.link}>Remove</Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}
      <Text style={s.note}>
        No verified total is available. Price, shipping, tax and availability
        must be confirmed at checkout.
      </Text>
      <View
        style={s.disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
      >
        <Text style={s.title}>Retailer cart transfer unavailable</Text>
        <Text style={s.note}>{capability.reason}</Text>
      </View>
      {lines.length > 0 && (
        <>
          <Text style={s.note}>
            Ready to buy manually? The following links leave this app. They open
            one product/search at a time and do not transfer this cart.
          </Text>
          {lines.map((line) => {
            const part = parts.find((p) => p.id === line.partId);
            return part ? (
              <Pressable
                key={line.partId}
                style={s.manual}
                onPress={() => onManualCheckout(vendor, part)}
              >
                <Text style={s.link}>
                  Shop {part.manufacturerPartNumber ?? part.id} at {vendor} ↗
                </Text>
              </Pressable>
            ) : null;
          })}
        </>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  heading: {
    fontSize: 22,
    fontWeight: "800",
    color: "#283329",
    marginVertical: 12,
  },
  title: { fontSize: 15, fontWeight: "700", color: "#283329" },
  note: { fontSize: 12, lineHeight: 19, color: "#737a6b", marginVertical: 9 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  card: {
    borderWidth: 1,
    borderColor: "#e1e5da",
    borderRadius: 10,
    padding: 14,
    marginVertical: 8,
    backgroundColor: "white",
  },
  price: { fontSize: 16, fontWeight: "800", color: "#283329" },
  button: { backgroundColor: "#e5432f", borderRadius: 6, padding: 12 },
  buttonText: { color: "white", fontSize: 12, fontWeight: "700" },
  link: { color: "#bd3626", fontSize: 12, fontWeight: "700" },
  tabs: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
    marginVertical: 12,
  },
  tab: {
    borderWidth: 1,
    borderColor: "#ced5c6",
    borderRadius: 20,
    padding: 10,
  },
  quantity: {
    borderWidth: 1,
    borderColor: "#cad1c3",
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  disabled: {
    backgroundColor: "#e8ebe3",
    borderRadius: 8,
    padding: 14,
    marginTop: 18,
  },
  warning: { color: "#ae4d1d", fontSize: 12, lineHeight: 18 },
  manual: { paddingVertical: 14, borderBottomWidth: 1, borderColor: "#e1e5da" },
});
