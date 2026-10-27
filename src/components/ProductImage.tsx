import { useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import type { Part } from "../catalog";

export function ProductImage({ part }: { part: Part }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const image = part.image;
  return (
    <View>
      <View style={s.frame}>
        {image && !failed ? (
          <>
            <Image
              source={{ uri: image.url }}
              style={s.image}
              resizeMode="contain"
              accessible
              accessibilityLabel={image.alt || part.name}
              onLoadEnd={() => setLoading(false)}
              onError={() => {
                setFailed(true);
                setLoading(false);
              }}
            />
            {loading && (
              <ActivityIndicator
                style={s.loading}
                color="#e5432f"
                accessibilityLabel="Loading product image"
              />
            )}
          </>
        ) : (
          <Text style={s.fallback}>
            {failed
              ? "Product image could not load. Check your connection."
              : "Product image unavailable."}
          </Text>
        )}
      </View>
      {image && !failed && (
        <Text style={s.caption}>Product image from Horizon Hobby</Text>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  frame: {
    height: 250,
    width: "100%",
    borderRadius: 12,
    backgroundColor: "#fff",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e3e5df",
    marginTop: 8,
  },
  image: { width: "100%", height: "100%" },
  loading: { position: "absolute" },
  fallback: {
    padding: 24,
    textAlign: "center",
    fontSize: 13,
    color: "#727a6c",
    lineHeight: 20,
  },
  caption: { fontSize: 10, color: "#858d7e", marginTop: 7 },
});
