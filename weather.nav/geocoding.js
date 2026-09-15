/*Utilities für Geocoding bzw Reverse Geocoding*/

/*----------*/

// Geocoder für Start-Eingabe
const geoCoder = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    marker: {
        element: im,
    },
    placeholder: "Start"
});

//an das Div Element anhängen
document.getElementById('geocoderStart').appendChild(geoCoder.onAdd(map));


// Geocoder für End-Eingabe
const geoCoder2 = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    marker: {
        element: im,
    },
    placeholder: "Destination"
});

document.getElementById('geocoderEnd').appendChild(geoCoder2.onAdd(map));

// Geocoder für Extra-Waypoint Eingabe
const geoCoder3 = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    marker: {
        element: im,
    },
    placeholder: "Add a waypoint",
    collapsed: true
});

document.getElementById('geocoderExtra').appendChild(geoCoder3.onAdd(map));

// Button, mit dem der Nutzer die Karte auf seine aktuelle Position zentrieren kann
const geoLocate = new mapboxgl.GeolocateControl({
    positionOptions: {
        enableHighAccuracy: true
    },
    trackUserLocation: true,
    showUserLocation: true
});

map.addControl(geoLocate); // zur Map hinzufügen

map.addControl(new mapboxgl.NavigationControl()); //Zoom Kontrollbuttons anfügen

/*sobald der Geocoder ein Erlebnis liefert, werden die Koordinaten des gesetzen Markers
ausgelesen und der start bzw endmarker dan diese stelle gesetzt
*/
geoCoder.on("result", () => {

    setStart(geoCoder.mapMarker._lngLat);
    geoCoder._showClearButton();
});

// Eingabe löschen -> Route löschen
geoCoder.on("clear", () => {
    removeStart();
});

geoCoder2.on("result", () => {

    setEnd(geoCoder2.mapMarker._lngLat);
    geoCoder2._showClearButton();
});

geoCoder2.on("clear", () => {
    removeEnd();
});

geoCoder3.on("result", () => {
    setExtra(geoCoder3.mapMarker._lngLat);
    geoCoder3.clear();
    geoCoder3._collapse();
});


/**
 * Funktion die mithilfe der Nominatim-API einen Location-Namen aus Koordinaten reverse-geocodet
 * und als String zurückgibt
 * 
 * @param lat latidude (Breitengrad)
 * @param lon longitude (Längengrad)
 * @returns String mit der Location
 */
async function reverseGeoCode(lat, lon) {

    //return;

    let res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
    
    if (!res.ok) {
        return "";
    } 

    let obj = await res.json();


    console.log(obj);

    let address = obj.address;

    let string = "";

    // die Struktur ist leider nicht immer gleich und hängt vom Ort ab, deswegen hier bisschen if-else
    // Ziel ist es, immer Stadt/Dorf/Ort und sowas wie Stadteil oder sowas zu haben, mehr ist eigentlich nicht wichtig
    if (address.city != undefined) string += address.city + " ";
    else if (address.town != undefined) string += address.town + " ";
    else if (address.village != undefined) string += address.village + " ";
    else if (address.municipality != undefined) string += address.municipality + " ";

    if (address.neighbourhood != undefined) string += address.neighbourhood;
    else if (address.suburb != undefined) string += address.suburb;

    // falls gar nix weiter vorhanden, Postleitzahl zurückgeben
    if (string == "" && address.postcode != undefined) string += address.postcode;

    return string;
}