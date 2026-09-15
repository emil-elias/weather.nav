/*Utilities zum Routing*/

/*----------*/

//Hilfsmethode, die Querys in einem Array findet und den Index zurückgibt
//wird deswegen im Array Prototype definiert, damit wir mit jedem Array drauf zugreifen können bzw jedes Array diese Methode hat
//Funktioniert im Prinzip so, dass der Query und sämtliche Inhalte des Arrays stringifiziert und dann verglichen werden
Array.prototype.indexOfForArrays = function (search) {
    var searchJson = JSON.stringify(search);
    var arrJson = this.map(JSON.stringify);

    return arrJson.indexOf(searchJson);
};

/**
 * Funktion, die mithilfe der Mapbox Directions API eine Route zwischen
 * start und end punkt über wegpunkte berechnet, für das entsprechende profil.
 * In der Regel übergeben wir START.coords, END.coords und die extraMarker-Liste
 * 
 * @param start {lng, lat}
 * @param end {lng, lat}
 * @param waypoints Liste
 * @param profile String
 */
async function getRoute(start, end, waypoints, profile) {

    // Falls start oder end noch nicht festgelegt sind, abbrechen
    if (start == undefined || end == undefined) return;

    //Dinge anschalten wenn Viewport groß genug
    if (screen.width >= 640) {

        //sidebar.style.display = "block";
        logosection.style.display = "flex";
        //mapContainer.style.width = "calc(100vw - 265px)";
    }

    deleteSubroutes();

    //Directions API Call
    // weil wir auf die Response warten müssen, brauchen wir das await keyword um die Code-Ausführung anzuhalten bis die Response da ist
    // ansonsten würde einfach der nächste Code ausgeführt werden, obwohl das benötigte Objekt gar nicht da ist
    // await lässt sich nur in asynchronen Funktionen verwenden (deswegen das async keyword vor der Funktion)
    const query = await fetch(`https://api.mapbox.com/directions/v5/mapbox/${profile}/${start.lng},${start.lat};${waypointString(waypoints)}${end.lng},${end.lat}?steps=true&geometries=geojson&overview=full&annotations=duration&alternatives=true&access_token=${mapboxgl.accessToken}`, { method: 'GET' });

    // Abbruch wenn Response fehlerhaft
    if (!query.ok) {
        alert("Route couldn't be determined");
        return;
    }

    // API Response in JSON-Objekt umwandeln auf Inhalte zugreifen zu können
    const json = await query.json();
    console.log(json); //man muss sich im Prinzip jedes JSON Objekt erst einmal angucken um herauszufinden was wo steht

    routes = json;
    activeRoute = 0;

    // dann kann man wie gehabt auf Attribute mit . zugreifen
    const data = json.routes[activeRoute];
    const route = data.geometry.coordinates;

    // Hier wird jetzt die Route als Geojson feature erstellt, dass dann zur Karte hinzugefügt wird
    // im Prinzip vom Mapbox Tutorial kopiert
    const geojson = {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: route
        }
    };
    // if the route already exists on the map, we'll reset it using setData
    if (map.getSource('route')) {
        map.getSource('route').setData(geojson);
    }
    // otherwise, we'll make a new request
    else {
        map.addLayer({
            id: 'route',
            type: 'line',
            source: {
                type: 'geojson',
                data: geojson
            },
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: { // hier kann man die eigenschaften der linie, wie farbe und co verändern
                'line-color': '#000000',
                'line-width': 5,
                'line-opacity': 1
            }
        });
    }

    // Bounds der Route um sie in den Viewport einzupassen
    const bounds = new mapboxgl.LngLatBounds(
        route[0],
        route[0]
    );

    // Extend the 'LngLatBounds' to include every coordinate in the bounds result.
    for (const coord of route) {
        bounds.extend(coord);
    }

    // Kamera so einpassen, dass sie die ganze Route einfängt
    map.fitBounds(bounds, {
        padding: 300
    });

    // Zeiten für die nachfolgenden Wetter API-Calls ausrechnen
    START.time = useCurrentTime ? +new Date() : TIMESTAMP; // aktuelle zeit in Millisekunden 
    startDateInput.value = toLocaleIsoString(new Date(START.time));
    if (!POS.markerActive) {
        timeContainer.innerHTML = new Date(START.time).toLocaleString().slice(0, -3);
        slider.value = 0;
    }
    console.log(START.time);
    let currentDate = new Date(START.time); // Datum aus ms-Zeit

    END.time = START.time + data.duration * 1000; // Ankunftszeit in ms
    console.log(END.time);
    let arrivalDate = new Date(END.time);

    slider.max = Math.ceil(data.duration / 300); // Max Value des Sliders auf die Routendauer setzen (geteilt durch 5 Minuten)

    updatePosMarker(TIMESTAMP);


    START.weather = await OM_getForecastWeather(start.lng, start.lat, currentDate, true, START.marker, true); // Wetter für Startpunkt in den START.marker schreiben
    END.weather = await OM_getForecastWeather(end.lng, end.lat, arrivalDate, true, END.marker, true); // vorrausgesagtes Wetter für den Ankunftszeitpunkt am endpunkt in den END.marker schreiben


    if (detailcontainer.style.display != "flex") showFirstSummary(); // erste Zusammenfasszung zeigen damit es ein bisschen responsiver wirkt
    //loader.style.setProperty("display", "flex"); // Loader sichtbar schalten, wird erst am Ende wieder entfernt, damit er solange den Ladezustand anzeigt

    // Wetter auf der Route berechnen

    let extraPointsExist = data.legs.length > 1; // boolean der anzeigt, ob es es mindestens einen wegpunkt zwischen start und ziel gibt (dann gibt es mehr als 1 leg, weil wegpunkte die Route in mehrere Etappen aufteilen)

    let legsDuration = 0;

    let indexStart; //Start eines Abschnitts in der Gesamtroute
    let indexEnd; //Ende eines Abschnitts in der Gesamtroute
    let subrouteWC = 0; //Wettercode für eine Teilroute/Abschnitt
    let subroute = []; //Teilroute für Wetterkondition
    let subRouteIndex = 0; //index zur Benennung und Verwaltung der einzelnen Teilrouten

    let currentWC = -1; //aktuellen Wettercode zwischenspeichern, am Anfang noch keiner

    let stepsDuration = 0; // Dauer für jeden Step zwischenspeichern



    for (let l = 0; l < data.legs.length; l++) { // alle etappen in der Route (es gibt mindestens eine, nämlich die ganze Route)

        // wenn es extra punkte gibt und wir uns nicht im letzen leg befinden (denn sonst würden wir den endpunkt nochmal betrachten) dann Wetter am Wegpunkt berechnen
        if (extraPointsExist && l < data.legs.length - 1) {

            //letzten Step und dessen Koordinaten in der Etappe finden
            let lastStepIndex = data.legs[l].steps.length - 1;
            let lastCoordIndex = data.legs[l].steps[lastStepIndex].geometry.coordinates.length - 1;

            let lng = data.legs[l].steps[lastStepIndex].geometry.coordinates[lastCoordIndex][0];
            let lat = data.legs[l].steps[lastStepIndex].geometry.coordinates[lastCoordIndex][1];

            // Dauer der Etappe
            legsDuration += data.legs[l].duration;

            // Zeitpunkt des erreichen des Wegpunktens = aktuelle Zeit + Dauer der Etappe 
            let time = START.time + legsDuration * 1000;

            let date = new Date(time); //Datum drauß machen um es and die Forecast-Methode zu übergeben

            let waypointWeather = await OM_getForecastWeather(lng, lat, date, true, EXTRA[l].marker, true); //Wetter am Wegpunkt
            EXTRA[l].weather = waypointWeather;
            EXTRA[l].time = date;
        }

        if (!weatherDataAvailable) continue; //wenn es keine Daten gibt weiteren Aufwand sparen und nur durch die Legs (Wegpunkte) loopen

        // Jetzt restliche Wetterkonditionen auf der Route

        for (let s = 0; s < data.legs[l].steps.length; s++) { // alle steps im leg

            let stepLength = data.legs[l].steps[s].geometry.coordinates.length;
            let timeStep = data.legs[l].steps[s].duration * 1000 / stepLength;

            for (let g = 0; g < stepLength; g += 50) { // alle Koordinaten im Step (in 50er Schritten)
                let coords = data.legs[l].steps[s].geometry.coordinates[g]; // letzte Koordinaten im step
                let lng = coords[0];
                let lat = coords[1];

                let time = START.time + stepsDuration * 1000 + timeStep * (g + 1);
                let date = new Date(time);
                let waypointWeather = await OM_getForecastWeather(lng, lat, date, true); //Wetter abfragen

                // Herausfinden, ob Zeit an Koordinate evtl schon am nächsten Tag

                let dayOffset = getDayOffset(currentDate, date);

                let hour = getHour(date, dayOffset);

                let wpWeathercode = waypointWeather.weather.hourly.weathercode[hour]; //Wettercode an Wegpunkt holen

                // Wetter abspeichern wenn es signifikanter ist als bisheriges
                if (wpWeathercode > significantCondition.code) {
                    significantCondition.code = wpWeathercode;
                    significantCondition.coords = [lng, lat];
                    significantCondition.time = date;
                    significantCondition.index = conditionStart.length;
                }

                let windSpeed = waypointWeather.weather.hourly.windspeed_10m[hour];
                let windDir = waypointWeather.weather.hourly.winddirection_10m[hour];

                if (windSpeed > highestWind.speed) {
                    highestWind.speed = windSpeed;
                    highestWind.dir = windDir;
                }

                let wpTemp = waypointWeather.weather.hourly.temperature_2m[hour];

                if (wpTemp > temps.highest) {
                    temps.highest = wpTemp;
                } else if (wpTemp < temps.lowest) {
                    temps.lowest = wpTemp;
                }

                // checken, ob es sich beim aktuellen Punkt um einen Wegpunkt (mit Marker) handelt
                // dann wollen wir z.B. keine extra Popups setzen
                let isWaypoint = s == data.legs[l].steps.length - 1 || (l == 0 && s == 0 && g == 0);

                let cPoint = [lng, lat]; //Koordinatenpaar des aktuellen Punktes

                // 45, weil erst da Regen und so beginnt, können aber theoretisch auch alle machen
                // conditions tracken, start und endpunkte werden in den entsprechenden arrays gespeichert um dann später damit teilrouten aus der Route herauszuschneiden
                if (wpWeathercode >= 45) {

                    let routeCopy = [...route]; // route kopieren um original nicht zu verändern

                    if (currentWC < 45) { // vorheriger Streckenabschnitt war frei, jetzt beginnt relevante Condition
                        conditionStart.push({ coordinates: [lng, lat], time: date, hour: hour, weather: waypointWeather.weather, isWaypoint: isWaypoint });

                        indexStart = route.indexOfForArrays(cPoint); //nach Koordinatenpaar in Routen-Array suchen
                        //splice zerschneidet die gesamtroute am entsprechenden Index und speichert den hinteren Teil in subroute
                        //von routeCopy bleibt nur der Teil vor dem Schnittpunkt übrig
                        subroute = routeCopy.splice(indexStart); 
                        subrouteWC = wpWeathercode;

                        let wm = new mapboxgl.Marker({
                            element: im2,
                            draggable: false
                            //clickTolerance: 25
                        });

                        if (!isWaypoint) {


                            wm.setLngLat(cPoint).addTo(map).setPopup(new mapboxgl.Popup({ offset: 0, closeOnClick: false }).setHTML(`
                                <h3 onclick="setPosMarker(${conditionStart.length - 1})">${OM_codeInterpret(subrouteWC).icon}</h3>
                                
                                `));

                            if (showRouteMarkers) {
                                wm.togglePopup();
                            }


                        }

                        WeatherMarkers.push(wm);

                        currentWC = wpWeathercode;
                    }
                    // neuer Wettercode und es gibt bereits Conditions
                    // dann müssen wir den aktuellen Abschnitt beenden und als Subroute abspeichern
                    // und einen neuen Abschnitt bestimmen
                    else if (wpWeathercode != currentWC && conditionStart.length > 0) {
                        conditionEnd.push({ coordinates: [lng, lat], time: date, hour: hour, weather: waypointWeather.weather, isWaypoint: isWaypoint });

                        indexEnd = subroute.indexOfForArrays(cPoint);

                        // Subroute abschneiden
                        // in diesem Fall wird der hintere Teil einfach verworfen weil er nirgendwo abgespeichert wird
                        subroute.splice(indexEnd); 

                        subrouteToMap(subroute, subRouteIndex, subrouteWC); //zur Map hinzufügen

                        subRouteIndex++

                        //neue condition
                        conditionStart.push({ coordinates: [lng, lat], time: date, hour: hour, weather: waypointWeather.weather, isWaypoint: isWaypoint });

                        indexStart = route.indexOfForArrays(cPoint);
                        subroute = routeCopy.splice(indexStart);
                        subrouteWC = wpWeathercode;

                        let wm = new mapboxgl.Marker({
                            element: im2,
                            draggable: false
                            //clickTolerance: 25
                        });

                        if (!isWaypoint) {


                            wm.setLngLat(cPoint).addTo(map).setPopup(new mapboxgl.Popup({ offset: 0, closeOnClick: false }).setHTML(`
                                <h3 onclick="setPosMarker(${conditionStart.length - 1})">${OM_codeInterpret(subrouteWC).icon}</h3>
                                
                                `));

                            if (showRouteMarkers) {
                                wm.togglePopup();
                            }


                        }

                        WeatherMarkers.push(wm);


                        currentWC = wpWeathercode;
                    }
                } 
                // neue Condition ist nicht mehr relevant
                // Abschnitt beenden
                else if (wpWeathercode < 45 && conditionStart.length > 0 && currentWC >= 45) {
                    conditionEnd.push({ coordinates: [lng, lat], time: date, hour: hour, weather: waypointWeather.weather, isWaypoint: isWaypoint });

                    indexEnd = subroute.indexOfForArrays(cPoint);

                    subroute.splice(indexEnd);

                    subrouteToMap(subroute, subRouteIndex, subrouteWC);
                    subrouteWC = 0;

                    subRouteIndex++;

                    currentWC = wpWeathercode;
                }
            }

            stepsDuration += data.legs[l].steps[s].duration
        }



    }

    if (conditionStart.length != subRoutes.length) {
        //wenn das der Fall ist dann geht der letzte Abschnitt bis zum Endpunkt
        //und muss noch hinzugefügt werden
        indexEnd = subroute.length - 1;
        subrouteToMap(subroute, subRouteIndex, subrouteWC);
    }

    console.log(conditionStart);
    console.log(conditionEnd);


    // Fertig
    //loader.style.setProperty("display", "none");
    if (detailcontainer.style.display != "flex") showFinalSummary();
    else setRouteDetails();


}

