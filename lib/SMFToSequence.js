/*
 *  copyright 2013 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  jiSMFToSequence.js
 *  The WEB_MIDI_LIB.smfToSequence
 */

WEB_MIDI_LIB.namespace('WEB_MIDI_LIB.smfToSequence');

WEB_MIDI_LIB.smfToSequence = (function ()
{
    "use strict";

    var 
    Sequence = WEB_MIDI_LIB.sequence.Sequence,

    // returns a Sequence.
    smfToSequence = function ()
    {
        // TODO
        return null;
    },

    publicAPI =
    {
        smfToSequence: smfToSequence
    };

    return publicAPI;

} ());

