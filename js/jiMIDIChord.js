/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  jiMIDIChord.js
 *  This module uses JazzMidiBridge to create MIDIMessages.
 *  Its public interface contains:
 *      init(JMB) // saves a pointer to JazzMidiBridge in this namespace
 *      newAllSoundOffMessage() // returns a new AllSoundOffMessage
 *      MIDIChord(channel, chordDef, timeObject, speed) // MIDIChord constructor
 *      MIDIRest(timeObject) // MIDIRest constructor
 *  
 */

JI_NAMESPACE.namespace('JI_NAMESPACE.midiChord');

JI_NAMESPACE.midiChord = (function ()
{
    "use strict";
    // begin var
    var 
    MIDIMoment = JI_NAMESPACE.midiMoment.MIDIMoment, // constructor
    midiMoments,
    // The rate (milliseconds) at which slider messages are sent.
    SLIDER_MILLISECONDS = 10,
    _JMB,

    init = function (jmb)
    {
        _JMB = jmb;
    },

    newAllSoundOffMessage = function ()
    {
        return _JMB.createMIDIMessage(_JMB.CONTROL_CHANGE, 120, 0, 0, 0); // 120 is MIDI allSoundOff
    },

    // An array of midiMoments whose msPosition has been set.
    // The midiMoments contain all the non-slider components of the chordDef.
    // The msPosition of the first MIDIMoment is set to the value in the msPosition argument.
    getChordMoments = function (JMB, channel, chordDef, timeObject, speed)
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
            midiMoment,
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

        // Chord Bank, Patch, Volume and PitchwheelDeviation messages
        // Returns undefined if there are no attributes
        function attributesMoment(JMB, channel, chordDef, msPosition)
        {
            var attrMoment,
                msg,
                attributes;

            /// Sets both RegisteredParameter controls to 0 (zero). This is standard MIDI for selecting the
            /// pitch wheel so that it can be set by the subsequent DataEntry messages.
            /// A DataEntryFine message is not set, because it is not needed and has no effect anyway.
            /// However, RegisteredParameterFine MUST be set, otherwise the messages as a whole have no effect!
            function setPitchwheelDeviation(JMB, attrMoment, deviation, channel)
            {
                var msg;
                msg = JMB.createMIDIMessage(JMB.CONTROL_CHANGE, 101, 0, channel, attrMoment.timestamp); // 101 is RegisteredParameter coarse
                attrMoment.addMIDIMessage(msg);
                msg = JMB.createMIDIMessage(JMB.CONTROL_CHANGE, 100, 0, channel, attrMoment.timestamp); // 100 is RegisteredParameter fine
                attrMoment.addMIDIMessage(msg);
                msg = JMB.createMIDIMessage(JMB.CONTROL_CHANGE, 6, deviation, channel, attrMoment.timestamp); // 6 is Data Entry coarse
                attrMoment.addMIDIMessage(msg);
            }

            if (chordDef.attributes !== undefined)
            {
                attributes = chordDef.attributes;
                attrMoment = new MIDIMoment(msPosition);

                // the id, and minBasicChordMsDuration attributes are not midi messages
                // the hasChordOff attribute is dealt with later.
                if (attributes.bank !== undefined)
                {
                    msg = JMB.createMIDIMessage(JMB.CONTROL_CHANGE, 0, attributes.bank, channel, attrMoment.timestamp); // 0 is bank control
                    attrMoment.addMIDIMessage(msg);
                }
                if (attributes.patch !== undefined)
                {
                    msg = JMB.createMIDIMessage(JMB.PROGRAM_CHANGE, attributes.patch, 0, channel, attrMoment.timestamp);
                    attrMoment.addMIDIMessage(msg);
                }
                if (attributes.volume !== undefined)
                {
                    msg = JMB.createMIDIMessage(JMB.CONTROL_CHANGE, 7, attributes.volume, channel, attrMoment.timestamp); // 7 is volume control
                    attrMoment.addMIDIMessage(msg);
                }
                if (attributes.pitchWheelDeviation !== undefined)
                {
                    setPitchwheelDeviation(JMB, attrMoment, attributes.pitchWheelDeviation, channel);
                }
            }

            return attrMoment;
        }

        // BasicChord Bank, Patch and ChordOn messages
        function basicChordOnMoment(JMB, channel, basicChordDef, msPosition)
        {
            var midiNotes = basicChordDef.notes,
                midiVelocities = basicChordDef.velocities,
                len = midiNotes.length,
                midiMessage,
                bcoMoment = new MIDIMoment(msPosition),
                i;

            if (basicChordDef.bank !== undefined) // default is dont send a bank change
            {
                midiMessage = JMB.createMIDIMessage(JMB.CONTROL_CHANGE, basicChordDef.bank, 0, channel, bcoMoment.timestamp);
                bcoMoment.addMIDIMessage(midiMessage);

                midiMessage = JMB.createMIDIMessage(JMB.PROGRAM_CHANGE, basicChordDef.patch, 0, channel, bcoMoment.timestamp);
                bcoMoment.addMIDIMessage(midiMessage);
            }
            else if (basicChordDef.patch !== undefined) // default is dont send a patch change
            {
                midiMessage = JMB.createMIDIMessage(JMB.PROGRAM_CHANGE, basicChordDef.patch, 0, channel, bcoMoment.timestamp);
                bcoMoment.addMIDIMessage(midiMessage);
            }

            for (i = 0; i < len; ++i)
            {
                midiMessage = JMB.createMIDIMessage(JMB.NOTE_ON, midiNotes[i], midiVelocities[i], channel, bcoMoment.timestamp);
                bcoMoment.addMIDIMessage(midiMessage);
            }

            return bcoMoment;
        }

        function basicChordOffMoment(JMB, channel, basicChordDef, msPosition)
        {
            var notes = basicChordDef.notes,
                len = notes.length,
                volume = 100,
                bcoffMoment = new MIDIMoment(msPosition),
                midiMessage,
                i;

            for (i = 0; i < len; ++i)
            {
                midiMessage = JMB.createMIDIMessage(JMB.NOTE_OFF, notes[i], volume, channel, bcoffMoment.timestamp);
                bcoffMoment.addMIDIMessage(midiMessage);
            }

            return bcoffMoment;
        }

        // noteOffs contains all the noteNumbers that need to be sent a noteOff,
        // noteOffs contains duplicates. Avoid creating duplicate noteOffs in this function.
        function chordOffMoment(JMB, channel, noteOffs, msPosition)
        {
            var uniqueNoteNumbers = [], nnIndex, noteNumber,
                volume = 127,
                cOffMoment = new MIDIMoment(msPosition),
                midiMessage;

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
                midiMessage = JMB.createMIDIMessage(JMB.NOTE_OFF, noteNumber.valueOf(), volume, channel, cOffMoment.timestamp);
                cOffMoment.addMIDIMessage(midiMessage);
            }

            return cOffMoment;
        }

        // initial AttributesMoment
        currentMoment = attributesMoment(JMB, channel, chordDef, msPos);
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

            midiMoment = basicChordOnMoment(JMB, channel, basicChordDef, msPos);

            if (currentMoment !== undefined && currentMoment.timestamp === midiMoment.timestamp)
            {
                currentMoment.addMIDIMoment(midiMoment);
            }
            else
            {
                chordMoments.push(midiMoment);
                currentMoment = midiMoment;
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
                currentMoment = basicChordOffMoment(JMB, channel, basicChordDef, msPos);
                chordMoments.push(currentMoment);
            }
        }

        // final ChordOffMoment
        // (Contains a noteOFF for each note that has been sent a noteON during the BasicChordMoments.)
        if (chordDef.attributes.hasChordOff === undefined || chordDef.attributes.hasChordOff === true)
        {
            midiMoment = chordOffMoment(JMB, channel, allNoteOffs, msPos);
            currentMoment.addMIDIMoment(midiMoment);
        }

        return chordMoments;
    },

    // An array of midiMoments whose msPosition has been set.
    // Each midiMoment contains slider messages for each of the defined sliders.
    // These midiMoments always happen at a rate defined by sliderMilliseconds.
    // 50ms is the default, but other values are possible.
    // None of the returned sliderMoments has 0 messages.
    // This function is only called if sliders are defined, so the length of the returned array
    // can either be 1 (i.e. none of the sliders' values changes during this MIDIChord)
    // or a value calculated from SLIDER_MILLISECONDS and msDuration. In the latter case, the
    // msPosition of the final sliderMoment is less than (msPosition + msDuration).
    getSliderMoments = function (JMB, channel, sliders, msPosition, msDuration, sliderMilliseconds)
    {
        var i, sliderMoments, sliderMomentsLength, nonEmptySliderMoments;

        function getEmptySliderMoments(msPosition, msDuration, sliderMilliseconds)
        {
            var midiMoments = [],
                numberOfMsgs = Math.floor(Number(msDuration) / sliderMilliseconds),
                eventFloatDuration = 0,
                msFloatDuration = Number(msDuration),
                currentIntPosition = Number(msPosition),
                currentFloatPosition = Number(currentIntPosition),
                midiMoment,
                i;

            if (numberOfMsgs > 0)
            {
                eventFloatDuration = msFloatDuration / numberOfMsgs; // eventDuration is a float
                for (i = 0; i < numberOfMsgs; i++)
                {
                    midiMoment = new MIDIMoment(currentIntPosition);
                    midiMoments.push(midiMoment);
                    currentFloatPosition += eventFloatDuration;
                    currentIntPosition = Math.floor(currentFloatPosition);
                }
            }

            if (midiMoments[midiMoments.length - 1].msPosition >= (msPosition + msDuration))
            {
                throw "illegal final slider moment";
            }

            return midiMoments;
        }

        function setSlider(JMB, channel, sliderMoments, typeString, originalValuesArray)
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
            function addSliderValues(JMB, channel, sliderMoments, typeString, finalValuesArray)
            {
                var len = finalValuesArray.length,
                    midiMoment,
                    value,
                    previousValue = -1,
                    midiMessage,
                    PAN = 10,
                    MOD_WHEEL = 1,
                    EXPRESSION = 11,
                    i;

                if (sliderMoments.length !== finalValuesArray.length)
                {
                    throw "Unequal array lengths.";
                }
                for (i = 0; i < len; i++)
                {
                    midiMoment = sliderMoments[i];
                    value = finalValuesArray[i];
                    if (value !== previousValue) // repeating messages are not sent
                    {
                        previousValue = value;
                        switch (typeString)
                        {
                            case "pitchWheel":
                                midiMessage = JMB.createMIDIMessage(JMB.PITCH_BEND, 0, value, channel, midiMoment.timestamp);
                                midiMoment.addMIDIMessage(midiMessage);
                                break;
                            case "pan":
                                midiMessage = JMB.createMIDIMessage(JMB.CONTROL_CHANGE, PAN, value, channel, midiMoment.timestamp);
                                midiMoment.addMIDIMessage(midiMessage);
                                break;
                            case "modulationWheel":
                                midiMessage = JMB.createMIDIMessage(JMB.CONTROL_CHANGE, MOD_WHEEL, value, channel, midiMoment.timestamp);
                                midiMoment.addMIDIMessage(midiMessage);
                                break;
                            case "expression":
                                midiMessage = JMB.createMIDIMessage(JMB.CONTROL_CHANGE, EXPRESSION, value, channel, midiMoment.timestamp);
                                midiMoment.addMIDIMessage(midiMessage);
                                break;
                        }
                    }
                }
            }

            numberOfFinalValues = sliderMoments.length;
            finalValuesArray = getFinalValuesArray(numberOfFinalValues, originalValuesArray);
            // repeating slider values are not added to the sliderMoments
            addSliderValues(JMB, channel, sliderMoments, typeString, finalValuesArray);
        }

        // sliderMoments is an array of timed midiMoments. The events are initially empty.
        // By default, the midiMoments are at a rate of (ca.) 50ms (ca. 20 per second).
        // The total duration of the slidersQueue is equal to msDuration.
        sliderMoments = getEmptySliderMoments(msPosition, msDuration, sliderMilliseconds);

        // the final argument in the following 4 calls is always either undefined or an array of integers [0..127]
        if (sliders.pitchWheel)
        {
            setSlider(JMB, channel, sliderMoments, "pitchWheel", sliders.pitchWheel);
        }
        if (sliders.pan)
        {
            setSlider(JMB, channel, sliderMoments, "pan", sliders.pan);
        }
        if (sliders.modulationWheel)
        {
            setSlider(JMB, channel, sliderMoments, "modulationWheel", sliders.modulationWheel);
        }
        if (sliders.expressionSlider)
        {
            setSlider(JMB, channel, sliderMoments, "expression", sliders.expressionSlider);
        }

        sliderMomentsLength = sliderMoments.length;
        nonEmptySliderMoments = [];
        for (i = 0; i < sliderMoments.length; ++i)
        {
            if (sliderMoments[i].messages.length > 0)
            {
                nonEmptySliderMoments.push(sliderMoments[i]);
            }
        }
        return nonEmptySliderMoments;
    },

    // returns  a single, ordered array of midiMoments
    // If chordMoment.timestamp === sliderMoment.timestamp,
    // they are unified with the slider messages being sent first.
    getCombinedMIDIMoments = function (chordMoments, sliderMoments)
    {
        var midiMomentsArray = [],
            currentMsPosition = -1,
            chordMomentIndex = 0, sliderMomentIndex = 0,
            currentMoment, chordMoment, sliderMoment;

        function combineLong(chordMoments, sliderMoments)
        {
            function appendMoment(midiMoment)
            {
                if (midiMoment.timestamp > currentMsPosition)
                {
                    currentMsPosition = midiMoment.timestamp;
                    midiMomentsArray.push(midiMoment);
                    currentMoment = midiMoment;
                }
                else if (midiMoment.timestamp === currentMsPosition)
                {
                    currentMoment.addMIDIMoment(midiMoment);
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
                        if (sliderMoment.timestamp <= chordMoment.timestamp)
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
            midiMomentsArray = chordMoments;
        }
        else if (sliderMoments.length === 1)
        {
            sliderMoments[0].addMIDIMoment(chordMoments[0]);
            chordMoments[0] = sliderMoments[0];
            midiMomentsArray = chordMoments;
        }
        else
        {
            combineLong(chordMoments, sliderMoments); // sets midiMomentsArray
        }

        return midiMomentsArray;
    },

    addToTrack = function (track)
    {
        var i, miMoments = midiMoments,
        nMoments = miMoments.length;

        for (i = 0; i < nMoments; ++i)
        {
            // a track is defined in JI_NAMESPACE.track,
            // track.addMIDIMoment throws an exception if there is an error.
            track.addMIDIMoment(miMoments[i]);
        }
    },

    // public MIDIChord constructor
    // A MIDIChord contains all the midi messages required for playing an (ornamented) chord.
    // A MIDIChord has the private members:
    //    midiChord.timestamp (an integer);
    //    midiChord.midiMoments;
    // midiMoments is an ordered array of midiMoments (containing messages for sequential chords and slider events).
    // A MIDIMoment is a list of logically synchronous MIDI messages.
    //
    // And one public function:
    //      midiChord.addToTrack(track)
    //
    MIDIChord = function (channel, chordDef, timeObject, speed)
    {
        var chordMoments, sliderMoments,
            JMB = _JMB;

        if (!(this instanceof MIDIChord))
        {
            return new MIDIChord(channel, chordDef, timeObject);
        }

        this.msPosition = timeObject.msPosition;
        this.msDuration = timeObject.msDuration;

        if (chordDef.basicChordsArray === undefined)
        {
            throw "Error: the chord definition must contain a basicChordsArray!";
        }

        chordMoments = getChordMoments(JMB, channel, chordDef, timeObject, speed);

        if (chordDef.sliders !== undefined)
        {
            sliderMoments = getSliderMoments(JMB, channel, chordDef.sliders, this.msPosition, this.msDuration, SLIDER_MILLISECONDS);
            midiMoments = getCombinedMIDIMoments(chordMoments, sliderMoments);
        }
        else
        {
            midiMoments = chordMoments;
        }

        midiMoments[0].messages[0].reportTimestamp = true; // used by sequencer
        midiMoments[midiMoments.length - 1].messages[0].reportTimestamp = true; // used by sequencer

        this.addToTrack = addToTrack;

        return this;
    },

    // a MIDIRest is like a MIDIChord which has a single, empty MIDIMoment 
    MIDIRest = function (timeObject)
    {
        var restMoment;

        if (!(this instanceof MIDIRest))
        {
            return new MIDIRest(timeObject);
        }

        restMoment = new MIDIMoment(timeObject.msPosition);
        midiMoments = [];
        midiMoments.push(restMoment); // an empty moment

        this.msPosition = timeObject.msPosition;
        this.msDuration = timeObject.msDuration;

        this.addToTrack = addToTrack;

        return this;
    },

    publicAPI =
    {
        // initializes the _JMB value local to this namespace
        init: init,

        // function which returns a new AllSoundOffMessage 
        newAllSoundOffMessage: newAllSoundOffMessage,

        // public MIDIChord constructor
        // A MIDIChord contains a private array of MIDIMoments containing all
        // the midi messages required for playing an (ornamented) chord.
        // A MIDIMoment is a collection of logically synchronous MIDI messages.
        // A MIDIChord has one public function:
        //    midiChord.addToTrack(track)
        // which moves the midiChord's MIDIMoments onto the track
        MIDIChord: MIDIChord,

        // A MIDIRest is like a MIDIChord which has a single, empty MIDIMoment.
        // MIDIRests are necessary so that running cursors can be moved to their
        // symbol, when sequences call reportTimestamp(timestamp).
        MIDIRest: MIDIRest
    };
    // end var

    return publicAPI;
} ());
