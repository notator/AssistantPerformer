/*
*  Copyright 2012 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  ap/Seq.js
*  The _AP.seq namespace containing:
* 
*		// Seq constructor
*       Seq(noteSeqTrks, inputControls, endMarkerMsPosInScore) 
*
* Functions (in prototype): 
*
*		// inputControls is the current state of the inputControls       
*       play(inputControls)
* 
*		// inputControls is the current state of the inputControls
*       stop(inputControls)  
*  
*		// sets the speed at which this Seq plays.     
*       setSpeedFactor(factor) 
*/

/*jslint bitwise: false, nomen: true, plusplus: true, white: true */
/*global _AP: false,  window: false,  document: false, performance: false, console: false, alert: false, XMLHttpRequest: false */


_AP.namespace('_AP.seq');

_AP.seq = (function()
{
	"use strict";
	var

	Seq = function(noteSeqTrks, inputControlsArg, endMarkerMsPosInScore)
	{
		var i, j, trk, midiObjects, trkMidiObjects;

		if(!(this instanceof Seq))
		{
			return new Seq(noteSeqTrks, inputControlsArg, endMarkerMsPosInScore);
		}

		this.trks = [];
		this.inputControls = {};

		for(i = 0; i < noteSeqTrks.length; ++i)
		{
			trk = new _AP.track.Track();
			midiObjects = [];
			trkMidiObjects = noteSeqTrks[i];
			for(j = 0; j < trkMidiObjects.length; ++j)
			{
				midiObjects.push(trkMidiObjects[j]);
			}
			trk.midiObjects = midiObjects;
			trk.setForOutputSpan(midiObjects[0].msPositionInScore, endMarkerMsPosInScore);

			this.trks.push(trk);
		}

		console.assert(inputControlsArg !== undefined, "inputControlArgs must be defined here");
		this.inputControls = inputControlsArg;
	},

	API =
	{
		Seq: Seq // constructor
	};
	// end var

	Seq.prototype.play = function(inputControls)
	{

	};

	Seq.prototype.stop = function(inputControls)
	{

	};

	Seq.prototype.setSpeedFactor = function(factor)
	{

	};

	return API;

}());




