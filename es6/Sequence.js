import { Moment } from "./Moment.js";
import { Conductor } from "./Conductor.js";

let
	timer, // performance or conductor (use performance.now() or conductor.now())
	outputDevice, // either outputDevice.send function or conductor.midiThruSend function.
	tracks,

	previousTimestamp = null, // nextMoment()
	startOfRegion,
	previousMomtMsPosInScore, // nextMoment()
	currentMoment = null, // nextMoment(), resume(), tick()
	endOfConductedPerformance,

	//startMarkerMsPositionInScore,
	endMarkerMsPositionInScore,

	outputTracks,

	// used by setState()
	pausedMoment = null, // set by pause(), used by resume()
	stopped = true, // nextMoment(), stop(), pause(), resume(), isStopped()
	paused = false, // nextMoment(), pause(), isPaused()

	reportEndOfRegion, // callback
	reportEndOfPerformance, // callback. Set in play().
	reportNextMIDIObject,  // callback. Set in play().
	reportTickOverload, // callback. Set in play().

	lastReportedMsPosition = -1, // set by tick() used by nextMoment()
	msPositionToReport = -1,   // set in nextMoment() and used/reset by tick()
	nAsynchMomentsSentAtOnce = 1, // incremented in tick() if unequal timestamps are sent at the same time (inside the PREQUEUE loop). 

	regionSequence, // an array of objects having .startMsPosInScore, .endMsPosInScore and  .startMsPosInPerformance objects (is set in init())
	regionStartMsPositionsInScore, // the state of all the controls is restored in the moments at these positions.
	currentRegionIndex, // the index in the regionSequence and in the track._regionLinks arrays
	endRegionIndex, // the index of the final region that will play (< regionSequence.length)

	// (timer.now() - performanceStartTime) is the real time elapsed since the start of the performance.
	performanceStartTime = -1,  // set in play(), used by stop(), run()
	// (timer.now() - startTimeAdjustedForPauses) is the current performance duration excluding the durations of pauses.
	startTimeAdjustedForPauses = -1, // performanceStartTime minus the durations of pauses. Used in nextMoment()
	pauseStartTime = -1, // the timer.now() time at which the performance was paused.

	speed = 1, // in non-conducted performances, speed can be set at performance time using setSpeed(speed)

	sequenceRecording, // the sequence being recorded. set in play() and resume(), used by tick()

	setState = function(state)
	{
		switch(state)
		{
			case "stopped":
				stopped = true;
				paused = false;
				pauseStartTime = timer.now();
				pausedMoment = currentMoment;
				currentMoment = null;
				break;
			case "paused":
				stopped = false;
				paused = true;
				pauseStartTime = timer.now();
				pausedMoment = currentMoment;
				currentMoment = null;
				break;
			case "running":
				stopped = false;
				paused = false;
				pauseStartTime = -1;
				pausedMoment = null;
				break;
			default:
				throw "Unknown sequence state!";
		}
	},

	// nextMoment is used by tick(), resume(), play().
	// Returns the earliest track.nextMoment or null.
	// Null is returned if there are no more moments or if the sequence is paused or stopped.
	nextMoment = function()
	{
		var
			track, nextMomtMsPosInScore, trackNextMomtMsPos, nextMomt = null, delay;

		function stopAfterDelay()
		{
			var performanceMsDuration = Math.ceil(timer.now() - performanceStartTime);
			setState("stopped");
			reportEndOfPerformance(sequenceRecording, performanceMsDuration);
			for(let track of tracks)
			{
				if(track.isOn)
				{
					track.setToFirstRegion();
				}
			}
		}

		// Returns the track having the earliest nextMsPosition (= the position of the first unsent Moment in the track),
		// or null if the earliest nextMsPosition is >= endMarkerMsPosition.
		function getNextTrack(tracks)
		{
			let nextTrack = null, trackMsPos, nextMomtMsPosInScore = Number.MAX_VALUE;

			function moveToNextRegion(tracks)
			{
				for(let track of tracks)
				{
					track.moveToNextRegion(currentRegionIndex);
				}

				reportEndOfRegion(currentRegionIndex);
				currentRegionIndex++; // the (global) index in the regionLinks array
			}

			let nTracks = tracks.length;
			let endOfRegion = true;

			for(let t = 0; t < nTracks; ++t)
			{
				let track = tracks[t];
				if(track.isOn && track.hasEndedRegion === false)
				{
					trackMsPos = track.currentMsPosition(); // returns Number.MAX_VALUE at end of track
					if(trackMsPos >= regionSequence[currentRegionIndex].endMsPosInScore)
					{
						track.hasEndedRegion = true;
					}
					else if(!(trackMsPos >= endMarkerMsPositionInScore && currentRegionIndex === endRegionIndex))
					{
						if(trackMsPos < nextMomtMsPosInScore)
						{
							nextTrack = track;
							nextMomtMsPosInScore = trackMsPos;
						}
						endOfRegion = false;
					}
				}
			}

			if(endOfRegion)
			{
				if(currentRegionIndex === endRegionIndex)
				{
					nextTrack = null; // end of performance
				}
				else
				{
					moveToNextRegion(tracks);
					nextTrack = getNextTrack(tracks); // recursive call
					startOfRegion = true;
				}
			}

			return nextTrack;
		}

		track = getNextTrack(tracks);

		if(document.hidden === true)
		{
			stopAfterDelay();
		}
		else if(track === null)
		{
			if(timer instanceof Conductor)
			{
				if(endOfConductedPerformance === false)
				{
					nextMomt = new Moment(0, 0);  // dummy moment
					trackNextMomtMsPos = endMarkerMsPositionInScore;
					endOfConductedPerformance = true;
				}
				else
				{
					stopAfterDelay();
				}
			}
			else // using performance.now()
			{
				// The returned nextMomt is going to be null, and tick() will stop, while waiting to call stopAfterDelay().
				setState("stopped");
				// Wait for the duration of the final moment before stopping. (An assisted performance (Keyboard1) waits for a noteOff...)
				delay = (endMarkerMsPositionInScore - previousMomtMsPosInScore) / speed;
				window.setTimeout(stopAfterDelay, delay);
			}
		}
		else
		{
			nextMomt = track.currentMoment;
			trackNextMomtMsPos = track.currentMsPosition();
			track.advanceCurrentMoment();
		}

		if(!stopped && !paused)
		{
			if(startOfRegion)
			{
				nextMomtMsPosInScore = regionSequence[currentRegionIndex].startMsPosInScore;
			}
			else
			{
				nextMomtMsPosInScore = trackNextMomtMsPos;
			}

			if((nextMomtMsPosInScore > lastReportedMsPosition) || startOfRegion)
			{
				// the position will be reported by tick() when nextMomt is sent.
				msPositionToReport = nextMomtMsPosInScore;
				//console.log("msPositionToReport=%i", msPositionToReport);
			}

			if(previousTimestamp === null)
			{
				nextMomt.timestamp = startTimeAdjustedForPauses;
			}
			else if(startOfRegion)
			{
				let duration = (regionSequence[currentRegionIndex - 1].endMsPosInScore - previousMomtMsPosInScore) / speed;
				//console.log("start of region moment duration: " + duration.toString());
				nextMomt.timestamp = duration + previousTimestamp;
				startOfRegion = false;
			}
			else
			{
				let duration = (nextMomtMsPosInScore - previousMomtMsPosInScore) / speed;
				//console.log("moment duration: " + duration.toString());
				nextMomt.timestamp = duration + previousTimestamp;
			}

			previousTimestamp = nextMomt.timestamp;
			previousMomtMsPosInScore = nextMomtMsPosInScore;
		}

		return nextMomt; // null stops tick().
	},

	// tick() function -- which ows a lot to Chris Wilson of the Web Audio Group
	// Recursive function. Also used by resume(), play()
	// This function has been tested as far as possible without having "a conformant send() with timestamps".
	// It needs testing again with the conformant send() and a higher value for PREQUEUE. What would the
	// ideal value for PREQUEUE be? 
	// Email correspondence with Chris Wilson (End of Oct. 2012):
	//      James: "...how do I decide how big PREQUEUE should be?"
	//      Chris: "Well, you're trading off two things:
	//          - 'precision' of visual display (though keep in mind that is fundamentally limited to the 16.67ms tick
	//            of the visual refresh rate (for a 60Hz display) - and that also affects how quickly you can respond
	//            to tempo changes (or stopping/pausing playback).
	//          - reliance on how accurate the setTimeout/setInterval clock is (for that reason alone, the lookahead
	//            probably needs to be >5ms).
	//          So, in short, you'll just have to test on your target systems."
	//      James: "Yes, that's more or less what I thought. I'll start testing with PREQUEUE at 16.67ms."
	//
	// 16th Nov. 2012: The cursor can only be updated once per tick, so PREQUEUE needs to be small enough for that not
	// to matter.
	// 18th Jan. 2013 -- Jazz 1.2 does not support timestamps.
	//
	// 20th Dec. 2018: (while programming the TimerConductor)
	// Changed PREQUEUE from 0 to 6.
	// The TimerConductor is now running setInterval at a nominal 3ms, which means
	// "as fast as meaningfully possible, and definitely faster than PREQUEUE".
	// This means that this tick function treats all events that happen within 6ms 
	// as "synchronous", and performs them in a tight loop.
	//
	// The following variables are initialised in play() to start playing the span:
	//      currentMoment // the first moment in the sequence
	//      track attributes:
	//          isOn // set by referring to the track control
	//          fromIndex // the index of the first moment in the track to play
	//          toIndex // the index of the final moment in the track (which does not play)
	//          currentIndex // = fromIndex
	//      reportEndOfPerformance // can be null
	//      reportMsPosition // can be null    
	tick = function()
	{
		var
			PREQUEUE = 6, // Changed from 0 to 6 -- ji December 2018 (See above)
			now = timer.now(),
			delay;

		// moment.timestamps are always absolute DOMHRT values here.
		// Note that Jazz 1.2 does not support timestamps. It always sends Messages immediately.
		function sendMessages(moment)
		{
			var
				messages = moment.messages,
				i, nMessages = messages.length, timestamp = moment.timestamp;

			for(i = 0; i < nMessages; ++i)
			{
				outputDevice.send(messages[i].data, timestamp);
			}
		}

		if(currentMoment === null)
		{
			return;
		}

		delay = currentMoment.timestamp - now; // compensates for inaccuracies in setTimeout
		nAsynchMomentsSentAtOnce = 1;

		let thisTickTimestampLimit = currentMoment.timestamp + 16;  // nAsynchMomentsSentAtOnce not counted if the difference is 16ms

		// send all messages that are due between now and PREQUEUE ms later. 
		while(delay <= PREQUEUE)
		{
			if(msPositionToReport >= 0)
			{
				reportNextMIDIObject(msPositionToReport);
				lastReportedMsPosition = msPositionToReport; // lastReportedMsPosition is used in nextMoment() above.
				msPositionToReport = -1;
			}

			if(thisTickTimestampLimit < currentMoment.timestamp)
			{
				nAsynchMomentsSentAtOnce++;
			}

			if(currentMoment.messages.length > 0) // rest moments can be empty (but should be reported above) 
			{
				sendMessages(currentMoment);

				if(sequenceRecording !== undefined && sequenceRecording !== null)
				{
					// The moments are recorded with their current (absolute DOMHRT) timestamp values.
					// These values are adjusted relative to the first moment.timestamp
					// before saving them in a Standard MIDI File.
					// (i.e. the value of the earliest timestamp in the recording is
					// subtracted from all the timestamps in the recording)

					//console.log(currentMoment.timestamp.toString());
					let trIndex = currentMoment.messages[0].channel(),
						tr = sequenceRecording.trackRecordings[trIndex];

					tr.addMoment(currentMoment);
				}
			}

			currentMoment = nextMoment();

			if(currentMoment === null)
			{
				// we're pausing, or have hit the end of the sequence.
				return;
			}

			delay = currentMoment.timestamp - now;
		}

		if(nAsynchMomentsSentAtOnce > 1)
		{
			reportTickOverload();
		}

		window.setTimeout(tick, delay);  // that will schedule the next tick.
	},

	// Public function. Should only be called when this sequence is paused (and pausedMoment is set correctly).
	// The sequence pauses if nextMoment() sets currentMoment to null while tick() is waiting for setTimeout().
	// So the messages in pausedMoment (set to the last non-null currentMoment) have already been sent.
	resume = function()
	{
		var pauseMsDuration;

		if(pausedMoment === null || pauseStartTime < 0)
		{
			throw "Error: pausedMoment and pauseStartTime must be defined here.";
		}

		currentMoment = pausedMoment; // the last moment whose messages were sent.
		pauseMsDuration = timer.now() - pauseStartTime;

		setState("running"); // sets pausedMoment to null.

		currentMoment.timestamp += pauseMsDuration;
		previousTimestamp += pauseMsDuration;
		startTimeAdjustedForPauses += pauseMsDuration;

		currentMoment = nextMoment();
		if(currentMoment === null)
		{
			return;
		}
		currentMoment.timestamp = timer.now();
		tick();
	},

	run = function()
	{
		if(pausedMoment !== null)
		{
			resume();
		}
		else
		{
			setState("running");

			currentMoment = nextMoment();
			if(currentMoment === null)
			{
				return;
			}
			tick();
		}
	},

	isStopped = function()
	{
		return (stopped === true && paused === false);
	},

	isPaused = function()
	{
		return (stopped === false && paused === true);
	},

	isRunning = function()
	{
		return (stopped === false && paused === false);
	};

