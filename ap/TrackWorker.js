
/*jslint bitwise: true, nomen: true, plusplus: true, white: true, continue: true */
/*global _AP: false,  window: false,  document: false, performance: false, console: false, alert: false, postMessage: false, setTimeout: false */

var
trackIndex,
channelIndex,

allTrks,
trkIndex,
currentTrk,
trkStartTime,

// currentTrk.moments
moments,
momentIndex,
currentMoment,
nAllMoments,

// private, can be set at runtime
stopChord,
stopNow,
fadeLength,
speedFactor,

init = function(trackIndexArg, channelIndexArg)
{
	"use strict";

	trackIndex = trackIndexArg;
	channelIndex = channelIndexArg;
	allTrks = [];
	trkIndex = 0;
	momentIndex = 0;
	stopChord = false;
	stopNow = false;
	fadeLength = -1;
	currentMoment = null;
	speedFactor = 1.0;
	trkStartTime = -1;
},

doNoteOff = function()
{
	"use strict";

	function setFade()
	{
		fadeLength = nAllMoments + 1 - momentIndex;
	}

	switch(currentTrk.inputControls.noteOff)
	{
		case "stopChord":
			stopChord = true; // stop playing the trk at the following midiChord or midiRest.
			break;
		case "stopNow":
			stopNow = true; // stop immediately, without playing the remainder of the current midiChord or midiRest.
			break;
		case "fade":
			setFade(); // fade the velocity to zero at the end of the trk
			break;
		case "shortFade":
			// console.log("doNoteOff: setFade().");
			// setShortFade();
			break;
		case "ignore":
			break; // "ignore" do nothing (allow the Seq to complete)
		default:
			break; // "ignore" do nothing (allow the Seq to complete)
	}

	// stop according to the inputControls (set in "init"), possibly sending an all sound off...	
},

// Returns null when there are no more moments, or global stopNow is true, or (stopChord is true and we have reached the next midiObject).
nextMoment = function()
{
	"use strict";
	var nextMomt = null;
	if(momentIndex < moments.length && stopNow === false)
	{
		nextMomt = moments[momentIndex++];
		if(stopChord && momentIndex > 1 && (nextMomt.chordStart !== undefined || nextMomt.RestStart !== undefined))
		{
			nextMomt = null; // stop at this chord or rest
		}
	}
	return nextMomt; // null stops tick().
},

tick = function()
{
	"use strict";
	var delay;

	function trkCompleted()
	{
		var isLastTrk;
		
		isLastTrk = (trkIndex === allTrks.length);

		if(isLastTrk === false)
		{
			postMessage({ action: "trkCompleted", channelIndex: channelIndex });
		}
		else
		{
			postMessage({ action: "workerCompleted", trackIndex: trackIndex, channelIndex: channelIndex });
		}
	}

	function sendMessages(moment)
	{
		var
        messages = moment.messages,
        i, nMessages = messages.length,
        newVelocity, uint8Array;

		for(i = 0; i < nMessages; ++i)
		{
			uint8Array = messages[i].data;
			if(fadeLength > 0 && uint8Array[0] >= 0x90 && uint8Array[0] <= 0x9F)
			{
				// a NoteOn
				newVelocity = (uint8Array[2] * (nAllMoments + 1 - momentIndex) / fadeLength); // scale the velocity
				newVelocity = (newVelocity > 127) ? 127 : newVelocity | 0; // | 0 truncates to an int
				uint8Array = new Uint8Array([uint8Array[0], uint8Array[1], newVelocity]);
				//console.log("Changed velocity = " + newVelocity);
			}
			postMessage({ action: "midiMessage", midiMessage: uint8Array });
		}
	}

	function getDelay(moment)
	{
		return (moment.msPositionInSeq - (performance.now() - trkStartTime)) / speedFactor;
	}

	if(currentMoment === null || stopNow === true)
	{
		trkCompleted();
		return;
	}

	delay = getDelay(currentMoment);

	while(delay <= 0)
	{
		if(stopNow === true)
		{
			trkCompleted();
			return;
		}
		if(currentMoment.messages.length > 0) // rest moments can be empty
		{
			sendMessages(currentMoment);
		}

		currentMoment = nextMoment();

		if(currentMoment === null || stopNow === true)
		{
			trkCompleted();
			return;
		}

		delay = getDelay(currentMoment);
	}

	setTimeout(tick, delay);  // schedules the next tick.
},

// play the trk according to its inputControls (set in "pushTrk").
doNoteOn = function()
{
	"use strict";

	if(trkIndex < allTrks.length)
	{
		stopChord = false;
		stopNow = false;

		currentTrk = allTrks[trkIndex++];
		moments = currentTrk.moments;
		nAllMoments = moments.length;
		momentIndex = 0;

		trkStartTime = performance.now();

		currentMoment = nextMoment();
		if(currentMoment === null)
		{
			return;
		}
		tick();
	}
},

eventHandler = function(e)
{
	"use strict";

	var msg = e.data;

	switch(msg.action)
	{
		case "init":
			init(msg.trackIndex, msg.channelIndex);
			break;
		case "pushTrk":
			// msg (=trk) has the following attributes:
			//    msg.moments;
			//    msg.inputControls;
			allTrks.push(msg);
			break;
		case "stopNow":
			// console.log("worker received noteOn(): stopping immediately");
			stopNow = true;
			break;
		case "doNoteOn":
			doNoteOn();
			break;
		case "doNoteOff":
			// console.log("worker received doNoteOff()");
			doNoteOff();
			break;
		case "setSpeedFactor":
			speedFactor = msg.factor;
			break;
	}
};

addEventListener("message", eventHandler);

