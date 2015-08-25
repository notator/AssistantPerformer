
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
holdOption,
stopHold,
fadeLength,
velocityFactor,
sharedVelocity,
overrideVelocity,
speedFactor,

init = function(trackIndexArg)
{
	"use strict";

	trackIndex = trackIndexArg;
	channelIndex = trackIndex; // ! ji 25.08.2015
	allTrks = [];
	trkIndex = 0;
	momentIndex = 0;
	stopChord = false;
	stopNow = false;
	holdOption = false;
	stopHold = false;
	fadeLength = -1;
	currentMoment = null;
	velocityFactor = 1;
	sharedVelocity = 0;
	overrideVelocity = 0;
	speedFactor = 1;
	trkStartTime = -1;
},

trkCompleted = function()
{
	"use strict";

	if(!holdOption || stopHold)
	{
		if(trkIndex < (allTrks.length))
		{
			postMessage({ action: "trkCompleted", channelIndex: channelIndex });
		}
		else
		{
			postMessage({ action: "workerCompleted", trackIndex: trackIndex, channelIndex: channelIndex });
		}
	}
},

doNoteOff = function()
{
	"use strict";

	var noteOffOption = currentTrk.inputControls.noteOff;

	function setFade()
	{
		fadeLength = nAllMoments + 1 - momentIndex;
	}

	function doStopHold()
	{
		stopHold = true;
		if(currentMoment === null)
		{
			trkCompleted(); // silence the trk
		}
		else
		{
			stopNow = true;  // stop immediately, without playing the remainder of the current midiChord or midiRest.
		}
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
			case "holdAll":
				doStopHold();
				break;
			case "holdLast":
				doStopHold();
				break;
			default:
				throw (">>>>>>>>>> Illegal noteOff option: " + noteOffOption + " <<<<<<<<<<");
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
				uint8Array[2] = newVelocity;
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

		holdOption = (currentTrk.inputControls.noteOff === "holdAll" || currentTrk.inputControls.noteOff === "holdLast");
		stopHold = false;		

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

	function messageIsNoteOff(message)
	{
		var data0, rval = false;

		data0 = message.data[0];
		if(((data0 >= 0x90 && data0 <= 0x9F) && message.data[1] === 0) // NoteOn, velocity 0
		|| (data0 >= 0x80 && data0 <= 0x8F)) // NoteOff
		{
			rval = true;
		}

		return rval;
	}

	function removeNoteOffMessages(moment)
	{
		var i, newMessages = [], oldMessages = moment.messages;

		for(i = 0; i < oldMessages.length; ++i)
		{
			if(!messageIsNoteOff(oldMessages[i]))
			{
				newMessages.push(oldMessages[i]);
			}
		}
		moment.messages = newMessages;
	}

	// Removes all noteOff messages from the final moment that contains any.
	function removeFinalNoteOffMessages(msg)
	{
		var
		i,
		lastNoteOffMomentIndex = msg.moments.length, // an impossible value
		moments = msg.moments;

		function momentContainsNoteOffMessage(moment)
		{
			var i, messages = moment.messages, rval = false;

			for(i = 0; i < messages.length; ++i)
			{
				if(messageIsNoteOff(messages[i]))
				{
					rval = true;
					break;
				}
			}
			return rval;
		}

		for(i = moments.length - 1; i > 0; --i)
		{
			if(momentContainsNoteOffMessage(moments[i]))
			{
				lastNoteOffMomentIndex = i;
				break;
			}
		}

		if(lastNoteOffMomentIndex < moments.length)
		{
			removeNoteOffMessages(moments[lastNoteOffMomentIndex]);
		}
	}

	function removeAllNoteOffMessages(msg)
	{
		var i, moments = msg.moments;

		for(i=0; i < moments.length;++i)
		{
			removeNoteOffMessages(moments[i]);
		}
	}

	// Set the data argument's channel (the low nibble of data[0]) to this worker's channel,
	// then post the data back as a midiMessage. 
	function doController(data)
	{
		data[0] &= 0xF0;
		data[0] += channelIndex;
		postMessage({ action: "midiMessage", midiMessage: data });
	}

	switch(msg.action)
	{
		case "init":
			init(msg.trackIndex);
			break;
		case "pushTrk":
			// msg (=trk) has the following attributes:
			//    msg.moments;
			//    msg.inputControls; inputControls is an object containing only the necessary fields (no "off" values).
			allTrks.push(msg);
			if(msg.inputControls.noteOff === "holdLast")
			{
				removeFinalNoteOffMessages(msg);
			}
			if(msg.inputControls.noteOff === "holdAll")
			{
				removeAllNoteOffMessages(msg);
			}
			break;
		case "doNoteOn":
			doNoteOn(msg.velocity);
			break;
		case "doNoteOff":
			doNoteOff();
			break;
		case "doController":
			doController(msg.data);
			break;
		case "setSpeedFactor":
			speedFactor = msg.factor;
			break;
	}
};

addEventListener("message", eventHandler);

