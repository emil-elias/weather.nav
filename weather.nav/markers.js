/*Map Marker und Popups*/

/*----------*/

// Eventlistener, die Route neu berechnen, wenn Start oder End Marker verschoben werden und die Koordinaten updaten
START.marker.on("dragend", async () => {
    START.coords = START.marker.getLngLat();
    START.location = await reverseGeoCode(START.coords.lat, START.coords.lng);
    geoCoder._inputEl.value = START.location;
    START.weather = await OM_getForecastWeather(START.coords.lng, START.coords.lat, new Date(START.time), true, START.marker, true);
    getRoute(START.coords, END.coords, EXTRA, profile);
});

END.marker.on("dragend", async () => {
    END.coords = END.marker.getLngLat();
    END.location = await reverseGeoCode(END.coords.lat, END.coords.lng);
    geoCoder2._inputEl.value = END.location;
    if (START.coords == undefined) END.weather = await OM_getForecastWeather(END.coords.lng, END.coords.lat, new Date(START.time), true, END.marker, true);

    getRoute(START.coords, END.coords, EXTRA, profile);
})

/**
 * Setzt Startpunkt und Marker auf Koordinaten und fragt Daten dort ab
 * 
 * @param coords ein Objekt {lng, lat}
 */
async function setStart(coords) {

    START.coords = coords;
    START.location = await reverseGeoCode(START.coords.lat, START.coords.lng);
    START.marker.setLngLat([START.coords.lng, START.coords.lat]).addTo(map);

    // Zeit ggf anpassen
    if (useCurrentTime && !POS.markerActive) {
        TIMESTAMP = +new Date();
        START.time = TIMESTAMP;
        startDateInput.value = toLocaleIsoString(new Date());
        timeContainer.innerText = new Date().toLocaleString().slice(0, -3);

    }

    if (END.coords == undefined) current = "end"; // falls es end noch nicht gibt, als nächstes end setzen
    else current = "extra"; // ansonsten extra marker

    START.weather = await OM_getForecastWeather(START.coords.lng, START.coords.lat, new Date(START.time), true, START.marker, true); // Wetter für Startpunkt in den START.marker schreiben

    getRoute(START.coords, END.coords, EXTRA, profile); //route berechnen
}

/**
 * Entfernt den Startpunkt samt Marker und setzt seine Werte zurück
 */
function removeStart() {
    START.marker.remove();
    START.coords = undefined;
    START.location = undefined;
    START.weather = undefined;
    overStart = false;

    current = "start";

    deleteRoutes(); //ohne Startpunkt keine Route

}

/**
 * Setzt Endpunkt auf Koordinaten
 * @param coords ein Objekt {lng, lat}
 */
async function setEnd(coords) {

    END.coords = coords;
    END.location = await reverseGeoCode(END.coords.lat, END.coords.lng)
    END.marker.setLngLat([END.coords.lng, END.coords.lat]).addTo(map);

    current = "extra";

    //END.weather = await OM_getForecastWeather(END.coords.lng, END.coords.lat, new Date(TIMESTAMP), true, END.marker, true); // vorrausgesagtes Wetter für den Ankunftszeitpunkt am endpunkt in den END.marker schreiben

    getRoute(START.coords, END.coords, EXTRA, profile);
}

/**
 * Entfernt Endpunkt
 */
function removeEnd() {
    END.marker.remove();
    END.coords = undefined;
    END.location = undefined;
    END.weather = undefined;
    overEnd = false;

    if (START.coords == undefined) current = "start";
    else current = "end";

    deleteRoutes();
}

/**
 * Setzt Extra Wegpunkt
 * @param coords ein Objekt {lng, lat} 
 */
