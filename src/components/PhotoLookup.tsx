import React, { useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Alert, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";

export function PhotoLookup({ model, version, onBarcode }: { model: string; version: string; onBarcode: (value: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scanned = useRef(false);
  const choose = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      if (!result.canceled) setPhoto(result.assets[0].uri);
    } catch { Alert.alert("Unable to select photo", "Please try choosing the photo again."); }
  };
  const openScanner = async () => {
    try {
      const access = permission?.granted ? permission : await requestPermission();
      if (!access.granted) { Alert.alert("Camera access needed", "Allow camera access to scan a barcode."); return; }
      scanned.current = false;
      setScanning(true);
    } catch { Alert.alert("Camera unavailable", "Please try again on a supported device."); }
  };
  return <View style={styles.container}>
    <Pressable onPress={() => setExpanded((value) => !value)} style={styles.header} accessibilityRole="button" accessibilityState={{ expanded }}>
      <Text style={styles.title}>Identify a part or scan a barcode</Text><Text style={styles.plus}>{expanded ? "−" : "+"}</Text>
    </Pressable>
    {expanded && <View style={styles.body}>
      <Text style={styles.text}>Choose a model and version above, then select a photo or scan a barcode.</Text>
      <Text style={styles.model}>Model: {model} · Version: {version}</Text>
      <Pressable style={styles.button} onPress={() => void choose()} accessibilityRole="button"><Text style={styles.buttonText}>{photo ? "Change part photo" : "Choose part photo"}</Text></Pressable>
      {photo ? <Image source={{ uri: photo }} style={styles.photo} accessibilityLabel="Selected part photo" /> : null}
      <Text style={styles.notice}>Photo identification is not connected yet. Photos remain on this device and are not uploaded.</Text>
      <Pressable style={styles.button} onPress={() => void openScanner()} accessibilityRole="button"><Text style={styles.buttonText}>Scan barcode with camera</Text></Pressable>
      <Text style={styles.text}>Scanned text is searched in the current catalog. UPC codes are not yet mapped to part numbers; no result does not mean a part is unavailable.</Text>
    </View>}
    <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
      <View style={styles.scanner}>
        <Text style={styles.scanText}>Point the camera at a barcode</Text>
        {scanning && <CameraView style={styles.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ["code128", "code39", "ean13", "ean8", "upc_a", "upc_e", "qr"] }} onBarcodeScanned={({ data }) => { if (scanned.current) return; scanned.current = true; setScanning(false); onBarcode(data); }} onMountError={() => { setScanning(false); Alert.alert("Camera unavailable", "Unable to open the camera."); }} />}
        <Pressable style={styles.button} onPress={() => setScanning(false)} accessibilityRole="button"><Text style={styles.buttonText}>Cancel scan</Text></Pressable>
      </View>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({container:{marginTop:8,borderWidth:1,borderColor:"#dfe3da",backgroundColor:"white",borderRadius:10},header:{minHeight:48,flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:12},title:{fontSize:14,fontWeight:"700",color:"#273129",flex:1},plus:{fontSize:22,color:"#e5432f",paddingLeft:8},body:{paddingHorizontal:12,paddingBottom:12},text:{fontSize:13,lineHeight:19,color:"#59645a",marginVertical:8},model:{fontSize:13,fontWeight:"700",color:"#273129",marginBottom:10},button:{borderWidth:1,borderColor:"#e5432f",borderRadius:8,padding:10,alignItems:"center",marginTop:8},buttonText:{color:"#e5432f",fontWeight:"700"},photo:{width:"100%",height:180,resizeMode:"contain",marginTop:10},notice:{fontSize:12,lineHeight:18,color:"#8b6c33",marginTop:10},scanner:{flex:1,backgroundColor:"#fff",padding:20,paddingTop:60},scanText:{fontSize:18,fontWeight:"700",color:"#273129",marginBottom:12},camera:{flex:1,borderRadius:12,overflow:"hidden"}});
