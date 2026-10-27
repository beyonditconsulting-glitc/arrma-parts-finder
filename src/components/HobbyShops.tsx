import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import shops from "../data/hobby-shops.json";
export function HobbyShops({ open }: { open: (url: string) => void }) {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("All");
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const results = shops.filter((shop) => (country === "All" || shop.country === country) && terms.every((term) => `${shop.name} ${shop.address} ${shop.city} ${shop.region} ${shop.country} ${shop.note}`.toLowerCase().includes(term)));
  return <View style={s.container}>
    <Text style={s.title}>Local hobby shops</Text>
    <Text style={s.copy}>Support the shops that keep the RC community running. Search by name, city, state, or country.</Text>
    <TextInput style={s.input} placeholder="Search shops or locations" value={query} onChangeText={setQuery} accessibilityLabel="Search hobby shops" />
    <View style={s.filters}>{["All", "USA", "Canada", "United Kingdom", "Australia"].map((item) => <Pressable key={item} onPress={() => setCountry(item)} style={[s.filter, country === item && s.active]} accessibilityRole="button" accessibilityState={{selected:country === item}}><Text style={country === item ? s.activeText : s.filterText}>{item}</Text></Pressable>)}</View>
    <Text style={s.copy}>A curated starter directory, checked October 27, 2026. Contact the shop to confirm hours and availability before visiting.</Text>
    {results.length === 0 && <Text style={s.copy}>No shops found in this directory for that search.</Text>}
    {results.map((shop) => <View key={shop.id} style={s.card}><Text style={s.name}>{shop.name}</Text><Text style={s.copy}>{shop.address}</Text><Text style={s.small}>{shop.note}</Text><View style={s.actions}><Pressable accessibilityRole="link" onPress={() => open(shop.website)}><Text style={s.link}>Visit shop →</Text></Pressable><Pressable accessibilityRole="link" onPress={() => open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${shop.name}, ${shop.address}`)}`)}><Text style={s.link}>Directions →</Text></Pressable></View></View>)}
    <Text style={s.small}>Listings are manually researched and are not a complete worldwide directory. Inclusion is not an endorsement or a guarantee of inventory.</Text>
  </View>;
}
const s=StyleSheet.create({container:{paddingVertical:12},title:{fontSize:32,fontWeight:"900",color:"#273129"},copy:{fontSize:15,lineHeight:22,color:"#687268",marginVertical:9},input:{backgroundColor:"white",borderWidth:1,borderColor:"#cdd4c8",borderRadius:10,padding:13,marginVertical:8},filters:{flexDirection:"row",flexWrap:"wrap",gap:8,marginVertical:8},filter:{borderWidth:1,borderColor:"#cdd4c8",borderRadius:20,paddingVertical:8,paddingHorizontal:13},active:{backgroundColor:"#e5432f",borderColor:"#e5432f"},activeText:{color:"white",fontWeight:"700"},filterText:{color:"#273129"},card:{backgroundColor:"white",padding:16,borderRadius:12,borderWidth:1,borderColor:"#e2e5dc",marginVertical:6},name:{fontSize:18,fontWeight:"800",color:"#273129"},small:{fontSize:13,lineHeight:19,color:"#687268",marginTop:4},actions:{flexDirection:"row",gap:22,flexWrap:"wrap"},link:{color:"#e5432f",fontSize:15,fontWeight:"700",paddingTop:12}});
