/*
*  Copyright 2012 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  midiLib/Sequence.js
*  The MIDILib.sequence namespace which defines the
*
*       // The namespace variable tracks is set to contain nTracks empty tracks.
*       init(nTracks) sequence constructor. 
*
*  Public Interface:
*
*       // an array of Tracks
*       tracks
*/

/*jslint bitwise: false, nomen: false, plusplus: true, white: true */

MIDILib.namespace('MIDILib.sequence');

MIDILib.sequence = (function (window)
{
    "use strict";
    var
    Track = MIDILib.track.Track,

    tracks = [], // an array of Tracks

    // An empty sequence is created. It contains an empty array of MIDILib.track.Tracks.
    init = function (nTracks)
    {
        var i;

        for(i = 0; i < nTracks; ++i)
        {
            tracks.push(new Track());
        }
    },

    publicAPI =
    {
        init: init,
        tracks: tracks
    };

    return publicAPI;

} ());