/**
 * Routenabschnitte zur Karte hinzufügen und im subroute-Array speichern
 * 
 * @param subroute eine subroute in Form eines Arrays mit Koordinaten
 * @param index ein Index zur Benennung der Route (um sie wiederfinden zu können)
 * @param w ein Wettercode für die Teilroute
 */
function subrouteToMap(subroute, index, w) {
    const SRgeojson = {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: subroute
        }
    };

    if (map.getSource(`subroute${index}`)) {
        map.getSource(`subroute${index}`).setData(SRgeojson);
    } else {

        map.addLayer({
            id: `subroute${index}`,
            type: 'line',
            source: {
                type: 'geojson',
                data: SRgeojson
            },
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': OM_codeInterpret(w).color, //linie bekommt Farbe des Wettercodes
                'line-width': 5,
                'line-opacity': 1
            }
        });
    }

    subRoutes.push(`subroute${index}`);
}


/**
 * Funktion, die alle existierenden Routen, also Hauptroute und Routenabschnitte (subrouten/Wetterkonditionen auf Hauptroute) entfernt
 */
function deleteRoutes() {

    //Dafür müssen Layer und Source entfernt werden
    //eine Source kann erst entfernt werden, wenn sie von keinem Layer mehr verwendet wird, deswegen muss der Layer zuerst entfernt werden

    if (map.getLayer("route") != undefined) map.removeLayer("route");

    if (map.getSource('route')) {
        map.removeSource('route');
    }

    deleteSubroutes();



    routes = undefined;

    if (POS.markerActive) {
        POS.marker.remove();
        POS.markerActive = false;
    }

    slider.max = 24; //Slider wieder auf 2h setzen (max der Regenkarte)

    sidebar.style.display = "none";
    mapContainer.style.width = "100vw";
    summary.style.display = "none";
    popupToggle.style.display = "none";
    detailcontainer.style.display = "none";

    if (useCurrentTime) {
        startDateInput.value = toLocaleIsoString(new Date());
        timeContainer.innerText = new Date().toLocaleString().slice(0, -3);
        TIMESTAMP = +new Date();
    }

    if (START.coords == undefined && END.coords == undefined) {
        for (let i = 0; i < EXTRA.length; i++) {
            EXTRA[i].marker.remove();
        }

        EXTRA = [];
    }

}