async function setExtra(coords) {
    let extraCoords = coords;

    extraIndex++; //neuer extra punkt => index hochzählen
    // der aktuelle index ist der index für den neuen extra punkt (deswegen ist der extraIndex initial auch -1)

    // HTML-Element für extra Marker erstellen
    const xm = document.createElement('div');
    xm.className = "extraMarker";

    xm.addEventListener('contextmenu', (e) => {
        e.preventDefault(); //verhindert Default Kontextmenü Event
    });

    /*um später auf das Element und den entsprechenden Marker zugreifen zu können,
    speichern wir den Index in einem HTML Attribut, das wir später ggf wieder abrufen können
    */
    xm.setAttribute("index", extraIndex);
    /* Event Listener hhinzufügen, die overXm im xmState Objekt auf true oder false setzen,
    wenn die Maus über dem entsprechenden Punkt bzw. HTML-Element ist und den entsprechenden Index
    ins Objekt schreiben
    */
    xm.addEventListener("mouseover", () => {
        xmState.overXm = true;
        xmState.index = xm.getAttribute("index"); //index holen
    });
    xm.addEventListener("mouseleave", () => {
        xmState.overXm = false;
        xmState.index = -1; // index zurücksetzen
    });

    xm.addEventListener("mousedown", (e) => {
        if (e.button == 2) {

            console.log("hello");

            let index = xm.getAttribute("index");

            openContextMenu(xm, e);
            contextmenu.innerHTML = `<div onclick="removeExtra(${index})" class="remove"><p><i class="bi bi-x-lg"></i> remove waypoint</p></div><div class="close" onclick="contextmenu.style.display = 'none'"><p><i class="bi bi-dash-lg"></i></i> close</p></div>`;

        }
    }
    );

  

    // neuen Marker erstellen, welcher das xm Element als Basis verwendet, und zur Karte hinzufügen
    let extraMarker = new mapboxgl.Marker({
        element: xm,
        draggable: true
    });

    extraMarker.setLngLat([extraCoords.lng, extraCoords.lat]).addTo(map);

    // Event Listener für Extra Marker, der Route neu berechnet, wenn der Marker verschoben wird
    extraMarker.on("dragend", () => {
        getRoute(START.coords, END.coords, EXTRA, profile);
    });

    // neuen Extrapunkt ins Array pushen
    EXTRA.push({
        index: extraIndex,
        marker: extraMarker,
        coords: { lng: extraCoords.lng, lat: extraCoords.lat },
        location: await reverseGeoCode(extraCoords.lat, extraCoords.lng),
        xm: xm,


    })

    // Route updaten
    getRoute(START.coords, END.coords, EXTRA, profile);


}

/**
 * Entfernt Extrapunkt an bestimmtem Index
 * 
 * @param index in der EXTRA-Liste
 */
function removeExtra(index) {
    // Marker an entsprechendem Index von der Map entfernen
    EXTRA[index].marker.remove();

    // Array an index Splicen, 1 Element entfernen (das am Index)
    EXTRA.splice(index, 1); n

    extraIndex--;
    xmState.overXm = false;

    // Route neu berechnen, da Wegpunkt nicht mehr vorhanden
    getRoute(START.coords, END.coords, EXTRA, profile);
}

/**
 * Bewegt den Posmarker an die Stelle an der der Slider gerade steht
 */
function movePosMarker() {
    if (useCurrentTime) {
        TIMESTAMP = +new Date(); // aktuelle Zeit in Millisekunden holen

        START.time = TIMESTAMP;
    } else {
        TIMESTAMP = START.time;
    }


    TIMESTAMP += slider.value * 5 * 60000; // aktuellen Sliderwert aktuelle Zeit draufaddieren. Der Slider geht in 5 Minuten schritten, eine Minute hat 60000 ms
    ISOtimestamp = new Date(TIMESTAMP).toISOString().split(".")[0]; //Timestamp updaten für die Wetterkarte
    timeContainer.innerHTML = new Date(TIMESTAMP).toLocaleString().slice(0, -3); //auch im HTML updaten

    // addWeatherLayer() aufrufen um dynamische Karte zu updaten
    if (!beyond2hours(TIMESTAMP)) {
        addWeatherLayer();
    }

    // nur wenn es eine Route gibt
    if (routes != undefined) {

        END.time = START.time + routes.routes[activeRoute].duration * 1000;

        updatePosMarker(TIMESTAMP); //Ort ermitteln, an dem PosMarker zum Zeitpunkt stehen soll

        updatePopups();
    }


    for (let i = 0; i < conditionStart.length; i++) {
        if (+new Date(conditionStart[i].time) > TIMESTAMP) {
            currentPosMarkerIndex = i - 1;
            break;
        }

    }

}

/**
 * Setzt PosMarker an einen Ort, an dem er zu gegebenen Zeitpunkt auf einer Route sein sollte
 * 
 * @param time in Millisekunden
 */
function updatePosMarker(time) {
    POS.coords = findTimeLocation(time); //location ermitteln
    POS.time = time;

    // marker einblenden wenn er zuvor noch nicht aktiv war
    if (slider.value != 0 && !POS.markerActive) {
        POS.marker.addTo(map);
        POS.markerActive = true;
    }

    POS.marker.setLngLat(POS.coords);
    POS.marker.setRotation(POS.bearing);
    OM_getForecastWeather(POS.coords[0], POS.coords[1], new Date(time), true, POS.marker, true);

    timeContainer.innerText = new Date(time).toLocaleString().slice(0, -3);

    // ausblenden wenn wieder am Startpunkt
    if (slider.value == 0 && POS.markerActive) {
        POS.marker.remove();
        POS.markerActive = false;
        currentPosMarkerIndex = -1;
    }
}

/**
 * Setzt Posmarker an einen Ort in der Condition-Liste
 * 
 * @param wmIndex Index in die conditionStart Liste
 */
