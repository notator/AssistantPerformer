/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/MIDIChord.js
 *  Public interface:
 *      newAllSoundOffMessage() // returns a new AllSoundOffMessage
 *      MIDIChord(channel, chordDef, timeObject, chordIsSilent) // MIDIChord constructor
 *      MIDIRest(timeObject) // MIDIRest constructor  
 */

/*jslint bitwise: false, nomen: true, plusplus: true, white: true */

_AP.namespace('_AP.midiChord');

_AP.midiChord = (function ()
{
    "use strict";
    // begin var
    var
    CMD = MIDILib.constants.COMMAND,
    CTL = MIDILib.constants.CONTROL,
    Message = MIDILib.message.Message,
    Moment = MIDILib.moment.Moment, // constructor

    moments,
    // The rate (milliseconds) at which slider messages are sent.
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
    // A MIDIChord contains all the midi messages required for playing an (ornamented) chord.
    // If chordisSilent == true, this is a chord being played by a silent soloist (=conductor),
    // and the chord is not given any MIDI messages.
    MIDIChord = function (channel, chordDef, timeObject, chordIsSilent)
    {
        if (!(this instanceof MIDIChord))
        {
            return new MIDIChord(channel, chordDef, timeObject, chordIsSilent);
        }

        if (chordDef.basicChordsArray === undefined)
        {
            throw "Error: the chord definition must contain a basicChordsArray!";
        }

        this.msPosition = timeObject.msPosition;
        this.msDuration = timeObject.msDuration;
        if(chordIsSilent === true)
        {
            this.moments = this.getSilentMoment(timeObject); // like rest.getMoments()
        }
        else
        {
            this.moments = this.getMoments(channel, chordDef, timeObject); // defined in prototype
            // moments is an ordered array of moments (containing messages for sequential chords and slider messages).
            // A Moment is a list of logically synchronous MIDI messages.
        }

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
        // the midi messages required for playing an (ornamented) chord.
        // A Moment is a collection of logically synchronous MIDI messages.
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

    MIDIChord.prototype.getMoments = function(channel, chordDef, timeObject)
    {
        var 
        chordMoments,
        sliderMoments;

        // An array of moments whose msPosition has been set.
        // The moments contain all the non-slider components of the chordDef.
        // The msPosition of the first Moment is set to the value in the msPosition argument.
        function getChordMoments(channel, chordDef, timeObject)
        {
            var i, j,
                len = chordDef.basicChordsArray.length,
                basicChordMsDurations,
                notes,
                notesLength,
                basicChordDef,
                msPos = Number(timeObject.msPosition),
                endOfChordNoteOffs = [],
                chordMoments = [],
                noteNumber,
                moment,
                currentMoment;

            // Returns an array of integral msDurations whose sum is totalMsDuration.
            // The msDurations in the basicChords are first totalled to localTotal,
            // then the new speed is calculated as
            // speed = basicChordsTotalMsDuration / totalMsDuration;
            // (totalMsDuration already takes account of the global speed option)
            function bcMsDurations(basicChords, totalMsDuration)
            {
                var msDurations = [], speed,
                i, basicChordsLength = basicChords.length, msFPDuration,
                msFPPositions = [], msPositions = [], nMsPositions, msDuration, basicChordsTotalMsDuration = 0, localTotal = 0;

                if (basicChordsLength < 1)
                {
                    throw "Condition: there must be at least one basic chord here.";
                }

                for (i = 0; i < basicChordsLength; ++i)
                {
                    basicChordsTotalMsDuration += basicChords[i].msDuration;
                }

                speed = basicChordsTotalMsDuration / totalMsDuration;

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

            // Chord PitchwheelDeviation messages
            // Returns undefined if there are no attributes
            function attributesMoment(channel, chordDef, msPosition)
            {
                var attrMoment, attributes;

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

                if (chordDef.attributes !== undefined)
                {
                    attributes = chordDef.attributes;
                    attrMoment = new Moment(msPosition);

                    // the id, and minBasicChordMsDuration attributes are not midi messages
                    // the hasChordOff attribute is dealt with later.

                    if (attributes.pitchWheelDeviation !== undefined)
                    {
                        setPitchwheelDeviation(attrMoment, attributes.pitchWheelDeviation, channel);
                    }
                }

                return attrMoment;
            }

            // BasicChord Bank, Patch and ChordOn messages
            function basicChordOnMoment(channel, basicChordDef, msPosition)
            {
                var midiNotes = basicChordDef.notes,
                    midiVelocities = basicChordDef.velocities,
                    len = midiNotes.length,
                    message,
                    bcoMoment = new Moment(msPosition),
                    i;

                if(basicChordDef.bank !== undefined && basicChordDef.bank !== channel.bank) // default is dont send a bank change
                {
                    message = new Message(CMD.CONTROL_CHANGE + channel, basicChordDef.bank, 0);
                    bcoMoment.messages.push(message);
                    // set patch to 0
                    message = new Message(CMD.PROGRAM_CHANGE + channel, 0, 0);
                    bcoMoment.messages.push(message);

                    channel.bank = basicChordDef.bank;
                    channel.patch = 0;
                }

                if(basicChordDef.patch !== undefined && basicChordDef.patch !== channel.patch) // default is dont send a patch change
                {
                    message = new Message(CMD.PROGRAM_CHANGE + channel, basicChordDef.patch, 0);
                    bcoMoment.messages.push(message);

                    channel.patch = basicChordDef.patch;
                }

                for (i = 0; i < len; ++i)
                {
                    message = new Message(CMD.NOTE_ON + channel, midiNotes[i], midiVelocities[i]);
                    bcoMoment.messages.push(message);
                }

                return bcoMoment;
            }

            function basicChordOffMoment(channel, basicChordDef, msPosition)
            {
                var notes = basicChordDef.notes,
                    len = notes.length,
                    velocity = 127,
                    bcoffMoment = new Moment(msPosition),
                    message,
                    i;

                for (i = 0; i < len; ++i)
                {
                    message = new Message(CMD.NOTE_OFF + channel, notes[i], velocity);
                    bcoffMoment.messages.push(message);
                }

                return bcoffMoment;
            }

            // uniqueNoteNumbers contains unique noteNumbers that need to be sent a noteOff,
            function chordOffMoment(channel, uniqueNoteNumbers, msPosition)
            {
                var nnIndex, noteNumber,
                    velocity = 127,
                    cOffMoment = new Moment(msPosition),
                    message;

                for (nnIndex = 0; nnIndex < uniqueNoteNumbers.length; ++nnIndex)
                {
                    noteNumber = uniqueNoteNumbers[nnIndex];
                    message = new Message(CMD.NOTE_OFF + channel, noteNumber.valueOf(), velocity);
                    cOffMoment.messages.push(message);
                }

                return cOffMoment;
            }

            // initial AttributesMoment
            currentMoment = attributesMoment(channel, chordDef, msPos);
            if (currentMoment !== undefined)
            {
                chordMoments.push(currentMoment);
            }

            // timeObject.msDuration has already been corrected for speed
            basicChordMsDurations = bcMsDurations(chordDef.basicChordsArray, timeObject.msDuration);

            // BasicChordMoments
            for (i = 0; i < len; i++)
            {
                basicChordDef = chordDef.basicChordsArray[i];

                if ((chordDef.attributes.hasChordOff === undefined || chordDef.attributes.hasChordOff === true)
                    && basicChordDef.hasChordOff === false)
                {
                    notes = basicChordDef.notes;
                    notesLength = notes.length;
                    for (j = 0; j < notesLength; ++j)
                    {
                        noteNumber = notes[j];
                        if(endOfChordNoteOffs.indexOf(noteNumber) === -1)
                        {
                            endOfChordNoteOffs.push(noteNumber);
                        }
                        // endOfChordNoteOffs contains unique noteNumbers.
                        // These are sent noteOffs at the end of the ornament.
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

            if ((chordDef.attributes.hasChordOff === undefined || chordDef.attributes.hasChordOff === true)
            &&   endOfChordNoteOffs.length > 0 )
            {
                // final ChordOff
                moment = chordOffMoment(channel, endOfChordNoteOffs, msPos);
                currentMoment.mergeMoment(moment);
            }

            return chordMoments;
        }

        // An array of moments whose msPosition has been set.
        // Each moment contains slider messages for each of the defined sliders.
        // These moments always happen at a rate defined by sliderMilliseconds.
        // 50ms is the default, but other values are possible.
        // None of the returned sliderMoments has 0 messages.
        // This function is only called if sliders are defined, so the length of the returned array
        // can either be 1 (i.e. none of the sliders' values changes during this MIDIChord)
        // or a value calculated from SLIDER_MILLISECONDS and msDuration. In the latter case, the
        // msPosition of the final sliderMoment is less than (msPosition + msDuration).
        function getSliderMoments(channel, sliders, msPosition, msDuration, sliderMilliseconds)
        {
            var i, sliderMoments, nonEmptySliderMoments;

            function getEmptySliderMoments(msPosition, msDuration, sliderMilliseconds)
            {
                var moments = [],
                    numberOfMoments = Math.floor(Number(msDuration) / sliderMilliseconds),
                    momentFloatDuration = 0,
                    msFloatDuration = Number(msDuration),
                    currentIntPosition = Number(msPosition),
                    currentFloatPosition = Number(currentIntPosition),
                    moment,
                    i;

                if (numberOfMoments === 0)
                {
                    numberOfMoments = 1;
                }

                momentFloatDuration = msFloatDuration / numberOfMoments; // momentFloatDuration is a float
                for (i = 0; i < numberOfMoments; i++)
                {
                    moment = new Moment(currentIntPosition);
                    moments.push(moment);
                    currentFloatPosition += momentFloatDuration;
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
                        moment, value,
                        previousValue = -1,
                        message, i;

                    if (sliderMoments.length !== finalValuesArray.length)
                    {
                        throw "Unequal array lengths.";
                    }
                    for (i = 0; i < len; i++)
                    {
                        moment = sliderMoments[i];
                        value = finalValuesArray[i];
                        if (value !== previousValue) // repeating messages are not sent
                        {
                            previousValue = value;
                            switch (typeString)
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

            nonEmptySliderMoments = [];
            for (i = 0; i < sliderMoments.length; ++i)
            {
                if (sliderMoments[i].messages.length > 0)
                {
                    nonEmptySliderMoments.push(sliderMoments[i]);
                }
            }
            return nonEmptySliderMoments;
        }

        // returns  a single, ordered array of moments
        // If chordMoment.msPositionInScore === sliderMoment.msPositionInScore,
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

        chordMoments = getChordMoments(channel, chordDef, timeObject);

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

    // returns an array containing a single empty moment having a "chordStart" attribute.
    // The moment's messages array is empty.
    MIDIChord.prototype.getSilentMoment = function(timeObject)
    {
        var silentMoment;

        silentMoment = new Moment(timeObject.msPosition);
        Object.defineProperty(silentMoment, "chordStart", { value: true, writable: false });

        moments = [];
        moments.push(silentMoment); // an empty chordStart moment.

        return moments;
    };

    // returns an array containing a single empty moment having a "restStart" attribute.
    // The moment's messages array is empty.
    MIDIRest.prototype.getMoments = function(timeObject)
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
