/*UI/Interface*/

/*----------*/

/**
 * Springt zur nächsten Kondition in der gesammelten Liste und setzt den PosMarker dorthin
 */
function nextSignificant() {
    if (conditionStart.length == 0) {

        slider.value++;
        movePosMarker();


    } else if (currentPosMarkerIndex < conditionStart.length - 1) {
        setPosMarker(currentPosMarkerIndex + 1);
        map.flyTo({
            center: POS.coords,
            zoom: 12
        });
    } else if (currentPosMarkerIndex == conditionStart.length - 1) {
        currentPosMarkerIndex++;
        POS.marker.remove();
        POS.markerActive = false;
        map.flyTo({
            center: END.coords,
            zoom: 12
        });

        slider.value = slider.max;
        timeContainer.innerText = new Date(END.time).toLocaleString().slice(0, -3);

    }
}

/**
 * Springt zur vorherigen Kondition in der gesammelten Liste und setzt den PosMarker dorthin
 */
function prevSignificant() {
    if (conditionStart.length == 0) {

        slider.value--;
        movePosMarker();

    } else if (currentPosMarkerIndex > 0) {
        setPosMarker(currentPosMarkerIndex - 1);
        map.flyTo({
            center: POS.coords,
            zoom: 12
        });

        if (POS.coords[0] == routes.routes[activeRoute].geometry.coordinates[0][0] && POS.coords[1] == routes.routes[activeRoute].geometry.coordinates[0][1]) {
            POS.marker.remove();
            POS.markerActive = false;
        }
    }
}

/**
 * Setzt erste Daten in den Summary-Block wie Länge und Dauer der Route, die schon früh vorhanden sind
 * Außerdem Ladeanimation
 */
function showFirstSummary() {

    if (screen.width < 640) return; //nur wenn Screen groß genug

    summary.style.display = "flex";
    popupToggle.style.display = "block";

    const dur = document.getElementById("duration");
    const length = document.getElementById("length");
    const conditionSummary = document.getElementById("conditionSummary");

    let routeDuration = routes.routes[activeRoute].duration / 60;
    let durationString = "";
    let routeLength = routes.routes[activeRoute].distance;
    let lengthString = "";

    if (routeDuration < 60) {
        durationString = Math.round(routeDuration) + " mins";
    } else {
        let hours = Math.floor(routeDuration / 60);
        let mins = Math.round(routeDuration - hours * 60);
        durationString = hours + " h " + mins + " mins";
    }

    if (routeLength < 1000) {
        lengthString = Math.round(routeLength) + " m";
    } else {
        lengthString = (routeLength / 1000).toFixed(2) + " km";
    }

    dur.innerText = durationString;
    length.innerText = lengthString;

    conditionSummary.innerHTML = `<img id="loader" src="images/loading.gif" alt=""><br>
    <p>loading route data</p>`;


}

/**
 * Setzt die finalen Inhalte in den Summary-Block
 */
function showFinalSummary() {

    if (screen.width < 640) return;


    const wind = document.getElementById("wind");
    const temp = document.getElementById("temp");
    const conditionSummary = document.getElementById("conditionSummary");

    summary.style.display = "flex";
    detailcontainer.style.display = "none";
    popupToggle.style.display = "block";



    wind.innerText = "up to " + Math.ceil(highestWind.speed) + " km/h";


    if (Math.round(temps.lowest) == Math.round(temps.highest)) {
        temp.innerText = Math.round(temps.highest) + " °C";
    } else {
        temp.innerText = Math.round(temps.lowest) + " to " + Math.round(temps.highest) + " °C";
    }

    let summaryString = OM_codeInterpret(significantCondition.code).desc;
    let summaryIcon = OM_codeInterpret(significantCondition.code).icon;
    let summaryColor = OM_codeInterpret(significantCondition.code).color != undefined ? OM_codeInterpret(significantCondition.code).color : "white";



    if (significantCondition.code >= 45) {
        //bei klick auf die Summary bzw das Icon der signifikantesten Condition soll an die Stelle auf der Route geflogen werden
        //und der Pos-Marker an diese Stelle gesetzt werden um Details anzuzeigen
        conditionSummary.addEventListener("click", () => {
            map.flyTo({
                center: significantCondition.coords,
                zoom: 12
            });

            POS.coords = significantCondition.coords;
            POS.marker.setLngLat(POS.coords);
            POS.marker.addTo(map);

            let time = significantCondition.time;

            OM_getForecastWeather(POS.coords[0], POS.coords[1], time, true, POS.marker, true);
            slider.value = Math.floor(((+new Date(time)) - START.time) / 300000);
            timeContainer.innerText = time.toLocaleString().slice(0, -3);
            currentPosMarkerIndex = significantCondition.index;

            //WeatherMarker ausschalten falls offen weil Pos-Marker sein eigenes Popup hat
            let marker = WeatherMarkers[currentPosMarkerIndex];
            let popup = marker.getPopup();
            if (popup != null && popup.isOpen()) marker.togglePopup();
        });

    }

    conditionSummary.innerHTML = `<h1 style="color: ${summaryColor}">${summaryIcon}</h1><br>
    <p>${summaryString}<br>&nbsp;</p>`;


}