function setPosMarker(wmIndex) {

    currentPosMarkerIndex = wmIndex;

    POS.coords = conditionStart[wmIndex].coordinates;
    POS.marker.setLngLat(POS.coords);
    POS.marker.addTo(map);

    if (!POS.markerActive) POS.markerActive = true;

    let time = conditionStart[wmIndex].time;

    TIMESTAMP = +new Date(time); // aktuellen Sliderwert aktuelle Zeit draufaddieren. Der Slider geht in 5 Minuten schritten, eine Minute hat 60000 ms
    ISOtimestamp = new Date(TIMESTAMP).toISOString().split(".")[0]; //Timestamp updaten für die Wetterkarte

    if (!beyond2hours(TIMESTAMP)) {
        addWeatherLayer();
    }

    OM_getForecastWeather(POS.coords[0], POS.coords[1], time, true, POS.marker, true);

    // Popup am Weathermarker ausschalten falls es eingeblendet ist
    let popup = WeatherMarkers[wmIndex].getPopup();
    if (popup != null && popup.isOpen()) WeatherMarkers[wmIndex].togglePopup();

    // slider value anpassen
    slider.value = Math.floor(((+new Date(time)) - START.time) / 300000);
    timeContainer.innerText = time.toLocaleString().slice(0, -3);

    // an die Stelle zoomen
    map.flyTo({
        center: POS.coords,
        zoom: 12
    });
}

/**
 * Setzt PosMarker auf Spezifische Koordinaten
 * 
 * @param lng 
 * @param lat 
 */
function setPosMarkerToCoords(lng, lat) {

    POS.coords = [lng, lat];
    POS.marker.setLngLat(POS.coords);
    POS.marker.addTo(map);

    let time = findLocationTime(lng, lat); // Zeit zu standpunkt ermitteln

    OM_getForecastWeather(POS.coords[0], POS.coords[1], new Date(time), true, POS.marker, true);
    WeatherMarkers[wmIndex].togglePopup();
    slider.value = Math.floor(time / 300000);
    timeContainer.innerText = new Date(time).toLocaleString().slice(0, -3);

}

/**
 * blendet sämtliche Marker Popups ein oder aus
 */
function toggleAllPopups() {

    let checked = popupToggleCheckbox.checked; // wert der Checkbox (true/false)

    showMarkers == checked; // globalen Status setzen

    let condition = checked ? false : true;

    let smPopup = START.marker.getPopup();
    let emPopup = END.marker.getPopup();
    let pmPopup = POS.marker.getPopup();


    if (smPopup != null && smPopup.isOpen() == condition) START.marker.togglePopup();
    if (emPopup != null && emPopup.isOpen() == condition) END.marker.togglePopup();
    if (pmPopup != null && pmPopup.isOpen() == condition) POS.marker.togglePopup();

    for (let x = 0; x < EXTRA.length; x++) {
        let xPopup = EXTRA[x].marker.getPopup();
        if (xPopup != null && xPopup.isOpen() == condition) EXTRA[x].marker.togglePopup();
    }

    for (let w = 0; w < WeatherMarkers.length; w++) {
        let wmPopup = WeatherMarkers[w].getPopup();
        if (wmPopup != null && wmPopup.isOpen() == condition && map.getZoom() >= 10) WeatherMarkers[w].togglePopup();
    }




}

/**
 * updated/setzt Inhalte aller Popups
 */
function updatePopups() {

    if (!weatherDataAvailable) return;

    let startDate = new Date(START.time);
    let endDate = new Date(END.time);

    let startHour = getHour(startDate, 0);

    let dayOffset = getDayOffset(startDate, endDate);
    
    let endHour = getHour(endDate, dayOffset);

    if (START.coords != undefined) {

        START.marker.getPopup().setHTML(`
        <div onclick="map.flyTo({
            center: [${START.coords.lng},${START.coords.lat}],
            zoom: 15
        })">`
        +weatherIntoPopup(START, startDate, startHour, startDate)
        +`</div>`
        );
    }

    if (END.coords != undefined) {

        END.marker.getPopup().setHTML(`
        <div onclick="map.flyTo({
            center: [${END.coords.lng},${END.coords.lat}],
            zoom: 15
        })">`
        +weatherIntoPopup(END, endDate, endHour, startDate)
        +`</div>`
        );
    }

    for (let i = 0; i < EXTRA.length; i++) {

        let duration = 0;

        for (let j = 0; j <= i; j++) {
            duration += routes.routes[activeRoute].legs[j].duration * 1000
        }

        let date = new Date(START.time + duration);
        EXTRA[i].time = date;

        let offset = getDayOffset(startDate, date)

        let dateHour = getHours(date, offset);

        EXTRA[i].marker.getPopup().setHTML(`
        <div onclick="map.flyTo({
            center: [${EXTRA[i].coords.lng},${EXTRA[i].coords.lat}],
            zoom: 15
        })">`
        +weatherIntoPopup(EXTRA[i], date, dateHour, startDate)
        +`</div>`

        );
    }

}