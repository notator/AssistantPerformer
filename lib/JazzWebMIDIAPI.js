/*
 *  copyright 2013 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  lib/JazzWebMIDIAPI.js
 *  This file defines the MIDILib.jazzWebMIDIAPI namespace which implements
 *  the W3C Web MIDI API (as defined on 17.01.2013) using the Jazz plugin.
 *  All other namespaces in MIDILib depend on this jazzWebMIDIAPI namespace,
 *  and will continue to do so until browsers implement the Web MIDI API
 *  natively. When that happens, the dependent files will have to be updated
 *  to the latest Web MIDI API version before deleting this file completely.
 *  That should not be too difficult. :-)
 *
 *  The current version of the W3C Web MIDI API can be found at its GitHub
 *  repository:
 *      http://webaudio.github.com/web-midi-api/
 *
 *  Most of this file (JazzWebMIDIAPI.js) was originally copied from parts of
 *  abudaan's JazzMIDIBridge:
 *      https://github.com/abudaan/JazzMIDIBridge
 *  Some of JazzMidiBridge was not required here, and there have been some name
 *  changes in the Web MIDI API since JMB was originally written.
 *  Also, I have taken advantage of a couple of upgraded features in Jazz 1.2.
 *  Note that while Jazz does not support Event.timestamps (messages are simply
 *  sent immediately), this interface assumes that timestamps are being sent.
 *
 *  This file defines a single public function:
 *
 *          MIDILib.jazzWebMIDIAPI.init(),
 *
 *  which is called on entry to the main program code to ensure that the relevant
 *  window interfaces are set correctly.
 *  Currently, the following window attributes are affected:
 *      window.navigator.requestMIDIAccess(...)  // returns the MIDIAccess object
 *      window.performance, 
 *      window.performance.now(), // DOMHRT timer
 *      window.URL, // for saving Blobs (binary files)
 *
 *  init() sets window.navigator.requestMIDIAccess (if necessary) to the
 *  private function _getJazz(onSuccessCallback, onErrorCallback).
 *  When called, this function returns the (otherwise private) MIDIAccess
 *  object via the onSuccessCallback function. 
 *  The returned MIDIAccess object has the following attributes (all functions):
 *          enumerateInputs()
 *          enumerateOutputs()
 *          getInput(index)
 *          getOutput(index)
 */

/*jslint bitwise: false, nomen: true, plusplus: true, white: true */

MIDILib.namespace('MIDILib.jazzWebMIDIAPI');