/**
 * Listet detaillierten Routenverlauf als Timeline auf und blendet ihn ein
 */
async function setRouteDetails() {

    //summary ausschalten, detail ein
    summary.style.display = "none";
    detailcontainer.style.display = "flex";

    detailcontainer.innerHTML = `<div class="container3">
    <i class="bi bi-arrow-left" onclick="showFinalSummary()" style="cursor: pointer"></i>
    <i onclick="removeStart(); removeEnd(); geoCoder.clear(); geoCoder2.clear()" class="bi bi-trash3-fill" style="cursor: pointer" title="delete route"></i>
    </div>`;

    let startDate = new Date(START.time);
    let endDate = new Date(END.time);

    let startHour = getHour(startDate, 0);

    let dayOffset = getDayOffset(startDate, endDate);

    let endHour = getHour(endDate, dayOffset);

    //zuerst Startpunkt
    detailcontainer.innerHTML +=
        `<div class="detailBlock" onclick="map.flyTo({center: START.coords,zoom: 15});" style='${borderStyle(START.weather.weather, startHour)}'>
    <p><i class="bi bi-geo-alt-fill"></i>`
        + weatherIntoDetailBlock(START.weather.weather, START.location, startDate, startHour)
        + `</div>`;

    //dann alle relevanten Unterwegs-Conditions
    for (let c = 0; c < conditionStart.length; c++) {

        let conditionDate = conditionStart[c].time;
        let conditionHour = conditionStart[c].hour;
        let conditionWeather = conditionStart[c].weather;

        let nextCWeather;
        let nextCHour;
        let nextCtime;

        if (c < conditionStart.length - 1) {
            nextCWeather = conditionStart[c + 1].weather;
            nextCHour = conditionStart[c + 1].hour;
            nextCtime = +new Date(conditionStart[c + 1].time);
        } else {
            nextCWeather = END.weather.weather;
            nextCHour = endHour;
            nextCtime = END.time;
        }


        if (!conditionStart[c].isWaypoint) {

            detailcontainer.innerHTML +=
                `<div class="detailBlock" onclick="setPosMarker(${c})" style='${borderStyle(conditionWeather, conditionHour)}'>
                <p>`
                + weatherIntoDetailBlock(conditionWeather, await reverseGeoCode(conditionStart[c].coordinates[1], conditionStart[c].coordinates[0]), conditionDate, conditionHour)
                + `</div>`;




        }

        if (c < conditionEnd.length && !conditionEnd[c].isWaypoint) {

            let conditionEndDate = conditionEnd[c].time;
            let conditionEndHour = conditionEnd[c].hour;
            let conditionEndWeather = conditionEnd[c].weather;

            if (conditionEndWeather.hourly.weathercode[conditionEndHour] != nextCWeather.hourly.weathercode[nextCHour]) {

                detailcontainer.innerHTML +=
                    `<div class="detailBlock" style='${borderStyle(conditionEndWeather, conditionEndHour)}'>
                    <p>`
                    + weatherIntoDetailBlock(conditionEndWeather, await reverseGeoCode(conditionEnd[c].coordinates[1], conditionEnd[c].coordinates[0]), conditionEndDate, conditionEndHour)
                    + `</div>`;
            }
        }

        //wegpunkte dazwischenschieben wenn sie zeitlich zwischen zwei Abschnitten liegen
        for (let x = 0; x < EXTRA.length; x++) {

            let extraDate = EXTRA[x].time;
            console.log(extraDate);
            let extraTime;
            if (extraDate != undefined) {
                extraTime = +new Date(extraDate);
            }

            if (extraTime != undefined && extraTime >= +new Date(conditionStart[c].time) && extraTime <= nextCtime) {

                detailcontainer.innerHTML +=

                    `<div class="detailBlock" onclick="map.flyTo({center: EXTRA[${x}].coords,zoom: 15});" style='${borderStyle(EXTRA[x].weather.weather, EXTRA[x].weather.hour)}'>
                <p><i class="bi bi-pin-map-fill"></i>`
                    + weatherIntoDetailBlock(EXTRA[x].weather.weather, EXTRA[x].location, extraDate, EXTRA[x].weather.hour)
                    + `</div>`;

            }


        }



    }

    // falls es keine Abschnitte gibt Wegpunkte einfach so der Reihe nach auflisten
    if (conditionStart.length == 0) {
        for (let x = 0; x < EXTRA.length; x++) {
            let extraDate = EXTRA[x].time;
            console.log(extraDate);
            let extraTime;
            if (extraDate != undefined) {
                extraTime = +new Date(extraDate);
            }
            detailcontainer.innerHTML +=

                `<div class="detailBlock" onclick="map.flyTo({center: EXTRA[${x}].coords,zoom: 15});" style='${borderStyle(EXTRA[x].weather.weather, EXTRA[x].weather.hour)}'>
                <p><i class="bi bi-pin-map-fill"></i>`
                + weatherIntoDetailBlock(EXTRA[x].weather.weather, EXTRA[x].location, extraDate, EXTRA[x].weather.hour)
                + `</div>`;
        }
    }

    // zum Schluss den Endpunkt
    detailcontainer.innerHTML +=
        `<div class="detailBlock" onclick="map.flyTo({center: END.coords,zoom: 15});" style='${borderStyle(END.weather.weather, endHour)}'>
    <p><i class="bi bi-flag-fill"></i>`
        + weatherIntoDetailBlock(END.weather.weather, END.location, endDate, endHour)
        + `</div>`;

}

