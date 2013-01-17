/*
 *  copyright 2013 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  jiJazzWebMIDI.js
 *  The JI_NAMESPACE.webMIDI namespace which exposes the Web MIDI API, implementing it using the Jazz plugin.
 *  
 *  The Web MIDI API is defined in the latest version of
 *      https://dvcs.w3.org/hg/audio/raw-file/tip/midi/specification.html#examples-of-web-midi-api-usage-in-javascript
 *  This file will be continuously updated to reflect any changes there.
 *
 *  This implementation owes a lot to
 *      abudaan's JazzMIDIBridge: https://github.com/abudaan/JazzMIDIBridge
 *      and Chris Wilson's WebMIDIAPIShim: https://github.com/cwilso/WebMIDIAPIShim
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
 *          attributes: id
 *                      manufacturer
 *                      name
 *                      type
 *                      version
 *      MIDIInput
 *          attributes: onmessage
 *
 *      MIDIOutput
 *          attributes: send
 *
 *      MIDIEvent
 *          attributes: timestamp
 *                      data
 *            
 */

JI_NAMESPACE.namespace('JI_NAMESPACE.webMIDI');

JI_NAMESPACE.webMIDI = (function (navigator)
{
    "use strict";
    var
    MIDIAccess = function ()
    {
    },
    MIDIPort = function ()
    {
    },
    MIDIInput = function ()
    {
    },
    MIDIOutput = function ()
    {
    },
    MIDIEvent = function ()
    {
    },
    API =
    {
        MIDIAccess: MIDIAccess,
        MIDIPort: MIDIPort,
        MIDIInput: MIDIInput,
        MIDIInput: MIDIInput,
        MIDIInput: MIDIInput
    };

    return API;

} ());

    
