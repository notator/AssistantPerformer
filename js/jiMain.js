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
    jiAPControls = JI_NAMESPACE.apControls,

    // Ensure that the relevant window interfaces are set correctly.
    // Currently this just affects window.performance, window.performance.now and window.URL
    setWindow = function ()
    {
        window.performance = window.performance || window.mozPerformance || window.msPerformance || window.webkitPerformance || {};
        if (!window.performance.now)
        {
            window.performance.now = window.performance.webkitNow;
        }

        window.URL = window.URL || window.webkitURL;
    },

    checkAPI = function (objectName, attributeName)
    {
        var okay = true;
        switch (objectName)
        {
            case "MIDIAccess":
                switch (attributeName)
                {
                    case "enumerateInputs":
                        break;
                    case "enumerateOutputs":
                        break;
                    case "getInput":
                        break;
                    case "getOutput":
                        break;
                    default:
                        okay = false;
                }
                break;
            case "MIDIPort":
                switch (attributeName)
                {
                    case "id":
                        break;
                    case "manufacturer":
                        break;
                    case "name":
                        break;
                    case "type":
                        break;
                    case "version":
                        break;
                    default:
                        okay = false;
                }
                break;
            case "MIDIInput":
                switch (attributeName)
                {
                    case "onmessage":
                        break;
                    default:
                        okay = false;
                }
                break;
            case "MIDIOutput":
                switch (attributeName)
                {
                    case "send":
                        break;
                    default:
                        okay = false;
                }
                break;
            case "MIDIEvent":
                switch (attributeName)
                {
                    case "timestamp":
                        break;
                    case "data":
                        break;
                    default:
                        okay = false;
                }
                break;
        }
        if (!okay)
        {
            throw "API Error: the name " + objectName + "." + attributeName + " has changed.";
        }
    },

    onSuccessCallback = function (midi)
    {
        midiAccess = midi;
    },

    onErrorCallback = function (error)
    {
        throw "Error: Unable to set midiAccess. Error code:".concat(error.code);
    };

    setWindow();

    navigator.requestMIDIAccess(onSuccessCallback, onErrorCallback);

    midiAccess.checkAPI = checkAPI;

    jiAPControls.init(midiAccess); // sets the contents of the device selector menus

}, false);


