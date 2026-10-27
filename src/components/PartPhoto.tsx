import React, { useState } from "react";
import { Image, StyleSheet, Text } from "react-native";
import { selectPartImage, type PartImage } from "../partImages";

type Props = {
  partNumber: string | null;
  partName: string;
  fallbackIcon: string;
  /** Optional records for callers with an independently reviewed photo feed. */
  candidates?: readonly PartImage[];
};

/** Render verified, licensed photos only, falling back when absent or unavailable. */
export function PartPhoto({ partNumber, partName, fallbackIcon, candidates }: Props) {
  const photo = selectPartImage(partNumber, candidates);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!photo || failedUrl === photo.imageUrl) {
    return <Text style={styles.icon}>{fallbackIcon}</Text>;
  }
  return (
    <Image
      source={{ uri: photo.imageUrl }}
      style={styles.image}
      resizeMode="contain"
      accessibilityLabel={`Photo of ${partName}, ${partNumber}. Source: ${photo.sourceName}`}
      onError={() => setFailedUrl(photo.imageUrl)}
    />
  );
}

const styles = StyleSheet.create({
  image: { width: "88%", height: 105 },
  icon: { fontSize: 75, color: "#424c40", fontWeight: "900", transform: [{ rotate: "-20deg" }] },
});
