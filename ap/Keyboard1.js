/*
* copyright 2014 James Ingram
* http://james-ingram-act-two.de/
*
* Code licensed under MIT
* https://github.com/notator/assistant-performer/blob/master/License.md
*
* ap/Keyboard1.js
* The _AP.keyboard1 namespace which defines
*
* // Initialize Keyboard1
* // Arguments:
* // inputDevice: The midi input device.
* // outputdevice: The midi output device.
* // reportEndOfPerfCallback: a callback function which is called when performing sequence
* //      reaches the endMarkerMsPosition.
* //      It is called in this file as:
* //          reportEndOfSpan(sequenceRecording, performanceMsDuration);
* // reportMsPosCallback: a callback function which reports the current msPositionInScore
* //      back to the GUI while performing. Can be undefined or null.
* //      It is called here as:
* //          reportMsPositionInScore(msPositionToReport, systemIndex);
* //      The msPosition it passes back is the original number of milliseconds from the start of
* //      the score (taking the global speed option into account). This value is used to identify
* //      chord and rest symbols in the score, and so to synchronize the running cursor.
* init = function(inputDevice, outputDevice, reportEndOfPerfCallback, reportMsPosCallback)
* 
* // Start playing (part of) the Score.
* // Arguments:
* // trackIsOnArray an array containing a boolean per track, determining whether it will
* //      be played or not. This array is read only.
* // startMarkerMsPosition, endMarkerMsPosition: the part of the sequence to play 
* //      (not including endMarkerMsPosition)
* // [optional] recording: a sequence in which the performed messages will be recorded.
* play(trackIsOnArray, startMarkerMsPosInScore, endMarkerMsPosInScore, recording)
* 
* // stop a running performance
* stop()
* 
* // Is the performance stopped?
* isStopped()
* 
* // Is the performance running?
* isRunning()
* 
*/

/*jslint white, bitwise*/
/*global WebMIDI, _AP,  window,  document, performance */

_AP.namespace('_AP.keyboard1');

