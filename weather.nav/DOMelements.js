/*DOM Elemente und Event Listener*/

/*----------*/

const mapContainer = document.getElementById("map"); // der Container für die Map im HTML-Dokument
const sidebar = document.getElementById('sidebar'); // Sidebar Element
const summary = document.getElementById("routeSummary"); // Element für die Routenzusammenfassung
const overlay = document.getElementById("overlay"); // Overlay-Selector (Regen, Wind, etc)
const startDateInput = document.getElementById('startDateInput'); // Input für Startzeitpunkt
const timeContainer = document.getElementById("time"); // Zeitanzeige über dem Slider
const slider = document.getElementById("myRange"); // Zeit-Slider
const carButton = document.getElementById("carButton");
const bikeButton = document.getElementById("bikeButton");
const walkButton = document.getElementById("walkButton");
const loader = document.getElementById("loaderContainer"); //die Ladeanimation
const contextmenu = document.getElementById("contextmenu"); // Kontextmenü für Wegpunkte
const detailcontainer = document.getElementById("routeDetails"); // Element für Detailübersicht der Route

// Div Elemente für die Marker anlegen, um später auf ihren Inhalt und Style zugreifen zu können
const sm = document.createElement('div'); // Start Marker
sm.className = "startMarker";
const em = document.createElement('div'); // End Marker
em.className = "endMarker";
const pm = document.createElement('div'); // Positionsmarker
pm.className = "posMarker";

/*Der Invisible Marker ist dazu da, um die Start und Endkoordinaten der Suche abzufragen
Die kriegt man nur, wenn man einen Marker setzen lässt, da wir unsere eigenen Marker haben,
wollen wir aber nicht, dass man die sieht.*/
const im = document.createElement('div');
im.className = "invisiMarker";
const im2 = document.createElement('div');
im2.className = "invisiMarker2";

//unelegant geschriebene Event-Listener für jeden Button, die im Prinzip den angeklickten Button aktiv setzen
//heißt das Routing-Profile und die Farben der Buttons ändern
carButton.addEventListener("click", () => {
    buttonResetProperty(bikeButton);
    buttonResetProperty(walkButton);
    buttonSetActive(carButton);
    profile = useCurrentTime ? "driving-traffic" : "driving";
    console.log("profile: " + profile);
    //falls schon eine Route mit anderem Profil berechnet wurde, muss sie jetzt logischerweise neu berechent werden
    getRoute(START.coords, END.coords, EXTRA, profile);
});

bikeButton.addEventListener("click", () => {
    buttonResetProperty(carButton);
    buttonResetProperty(walkButton);
    buttonSetActive(bikeButton);
    profile = "cycling";
    console.log("profile: " + profile);
    getRoute(START.coords, END.coords, EXTRA, profile);
});

walkButton.addEventListener("click", () => {
    buttonResetProperty(bikeButton);
    buttonResetProperty(carButton);
    buttonSetActive(walkButton);
    profile = "walking";
    console.log("profile: " + profile);
    getRoute(START.coords, END.coords, EXTRA, profile);
});

// Eventlistener der Änderung des Map-Overlays veranlasst wenn der Typ geändert wird
overlay.addEventListener("input", () => {

    // aktuelles Overlay entfernen falls "none"
    if (overlay.value == "none") {
        if (map.getLayer("radar-tiles") != undefined) {
            map.removeLayer("radar-tiles");
        }

        if (map.getSource('rain-raster')) {
            map.removeSource('rain-raster');
        }

    } else addWeatherLayer();
});

// aktualisiert Daten wenn das Startdatum geändert wird
startDateInput.addEventListener('input', () => {
    console.log(startDateInput.value);

    // falls zu weit in der Zukunft oder in Vergangenheit, Hinweis geben
    // Status setzen
    if (dataNotAvailable(+new Date(startDateInput.value))) {
        weatherDataAvailable = false;
        alert("Please note that there is no forecast data available for dates in the past or beyond 7 days in the future");
    } else weatherDataAvailable = true;

    if (beyond2hours(+new Date(startDateInput.value))) {
        mapDataAvailable = false;
        alert("Please note that there are no weather maps available for dates beyond 2 hours in the future");
    } else mapDataAvailable = true;

    // globale Timestamps updaten
    TIMESTAMP = +new Date(startDateInput.value);
    ISOtimestamp = new Date(startDateInput.value).toISOString().split(".")[0];
    localeISOtimestamp = startDateInput.value;
    timeContainer.innerHTML = new Date(TIMESTAMP).toLocaleString().slice(0, -3);

    START.time = TIMESTAMP;

    // kein useCurrentTime mehr bei einer Minute Unterschied zur aktuellen Zeit
    if (TIMESTAMP - (+new Date()) >= 60000) {
        useCurrentTime = false;
    } else useCurrentTime = true;

    // Wenn schon Startpunkt existiert dann Wetter und ggf Route mit neuer Zeit updaten
    if (START.coords != undefined) {
        OM_getForecastWeather(START.coords.lng, START.coords.lat, new Date(START.time), true, START.marker, true);
        getRoute(START.coords, END.coords, EXTRA, profile);
    }
});

