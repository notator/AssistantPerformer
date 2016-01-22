
/*jslint bitwise: true, nomen: true, plusplus: true, white: true, continue: true */
/*global _AP: false,  window: false,  document: false, performance: false, console: false, alert: false, postMessage: false, setTimeout: false */

var
trackIndex,
channelIndex,

allTrks,
trkIndex,
currentTrk,

// currentTrk.moments
moments,
momentIndex,
currentMoment,
nMoments,

// runtime variables
pressureOption,
pitchWheelOption,
modWheelOption,
stopChord,
stopNow,
fadeLength,
letSound,
velocityFactor,
sharedVelocity,
overrideVelocity,
speedFactor,

pitchWheelDeviation,

/****************************************/
// Aug. 2015
eventHandler = function(e)
{
	"use strict";

	var msg = e.data;

	// Keyboard1 sends:
	// worker.postMessage({ action: "init", trackIndex: i, channelIndex: outputTrackMidiChannels[i] });
	function init(msg)
	{
		console.assert(msg.trackIndex !== undefined && msg.trackIndex >= 0 && msg.trackIndex < 16);
		console.assert(msg.channelIndex !== undefined && msg.channelIndex >= 0 && msg.channelIndex < 16);

		trackIndex = msg.trackIndex;
		channelIndex = msg.channelIndex;

		allTrks = [];
		trkIndex = 0;
		//currentTrk = 0; initialised in start (from trkIndex)

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
	// worker.postMessage({ action: "pushTrk", msPosition: msPosition, moments: moments, options: options });
	// Set a new trk object's attributes to msPosition, moments and options,
	// then add it to the allTrks array maintaining the allTrks array in order of msPosition.
	// The options attribute is always a defined object, but it need not have any attributes.
	function pushTrk(msg)
	{
		var insertAtIndex,
			msPosition = msg.msPosition,
			moments = msg.moments,
			options = msg.options,
			trk = {};

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
			var	i, lastNoteOffMomentIndex = moments.length; // an impossible value

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

		function findInsertionIndex(currentTrks, msPosition)
		{
			var i, nTrks = currentTrks.length, insIndex = nTrks;

			if(nTrks > 0 && currentTrks[nTrks - 1].msPosition > msPosition)
			{
				if(currentTrks[0].msPosition < msPosition)
				{
					for(i = nTrks - 1; i >= 1; --i)
					{
						console.assert(currentTrks[i].msPosition !== msPosition,
							"Error in TrackWorker.pushTrk(): Attempt to push a trk at an existing position!");
						if((currentTrks[i - 1].msPosition < msPosition) && (currentTrks[i].msPosition > msPosition))
						{
							insIndex = i;
							break;
						}
					}
				}
				else
				{
					insIndex = 0;
				}
			}

			return insIndex;
		}

		console.assert(options !== undefined, "Error: options must be a defined object here (but it need not have any attributes).");

		if(options.pedal) // if undefined, do nothing
		{
			switch(options.pedal)
			{
				case "holdLast":
					removeFinalNoteOffMessages(moments);
					letSound = true;
					break;
				case "holdAll":
					removeAllNoteOffMessages(moments);
					letSound = true;
					break;
				case "holdAllStop":
					removeAllNoteOffMessages(moments);
					letSound = false;
					break;
				default:
					console.assert(false, "TrackWorker.pushTrk(): illegal option -- " + options.pedal);
					break;
			}
		}

		insertAtIndex = findInsertionIndex(allTrks, msPosition);

		trk.msPosition = msPosition;
		trk.moments = moments;
		trk.previousMsPosInSeq = 0;

		if(options.speed === undefined)
		{
			options.speed = 1; // default speed is as written in the score.
		}
		trk.options = options;

		allTrks.splice(insertAtIndex, 0, trk);
	}

	// Seq.prototype.start calls:
	// worker.postMessage({ action: "start", velocity: performedVelocity });
	// Note that NoteOffs call this function with velocity set to 0,
	// and that in this case trk speed and velocity options are ignored.
	function start(msg)
	{
		var performedVelocity, minVelocity;

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
					if(stopChord && momentIndex > 1 && (nextMomt.systemIndex !== undefined))
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
					var
					delay = (moment.msPositionInSeq - currentTrk.previousMsPosInSeq) / speedFactor;
					currentTrk.previousMsPosInSeq = moment.msPositionInSeq;

					return delay;
				}

				function trkCompleted(letSound)
				{
					if(trkIndex < (allTrks.length - 1))
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

		if(trkIndex < allTrks.length)
		{
			stopChord = false;
			stopNow = false;

			if(currentTrk !== undefined && currentTrk.isRunning === true)
			{
				currentTrk.isRunning = false;
				trkIndex++;
			}

			currentTrk = allTrks[trkIndex];
			currentTrk.isRunning = true;

			moments = currentTrk.moments;
			nMoments = moments.length;
			momentIndex = 0;

			if(msg.velocity > 0)
			{
				if(currentTrk.options.velocity)
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

				speedFactor = currentTrk.options.speed;
			}

			_start();
		}
	}

	/****************************************/
	/* case "stop": */
	// Aug. 2015
	function stop()
	{
		var noteOffOption;

		function setFade()
		{
			fadeLength = nMoments + 1 - momentIndex;
		}

		if(currentTrk && currentTrk.options)
		{
			noteOffOption = currentTrk.options.noteOff;

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
	}

	// begin eventHandler code

	switch(msg.action)
	{
		// called by Keyboard1 to initialize this worker (set up global variables etc.)
		case "init":
			init(msg);
			break;

		// called by Seq when loading this worker with trks
		case "pushTrk":
			pushTrk(msg);
			break;

		// called by Seq to start a trk playing.
		case "start":
			start(msg);
			break;

		// called by Keyboard1 to stop a playing trk.
		case "stop":
			stop();
			break;

		// called by Keyboard1 to change the speed at which the trk plays.
		case "changeSpeed":
			speedFactor = currentTrk.options.speed * msg.speedFactor;
			break;
	}
};

addEventListener("message", eventHandler);