/**
 * Routenabschnitte löschen, indem das subRoute-Array durchgegangen und geleert wird
 */
function deleteSubroutes() {
    for (let i = 0; i < subRoutes.length; i++) {
        if (map.getLayer(subRoutes[i]) != undefined) map.removeLayer(subRoutes[i]);

        if (map.getSource(subRoutes[i])) {
            map.removeSource(subRoutes[i]);
        }

    }

    // Arrays mit getrackten Conditions zurücksetzen
    subRoutes = [];
    conditionStart = [];
    conditionEnd = [];

    //Marker auch löschen
    for (let i = 0; i < WeatherMarkers.length; i++) {
        WeatherMarkers[i].remove();
    }



    WeatherMarkers = [];

    significantCondition = {
        code: 0,
        coords: [],
        time: undefined,
        index: 0
    };

    highestWind = {
        speed: 0,
        dir: ""
    }

    temps = {
        highest: -100,
        lowest: 100
    }
}


/**
 * Diese Funktion macht aus dem Waypoint-Array einen String, den man an die Mapbox Directions-API übergeben kann
 * 
 * @param waypoints Array mit Positionsobjekten (meistens EXTRA)
 * @returns einen String mit den Koordinaten im richtigen Format für die Directions-API
 */
function waypointString(waypoints) {

    if (waypoints.length == 0) return "";

    if (waypoints.length > 1) {
        //wegpunkte nach entfernung zum startpunkt sortieren damit sie in sinnvoller reihenfolge besucht werden
        waypoints.sort((a, b) => {
            return calculateCoordDistance(a.marker.getLngLat().lng, a.marker.getLngLat().lat, START.coords.lng, START.coords.lat) > calculateCoordDistance(b.marker.getLngLat().lng, b.marker.getLngLat().lat, START.coords.lng, START.coords.lat) ? 1 : -1;
        })
    }

    for (let i = 0; i < waypoints.length; i++) {
        waypoints[i].index = i;
        waypoints[i].xm.setAttribute("index", i);

    }

    let waypointString = "";

    for (let i = 0; i < waypoints.length; i++) {
        waypointString += waypoints[i].marker.getLngLat().lng + "," + waypoints[i].marker.getLngLat().lat + ";";
    }

    console.log(waypointString);

    return waypointString;
}

