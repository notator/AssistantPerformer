
/*jslint bitwise: true, nomen: true, plusplus: true, white: true, continue: true */
/*global _AP: false,  window: false,  document: false, performance: false, console: false, alert: false, postMessage: false, setTimeout: false */

var
channelIndex,

allTrks = [],
trkIndex = 0,
moments,
momentIndex,
inputControls,

isBusy = false,
stopImmediately = false, // used (to stop a playing trk) when handling a noteON
nAllMoments,
fadeLength = -1,

currentMoment = null, // nextMoment(), tick()
speedFactor = 1.0, // nextMoment(), setSpeedFactor()
trkStartTime = -1,  // set in doNoteOn(), used by nextMoment()

doNoteOff = function()
{
	"use strict";

	function setFade()
	{
		fadeLength = nAllMoments - momentIndex;
	}

	if(isBusy === true)
	{
		switch(inputControls.noteOff)
		{
			case "stop":
				stopImmediately = true;
				// console.log("doNoteOff: stopping a busy trkWorker immediately.");
				break;
			case "fade":
				// console.log("doNoteOff: setFade().");
				setFade();
				break;
			default:
				break; // "ignore" do nothing (allow the Seq to complete) 
		}
	}
	// stop according to the inputControls (set in "init"), possibly sending an all sound off...	
},

// Returns null when there are no more moments or global stopImmediately is true.
nextMoment = function()
{
	"use strict";
	var nextMomt = null;
	if(momentIndex < nAllMoments && stopImmediately === false)
	{
		nextMomt = moments[momentIndex++];
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

		if(moment.chordStart !== undefined)
		{
			// moments are given chordStart and restStart attributes, even though these are not currently used.
			console.log("chordStart found!");
		}

		for(i = 0; i < nMessages; ++i)
		{
			uint8Array = messages[i].data;
			if(fadeLength > 0 && uint8Array[0] >= 0x90 && uint8Array[0] <= 0x9F)
			{
				newVelocity = uint8Array[2] * (nAllMoments - momentIndex) / fadeLength; // scale the velocity
				// a NoteOn
				uint8Array = new Uint8Array([uint8Array[0], uint8Array[1], newVelocity]);
			}
			postMessage({ action: "midiMessage", midiMessage: uint8Array });
		}
	}

	function getDelay(moment)
	{
		return (moment.msPositionInSeq - (performance.now() - trkStartTime)) / speedFactor;
	}

	if(currentMoment === null || stopImmediately === true)
	{
		postMessage({ action: "resetChannel", channelIndex: channelIndex });
		return;
	}

	delay = getDelay(currentMoment);

	while(delay <= 0)
	{
		if(stopImmediately === true)
		{
			postMessage({ action: "resetChannel", channelIndex: channelIndex });
			return;
		}
		if(currentMoment.messages.length > 0) // rest moments can be empty
		{
			sendMessages(currentMoment);
		}

		currentMoment = nextMoment();

		if(currentMoment === null || stopImmediately === true)
		{
			postMessage({ action: "resetChannel", channelIndex: channelIndex });
			return;
		}

		delay = getDelay(currentMoment);
	}

	setTimeout(tick, delay);  // schedules the next tick.
},

// play the trk according to the inputControls (set in "pushTrk").
doNoteOn = function()
{
	"use strict";

	// if this assertion fails, increase the setTimeout delay in Seq.prototype.play()
	console.assert(isBusy === false);

	if(trkIndex < allTrks.length)
	{
		stopImmediately = false;

		moments = allTrks[trkIndex++].moments;
		nAllMoments = moments.length;
		momentIndex = 0;

		trkStartTime = performance.now();

		isBusy = true;
		currentMoment = nextMoment();
		if(currentMoment === null)
		{
			isBusy = false;
			return;
		}
		tick();
		isBusy = false;
	}
},

eventHandler = function(e)
{
	"use strict";

	var msg = e.data, trk;

	switch(msg.action)
	{
		case "init":
			channelIndex = msg.channelIndex;
			break;
		case "pushTrk":
			trk = {};
			trk.moments = msg.moments;
			trk.inputControls = msg.inputControls;
			allTrks.push(trk);
			break;
		case "stopImmediately":
			// console.log("worker received noteOn(): stopping immediately");
			stopImmediately = true;
			break;
		case "play":
			doNoteOn();
			break;
		case "stop":
			// console.log("worker received noteOff()");
			doNoteOff();
			break;
		case "setSpeedFactor":
			speedFactor = msg.factor;
			break;
	}
};

addEventListener("message", eventHandler);

