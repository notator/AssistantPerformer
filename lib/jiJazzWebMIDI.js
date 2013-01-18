/*
 *  copyright 2013 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  jiJazzWebMIDI.js
 *  The WEB_MIDI_LIB.webMIDI namespace which exposes the Web MIDI API, implementing it using the Jazz plugin.
 *  
 *  The Web MIDI API is defined in the latest version at the spec's Github repository.
 *      http://webaudio.github.com/web-midi-api/
 *  This file will be continuously updated to reflect any changes there.
 *
 *  This implementation owes a lot to (is mostly cribbed from) abudaan's JazzMIDIBridge:
 *      https://github.com/abudaan/JazzMIDIBridge
 *
 *  Currently (17.01.2013) the spec defines the following objects and attributes:
 *
 *      MIDIAccess
 *          attributes: enumerateInputs
 *                      enumerateOutputs
 *                      getInput
 *                      getOutput
 *
 *      MIDIPort
 *          attributes: id              // the index of the port in the enumerateInputs or enumerateOutputs array
 *                      manufacturer    // not supported by Jazz 1.2. Always returns "<manufacturer unknown>".
 *                      name            // the name of the port in the enumerateInputs or enumerateOutputs array
 *                      type            // either 'input' or 'output'
 *                      version         // not supported by Jazz 1.2. Always returns "<version unknown>".
 *
 *      MIDIInput : MIDIPort
 *          attributes: onmessage   // callback(data), called when midi data arrives at an input port.
 *
 *      MIDIOutput : MIDIPort
 *          attributes: send        // send(sequence<short> data, optional DOMHighResTimeStamp? timestamp)
 *
 *      MIDIEvent
 *          attributes: timestamp
 *                      data
 *
 *  A MIDIEvent constructor is defined in the WEB_MIDI_LIB.midiEvent namespace,
 *  but this namespace (WEB_MIDI_LIB.jazzWebMIDI) is not dependent on it.
 *  The callback, called when data arrives at a MIDIInput port, constructs either
 *  a MIDIEvent or a SysExMIDIEvent using the data it receives and its own timer
 *  for the timestamp. Jazz's timestamp is not used.
 *  The internal data buffer in a MIDIEvent always has minimum length, so that
 *  MIDIEvents are as small as possible.
 *  Running Status events are MIDIEvents whose data.length is 1.         
 */

WEB_MIDI_LIB.namespace('WEB_MIDI_LIB.jazzWebMIDI');

WEB_MIDI_LIB.jazzWebMIDI = (function (document)
{
    "use strict";
    var 
    Jazz, //reference to the Jazz browser plugin
    inputs = [], // input devices
    outputs = [], // output devices

    //the wrapper object that mimics the future native MIDIAccess object in a browser
    MIDIAccess = {
        enumerateInputs: function ()
        {
            return inputs;
        },

        enumerateOutputs: function ()
        {
            return outputs;
        },

        // to do: getInput and getOutput with device name and device
        getInput: function (index)
        {
            if (index < 0 || index >= inputs.length)
            {
                return false;
            }
            var input = inputs[index];
            if (input.isOpen === false)
            {
                input.open();
            }
            return input;
        },

        getOutput: function (index)
        {
            if (index < 0 || index >= outputs.length)
            {
                return false;
            }
            var output = outputs[index];
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
    // copied from JazzMIDIBridge
    _createMIDIPort = function (id, type, name)
    {
        var port =
        {
            id: id,
            manufacturer: "<manufacturer unknown>",
            name: name,
            type: type,
            version: "<version unknown>",
            isOpen: false
        },

        // added to MIDIInputs
        addEventListener = function (eventId, port, callback)
        {
            if (eventId === "message") // current W3C
            {
                Jazz.MidiInOpen(port.index, function (timestamp, data)
                {
                    // The callback is my Assistant.handleMIDIInputEvent(data)
                    // The callback creates a new MIDIEvent or SysExMIDIEvent from the data,
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
            // Note that arg1 is data, arg2 is timestamp in my code!
            // Timestamps always come last, because they are optional.
            // See Sequence.tick(): midiOutputDevice.send(midiEvent.data, domhrtTimestamp)
            port.send = function (data, timestamp)
            {
                // Jazz supports sysEx, but not timestamps
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
    // cribbed from JazzMIDIBridge
    _scanPorts = function ()
    {
        var name, list;
        //get inputs
        list = Jazz.MidiInList();
        for (name in list)
        {
            if (list.hasOwnProperty(name))
            {
                inputs.push(_createMIDIPort(name, "input", list[name]));
            }
        }
        //get outputs
        list = Jazz.MidiOutList();
        for (name in list)
        {
            if (list.hasOwnProperty(name))
            {
                outputs.push(_createMIDIPort(name, "output", list[name]));
            }
        }
    },

    // Cribbed from abudaan's JMB.init()
    // onSuccessCallback(MIDIAccess) sets the MIDIAccess variable in its own scope.
    // My onErrorCallback(error) currently throws an exception informing of the error. 
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
            onErrorCallback("No Jazz plugin detected, please visit http://jazzplugin.net");
        }
        else
        {
            alert("No Jazz plugin detected, please visit http://jazzplugin.net");
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
        if (!window.navigator.requestMIDIAccess)
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

    
