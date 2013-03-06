/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/Main.js
 *  1. calls MIDILib.jazzWebMIDIAPI.init(window) to ensure that the relevant
 *     window interfaces are set correctly. This call, the file midiLib/JazzWebMIDIAPI.js
 *     and the Jazz plugin can be deleted when browsers implement the Web MIDI API
 *     natively.
 *  2. Retrieves the midiAccess object by calling
 *      window.navigator.requestMIDIAccess(onSuccessCallback, onErrorCallback);
 *  3. Calls _AP.controls.init(midiAccess) to set the contents of the
 *     device selector menus;
 */

/*jslint bitwise: false, nomen: false, plusplus: true, white: true */

window.addEventListener("load", function (window)
{
    "use strict";

    var
    midiAccess,
    onSuccessCallback = function (midi)
    {
        midiAccess = midi;
    },
    onErrorCallback = function (error)
    {
        throw "Error: Unable to set midiAccess. Error code:".concat(error.code);
    };

    MIDILib.jazzWebMIDIAPI.init(window); // delete this line when browsers implement the Web MIDI API

    window.navigator.requestMIDIAccess(onSuccessCallback, onErrorCallback);

    _AP.controls.init(midiAccess); // sets the contents of the device selector menus

}, false);


