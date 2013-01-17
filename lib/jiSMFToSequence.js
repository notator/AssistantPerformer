/*
 *  copyright 2013 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  jiSMFToSequence.js
 *  The JI_NAMESPACE.smfToSequence
 */

JI_NAMESPACE.namespace('JI_NAMESPACE.smfToSequence');

JI_NAMESPACE.smfToSequence = (function ()
{
    "use strict";

    var 
    nsSequence = JI_NAMESPACE.sequence,

    // returns a Sequence.
    LoadStandardMIDIFile = function ()
    {
        return null;
    },

    publicAPI =
    {
        LoadStandardMIDIFile: LoadStandardMIDIFile
    };

    return publicAPI;

} ());

