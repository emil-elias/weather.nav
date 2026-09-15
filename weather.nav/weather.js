/*Utilities für die Wetter-Ermittlung*/

/*----------*/

/**
 * Funktion die Wetterdaten für Koordinaten (longitude, latitude) zwischen start und end Datum über OpenMeteo abfragt
 * und die Informationen in den übergebenen marker schreibt, falls setPopup true ist.
 * 
 * @param lon longitude
 * @param lat latitude
 * @param endDate Zeitpunkt 
 * @param highAccuracy boolean, forciert dass Wetterdaten neu geholt werden auch wenn sie sich vielleicht schon in der Hash-Map befinden
 * @param marker ein Marker in dessen Popup geschrieben werden soll, optional
 * @param setPopup boolean, legt fest ob ein Popup gesetzt werden soll oder nicht (heißt kann 0/false, oder 1/true) sein,
 * @returns ein Wetter-Objekt
 */
async function OM_getForecastWeather(lon, lat, endDate, highAccuracy, marker, setPopup) {

    let startDate = new Date(START.time); //start datum erstmal aktueller tag, ggf später natürlich startzeit variabel

    if (!weatherDataAvailable) {
        if (setPopup) {

            marker.setPopup(new mapboxgl.Popup({ offset: 25, closeOnClick: false }).setHTML(`
            <div onclick="map.flyTo({
                center: [${lon},${lat}],
                zoom: 15
            })">
        <h3>${await reverseGeoCode(lat, lon)}</h3>
        <p><i>${(isAnotherDay(startDate, endDate) ? endDate.getDate() + "." + (endDate.getMonth() + 1) + ". " : "") + endDate.getHours() + ":" + (endDate.getMinutes() < 10 ? "0" : "") + endDate.getMinutes()}</i></p>
        <p>no forecast available</p>
        </div>
        `));

            if (showMarkers) marker.togglePopup();
        }


        return undefined;
    };



    // String für Start und Enddatum bauen, so wie OpenMeteo es haben will
    let sdMonth = startDate.getMonth() + 1;
    if (sdMonth < 10) {
        sdMonth = "0" + sdMonth;
    }

    let sdDate = startDate.getDate();
    if (sdDate < 10) {
        sdDate = "0" + sdDate;
    }

    let edMonth = endDate.getMonth() + 1;
    if (edMonth < 10) {
        edMonth = "0" + edMonth;
    }

    let edDate = endDate.getDate();
    if (edDate < 10) {
        edDate = "0" + edDate;
    }

    let sd = startDate.getFullYear() + "-" + sdMonth + "-" + sdDate;
    console.log(sd);
    let ed = endDate.getFullYear() + "-" + edMonth + "-" + edDate;
    console.log(ed);

    // Würden wir start und end nicht festlegen, würden wir stündlichen forecast für 7 Tage bekommen,
    // das ist in der Regel bisschen viel

    /*netterweise entspricht die Stunde dem Index im time-Array des Response-Objekts (0: = Uhr, 1: 1 Uhr usw.)
    Alle anderen Tage folgen dann direkt darauf, also brauchen wir ein Offset bequem auf die Uhrzeit zuzugreifen,
    falls der Ankunfstag nicht der Starttag ist.

    der Offset ist einfach endtag - starttag * 24 -> Index 24 entspricht 0:00 des nächsten Tages, Index 48 wäre 0:00 des übernächsten Tages usw.
    der Offset wird dann einfach zur Stunde dazu addiert, sollte in den meisten Fällen 0 sein
    */

    let dayOffset = getDayOffset(startDate, endDate);

    
    console.log(dayOffset);

    let hour = getHour(endDate, dayOffset);
    console.log(hour);


    let hash = wHash(lon, lat);

    let obj;

    //falls noch keine Werte zur Koordinate vorhanden oder highAccuracy gefordert, holen und ins Array schreiben
    //ansonsten aus dem Array holen
    //die 0.001 ist eine Toleranz wie weit Koordinaten abweichen dürfen, kann wahrscheinlich auch noch größer sein
    if (weather[hash] == undefined || highAccuracy ||
        Math.abs(weather[hash].coordinates[0] - lon) > 0.001 || Math.abs(weather[hash].coordinates[1] - lat) > 0.001
    ) {

        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relativehumidity_2m,apparent_temperature,precipitation,rain,showers,snowfall,snow_depth,freezinglevel_height,weathercode,visibility,windspeed_10m,winddirection_10m&models=best_match&current_weather=true&timezone=auto&start_date=${sd}&end_date=${ed}`);

        if (!res.ok) {
            throw Error(res.statusText);
        }

        let weatherObj = await res.json();

        obj = { coordinates: [lon, lat], hour: hour, weather: weatherObj }


        weather[hash] = obj;

    } else {
        obj = weather[hash];
    }

    console.log(obj);

    if (marker == undefined) return obj;

    if (setPopup) {

        marker.setPopup(new mapboxgl.Popup({ offset: 25, closeOnClick: false }).setHTML(`
        <div onclick="map.flyTo({
            center: [${lon},${lat}],
            zoom: 15
        })">
    <h3>${await reverseGeoCode(lat, lon)}</h3>
    <p><i>${(isAnotherDay(startDate, endDate) ? endDate.getDate() + "." + (endDate.getMonth() + 1) + ". " : "") + endDate.getHours() + ":" + (endDate.getMinutes() < 10 ? "0" : "") + endDate.getMinutes()}</i></p>
    <p>${Math.round(obj.weather.hourly.temperature_2m[hour])} °C</p>
    <p>${OM_codeInterpret(obj.weather.hourly.weathercode[hour]).icon} ${OM_codeInterpret(obj.weather.hourly.weathercode[hour]).desc}</p>
    <p>Humidity: ${obj.weather.hourly.relativehumidity_2m[hour]}%</p>   
    <p>Wind Speed: ${Math.ceil(obj.weather.hourly.windspeed_10m[hour])} km/h</p>
    <p>Wind Direction: ${windDir(obj.weather.hourly.winddirection_10m[hour])}</p>
    </div>
    `));

        if (showMarkers) marker.togglePopup();

    }

    return obj;

}

/**
 * Diese Funktion interpretiert OpenMeteo Wettercodes und gibt ein Objekt mit Beschreibung, Farbe und Icon zurück
 * 
 * @param code ein Wettercode
 * @returns ein Objekt mit Beschreibung, Farbe und Icon (in Form einer Bootstrap Icons Klasse) für ein Wettercode 
 */
function OM_codeInterpret(code) {

    switch (code) {
        case 0: return { desc: "clear sky", icon: `<i class="bi bi-brightness-high"></i>` };
        case 1: return { desc: "mainly clear", icon: `<i class="bi bi-brightness-low"></i>` };
        case 2: return { desc: "partly cloudy", icon: `<i class="bi bi-cloud-sun"></i>` };
        case 3: return { desc: "overcast", icon: `<i class="bi bi-cloud"></i>` };
        case 45: return { desc: "fog", color: "#999999", icon: `<i class="bi bi-cloud-haze2"></i>` };
        case 48: return { desc: "depositing rime fog", color: "#999999", icon: `<i class="bi bi-water"></i>` };
        case 51: return { desc: "light drizzle", color: "#7dffcd", icon: `<i class="bi bi-cloud-drizzle"></i>` };
        case 53: return { desc: "drizzle", color: "#03fc9c", icon: `<i class="bi bi-cloud-drizzle"></i>` };
        case 55: return { desc: "dense drizzle", color: "#018552", icon: `<i class="bi bi-cloud-drizzle"></i>` };
        case 56: return { desc: "freezing drizzle", color: "#b4d6c9", icon: `<i class="bi bi-cloud-sleet"></i>` };
        case 57: return { desc: "dense freezing drizzle", color: "#7c998e", icon: `<i class="bi bi-cloud-sleet"></i>` };
        case 61: return { desc: "slight rain", color: "#7ebff7", icon: `<i class="bi bi-cloud-rain"></i>` };
        case 63: return { desc: "rain", color: "#0286fa", icon: `<i class="bi bi-cloud-rain-heavy"></i>` };
        case 65: return { desc: "heavy rain", color: "#ae00ff", icon: `<i class="bi bi-cloud-rain-heavy-fill"></i>` };
        case 66: return { desc: "freezing rain", color: "#c4e4f5", icon: `<i class="bi bi-cloud-sleet-fill"></i>` };
        case 67: return { desc: "heavy freezing rain", color: "#ebcbf7", icon: `<i class="bi bi-cloud-sleet-fill"></i>` };
        case 71: return { desc: "light snow", color: "#ffffff", icon: `<i class="bi bi-cloud-snow"></i>` };
        case 73: return { desc: "snow", color: "#ffffff", icon: `<i class="bi bi-cloud-snow"></i>` };
        case 75: return { desc: "heavy snow", color: "#ffffff", icon: `<i class="bi bi-cloud-snow-fill"></i>` };
        case 77: return { desc: "snow grains", color: "#ffffff", icon: `<i class="bi bi-cloud-snow"></i>` };
        case 80: return { desc: "light rain showers", color: "#7ebff7", icon: `<i class="bi bi-cloud-rain"></i>` };
        case 81: return { desc: "rain showers", color: "#0286fa", icon: `<i class="bi bi-cloud-rain"></i>` };
        case 82: return { desc: "violent rain showers", color: "ae00ff", icon: `<i class="bi bi-cloud-rain-heavy"></i>` };
        case 85: return { desc: "snow showers", color: "#ffffff", icon: `<i class="bi bi-cloud-snow"></i>` };
        case 86: return { desc: "heavy snow showers", color: "#ffffff", icon: `<i class="bi bi-cloud-snow-fill"></i>` };
        case 95: return { desc: "thunderstorm", color: "#e6e209", icon: `<i class="bi bi-cloud-lightning"></i>` };
        case 96: return { desc: "thunderstorm with hail", color: "#e68a09", icon: `<i class="bi bi-cloud-lightning-rain"></i>` };
        case 99: return { desc: "thunderstorm with heavy hail", color: "#ff0000", icon: `<i class="bi bi-cloud-lightning-rain-fill"></i>` };
        default: return { desc: "no data" };

    }
}

/**
 * Diese Funktion berechnet eine Himmelsrichtung aus einer Gradzahl (0-360) für die Windrichtung 
 * und gibt diese als String zurück
 * 
 * @param degree 0-360
 * @returns String mit Beschreibung der Windrichtung
 */
function windDir(degree) {
    if (degree >= 0 && degree <= 23 || degree >= 338 && degree <= 360) return "north";
    if (degree > 23 && degree <= 67) return "north-east";
    if (degree > 67 && degree <= 113) return "east";
    if (degree > 113 && degree <= 157) return "south-east";
    if (degree > 157 && degree <= 203) return "south";
    if (degree > 203 && degree <= 247) return "south-west";
    if (degree > 247 && degree <= 293) return "west";
    if (degree > 293 && degree < 338) return "north-west";
    return "";
}