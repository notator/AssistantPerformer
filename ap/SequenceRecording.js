/*
*  Copyright 2012 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  ap/SequenceRecording.js
*  The _AP.sequenceRecording namespace which defines
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
/*global _AP: false,  window: false,  document: false, performance: false, console: false, alert: false, XMLHttpRequest: false */


_AP.namespace('_AP.sequenceRecording');

_AP.sequenceRecording = (function ()
{
    "use strict";
    var
    TrackRecording = _AP.trackRecording.TrackRecording,

    // An empty sequenceRecording is created. It contains an empty array of _AP.trackRecording.TrackRecordings.
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

	// The data argument is a Uint8Array 
    SequenceRecording.prototype.addLiveMessage = function(data, timestamp)
    {
    	var trackIndex = data[0] & 0xF,
    		message;
		
    	switch(data.length)
    	{
    		case 1:
    			message = new _AP.message.Message(data[0]);
    			break;
    		case 2:
    			message = new _AP.message.Message(data[0], data[1]);
    			break;
    		case 3:
    			message = new _AP.message.Message(data[0], data[1], data[2]);
    			break;
    	}
    	this.trackRecordings[trackIndex].addLiveMessage(message, timestamp);
    };

    return publicSequenceRecordingAPI;

} ());



