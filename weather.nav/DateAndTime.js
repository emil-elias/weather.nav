/*Funktionen für das Handling von Zeiten */

/*----------*/

/**
 * @param dateInMS Datum in Millisekunden
 * @returns Boolean-Wert der Auskunft darüber gibt, ob Zeitpunkt in überprüfbarem Rahmen liegt
 * true wenn Daten nicht verfügbar (weil zu weit in der Zukunft oder Vergangeneheit)
 * false wenn Daten verfügbar
 */
function dataNotAvailable(dateInMS) {
    return dateInMS - (+new Date()) >= 604800000 || (+new Date()) - 60000 > dateInMS;
    // +new Date() liefert ein Datum in Millisekunden (seit 1.1.1970 00:00)
    // alternativ würde auch Date.now() oder new Date().getTime() gehen und wäre evtl sogar "schneller"
    // aber glaube nicht dass es Laufzeittechnisch relevant ist
}

/**
 * 
 * @param dateInMS Datum in Millisekunden
 * @returns Boolean-Wert ob Zeitpunkt über 2h in der Zukunft liegt
 * true wenn ja
 * false wenn nein
 */
function beyond2hours(dateInMS) {
    return dateInMS - (+new Date()) >= 7200000; //2h = 7.200.000 ms
}

/**
 * @returns Zeitpunkt in +7 Tagen (vom aktuellen Zeitpunkt aus) in Millisekunden
 */
function sevenDaysFromNow() {
    return +new Date() + 604800000;
}

/**
 * @returns Zeitpunkt in +2 Stunden zurück (vom aktuellen Zeitpunkt aus) in Millisekunden
 */
function twoHoursFromNow() {
    return +new Date() + 7200000;
}

/**
 * Start und Endzeitpunkt an unterschiedlichen Tagen?
 * 
 * @param startdate Startdatum als Date()
 * @param enddate Enddatum als Date()
 * @returns true wenn unterschidliche Tage, false wenn selber Tag
 */
function isAnotherDay(startdate, enddate) {
    //hier muss natürlich auch auf Monatsübergänge getestet werden
    return (enddate.getDate() > startdate.getDate() || (enddate.getMonth() + 1) > (startdate.getMonth() + 1) || !useCurrentTime && (startdate.getDate() > (new Date().getDate()) || (startdate.getMonth() + 1) > (new Date().getMonth() + 1)));
}


/**
 * wandelt Datum in lokalen ISO-String um (mit Zeitzonenunterschied aber ohne Anhang der Zeitzone)
 * 
 * @param date als Date()
 * @returns ISO String im Format yyyy-mm-ddTxx:xx
 */
function toLocaleIsoString(date) {
    var tzo = -date.getTimezoneOffset(),
        dif = tzo >= 0 ? '+' : '-',
        pad = function (num) {
            return (num < 10 ? '0' : '') + num;
        };

    return date.getFullYear() +
        '-' + pad(date.getMonth() + 1) +
        '-' + pad(date.getDate()) +
        'T' + pad(date.getHours()) +
        ':' + pad(date.getMinutes());
}

/**
 * ermittelt Tage in einem Monat
 * 
 * @param year ein Jahr als Int
 * @param month ein Monat als Int
 * @returns Anzahl Tage als Int
 */
function getDays(year, month) {
    return new Date(year, month, 0).getDate();
}

/**
 * Ermittelt Tages-Offset zwischen Zwei Zeitpunkten
 * Wenn sich ein Datum im Tag nicht unterscheidet, dann ist der Offset 0 (0*24)
 * Ansonsten Tagdifferenz * 24
 * Das wird gebraucht um bei mehrtägigen Routen auch Studen 24+ im Wetter Array zugreifen zu können
 * 
 * @param startDate als Date()
 * @param endDate als Date()
 * @returns Tages-Offset als Int
 */
function getDayOffset(startDate, endDate) {

    let dayOffset;

    if (endDate.getMonth() - 1 > startDate.getMonth() - 1) {
        dayOffset = endDate.getDate() + getDays(startDate.getFullYear(), startDate.getMonth()) - startDate.getDay();
    } else {
        dayOffset = (endDate.getDate() - startDate.getDate()) * 24;
    }

    return dayOffset;

}

/**
 * Ermittelt die Stunde eines Zeitpunktes unter Berücksichtigung eines evtl. Offsets
 * um damit in das Wetter-Array einer Location indizieren zu können
 * 
 * @param date als Date()
 * @param offset als Int
 * @returns Stunde/Index für das Wetter-Array als Int
 */
function getHour(date, offset) {

    let hour = date.getHours() + offset;
    //falls schon nach halb, nächste stunde betrachten? nur wenn der index dann nicht zu hoch wird
    if (date.getMinutes() > 30 && (hour + 1) % 24 != 0) hour++;
    return hour;

}