// Event Listener, die globale over-Variablen auf true oder false setzen,
// je nach ob sich die maus über dem entsprechenden marker (nicht mehr) befindet
sm.addEventListener('mouseover', () => {
    overStart = true;
});

sm.addEventListener('mouseleave', () => {
    overStart = false;
});

em.addEventListener('mouseover', () => {
    overEnd = true;
});

em.addEventListener('mouseleave', () => {
    overEnd = false;
});

pm.addEventListener('mouseover', () => {
    overPos = true;
});

pm.addEventListener('mouseleave', () => {
    overPos = false;
});

// Event Listener zum Öffnen des Kontextmenüs bei Rechtsklick
// Rechtsklick ist Mausbutton 2
sm.addEventListener("mousedown", (e) => {
    if (e.button == 2) {

        openContextMenu(sm, e);
        contextmenu.innerHTML = `<div onclick="removeStart(); geoCoder.clear()" class="remove"><p><i class="bi bi-x-lg"></i> remove start point</p></div><div class="close" onclick="contextmenu.style.display = 'none'"><p><i class="bi bi-dash-lg"></i></i> close</p></div>`;

    }
});

em.addEventListener("mousedown", (e) => {
    if (e.button == 2) {

        openContextMenu(em, e);
        contextmenu.innerHTML = `<div onclick="removeEnd(); geoCoder2.clear()" class="remove"><p><i class="bi bi-x-lg"></i> remove end point</p></div><div class="close" onclick="contextmenu.style.display = 'none'"><p><i class="bi bi-dash-lg"></i></i> close</p></div>`;

    }
});


//Event-Listener, der immer auslöst, wenn der Wert geändert wird (ist ein input type, deswegen, ist das Event "input")
slider.addEventListener("input", () => {

    movePosMarker();

});


/**
 * Button Style ändern wenn Button nicht mehr aktiv
 * 
 * @param button HTML-Element
 */
function buttonResetProperty(button) {
    button.style.setProperty("background-color", "white");
    button.style.setProperty("color", "gray");
    button.style.setProperty("border", "2px solid #ccc");
}

/**
 * Style ändern wenn Button aktiv (Hintergrund und so)
 * 
 * @param button HTML-Element
 */
function buttonSetActive(button) {
    button.style.setProperty("background-color", "blue");
    button.style.setProperty("color", "white");
    button.style.setProperty("border", "none");
}

/**
 * Öffnet das Kontextmenü für einen Marker bzw zeigt es an
 * 
 * @param markerElement Marker HTML-Element
 * @param e Event (vom Event-Listener)
 */
function openContextMenu(markerElement, e) {

    //Mausposition holen
    const rect = markerElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    markerElement.appendChild(contextmenu); // Contextmenu als Child-Element an das Marker-Element anheften

    // Position des Menüs setzen 10px Offset von Mausposition
    contextmenu.style.top = `${y + 10}px`;
    contextmenu.style.left = `${x + 10}px`;

    contextmenu.style.display = "block"; //sichtbar schalten

    // Funktion, die das Menü wieder entfernt wenn außerhalb geklickt wird
    // muss vor dem dazugehörigen Event-Listener definiert werden
    let documentClickHandler = function (e) {
        let isClickedOutside = !contextmenu.contains(e.target);
        if (isClickedOutside) {
            contextmenu.style.display = 'none';
            markerElement.removeChild(contextmenu);

            document.removeEventListener("click", documentClickHandler); // Event Listener entfernen
        }
    }

    // Event Listener der Bei Click irgendwo auf der Seite documentClickHandler aufruft
    // im Endeffekt wird das Menü dadurch wieder geschlossen
    document.addEventListener("click", documentClickHandler);

}