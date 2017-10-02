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

_AP.namespace('_AP.sequenceRecording');

_AP.sequenceRecording = (function ()
{
    "use strict";
    var
    TrackRecording = _AP.trackRecording.TrackRecording,

    // An empty sequenceRecording is created.
	// It has an array of empty _AP.trackRecording.TrackRecording objects allocated per channel index.
	// Note that the trackRecordings.length will always be maximum channel index + 1, but that the array
	// can contain undefined members (e.g. if the outputTracks argument contains a single track in channel 2).
    SequenceRecording = function (outputTracks)
    {
    	let i, j, channel, nOutputTracks = outputTracks.length;

        if (!(this instanceof SequenceRecording))
        {
        	return new SequenceRecording(outputTracks);
        }

        this.trackRecordings = [];
        for(i = 0; i < nOutputTracks; ++i)
        {
        	for(j = 0; j < outputTracks[i].midiObjects.length; ++j)
        	{
        		if(outputTracks[i].midiObjects[j].moments[0].messages.length > 0)
        		{
        			channel = outputTracks[i].midiObjects[j].moments[0].messages[0].channel();
        			break;
        		}
        	}
            this.trackRecordings[channel] = new TrackRecording();
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
    	var channelIndex = data[0] & 0xF,
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
    	this.trackRecordings[channelIndex].addLiveMessage(message, timestamp);
    };

    return publicSequenceRecordingAPI;

} ());



