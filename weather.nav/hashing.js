/*Funktionen zum Hashen in das Koordinaten-Array um Wetter für Koordinaten zu speichern, 
die schon besucht wurden.
Das schöne an Javascript Arrays ist, dass sie dynamisch erweiterbar sind, man kann einfach
in Indizes einfügen die zuvor noch gar nicht existiert haben. 
Die Indexfolge muss nicht stetig sein, Lücken sind erlaubt
(Weil es eigentlich keine Arrays sind, sondern Objekte die so tun als wären sie Arrays)
 */

/*----------*/

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * ermittelt einen Int-Hashwert aus einem Koordinatenpaar als Index das Wetter-Array
 * 
 * @param lon 
 * @param lat 
 * @returns Int Index
 */

function wHash(lon, lat) {

    //Geohash String holen
    const geohashStr = geohashEncode(lat, lon, 12);
    let hashStr = "";

    //Zahlenkette aus den Indexen der Buchstabenfolfe in Base32
    for (let i = 0; i < geohashStr.length; i++) {
        hashStr += `${BASE32.indexOf(geohashStr[i])}`;
    }

    //in Int umwandeln und Modulo 10000
    //sollte also ein Index zwischen 0 und 10000 herauskommen.
    let hashInt = parseInt(hashStr) % 10000;

    return hashInt;


}

/**
 * Konvertiert ein Koordinatenpaar in einen String nach dem Geohash-Verfahren
 * 
 * @param lat 
 * @param lon 
 * @param precision letztendlich die Länge des Strings, desto länger desto größer die Varianz logischerweise
 * @returns String
 */
function geohashEncode(lat, lon, precision) {
    let idx = 0; 
    let bit = 0; 
    let evenBit = true;
    let geohash = '';

    let latMin = -90, latMax = 90;
    let lonMin = -180, lonMax = 180;

    while (geohash.length < precision) {
        if (evenBit) {
            const lonMid = (lonMin + lonMax) / 2;
            if (lon >= lonMid) {
                idx = idx * 2 + 1;
                lonMin = lonMid;
            } else {
                idx = idx * 2;
                lonMax = lonMid;
            }
        } else {
            const latMid = (latMin + latMax) / 2;
            if (lat >= latMid) {
                idx = idx * 2 + 1;
                latMin = latMid;
            } else {
                idx = idx * 2;
                latMax = latMid;
            }
        }
        evenBit = !evenBit;

        if (++bit == 5) {
            geohash += BASE32.charAt(idx);
            bit = 0;
            idx = 0;
        }
    }

    return geohash;
}