MIDILib.jazzWebMIDIAPI = (function (document)
{
    "use strict";
    var 
    Jazz, //reference to the Jazz browser plugin
    inputDevices = [],
    outputDevices = [],

    //the object that mimics the future native MIDIAccess object in a browser
    MIDIAccess =
    {
        enumerateInputs: function ()
        {
            return inputDevices;
        },

        enumerateOutputs: function ()
        {
            return outputDevices;
        },

        getInput: function (index)
        {
            if (index < 0 || index >= inputDevices.length)
            {
                return false;
            }
            var input = inputDevices[index];
            if (input.isOpen === false)
            {
                input.open();
            }
            return input;
        },

        getOutput: function (index)
        {
            if (index < 0 || index >= outputDevices.length)
            {
                return false;
            }
            var output = outputDevices[index];
            if (output.isOpen === false)
            {
                output.open();
            }
            return output;
        }
    },

    // creates a MIDIInput device or a MIDIOutput device
    // A MIDIInput is given an 'onmessage' attribute.
    // A MIDIOutput is given a 'send' attribute.
    // port.manufacturer and port.version are both set to null because
    // Jazz does not support these attributes.
    // Arguments:
    //  id is the index of the port in the input or output enumeration
    //  type is either "input" or "output"
    //  name is the device's name
    _createMIDIPort = function (id, type, name)
    {
        var port =
        {
            id: id,
            manufacturer: null,
            name: name,
            type: type,
            version: null,
            isOpen: false
        },

        // added to MIDIInputs
        addEventListener = function (eventId, port, callback)
        {
            if (eventId === "message") // current W3C
            {
                Jazz.MidiInOpen(port.id, function (timestamp, data)
                {
                    // The callback is, for example, my Assistant.handleMIDIInputEvent(data)
                    // The callback creates a new Event or SysExEvent from the data,
                    // using window.performance.now() for the timestamp. So Jazz's timestamp
                    // is ignored here.
                    callback(data);
                });
            }
        },

        // added to MIDIOutputs
        // Note that Jazz 1.2 does not support timestamps
        send = function (port, data)
        {
            var i, nValues = data.length, numbersArray = [];

            if (port.isOpen === false)
            {
                port.open();
            }
            if (data.length === 0)
            {
                i = 10; // conditional breakpoint on data.length === 0
            }
            // data is a Uint8Array, convert it to Numbers, before sending to Jazz!
            for (i = 0; i < nValues; ++i)
            {
                numbersArray.push(data[i]);
            }
            try
            {
                Jazz.MidiOutLong(numbersArray);
            }
            catch (e)
            {
                i = 10; // conditional breakpoint
            }
        },

        openInput = function (port)
        {
            port.isOpen = true;
        },

        openOutput = function (index)
        {
            port = Jazz.MidiOutOpen(index);
            port.isOpen = true;
        },

        closeOutput = function (port)
        {
            if (port.isOpen)
            {
                Jazz.MidiOutClose();
            }
            port.isOpen = false;
        },

        closeInput = function (port)
        {
            if (port.isOpen)
            {
                Jazz.MidiInClose();
            }
            port.isOpen = false;
        };

        if (type === "input")
        {
            port.addEventListener = function (eventId, callback)
            {
                addEventListener(eventId, port, callback);
            };
            port.open = function ()
            {
                openInput(port);
            };
            port.close = function ()
            {
                closeInput(port);
            };
        }
        else if (type === "output")
        {
            // Jazz 1.2 supports SysEx, and Running Status, but not timestamps.
            // The timestamp argument must be there to conform with the Web MIDI API.
            // See Sequence.tick(): midiOutputDevice.send(midiEvent.data, domhrtTimestamp)
            port.send = function (data, timestamp)
            {
                send(port, data);
            };
            port.open = function ()
            {
                openOutput(port);
            };
            port.close = function ()
            {
                closeOutput(port);
            };
        }
        return port;
    },

    // scans all currently available MIDI devices
    _scanPorts = function ()
    {
        var id, list;
        //get inputDevices
        list = Jazz.MidiInList();
        for (id = 0; id < list.length; ++id)
        {
            inputDevices.push(_createMIDIPort(id, "input", list[id]));
        }
        //get outputDevices
        list = Jazz.MidiOutList();
        for (id = 0; id < list.length; ++id)
        {
            outputDevices.push(_createMIDIPort(id, "output", list[id]));
        }
    },

    // Cribbed from abudaan's JMB.init()
    // onSuccessCallback(MIDIAccess) sets the MIDIAccess variable in the caller's parent scope.
    // My onErrorCallback(error) [not in this library] currently throws an exception informing of the error. 
    _getJazz = function (onSuccessCallback, onErrorCallback)
    {
        var 
        jazz1Obj = document.createElement("object"),
        jazz2Obj = document.createElement("object");

        //embed for IE
        jazz1Obj.setAttribute("classid", "CLSID:1ACE1618-1C7D-4561-AEE1-34842AA85E90");
        jazz1Obj.setAttribute("style", "margin-left:-1000px;");

        //embed for all other browsers
        jazz2Obj.setAttribute("type", "audio/x-jazz");
        jazz2Obj.setAttribute("style", "visibility:hidden;");

        jazz1Obj.appendChild(jazz2Obj);
        document.body.appendChild(jazz1Obj);

        Jazz = jazz1Obj;
        if (!Jazz || !Jazz.isJazz)
        {
            Jazz = jazz2Obj;
        }
        if (Jazz)
        {
            _scanPorts();
            onSuccessCallback(MIDIAccess);
        }
        else if (onErrorCallback !== undefined)
        {
            onErrorCallback("No Jazz plugin detected, please visit http://jazz-soft.net/");
        }
        else
        {
            window.alert("No Jazz plugin detected, please visit http://jazz-soft.net/");
        }
    },

    // Ensure that the relevant window interfaces are set correctly.
    // Currently this affects window.performance, window.performance.now,
    // window.URL and window.navigator.requestMIDIAccess
    init = function (window)
    {
        window.performance = window.performance || window.mozPerformance || window.msPerformance || window.webkitPerformance || {};
        if (!window.performance.now)
        {
            window.performance.now = window.performance.webkitNow;
        }

        window.URL = window.URL || window.webkitURL;

        window.navigator = window.navigator || {};
        if(!window.navigator.requestMIDIAccess)
        {
            window.navigator.requestMIDIAccess = _getJazz;
        }
    },

    API =
    {
        init: init
    };

    return API;

} (document));

    
