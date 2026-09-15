/*Globale Variablen und Initialisierungen*/

/*----------*/

//console.log = function () { }; // console log vorübergehend deaktivieren (mit leerer Funktion überladen)

let showWeatherLayer = true; // Wetterlayer über Karte anzeigen oder nicht
const AZURE = false; // dynamische Azure Rain Map benutzen (nicht standard und nicht zu oft - teuer!), ansonsten Rainviewer (statisch)

let TIMESTAMP = +new Date();
let ISOtimestamp = new Date().toISOString().split(".")[0]; //aktuelles Datum in Iso-String umgewandelt (für Wetter Karte) - globale Variable, so dass sie jederzeit verändert werden und die Wetterkarte darauf zugreifen kann
let localeISOtimestamp = toLocaleIsoString(new Date()); // lokaler Iso-Timestamp, also mit Berücksichtigung der Zeitzone

let useCurrentTime = true; // von aktuellem Zeitpunkt bei neuen Routen oder Routenupdates ausgehen

//Globale Status Flags (abhängig vom gewählten Zeitrahmen)
let weatherDataAvailable = true;
let mapDataAvailable = true;

//Hier werden bereits abgerufene Wetterdaten für Koordinaten gespeichert 
//Indizierung mit Hashwert
//Ein Wetterobjekt enthält immer Daten für mindestens 24h
var weather = [];

var routes; //Routen-Objekt
var activeRoute; //Index der gerade aktiven Route, falls man später noch einmal mehr als nur eine anzeigen möchte

//Array zum Tracken von Koordinaten, an denen eine Wetterkondition auf der Route beginnt
var conditionStart = [];
//Array zum Tracken von Koordinaten, an denen eine Wetterkondition auf der Route endet
var conditionEnd = [];

//Hier wird die relevanteste Wetterkondition auf der Route gespeichert (für die Overview)
var significantCondition = {
    code: 0,
    coords: [],
    time: undefined,
    index: 0
};

//auch für die Overview
var highestWind = {
    speed: 0,
    dir: ""
}

var temps = {
    highest: -100,
    lowest: 100
}

// hier werden Routenabschnitte als Teilrouten gespeichert, die verschiedene Wetterkonditionen markieren
// (das ist einfach nur eine Folge von Koordinatenpaaren)
var subRoutes = [];


// State-Switcher "start", "end", oder "extra"
// Klick auf Karte betrifft entsprechend Start, End oder Extra Marker
var current = "start";

// routing profile für die directions api
var profile = "driving-traffic";

// booleans, die geändert werden, wenn sich die Maus über dem Start oder Endmarker befindet
let overStart = false;
let overEnd = false;

let overRoute = false;
let overPos = false;

let showMarkers = true; // alle Marker zeigen
let showRouteMarkers = false; // Routenmarker (an jedem Wetterwechsel) zeigen

let contextMenuOpen = false;

// Startpunkt-Objekt
var START = {
    time: TIMESTAMP, // Startzeitpunkt in Millisekunden
    coords: undefined,
    location: undefined,
    weather: undefined,
    bearing: undefined,
    marker: new mapboxgl.Marker({
        element: sm, // das HTML-Element, das für den Marker und dessen Darstellung verwendet wird
        draggable: true //darf verschoben werden
        //clickTolerance: 25
    })
};

// Endpunkt-Objekt
var END = {
    time: undefined, // Endzeitpunkt in Millisekunden
    coords: undefined,
    location: undefined,
    weather: undefined,
    bearing: undefined,
    marker: new mapboxgl.Marker({
        element: em,
        draggable: true
        //clickTolerance: 25
    })
};

// Der Pos-Marker ist der Marker der durch Bewegen des Sliders über die Route gezogen wird
var POS = {
    time: undefined,
    coords: undefined,
    location: undefined,
    weather: undefined,
    bearing: undefined, // bearing war dafür gedacht ggf eine Bewegungsrichtung anzuzeigen, das hat aber eher semi funktioniert
    marker: new mapboxgl.Marker({
        element: pm,
        draggable: false
        //rotationAlignment: "map"
        //clickTolerance: 25
    }),
    markerActive: false
}

// Liste für alle Extra Marker, also Extra Wegpunkte
// Hier kommen im Prinzip einfach Objekte nach dem selben Schema der anderen Marker rein
var EXTRA = [];

/* Dieser Index wird hochgezählt wenn ein neuer Extramarker erstellt wird, um jedem neuen Marker
einen Index zuzuweisen, damit wir auf ihn zugreifen können. Wird ein Marker wieder entfernt, wird
der Index entsprechend wieder dekrementiert damit keine Lücken in der Index-Folge entstehen
*/
let extraIndex = -1;

// Hier werden alle Div-Elemente (xm für xtra marker) der Extra Marker gespeichert
let xms = [];

/* Dieses Objekt beschreibt den State für ein xm-HTML-Element.
Jedes xm-Element bekommt später einen Event-Listener, der die Werte dieses Objekts ändert,
wenn das Event (z.B. mouse over) eintritt und seinen entsprechenden Index reinschreibt.
So lässt sich generalisiert festellen, ob über irgendeinem xm sich gerade die Maus befindet 
(dann wäre overXm true) und das entsprechende xm-Element lässt sich durch den index z.B. ggf
entfernen
(ich glaub das geht auch eleganter aber es funktioniert auf jeden fall so)
*/
let xmState = {
    index: -1,
    overXm: false
}

// Hier werden die Marker für verschiedene Wetter-Conditions auf der Route gespeichert - das ist wichtig um sie später wieder löschen zu können
var WeatherMarkers = [];

// aktuelle Position des PosMarkers in der Condition Liste
// relevant für das Durchklicken durch die Route anhand der Conditions
let currentPosMarkerIndex = 0; 

// Start Date Input zunächst auf aktuelle Zeit setzen
// zurück oder weiter als 7 Tage geht nicht
startDateInput.value = localeISOtimestamp;
startDateInput.min = localeISOtimestamp;
startDateInput.max = toLocaleIsoString(new Date(sevenDaysFromNow()));

//Datum und Zeit über dem Slider 
timeContainer.innerHTML = new Date(TIMESTAMP).toLocaleString().slice(0, -3);

// Zunächst Car Profile
buttonSetActive(carButton); 

// Event Listener (auf dem gesamten HTML Dokument), der Code ausführt, sobald der Delete-Button gedrückt wurde
// in diesem Fall wird der Marker entfernt, über dem sich die Maus gerade befindet
document.addEventListener("keyup", (e) => {
    if (e.code == "Delete") {
        if (overStart) {

            geoCoder.clear();
        }
        if (overEnd) {

            geoCoder2.clear();
        }
        // true, wenn sich die Maus über einem Extra Marker befindet
        if (xmState.overXm) {
            removeExtra(xmState.index);
        }

        // Wenn Start oder End Marker entfernt wurden, wird auch die ursprüngliche Route entfernt
        if (START.coords == undefined || END.coords == undefined) {

            deleteRoutes();
        }
    }
});