/**
 * Berechnet Distanz zwischen zwei Koordinaten-Paaren
 * Da fehlen evtl ein paar Cases wie Sprung zwischen -180 und +180
 * aber sollte für unsere Zwecke reichen
 * 
 * @param lng1 
 * @param lat1 
 * @param lng2 
 * @param lat2 
 * @returns Distanz als Zahl
 */
function calculateCoordDistance(lng1, lat1, lng2, lat2) {
    return Math.sqrt(Math.pow(lng2 - lng1, 2) + Math.pow(lat2 - lat1, 2));
}

/**
 * Findet Location auf Route zu gegebener Zeit und gibt die Koordinaten zurück
 * 
 * @param time in Millisekunden
 * @returns Koordinatenpaar als Array
 */
function findTimeLocation(time) {

    let posCoords;

    let route = routes.routes[activeRoute];

    if (time >= END.time) {
        posCoords = [END.coords.lng, END.coords.lat];
    }

    else {
        let l = 0;
        let totalDuration = START.time;
        while (time > route.legs[l].duration * 1000 + totalDuration && l + 1 < route.legs.length) {
            totalDuration += route.legs[l].duration * 1000;
            l++;

        }

        console.log("leg: " + l);

        let s = 0;
        while (time > route.legs[l].steps[s].duration * 1000 + totalDuration && s + 1 < route.legs[l].steps.length) {
            totalDuration += route.legs[l].steps[s].duration * 1000;
            POS.bearing = route.legs[l].steps[s].maneuver.bearing_after;
            s++;

            console.log("step: " + s)
        }

        let stepStart_Delta = route.legs[l].steps[s].duration * 1000;

        let stepTimeStep = (stepStart_Delta) / route.legs[l].steps[s].geometry.coordinates.length;

        let c = 0;
        while (time > stepTimeStep + totalDuration && c + 1 < route.legs[l].steps[s].geometry.coordinates.length) {
            totalDuration += stepTimeStep;
            c++;
        }

        posCoords = route.legs[l].steps[s].geometry.coordinates[c];

    }

    return posCoords;

}

/**
 * Findet den Zeitpunkt zu gegebener Location auf Route
 * 
 * @param lng 
 * @param lat 
 * @returns Zeit in Millisekunden
 */
function findLocationTime(lng, lat) {

    if (routes == undefined) return;

    let time = START.time;

    let route = routes.routes[activeRoute];

    for (let l = 0; l < route.legs.length; l++) {
        for (let s = 0; s < route.legs[l].steps.length; l++) {

            let stepLength = route.legs[l].steps[s].duration;
            let stepTimeStep = stepLength / route.legs[l].steps[s].geometry.coordinates.length;

            for (let c = 0; c < route.legs[l].steps[s].geometry.coordinates.length; c++) {
                time += stepTimeStep * 1000;
                if (lng == route.legs[l].steps[s].geometry.coordinates[c][0] && lat == route.legs[l].steps[s].geometry.coordinates[c][1]) {
                    break;
                }

            }

        }

    }

    return time;
}