export class Sequence
{
	constructor()
	{
		this.resume = resume;
		this.isStopped = isStopped;
		this.isPaused = isPaused;
		this.isRunning = isRunning;
	}

	setOutputTracks(outputTracksArg)
	{
		outputTracks = outputTracksArg;
	}

	getOutputTracks()
	{
		return tracks;
	}

	// The reportEndOfPerfCallback argument is a callback function which is called when performing sequence
	// reaches the endMarkerMsPosition (see play(), or stop() is called. Can be undefined or null.
	// It is called in this file as:
	//      reportEndOfPerformance(sequenceRecording, performanceMsDuration);
	// The reportNextMIDIObjectCallback argument is a callback function which reports the current
	// msPositionInScore back to the GUI while performing.
	// It is called here as:
	//      reportNextMIDIObject(msPositionToReport);
	// The msPosition it passes back is the original number of milliseconds from the start of the score
	// (regardless of the current speed).This value is used to identify chord and rest symbols in the score,
	// and so to synchronize the running cursor.
	// Moments whose msPositionInScore is to be reported are given chordStart or restStart
	// attributes before play() is called.
	init(outputDeviceArg, reportEndOfRegionCallback, reportEndOfPerfCallback, reportNextMIDIObjectCallback, reportTickOverloadCallback, regionSequenceArg)
	{
		function getRegionStartMsPositionsInScore(regionSequence)
		{
			let rval = [];
			rval.push(0); // always include the beginning of the score
			for(let i = 0; i < regionSequence.length; ++i)
			{
				let rl = regionSequence[i];
				if(rval.indexOf(rl.startMsPosInScore) < 0)
				{
					rval.push(rl.startMsPosInScore);
				}
			}
			rval.sort(function(a, b) { return a - b; });
			return rval;
		}

		if(outputDeviceArg === undefined || outputDeviceArg === null)
		{
			throw "The midi output device must be defined.";
		}

		if(reportEndOfPerfCallback === undefined || reportEndOfPerfCallback === null
			|| reportNextMIDIObjectCallback === undefined || reportNextMIDIObjectCallback === null)
		{
			throw "Error: both the position reporting callbacks must be defined.";
		}

		timer = performance; // performance.now() is the default timer
		outputDevice = outputDeviceArg; // default output device is the one selected in the outputDevice selector 
		tracks = outputTracks;
		regionSequence = regionSequenceArg.slice(); // clone the array
		regionStartMsPositionsInScore = getRegionStartMsPositionsInScore(regionSequence);

		reportEndOfRegion = reportEndOfRegionCallback;
		reportEndOfPerformance = reportEndOfPerfCallback;
		reportNextMIDIObject = reportNextMIDIObjectCallback;
		reportTickOverload = reportTickOverloadCallback;

		setState("stopped");
	}

