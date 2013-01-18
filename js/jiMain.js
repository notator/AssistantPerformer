/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  jiMain.js
 *  1. Ensures that the relevant window interfaces are set correctly.
 *  2. Retrieves the midiAccess object, currently using the Jazz plugin v1.2
 *     http://jazz-soft.net/
 *  3. Calls the following namespace initialisation functions:
 *      JI_NAMESPACE.jiAPControls.init(midiAccess);
 *      JI_NAMESPACE.assistant.init(MESSAGE_CREATION_DATA);
 *      JI_NAMESPACE.sequence.init(MESSAGE_CREATION_DATA);
 *      JI_NAMESPACE.midiChord.init(MESSAGE_CREATION_DATA);
 *
 *  MESSAGE_CREATION_DATA is a constant object containing a function and constant
 *  data which enables MIDIMessage objects to be created inside the namespaces.
 */

window.addEventListener("load", function (window, navigator)
{
    "use strict";

    var
    midiAccess,
    jiJazzWebMIDIInit = JI_NAMESPACE.jazzWebMIDI.init, // delete this line when browsers implement the Web MIDI API
    jiAPControls = JI_NAMESPACE.apControls.init,
    onSuccessCallback = function (midi)
    {
        midiAccess = midi;
    },
    onErrorCallback = function (error)
    {
        throw "Error: Unable to set midiAccess. Error code:".concat(error.code);
    };

    jiJazzWebMIDIInit(window); // delete this line when browsers implement the Web MIDI API

    navigator.requestMIDIAccess(onSuccessCallback, onErrorCallback);

    jiAPControls.init(midiAccess); // sets the contents of the device selector menus

}, false);


