
/*jslint bitwise: true, nomen: true, plusplus: true, white: true, continue: true */
/*global _AP: false,  window: false,  document: false, performance: false, console: false, alert: false, postMessage: false, setTimeout: false */

/****************************************/
// Aug. 2015
var eventHandler = function(e)
{
	"use strict";

	var msg = e.data,

	CMD = _AP.constants.COMMAND,
	CTL = _AP.constants.CONTROL,
	Message = _AP.message.Message,

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
	nMoments,

	// runtime variables
	stopChord,
	stopNow,
	fadeLength,
	letSound,
	velocityFactor,
	sharedVelocity,
	overrideVelocity,
	speedFactor,

	pitchWheelDeviation;

	// Keyboard1 sends:
	// worker.postMessage({ action: "init", trackIndex: i, channelIndex: outputTrackMidiChannels[i] });
	function init(msg)
	{
		console.assert(msg.trackIndex && msg.channelIndex, "TrackWorker.init(): illegal msg");

		trackIndex = msg.trackIndex;
		channelIndex = msg.channelIndex;

		allTrks = [];
		trkIndex = 0;
		// currentTrk = 0; initialised in doNoteOn (from trkIndex)
		trkStartTime = -1;

		// currentTrk.moments
		// moments; initialized in pushTrk()
		momentIndex = 0;
		currentMoment = null;
		// nMoments; initialized in doNoteOn (= currentTrk.moments.length)

		// runtime variables
		stopChord = false;
		stopNow = false;
		fadeLength = -1;
		letSound = false;
		velocityFactor = 1;
		sharedVelocity = 0;
		overrideVelocity = 0;
		speedFactor = 1;
		pitchWheelDeviation = 2; // 2 semitones up, and 2 semitones down
	}

	/****************************************/
	// Seq constructor sends:
	// trkWorker.postMessage({ action: "pushTrk", trk: trk, pedalOption: pedalOption });
	function pushTrk(msg)
	{
		// msg has the following attributes:
		//    msg.trk -- fields: trk.msPosition and trk.moments
		//    msg.pedalOption -- trkOptions.pedal (do nothing if undefined)
		console.assert(msg.trk, "TrackWorker.pushTrk(): illegal msg");

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
		function removeFinalNoteOffMessages(moments)
		{
			var
			i,
			lastNoteOffMomentIndex = moments.length; // an impossible value

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

		function removeAllNoteOffMessages(moments)
		{
			var i;

			for(i = 0; i < moments.length; ++i)
			{
				removeNoteOffMessages(moments[i]);
			}
		}

		if(msg.pedalOption) // if undefined, do nothing
		{
			switch(msg.pedalOption)
			{
				case "holdLast":
					removeFinalNoteOffMessages(msg.trk.moments);
					letSound = true;
					break;
				case "holdAll":
					removeAllNoteOffMessages(msg.trk.moments);
					letSound = true;
					break;
				case "holdAllStop":
					removeAllNoteOffMessages(msg.trk.moments);
					letSound = false;
					break;
				default:
					console.assert(false, "TrackWorker.pushTrk(): illegal option -- " + msg.pedalOption);
					break;
			}
		}

		allTrks.push(msg.trk);
	}

	function doNoteOn()
	{
		// Used by tick and doNoteOn.
		// Returns null when there are no more moments, or global stopNow is true, or (stopChord is true and we have reached the next midiObject).
		function nextMoment()
		{
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
		}

		// Used by tick and doNoteOn.
		function tick()
		{
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
							newVelocity = (newVelocity * (nMoments + 1 - momentIndex) / fadeLength); // scale the velocity
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

			function trkCompleted(letSound)
			{
				if(trkIndex < (allTrks.length))
				{
					postMessage({ action: "trkCompleted", channelIndex: channelIndex, letSound: letSound });
				}
				else
				{
					postMessage({ action: "workerCompleted", trackIndex: trackIndex, channelIndex: channelIndex, letSound: letSound });
				}
			}

			if(currentMoment === null || stopNow === true)
			{
				trkCompleted(letSound);
				return;
			}

			delay = getDelay(currentMoment);

			while(delay <= 0)
			{
				if(stopNow === true)
				{
					trkCompleted(letSound);
					return;
				}
				if(currentMoment.messages.length > 0) // rest moments can be empty
				{
					sendMessages(currentMoment);
				}

				currentMoment = nextMoment();

				if(currentMoment === null || stopNow === true)
				{
					trkCompleted(letSound);
					return;
				}

				delay = getDelay(currentMoment);
			}

			setTimeout(tick, delay);  // schedules the next tick.
		}

		if(trkIndex < allTrks.length)
		{
			stopChord = false;
			stopNow = false;

			currentTrk = allTrks[trkIndex++];

			moments = currentTrk.moments;
			nMoments = moments.length;
			momentIndex = 0;

			trkStartTime = performance.now();

			currentMoment = nextMoment();
			if(currentMoment === null)
			{
				return;
			}
			tick();
		}
	}

	function doNoteOnVelocity(msg)
	{
		console.assert(msg.velocityOption && msg.minVelocity && msg.velocity, "TrackWorker.doNoteOn(): illegal msg");

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
		switch(msg.velocityOption)
		{
			case "scaled":
				velocityFactor = getVelocityFactor(msg.velocity, msg.minVelocity);
				break;
			case "shared":
				sharedVelocity = getSharedVelocity(msg.velocity, msg.minVelocity);
				break;
			case "overridden":
				overrideVelocity = getCorrectedVelocity(msg.velocity, msg.minVelocity);
				break;
			default:
				console.assert(false, "TrackWorker.doNoteOnVelocity(): illegal option -- " + msg.velocityOption);
		}

		doNoteOn();
	}

	/****************************************/

	// Construct the midiMessage and then post it back. 
	function doController(controller, value)
	{
		var msg;

		switch(controller)
		{
			case "aftertouch":	// Note that this option results in channelPressure messages!
				msg = new Message(CMD.CHANNEL_PRESSURE + channelIndex, value);
				break;
			case "channelPressure":
				msg = new Message(CMD.CHANNEL_PRESSURE + channelIndex, value);
				break;
			case "modulation":
				msg = new Message(CMD.CONTROL_CHANGE + channelIndex, CTL.MODWHEEL, value);
				break;
			case "volume":
				msg = new Message(CMD.CONTROL_CHANGE + channelIndex, CTL.VOLUME, value);
				break;
			case "pan":
				msg = new Message(CMD.CONTROL_CHANGE + channelIndex, CTL.PAN, value);
				break;
			case "expression":
				msg = new Message(CMD.CONTROL_CHANGE + channelIndex, CTL.EXPRESSION, value);
				break;
			case "timbre":
				msg = new Message(CMD.CONTROL_CHANGE + channelIndex, CTL.TIMBRE, value);
				break;
			case "brightness":
				msg = new Message(CMD.CONTROL_CHANGE + channelIndex, CTL.BRIGHTNESS, value);
				break;
			case "effects":
				msg = new Message(CMD.CONTROL_CHANGE + channelIndex, CTL.EFFECTS, value);
				break;
			case "tremolo":
				msg = new Message(CMD.CONTROL_CHANGE + channelIndex, CTL.TREMOLO, value);
				break;
			case "chorus":
				msg = new Message(CMD.CONTROL_CHANGE + channelIndex, CTL.CHORUS, value);
				break;
			case "celeste":
				msg = new Message(CMD.CONTROL_CHANGE + channelIndex, CTL.CELESTE, value);
				break;
			case "phaser":
				msg = new Message(CMD.CONTROL_CHANGE + channelIndex, CTL.PHASER, value);
				break;
		}

		postMessage({ action: "midiMessage", midiMessage: msg });
	}

	function doControllerVolume(minVolume, maxVolume, value)
	{
		value = (value < minVolume) ? minVolume : value;
		value = (value > maxVolume) ? maxVolume : value;

		doController("volume", value);
	}

	/***************************************/
	/* case "doPitchWheel": */
	function doPitchWheel(pitchWheelMessage)
	{
		// pitchWheelMessage has fields:
		//   action
		//   midiMessage -- the original pitchWheel message (a Uint8Array)
		//   parameter -- "pitch", "pan" or "speed" (here "pitch")
		//   deviation
		var msg, inMessage = pitchWheelMessage.midiMessage;

		/// Sets both RegisteredParameter controls to 0 (zero). This is standard MIDI for selecting the
		/// pitch wheel so that it can be set by the subsequent DataEntry messages.
		/// A DataEntryFine message is not set, because it is not needed and has no effect anyway.
		/// However, RegisteredParameterFine MUST be set, otherwise the messages as a whole have no effect!
		function setPitchWheelDeviation(deviation, channel)
		{
			var msg;
			msg = new Message(CMD.CONTROL_CHANGE + channel, CTL.REGISTERED_PARAMETER_COARSE, 0);
			postMessage({ action: "midiMessage", midiMessage: msg });
			msg = new Message(CMD.CONTROL_CHANGE + channel, CTL.REGISTERED_PARAMETER_FINE, 0);
			postMessage({ action: "midiMessage", midiMessage: msg });
			msg = new Message(CMD.CONTROL_CHANGE + channel, CTL.DATA_ENTRY_COARSE, deviation);
			postMessage({ action: "midiMessage", midiMessage: msg });
		}

		if(pitchWheelDeviation !== pitchWheelMessage.deviation)
		{
			setPitchWheelDeviation(pitchWheelMessage.deviation, channelIndex);
			pitchWheelDeviation = pitchWheelMessage.deviation;
		}

		msg = new Message(CMD.PITCH_WHEEL + channelIndex, inMessage[1], inMessage[2]);
		postMessage({ action: "midiMessage", midiMessage: msg });
	}

	function doPan(pitchWheelMessage)
	{
		// pitchWheelMessage has fields:
		//   action
		//   midiMessage -- the original pitchWheel message (a Uint8Array)
		//   parameter -- "pitch", "pan" or "speed" (here "pan")
		//   deviation
		var msg, newValue, factor,
		inValue = pitchWheelMessage.midiMessage[1], // only need the hi byte
		origin = pitchWheelMessage.deviation;

		if(inValue < 0x80)
		{
			factor = origin / 0x80;
			newValue = inValue * factor;
		}
		else 
		{
			factor = (0xFF - origin) / 0x7F;
			newValue = origin + ((inValue - 0x80) * factor);
		}

		msg = new Message(CMD.CONTROL_CHANGE + channelIndex, CTL.PAN, newValue);
		postMessage({ action: "midiMessage", midiMessage: msg });
	}

	function doSpeed(pitchWheelMessage)
	{
		// pitchWheelMessage has fields:
		//   action
		//   midiMessage -- the original pitchWheel message (a Uint8Array)
		//   parameter -- "pitch", "pan" or "speed" (here "speed")
		//   deviation -- here a float > 1.0F
		var value = pitchWheelMessage.midiMessage[1], // only need the hi byte
		maxSpeedFactor = pitchWheelMessage.deviation, // a float value > 1.0F
		factor = Math.pwr(maxSpeedFactor, 1 / 64);

		value -= 64; // if value was 64, speedfactor is 1.
		speedFactor = Math.pwr(factor, value);
		// nothing more to do! speedFactor is used in tick() to calculate delays.

		// e.g. if maxSpeedFactor is 2
		// factor = 2^(1/64) = 1.01088...
		// value is in range 0..127.
		// if original value is 0, speedFactor = 1.01088^(-64) = 0.5
		// if original value is 64, speedfactor = 1.01088^(0) = 1.0
		// if original value is 127, speedFactor = 1.01088^(64) = 2.0 = maxSpeedFactor
	}

	/****************************************/
	/* case "doNoteOff": */
	// Aug. 2015
	function doNoteOff()
	{
		var noteOffOption = currentTrk.trkOptions.noteOff;

		function setFade()
		{
			fadeLength = nMoments + 1 - momentIndex;
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
			}
		}
	}

	// begin eventHandler code

	switch(msg.action)
	{
		case "init":
			init(msg);
			break;

		case "pushTrk":
			pushTrk(msg);
			break;

		case "doNoteOn":
			doNoteOn();
			break;
		case "doNoteOnVelocity":
			doNoteOnVelocity(msg);
			break;

		// called by changes to pressure and modWheel (when not controlling Volume)
		case "doController":
			doController(msg.controller, msg.value);
			break;
		// called by changes to pressure, and modWheel, when controlling Volume
		case "doControllerVolume":
			doControllerVolume(msg.volumeValue, msg.minVolume, msg.maxVolume);
			break;

		// called by changes to pitchWheel
		// pwMessage has fields:
		//   action (here "doPitchWheel")
		//   midiMessage -- the original pitchWheel message (a 3 byte Uint8Array)
		//   parameter -- "pitch", "pan" or "speed"
		//   deviation -- meaning depends on parameter
		case "doPitchWheel":
			switch(msg.parameter)
			{
				case "pitch":
					doPitchWheel(msg);
					break;
				case "pan":
					doPan(msg);
					break;
				case "speed":
					doSpeed(msg);
					break;
			}
			break;

		case "doNoteOff":
			doNoteOff(msg.trkOff);
			break;
	}
};

addEventListener("message", eventHandler);

