
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
		// currentTrk = 0; initialised in start (from trkIndex)
		trkStartTime = -1;

		// currentTrk.moments
		// moments; initialized in pushTrk()
		momentIndex = 0;
		currentMoment = null;
		// nMoments; initialized in start (= currentTrk.moments.length)

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
	// trkWorker.postMessage({ action: "pushTrk", trk: trk });
	function pushTrk(msg)
	{
		// msg has the following attributes:
		//    msg.trk -- fields: trk.msPosition, trk.moments, trk.options
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

		if(msg.options && msg.options.pedal) // if undefined, do nothing
		{
			switch(msg.options.pedal)
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
					console.assert(false, "TrackWorker.pushTrk(): illegal option -- " + msg.options.pedal);
					break;
			}
		}

		allTrks.push(msg.trk);
	}

	// Seq.prototype.start calls:
	// worker.postMessage({ action: "start", velocity: performedVelocity });
	function start(msg)
	{
		var performedVelocity, minVelocity;

		console.assert(msg.velocity, "TrackWorker.start(msg): illegal msg");

		function _start()
		{
			// Used by tick and start.
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

			// Used by tick and _start.
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

		if(currentTrk.options && currentTrk.options.velocity)
		{
			velocityFactor = 1;
			sharedVelocity = 0;
			overrideVelocity = 0;
			performedVelocity = msg.velocity;
			minVelocity = currentTrk.options.minVelocity; // is defined if options.velocity is defined
			switch(currentTrk.options.velocity)
			{
				case "scaled":
					velocityFactor = getVelocityFactor(performedVelocity, minVelocity);
					break;
				case "shared":
					sharedVelocity = getSharedVelocity(performedVelocity, minVelocity);
					break;
				case "overridden":
					overrideVelocity = getCorrectedVelocity(performedVelocity, minVelocity);
					break;
				default:
					console.assert(false, "TrackWorker.doNoteOnVelocity(): illegal option -- " + currentTrk.options.velocity);
			}
		}
		_start();
	}

	/****************************************/

	// Keyboard1 calls either:
	// worker.postMessage({ action: "doController", controller: "pressure", value: data[1] });
	// or
	// worker.postMessage({ action: "doController", controller: "modWheel", value: data[2] });
	// Construct the midiMessage and then post it back. 
	function doController(msg)
	{
		var volumeValue, controller = msg.controller, value = msg.value, option;

		// argument is in range 0..127
		// returned value is in range currentTrk.options.minVolume..currentTrk.options.maxVolume.
		function getVolumeValue(value)
		{
			var range = currentTrk.options.maxVolume - currentTrk.options.minVolume,
			factor = range / 127,
			volumeValue = currentTrk.options.minVolume + (value * factor);
			return volumeValue;
		}

		option = (controller === "modWheel") ? currentTrk.options.modulation : currentTrk.options.pressure;

		switch(option)
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
				volumeValue = getVolumeValue(value);
				msg = new Message(CMD.CONTROL_CHANGE + channelIndex, CTL.VOLUME, volumeValue);
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

	/***************************************/

	// Keyboard1 calls:
	// worker.postMessage({ action: "doPitchWheel", data1: data[1], data2: data[2] });
	// case "doPitchWheel": */
	function doPitchWheel(msg)
	{
		var pitchWheelOption;

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

			pitchWheelDeviation = deviation;
		}

		function _doPitchWheel(data1, data2)
		{
			// currentTrk.options.pitchWheelDeviation is defined if currentTrack.options.pitchWheel is defined
			if(pitchWheelDeviation !== currentTrk.options.pitchWheelDeviation)
			{
				setPitchWheelDeviation(currentTrk.options.pitchWheelDeviation, channelIndex);
			}
			msg = new Message(CMD.PITCH_WHEEL + channelIndex, data1, data2);
			postMessage({ action: "midiMessage", midiMessage: msg });
		}

		function doPanOption(value)  // value is in range 0..127
		{
			var origin, factor, newValue;

			origin = currentTrk.options.panOrigin; // is defined if pitchWheelOption is "pan"
			if(value < 0x80)
			{
				factor = origin / 0x80;
				newValue = value * factor;
			}
			else
			{
				factor = (0xFF - origin) / 0x7F;
				newValue = origin + ((value - 0x80) * factor);
			}
			msg = new Message(CMD.CONTROL_CHANGE + channelIndex, CTL.PAN, newValue);
			postMessage({ action: "midiMessage", midiMessage: msg });
		}

		function doSpeedOption(value) // value is in range 0..127
		{
			var speedDeviation = currentTrk.options.speedDeviation, // a float value > 1.0F
			factor = Math.pwr(speedDeviation, 1 / 64);

			// e.g. if speedDeviation is 2
			// factor = 2^(1/64) = 1.01088...
			// value is in range 0..127.
			// if original value is 0, speedFactor = 1.01088^(-64) = 0.5
			// if original value is 64, speedfactor = 1.01088^(0) = 1.0
			// if original value is 127, speedFactor = 1.01088^(64) = 2.0 = maxSpeedFactor

			value -= 64; // if value was 64, speedfactor is 1.
			speedFactor = Math.pwr(factor, value);
			// nothing more to do! speedFactor is used in tick() to calculate delays.
		}

		pitchWheelOption = currentTrk.options.pitchWheel;

		switch(pitchWheelOption)
		{
			case "pitchWheel":
				_doPitchWheel(msg.data1, msg.data2);
				break;
			case "pan":
				doPanOption(msg.data1);  // data1, the hi byte, is in range 0..127
				break;
			case "speed":
				doSpeedOption(msg.data1); // data1, the hi byte, is in range 0..127
				break;
		}
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

		case "start":
			start(msg);
			break;

		// called by changes to channel pressure or modWheel controls 
		case "doController":
			doController(msg);
			break;

		// called by changes to pitchWheel
		case "doPitchWheel":
			doPitchWheel(msg);
			break;

		case "stop":
			doNoteOff(msg.trkOff);
			break;
	}
};

addEventListener("message", eventHandler);

