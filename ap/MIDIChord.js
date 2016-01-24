/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/MidiChord.js
 *  Public interface:
 *  The constructor can be called with either 1 or 3 arguments:
 *  either
 *      MidiChord(midiChord) // MidiChord Clone constructor
 *  or
 *      MidiChord(channel, midiChordDef, timeObject) // MidiChord constructor
 */

/*jslint white */
/*global WebMIDI, _AP,  window,  document */

_AP.namespace('_AP.midiChord');

_AP.midiChord = (function()
{
	"use strict";
	// begin var
	var
    CMD = _AP.constants.COMMAND,
    CTL = _AP.constants.CONTROL,
    Message = _AP.message.Message,
    Moment = _AP.moment.Moment, // constructor

    // The rate (milliseconds) at which slider messages are sent.
    SLIDER_MILLISECONDS = 10,

    // public MidiChord constructor
	// This constructor can be called with either 1 or 3 arguments.
	// When called with 1 argument, the argument is itself a MidiChord, and this is a clone constructor.
	// When called with 3 arguments, argument 1 is the new MidiChord's channel index.
	// A MidiChord contains all the midi messages required for playing an (ornamented) chord. 
    MidiChord = function(channelOrMidiChordArg, midiChordDef, timeObject)
    {
    	var rval = {}, channel, midiChordArg;

    	console.assert(arguments.length === 1 || arguments.length === 3, "Error: MidiChord constructor called with the wrong number of arguments.");

    	if(arguments.length === 1)
    	{
    		midiChordArg = channelOrMidiChordArg;
    	}
    	else if(arguments.length === 3)
    	{
    		channel = channelOrMidiChordArg;
    	}

    	if(!(this instanceof MidiChord))
    	{
    		if(arguments.length === 1)
    		{
    			return new MidiChord(midiChordArg); // clone constructor
    		}
    		if(arguments.length === 3)
    		{
    			return new MidiChord(channel, midiChordDef, timeObject);
    		}
    	}

    	if(arguments.length === 1) // clone constructor
    	{
    		// this clone constructor does not make a deep clone of the moments since they are not changed at runtime.

    		Object.defineProperty(this, "msPositionInScore", { value: midiChordArg.msPositionInScore, writable: false });
    		Object.defineProperty(this, "msDurationInScore", { value: midiChordArg.msDurationInScore, writable: false });

    		// initialised below, not changed at runtime.
    		Object.defineProperty(this, "moments", { value: midiChordArg.moments, writable: false });
    		Object.defineProperty(this, "_msDurationOfBasicChords", { value: midiChordArg._msDurationOfBasicChords, writable: false });
    		Object.defineProperty(this, "finalChordOffMoment", { value: midiChordArg.finalChordOffMoment, writable: false });

    		// used at runtime
    		Object.defineProperty(this, "currentMoment", { value: midiChordArg.currentMoment, writable: true });
    		Object.defineProperty(this, "_currentMomentIndex", { value: midiChordArg._currentMomentIndex, writable: true });
    	}

    	if(arguments.length === 3) // construct MidiChord from MidiChordDef
    	{
    		if(midiChordDef.basicChordsArray === undefined)
    		{
    			throw "Error: the chord definition must contain a basicChordsArray!";
    		}

    		// The timeObject takes the global speed option into account.
    		Object.defineProperty(this, "msPositionInScore", { value: timeObject.msPosition, writable: false });
    		Object.defineProperty(this, "msDurationInScore", { value: timeObject.msDuration, writable: false });

    		// initialised below, not changed at runtime.
    		Object.defineProperty(this, "moments", { value: null, writable: true });
    		Object.defineProperty(this, "_msDurationOfBasicChords", { value: 0, writable: true });
    		Object.defineProperty(this, "finalChordOffMoment", { value: null, writable: true });

    		// used at runtime
    		Object.defineProperty(this, "currentMoment", { value: null, writable: true });
    		Object.defineProperty(this, "_currentMomentIndex", { value: -1, writable: true });

    		// The timeObject takes the global speed option into account.
    		rval = this._getMoments(channel, midiChordDef, timeObject.msDuration, timeObject.systemIndex); // defined in prototype below

    		// moments is an ordered array of moments (containing messages for sequential chords and slider messages).
    		// A Moment is a list of logically synchronous MIDI messages.  
    		this.moments = rval.moments;
    		this._msDurationOfBasicChords = rval.msDurationOfBasicChords;

    		// When completing Tracks, each MidiChord's finalChordOffMoment messages are inserted into the first moment
    		// in the following midiObject. i.e. they are sent when the performance or live performer reaches the following midiObject.
    		// The finalChordOffMoment is always a valid moment, at the msPositionInScore of the following midiObject, but it may have no messages.
    		this.finalChordOffMoment = rval.finalChordOffMoment;

    		this.currentMoment = this.moments[0];
    	}

    	return this;
    },

    publicChordAPI =
    {
    	// public MidiChord constructor
    	// A MidiChord contains a private array of Moments containing all
    	// the midi messages required for playing an (ornamented) chord.
    	// A Moment is a collection of logically synchronous MIDI messages.
    	MidiChord: MidiChord
    };
	// end var

	MidiChord.prototype._getMoments = function(channel, midiChordDef, msDurationInScore, systemIndex)
	{
		var
        basicChordMsDurations,
        msDurationOfBasicChords,
        rval = {},
        finalChordOffMoment = {},
        chordMoments = [],
        sliderMoments = [];

		// An array of moments whose msPositionInChord has been set.
		// The moments contain all the non-slider components of the midiChordDef.
		// The msPositionInChord of the first Moment is 0.
		function getChordMoments(channel, midiChordDef, msDurationInScore)
		{
			var i, j,
                len = midiChordDef.basicChordsArray.length,
                pitches,
                pitchesLength,
                basicChordDef,
                msPositionInChord = 0,
                allNoteOffs = [],
                chordMoments = [],
                noteNumber,
                moment,
                currentMoment,
                msDurationOfBasicChords;

			// NEW: bcMsDurations(basicChords) simply returns an array containing the durations of the basic Chords,
			// taking no account of the global speed option.
			// Replaces:
			//     function bcMsDurations(basicChords, totalMsDuration), which adjusted the durations to the duration
			//     of the MidiChord in the score, taking the global speed option into account.
			function bcMsDurations(basicChords)
			{
				var msDurations = [], i, basicChordsLength = basicChords.length;

				if(basicChordsLength < 1)
				{
					throw "Condition: there must be at least one basic chord here.";
				}

				for(i = 0; i < basicChordsLength; ++i)
				{
					msDurations.push(basicChords[i].msDuration);
				}

				return msDurations;
			}

			function sumBCMD(basicChordMsDurations)
			{
				var i, sum = 0;
				for(i = 0; i < basicChordMsDurations.length; ++i)
				{
					sum += basicChordMsDurations[i];
				}
				return sum;
			}

			// Chord Bank, Patch and PitchwheelDeviation messages
			// Returns undefined if there are no attributes
			function attributesMoment(channel, midiChordDef)
			{
				var attrMoment,
                    msg,
                    attributes;

				/// Sets both RegisteredParameter controls to 0 (zero). This is standard MIDI for selecting the
				/// pitch wheel so that it can be set by the subsequent DataEntry messages.
				/// A DataEntryFine message is not set, because it is not needed and has no effect anyway.
				/// However, RegisteredParameterFine MUST be set, otherwise the messages as a whole have no effect!
				function setPitchwheelDeviation(attrMoment, deviation, channel)
				{
					var msg;
					msg = new Message(CMD.CONTROL_CHANGE + channel, CTL.REGISTERED_PARAMETER_COARSE, 0);
					attrMoment.messages.push(msg);
					msg = new Message(CMD.CONTROL_CHANGE + channel, CTL.REGISTERED_PARAMETER_FINE, 0);
					attrMoment.messages.push(msg);
					msg = new Message(CMD.CONTROL_CHANGE + channel, CTL.DATA_ENTRY_COARSE, deviation);
					attrMoment.messages.push(msg);
				}

				if(midiChordDef.attributes !== undefined)
				{
					attributes = midiChordDef.attributes;
					attrMoment = new Moment(0); // the attributes moment is always the first moment in the chord

					// the id, and minBasicChordMsDuration attributes are not midi messages
					// the hasChordOff attribute is dealt with later.
					if(attributes.bank !== undefined)
					{
						msg = new Message(CMD.CONTROL_CHANGE + channel, 0, attributes.bank); // 0 is bank control
						attrMoment.messages.push(msg);
					}
					if(attributes.patch !== undefined)
					{
						msg = new Message(CMD.PROGRAM_CHANGE + channel, attributes.patch, 0);
						attrMoment.messages.push(msg);
					}

					if(attributes.pitchWheelDeviation !== undefined)
					{
						setPitchwheelDeviation(attrMoment, attributes.pitchWheelDeviation, channel);
					}
				}

				return attrMoment;
			}

			// BasicChord Bank, Patch and ChordOn messages
			function basicChordOnMoment(channel, basicChordDef, msPosition)
			{
				var midiNotes = basicChordDef.pitches,
                    midiVelocities = basicChordDef.velocities,
                    len = midiNotes.length,
                    message,
                    bcoMoment = new Moment(msPosition),
                    i;

				if(basicChordDef.bank !== undefined) // default is dont send a bank change
				{
					message = new Message(CMD.CONTROL_CHANGE + channel, basicChordDef.bank, 0);
					bcoMoment.messages.push(message);

					message = new Message(CMD.PROGRAM_CHANGE + channel, basicChordDef.patch, 0);
					bcoMoment.messages.push(message);
				}
				else if(basicChordDef.patch !== undefined) // default is dont send a patch change
				{
					message = new Message(CMD.PROGRAM_CHANGE + channel, basicChordDef.patch, 0);
					bcoMoment.messages.push(message);
				}

				for(i = 0; i < len; ++i)
				{
					message = new Message(CMD.NOTE_ON + channel, midiNotes[i], midiVelocities[i]);
					bcoMoment.messages.push(message);
				}

				return bcoMoment;
			}

			function basicChordOffMoment(channel, basicChordDef, msPosition)
			{
				var pitches = basicChordDef.pitches,
                    len = pitches.length,
                    velocity = 127,
                    bcoffMoment = new Moment(msPosition),
                    message,
                    i;

				for(i = 0; i < len; ++i)
				{
					message = new Message(CMD.NOTE_OFF + channel, pitches[i], velocity);
					bcoffMoment.messages.push(message);
				}

				return bcoffMoment;
			}

			// noteOffs contains all the noteNumbers that need to be sent a noteOff,
			// noteOffs contains duplicates. Avoid creating duplicate noteOffs in this function.
			function chordOffMoment(channel, noteOffs, msPosition)
			{
				var uniqueNoteNumbers = [], nnIndex, noteNumber,
                    velocity = 127,
                    cOffMoment = new Moment(msPosition),
                    message;

				function getUniqueNoteNumbers(noteOffs)
				{
					var unique = [], i, length = noteOffs.length, val;
					for(i = 0; i < length; ++i)
					{
						val = noteOffs[i];
						if(unique.indexOf(val) === -1)
						{
							unique.push(val);
						}
					}
					return unique;
				}

				uniqueNoteNumbers = getUniqueNoteNumbers(noteOffs);

				for(nnIndex = 0; nnIndex < uniqueNoteNumbers.length; ++nnIndex)
				{
					noteNumber = uniqueNoteNumbers[nnIndex];
					message = new Message(CMD.NOTE_OFF + channel, noteNumber.valueOf(), velocity);
					cOffMoment.messages.push(message);
				}

				return cOffMoment;
			}

			// initial AttributesMoment
			currentMoment = attributesMoment(channel, midiChordDef);
			if(currentMoment !== undefined)
			{
				chordMoments.push(currentMoment);
			}

			// old: these basicChordMsDurations take the global speed option into account.
			// old: basicChordMsDurations = bcMsDurations(midiChordDef.basicChordsArray, timeObject.msDuration);
			// new: these basicChordMsDurations do NOT take the global speed option into account.
			basicChordMsDurations = bcMsDurations(midiChordDef.basicChordsArray);
			msDurationOfBasicChords = sumBCMD(basicChordMsDurations);

			// BasicChordMoments
			for(i = 0; i < len; i++)
			{
				basicChordDef = midiChordDef.basicChordsArray[i];

				if(midiChordDef.attributes.hasChordOff === undefined || midiChordDef.attributes.hasChordOff === true)
				{
					pitches = basicChordDef.pitches;
					pitchesLength = pitches.length;
					for(j = 0; j < pitchesLength; ++j)
					{
						noteNumber = pitches[j];
						if(allNoteOffs.indexOf(noteNumber) === -1)
						{
							allNoteOffs.push(noteNumber);
						}
						// allNoteOffs is used at the end of the ornament to turn notes off that were turned on during the ornament.
					}
				}

				moment = basicChordOnMoment(channel, basicChordDef, msPositionInChord);

				if(currentMoment !== undefined && currentMoment.msPositionInChord === moment.msPositionInChord)
				{
					currentMoment.mergeMoment(moment);
				}
				else
				{
					chordMoments.push(moment);
					currentMoment = moment;
				}

				msPositionInChord += basicChordMsDurations[i];

				if(basicChordDef.hasChordOff === undefined || basicChordDef.hasChordOff === true)
				{
					// chordOff always comes after chordOn
					currentMoment = basicChordOffMoment(channel, basicChordDef, msPositionInChord);
					chordMoments.push(currentMoment);
				}
			}

			// finalChordOffMoment contains a noteOFF for each note that has been sent a noteON during the BasicChordMoments.
			if(midiChordDef.attributes.hasChordOff === undefined || midiChordDef.attributes.hasChordOff === true)
			{
				if(allNoteOffs.length === 0)
				{
					throw "Error: this chord must have sent at least one note!";
				}
				finalChordOffMoment = chordOffMoment(channel, allNoteOffs, msDurationInScore);
			}
			else
			{
				finalChordOffMoment = new Moment(msDurationInScore);
			}

			return {
				"chordMoments": chordMoments,
				"finalChordOffMoment": finalChordOffMoment,
				"msDurationOfBasicChords": msDurationOfBasicChords
			};
		}

		// An array of moments whose msPositionInChord has been set.
		// Each moment contains slider messages for each of the defined sliders.
		// These moments always happen at a rate defined by sliderMilliseconds.
		// 50ms is the default, but other values are possible.
		// None of the returned sliderMoments has 0 messages.
		// This function is only called if sliders are defined, so the length of the returned array
		// can either be 1 (i.e. none of the sliders' values changes during this MidiChord)
		// or a value calculated from SLIDER_MILLISECONDS and msDuration. In the latter case, the
		// msPositionInChord of the final sliderMoment is less than msDuration.
		function getSliderMoments(channel, sliders, msDuration, sliderMilliseconds)
		{
			var i, sliderMoments, nonEmptySliderMoments;

			function getEmptySliderMoments(msDuration, sliderMilliseconds)
			{
				var moments = [],
                    numberOfMoments = Math.floor(Number(msDuration) / sliderMilliseconds),
                    momentFloatDuration = 0,
                    msFloatDuration = Number(msDuration),
                    currentIntPosition = Number(0),
                    currentFloatPosition = Number(0),
                    moment,
                    i;

				if(numberOfMoments === 0)
				{
					numberOfMoments = 1;
				}

				momentFloatDuration = msFloatDuration / numberOfMoments; // momentFloatDuration is a float
				for(i = 0; i < numberOfMoments; i++)
				{
					moment = new Moment(currentIntPosition);
					moments.push(moment);
					currentFloatPosition += momentFloatDuration;
					currentIntPosition = Math.floor(currentFloatPosition);
				}

				if(moments[moments.length - 1].msPositionInChord >= msDuration)
				{
					throw "illegal final slider moment";
				}

				return moments;
			}

			function setSlider(channel, sliderMoments, typeString, originalValuesArray)
			{
				var numberOfFinalValues, finalValuesArray;

				// uses originalValuesArray
				// 
				function getFinalValuesArray(numberOfFinalValues, originalValuesArray)
				{
					var finalValuesArray = [],
                        originalLength = originalValuesArray.length,
                        i, oIndex, fIndex;

					// uses originalValuesArray
					function getStretchedContour(numberOfFinalValues, originalValuesArray)
					{
						var stretchedContour = [],
                            oValues = originalValuesArray,
                            originalLength = oValues.length,
                            nSectionValues, increment, j,
                            f1Index, f2Index, oValue1, oValue2,
                            finalPeakIndices;

						// Returns an array having length originalLength, containing
						// the indices in the stretchedContour that correspond to the
						// indices in the originalValuesArray.
						function getFinalPeakIndices(numberOfFinalValues, originalLength)
						{
							var stretchFactor, i,
                                finalPeakIndices = [];

							finalPeakIndices.push(0);

							if(originalLength > 2)
							{
								stretchFactor = numberOfFinalValues / (originalLength - 1);
								for(i = 1; i < originalLength - 1; ++i)
								{
									finalPeakIndices.push(Math.floor(i * stretchFactor));
								}
							}

							finalPeakIndices.push(numberOfFinalValues - 1);

							return finalPeakIndices;
						}

						finalPeakIndices = getFinalPeakIndices(numberOfFinalValues, originalLength);
						if(originalLength > 1)
						{
							for(oIndex = 1; oIndex < originalLength; oIndex++)
							{
								f1Index = finalPeakIndices[oIndex - 1];
								f2Index = finalPeakIndices[oIndex];
								oValue1 = oValues[oIndex - 1];
								oValue2 = oValues[oIndex];
								nSectionValues = f2Index - f1Index;
								increment = (oValue2 - oValue1) / nSectionValues;
								j = 0;
								for(i = f1Index; i < f2Index; i++)
								{
									stretchedContour.push(oValue1 + Math.floor(increment * j++));
								}
							}
						}

						stretchedContour.push(oValues[originalLength - 1]);

						return stretchedContour;
					}

					if(originalLength === 1)
					{
						for(fIndex = 0; fIndex < numberOfFinalValues; fIndex++)
						{
							finalValuesArray.push(originalValuesArray[0]);
						}
					}
					else if(originalLength === numberOfFinalValues)
					{
						for(fIndex = 0; fIndex < numberOfFinalValues; fIndex++)
						{
							finalValuesArray.push(originalValuesArray[fIndex]);
						}
					}
					else if(originalLength < numberOfFinalValues)
					{   // this should be the usual case
						finalValuesArray = getStretchedContour(numberOfFinalValues, originalValuesArray);
					}
					else if(originalLength > numberOfFinalValues)
					{
						finalValuesArray.push(originalValuesArray[0]);
						for(fIndex = 1; fIndex < numberOfFinalValues - 1; fIndex++)
						{
							oIndex = fIndex * (Math.floor(originalLength / numberOfFinalValues));
							finalValuesArray.push(originalValuesArray[oIndex]);
						}
						if(numberOfFinalValues > 1)
						{
							finalValuesArray.push(originalValuesArray[originalLength - 1]);
						}
					}

					return finalValuesArray;
				}
				// repeating slider values are not added to the sliderMoments
				function addSliderValues(channel, sliderMoments, typeString, finalValuesArray)
				{
					var len = finalValuesArray.length,
                        moment, value,
                        previousValue = -1,
                        message, i;

					if(sliderMoments.length !== finalValuesArray.length)
					{
						throw "Unequal array lengths.";
					}
					for(i = 0; i < len; i++)
					{
						moment = sliderMoments[i];
						value = finalValuesArray[i];
						if(value !== previousValue) // repeating messages are not sent
						{
							previousValue = value;
							switch(typeString)
							{
								case "pitchWheel":
									// pitch wheel messages are created with 7-bit MSB (0..127) at data[2].
									// data[1], here 0, is the 7-bit LSB
									message = new Message(CMD.PITCH_WHEEL + channel, 0, value);
									break;
								case "pan":
									message = new Message(CMD.CONTROL_CHANGE + channel, CTL.PAN, value);
									break;
								case "modulationWheel":
									message = new Message(CMD.CONTROL_CHANGE + channel, CTL.MODWHEEL, value);
									break;
								case "expression":
									message = new Message(CMD.CONTROL_CHANGE + channel, CTL.EXPRESSION, value);
									break;
							}
							moment.messages.push(message);
						}
					}
				}

				numberOfFinalValues = sliderMoments.length;
				finalValuesArray = getFinalValuesArray(numberOfFinalValues, originalValuesArray);
				// repeating slider values are not added to the sliderMoments
				addSliderValues(channel, sliderMoments, typeString, finalValuesArray);
			}

			// sliderMoments is an array of timed moments. The messages are initially empty.
			// By default, the moments are at a rate of (ca.) 50ms (ca. 20 per second).
			// The total duration of the slidersQueue is equal to msDuration.
			sliderMoments = getEmptySliderMoments(msDuration, sliderMilliseconds);

			// the final argument in the following 4 calls is always either undefined or an array of integers [0..127]
			if(sliders.pitchWheel)
			{
				setSlider(channel, sliderMoments, "pitchWheel", sliders.pitchWheel);
			}
			if(sliders.pan)
			{
				setSlider(channel, sliderMoments, "pan", sliders.pan);
			}
			if(sliders.modulationWheel)
			{
				setSlider(channel, sliderMoments, "modulationWheel", sliders.modulationWheel);
			}
			if(sliders.expressionSlider)
			{
				setSlider(channel, sliderMoments, "expression", sliders.expressionSlider);
			}

			nonEmptySliderMoments = [];
			for(i = 0; i < sliderMoments.length; ++i)
			{
				if(sliderMoments[i].messages.length > 0)
				{
					nonEmptySliderMoments.push(sliderMoments[i]);
				}
			}
			return nonEmptySliderMoments;
		}

		// returns  a single, ordered array of moments
		// If chordMoment.msPositionInScore === sliderMoment.msPositionInChord,
		// they are unified with the slider messages being sent first.
		function getCombinedMoments(chordMoments, sliderMoments)
		{
			var momentsArray = [],
                currentMsPosition = -1,
                chordMomentIndex = 0, sliderMomentIndex = 0,
                currentMoment, chordMoment, sliderMoment;

			function combineLong(chordMoments, sliderMoments)
			{
				function appendMoment(moment)
				{
					if(moment.msPositionInChord > currentMsPosition)
					{
						currentMsPosition = moment.msPositionInChord;
						momentsArray.push(moment);
						currentMoment = moment;
					}
					else if(moment.msPositionInChord === currentMsPosition)
					{
						currentMoment.mergeMoment(moment);
					}
					else
					{
						throw "Moment out of order.";
					}
				}

				chordMoment = chordMoments[chordMomentIndex++];
				sliderMoment = sliderMoments[sliderMomentIndex++];

				while(chordMoment || sliderMoment)
				{
					if(chordMoment)
					{
						if(sliderMoment)
						{
							if(sliderMoment.msPositionInChord <= chordMoment.msPositionInChord)
							{
								appendMoment(sliderMoment);
								sliderMoment = sliderMoments[sliderMomentIndex++];
							}
							else
							{
								appendMoment(chordMoment);
								chordMoment = chordMoments[chordMomentIndex++];
							}
						}
						else
						{
							appendMoment(chordMoment);
							chordMoment = chordMoments[chordMomentIndex++];
						}
					}
					else if(sliderMoment)
					{
						appendMoment(sliderMoment);
						sliderMoment = sliderMoments[sliderMomentIndex++];
					}
				}
			}

			if(chordMoments === undefined || sliderMoments === undefined)
			{
				throw "Error: both chordMoments and sliderMoments must be defined";
			}

			if(sliderMoments.length === 0)
			{
				momentsArray = chordMoments;
			}
			else if(sliderMoments.length === 1)
			{
				sliderMoments[0].mergeMoment(chordMoments[0]);
				chordMoments[0] = sliderMoments[0];
				momentsArray = chordMoments;
			}
			else
			{
				combineLong(chordMoments, sliderMoments); // sets momentsArray
			}

			return momentsArray;
		}

		rval = getChordMoments(channel, midiChordDef, msDurationInScore);
		chordMoments = rval.chordMoments;
		msDurationOfBasicChords = rval.msDurationOfBasicChords;
		// The finalChordOffMoment is inserted into, and sent from, the first moment in the following midiObject.
		// i.e. when the performance or live performer reaches the msPositionInChord of the following midiObject.
		// rval.finalChordOffMoment has also been defined (is always a Moment, but may be empty.)

		if(midiChordDef.sliders !== undefined)
		{
			sliderMoments = getSliderMoments(channel, midiChordDef.sliders, msDurationOfBasicChords, SLIDER_MILLISECONDS);
			rval.moments = getCombinedMoments(chordMoments, sliderMoments);
		}
		else
		{
			rval.moments = chordMoments;
		}

		Object.defineProperty(rval.moments[0], "systemIndex", { value: systemIndex, writable: false });

		return rval;
	};

	/***** The following functions are defined for both MidiChords and MidiRests *****************/

	// The chord must be at or straddle the start marker.
	// This function sets the chord to the state it should have when a performance starts.
	// this.currentMoment is set to the first moment at or after startMarkerMsPositionInScore.
	// this.currentMoment will be undefined if there are no moments at or after startMarkerMsPositionInScore. 
	MidiChord.prototype.setToStartMarker = function(startMarkerMsPositionInScore)
	{
		var
        nMoments = this.moments.length,
        currentIndex, currentPosition;

		console.assert(
            ((this.msPositionInScore <= startMarkerMsPositionInScore)
            && (this.msPositionInScore + this.msDurationInScore > startMarkerMsPositionInScore)),
            "This chord must be at or straddle the start marker.");

		for(currentIndex = 0; currentIndex < nMoments; ++currentIndex)
		{
			currentPosition = this.msPositionInScore + this.moments[currentIndex].msPositionInChord;
			if(currentPosition >= startMarkerMsPositionInScore)
			{
				break;
			}
		}
		this._currentMomentIndex = currentIndex;
		this.currentMoment = this.moments[currentIndex];
	};

	MidiChord.prototype.advanceCurrentMoment = function()
	{
		var returnMoment;

		console.assert(this.currentMoment !== null, "CurrentMoment should never be null here!");

		this._currentMomentIndex++;
		returnMoment = null;
		if(this._currentMomentIndex < this.moments.length)
		{
			this.currentMoment = this.moments[this._currentMomentIndex];
			returnMoment = this.currentMoment;
		}
		return returnMoment;
	};

	MidiChord.prototype.setToStartAtBeginning = function()
	{
		this._currentMomentIndex = 0;
		this.currentMoment = this.moments[0];
	};

	return publicChordAPI;
}());