/**
 * Definiert Stil bzw. Farbe der Border/Linie für die Detail-Timeline
 * abhängig vom Wettercode
 * 
 * @param weather Wetter-Objekt
 * @param hour Stunde für einfacheren Zugriff
 * @returns String mit CSS Inline Style
 */
function borderStyle(weather, hour) {

    let style = `border-left: 1px dashed; border-left-color: white`;

    if (weather.hourly.weathercode[hour] >= 45) {
        console.log("hello");
        style = `border-left: 3px solid; border-left-color: ${OM_codeInterpret(weather.hourly.weathercode[hour]).color}`;
    }

    return style;

}

/**
 * Fügt Wetterdaten in Popup ein
 * 
 * @param point der Punkt dessen Popup beschrieben werden soll
 * @param date Zeitpunkt am Punkt
 * @param hour Stunde für einfacheren Zugriff ins Wetter Array
 * @param startDate Startzeitpunkt for reference
 * @returns string mit html
 */
function weatherIntoPopup(point, date, hour, startDate) {

    return `
    <h3>${point.location}</h3>
    <p><i>${(isAnotherDay(startDate, date) ? date.getDate() + "." + (date.getMonth() + 1) + ". " : "") + date.getHours() + ":" + (date.getMinutes() < 10 ? "0" : "") + date.getMinutes()}</i></p>
    <p>${Math.round(point.weather.weather.hourly.temperature_2m[hour])} °C</p>
    <p>${OM_codeInterpret(point.weather.weather.hourly.weathercode[hour]).icon} ${OM_codeInterpret(point.weather.weather.hourly.weathercode[hour]).desc}</p>
    <p>Humidity: ${point.weather.weather.hourly.relativehumidity_2m[hour]}%</p>   
    <p>Wind Speed: ${Math.ceil(point.weather.weather.hourly.windspeed_10m[hour])} km/h</p>
    <p>Wind Direction: ${windDir(point.weather.weather.hourly.winddirection_10m[hour])}</p>
    `;
}

/**
 * Fügt Wetterdaten in einen Detail-Timeline-Block ein
 * 
 * @param weather Wetter Objekt
 * @param location 
 * @param date als Date()
 * @param hour 
 * @returns string mit HTML
 * 
 * Achtung: das HTML ist ergänzend und wird an einen öffnenden <p> Tag angehangen, es kann/sollte nicht alleine stehen
 */
function weatherIntoDetailBlock(weather, location, date, hour) {

    return `
    <i>${date.getHours() + ":" + (date.getMinutes() < 10 ? "0" : "") + date.getMinutes()}</i></p>
    <p><b>${location}</b></p>
    
    <p>${OM_codeInterpret(weather.hourly.weathercode[hour]).icon} ${OM_codeInterpret(weather.hourly.weathercode[hour]).desc}, ${Math.round(weather.hourly.temperature_2m[hour])} °C, </p>
    <p>Humidity: ${weather.hourly.relativehumidity_2m[hour]}%</p>   
    <p>Wind Speed: ${Math.ceil(weather.hourly.windspeed_10m[hour])} km/h</p>
    <p>Wind Direction: ${windDir(weather.hourly.winddirection_10m[hour])}</p>
    `;

}














