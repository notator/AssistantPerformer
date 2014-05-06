/*
*  Copyright 2012 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  ap/Sequence.js
*  The _AP.sequence namespace which defines the
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

_AP.namespace('_AP.sequence');

_AP.sequence = (function (window)
{
    "use strict";
    var
    Track = _AP.track.Track,

    tracks = [], // an array of Tracks

    // An empty sequence is created. It contains an empty array of _AP.track.Tracks.
    init = function (nTracks)
    {
        var
        i;

        tracks.length = 0; // empty the tracks array without creating a new one!
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




