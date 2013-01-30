/*
 *  copyright 2013 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  lib/jiWebMIDIAPI.js
 *  This file defines the JI_WEB_MIDI_API.jazzWebMIDI namespace which implements
 *  the W3C Web MIDI API using the Jazz plugin.
 *  All other namespaces in JI_WEB_MIDI_API depend on this jazzWebMIDI namespace,
 *  and will continue to do so until browsers implement it natively.
 *  When that happens, the Jazz plugin can be uninstalled, and this file removed. 
 *  
 *  The W3C Web MIDI API is defined in the latest version at the spec's
 *  Github repository:
 *      http://webaudio.github.com/web-midi-api/
 *
 *  Most of this file (jiWebMIDIAPI.js) was originally copied from parts of
 *  abudaan's JazzMIDIBridge:
 *      https://github.com/abudaan/JazzMIDIBridge
 *  Some of JazzMidiBridge was not required here, and there have been some name
 *  changes in the Web MIDI API since it was originally written. Also, I have
 *  taken advantage of a couple of upgraded features in Jazz 1.2.
 *  Note that while Jazz does not support MIDIEvent.timestamps (Events are simply
 *  sent immediately), this interface assumes that timestamps are being sent.
 *
 *  Currently (17.01.2013) the web MIDI API defines the following objects and attributes:
 *
 *      MIDIAccess
 *          attributes: enumerateInputs
 *                      enumerateOutputs
 *                      getInput
 *                      getOutput
 *
 *      MIDIPort
 *          attributes: id              // the index of the port in the enumerateInputs or enumerateOutputs array
 *                      manufacturer    // not supported by Jazz 1.2. This implementation returns null.
 *                      name            // the name of the port in the enumerateInputs or enumerateOutputs array
 *                      type            // either 'input' or 'output'
 *                      version         // not supported by Jazz 1.2. This implementation returns null.
 *
 *      MIDIInput : MIDIPort
 *          attributes: onmessage   // callback(data), called when midi data arrives at an input port.
 *
 *      MIDIOutput : MIDIPort
 *          attributes: send        // send(sequence<short> data, optional DOMHighResTimeStamp? timestamp)
 *
 *      MIDIEvent
 *          attributes: timestamp   // double
 *                      data        // sequence<Uint8>
 *
 *  Changes to MIDIAccess, MIDPort, MIDIInput and MIDIOutput only affect this file (jiWebMIDIAPI.js).
 *  Changes to MIDIEvent would affect lib/Event.js.         
 */

JI_WEB_MIDI_API.namespace('JI_WEB_MIDI_API.jazzWebMIDI');

JI_WEB_MIDI_API.jazzWebMIDI = (function (document)
{
    "use strict";
    var 
    Jazz, //reference to the Jazz browser plugin
    inputDevices = [],
    outputDevices = [],

    //the wrapper object that mimics the future native MIDIAccess object in a browser
    MIDIAccess = {
        enumerateInputs: function ()
        {
            return inputDevices;
        },

        enumerateOutputs: function ()
        {
            return outputDevices;
        },

        // to do: getInput and getOutput with device name and device
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

    // creates MIDIInput or a MIDIOutput
    // A MIDIInput is given an 'onmessage' attribute.
    // A MIDIOutput is given a 'send' attribute.
    // port.manufacturer and port.version are both set to null
    // because Jazz does not support these fields.
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
                Jazz.MidiInOpen(port.index, function (timestamp, data)
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
            if (port.isOpen === false)
            {
                port.open();
            }
            Jazz.MidiOutLong(data);
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
    // (cribbed from JazzMIDIBridge)
    _scanPorts = function ()
    {
        var name, list;
        //get inputDevices
        list = Jazz.MidiInList();
        for (name in list)
        {
            if (list.hasOwnProperty(name))
            {
                inputDevices.push(_createMIDIPort(name, "input", list[name]));
            }
        }
        //get outputDevices
        list = Jazz.MidiOutList();
        for (name in list)
        {
            if (list.hasOwnProperty(name))
            {
                outputDevices.push(_createMIDIPort(name, "output", list[name]));
            }
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
            alert("No Jazz plugin detected, please visit http://jazz-soft.net/");
        }
    },

    // Ensure that the relevant window interfaces are set correctly.
    // Currently this affects window.performance, window.performance.now, window.URL and window.navigator.requestMIDIAccess
    init = function (window)
    {
        window.performance = window.performance || window.mozPerformance || window.msPerformance || window.webkitPerformance || {};
        if (!window.performance.now)
        {
            window.performance.now = window.performance.webkitNow;
        }

        window.URL = window.URL || window.webkitURL;

        // Ensure that navigator.requestMIDIAccess is set correctly
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

    
