import React, { useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { File, Paths } from "expo-file-system";
import Storage from "expo-sqlite/kv-store";

type Draft = { title: string; model: string; story: string; youtube: string; photo: string };
const storageKey = "pit-finder.graveyard.draft.v1";
const empty: Draft = { title: "", model: "", story: "", youtube: "", photo: "" };
function loadDraft(): Draft {
  try { const raw = Storage.getItemSync(storageKey); return raw ? { ...empty, ...JSON.parse(raw) } : empty; } catch { return empty; }
}
function isYouTubeLink(value: string) {
  if (!value.trim()) return true;
  try { const u = new URL(value.trim()); return u.protocol === "https:" && ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(u.hostname); } catch { return false; }
}
export function Graveyard() {
  const [draft, setDraft] = useState<Draft>(loadDraft);
  const change = (key: keyof Draft, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const pick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      if (result.canceled) return;
      const source = new File(result.assets[0].uri);
      const target = new File(Paths.document, `graveyard-${Date.now()}.jpg`);
      source.copy(target);
      change("photo", target.uri);
    } catch { Alert.alert("Couldn’t add photo", "Please try another photo."); }
  };
  const save = () => {
    if (!draft.title.trim() || (!draft.photo && !draft.youtube.trim())) { Alert.alert("Add a title and photo or video link"); return; }
    if (!isYouTubeLink(draft.youtube)) { Alert.alert("Check the link", "Enter a full HTTPS YouTube link."); return; }
    try { Storage.setItemSync(storageKey, JSON.stringify(draft)); Alert.alert("Draft saved", "Saved on this device only. Community posting is not connected yet."); } catch { Alert.alert("Couldn’t save draft", "Please try again."); }
  };
  return <View style={s.container}>
    <Text style={s.title}>RC Graveyard</Text>
    <Text style={s.copy}>The aftermath of a good bash. Prepare your carnage story with a photo and a YouTube link.</Text>
    <Text style={s.notice}>Private draft on this device. Community uploads and public posts are not connected yet.</Text>
    <TextInput style={s.input} placeholder="Give your carnage a title" value={draft.title} onChangeText={(v) => change("title", v)} maxLength={100} />
    <TextInput style={s.input} placeholder="Vehicle model and version" value={draft.model} onChangeText={(v) => change("model", v)} maxLength={120} />
    <TextInput style={[s.input, s.story]} placeholder="What happened?" value={draft.story} onChangeText={(v) => change("story", v)} multiline maxLength={2000} />
    <TextInput style={s.input} placeholder="YouTube video link (optional)" value={draft.youtube} onChangeText={(v) => change("youtube", v)} autoCapitalize="none" keyboardType="url" />
    <Pressable style={s.outline} onPress={() => void pick()}><Text style={s.link}>{draft.photo ? "Change photo" : "Choose photo"}</Text></Pressable>
    {draft.photo ? <Image source={{ uri: draft.photo }} style={s.photo} accessibilityLabel="Graveyard draft photo" /> : null}
    <Pressable style={s.button} onPress={save}><Text style={s.buttonText}>Save private draft</Text></Pressable>
  </View>;
}
const s = StyleSheet.create({ container: { padding: 20 }, title: { fontSize: 32, fontWeight: "900", color: "#273129" }, copy: { color: "#59645a", fontSize: 16, lineHeight: 23, marginVertical: 12 }, notice: { color: "#72581f", backgroundColor: "#f7f0dd", padding: 12, borderRadius: 10, marginBottom: 16 }, input: { borderWidth: 1, borderColor: "#cdd4c8", borderRadius: 10, padding: 12, marginBottom: 12, backgroundColor: "white", color: "#273129" }, story: { height: 100, textAlignVertical: "top" }, outline: { borderWidth: 1, borderColor: "#e5432f", borderRadius: 10, padding: 12 }, link: { color: "#e5432f", fontWeight: "700", textAlign: "center" }, photo: { width: "100%", height: 200, borderRadius: 10, marginTop: 12 }, button: { backgroundColor: "#e5432f", borderRadius: 10, padding: 14, marginTop: 14 }, buttonText: { color: "white", fontWeight: "700", textAlign: "center" } });
