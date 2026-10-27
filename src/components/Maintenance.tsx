import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import {
  maintenanceSource,
  maintenanceCategories,
  searchMaintenance,
  maintenancePlayerHtml,
  isMaintenancePlayerNavigationAllowed,
  MAINTENANCE_PLAYER_ORIGIN,
  type MaintenanceVideo,
} from "../maintenance.ts";

export function Maintenance() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All videos");
  const [selected, setSelected] = useState<MaintenanceVideo | null>(null);
  const videos = searchMaintenance(query, category);
  return (
    <View>
      <Text style={s.title}>🎬 Maintenance</Text>
      <Text style={s.note}>
        Official ARRMA support videos from Horizon Hobby. Check your exact
        model, tools and manual before starting a repair.
      </Text>
      <TextInput
        style={s.search}
        placeholder="Search shocks, diff, servo, 6S…"
        accessibilityLabel="Search maintenance videos"
        value={query}
        onChangeText={setQuery}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filters}
      >
        {maintenanceCategories.map((c) => (
          <Pressable
            key={c}
            onPress={() => setCategory(c)}
            style={[s.filter, c === category && s.active]}
            accessibilityRole="button"
            accessibilityState={{ selected: c === category }}
          >
            <Text
              style={{
                fontSize: 12,
                color: c === category ? "white" : "#34422c",
              }}
            >
              {c}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={s.note}>
        {videos.length} videos · Source captured{" "}
        {maintenanceSource.observedAt.slice(0, 10)}
      </Text>
      {videos.map((video) => (
        <Pressable
          key={video.id}
          style={s.card}
          onPress={() => setSelected(video)}
          accessibilityRole="button"
          accessibilityLabel={`Play ${video.title}`}
        >
          <VideoThumbnail video={video} />
          <View style={{ flex: 1 }}>
            <Text style={s.category}>{video.category.toUpperCase()}</Text>
            <Text style={s.name}>{video.title}</Text>
            <Text style={s.link}>▶ Watch in app</Text>
          </View>
        </Pressable>
      ))}
      {videos.length === 0 && (
        <Text style={s.note}>
          No videos match. Try another term or category.
        </Text>
      )}
      <Text selectable style={s.source}>
        Source: {maintenanceSource.sourceUrl}
      </Text>
      <Modal
        visible={selected !== null}
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        {selected && (
          <MaintenancePlayer
            key={selected.id}
            video={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </Modal>
    </View>
  );
}
function VideoThumbnail({ video }: { video: MaintenanceVideo }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={s.thumbnail}>
      {failed ? (
        <Text style={{ fontSize: 28 }}>🎬</Text>
      ) : (
        <Image
          source={{ uri: `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg` }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
          accessibilityLabel={`Video thumbnail: ${video.title}`}
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}
function MaintenancePlayer({
  video,
  onClose,
}: {
  video: MaintenanceVideo;
  onClose: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const html = useMemo(() => maintenancePlayerHtml(video.id), [video.id]);
  useEffect(() => {
    if (!loading || error) return;
    const timer = setTimeout(() => {
      setLoading(false);
      setError(
        "The video player did not respond. Check your connection and try again.",
      );
    }, 20000);
    return () => clearTimeout(timer);
  }, [loading, error, attempt]);
  return (
    <SafeAreaView style={s.playerScreen}>
      <View style={s.playerHeader}>
        <Text style={s.heading}>🎬 Maintenance</Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close maintenance video"
        >
          <Text style={s.link}>Done ✕</Text>
        </Pressable>
      </View>
      <ScrollView>
        <View style={s.player}>
          {error ? (
            <View style={s.error}>
              <Text style={s.note}>{error}</Text>
              <Pressable
                style={s.retry}
                onPress={() => {
                  setError("");
                  setLoading(true);
                  setAttempt((n) => n + 1);
                }}
              >
                <Text style={{ color: "white", fontWeight: "700" }}>
                  Retry video
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              <WebView
                key={`${video.id}-${attempt}`}
                source={{ html, baseUrl: MAINTENANCE_PLAYER_ORIGIN }}
                style={s.web}
                originWhitelist={["https://*", "about:blank"]}
                javaScriptEnabled
                domStorageEnabled
                allowsInlineMediaPlayback
                allowsFullscreenVideo
                mediaPlaybackRequiresUserAction
                setSupportMultipleWindows={false}
                onShouldStartLoadWithRequest={(request) =>
                  isMaintenancePlayerNavigationAllowed(request.url)
                }
                onOpenWindow={() => {}}
                onError={() => {
                  setLoading(false);
                  setError(
                    "The video could not load. Check your connection and try again.",
                  );
                }}
                onHttpError={() => {
                  setLoading(false);
                  setError(
                    "The video provider returned an error. Please try again later.",
                  );
                }}
                onMessage={(event) => {
                  try {
                    const data = JSON.parse(event.nativeEvent.data);
                    if (data.type === "ready") setLoading(false);
                    else if (data.type === "error") {
                      setLoading(false);
                      setError(
                        `The publisher’s player cannot show this video here (code ${String(data.code)}). Try again later.`,
                      );
                    }
                  } catch {
                    /* Ignore non-player messages. */
                  }
                }}
              />
              {loading && (
                <View pointerEvents="none" style={s.spinner}>
                  <ActivityIndicator color="#e5432f" />
                  <Text style={s.spinnerText}>Loading video…</Text>
                </View>
              )}
            </>
          )}
        </View>
        <View style={s.details}>
          <Text style={s.name}>{video.title}</Text>
          <Text style={s.note}>{video.description}</Text>
          <Text style={s.note}>
            Tap play in the video. Playback requires an internet connection;
            ads, availability and embedding restrictions are controlled by
            YouTube and the publisher.
          </Text>
          {video.requiredItems.length > 0 && (
            <>
              <Text style={s.heading}>Required items from the source</Text>
              {video.requiredItems.map((item, index) => (
                <Text key={`${index}-${item}`} style={s.note}>
                  • {item}
                </Text>
              ))}
            </>
          )}
          <Text style={s.heading}>Confirm your model first</Text>
          <Text style={s.note}>
            A tutorial title is not verified part compatibility. Follow your
            vehicle’s official manual and the video’s safety instructions.
          </Text>
          <Text selectable style={s.source}>
            Horizon Hobby ARRMA Support{"\n"}
            {maintenanceSource.sourceUrl}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  title: { fontSize: 27, fontWeight: "800", color: "#283329" },
  heading: { fontSize: 17, fontWeight: "800", color: "#283329", marginTop: 12 },
  note: { fontSize: 12, lineHeight: 19, color: "#6f7966", marginVertical: 8 },
  search: {
    borderWidth: 1,
    borderColor: "#d7ded0",
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    fontSize: 14,
    color: "#283329",
  },
  filters: { gap: 8, paddingVertical: 12 },
  filter: {
    borderWidth: 1,
    borderColor: "#d3dbcc",
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  active: { backgroundColor: "#283329", borderColor: "#283329" },
  card: {
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderColor: "#dfe5d8",
    backgroundColor: "white",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    alignItems: "center",
  },
  thumbnail: {
    width: 100,
    height: 64,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#e7ebdf",
    alignItems: "center",
    justifyContent: "center",
  },
  category: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#819073",
  },
  name: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
    color: "#283329",
    marginVertical: 6,
  },
  link: { fontSize: 12, fontWeight: "700", color: "#bd3626", marginTop: 6 },
  source: {
    fontSize: 10,
    lineHeight: 16,
    color: "#89957e",
    marginVertical: 16,
  },
  playerScreen: { flex: 1, backgroundColor: "#f8f9f4" },
  playerHeader: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  player: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "black" },
  web: { flex: 1, backgroundColor: "black" },
  details: { padding: 20 },
  spinner: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "#000a",
    padding: 8,
    borderRadius: 8,
  },
  spinnerText: { fontSize: 10, color: "white", marginTop: 4 },
  error: {
    flex: 1,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e9ece3",
  },
  retry: {
    backgroundColor: "#e5432f",
    borderRadius: 7,
    padding: 12,
    marginTop: 6,
  },
});
