import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { bundledProductPhoto } from "../productPhotoAssets";
import { productPhoto } from "../productPhotos.ts";
import type { Part } from "../catalog";

export function ProductImage({
  part,
  compact = false,
}: {
  part: Part;
  compact?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const image = productPhoto(part);
  const photoSource = image ? `${image.publisher} · ${image.note}` : "";
  return (
    <View style={compact ? s.compactContainer : undefined}>
      <View style={[s.frame, compact && s.compactFrame]}>
        {image && !failed ? (
          <>
            <Image
              key={`${image.url}-${attempt}`}
              source={
                bundledProductPhoto(part.id, image.url) ?? { uri: image.url }
              }
              style={s.image}
              resizeMode="contain"
              accessible
              accessibilityLabel={`${image.alt || part.name}. Photo source: ${photoSource}`}
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
          <View style={s.unavailable}>
            <Text style={[s.fallback, compact && s.compactFallback]}>
              {failed
                ? "Photo could not load."
                : "No exact Jenny’s product photo matched yet."}
            </Text>
            {failed && image && (
              <Pressable
                style={s.retry}
                accessibilityRole="button"
                accessibilityLabel={`Retry loading photo of ${part.name}`}
                onPress={(event) => {
                  event.stopPropagation();
                  setAttempt((value) => value + 1);
                  setFailed(false);
                  setLoading(true);
                }}
              >
                <Text style={s.retryText}>Retry photo</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
      {!compact && image && !failed && (
        <Text style={s.caption}>{photoSource}</Text>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  compactContainer: { width: "100%" },
  compactFrame: { height: 105, borderWidth: 0, borderRadius: 6, marginTop: 0 },
  compactFallback: { padding: 8, fontSize: 11, lineHeight: 15 },
  unavailable: { alignItems: "center", padding: 8 },
  retry: { paddingHorizontal: 12, paddingVertical: 8 },
  retryText: { color: "#bd3626", fontSize: 12, fontWeight: "700" },
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
