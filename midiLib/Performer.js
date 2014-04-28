/*
*  copyright 2014 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  ap/Performer.js
*  The _AP.performer namespace which defines
*    Performer() [constructor]
*    currentSegmentBounds() returns an object contining the start and end positions of the performer's current segment
*    handleMIDIInputEvent(msg) [message handler for input devices]. 
*/

/*jslint bitwise: true, nomen: true, plusplus: true, white: true */

MIDILib.namespace('MIDILib.performer');

MIDILib.performer = (function()
{
    "use strict";

    // begin var
    var
    performersMsPositionsInScoreIndex = 0, // the current index in the following array (updated when a NoteOn is received)
    performersMsPositionsInScore, // a flat, ordered array containing the msPositions of the performer's MidiObjects -- set in init(...).

    // This function is ALWAYS called (by Sequence.play()), even if there is no input device set in
    // the input device selector. If there is no live performer (performersTrackIndex is then set to
    // null), performersMsPositionsInScore will contains just two values: the startMarkerMsPosition
    // and endMarkerMsPosition. Otherwise it contains all the performer's midiObject.msPositionInScore
    // values that are >= startMarkerMsPosition and <= endMarkerMsPosition.
    init = function(performersTrackIndex, tracks, startMarkerMsPosition, endMarkerMsPosition)
    {
        var
        i,
        midiObjects,
        positions = [];

        if(performersTrackIndex === null)
        {
            // There is no live performer
            positions.push(startMarkerMsPosition);
            positions.push(endMarkerMsPosition);
        }
        else if(performersTrackIndex >= 0 && performersTrackIndex < tracks.length)
        {
            midiObjects = tracks[performersTrackIndex].midiObjects;
            for(i = 0; i < midiObjects.length; ++i)
            {
                if(midiObjects[i].msPositionInScore >= startMarkerMsPosition)
                {
                    positions.push(midiObjects[i].msPositionInScore);
                }
                if(midiObjects[i].msPositionInScore === endMarkerMsPosition)
                {
                    break;
                }
            }
        }
        else
        {
            throw "Error: Illegal performer's track index!";
        }

        performersMsPositionsInScore = positions;
    },

    currentSegmentBounds = function()
    {
        var bounds = { "msStartPositionInScore": performersMsPositionsInScore[0], "msEndPositionInScore": performersMsPositionsInScore[1] };
        return bounds;
    },

    publicAPI =
    {
        init: init,
        currentSegmentBounds: currentSegmentBounds
    };
    // end var

    return publicAPI;

}());
