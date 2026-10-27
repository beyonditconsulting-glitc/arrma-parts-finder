import maintenance from "./data/maintenance.js";
export const maintenanceSource = maintenance;
export const maintenanceCategories = [
  "All videos",
  ...new Set(maintenance.videos.map((video) => video.category)),
];
export type MaintenanceVideo = (typeof maintenance.videos)[number];
export function searchMaintenance(query: string, category = "All videos") {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return maintenance.videos.filter(
    (video) =>
      (category === "All videos" || category === video.category) &&
      terms.every((term) =>
        `${video.title} ${video.sourceTitles.join(" ")} ${video.description} ${video.requiredItems.join(" ")}`
          .toLowerCase()
          .includes(term),
      ),
  );
}
export const MAINTENANCE_PLAYER_ORIGIN =
  "https://com.beyonditconsulting.pitfinder";
export function maintenancePlayerHtml(videoId: string) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId))
    throw Error("Invalid source video ID");
  // Identify the native app via its actual bundle ID as the WebView base origin.
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin"><style>html,body,#player{margin:0;width:100%;height:100%;background:#000;overflow:hidden}</style></head><body><div id="player"></div><script>function report(value){window.ReactNativeWebView.postMessage(JSON.stringify(value))}function onYouTubeIframeAPIReady(){new YT.Player('player',{host:'https://www.youtube-nocookie.com',videoId:'${videoId}',playerVars:{playsinline:1,rel:0,origin:'${MAINTENANCE_PLAYER_ORIGIN}'},events:{onReady:function(){report({type:'ready'})},onError:function(event){report({type:'error',code:event.data})}}})}</script><script src="https://www.youtube.com/iframe_api"></script></body></html>`;
}
export function isMaintenancePlayerNavigationAllowed(url: string) {
  if (url === "about:blank") return true;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      [
        "com.beyonditconsulting.pitfinder",
        "www.youtube.com",
        "www.youtube-nocookie.com",
      ].includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}
