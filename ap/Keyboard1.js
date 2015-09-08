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
* //          reportMsPositionInScore(msPositionToReport);
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

/*jslint bitwise: true, nomen: true, plusplus: true, white: true, continue: true */
/*global _AP: false,  window: false,  document: false, performance: false, console: false, alert: false, XMLHttpRequest: false */

_AP.namespace('_AP.keyboard1');

_AP.keyboard1 = (function()
{
	"use strict";

	var
	inputDevice,
	outputDevice,

	currentMsPosIndex, // initialized to 0 when playing starts. Is the index in the following array.
	verticalNoteArrays = [],
	indexPlayed, // initialized to currentMsPosIndex when the index is played.
	inputTracks,
	outputTracks,
	trackWorkers = [], // an array of webWorkers, one per outputTrack (=trackIndex).
	keyNoteArrays = [],
	keyRange, // keyRange.bottomKey and keyRange.topKey are the bottom and top input midi key values notated in the score.

	reportEndOfSpan, // callback -- called here as reportEndOfSpan(sequenceRecording, performanceMsDuration);
	reportMsPositionInScore, // callback -- called here as reportMsPositionInScore(msPositionToReport);

	// (performance.now() - performanceStartTime) is the real time elapsed since the start of the performance.
	performanceStartTime = -1,  // set in play(), used by stop(), run()

	// used by setState()
	stopped = true, // stop(), isStopped()

	sequenceRecording, // the sequence being recorded.

	allControllersOffMessages = [],
	allNotesOffMessages = [],

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

		switch(msg.action)
		{
			case "midiMessage":
				// Note that Jazz 1.2 does not support timestamps. It always sends messages immediately.
				outputDevice.send(msg.midiMessage, performance.now());
				// TODO: recording
				//if(sequenceRecording !== undefined && sequenceRecording !== null)
				//{
				//	// The moments are recorded with their current (absolute DOMHRT) timestamp values.
				//	// These values are adjusted relative to the first moment.timestamp
				//	// before saving them in a Standard MIDI File.
				//	// (i.e. the value of the earliest timestamp in the recording is
				//	// subtracted from all the timestamps in the recording) 
				//	sequenceRecording.trackRecordings[currentMoment.messages[0].channel()].addLiveScoreMoment(currentMoment);
				//}
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

    	// increment noteInfos.seq.index until all noteInfos.seqs are >= currentMsPosIndex
    	function advanceCurrentKeyIndicesTo(currentMsPosIndex)
    	{
    		var i, noteInfos, seq;

    		for(i = 0; i < keyNoteArrays.length; ++i)
    		{
    			noteInfos = keyNoteArrays[i];
    			if(noteInfos.seqs !== undefined) // some keyNoteArrays may not have seqs...
    			{
    				while(noteInfos.seqs.index > noteInfos.seqs.length)
    				{
    					seq = noteInfos.seqs[noteInfos.seqs.index];
    					if(seq.chordIndex >= currentMsPosIndex)
    					{
    						break;
    					}
    					if(seq.triggeredOn === true && seq.triggeredOff === false)
    					{
    						seq.doNoteOff(); // stops according to the trkOptions set in the seq's constructor
    					}
    					noteInfos.seqs.index++;
    				}
    			}
    		}
    	}

    	function handleNoteOff(key)
    	{
    		var keyIndex = key - keyRange.bottomKey, noteInfos, seq,
			nextChordIndex;

    		if(key >= keyRange.bottomKey && key <= keyRange.topKey)
    		{
    			noteInfos = keyNoteArrays[keyIndex]; // This is the same object as for the corresponding noteOn.
				seq = noteInfos.seqs[noteInfos.seqs.index]; // (the key's currently playing seq).
    			if(seq !== undefined && seq.triggeredOn)// will be false if the key was pressed prematurely;
    			{
    				// stop() is called to stop the performance when hasCompleted is true for all the TrackWorkers.

    				if(currentMsPosIndex < verticalNoteArrays.length - 1)
    				{
    					seq.doNoteOff();  // stops the seq according to the trkOptions set in the its constructor
    					nextChordIndex = seq.nextChordIndex; // The index, in verticalNoteArrays, of the following chord (in any input track).
    					while(currentMsPosIndex < nextChordIndex) // advance until currentMsPosIndex === nextChordIndex
    					{
    						currentMsPosIndex++;
    						reportMsPositionInScore(verticalNoteArrays[currentMsPosIndex]);
    					
    						advanceCurrentKeyIndicesTo(currentMsPosIndex);
    					}
    				}
    			}
    		}
    	}

    	function handleNoteOn(key, velocity)
    	{
    		var keyIndex = key - keyRange.bottomKey, noteInfos, chordIndex, seq;

    		if(key >= keyRange.bottomKey && key <= keyRange.topKey)
    		{
    			noteInfos = keyNoteArrays[keyIndex];
    			if(noteInfos.seqs.length > noteInfos.seqs.index) // some keyNoteArrays may not have seqs...
    			{
    				seq = noteInfos.seqs[noteInfos.seqs.index];
    				if(seq !== undefined)
    				{
    					chordIndex = seq.chordIndex;
    					if(chordIndex === currentMsPosIndex || ((chordIndex === currentMsPosIndex + 1) && indexPlayed === currentMsPosIndex))  // legato realization
    					{
    						if(chordIndex === currentMsPosIndex + 1)
    						{
    							currentMsPosIndex++;
    							reportMsPositionInScore(verticalNoteArrays[currentMsPosIndex]);
    							advanceCurrentKeyIndicesTo(currentMsPosIndex); // see above
    							seq = noteInfos.seqs[noteInfos.seqs.index];
    						}
    						// Start playing the seq using the trkOptions set in its constructor.
    						console.log("velocity=" + velocity.toString(10));
    						seq.start(velocity);
    						indexPlayed = currentMsPosIndex;
    					}
    				}
    			}
    		}
    	}

    	// called when channel pressure changes
    	// Achtung: value is data[1]
    	function handleChannelPressure(data)
    	{
    		var i, nWorkers = trackWorkers.length;

    		for(i = 0; i < nWorkers; ++i)
    		{
    			trackWorkers[i].postMessage({ action: "doController", controller: "pressure", value: data[1] }); // Achtung: data[1]
    		}
    	}

    	// called when modulation wheel changes
    	// Achtung: value is data[2]
    	function handleModWheel(data)
    	{
    		var i, nWorkers = trackWorkers.length;

    		for(i = 0; i < nWorkers; ++i)
    		{
    			trackWorkers[i].postMessage({ action: "doController", controller: "modWheel", value: data[2] }); // Achtung: data[2]
    		}
    	}

    	function handlePitchWheel(data)
    	{
    		var i, nWorkers = trackWorkers.length;

    		for(i = 0; i < nWorkers; ++i)
    		{
    			trackWorkers[i].postMessage({ action: "doPitchWheel", data1: data[1], data2: data[2] });
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
	//      reportMsPositionInScore(msPositionToReport);
	// The msPosition it passes back is the original number of milliseconds from the start of
	// the score (taking the global speed option into account). This value is used to identify
	// chord and rest symbols in the score, and so to synchronize the running cursor.
	// Moments whose msPositionInScore is to be reported are given chordStart or restStart
	// attributes before play() is called.
	init = function(inputDeviceArg, outputDeviceArg, tracksData, reportEndOfPerfCallback, reportMsPosCallback)
	{
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

		initChannelResetMessages(outputTracks.length);

		setState("stopped");
	},

	// play()
	//
	// trackIsOnArray[trackIndex] returns a boolean which determines whether each output or input
	// track will be played or not. This array is read only.
	// recording is a Sequence to which timestamped moments are added as they are performed.
	// It should be an empty Sequence having the same number of output tracks as the score.
	play = function(trackIsOnArray, startMarkerMsPosInScore, endMarkerMsPosInScore, recording)
	{
		var channelIndex;

		function initPlay(trackIsOnArray, keyNoteArrays, verticalNoteArrays, trackWorkers, startMarkerMsPosInScore, endMarkerMsPosInScore)
		{
			function initTrackWorkers(trackWorkers, outputTracks)
			{
				var i, worker;

				trackWorkers.length = 0;

				for(i = 0; i < outputTracks.length; i++)
				{
					worker = new window.Worker("ap/TrackWorker.js");
					worker.addEventListener("message", handleTrackMessage);
					worker.postMessage({ action: "init", trackIndex: i, channelIndex: outputTracks[i].midiChannel });
					// worker.hasCompleted is set to false when a trk is added (in the Seq constructor),
					// and back to true when the worker says that it has completed its last trk.
					worker.hasCompleted = true;
					trackWorkers.push(worker);
				}
			}

			// Returns an array of (array of performed inputNote), ordered by msPosition (without the endMarkerMsPosInScore).
			// Each contained array has an msPosition attribute, and contains all the performing inputNotes that start at that msPosition,
			// regardless of inputTrack. All the msPositions are >= startMarkerMsPosInScore and < endMarkerMsPosInScore.
			// Each trk is given a trkOptions attribute object containing the options it needs. These depend on whether the
			// trk is inside a seq, pressures, pitchWheels or modWheels object.
			// The trkOptions objects that have been consumed, and are no longer to be used, are set to undefined.
			function getVerticalInputNoteArrays(inputTracks, trackIsOnArray, startMarkerMsPosInScore, endMarkerMsPosInScore)
			{
				var trackIndex, nTracks, ioIndex, inputObjects, nInputObjects, msPosition, msDuration, inputChord,
					verticalNotesArrays = [], performedNote, performedNotes, vArray, i, nPerformedNotes,
					chordTrkOptions, previousChordTrkOptions;

				function getPerformedNotes(inputNotes, trackIsOnArray)
				{
					var performedNotes = [], i, nInputNotes = inputNotes.length;

					function usesTrack(inputNote, trackIsOnArray)
					{
						var rval = false;

						function hasTrack(trkArray, trackIsOnArray)
						{
							var rval = false, i, nTrks = trkArray.length;
							for(i = 0; i < nTrks; ++i)
							{
								if(trackIsOnArray[trkArray[i].trackIndex])
								{
									rval = true;
									break;
								}
							}
							return rval;
						}

						if(hasTrack(inputNote.noteOn.seq, trackIsOnArray)
						|| hasTrack(inputNote.noteOff.trkOffs, trackIsOnArray)
						|| hasTrack(inputNote.noteOn.pressures, trackIsOnArray)
						|| hasTrack(inputNote.noteOn.pitchWheels, trackIsOnArray)
						|| hasTrack(inputNote.noteOn.modWheels, trackIsOnArray)
						|| hasTrack(inputNote.noteOn.trkOffs, trackIsOnArray)
						|| hasTrack(inputNote.noteOff.seq, trackIsOnArray)
						|| hasTrack(inputNote.noteOff.pitchWheels, trackIsOnArray)
						|| hasTrack(inputNote.noteOff.modWheels, trackIsOnArray))
						{
							rval = true;
						}
						return rval;
					}

					for(i = 0; i < nInputNotes; ++i)
					{
						if(usesTrack(inputNotes[i], trackIsOnArray))
						{
							performedNotes.push(inputNotes[i]);
						}
					}

					return performedNotes;
				}

				function findVArray(verticalNotesArrays, msPosition)
				{
					var i, nArrays = verticalNotesArrays.length, vArray = null;

					for(i = 0; i < nArrays; ++i)
					{
						if(verticalNotesArrays[i].msPosition === msPosition)
						{
							vArray = verticalNotesArrays[i];
							break;
						}
					}
					return vArray;
				}

				function setNoteOnOffTrkOptions(note, chordTrkOptions)
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

						// Seqs use the options: pedal, velocity and trkOff
						function setSeqTrkOptions(seq, noteTrkOptions, chordTrkOptions)
						{
							var i, nTrks = seq.length, newTrkOptions, seqTrkOptions = seq.trkOptions, trkTrkOptions,
								pedalOpt, velocityOpt, minVelocityOpt, trkOffOpt;

							for(i = 0; i < nTrks; ++i)
							{
								newTrkOptions = {};
								trkTrkOptions = seq[i].trkOptions;
								pedalOpt = getOption("pedal", trkTrkOptions, seqTrkOptions, noteTrkOptions, chordTrkOptions);
								if(pedalOpt !== undefined)
								{
									newTrkOptions.pedal = pedalOpt;
								}
								velocityOpt = getOption("velocity", trkTrkOptions, seqTrkOptions, noteTrkOptions, chordTrkOptions);
								if(velocityOpt !== undefined)
								{
									minVelocityOpt = getOption("minVelocity", trkTrkOptions, seqTrkOptions, noteTrkOptions, chordTrkOptions);
									newTrkOptions.velocity = velocityOpt;
									newTrkOptions.minVelocity = minVelocityOpt;
								}
								trkOffOpt = getOption("trkOff", trkTrkOptions, seqTrkOptions, noteTrkOptions, chordTrkOptions);
								if(trkOffOpt !== undefined)
								{
									newTrkOptions.trkOff = trkOffOpt;
								}
								seq[i].trkOptions = newTrkOptions;
							}
							seq.trkOptions = undefined;
						}

						function setControlTrkOptions(optionString, controls, noteTrkOptions, chordTrkOptions)
						{
							var i, nControls = controls.length, newTrkOptions,
								controlsTrkOptions = controls.trkOptions, trkTrkOptions,
								option, minVolumeOpt, maxVolumeOpt;

							for(i = 0; i < nControls; ++i)
							{
								newTrkOptions = {};
								trkTrkOptions = controls[i].trkOptions;
								option = getOption(optionString, trkTrkOptions, controlsTrkOptions, noteTrkOptions, chordTrkOptions);
								if(option !== undefined)
								{
									newTrkOptions[optionString] = option;
									switch(option)
									{
										case "volume":
											newTrkOptions.minVolume = getOption("minVolume", trkTrkOptions, controlsTrkOptions, noteTrkOptions, chordTrkOptions);
											newTrkOptions.maxVolume = getOption("maxVolume", trkTrkOptions, controlsTrkOptions, noteTrkOptions, chordTrkOptions);
											break;
										case "pitch":
											newTrkOptions.pitchWheelDeviation = getOption("pitchWheelDeviation", trkTrkOptions, controlsTrkOptions, noteTrkOptions, chordTrkOptions);
											break;
										case "pan":
											newTrkOptions.panOrigin = getOption("panOrigin", trkTrkOptions, controlsTrkOptions, noteTrkOptions, chordTrkOptions);
											break;
										case "speed":
											newTrkOptions.speedDeviation = getOption("speedDeviation", trkTrkOptions, controlsTrkOptions, noteTrkOptions, chordTrkOptions);
											break;
										default:
											break;
									}
								}
								controls[i].trkOptions = newTrkOptions;
							}
							controls.trkOptions = undefined;
						}

						if(noteOnOff.seq !== undefined)
						{
							setSeqTrkOptions(noteOnOff.seq, chordTrkOptions);
						}
						if(noteOnOff.pressures !== undefined)
						{
							setControlTrkOptions("pressure", noteOnOff.pressures, noteTrkOptions, chordTrkOptions);
						}
						if(noteOnOff.pitchWheels !== undefined)
						{
							setControlTrkOptions("pitchWheel", noteOnOff.pitchWheels, noteTrkOptions, chordTrkOptions);
						}
						if(noteOnOff.modWheels !== undefined)
						{
							setControlTrkOptions("modWheel", noteOnOff.modWheels, noteTrkOptions, chordTrkOptions);
						}
					}

					if(note.noteOn)
					{
						setTrkOptions(note.noteOn, note.trkOptions, chordTrkOptions);
					}

					if(note.noteOff)
					{
						setTrkOptions(note.noteOff, note.trkOptions, chordTrkOptions);
					}
					note.trkOptions = undefined;
				}

				nTracks = inputTracks.length;
				for(trackIndex = 0; trackIndex < nTracks; ++trackIndex)
				{
					if(trackIsOnArray[trackIndex])
					{
						previousChordTrkOptions = null;
						inputObjects = inputTracks[trackIndex].inputObjects;
						nInputObjects = inputObjects.length;
						for(ioIndex = 0; ioIndex < nInputObjects; ++ioIndex)
						{
							if(inputObjects[ioIndex] instanceof _AP.inputChord.InputChord)
							{
								inputChord = inputObjects[ioIndex];
								msPosition = inputChord.msPositionInScore;
								msDuration = inputChord.msDurationInScore;
								if(inputChord.trkOptions)
								{
									chordTrkOptions = inputChord.trkOptions;
								}
								else if(previousChordTrkOptions !== null)
								{
									chordTrkOptions = previousChordTrkOptions;
								}
								else
								{
									chordTrkOptions = new _AP.trkOptions.TrkOptions({});
								}
								previousChordTrkOptions = chordTrkOptions;

								if(msPosition >= startMarkerMsPosInScore && msPosition < endMarkerMsPosInScore)
								{
									performedNotes = getPerformedNotes(inputChord.inputNotes, trackIsOnArray);

									if(performedNotes.length > 0)
									{
										nPerformedNotes = performedNotes.length;
										vArray = findVArray(verticalNotesArrays, msPosition);
										if(vArray === null)
										{
											vArray = [];
											vArray.msPosition = msPosition;
											verticalNotesArrays.push(vArray);
										}
										for(i = 0; i < nPerformedNotes; ++i)
										{
											performedNote = performedNotes[i];
											performedNote.msDuration = msDuration;
											setNoteOnOffTrkOptions(performedNote, chordTrkOptions);
											vArray.push(performedNote);
										}
									}
								}
							}
							inputChord.trkOptions = undefined;
						}
					}
				}

				// sort by msPositions
				verticalNotesArrays.sort(function(a, b) { return a.msPosition - b.msPosition; });

				return verticalNotesArrays;
			}

			// Creates an array of Note for each Key in the played range.
			// Also creates Seq objects for each note, and initialises the trackWorkers with the Seqs' trks,
			// The Seq constructor posts pushTrk messages to the appropriate trackWorkers.
			// Each trackWorker puts each incoming trk into an array, ordered by msPosition.
			function initKeyNoteArrays(keyNoteArrays, trackWorkers, verticalNoteArrays)
			{
				var vnaIndex, nVerticalNoteArrays, vnArray, noteIndex, nNotes, note;

				function initializeKeyNoteArrays(keyNoteArrays, bottomKey, topKey)
				{
					var i, notes;

					keyNoteArrays.length = 0; // the keyboard1.keyNoteArrays array
					// create an empty notes object per midi key
					for(i = bottomKey; i <= topKey; ++i) // keyRange was set in keyboard1.init().
					{
						notes = [];
						notes.index = 0;
						keyNoteArrays.push(notes);
					}
				}

				// Each Seq has the following attributes:
				// Used publicly at runtime: 
				//   seq.trks -- An array of trk.
				//   seq.triggeredOn   -- Is set to true when the seq is triggered On. Default is false.
				//   seq.triggeredOff  -- Is set to true when the seq is triggered Off. Default is false.
				// Seq = function(seqPositionInScore, seqTrks, trackWorkers)
				function setSeqs(note, msPosition, trackWorkers)
				{
					if(note.noteOn && note.noteOn.seq)
					{
						note.noteOnSeq = new _AP.seq.Seq(msPosition, note.noteOn.seq, trackWorkers);
					}
					if(note.noteOff && note.noteOff.seq)
					{
						note.noteOffSeq = new _AP.seq.Seq(msPosition + note.msDuration, note.noteOff.seq, trackWorkers);
					}
				}

				/* begin initKeyNoteArrays() */
				initializeKeyNoteArrays(keyNoteArrays, keyRange.bottomKey, keyRange.topKey); // keyRange was set in keyboard1.init().

				nVerticalNoteArrays = verticalNoteArrays.length;
				for(vnaIndex = 0; vnaIndex < nVerticalNoteArrays; ++vnaIndex)
				{
					vnArray = verticalNoteArrays[vnaIndex];
					nNotes = vnArray.length;
					for(noteIndex = 0; noteIndex < nNotes; ++noteIndex)
					{
						note = vnArray[noteIndex];
						setSeqs(note, vnArray.msPosition, trackWorkers);
						keyNoteArrays[note.notatedKey - keyRange.bottomKey].push(note);
					}
				}
			}

			/*** begin initPlay() ***/

			initTrackWorkers(trackWorkers, outputTracks); // must be done before creating the verticalNoteArrays

			verticalNoteArrays = getVerticalInputNoteArrays(inputTracks, trackIsOnArray, startMarkerMsPosInScore, endMarkerMsPosInScore);

			currentMsPosIndex = 0; // the initial index in verticalNoteArrays to perform
			indexPlayed = -1; // is set to currentMsPosIndex when the index is played

			initKeyNoteArrays(keyNoteArrays, trackWorkers, verticalNoteArrays);
		}

		sequenceRecording = recording;

		for(channelIndex = 0; channelIndex < outputTracks.length; channelIndex++)
		{
			resetChannel(outputDevice, channelIndex);
		}

		initPlay(trackIsOnArray, keyNoteArrays, verticalNoteArrays, trackWorkers, startMarkerMsPosInScore, endMarkerMsPosInScore);

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
