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
	allSeqMsPositions = [],
	indexPlayed, // initialized to currentMsPosIndex when the index is played.
	inputTracks,
	outputTracks,
	trackWorkers = [], // an array of webWorkers, one per outputTrack (=trackIndex).
	noteInfoss = [],
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

	resetChannel = function(outputDevice, channelIndex)
	{
		outputDevice.send(allControllersOffMessages[channelIndex], performance.now());
		outputDevice.send(allNotesOffMessages[channelIndex], performance.now());
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
				resetChannel(outputDevice, msg.channelIndex);
				break;
			case "workerCompleted":
				// TrackWorkers send this message to say that they are not going to send any more midiMessages from their final trk.
				resetChannel(outputDevice, msg.channelIndex);
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

    		for(i = 0; i < noteInfoss.length; ++i)
    		{
    			noteInfos = noteInfoss[i];
    			if(noteInfos.seqs !== undefined) // some noteInfoss may not have seqs...
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
    						seq.doNoteOff(); // stops according to the inputControls set in the seq's constructor
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
    			noteInfos = noteInfoss[keyIndex]; // This is the same object as for the corresponding noteOn.
				seq = noteInfos.seqs[noteInfos.seqs.index]; // (the key's currently playing seq).
    			if(seq !== undefined && seq.triggeredOn)// will be false if the key was pressed prematurely;
    			{
    				// stop() is called to stop the performance when hasCompleted is true for all the TrackWorkers.

    				if(currentMsPosIndex < allSeqMsPositions.length - 1)
    				{
    					seq.doNoteOff();  // stops the seq according to the inputControls set in the its constructor
    					nextChordIndex = seq.nextChordIndex; // The index, in allSeqMsPositions, of the following chord (in any input track).
    					while(currentMsPosIndex < nextChordIndex) // advance until currentMsPosIndex === nextChordIndex
    					{
    						currentMsPosIndex++;
    						reportMsPositionInScore(allSeqMsPositions[currentMsPosIndex]);
    					
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
    			noteInfos = noteInfoss[keyIndex];
    			if(noteInfos.seqs.length > noteInfos.seqs.index) // some noteInfoss may not have seqs...
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
    							reportMsPositionInScore(allSeqMsPositions[currentMsPosIndex]);
    							advanceCurrentKeyIndicesTo(currentMsPosIndex); // see above
    							seq = noteInfos.seqs[noteInfos.seqs.index];
    						}
    						// Start playing the seq using the inputControls set in its constructor.
    						console.log("velocity=" + velocity.toString(10));
    						seq.doNoteOn(velocity);
    						indexPlayed = currentMsPosIndex;
    					}
    				}
    			}
    		}
    	}

    	function handleController(data)
    	{
    		var i, nWorkers = trackWorkers.length;

    		for(i = 0; i < nWorkers; ++i)
    		{
    			// Each trackWorker simply sets the low nibble of data[0] to its channel,
    			// before posting the data back to handleMidiMessage as a midiMessage.
    			trackWorkers[i].postMessage({ action: "doController", data: data });
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
    					// setSpeedFactor is called inside handleNoteOn(...) because currentIndex needs to be >= 0.
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
    				handleController(inputEvent.data);
    				break;
    			case CMD.AFTERTOUCH: // produced by the EWI breath controller
    				// AFTERTOUCH.data[1] is the MIDIpitch to which to apply the aftertouch
    				// AFTERTOUCH.data[2] is the amount of pressure 0..127.
    				handleController(inputEvent.data);
    				break;
    			case CMD.PITCH_WHEEL: // EWI pitch bend up/down controllers, EMU pitch wheel
    				handleController(inputEvent.data);
    				break;
    			case CMD.CONTROL_CHANGE: // sent when other controller values change.
    				handleController(inputEvent.data);
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

		function initPlay(trackIsOnArray, noteInfoss, allSeqMsPositions, trackWorkers, startMarkerMsPosInScore, endMarkerMsPosInScore)
		{
			var
			nOutputTracks = outputTracks.length,
			nTracks = nOutputTracks + inputTracks.length,
			chordIndexPerInputTrack = [],
			outputTrackMidiChannels = [],
			inputTracksInputControls = [];

			function initOutputTrackMidiChannels(outputTrackMidiChannels, outputTracks)
			{
				var i;

				outputTrackMidiChannels.length = [];

				for(i = 0; i < outputTracks.length; i++)
				{
					outputTrackMidiChannels.push(outputTracks[i].midiChannel);
				}
			}

			// Sets chordIndexPerInputTrack to contain the first chordIndex in each inputTrack's inputObjects
			// at or after startMarkerMsPosInScore and before endMarkerMsPosInScore.
			// If there is no such chord in a track, the index is set to -1.
			function initChordIndexPerInputTrack(chordIndexPerInputTrack, inputTracks, startMarkerMsPosInScore, endMarkerMsPosInScore)
			{
				var i, j, initialChordIndex, inputObjects, inputObject;

				chordIndexPerInputTrack.length = 0;

				for(i = 0; i < inputTracks.length; i++)
				{
					inputObjects = inputTracks[i].inputObjects;
					initialChordIndex = -1; // default, when no chord in range.
					for(j = 0; j < inputObjects.length; j++)
					{
						inputObject = inputObjects[j];
						if(inputObject instanceof _AP.inputChord.InputChord
						&& inputObject.msPositionInScore >= startMarkerMsPosInScore
						&& inputObject.msPositionInScore < endMarkerMsPosInScore)
						{
							initialChordIndex = j;
							break;
						}

					}
					chordIndexPerInputTrack.push(initialChordIndex);
				}
			}

			function initTrackWorkers(trackWorkers, outputTrackMidiChannels)
			{
				var i, worker;

				trackWorkers.length = 0;

				for(i = 0; i < outputTrackMidiChannels.length; i++)
				{
					worker = new window.Worker("ap/TrackWorker.js");
					worker.addEventListener("message", handleTrackMessage);
					worker.postMessage({ action: "init", trackIndex: i, channelIndex: outputTrackMidiChannels[i] });
					// worker.hasCompleted is set to false when a trk is added (in the Seq constructor),
					// and back to true when the worker says that it has completed its last trk.
					worker.hasCompleted = true;
					trackWorkers.push(worker);
				}
			}

			// Sets inputTracksInputControls to contain the performer's inputControls current in each inputTrack when the span starts.
			// (Shunts in all inputObjects in all inputTracks (playing or not) from the start of the score.)
			// Sets all otherwise undefined values to a default (empty) InputControls object.
			function initCurrentInputTracksInputControls(inputTracksInputControls, inputTracks, nOutputTracks, nTracks, startMarkerMsPosInScore)
			{
				var i, inputTrackIndex = 0, inputTrack, inputControls;

				// Returns the most recent inputObject.InputControls object at or before startMarkerMsPosInScore.
				// If there are no such InputControls objects, a new default InputControls object is returned.
				function getCurrentTrackInputControlsObj(inputObjects, startMarkerMsPosInScore)
				{
					var i, nInputObjects = inputObjects.length, inputObject, returnInputControlsObj = null;

					for(i = 0; i < nInputObjects; ++i)
					{
						inputObject = inputObjects[i];
						if(inputObject.inputControls !== undefined)
						{
							returnInputControlsObj = inputObject.inputControls;
						}
						if(inputObject.msPositionInScore >= startMarkerMsPosInScore)
						{
							break;
						}
					}

					if(returnInputControlsObj === null)
					{
						returnInputControlsObj = new _AP.inputControls.InputControls({}); // a new, empty InputControls object
					}

					return returnInputControlsObj;
				}
				
				inputTracksInputControls.length = 0;

				for(i = nOutputTracks; i < nTracks; ++i)
				{
					inputTrack = inputTracks[inputTrackIndex++];
					inputControls = getCurrentTrackInputControlsObj(inputTrack.inputObjects, startMarkerMsPosInScore);
					inputTracksInputControls.push(inputControls); // default is an InputControls object having no defined attributes.
				}
			}

			// Called by both the following functions.
			// Returns an object having the attributes trackIndex, chordIndex, noteOnSeqPosition and noteOffSeqPosition.
			// trackIndex and chordIndex, are the location of the chord in the inputTracks, whereby
			// the top inputTrack has trackIndex === 0.
			// noteOnSeqPosition and noteOffSeqPosition are defined if seqs are to be sent from the noteOn and noteOff
			// positions respectively.
			// Returns null when there are no more inputChords earlier than endMarkerMsPosInScore.
			function getNextInputChordData(inputTracks, chordIndexPerInputTrack, endMarkerMsPosInScore)
			{
				var i, trackIndex, msPos, inputChord, inputNote, inputNotes, nInputNotes,
					minMsPos = Number.MAX_VALUE, inputChordData = null;

				// Returns -1 if there is no chord before endMarkerMsPosInScore.
				function incrementChordIndex(inputObjects, currentChordIndex, endMarkerMsPosInScore)
				{
					var i, inputObject, nextIndex = currentChordIndex + 1, returnIndex = -1;

					for(i = nextIndex; i < inputObjects.length; i++)
					{
						inputObject = inputObjects[i];
						if(inputObject.msPositionInScore >= endMarkerMsPosInScore)
						{
							break;
						}
						if(inputObject instanceof _AP.inputChord.InputChord)
						{
							returnIndex = i;
							break;
						}
					}

					return returnIndex;
				}

				for(i = 0; i < inputTracks.length; i++)
				{
					if(chordIndexPerInputTrack[i] !== -1)
					{
						msPos = inputTracks[i].inputObjects[chordIndexPerInputTrack[i]].msPositionInScore;
						if(msPos < endMarkerMsPosInScore && msPos < minMsPos)
						{
							minMsPos = msPos;
							trackIndex = i;
						}
					}
				}

				if(minMsPos < Number.MAX_VALUE)
				{
					inputChordData = {};
					inputChordData.trackIndex = trackIndex;
					inputChordData.chordIndex = chordIndexPerInputTrack[trackIndex];
					inputChord = inputTracks[trackIndex].inputObjects[chordIndexPerInputTrack[trackIndex]];
					inputNotes = inputChord.inputNotes;
					nInputNotes = inputNotes.length;
					for(i = 0; i < nInputNotes; ++i)
					{
						inputNote = inputNotes[i];
						if(inputNote.noteOn !== undefined && inputNote.noteOn.seq !== undefined)
						{
							inputChordData.noteOnSeqPosition = inputChord.msPositionInScore;
						}
						if(inputNote.noteOff !== undefined && inputNote.noteOff.seq !== undefined)
						{
							inputChordData.noteOffSeqPosition = inputChord.msPositionInScore + inputChord.msDurationInScore;
						}
					}
					
					chordIndexPerInputTrack[trackIndex] = incrementChordIndex(inputTracks[trackIndex].inputObjects, chordIndexPerInputTrack[trackIndex], endMarkerMsPosInScore);
				}

				return inputChordData;
			}

			function initAllSeqMsPositions(allSeqMsPositions, chordIndexPerInputTrack, inputTracks, trackIsOnArray, endMarkerMsPosInScore)
			{
				var trackIndex, inputChordData;

				allSeqMsPositions.length = 0;

				inputChordData = getNextInputChordData(inputTracks, chordIndexPerInputTrack, endMarkerMsPosInScore);
				while(inputChordData !== null)
				{
					trackIndex = inputChordData.trackIndex;
					if(trackIsOnArray[trackIndex])
					{
						if(inputChordData.noteOnSeqPosition !== undefined)
						{
							allSeqMsPositions.push(inputChordData.noteOnSeqPosition);
						}
						if(inputChordData.noteOffSeqPosition !== undefined)
						{
							allSeqMsPositions.push(inputChordData.noteOffSeqPosition);
						}
					}
					inputChordData = getNextInputChordData(inputTracks, chordIndexPerInputTrack, endMarkerMsPosInScore);
				}

				// remove duplicates
				allSeqMsPositions = allSeqMsPositions.reduce(function(a, b)
				{
					if(a.indexOf(b) < 0)
					{
						a.push(b);
					}
					return a;
				}, []);

				// numeric sort
				allSeqMsPositions.sort(function(a, b) { return a - b; });

				allSeqMsPositions.push(endMarkerMsPosInScore);
			}

			// Creates new Seqs, pushes the seq.trks into the trackWorkers, and the seqs into 
			function initNoteInfoss(noteInfoss, trackWorkers, allSeqMsPositions, chordIndexPerInputTrack, inputTracks, trackIsOnArray, shuntedChordInputControls, endMarkerMsPosInScore)
			{
				var i, inputChordData, trackIndex, inputObjects, inputChord, chordIndex, inputChordInputControls,
					inputChordIndices = {};

				function initializeNoteInfoss(noteInfoss, bottomKey, topKey)
				{
					var noteInfos;

					noteInfoss.length = 0; // the keyboard1.noteInfoss array
					// create an empty noteInfos object per midi key
					for(i = bottomKey; i <= topKey; ++i) // keyRange was set in keyboard1.init().
					{
						noteInfos = [];
						noteInfos.index = 0;
						noteInfoss.push(noteInfos);
					}
				}

				function setInputChordIndices(inputChordIndices, allSeqMsPositions, inputChord)
				{
					var i, startMsPos = inputChord.msPositionInScore, endMsPos, chordIndex, nextChordIndex = -1;
					
					endMsPos = startMsPos + inputChord.msDurationInScore;

					chordIndex = allSeqMsPositions.indexOf(startMsPos);

					for(i = chordIndex; i < allSeqMsPositions.length; i++)
					{
						if(allSeqMsPositions[i] >= endMsPos)
						{
							nextChordIndex = i;
							break;
						}
					}

					inputChordIndices.chordIndex = chordIndex;
					inputChordIndices.nextChordIndex = nextChordIndex;
				}

				// Appends noteInfo objects to each key's noteInfos array.
				function setNoteInfoss(noteInfoss, trackWorkers, inputChord, inputChordIndices, chordInputControls, bottomKey)
				{
					var i, inputNotes, nInputNotes, inputNote, noteInfo, noteInfos;

					// Returns a noteInfo object which may have the following attributes:
					// noteInfo.inputControls // compulsory. The note-level inputControls (Can be overridden by lower level inputControls.)
					// noteInfo.onSeq: Can be undefined. The seq to play when a noteOn arrives.
					// noteInfo.offSeq: Can be undefined. The seq to play when a noteOff arrives.
					//      		Each seq is an array of trks (that are initialised with clones of midiChords and pointers to midiRests).E
					//              Each seq may have an inputControls attribute that overrides the noteInfo.inputControls.
					// noteInfo.onTrkOffs: Can be undefined. An array of trkOff objects.
					//                      Each trkOff object has trackIndex and msPosition attributes that identify a trk.
					//                      Each trkOff may have an inputControls attribute that overrides the noteInfo.inputControls.
					// noteInfo.pressures: Can be undefined.  An array of pressure objects identifying tracks that will be sent pressure info.
					//                      Each pressure object has trackIndex attribute that identifies a track.
					//                      Each pressure object may have an inputControls attribute that overrides the noteInfo.inputControls.
					// noteInfo.offTrkOffs: Can be undefined. An array of trkOff objects (see noteInfo.onTrkOffs above).
					function getNoteInfo(inputNote, chordInputControls)
					{
						var i, seqMsPosition, seq, pressure, noteInfo = {};

						// inputNote can have the following fields (all except .notatedKey can be undefined)
						//	.notatedKey
						//	.noteOn
						//	.pressures
						//	.noteOff
						if(inputNote.inputControls === undefined)
						{
							inputNote.inputControls = chordInputControls;
						}

						if(inputNote.noteOn !== undefined)
						{
							if(inputNote.noteOn.seq !== undefined)
							{
								seqMsPosition = inputChord.msPositionInScore;
								seq = inputNote.noteOn.seq;
								if(seq.inputControls === undefined)
								{
									seq.inputControls = inputNote.inputControls;
								}
								noteInfo.onSeq = new _AP.seq.Seq(seqMsPosition, inputChordIndices.chordIndex, inputChordIndices.nextChordIndex, seq, trackWorkers);
							}
							if(inputNote.noteOn.trkOffs !== undefined)
							{
								if(inputNote.noteOn.trkOffs.inputControls === undefined)
								{
									inputNote.noteOn.trkOffs.inputControls = inputNote.inputControls;
								}
								noteInfo.onTrkOffs = inputNote.noteOn.trkOffs;
							}
						}
						if(inputNote.pressures !== undefined)
						{
							if(inputNote.pressures.inputControls === undefined)
							{
								inputNote.pressures.inputControls = inputNote.inputControls;
							}
							for(i = 0; i < inputNote.pressures.length; ++i)
							{
								pressure = inputNote.pressures[i];
								if(pressure.inputControls === undefined)
								{
									pressure.inputControls = inputNote.pressures.inputControls;
								}
							}
							noteInfo.pressures = inputNote.pressures;
						}
						if(inputNote.noteOff !== undefined)
						{
							if(inputNote.noteOff.seq !== undefined)
							{
								seq = inputNote.noteOff.seq;
								if(seq.inputControls === undefined)
								{
									seq.inputControls = inputNote.inputControls;
								}
								seqMsPosition = inputChord.msPositionInScore + inputChord.msDurationInScore;
								noteInfo.offSeq = new _AP.seq.Seq(seqMsPosition, inputChordIndices.chordIndex, inputChordIndices.nextChordIndex, seq, trackWorkers);
							}
							if(inputNote.noteOff.trkOffs !== undefined)
							{
								if(inputNote.noteOff.trkOffs.inputControls === undefined)
								{
									inputNote.noteOff.trkOffs.inputControls = inputNote.inputControls;
								}
								noteInfo.offTrkOffs = inputNote.noteOff.trkOffs;
							}
						}
						return noteInfo;
					}

					console.assert(inputChord.inputNotes !== undefined && inputChord.inputNotes.length > 0);
					console.assert(chordInputControls !== undefined);
					
					inputNotes = inputChord.inputNotes;
					nInputNotes = inputNotes.length;
					for(i = 0; i < nInputNotes; ++i)
					{
						inputNote = inputNotes[i];

						console.assert(inputNote.notatedKey !== undefined, "Error: every inputNote must have a notatedKey.");

						noteInfo = getNoteInfo(inputNote, chordInputControls);
						// The noteInfos.index fields have all been initialized to 0.
						noteInfos = noteInfoss[inputNote.notatedKey - bottomKey];
						noteInfos.push(noteInfo);
					}
				}

				/* begin initNoteInfoss() */
				initializeNoteInfoss(noteInfoss, keyRange.bottomKey, keyRange.topKey);

				inputChordData = getNextInputChordData(inputTracks, chordIndexPerInputTrack, endMarkerMsPosInScore);
				while(inputChordData !== null)
				{
					trackIndex = inputChordData.trackIndex;
					chordIndex = inputChordData.chordIndex;
					if(trackIsOnArray[trackIndex])
					{
						inputObjects = inputTracks[trackIndex].inputObjects;
						inputChord = inputObjects[chordIndex];
						if(inputChord.inputControls !== undefined)
						{
							shuntedChordInputControls[trackIndex] = inputChord.inputControls;
						}
						inputChordInputControls = shuntedChordInputControls[trackIndex];

						console.assert(inputChordInputControls !== undefined);

						setInputChordIndices(inputChordIndices, allSeqMsPositions, inputChord);

						setNoteInfoss(noteInfoss, trackWorkers, inputChord, inputChordIndices, inputChordInputControls, keyRange.bottomKey);
					}
					inputChordData = getNextInputChordData(inputTracks, chordIndexPerInputTrack, endMarkerMsPosInScore);
				}
			}

			/*** begin initPlay() ***/
			initOutputTrackMidiChannels(outputTrackMidiChannels, outputTracks);

			initTrackWorkers(trackWorkers, outputTrackMidiChannels); // must be done before creating the Seqs

			initCurrentInputTracksInputControls(inputTracksInputControls, inputTracks, nOutputTracks, nTracks, startMarkerMsPosInScore);

			initChordIndexPerInputTrack(chordIndexPerInputTrack, inputTracks, startMarkerMsPosInScore, endMarkerMsPosInScore);

			initAllSeqMsPositions(allSeqMsPositions, chordIndexPerInputTrack, inputTracks, trackIsOnArray, endMarkerMsPosInScore);
	
			currentMsPosIndex = 0; // the initial index in allSeqMsPositions to perform
			indexPlayed = -1; // is set to currentMsPosIndex when the index is played

			// initChordIndexPerInputTrack() *again*.
			initChordIndexPerInputTrack(chordIndexPerInputTrack, inputTracks, startMarkerMsPosInScore, endMarkerMsPosInScore);

			initNoteInfoss(noteInfoss, trackWorkers, allSeqMsPositions, chordIndexPerInputTrack, inputTracks, trackIsOnArray, inputTracksInputControls, endMarkerMsPosInScore);
		}

		sequenceRecording = recording;

		for(channelIndex = 0; channelIndex < outputTracks.length; channelIndex++)
		{
			resetChannel(outputDevice, channelIndex);
		}

		initPlay(trackIsOnArray, noteInfoss, allSeqMsPositions, trackWorkers, startMarkerMsPosInScore, endMarkerMsPosInScore);

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