_AP.keyboard1 = (function()
{
	"use strict";

	var
	inputDevice,
	outputDevice,

	currentInstantIndex, // initialized to 0 when playing starts. Is the index in the following array (used while performing).
	instants = [],
	indexPlayed, // set to currentInstantIndex when instants[currentInstantIndex] is played.

	inputTracks,
	outputTracks,
	trackWorkers = [], // an array of webWorkers, one per outputTrack (=trackIndex).
	keyInstantIndices = [],
	keyRange, // keyRange.bottomKey and keyRange.topKey are the bottom and top input midi key values notated in the score.

	reportEndOfSpan, // callback -- called here as reportEndOfSpan(sequenceRecording, performanceMsDuration);
	reportMsPositionInScore, // callback -- called here as reportMsPositionInScore(msPositionToReport, systemIndex);
	systemMsPositions = [], // used before calling reportMsPositionInScore(msPositionToReport, systemIndex);

	// (performance.now() - performanceStartTime) is the real time elapsed since the start of the performance.
	performanceStartTime = -1,  // set in play(), used by stop(), run()

	// used by setState()
	stopped = true, // stop(), isStopped()

	sequenceRecording, // the sequence being recorded.

	allControllersOffMessages = [],
	allNotesOffMessages = [],

	trackPressureOptions = [],
	trackPitchWheelOptions = [],
	trackModWheelOptions = [],

	initChannelResetMessages = function(nOutputChannels)
	{
		var byte1, channelIndex,
			constants = _AP.constants,
			CONTROL_CHANGE = constants.COMMAND.CONTROL_CHANGE,
			ALL_CONTROLLERS_OFF = constants.CONTROL.ALL_CONTROLLERS_OFF,
			ALL_NOTES_OFF = constants.CONTROL.ALL_NOTES_OFF;

		for(channelIndex = 0; channelIndex < nOutputChannels; channelIndex++)
		{
			byte1 = CONTROL_CHANGE + channelIndex;
			allControllersOffMessages.push(new Uint8Array([byte1, ALL_CONTROLLERS_OFF, 0]));
			allNotesOffMessages.push(new Uint8Array([byte1, ALL_NOTES_OFF, 0]));
		}
	},

	handleMIDIInputEventForwardDeclaration,

	setState = function(state)
	{
		switch(state)
		{
			case "stopped":
				stopped = true;
				inputDevice.removeEventListener("midimessage", handleMIDIInputEventForwardDeclaration, false);
				inputDevice.close();
				break;
			case "running":
				stopped = false;
				inputDevice.addEventListener("midimessage", handleMIDIInputEventForwardDeclaration, false);
				inputDevice.open();
				break;
			default:
				throw "Unknown sequence state!";
		}
	},

	isRunning = function()
	{
		return (stopped === false);
	},

	isStopped = function()
	{
		return (stopped === true);
	},

	// does nothing if the performance is already stopped
	stop = function()
	{
		var performanceMsDuration, i;

		if(!isStopped())
		{
			for(i = 0; i < trackWorkers.length; ++i)
			{
				trackWorkers[i].terminate();
			}
			trackWorkers = [];

			setState("stopped"); // removes input device event handlers

			performanceMsDuration = Math.ceil(performance.now() - performanceStartTime);

			if(reportEndOfSpan !== undefined && reportEndOfSpan !== null)
			{
				reportEndOfSpan(sequenceRecording, performanceMsDuration);
			}
		}
	},

 	resetChannel = function(outputDevice, channelIndex, letSound)
	{
		if(letSound === false)
		{
			outputDevice.send(allControllersOffMessages[channelIndex], performance.now());
			outputDevice.send(allNotesOffMessages[channelIndex], performance.now());
		}
	},

	sendMIDIMessage = function(uint8array)
	{
		var timestamp = performance.now(), recording = sequenceRecording;

		outputDevice.send(uint8array, timestamp);
		if(recording !== undefined && recording !== null)
		{
			// The messages are recorded with their current (absolute DOMHRT) timestamp values.
			// These values are adjusted relative to the first timestamp in the recording before saving them in a Standard MIDI File.
			// In other words: the value of the earliest timestamp in the recording is subtracted from all the timestamps
			// in the recording before saving the file. 
			recording.addLiveMessage(uint8array, timestamp);
		}
	},

	// trackWorkers send their messages here.
	handleTrackMessage = function(e)
	{
		var msg = e.data;

		function workerHasCompleted(trackIndex)
		{
			var i, performanceHasCompleted = true;

			trackWorkers[trackIndex].hasCompleted = true;

			for(i = 0; i < trackWorkers.length; i++)
			{
				if(trackWorkers[i].hasCompleted === false)
				{
					performanceHasCompleted = false;
					break;
				}
			}

			if(performanceHasCompleted === true)
			{
				stop();
			}
		}

		if(document.hidden === true)
		{
			stop();
		}

		switch(msg.action)
		{
			case "midiMessage":
				// Note that Jazz 1.2 does not support timestamps. It always sends messages immediately.
				//if(msg.midiMessage.length === 2)
				//{
				//	console.log("[0]=%d, [1]=%d", msg.midiMessage[0], msg.midiMessage[1]);
				//}
				//else if(msg.midiMessage.length === 3)
				//{
				//	console.log("[0]=%d, [1]=%d, [2]=%d", msg.midiMessage[0], msg.midiMessage[1], msg.midiMessage[2]);
				//}
				//else
				//{
				//	console.log("msg length = ", msg.midiMessage.length);
				//}
				sendMIDIMessage(msg.midiMessage);
				break;
			case "trkCompleted":
				// TrackWorkers send this message to say that they are not going to send any more midiMessages from a trk (that is not the last).
				resetChannel(outputDevice, msg.channelIndex, msg.letSound);
				break;
			case "workerCompleted":
				// TrackWorkers send this message to say that they are not going to send any more midiMessages from their final trk.
				resetChannel(outputDevice, msg.channelIndex, msg.letSound);
				workerHasCompleted(msg.trackIndex);
				break;
			default:
				break;
		}
	},

	// see _Keyboard1Algorithm.txt
	// This handler
    // a) ignores both RealTime and SysEx messages in its input, and
    // b) assumes that RealTime messages will not interrupt the messages being received.    
    handleMIDIInputEvent = function(msg)
    {
    	var inputEvent, command,
    		CMD = _AP.constants.COMMAND;    	

    	// The returned object is either empty, or has .data and .receivedTime attributes,
    	// and so constitutes a timestamped Message. (Web MIDI API simply calls this an Event)
    	// This handler ignores both realTime and SysEx messages, even though these are
    	// defined (untested 8.3.2013) in the _AP library, so this function only returns
    	// the other types of message (having 2 or 3 data bytes).
    	// If the input data is undefined, an empty object is returned, otherwise data must
    	// be an array of numbers in range 0..0xF0. An exception is thrown if the data is illegal.
    	function getInputEvent(data, now)
    	{
    		var
            SYSTEM_EXCLUSIVE = _AP.constants.SYSTEM_EXCLUSIVE,
            isRealTimeStatus = _AP.constants.isRealTimeStatus,
            inputEvent = {};

    		if(data !== undefined)
    		{
    			if(data[0] === SYSTEM_EXCLUSIVE.START)
    			{
    				if(!(data.length > 2 && data[data.length - 1] === SYSTEM_EXCLUSIVE.END))
    				{
    					throw "Error in System Exclusive inputEvent.";
    				}
    				// SysExMessages are ignored by the assistant, so do nothing here.
    				// Note that SysExMessages may contain realTime messages at this point (they
    				// would have to be removed somehow before creating a sysEx event), but since
    				// we are ignoring both realTime and sysEx, nothing needs doing here.
    			}
    			else if((data[0] & 0xF0) === 0xF0)
    			{
    				if(!(isRealTimeStatus(data[0])))
    				{
    					throw "Error: illegal data.";
    				}
    				// RealTime messages are ignored by the assistant, so do nothing here.
    			}
    			else if(data.length === 2)
    			{
    				inputEvent = new _AP.message.Message(data[0], data[1], 0);
    			}
    			else if(data.length === 3)
    			{
    				inputEvent = new _AP.message.Message(data[0], data[1], data[2]);
    			}

    			// other data is simply ignored

    			if(inputEvent.data !== undefined)
    			{
    				inputEvent.receivedTime = now;
    			}
    		}

    		return inputEvent;
    	}

    	function doTrkOffs(trkOffs, workers)
    	{
    		var i, nTrkOffs = trkOffs.length;
    		for(i = 0; i < nTrkOffs; ++i)
    		{
    			workers[trkOffs[i]].postMessage({ "action": "stop" });
    		}
    	}

    	// This function is called with zero performedVelocity when playing noteOffs.
		// The key's noteOn or noteOff is removed from noteOnOrOffs after it is used.
    	function playKeyNoteOnOrOff(noteOnOrOffs, key, performedVelocity)
    	{
    		var i, nNoteOnOrOffs, noteOnOrOff, workers = trackWorkers;

    		function removeNoteOnOrOff(noteOnOrOffs, key)
    		{
    			var i, nNoteOnOrOffs = noteOnOrOffs.length, noteOnOrOff, index;
    			for(i = 0; i < nNoteOnOrOffs; ++i)
    			{
    				noteOnOrOff = noteOnOrOffs[i];
    				if(noteOnOrOff.notatedKey === key)
    				{
    					index = i;
    					break;
    				}
    			}
    			
    			noteOnOrOffs.splice(index, 1);
			}

    		if(noteOnOrOffs && noteOnOrOffs.length > 0)
    		{
    			nNoteOnOrOffs = noteOnOrOffs.length;
    			for(i = 0; i < nNoteOnOrOffs; ++i)
    			{
    				noteOnOrOff = noteOnOrOffs[i];
    				if(key === noteOnOrOff.notatedKey)
    				{
    					if(noteOnOrOff.seq)
    					{
    						noteOnOrOff.seq.start(performedVelocity);
    					}
    					if(noteOnOrOff.trkOffs)
    					{
    						doTrkOffs(noteOnOrOff.trkOffs, workers);
    					}
    					break;
    				}
    			}
    			removeNoteOnOrOff(noteOnOrOffs, key);
    		}
    	}

		// Sends all the trkOffs at this instant.
    	function sendAllTrkOffsAtInstant(instant)
    	{
    		var workers = trackWorkers;

    		function sendTrkOffs(noteOnOrOffs, workers)
    		{
    			var i, noteOnOrOff, nNoteOnOrOffs = noteOnOrOffs.length;

    			for(i = 0; i < nNoteOnOrOffs; ++i)
    			{
    				noteOnOrOff = noteOnOrOffs[i];

    				if(noteOnOrOff.trkOffs)
    				{
    					doTrkOffs(noteOnOrOff.trkOffs, workers);
    				}
    			}			
    		}

    		if(instant.noteOffs)
    		{
    			sendTrkOffs(instant.noteOffs, workers);
    		}
    		if(instant.noteOns)
    		{
    			sendTrkOffs(instant.noteOns, workers);
    		}
    	}

    	// The ccSettings argument is an array that contains a set of control settings per output track.
    	// In this argument, a track's settings or subsettings (pressure, pitchWheel or modWheel) may be
    	// undefined, in which case the corresponding running track settings remain unchanged.
    	// The running track settings are never undefined.
    	// If a running track pressure.control, pitchWheel.control or modWheel.control is set to 'disabled',
    	// that control will be disabled (i.e. not do anything).
    	function setContinuousControllerOptions(ccSettings)
    	{
    		var i, nTracks = trackWorkers.length;
			
    		function setTrackSettings(trackIndex, trackCCSettings)
    		{
    			function getPressureOption(trackCCSettings)
    			{
    				var returnPressureSettings = {};

    				console.assert(trackCCSettings.pressure !== undefined, "Error: pressure settings may not be undefined here.");

    				returnPressureSettings.control = trackCCSettings.pressure; // can be 'disabled'
    				if(returnPressureSettings.control === 'volume')
    				{
    					returnPressureSettings.minVolume = trackCCSettings.minVolume;
    					returnPressureSettings.maxVolume = trackCCSettings.maxVolume;
    				}
    				return returnPressureSettings;
    			}
    			function getModWheelOption(trackCCSettings)
    			{
    				var returnModWheelSettings = {};

    				console.assert(trackCCSettings.modWheel !== undefined, "Error: modWheel settings may not be undefined here.");

    				returnModWheelSettings.control = trackCCSettings.modWheel; // can be 'disabled'
    				if(returnModWheelSettings.control === 'volume')
    				{
    					returnModWheelSettings.minVolume = trackCCSettings.minVolume;
    					returnModWheelSettings.maxVolume = trackCCSettings.maxVolume;
    				}
    				return returnModWheelSettings;
    			}
    			function getPitchWheelOption(trackCCSettings, trackIndex, currentPitchWheelDeviation)
    			{
    				/// Sets both RegisteredParameter controls to 0 (zero). This is standard MIDI for selecting the
    				/// pitch wheel so that it can be set by the subsequent DataEntry messages.
    				/// A DataEntryFine message is not set, because it is not needed and has no effect anyway.
    				/// However, RegisteredParameterFine MUST be set, otherwise the messages as a whole have no effect!
    				function sendPitchWheelDeviationMessages(trackIndex, deviation)
    				{
    					var msg,
							CMD = _AP.constants.COMMAND,
							CTL = _AP.constants.CONTROL,
							Message = _AP.message.Message;

    					msg = new Message(CMD.CONTROL_CHANGE + trackIndex, CTL.REGISTERED_PARAMETER_COARSE, 0);
    					sendMIDIMessage(msg.data);

    					msg = new Message(CMD.CONTROL_CHANGE + trackIndex, CTL.REGISTERED_PARAMETER_FINE, 0);
    					sendMIDIMessage(msg.data);

    					msg = new Message(CMD.CONTROL_CHANGE + trackIndex, CTL.DATA_ENTRY_COARSE, deviation);
    					sendMIDIMessage(msg.data);
    				}

    				var rval = {};

    				console.assert(trackCCSettings.pitchWheel !== undefined, "Error: pitchWheel settings may not be undefined here.");

    				rval.control = trackCCSettings.pitchWheel; // can be 'disabled'
    				switch(rval.control)
    				{
    					case 'pitch':
    						rval.pitchWheelDeviation = trackCCSettings.pitchWheelDeviation;
    						if(currentPitchWheelDeviation !== rval.pitchWheelDeviation)
    						{
    							sendPitchWheelDeviationMessages(trackIndex, rval.pitchWheelDeviation);
    						}
    						break;
    					case 'pan':
    						rval.panOrigin = trackCCSettings.panOrigin;
    						break;
    					case 'speed':
    						rval.speedDeviation = trackCCSettings.speedDeviation;
    						break;
    					case 'disabled':
    						break;
    				}

    				return rval;
    			}

    			console.assert(trackCCSettings !== undefined, "Error: trackCCSettings may not be undefined here.");

    			if(trackCCSettings.pressure !== undefined)
    			{
    				trackPressureOptions[trackIndex] = getPressureOption(trackCCSettings);
    			}
    			if(trackCCSettings.pitchWheel !== undefined)
    			{
    				trackPitchWheelOptions[trackIndex] = getPitchWheelOption(trackCCSettings, trackIndex, trackPitchWheelOptions[trackIndex].pitchWheelDeviation);
    			}
    			if(trackCCSettings.modWheel !== undefined)
    			{
    				trackModWheelOptions[trackIndex] = getModWheelOption(trackCCSettings);
    			}
    		}

    		for(i = 0; i < nTracks; ++i)
    		{
    			if(ccSettings[i] !== undefined)
    			{
    				setTrackSettings(i, ccSettings[i]);
    			}
    		}
    	}

    	// Increment each keyInstantIndices.index until pointing at >= currentInstantIndex
    	function advanceKeyInstantIndicesTo(keyInstantIndices, currentInstantIndex)
    	{
    		var i, kOnOffIndices, nKeys;

    		nKeys = keyInstantIndices.length;
    		for(i = 0; i < nKeys; ++i)
    		{
    			kOnOffIndices = keyInstantIndices[i];
    			if(kOnOffIndices) // some keys may not have kOnOffIndices...
    			{
    				while(kOnOffIndices.index < kOnOffIndices.keyOnIndices.length)
    				{
    					if(kOnOffIndices.keyOnIndices[kOnOffIndices.index] >= currentInstantIndex)
    					{
    						break;
    					}
    					kOnOffIndices.index++;
    				}
    			}
    		}
    	}

    	function report(msPosition)
    	{
    		var sysIndex, systemIndex = 0, sysMsPositions = systemMsPositions, nSystems = sysMsPositions.length;

    		for(sysIndex = nSystems - 1; sysIndex >= 0 ; --sysIndex)
    		{
    			if(sysMsPositions[sysIndex] <= msPosition)
    			{
    				systemIndex = sysIndex;
    				break;
    			}	
    		}
    		reportMsPositionInScore(msPosition, systemIndex); 
    	}

    	// This function is called either by a real performed NoteOff or by a performed NoteOn having zero velocity.
    	function handleNoteOff(key)
    	{
    		var keyIndex = key - keyRange.bottomKey, thisKeyInstantIndices, keyOffIndices,
    			instant, instantIndex, tempInstantIndex;

    		if(key >= keyRange.bottomKey && key <= keyRange.topKey)
    		{
    			thisKeyInstantIndices = keyInstantIndices[keyIndex];
    			if(thisKeyInstantIndices)
    			{
    				keyOffIndices = thisKeyInstantIndices.keyOffIndices;
    				if(keyOffIndices.length > thisKeyInstantIndices.index)
    				{
    					// thisKeyInstantIndices.index is incremented by advanceKeyInstantIndicesTo(keyInstantIndices, currentInstantIndex)
    					instantIndex = keyOffIndices[thisKeyInstantIndices.index];
    					if(instantIndex === currentInstantIndex || ((instantIndex === currentInstantIndex + 1) && indexPlayed === currentInstantIndex))
    					{
							// This is the usual case
    						instant = instants[instantIndex];
    						playKeyNoteOnOrOff(instant.noteOffs, key, 0); // the key's noteOff is removed after being played

    						currentInstantIndex = instantIndex;
    						indexPlayed = instantIndex;

    						if(instant.noteOns === undefined)
    						{
    							currentInstantIndex++;
    							report(instants[currentInstantIndex].msPosition);
    						}
    						advanceKeyInstantIndicesTo(keyInstantIndices, currentInstantIndex); // see above
    					}
    					else if(instantIndex > currentInstantIndex)
    					{
    						// The key has been released too early.
    						// Advance silently to instantIndex.
    						// Controller options are shunted. Seqs are stopped but not started. 
    						tempInstantIndex = currentInstantIndex;
    						while(tempInstantIndex < instantIndex)
    						{
    							instant = instants[tempInstantIndex];
    							report(instants[currentInstantIndex].msPosition);
    							sendAllTrkOffsAtInstant(instant);
    							currentInstantIndex = tempInstantIndex++;
    						}
    						indexPlayed = currentInstantIndex;
    						advanceKeyInstantIndicesTo(keyInstantIndices, currentInstantIndex); // see above
    						handleNoteOff(key);
    					}
    				}
    			}
    		}
    	}

		// performedVelocity is always greater than 0 (otherwise handleNoteOff() is called)
    	function handleNoteOn(key, performedVelocity)
    	{
    		var keyIndex = key - keyRange.bottomKey, thisKeyInstantIndices, keyOnIndices,
    			instant, instantIndex;

    		if(key >= keyRange.bottomKey && key <= keyRange.topKey)
    		{
    			thisKeyInstantIndices = keyInstantIndices[keyIndex];
    			if(thisKeyInstantIndices)
    			{
    				keyOnIndices = thisKeyInstantIndices.keyOnIndices;
    				if(keyOnIndices.length > thisKeyInstantIndices.index)
    				{
    					// thisKeyInstantIndices.index is incremented by advanceKeyInstantIndicesTo(keyInstantIndices, currentInstantIndex)
    					instantIndex = keyOnIndices[thisKeyInstantIndices.index];
    					if(instantIndex === currentInstantIndex || ((instantIndex === currentInstantIndex + 1) && indexPlayed === currentInstantIndex))
    					{
    						instant = instants[instantIndex];

    						playKeyNoteOnOrOff(instant.noteOffs, key, 0); // the key's noteOff is removed after being played
    						if(instant.ccSettings)
    						{
    							setContinuousControllerOptions(instant.ccSettings);
    						}
    						playKeyNoteOnOrOff(instant.noteOns, key, performedVelocity);  // the key's noteOn is removed after being played
			
    						currentInstantIndex = instantIndex;
    						indexPlayed = instantIndex;

    						if(instant.noteOns.length === 0)
    						{
    							currentInstantIndex++;
    							report(instants[currentInstantIndex].msPosition);
    						}

    						console.log("performedVelocity=" + performedVelocity.toString(10));
    					}
    				}
    			}
    		}
    	}
 
    	// Used by handleChannelPressure(...) and handleModWheel(...).
		function doController(trackIndex, control, value)
		{
			var volumeValue, options, message,
				CMD = _AP.constants.COMMAND,
				CTL = _AP.constants.CONTROL,
				Message = _AP.message.Message;

			// argument is in range 0..127
			// returned value is in range currentTrk.options.minVolume..currentTrk.options.maxVolume.
			function getVolumeValue(value, minVolume, maxVolume)
			{
				var range = maxVolume - minVolume,
				factor = range / 127,
				volumeValue = minVolume + (value * factor);
				return volumeValue;
			}

			options = (control === "modWheel") ? trackModWheelOptions[trackIndex] : trackPressureOptions[trackIndex];
			console.assert(options.control !== 'disabled', "Error: option.control cannot be disabled here.");

			switch(options.control)
			{
				case 'aftertouch':	// Note that this option results in channelPressure messages!
					message = new Message(CMD.CHANNEL_PRESSURE + trackIndex, value);
					break;
				case 'channelPressure':
					message = new Message(CMD.CHANNEL_PRESSURE + trackIndex, value);
					break;
				case 'modulation':
					message = new Message(CMD.CONTROL_CHANGE + trackIndex, CTL.MODWHEEL, value);
					break;
				case 'volume':
					volumeValue = getVolumeValue(value, options.minVolume, options.maxVolume);
					message = new Message(CMD.CONTROL_CHANGE + trackIndex, CTL.VOLUME, volumeValue);
					break;
				case 'expression':
					message = new Message(CMD.CONTROL_CHANGE + trackIndex, CTL.EXPRESSION, value);
					break;
				case 'timbre':
					message = new Message(CMD.CONTROL_CHANGE + trackIndex, CTL.TIMBRE, value);
					break;
				case 'brightness':
					message = new Message(CMD.CONTROL_CHANGE + trackIndex, CTL.BRIGHTNESS, value);
					break;
				case 'effects':
					message = new Message(CMD.CONTROL_CHANGE + trackIndex, CTL.EFFECTS, value);
					break;
				case 'tremolo':
					message = new Message(CMD.CONTROL_CHANGE + trackIndex, CTL.TREMOLO, value);
					break;
				case 'chorus':
					message = new Message(CMD.CONTROL_CHANGE + trackIndex, CTL.CHORUS, value);
					break;
				case 'celeste':
					message = new Message(CMD.CONTROL_CHANGE + trackIndex, CTL.CELESTE, value);
					break;
				case 'phaser':
					message = new Message(CMD.CONTROL_CHANGE + trackIndex, CTL.PHASER, value);
					break;
			}

			if(message)
			{
				sendMIDIMessage(message.data);
			}
		}

    	// called when channel pressure changes
    	// Achtung: value is data[1]
    	function handleChannelPressure(data)
    	{
    		var i, nTracks = trackWorkers.length;

    		for(i = 0; i < nTracks; ++i)
    		{
    			if(trackPressureOptions[i].control !== 'disabled')
    			{
    				doController(i, "pressure", data[1]); // Achtung: value is data[1]
    			}
    		}
    	}

    	// called when modulation wheel changes
    	// Achtung: value is data[2]
    	function handleModWheel(data)
    	{
    		var i, nTracks = trackWorkers.length;

    		for(i = 0; i < nTracks; ++i)
    		{
    			if(trackModWheelOptions[i].control !== 'disabled')
    			{
    				doController(i, "modWheel", data[2]); // Achtung: value is data[2]
    			}
    		}
    	}

		// called when the pitchWheel changes
    	function handlePitchWheel(data)
    	{
    		var i, nTracks = trackWorkers.length;

    		function doPitchOption(trackIndex, data1, data2)
    		{
    			var	msg = new _AP.message.Message(_AP.constants.COMMAND.PITCH_WHEEL + trackIndex, data1, data2);
    			sendMIDIMessage(msg.data);
    		}

    		function doPanOption(trackIndex, value, panOrigin)  // value is in range 0..127
    		{
    			var factor, newValue,
    				CMD = _AP.constants.COMMAND,
					CTL = _AP.constants.CONTROL,
					Message = _AP.message.Message;

    			if(value < 0x80)
    			{
    				factor = panOrigin / 0x80;
    				newValue = value * factor;
    			}
    			else
    			{
    				factor = (0xFF - panOrigin) / 0x7F;
    				newValue = panOrigin + ((value - 0x80) * factor);
    			}

    			msg = new Message(CMD.CONTROL_CHANGE + trackIndex, CTL.PAN, newValue);

    			sendMIDIMessage(msg.data);
    		}

    		function doSpeedOption(trackIndex, value, speedDeviation) // value is in range 0..127
    		{
				var speedFactor, factor = Math.pow(speedDeviation, 1 / 64);

    			// e.g. if speedDeviation is 2
    			// factor = 2^(1/64) = 1.01088...
    			// value is in range 0..127.
    			// if original value is 0, speedFactor = 1.01088^(-64) = 0.5
    			// if original value is 64, speedfactor = 1.01088^(0) = 1.0
    			// if original value is 127, speedFactor = 1.01088^(64) = 2.0 = maxSpeedFactor

    			value -= 64; // if value was 64, speedfactor is 1.
    			speedFactor = Math.pow(factor, value);
    			// nothing more to do! speedFactor is used in tick() to calculate delays.
    			trackWorkers[trackIndex].postMessage({action: "changeSpeed", speedFactor: speedFactor});
    		}

    		function doOption(trackIndex, pitchWheelOption)
    		{
    			switch(pitchWheelOption.control)
    			{
    				case "pitch":
    					doPitchOption(trackIndex, data[1], data[2]);
    					break;
    				case "pan":
    					doPanOption(trackIndex, data[1], trackPitchWheelOptions[trackIndex].panOrigin);  // data1, the hi byte, is in range 0..127
    					break;
    				case "speed":
    					doSpeedOption(trackIndex, data[1], trackPitchWheelOptions[trackIndex].speedDeviation); // data1, the hi byte, is in range 0..127
    					break;
    			}

			}

    		for(i = 0; i < nTracks; ++i)
    		{
    			if(trackPitchWheelOptions[i].control !== 'disabled')
    			{
    				doOption(i, trackPitchWheelOptions[i]);
    			}
    		}
    	}

    	inputEvent = getInputEvent(msg.data, performance.now());

    	if(inputEvent.data !== undefined)
    	{
    		command = inputEvent.command();

    		switch(command)
    		{
    			case CMD.NOTE_ON:
    				if(inputEvent.data[2] !== 0)
    				{
    					handleNoteOn(inputEvent.data[1], inputEvent.data[2]);
    				}
    				else
    				{
    					handleNoteOff(inputEvent.data[1]);
    				}
    				break;
				case CMD.NOTE_OFF:
					handleNoteOff(inputEvent.data[1]);
    				break;
    			case CMD.CHANNEL_PRESSURE: // produced by both R2M and E-MU XBoard49 when using "aftertouch"
    				// CHANNEL_PRESSURE.data[1] is the amount of pressure 0..127.
    				handleChannelPressure(inputEvent.data);
    				break;
    			case CMD.AFTERTOUCH: // produced by the EWI breath controller
    				// AFTERTOUCH.data[1] is the MIDIpitch to which to apply the aftertouch
    				// AFTERTOUCH.data[2] is the amount of pressure 0..127.
    				// not supported
    				break;
    			case CMD.PITCH_WHEEL: // EWI pitch bend up/down controllers, EMU pitch wheel
    				handlePitchWheel(inputEvent.data);
    				break;
    			case CMD.CONTROL_CHANGE: // sent when the EMU ModWheel changes.
    				handleModWheel(inputEvent.data);
    				break;
    			default:
    				break;
    		}
    	}
    },

	// The reportEndOfPerfCallback argument is a callback function which is called when performing sequence
	// reaches the endMarkerMsPosition (see play(), or stop() is called. Can be undefined or null.
	// It is called in this file as:
	//      reportEndOfSpan(sequenceRecording, performanceMsDuration);
	// The reportMsPosCallback argument is a callback function which reports the current msPositionInScore back
	// to the GUI while performing. Can be undefined or null.
	// It is called here as:
	//      reportMsPositionInScore(msPositionToReport, systemIndex);
	// The msPosition it passes back is the original number of milliseconds from the start of
	// the score (taking the global speed option into account). This value is used to identify
	// chord and rest symbols in the score, and so to synchronize the running cursor.
	// Moments whose msPositionInScore is to be reported are given chordStart or restStart
	// attributes before play() is called.
	init = function(inputDeviceArg, outputDeviceArg, tracksData, reportEndOfPerfCallback, reportMsPosCallback)
	{
		function getSystemMsPositions(outputTracks)
		{
			var i, j, sysMsPositions = [], nOutputTracks = outputTracks.length, midiObject, midiObjects, nMidiObjects, systemIndex, msPosition;

			for(i = 0; i < nOutputTracks; ++i)
			{
				midiObjects = outputTracks[i].midiObjects;
				nMidiObjects = midiObjects.length;
				for(j = 0; j < nMidiObjects; ++j)
				{
					midiObject = midiObjects[j];
					if(midiObject.moments[0].systemIndex !== undefined)
					{
						systemIndex = midiObject.moments[0].systemIndex;
						msPosition = midiObject.msPositionInScore;
						if(sysMsPositions[systemIndex] === undefined || sysMsPositions[systemIndex] > msPosition)
						{
							sysMsPositions[systemIndex] = msPosition;
						}
					}
				}
			}

			return sysMsPositions;
		}

		console.assert((inputDeviceArg !== undefined && inputDeviceArg !== null), "The midi input device must be defined.");
		console.assert((outputDeviceArg !== undefined && outputDeviceArg !== null), "The midi output device must be defined.");
		console.assert((tracksData !== undefined && tracksData !== null), "The tracksData must be defined.");
		console.assert((tracksData.inputTracks !== undefined && tracksData.inputTracks !== null), "The input tracks must be defined.");
		console.assert((tracksData.outputTracks !== undefined && tracksData.outputTracks !== null), "The output tracks must be defined.");
		console.assert((tracksData.inputKeyRange !== undefined && tracksData.inputKeyRange !== null), "The input key range must be defined.");
		console.assert(!(reportEndOfPerfCallback === undefined || reportEndOfPerfCallback === null
						|| reportMsPosCallback === undefined || reportMsPosCallback === null),
						"Error: both the position reporting callbacks must be defined.");

		inputDevice = inputDeviceArg;
		outputDevice = outputDeviceArg;
		inputTracks = tracksData.inputTracks;
		outputTracks = tracksData.outputTracks;
		keyRange = tracksData.inputKeyRange; // these are the bottom and top midi key values notated in the score.
		reportEndOfSpan = reportEndOfPerfCallback;
		reportMsPositionInScore = reportMsPosCallback;

		systemMsPositions = getSystemMsPositions(tracksData.outputTracks);

		initChannelResetMessages(outputTracks.length);

		setState("stopped");
	},

	// play()
	//
	// trackIsOnArray[trackIndex] returns a boolean which determines whether each output or input
	// track will be played or not. This array is read only.
	// recording is a Sequence to which timestamped instants are added as they are performed.
	// It should be an empty Sequence having the same number of output tracks as the score.
	play = function(trackIsOnArray, startMarkerMsPosInScore, endMarkerMsPosInScore, recording)
	{
		function resetChannels(outputDevice, nTracks)
		{
			var trackIndex;

			for(trackIndex = 0; trackIndex < nTracks; trackIndex++)
			{
				resetChannel(outputDevice, trackIndex, false);
			}
		}

		// The continuous controllers do nothing by default.
		function resetContinuousControllerOptions(nTracks)
		{
			var trackIndex, pressureOption, pitchWheelOption, modWheelOption;

			trackPressureOptions.length = 0;
			trackPitchWheelOptions.length = 0;
			trackModWheelOptions.length = 0;

			for(trackIndex = 0; trackIndex < nTracks; ++trackIndex)
			{
				pressureOption = {};
				pressureOption.control = 'disabled';
				trackPressureOptions.push(pressureOption);
				pitchWheelOption = {};
				pitchWheelOption.control = 'disabled';
				trackPitchWheelOptions.push(pitchWheelOption);
				modWheelOption = {};
				modWheelOption.control = 'disabled';
				trackModWheelOptions.push(modWheelOption);
			}
		}

		function initPlay(trackIsOnArray, keyInstantIndices, instants, trackWorkers, startMarkerMsPosInScore, endMarkerMsPosInScore)
		{
			// Sets instants to contain an array of objects having noteOns and noteOffs array attributes (the arrays are undefined if empty).
			// The instants are ordered by msPosition, and contain an instant for the endMarkerMsPosInScore. (If there are no noteOffs at
			// endMarkerMsPosInScore, an empty instant is added.)
			// Each instant has an msPosition attribute, and contains all the NoteOns and NoteOffs at that msPosition,
			// regardless of inputTrack. All the msPositions are >= startMarkerMsPosInScore and <= endMarkerMsPosInScore.
			// Each trk is given a trkOptions attribute object containing the options it needs. These depend on whether the
			// trk is inside a seq, pressures, pitchWheels or modWheels object.
			function setInstants(instants, inputTracks, trackIsOnArray, startMarkerMsPosInScore, endMarkerMsPosInScore)
			{
				var notesMoments, i, j, nNotesMoments,
					vNotesArray, nVNotes, note, instant;

				function findObjectAtMsPosition(verticalArrays, msPosition)
				{
					var i, nArrays = verticalArrays.length, moment = null;

					for(i = 0; i < nArrays; ++i)
					{
						if(verticalArrays[i].msPosition === msPosition)
						{
							moment = verticalArrays[i];
							break;
						}
					}
					return moment;
				}

				// Returns an array of (array of inputNotes), ordered by msPosition (without the endMarkerMsPosInScore).
				// Each contained array has an msPosition attribute, and contains all the inputNotes at that msPosition,
				// regardless of inputTrack. All the msPositions are >= startMarkerMsPosInScore and < endMarkerMsPosInScore.
				// Each trk is given a trkOptions attribute object containing the options it needs.
				// These depend on whether the trk is inside a seq, pressures, pitchWheels or modWheels object.
				function getNotesMoments(inputTracks, trackIsOnArray, startMarkerMsPosInScore, endMarkerMsPosInScore)
				{
					var inputTrackIndex, nInputTracks, topInputTrackIndex,
						ioIndex, inputObjects, nInputObjects, msPosition, msDuration, inputChord,
						notesMoments = [], inputNote, inputNotes, moment, i, nInputNotes,
						shuntedCCSettings = [], chordTrkOptions, previousChordTrkOptions;

					function getInputNotes(inputNotes, trackIsOnArray)
					{
						var rval = [], i, nInputNotes = inputNotes.length;

						function usesTrack(inputNote, trackIsOnArray)
						{
							var rval = false;

							function seqHasTrack(trkArray, trackIsOnArray)
							{
								var rval = false, i, nTrks;

								if(trkArray !== undefined && trkArray.length > 0)
								{
									nTrks = trkArray.length;
									for(i = 0; i < nTrks; ++i)
									{
										if(trackIsOnArray[trkArray[i].trackIndex])
										{
											rval = true;
											break;
										}
									}
								}
								return rval;
							}

							function trkOffsHasTrack(trackIndices, trackIsOnArray)
							{
								var rval = false, i, nTrks;

								if(trackIndices !== undefined && trackIndices.length > 0)
								{
									nTrks = trackIndices.length;
									for(i = 0; i < nTrks; ++i)
									{
										if(trackIsOnArray[trackIndices[i]])
										{
											rval = true;
											break;
										}
									}
								}
								return rval;
							}

							if(seqHasTrack(inputNote.noteOn.seqDef, trackIsOnArray)
							|| trkOffsHasTrack(inputNote.noteOff.trkOffs, trackIsOnArray)
							|| trkOffsHasTrack(inputNote.noteOn.trkOffs, trackIsOnArray)
							|| seqHasTrack(inputNote.noteOff.seqDef, trackIsOnArray))
							{
								rval = true;
							}
							return rval;
						}

						for(i = 0; i < nInputNotes; ++i)
						{
							if(usesTrack(inputNotes[i], trackIsOnArray))
							{
								rval.push(inputNotes[i]);
							}
						}

						return rval;
					}

					function removeDisabledTrks(inputNote, trackIsOnArray)
					{
						function removeTrks(noteOnOff, trackIsOnArray)
						{
							var i, nTrks, trk, seqDef, newSeqDef = [];

							function hasDisabledTrack(seqDef, trackIsOnArray)
							{
								var nTrks = seqDef.length, rval = false;
								for(i = 0; i < nTrks; ++i)
								{
									trk = seqDef[i];
									if(trackIsOnArray[trk.trackIndex] === false)
									{
										rval = true;
										break;
									}
								}
								return rval;
							}

							if(noteOnOff !== undefined && noteOnOff.seqDef !== undefined)
							{
								seqDef = noteOnOff.seqDef;
								if(hasDisabledTrack(seqDef, trackIsOnArray))
								{
									nTrks = seqDef.length;
									for(i = 0; i < nTrks; ++i)
									{
										trk = seqDef[i];
										if(trackIsOnArray[trk.trackIndex] === true)
										{
											newSeqDef.push(trk);
										}
									}
									noteOnOff.seqDef = newSeqDef;
								}
							}

						}

						if(inputNote.noteOn)
						{
							removeTrks(inputNote.noteOn, trackIsOnArray);
						}

						if(inputNote.noteOff)
						{
							removeTrks(inputNote.noteOff, trackIsOnArray);
						}
					}

					function setNoteOnOffTrkOptions(inputNote, chordTrkOptions)
					{
						function setTrkOptions(noteOnOff, noteTrkOptions, chordTrkOptions)
						{
							function getOption(optStr, trkTrkOptions, seqControlsTrkOptions, noteTrkOptions, chordTrkOptions)
							{
								var option;
								if(trkTrkOptions !== undefined && trkTrkOptions.hasOwnProperty(optStr))
								{
									option = trkTrkOptions[optStr];
								}
								else if(seqControlsTrkOptions !== undefined && seqControlsTrkOptions.hasOwnProperty(optStr))
								{
									option = seqControlsTrkOptions[optStr];
								}
								else if(noteTrkOptions !== undefined && noteTrkOptions.hasOwnProperty(optStr))
								{
									option = noteTrkOptions[optStr];
								}
								else if(chordTrkOptions !== undefined && chordTrkOptions.hasOwnProperty(optStr))
								{
									option = chordTrkOptions[optStr];
								}
								return option;
							}

							// Seqs use the options: pedal, velocity, speed and trkOff
							function setSeqTrkOptions(seqDef, noteTrkOptions, chordTrkOptions)
							{
								var i, nTrks = seqDef.length, newTrkOptions, seqTrkOptions = seqDef.trkOptions, trkTrkOptions,
									pedalOpt, velocityOpt, minVelocityOpt, speedOpt, trkOffOpt;

								for(i = 0; i < nTrks; ++i)
								{
									newTrkOptions = {};
									trkTrkOptions = seqDef[i].trkOptions;
									pedalOpt = getOption("pedal", trkTrkOptions, seqTrkOptions, noteTrkOptions, chordTrkOptions);
									if(pedalOpt && pedalOpt !== "undefined")
									{
										newTrkOptions.pedal = pedalOpt;
									}
									velocityOpt = getOption("velocity", trkTrkOptions, seqTrkOptions, noteTrkOptions, chordTrkOptions);
									if(velocityOpt && velocityOpt !== "undefined")
									{
										minVelocityOpt = getOption("minVelocity", trkTrkOptions, seqTrkOptions, noteTrkOptions, chordTrkOptions);
										newTrkOptions.velocity = velocityOpt;
										newTrkOptions.minVelocity = minVelocityOpt;
									}
									speedOpt = getOption("speed", trkTrkOptions, seqTrkOptions, noteTrkOptions, chordTrkOptions);
									if(speedOpt !== undefined)
									{
										newTrkOptions.speed = speedOpt;
									}
									trkOffOpt = getOption("trkOff", trkTrkOptions, seqTrkOptions, noteTrkOptions, chordTrkOptions);
									if(trkOffOpt && trkOffOpt !== "undefined")
									{
										newTrkOptions.trkOff = trkOffOpt;
									}
									seqDef[i].trkOptions = newTrkOptions;
								}
							}

							if(noteOnOff.seqDef !== undefined && noteOnOff.seqDef.length > 0)
							{
								setSeqTrkOptions(noteOnOff.seqDef, noteTrkOptions, chordTrkOptions);
							}
						}

						if(inputNote.noteOn)
						{
							setTrkOptions(inputNote.noteOn, inputNote.trkOptions, chordTrkOptions);
						}

						if(inputNote.noteOff)
						{
							setTrkOptions(inputNote.noteOff, inputNote.trkOptions, chordTrkOptions);
						}
					}

					// Returns an object that is the result of shunting the individual attributes of the two arguments.
					// If an individual ccSetting is defined, the returned object has that attribute and value.
					// Else, if the attribute is defined in previousCCSetting, that attribute and value are used.
					// If the attribute is not defined in either the ccSetting or the previousCCSetting, it is left undefined.
					function getShuntedCCSettings(ccSettings, previousCCSettings)
					{
						var i, nSettings = ccSettings.length, ccs, prevccs, rval, rvals = [];

						if(previousCCSettings.length === 0)
						{
							for(i = 0; i < nSettings; ++i)
							{
								previousCCSettings.push({});
							}
						}

						for(i = 0; i < nSettings; ++i)
						{
							rval = {};
							ccs = ccSettings[i];
							prevccs = previousCCSettings[i];

							if(ccs.trackIndex || prevccs.trackIndex)
							{
								rval.trackIndex = (ccs.trackIndex !== undefined) ? ccs.trackIndex : prevccs.trackIndex;
							}
							if(ccs.pressure || prevccs.pressure)
							{
								rval.pressure = (ccs.pressure !== undefined) ? ccs.pressure : prevccs.pressure;
							}
							if(ccs.pitchWheel || prevccs.pitchWheel)
							{
								rval.pitchWheel = (ccs.pitchWheel !== undefined) ? ccs.pitchWheel : prevccs.pitchWheel;
							}
							if(ccs.modWheel || prevccs.modWheel)
							{
								rval.modWheel = (ccs.modWheel !== undefined) ? ccs.modWheel : prevccs.modWheel;
							}
							if(ccs.minVolume || prevccs.minVolume)
							{
								rval.minVolume = (ccs.minVolume !== undefined) ? ccs.minVolume : prevccs.minVolume;
							}
							if(ccs.maxVolume || prevccs.maxVolume)
							{
								rval.maxVolume = (ccs.maxVolume !== undefined) ? ccs.maxVolume : prevccs.maxVolume;
							}
							if(ccs.pitchWheelDeviation || prevccs.pitchWheelDeviation)
							{
								rval.pitchWheelDeviation = (ccs.pitchWheelDeviation !== undefined) ? ccs.pitchWheelDeviation : prevccs.pitchWheelDeviation;
							}
							if(ccs.speedDeviation || prevccs.speedDeviation)
							{
								rval.speedDeviation = (ccs.speedDeviation !== undefined) ? ccs.speedDeviation : prevccs.speedDeviation;
							}
							if(ccs.panOrigin || prevccs.panOrigin)
							{
								rval.panOrigin = (ccs.panOrigin !== undefined) ? ccs.panOrigin : prevccs.panOrigin;
							}

							rvals.push(rval);							
						}
						return rvals;
					}

					// if a trkOption is undefined, use the previousChordTrkOption (which may be undefined)
					function getChordTrackOptions(trkOptions, previousChordTrkOptions)
					{
						// pedal -- possible values: "undefined", "holdAll", "holdLast"
						// velocity -- possible values: "undefined", "scaled", "shared", "overridden"  
						// minVelocity -- an integer in range [1..127]. Defined if velocity is defined.
						// speed --  the value by which to divide output durations in the trk. (A float value greater than 0. Higher values mean higher speed.)  
						// trkOff -- possible values: "undefined", "stopChord", "stopNow", "fade" 
						var rval = {};

						rval.pedal = (trkOptions.pedal !== undefined) ? trkOptions.pedal : previousChordTrkOptions.pedal;
						rval.velocity = (trkOptions.velocity !== undefined) ? trkOptions.velocity : previousChordTrkOptions.velocity;
						rval.minVelocity = (trkOptions.minVelocity !== undefined) ? trkOptions.minVelocity : previousChordTrkOptions.minVelocity;
						rval.speed = (trkOptions.speed !== undefined) ? trkOptions.speed : previousChordTrkOptions.speed;
						rval.trkOff = (trkOptions.trkOff !== undefined) ? trkOptions.trkOff : previousChordTrkOptions.trkOff;

						return rval;
					}

					nInputTracks = inputTracks.length;
					topInputTrackIndex = trackIsOnArray.length - nInputTracks;
					for(inputTrackIndex = 0; inputTrackIndex < nInputTracks; ++inputTrackIndex)
					{
						if(trackIsOnArray[topInputTrackIndex + inputTrackIndex])
						{
							previousChordTrkOptions = new _AP.trkOptions.TrkOptions();
							inputObjects = inputTracks[inputTrackIndex].inputObjects;
							nInputObjects = inputObjects.length;
							for(ioIndex = 0; ioIndex < nInputObjects; ++ioIndex)
							{
								if(inputObjects[ioIndex] instanceof _AP.inputChord.InputChord)
								{
									inputChord = inputObjects[ioIndex];
									msPosition = inputChord.msPositionInScore;
									msDuration = inputChord.msDurationInScore;

									if(inputChord.ccSettings)
									{
										shuntedCCSettings = getShuntedCCSettings(inputChord.ccSettings, shuntedCCSettings);
									}

									if(inputChord.trkOptions)
									{
										chordTrkOptions = getChordTrackOptions(inputChord.trkOptions, previousChordTrkOptions);
									}
									else if(previousChordTrkOptions !== null)
									{
										chordTrkOptions = previousChordTrkOptions;
									}
									previousChordTrkOptions = chordTrkOptions;

									if(msPosition >= startMarkerMsPosInScore && msPosition < endMarkerMsPosInScore)
									{
										inputNotes = getInputNotes(inputChord.inputNotes, trackIsOnArray);

										if(inputNotes.length > 0)
										{
											nInputNotes = inputNotes.length;
											moment = findObjectAtMsPosition(notesMoments, msPosition);
											if(moment === null)
											{
												moment = [];
												moment.msPosition = msPosition;
												notesMoments.push(moment);
											}
											for(i = 0; i < nInputNotes; ++i)
											{
												inputNote = inputNotes[i];
												inputNote.msDuration = msDuration;
												removeDisabledTrks(inputNote, trackIsOnArray);
												setNoteOnOffTrkOptions(inputNote, chordTrkOptions);
												moment.push(inputNote);
											}

											if(shuntedCCSettings && msPosition === startMarkerMsPosInScore)
											{
												moment.ccSettings = shuntedCCSettings;
											}
											else if(inputChord.ccSettings)
											{
												shuntedCCSettings = getShuntedCCSettings(inputChord.ccSettings, shuntedCCSettings);
												moment.ccSettings = shuntedCCSettings;
											}
											// moment.ccSettings is undefined when the ccSettings don't change.
										}
									}
								}
							}
						}
					}

					// sort by msPositions
					notesMoments.sort(function(a, b) { return a.msPosition - b.msPosition; });

					return notesMoments;
				}

				function pushNoteOn(instants, noteOn, notatedKey, msPosition, ccSettings)
				{
					var instant;

					if(noteOn !== undefined)
					{
						instant = findObjectAtMsPosition(instants, msPosition);
						if(instant === null)
						{
							instant = {};
							instant.msPosition = msPosition;
							instant.ccSettings = ccSettings;
							instants.push(instant);
						}
						if(instant.noteOns === undefined)
						{
							instant.noteOns = [];
						}

						noteOn.notatedKey = notatedKey;
						instant.noteOns.push(noteOn);
					}
				}

				function pushNoteOff(instants, noteOff, notatedKey, msPosition)
				{
					var instant;

					if(noteOff !== undefined)
					{
						instant = findObjectAtMsPosition(instants, msPosition);
						if(instant === null)
						{
							instant = {};
							instant.msPosition = msPosition;
							instants.push(instant);
						}
						if(instant.noteOffs === undefined)
						{
							instant.noteOffs = [];
						}
						noteOff.notatedKey = notatedKey;
						instant.noteOffs.push(noteOff);
					}
				}

				instants.length = 0;
				notesMoments = getNotesMoments(inputTracks, trackIsOnArray, startMarkerMsPosInScore, endMarkerMsPosInScore);
				nNotesMoments = notesMoments.length;
				for(i = 0; i < nNotesMoments; ++i)
				{
					vNotesArray = notesMoments[i];
					nVNotes = vNotesArray.length;
					for(j = 0; j < nVNotes; ++j)
					{
						note = vNotesArray[j];
						pushNoteOn(instants, note.noteOn, note.notatedKey, vNotesArray.msPosition, vNotesArray.ccSettings);
						pushNoteOff(instants, note.noteOff, note.notatedKey, vNotesArray.msPosition + note.msDuration);
					}
				}

				// sort by msPositions
				instants.sort(function(a, b) { return a.msPosition - b.msPosition; });

				if(instants[instants.length - 1].msPosition < endMarkerMsPosInScore)
				{
					instant = {};
					instant.msPosition = endMarkerMsPosInScore;
					instants.push(instant);
				}
			}

			// Constructs noteOn.seq and noteOff.seq from noteOn.seqDef and noteOff.seqDef objects.
			// The Seq constructor posts pushTrk messages to the appropriate trackWorkers.
			// The seqs are being constructed in order of msPosition, so the trackWorkers' trks
			// are also in order of msPosition.
			function setSeqsAndTrackWorkers(instants, trackWorkers, outputTracks)
			{
				var i, instantIndex, nInstants = instants.length, instant, nNoteOns, nNoteOffs, noteOn, noteOff;

				function initTrackWorkers(trackWorkers, outputTracks)
				{
					var i, worker;

					trackWorkers.length = 0;

					for(i = 0; i < outputTracks.length; i++)
					{
						worker = new window.Worker("ap/TrackWorker.js");
						worker.addEventListener("message", handleTrackMessage);
						worker.postMessage({ action: "init", trackIndex: i, channelIndex: outputTracks[i].midiChannel });
						// worker.hasCompleted is set to false when it is given trks to play (in the Seq constructor),
						// and back to true when the worker says that it has completed its last trk.
						worker.hasCompleted = true; // used to find out if the performance has completed.

						trackWorkers.push(worker);
					}
				}

				function setSeq(msPosition, noteOnOrOff, trackWorkers)
				{
					if(noteOnOrOff.seqDef)
					{
						noteOnOrOff.seq = new _AP.seq.Seq(msPosition, noteOnOrOff.seqDef, trackWorkers);
					}
				}

				initTrackWorkers(trackWorkers, outputTracks);

				for(instantIndex = 0; instantIndex < nInstants; ++instantIndex)
				{
					instant = instants[instantIndex];
					if(instant.noteOffs)
					{
						nNoteOffs = instant.noteOffs.length;
						for(i = 0; i < nNoteOffs; ++i)
						{
							noteOff = instant.noteOffs[i];
							setSeq(instant.msPosition, noteOff, trackWorkers);
						}
					}
					if(instant.noteOns)
					{
						nNoteOns = instant.noteOns.length;
						for(i = 0; i < nNoteOns; ++i)
						{
							noteOn = instant.noteOns[i];
							setSeq(instant.msPosition, noteOn, trackWorkers);
						}
					}
				}
			}

			// Creates a keyOnIndices and keyOffIndices array of instant indices for each Key in the played range.
			function setKeyInstantIndices(keyInstantIndices, instants)
			{
				var i, instantIndex, nInstants = instants.length, instant, nOnOrOffs, noteOn, noteOff;

				function initializeKeyInstantIndices(keyInstantIndices, bottomKey, topKey)
				{
					var i, keyIndices;

					keyInstantIndices.length = 0; // the keyboard1.keyInstantIndices array
					for(i = bottomKey; i <= topKey; ++i)
					{
						keyIndices = {};
						keyIndices.keyOnIndices = [];
						keyIndices.keyOffIndices = [];
						keyIndices.index = 0; // index in both the above arrays
						keyInstantIndices.push(keyIndices);
					}
				}

				initializeKeyInstantIndices(keyInstantIndices, keyRange.bottomKey, keyRange.topKey); // keyRange was set in keyboard1.init().

				for(instantIndex = 0; instantIndex < nInstants; ++instantIndex)
				{
					instant = instants[instantIndex];
					if(instant.noteOffs)
					{
						nOnOrOffs = instant.noteOffs.length;
						for(i = 0; i < nOnOrOffs; ++i)
						{
							noteOff = instant.noteOffs[i];
							keyInstantIndices[noteOff.notatedKey - keyRange.bottomKey].keyOffIndices.push(instantIndex);
						}
					}
					if(instant.noteOns)
					{
						nOnOrOffs = instant.noteOns.length;
						for(i = 0; i < nOnOrOffs; ++i)
						{
							noteOn = instant.noteOns[i];
							keyInstantIndices[noteOn.notatedKey - keyRange.bottomKey].keyOnIndices.push(instantIndex);
						}
					}
				}
			}

			setInstants(instants, inputTracks, trackIsOnArray, startMarkerMsPosInScore, endMarkerMsPosInScore);

			setSeqsAndTrackWorkers(instants, trackWorkers, outputTracks);

			setKeyInstantIndices(keyInstantIndices, instants);

			currentInstantIndex = 0; // the initial index in instants to perform
			indexPlayed = -1; // is set to currentInstantIndex when instants[currentInstantIndex] is played
		}

		sequenceRecording = recording;

		resetChannels(outputDevice, outputTracks.length);

		resetContinuousControllerOptions(outputTracks.length);

		initPlay(trackIsOnArray, keyInstantIndices, instants, trackWorkers, startMarkerMsPosInScore, endMarkerMsPosInScore);

		performanceStartTime = performance.now();
		setState("running");
	},

	publicAPI =
	{
		init: init,

		play: play,  
		stop: stop,
		isStopped: isStopped,
		isRunning: isRunning,

		handleMIDIInputEvent: handleMIDIInputEvent
	};
	// end var

	handleMIDIInputEventForwardDeclaration = handleMIDIInputEvent;

	return publicAPI;

}());
