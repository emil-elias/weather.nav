/*Alles was mit der Map zu tun hat*/

/*----------*/

// Map initialisieren
const map = new mapboxgl.Map({
    container: 'map', //die ID vom HTML-Element, in diesem Fall div #map (in der index.html)
    style: 'mapbox://styles/mapbox/streets-v11', //karten stil
    center: [8.5962034, 53.1199492], //startposition, hier über Funktionsparameter center übergeben
    zoom: 10, //Start-Zoom

});

// Bilder für Start und Endmarker in die Map laden, um sie dann benutzen zu können
map.loadImage("images/dest2.png", (error, image) => {
    if (error) throw error; // fehler werden, falls das Laden des Bildes nicht funktioniert
    map.addImage("dest", image);
});

map.loadImage("images/start.png", (error, image) => {
    if (error) throw error;
    map.addImage("start", image);
});

// Event: Ende eines Zooms
map.on("zoomend", () => {
    //console.log(map.getZoom()); //aktuelle Zoomstufe ausgeben (nur zum Debuggen)

    // Routenmarker ausblenden wenn zu weit rausgezoomt
    if (map.getZoom() < 10 && showRouteMarkers) {
        for (let i = 0; i < WeatherMarkers.length; i++) {
            let marker = WeatherMarkers[i];
            let popup = marker.getPopup();

            if (popup != null && popup.isOpen()) marker.togglePopup();

            showRouteMarkers = false;
        }
    } else if (map.getZoom() >= 10 && !showRouteMarkers && showMarkers) { // zeigen wenn nah genug dran
        for (let i = 0; i < WeatherMarkers.length; i++) {
            let marker = WeatherMarkers[i];
            let popup = marker.getPopup();

            if (popup != null && !popup.isOpen() && currentPosMarkerIndex != i) marker.togglePopup();

            showRouteMarkers = true;
        }

    }



});

//Event, das ausgelöst wird, wenn die Karte geladen wurde
map.on('load', async function () {

    addWeatherLayer(); //Wetterkarte hinzufügen

    //map.showTileBoundaries = true; //Rastergrenzen der Tiles anzeigen (nur zum Debuggen)
});

// Marker bei Klick auf die Karte hinzufügen, je nachdem welcher state gerade aktiv ist
map.on("click", async (e) => {

    // nur wenn sich die Maus nicht gerade über einem anderen Marker befindet oder ein Kontextmenü offen ist
    if (!overStart && !overEnd && !xmState.overXm && !overPos && contextmenu.style.display != "block") {

        if (current == "start") {
            await setStart(e.lngLat);
            geoCoder._inputEl.value = START.location;
            geoCoder._showClearButton();
        } else if (current == "end") {
            await setEnd(e.lngLat);
            geoCoder2._inputEl.value = END.location;
            geoCoder2._showClearButton();
        } else if (extraIndex <= 24) { // Mapbox Directions nimmt maximal 25 Wegpunkte
            setExtra(e.lngLat);
        }
    }

    if (contextmenu.style.display == "block") {
        contextmenu.style.display == "none";
    }


});


/**
 * Funktion fügt Wetter-Karten Overlay hinzu, Daten kommen in Form von Raster-Tiles von einer API 
 * Regen: Azure Maps oder Rainviewer
 * Windrichtung, Temperatur, Schnee: OpenWeatherMap
 */
async function addWeatherLayer() {

    if (!showWeatherLayer || overlay.value == "none" || overlay.value == "ice") return;

    let string = "";

    if (overlay.value == "rain") {

        if (!AZURE) {

            //Um eine Teile bei Rainviewer zu requesten muss man sich den String selber zusammenbauen
            let rainviewer = await fetch("https://api.rainviewer.com/public/weather-maps.json");
            rainviewer = await rainviewer.json();

            string = rainviewer.host; //hostname

            string += rainviewer.radar.nowcast[0].path; //aktuelleste karte

            string += `/256/{z}/{x}/{y}/1/0_1.png`;

            console.log(string);

        } else {
            string = `https://atlas.microsoft.com/map/tile?api-version=2022-08-01&tilesetId=microsoft.weather.radar.main&zoom={z}&x={x}&y={y}&timeStamp=${ISOtimestamp}&subscription-key=${AZURE_SUBSCRIPTION_KEY}`;

        }

    } else if (overlay.value == "wind") {
        string = `http://maps.openweathermap.org/maps/2.0/weather/WND/{z}/{x}/{y}?appid=${OPEN_WEATHER_MAP_APP_ID}`;
    } else if (overlay.value == "snow") {
        string = `http://maps.openweathermap.org/maps/2.0/weather/SD0/{z}/{x}/{y}?appid=${OPEN_WEATHER_MAP_APP_ID}`;
    } else if (overlay.value == "temp") {
        string = `http://maps.openweathermap.org/maps/2.0/weather/TA2/{z}/{x}/{y}?appid=${OPEN_WEATHER_MAP_APP_ID}`;
    }

    // Falls schon ein Layer bzw. eine Source existiert muss sie nochmal entfernt werden bevor sie wieder hinzugefügt werden kann
    if (map.getLayer("radar-tiles") != undefined) {
        map.removeLayer("radar-tiles");
    }

    if (map.getSource('rain-raster')) {
        map.removeSource('rain-raster');
    }


    //Source hinzufügen
    map.addSource('rain-raster', {
        "type": 'raster',
        "tiles": [string], //Mapbox holt sich die passenden Tiles automatisch und passt die Tilegröße automatisch an, solange zoom, x und y position in der Form: {z}, {x}, {y} im Link-String stehen
        "tileSize": 256,
        //"bounds": [ 8.49, 53.23, 8.98, 53 ] //auf bestimmten Bereich beschränken, nützlich um API-Requests einzugrenzen
    });
    // Layer mit Tiles als Source hinzufügen
    map.addLayer({
        "id": "radar-tiles",
        "type": "raster",
        "source": "rain-raster",
        "minzoom": 0,
        "maxzoom": 15,
        "paint": {
            "raster-opacity": overlay.value == "temp" ? 1 : 0.5 //Deckkraft runter damit man überhaupt was sieht
        }
    });


}