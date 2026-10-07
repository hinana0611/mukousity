// マップとピン。Leaflet(index.html で読み込み済み)を使う
// ※座標はおおよその位置です。地図で確認して調整してください。
export const pins = [
  { id: "nagaokakyu", name: "長岡宮跡", lat: 34.9443139, lng: 135.703389, chapter: "nagaoka",
    info: "長岡京の中心だった宮殿の跡。大極殿の跡地が公園になっている。" },
  { id: "takenomichi", name: "竹の径", lat: 34.956667, lng: 135.696111, chapter: null,
    info: "竹林が続く散策路。かぐやの物語ともつながる場所。" },
  { id: "shiryokan", name: "資料館", lat: 34.9490, lng: 135.6995, chapter: "shiryokan",
    info: "向日市の歴史や出土品を紹介する資料館。" },
  { id: "mukojinja", name: "向日神社", lat: 34.944151, lng: 135.697113, chapter: null,
    info: "古くから町を見守ってきた神社。" }
];

const CENTER = [34.9490, 135.6980]; // 向日市役所のあたり
let map = null;
let markers = [];

// onPin(pin) … ピンが押されたときに呼ばれる
// getStatus(pin) … "open" | "locked" | "next" を返す
export function showMap(onPin, getStatus) {
  if (!map) {
    map = L.map("mapView", { zoomControl: false }).setView(CENTER, 15);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors"
    }).addTo(map);
  }
  markers.forEach(m => m.remove());
  markers = pins.map(pin => {
    const status = getStatus(pin);
    const icon = L.divIcon({
      className: "",
      html: `<div class="pin ${status === "locked" ? "locked" : ""} ${status === "next" ? "next" : ""}"></div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 34]
    });
    const marker = L.marker([pin.lat, pin.lng], { icon, title: pin.name }).addTo(map);
    marker.on("click", () => onPin(pin));
    return marker;
  });
  setTimeout(() => map.invalidateSize(), 50); // 表示直後のサイズ崩れ対策
}
