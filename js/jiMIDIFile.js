/*
 *  copyright 2013 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  jiMIDIFile.js
 *  The JI_NAMESPACE.midiFile namespace containing two functions
 *      load(midiFileURI)   // loads the midi file into an ordinary javascript array of numbers.
 *                          // The array is at the base level in this namespace.
 *      
 *      download()          // downloads the array (set by load()) as a MIDI file. 
 */

JI_NAMESPACE.namespace('JI_NAMESPACE.midiFile');

JI_NAMESPACE.midiFile = (function ()
{
    "use strict";

    var midiArray = [], // the loaded and downloaded midiArray (a javascript array of numbers)

    // loads the midi file at midiURL into midiArray.
    load = function (midiURL)
    {
    },

    // downloads the midiArray as a MIDI file to the user's computer
    download = function ()
    {
    }

    // public API
    publicAPI =
    {
        load: load,
        download: download
    };

    return publicAPI;

} ());

