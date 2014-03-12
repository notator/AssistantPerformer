/*
*  Copyright 2012 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  midiLib/SequenceRecording.js
*  The MIDILib.sequence namespace which defines the
*
*       // The new sequenceRecording contains nTracks empty trackRecordings.
*       SequenceRecording(nTracks) sequence constructor. 
*
*  Public Interface (See longer descriptions in the code.):
*
*       // an array of TrackRecordings
*       trackRecordings *
*/

/*jslint bitwise: false, nomen: false, plusplus: true, white: true */


MIDILib.namespace('MIDILib.sequenceRecording');

MIDILib.sequenceRecording = (function ()
{
    "use strict";
    var
    TrackRecording = MIDILib.trackRecording.TrackRecording,

    // An empty sequenceRecording is created. It contains an empty array of MIDILib.trackRecording.TrackRecordings.
    SequenceRecording = function (nTracks)
    {
        var i;
        if (!(this instanceof SequenceRecording))
        {
            return new SequenceRecording(nTracks);
        }

        this.trackRecordings = []; // an array of TrackRecordings
        for (i = 0; i < nTracks; ++i)
        {
            this.trackRecordings.push(new TrackRecording());
        }
    },

    publicSequenceRecordingAPI =
    {
        // creates an empty sequenceRecording
        SequenceRecording: SequenceRecording
    };

    return publicSequenceRecordingAPI;

} ());