	setTimerAndOutputDevice(objectWithNowFunction, objectWithSendFunction)
	{
		timer = objectWithNowFunction; // use objectWithNowFunction.now() for timings
		outputDevice = objectWithSendFunction; // use objectWithSendFunction.send() to send midi messages
	}

	setSpeed(speedToSet)
	{
		speed = speedToSet;
	}

	// play()
	//
	// trackIsOnArray[trackIndex] returns a boolean which determines whether the track will
	// be played or not. This array belongs to its creator, and is read only.
	//
	// recording is a Sequence to which timestamped moments are added as they are performed.
	// Can be undefined or null. If used, it should be an empty Sequence having the same number
	// of tracks as this (calling) sequence.
	play(trackIsOnArray, startRegionIndex, startMarkerMsPosInScore, endRegionIndexArg, endMarkerMsPosInScore, baseSpeed, recording)
	{
		// Sets each (output) track's isOn attribute.
		// If the track is set to perform (in the trackIsOnArray -- the trackControl settings),
		// sets track._currentMidiObjectIndex, track.currentMidiObject and track.currentMoment.
		// all subsequent midiChords before endMarkerMsPosInScore are set to start at their beginnings.
		function initPlay(trackIsOnArray, startMarkerMsPosInScore, endMarkerMsPosInScore, regionStartMsPositionsInScore)
		{
			let i, nTracks = tracks.length, track;
			// Note that the trackIsOnArray will also include input tracks if the score has any,
			// but that these are ignored here because _tracks_ only contains the _output_ tracks.

			for(i = 0; i < nTracks; ++i)
			{
				track = tracks[i];
				track.isOn = trackIsOnArray[i];

				if(track.isOn)
				{
					track.setOutputSpan(i, startMarkerMsPosInScore, endMarkerMsPosInScore, regionStartMsPositionsInScore);
				}
			}
		}

		// In blue, live conducted performances, Sequence.speed is always 1. (The speed slider value is used differently.)
		// In normal Sequence or Keyboard1 performances, Sequence.speed is the value of the global speed slider (range [0.1..9.99]).
		speed = baseSpeed;
		sequenceRecording = recording; // can be undefined or null

		//startMarkerMsPositionInScore = startMarkerMsPosInScore;
		endMarkerMsPositionInScore = endMarkerMsPosInScore;

		pausedMoment = null;
		pauseStartTime = -1;
		previousTimestamp = null;
		previousMomtMsPosInScore = startMarkerMsPosInScore;
		msPositionToReport = -1;
		lastReportedMsPosition = -1;
		endOfConductedPerformance = false;

		initPlay(trackIsOnArray, startMarkerMsPosInScore, endMarkerMsPosInScore, regionStartMsPositionsInScore);

		performanceStartTime = timer.now();
		startTimeAdjustedForPauses = performanceStartTime;
		startOfRegion = false;

		currentRegionIndex = startRegionIndex;
		endRegionIndex = endRegionIndexArg;

		run();
	}


	// Should only be called while running a non-assisted performance
	pause()
	{
		if((stopped === false && paused === false))
		{
			setState("paused");
		}
		else
		{
			throw "Attempt to pause a stopped or paused sequence.";
		}
	}

	// does nothing if the sequence is already stopped
	stop()
	{
		var performanceMsDuration;

		if(!(stopped === true && paused === false))
		{
			setState("stopped");
			performanceMsDuration = Math.ceil(timer.now() - performanceStartTime);
			reportEndOfPerformance(sequenceRecording, performanceMsDuration);
		}
	}
}




