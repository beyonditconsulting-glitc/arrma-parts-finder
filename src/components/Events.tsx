import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import records from "../data/events.json";
import { pacificDate, nextFriday } from "../eventDates";

type Event = { id: string; name: string; start: string; end: string; location: string; region: string; category: string; source: string; sourceName: string; checked: string; details?: string };
const allEvents: Event[] = records;
function displayDate(value: string) { return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }); }
export function Events({ open }: { open: (url: string) => void }) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("All");
  const todayParts = pacificDate(new Date());
  const today = `${todayParts.year}-${String(todayParts.month).padStart(2, "0")}-${String(todayParts.day).padStart(2, "0")}`;
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = allEvents.filter((event) => event.end >= today && (region === "All" || event.region === region) && terms.every((term) => `${event.name} ${event.location} ${event.category}`.toLowerCase().includes(term))).sort((a, b) => a.start.localeCompare(b.start));
  return <View style={s.container}>
    <Text style={s.title}>RC Events</Text>
    <Text style={s.copy}>Find races and community events around the world.</Text>
    <View style={s.feature}><Text style={s.kicker}>ARRMA MAFIA · VIRTUAL GIVEAWAY</Text><Text style={s.featureTitle}>Free Shit Friday</Text><Text style={s.featureText}>Every last Friday of the month at 7:00 PM Pacific. Next: {nextFriday(new Date())}.</Text><Text style={s.featureText}>Join the Arrma Mafia Facebook group for the event and giveaway details.</Text><Pressable accessibilityRole="link" onPress={() => open("https://m.facebook.com/groups/arrmamafia/?ref=share&mibextid=wwXIfr")}><Text style={s.featureLink}>Visit Arrma Mafia on Facebook →</Text></Pressable></View>
    <TextInput style={s.input} value={query} onChangeText={setQuery} placeholder="Search event, city, or country" accessibilityLabel="Search events" />
    <View style={s.filters}>{["All", "USA", "International"].map((value) => <Pressable key={value} style={[s.filter, region === value && s.active]} onPress={() => setRegion(value)} accessibilityRole="button" accessibilityState={{ selected: region === value }}><Text style={region === value ? s.activeText : s.filterText}>{value}</Text></Pressable>)}</View>
    <Text style={s.copy}>Curated starter listings, checked October 27, 2026. Confirm details with organizers before making plans.</Text>
    {matches.length === 0 && <Text style={s.copy}>No upcoming events match this search.</Text>}
    {matches.map((event) => <View key={event.id} style={s.card}><Text style={s.eventName}>{event.name}</Text><Text style={s.details}>{displayDate(event.start)}{event.end !== event.start ? ` – ${displayDate(event.end)}` : ""}</Text><Text style={s.details}>{event.location} · {event.region}</Text>{event.details && <Text style={s.details}>{event.details}</Text>}<Text style={s.small}>{event.sourceName} · checked {displayDate(event.checked)}{event.sourceName === "RCSignup" ? " · listing start date; confirm full schedule" : ""}</Text><Pressable accessibilityRole="link" onPress={() => open(event.source)}><Text style={s.link}>{event.id === "rc-sand-sharks-2026-12-20" ? "Organizer website →" : "Event details →"}</Text></Pressable></View>)}
    <Text style={s.small}>Listings are a snapshot, not an automatically updated worldwide calendar.</Text>
  </View>;
}
const s = StyleSheet.create({container:{paddingVertical:12},title:{fontSize:34,fontWeight:"900",color:"#273129"},copy:{fontSize:15,lineHeight:22,color:"#687268",marginVertical:10},feature:{backgroundColor:"#24372b",padding:20,borderRadius:15,marginVertical:14},kicker:{color:"#c6d5ad",fontWeight:"700",fontSize:12},featureTitle:{color:"white",fontSize:26,fontWeight:"900",marginVertical:8},featureText:{color:"white",fontSize:15,lineHeight:22,marginBottom:7},featureLink:{color:"#dcecbf",fontWeight:"800",fontSize:15,marginTop:8},input:{backgroundColor:"white",borderWidth:1,borderColor:"#cdd4c8",borderRadius:10,padding:13,marginVertical:8},filters:{flexDirection:"row",flexWrap:"wrap",gap:8,marginVertical:8},filter:{borderWidth:1,borderColor:"#cdd4c8",borderRadius:20,paddingVertical:8,paddingHorizontal:13},active:{backgroundColor:"#e5432f",borderColor:"#e5432f"},activeText:{color:"white",fontWeight:"700"},filterText:{color:"#273129"},card:{backgroundColor:"white",padding:16,borderRadius:12,borderWidth:1,borderColor:"#e2e5dc",marginVertical:6},eventName:{fontSize:18,fontWeight:"800",color:"#273129"},details:{fontSize:15,color:"#475448",marginTop:6},small:{fontSize:12,lineHeight:18,color:"#687268",marginTop:8},link:{color:"#e5432f",fontSize:15,fontWeight:"700",paddingTop:10}});
