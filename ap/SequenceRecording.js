/*
*  Copyright 2012 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  ap/SequenceRecording.js
*  The _AP.sequence namespace which defines
*
*	   // The new sequenceRecording contains nTracks empty trackRecordings.
*	   SequenceRecording(nTracks) sequence constructor. 
*
*  Public Interface (See longer descriptions in the code.):
*
*	   // an array of TrackRecordings
*	   trackRecordings *
*/

/*jslint bitwise: false, nomen: false, plusplus: true, white: true */


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

	return publicSequenceRecordingAPI;

} ());



