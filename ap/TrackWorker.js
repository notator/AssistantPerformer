
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
velocityFactor,
sharedVelocity,
overrideVelocity,
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
	velocityFactor = 1;
	sharedVelocity = 0;
	overrideVelocity = 0;
	speedFactor = 1;
	trkStartTime = -1;
},

doNoteOff = function()
{
	"use strict";

	var noteOffOption = currentTrk.inputControls.noteOff;

	function setFade()
	{
		fadeLength = nAllMoments + 1 - momentIndex;
	}

	if(noteOffOption !== undefined)
	{
		switch(noteOffOption)
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
			default:
				throw (">>>>>>>>>> Illegal noteOff option: " + noteOffOption + " <<<<<<<<<<");
				break;
		}
	}
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
			if(uint8Array[0] >= 0x90 && uint8Array[0] <= 0x9F)
			{
				// a NoteOn
				newVelocity = uint8Array[2];
				if(velocityFactor !== 1)
				{
					newVelocity *= velocityFactor;
				}
				else if(sharedVelocity > 0)
				{
					newVelocity = (newVelocity / 2) + sharedVelocity;
				}
				else if(overrideVelocity > 0)
				{
					newVelocity = overrideVelocity;
				}

				if(fadeLength > 0)
				{
					newVelocity = (newVelocity * (nAllMoments + 1 - momentIndex) / fadeLength); // scale the velocity
				}

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
doNoteOn = function(velocity)
{
	"use strict";

	function setVelocityOption(velocityOption, minVelocity, velocity)
	{
		// This function returns an integer in range [minVelocity..127].
		// I have found, by experiment, that my E-MU keyboard never seems to send a velocity less than 20,
		// so this function first spreads the incoming range [20..127] to [0..127], then sets all velocities
		// less than minVelocity to minVelocity.
		function getCorrectedVelocity(velocity, minVelocity)
		{
			velocity = (velocity > 20) ? velocity - 20 : 0;
			velocity = Math.round(velocity * 1.1869); // 1.1869 is approximately 127 / 107;
			velocity = (velocity > minVelocity) ? velocity : minVelocity;
			velocity = (velocity < 127) ? velocity : 127;
			return velocity;
		}

		// Note that the returned velocityFactor is not an integer.
		function getVelocityFactor(velocity, minVelocity)
		{
			var velocityFactor;

			velocity = getCorrectedVelocity(velocity, minVelocity);
			velocityFactor = velocity / 64;

			return velocityFactor;
		}

		// The returned sharedVelocity is an integer.
		function getSharedVelocity(velocity, minVelocity)
		{
			var sharedVelocity;

			velocity = getCorrectedVelocity(velocity, minVelocity);
			sharedVelocity = Math.round(velocity / 2);

			return sharedVelocity;
		}

		velocityFactor = 1;
		sharedVelocity = 0;
		overrideVelocity = 0;
		switch(velocityOption)
		{
			case "scaled":
				velocityFactor = getVelocityFactor(velocity, minVelocity);
				break;
			case "shared":
				sharedVelocity = getSharedVelocity(velocity, minVelocity);
				break;
			case "overridden":
				overrideVelocity = getCorrectedVelocity(velocity, minVelocity);
				break;
			default:
				throw (">>>>>>>>>> Illegal velocity option: " + velocityOption + " <<<<<<<<<<");
				break;
		}
	}

	if(trkIndex < allTrks.length)
	{
		stopChord = false;
		stopNow = false;

		currentTrk = allTrks[trkIndex++];
		if(currentTrk.inputControls.noteOnVel !== undefined)
		{
			setVelocityOption(currentTrk.inputControls.noteOnVel, currentTrk.inputControls.minVelocity, velocity);
		}
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
			//    msg.inputControls; inputControls is an object containing only the necessary fields (no "off" values).
			allTrks.push(msg);
			break;
		case "stopNow":
			// console.log("worker received noteOn(): stopping immediately");
			stopNow = true;
			break;
		case "doNoteOn":
			doNoteOn(msg.velocity);
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

