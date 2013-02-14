/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  jiMIDIChord.js
 *  This module uses JazzMidiBridge to create Events.
 *  Its public interface contains:
 *      newAllSoundOffMessage() // returns a new AllSoundOffMessage
 *      MIDIChord(channel, chordDef, timeObject, speed) // MIDIChord constructor
 *      MIDIRest(timeObject) // MIDIRest constructor
 *  
 */

/*jslint bitwise: false, nomen: false, plusplus: true, white: true */

JI_NAMESPACE.namespace('JI_NAMESPACE.midiChord');

JI_NAMESPACE.midiChord = (function ()
{
    "use strict";
    // begin var
    var
    CMD = MIDI_API.constants.COMMAND,
    CTL = MIDI_API.constants.CONTROL,
    Event = MIDI_API.event.Event,
    to14Bit = MIDI_API.event.to14Bit,
    Moment = MIDI_API.moment.Moment, // constructor

    moments,
    // The rate (milliseconds) at which slider events are sent.
    SLIDER_MILLISECONDS = 10,

    // Used by both MIDIRests and MIDIChords.
    // A private function in this namespace.
    addToTrack = function (track)
    {
        var i, miMoments = moments,
        nMoments = miMoments.length;

        for (i = 0; i < nMoments; ++i)
        {
            track.addMoment(miMoments[i]); // the main sequence at msPosition = 0
        }
    },

    // public MIDIChord constructor
    // A MIDIChord contains all the midi events required for playing an (ornamented) chord.
    MIDIChord = function (channel, chordDef, timeObject, speed)
    {
        if (!(this instanceof MIDIChord))
        {
            return new MIDIChord(channel, chordDef, timeObject, speed);
        }

        if (chordDef.basicChordsArray === undefined)
        {
            throw "Error: the chord definition must contain a basicChordsArray!";
        }

        this.msPosition = timeObject.msPosition;
        this.msDuration = timeObject.msDuration;
        this.moments = this.getMoments(channel, chordDef, timeObject, speed); // defined in prototype
        // moments is an ordered array of moments (containing events for sequential chords and slider events).
        // A Moment is a list of logically synchronous MIDI events.

        this.addToTrack = addToTrack; // private function in this namespace, shared by MIDIChord and MIDIRest

        return this;
    },

    // a MIDIRest has the same structure as a MIDIChord, but it
    // has a single Moment containing a single, empty message. 
    MIDIRest = function (timeObject)
    {
        if (!(this instanceof MIDIRest))
        {
            return new MIDIRest(timeObject);
        }

        this.msPosition = timeObject.msPosition;
        this.msDuration = timeObject.msDuration;
        this.moments = this.getMoments(timeObject); // defined in prototype

        this.addToTrack = addToTrack; // private function in this namespace, shared by MIDIChord and MIDIRest

        return this;
    },

    publicChordRestAPI =
    {
        // public MIDIChord constructor
        // A MIDIChord contains a private array of Moments containing all
        // the midi events required for playing an (ornamented) chord.
        // A Moment is a collection of logically synchronous MIDI events.
        // A MIDIChord has one public function:
        //    midiChord.addToTrack(track)
        // which moves the midiChord's Moments onto the track
        MIDIChord: MIDIChord,

        // A MIDIRest is like a MIDIChord which has a single, empty Moment.
        // MIDIRests are necessary so that running cursors can be moved to their
        // symbol, when sequences call reportMsPositionInScore(msPositionInScore).
        MIDIRest: MIDIRest
    };
    // end var

    MIDIChord.prototype.getMoments = function(channel, chordDef, timeObject, speed)
    {
        var 
        chordMoments,
        sliderMoments;

        // An array of moments whose msPosition has been set.
        // The moments contain all the non-slider components of the chordDef.
        // The msPosition of the first Moment is set to the value in the msPosition argument.
        function getChordMoments(channel, chordDef, timeObject, speed)
        {
            var i, j,
                len = chordDef.basicChordsArray.length,
                basicChordMsDurations,
                notes,
                notesLength,
                basicChordDef,
                msPos = Number(timeObject.msPosition),
                allNoteOffs = [],
                chordMoments = [],
                noteNumber,
                moment,
                currentMoment;

            function bcMsDurations(basicChords, totalMsDuration, speed)
            {
                var msDurations = [],
                i, basicChordsLength = basicChords.length, msFPDuration,
                        msFPPositions = [], msPositions = [], nMsPositions, msDuration, localTotal;

                if (basicChordsLength < 2)
                {
                    throw "Condition: there must be more than one basic chord here.";
                }

                if (speed === 1)
                {
                    for (i = 0; i < basicChordsLength; ++i)
                    {
                        msDurations.push(basicChords[i].msDuration);
                    }
                }
                else
                {
                    msFPPositions.push(0);
                    for (i = 0; i < basicChordsLength; ++i)
                    {
                        msFPDuration = basicChords[i].msDuration / speed;
                        msFPPositions.push(msFPDuration + msFPPositions[i]);
                    }
                    nMsPositions = basicChordsLength + 1;
                    for (i = 0; i < nMsPositions; ++i)
                    {
                        msPositions.push(Math.round(msFPPositions[i]));
                    }
                    localTotal = 0;
                    for (i = 0; i < basicChordsLength; ++i)
                    {
                        msDuration = msPositions[i + 1] - msPositions[i];
                        localTotal += msDuration;
                        msDurations.push(msDuration);
                    }
                    // should be okay, but just in case...
                    if (localTotal !== totalMsDuration)
                    {
                        msDurations[basicChordsLength - 1] += (totalMsDuration - localTotal);
                    }
                    if (msDurations[basicChordsLength - 1] < 1)
                    {
                        throw "bad speed change";
                    }
                }

                return msDurations;
            }

            // Chord Bank, Patch, Volume and PitchwheelDeviation events
            // Returns undefined if there are no attributes
            function attributesMoment(channel, chordDef, msPosition)
            {
                var attrMoment,
                    msg,
                    attributes;

                /// Sets both RegisteredParameter controls to 0 (zero). This is standard MIDI for selecting the
                /// pitch wheel so that it can be set by the subsequent DataEntry events.
                /// A DataEntryFine message is not set, because it is not needed and has no effect anyway.
                /// However, RegisteredParameterFine MUST be set, otherwise the events as a whole have no effect!
                function setPitchwheelDeviation(attrMoment, deviation, channel)
                {
                    var msg;
                    msg = new Event(CMD.CONTROL_CHANGE + channel, CTL.REGISTERED_PARAMETER_COARSE, 0, attrMoment.msPositionInScore);
                    attrMoment.addEvent(msg);
                    msg = new Event(CMD.CONTROL_CHANGE + channel, CTL.REGISTERED_PARAMETER_FINE, 0, attrMoment.msPositionInScore);
                    attrMoment.addEvent(msg);
                    msg = new Event(CMD.CONTROL_CHANGE + channel, CTL.DATA_ENTRY_COARSE, deviation, attrMoment.msPositionInScore);
                    attrMoment.addEvent(msg);
                }

                if (chordDef.attributes !== undefined)
                {
                    attributes = chordDef.attributes;
                    attrMoment = new Moment(msPosition);

                    // the id, and minBasicChordMsDuration attributes are not midi events
                    // the hasChordOff attribute is dealt with later.
                    if (attributes.bank !== undefined)
                    {
                        msg = new Event(CMD.CONTROL_CHANGE + channel, 0, attributes.bank, attrMoment.msPositionInScore); // 0 is bank control
                        attrMoment.addEvent(msg);
                    }
                    if (attributes.patch !== undefined)
                    {
                        msg = new Event(CMD.PROGRAM_CHANGE + channel, attributes.patch, 0, attrMoment.msPositionInScore);
                        attrMoment.addEvent(msg);
                    }
                    if (attributes.volume !== undefined)
                    {
                        msg = new Event(CMD.CONTROL_CHANGE + channel, 7, attributes.volume, attrMoment.msPositionInScore); // 7 is volume control
                        attrMoment.addEvent(msg);
                    }
                    if (attributes.pitchWheelDeviation !== undefined)
                    {
                        setPitchwheelDeviation(attrMoment, attributes.pitchWheelDeviation, channel);
                    }
                }

                return attrMoment;
            }

            // BasicChord Bank, Patch and ChordOn events
            function basicChordOnMoment(channel, basicChordDef, msPosition)
            {
                var midiNotes = basicChordDef.notes,
                    midiVelocities = basicChordDef.velocities,
                    len = midiNotes.length,
                    event,
                    bcoMoment = new Moment(msPosition),
                    i;

                if (basicChordDef.bank !== undefined) // default is dont send a bank change
                {
                    event = new Event(CMD.CONTROL_CHANGE + channel, basicChordDef.bank, 0, bcoMoment.msPositionInScore);
                    bcoMoment.addEvent(event);

                    event = new Event(CMD.PROGRAM_CHANGE + channel, basicChordDef.patch, 0, bcoMoment.msPositionInScore);
                    bcoMoment.addEvent(event);
                }
                else if (basicChordDef.patch !== undefined) // default is dont send a patch change
                {
                    event = new Event(CMD.PROGRAM_CHANGE + channel, basicChordDef.patch, 0, bcoMoment.msPositionInScore);
                    bcoMoment.addEvent(event);
                }

                for (i = 0; i < len; ++i)
                {
                    event = new Event(CMD.NOTE_ON + channel, midiNotes[i], midiVelocities[i], bcoMoment.msPositionInScore);
                    bcoMoment.addEvent(event);
                }

                return bcoMoment;
            }

            function basicChordOffMoment(channel, basicChordDef, msPosition)
            {
                var notes = basicChordDef.notes,
                    len = notes.length,
                    volume = 100,
                    bcoffMoment = new Moment(msPosition),
                    event,
                    i;

                for (i = 0; i < len; ++i)
                {
                    event = new Event(CMD.NOTE_OFF + channel, notes[i], volume, bcoffMoment.msPositionInScore);
                    bcoffMoment.addEvent(event);
                }

                return bcoffMoment;
            }

            // noteOffs contains all the noteNumbers that need to be sent a noteOff,
            // noteOffs contains duplicates. Avoid creating duplicate noteOffs in this function.
            function chordOffMoment(channel, noteOffs, msPosition)
            {
                var uniqueNoteNumbers = [], nnIndex, noteNumber,
                    volume = 127,
                    cOffMoment = new Moment(msPosition),
                    event;

                function getUniqueNoteNumbers(noteOffs)
                {
                    var unique = [], i, length = noteOffs.length, val;
                    for (i = 0; i < length; ++i)
                    {
                        val = noteOffs[i];
                        if (unique.indexOf(val) === -1)
                        {
                            unique.push(val);
                        }
                    }
                    return unique;
                }

                uniqueNoteNumbers = getUniqueNoteNumbers(noteOffs);

                for (nnIndex = 0; nnIndex < uniqueNoteNumbers.length; ++nnIndex)
                {
                    noteNumber = uniqueNoteNumbers[nnIndex];
                    event = new Event(CMD.NOTE_OFF + channel, noteNumber.valueOf(), volume, cOffMoment.msPositionInScore);
                    cOffMoment.addEvent(event);
                }

                return cOffMoment;
            }

            // initial AttributesMoment
            currentMoment = attributesMoment(channel, chordDef, msPos);
            if (currentMoment !== undefined)
            {
                chordMoments.push(currentMoment);
            }

            if (len > 1)
            {
                basicChordMsDurations = bcMsDurations(chordDef.basicChordsArray, timeObject.msDuration, speed);
            }

            // BasicChordMoments
            for (i = 0; i < len; i++)
            {
                basicChordDef = chordDef.basicChordsArray[i];

                if (chordDef.attributes.hasChordOff === undefined || chordDef.attributes.hasChordOff === true)
                {
                    notes = basicChordDef.notes;
                    notesLength = notes.length;
                    for (j = 0; j < notesLength; ++j)
                    {
                        noteNumber = notes[j];
                        allNoteOffs.push(noteNumber);
                        // allNoteOffs is used at the end of the ornament to turn notes off that were turned on during the ornament.
                    }
                }

                moment = basicChordOnMoment(channel, basicChordDef, msPos);

                if (currentMoment !== undefined && currentMoment.msPositionInScore === moment.msPositionInScore)
                {
                    currentMoment.mergeMoment(moment);
                }
                else
                {
                    chordMoments.push(moment);
                    currentMoment = moment;
                }

                if (len === 1)
                {
                    msPos += timeObject.msDuration; // has already been corrected for speed
                }
                else
                {
                    msPos += basicChordMsDurations[i]; // these have been corrected for speed
                }

                if (basicChordDef.hasChordOff === undefined || basicChordDef.hasChordOff === true)
                {
                    // chordOff always comes after chordOn
                    currentMoment = basicChordOffMoment(channel, basicChordDef, msPos);
                    chordMoments.push(currentMoment);
                }
            }

            // final ChordOffMoment
            // (Contains a noteOFF for each note that has been sent a noteON during the BasicChordMoments.)
            if (chordDef.attributes.hasChordOff === undefined || chordDef.attributes.hasChordOff === true)
            {
                moment = chordOffMoment(channel, allNoteOffs, msPos);
                currentMoment.mergeMoment(moment);
            }

            return chordMoments;
        }

        // An array of moments whose msPosition has been set.
        // Each moment contains slider events for each of the defined sliders.
        // These moments always happen at a rate defined by sliderMilliseconds.
        // 50ms is the default, but other values are possible.
        // None of the returned sliderMoments has 0 events.
        // This function is only called if sliders are defined, so the length of the returned array
        // can either be 1 (i.e. none of the sliders' values changes during this MIDIChord)
        // or a value calculated from SLIDER_MILLISECONDS and msDuration. In the latter case, the
        // msPosition of the final sliderMoment is less than (msPosition + msDuration).
        function getSliderMoments(channel, sliders, msPosition, msDuration, sliderMilliseconds)
        {
            var i, sliderMoments, sliderMomentsLength, nonEmptySliderMoments;

            function getEmptySliderMoments(msPosition, msDuration, sliderMilliseconds)
            {
                var moments = [],
                    numberOfMoments = Math.floor(Number(msDuration) / sliderMilliseconds),
                    eventFloatDuration = 0,
                    msFloatDuration = Number(msDuration),
                    currentIntPosition = Number(msPosition),
                    currentFloatPosition = Number(currentIntPosition),
                    moment,
                    i;

                if (numberOfMoments === 0)
                {
                    numberOfMoments = 1;
                }

                eventFloatDuration = msFloatDuration / numberOfMoments; // eventDuration is a float
                for (i = 0; i < numberOfMoments; i++)
                {
                    moment = new Moment(currentIntPosition);
                    moments.push(moment);
                    currentFloatPosition += eventFloatDuration;
                    currentIntPosition = Math.floor(currentFloatPosition);
                }

                if (moments[moments.length - 1].msPosition >= (msPosition + msDuration))
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

                            if (originalLength > 2)
                            {
                                stretchFactor = numberOfFinalValues / (originalLength - 1);
                                for (i = 1; i < originalLength - 1; ++i)
                                {
                                    finalPeakIndices.push(Math.floor(i * stretchFactor));
                                }
                            }

                            finalPeakIndices.push(numberOfFinalValues - 1);

                            return finalPeakIndices;
                        }

                        finalPeakIndices = getFinalPeakIndices(numberOfFinalValues, originalLength);
                        if (originalLength > 1)
                        {
                            for (oIndex = 1; oIndex < originalLength; oIndex++)
                            {
                                f1Index = finalPeakIndices[oIndex - 1];
                                f2Index = finalPeakIndices[oIndex];
                                oValue1 = oValues[oIndex - 1];
                                oValue2 = oValues[oIndex];
                                nSectionValues = f2Index - f1Index;
                                increment = (oValue2 - oValue1) / nSectionValues;
                                j = 0;
                                for (i = f1Index; i < f2Index; i++)
                                {
                                    stretchedContour.push(oValue1 + Math.floor(increment * j++));
                                }
                            }
                        }

                        stretchedContour.push(oValues[originalLength - 1]);

                        return stretchedContour;
                    }

                    if (originalLength === 1)
                    {
                        for (fIndex = 0; fIndex < numberOfFinalValues; fIndex++)
                        {
                            finalValuesArray.push(originalValuesArray[0]); // repeating values means "no change" (no msg) in the slider
                        }
                    }
                    else if (originalLength === numberOfFinalValues)
                    {
                        for (fIndex = 0; fIndex < numberOfFinalValues; fIndex++)
                        {
                            finalValuesArray.push(originalValuesArray[fIndex]);
                        }
                    }
                    else if (originalLength < numberOfFinalValues)
                    {   // this should be the usual case
                        finalValuesArray = getStretchedContour(numberOfFinalValues, originalValuesArray);
                    }
                    else if (originalLength > numberOfFinalValues)
                    {
                        finalValuesArray.push(originalValuesArray[0]);
                        for (fIndex = 1; fIndex < numberOfFinalValues - 1; fIndex++)
                        {
                            oIndex = fIndex * (Math.floor(originalLength / numberOfFinalValues));
                            finalValuesArray.push(originalValuesArray[oIndex]);
                        }
                        finalValuesArray.push(originalValuesArray[originalLength - 1]);
                    }

                    return finalValuesArray;
                }
                // repeating slider values are not added to the sliderMoments
                function addSliderValues(channel, sliderMoments, typeString, finalValuesArray)
                {
                    var len = finalValuesArray.length,
                        moment,
                        value,
                        previousValue = -1,
                        event,
                        i, d, pitchWheelValue;

                    // Argument value is in range 0..128 
                    // According to the docs,
                    //     the minimum PITCH_WHEEL value is 0
                    //     the maximum PITCH_WHEEL value is 16383 (0x3FFF)
                    //     centre value (0 deviation) is at 8192 (0x2000)
                    function getPitchWheelValue(value)
                    {
                        var pitchWheelValue;

                        if (value < 0 || value > 128)
                        {
                            throw "Error: value out of range.";
                        }

                        // value:0 -> pitchWheelValue:0
                        // value:64 -> pitchWheelValue:8192 
                        // value:128 -> pitchWheelValue:16383
                        pitchWheelValue = 8192 - ((64 - value) * 128);
                        pitchWheelValue = (pitchWheelValue === 16384) ? 16383 : pitchWheelValue;

                        return pitchWheelValue;
                    }

                    if (sliderMoments.length !== finalValuesArray.length)
                    {
                        throw "Unequal array lengths.";
                    }
                    for (i = 0; i < len; i++)
                    {
                        moment = sliderMoments[i];
                        value = finalValuesArray[i];
                        if (value !== previousValue) // repeating events are not sent
                        {
                            previousValue = value;
                            switch (typeString)
                            {
                                case "pitchWheel":
                                    pitchWheelValue = getPitchWheelValue(value);
                                    // to14Bit is only used for CMD.PITCH_WHEEL:
                                    d = to14Bit(pitchWheelValue);
                                    event = new Event(CMD.PITCH_WHEEL + channel, d.data1, d.data2, moment.msPositionInScore);
                                    moment.addEvent(event);
                                    break;
                                case "pan":
                                    event = new Event(CMD.CONTROL_CHANGE + channel, CTL.PAN, value, moment.msPositionInScore);
                                    moment.addEvent(event);
                                    break;
                                case "modulationWheel":
                                    event = new Event(CMD.CONTROL_CHANGE + channel, CTL.MODWHEEL, value, moment.msPositionInScore);
                                    moment.addEvent(event);
                                    break;
                                case "expression":
                                    event = new Event(CMD.CONTROL_CHANGE + channel, CTL.EXPRESSION, value, moment.msPositionInScore);
                                    moment.addEvent(event);
                                    break;
                            }
                        }
                    }
                }

                numberOfFinalValues = sliderMoments.length;
                finalValuesArray = getFinalValuesArray(numberOfFinalValues, originalValuesArray);
                // repeating slider values are not added to the sliderMoments
                addSliderValues(channel, sliderMoments, typeString, finalValuesArray);
            }

            // sliderMoments is an array of timed moments. The events are initially empty.
            // By default, the moments are at a rate of (ca.) 50ms (ca. 20 per second).
            // The total duration of the slidersQueue is equal to msDuration.
            sliderMoments = getEmptySliderMoments(msPosition, msDuration, sliderMilliseconds);

            // the final argument in the following 4 calls is always either undefined or an array of integers [0..127]
            if (sliders.pitchWheel)
            {
                setSlider(channel, sliderMoments, "pitchWheel", sliders.pitchWheel);
            }
            if (sliders.pan)
            {
                setSlider(channel, sliderMoments, "pan", sliders.pan);
            }
            if (sliders.modulationWheel)
            {
                setSlider(channel, sliderMoments, "modulationWheel", sliders.modulationWheel);
            }
            if (sliders.expressionSlider)
            {
                setSlider(channel, sliderMoments, "expression", sliders.expressionSlider);
            }

            sliderMomentsLength = sliderMoments.length;
            nonEmptySliderMoments = [];
            for (i = 0; i < sliderMoments.length; ++i)
            {
                if (sliderMoments[i].events.length > 0)
                {
                    nonEmptySliderMoments.push(sliderMoments[i]);
                }
            }
            return nonEmptySliderMoments;
        }

        // returns  a single, ordered array of moments
        // If chordMoment.msPositionInScore === sliderMoment.msPositionInScore,
        // they are unified with the slider events being sent first.
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
                    if (moment.msPositionInScore > currentMsPosition)
                    {
                        currentMsPosition = moment.msPositionInScore;
                        momentsArray.push(moment);
                        currentMoment = moment;
                    }
                    else if (moment.msPositionInScore === currentMsPosition)
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

                while (chordMoment || sliderMoment)
                {
                    if (chordMoment)
                    {
                        if (sliderMoment)
                        {
                            if (sliderMoment.msPositionInScore <= chordMoment.msPositionInScore)
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
                    else if (sliderMoment)
                    {
                        appendMoment(sliderMoment);
                        sliderMoment = sliderMoments[sliderMomentIndex++];
                    }
                }
            }

            if (chordMoments === undefined || sliderMoments === undefined)
            {
                throw "Error: both chordMoments and sliderMoments must be defined";
            }

            if (sliderMoments.length === 0)
            {
                momentsArray = chordMoments;
            }
            else if (sliderMoments.length === 1)
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

        chordMoments = getChordMoments(channel, chordDef, timeObject, speed);

        if (chordDef.sliders !== undefined)
        {
            sliderMoments = getSliderMoments(channel, chordDef.sliders, this.msPosition, this.msDuration, SLIDER_MILLISECONDS);
            moments = getCombinedMoments(chordMoments, sliderMoments);
        }
        else
        {
            moments = chordMoments;
        }

        Object.defineProperty(moments[0], "chordStart", { value: true, writable: false });
    };

    // returns an array containing a single moment having a "restStart" attribute.
    // The moment's messages array is empty.
    MIDIRest.prototype.getMoments = function (timeObject)
    {
        var restMoment;

        restMoment = new Moment(timeObject.msPosition);
        Object.defineProperty(restMoment, "restStart", { value: true, writable: false });

        moments = [];
        moments.push(restMoment); // an empty moment.

        return moments;
    };

    return publicChordRestAPI;
} ());
