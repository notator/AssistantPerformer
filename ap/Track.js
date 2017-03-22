/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/Track.js
 *  The _AP.track namespace which defines the
 *      Track() empty Track constructor.
 *
 *  Public Interface:
 *      midiObjects // a temporally sorted array of MidiChords and midiRests
 *      _currentMidiObject = null; // The MidiChord or MidiRest currently being played by this track.
 *      currentMoment = null; // the moment which is about to be played by the _currentMidiObject (which must be a midiObject).
 *
 *      The following attributes are "private" -- should not need to be used by track's clients:
 *          _currentMidiObjectIndex
 *          _indexOfLastPerformedMidiObjectInAssistedSpan
 *
 *  Public functions (defined in prototype)
 *      finalBarlineMsPosition()
 *      setForSpan(startMarkerMsPositionInScore, endMarkerMsPositionInScore)
 *      currentMsPosition()
 *      advanceCurrentMoment()
 */

/*jslint white:true */
/*global _AP,  window,  document */

_AP.namespace('_AP.track');

_AP.track = (function()
{
    "use strict";
    var
    // An empty track is created.
    Track = function()
    {
        if(!(this instanceof Track))
        {
            return new Track();
        }

        // The MidiChord or MidiRest currently being played by this track.
        Object.defineProperty(this, "_currentMidiObject", { value: null, writable: true });
        // The moment which is about to be played by the _currentMidiObject (if it is a MidiChord or MidiRest).
        Object.defineProperty(this, "currentMoment", { value: null, writable: true });
        // The current index in this track's midiObjects or inputObjects array
        Object.defineProperty(this, "_currentMidiObjectIndex", { value: -1, writable: true });
        // The messages that should be sent to set up the track's state when a performance starts.
        Object.defineProperty(this, "startStateMessages", { value: [], writable: true });
    },

    publicTrackAPI =
    {
        // creates an empty track
        Track: Track
    };
    // end var

    Track.prototype.finalBarlineMsPosition = function()
    {
        var lastMidiObject, finalBarlineMsPos;

        if(this.midiObjects === undefined)
        {
            throw "Can't get finalBarlineMsPosition!";
        }

        lastMidiObject = this.midiObjects[this.midiObjects.length - 1];
        finalBarlineMsPos = lastMidiObject.msPositionInScore + lastMidiObject.msDurationInScore;

        return finalBarlineMsPos;
    };

    // Sets track._currentMidiObjectIndex and track._currentMidiObject:
    // track._currentMidiObjectIndex is the index of track._currentMidiObject, which is the first
    // InputChord or InputRest at or after the startMarkerMsPositionInScore.
    // Also sets track.currentMoment to null (track.currentMoment is always null, and ignored in inputTracks) 
    Track.prototype.setForInputSpan = function(startMarkerMsPositionInScore)
    {
        var i, index, inputObjects, nTimeObjects;

        if(this.inputObjects === undefined)
        {
            throw "Can't set InputSpan for output track!";
        }

        inputObjects = this.inputObjects;
        nTimeObjects = inputObjects.length;

        for(i = 0; i < nTimeObjects; ++i)
        {
            index = i;
            // find the index of the first inputChord or inputRest at or after startMarkerMsPositionInScore
            if(inputObjects[i].msPositionInScore >= startMarkerMsPositionInScore)
            {
                break;
            }
        }

        this._currentMidiObjectIndex = index;
        this._currentMidiObject = inputObjects[index];
        this.currentMoment = null; // always null for inputChords and inputRests
    };

    // Sets track._currentMidiObjectIndex, track._currentMidiObject and track.currentMoment.
    // If a MidiChord starts at or straddles the startMarker, it becomes the track._currentMidiObject, and
    // track.currentMoment is set to the its first moment at or after the startMarker.
    // If a MidiRest begins at the startMarker, it becomes the track._currentMidiObject, and
    // track.currentMoment is set to its (only) moment (which may be empty).
    // If a MidiRest straddles the startMarker, track._currentMidiObject is set to the following MidiChord, and
    // track.currentMoment is set to the its first moment.
    // track._currentMidiObjectIndex is the index of the track._currentMidiObject, in track.midiObjects. 
    Track.prototype.setForOutputSpan = function(startMarkerMsPositionInScore, endMarkerMsPositionInScore)
    {
        var i, index, midiObject, midiObjects, midiChord, midiRest, nMidiObjects,
            MidiChord = _AP.midiObject.MidiChord;

        function getStartStateMessages(that)
        {
            var
            finished = false,
            i, midiObjects = that.midiObjects, nMidiObjects = midiObjects.length,
            j, moment, moments, nMoments,
            k, msgs, nMsgs,
            msg,
            AFTERTOUCH = _AP.constants.COMMAND.AFTERTOUCH,
            CONTROL_CHANGE = _AP.constants.COMMAND.CONTROL_CHANGE,
            PROGRAM_CHANGE = _AP.constants.COMMAND.PROGRAM_CHANGE,
            CHANNEL_PRESSURE = _AP.constants.COMMAND.CHANNEL_PRESSURE,
            PITCH_WHEEL = _AP.constants.COMMAND.PITCH_WHEEL,
            aftertouchSM, programChangeSM, channelPressureSM, pitchWheelSM,
            stateMsgs = [], msgIndex;

            function findControlMessage(controlChangeSMs, controlType)
            {
                var returnIndex = -1, i, nControlChangeSMs = controlChangeSMs.length;
                for(i = 0; i < nControlChangeSMs; ++i)
                {
                    if(controlChangeSMs[i].data[1] === controlType)
                    {
                        returnIndex = i;
                        break;
                    }
                }
                return returnIndex;                
            }

            if(that.currentMoment === null)
            {
                throw "Track.getStartStateMessages(): track.currentMoment cannot be null here!";
            }

            for(i = 0; i < nMidiObjects && finished === false; ++i)
            {
                moments = midiObjects[i].moments;
                nMoments = moments.length;
                for(j=0; j < nMoments; ++j)
                {
                    moment = moments[j];
                    if(moment === that.currentMoment)
                    {
                        finished = true;
                        break;
                    }
                    msgs = moment.messages;
                    nMsgs = msgs.length;
                    for(k= 0; k < nMsgs; ++k)
                    {
                        msg = msgs[k];
                        switch(msg.data[0] & 0xF0)
                        {
                            case AFTERTOUCH:
                                aftertouchSM = msg;
                                break;
                            case CONTROL_CHANGE:
                                msgIndex = findControlMessage(stateMsgs, msg.data[1]);
                                if(msgIndex === -1)
                                {
                                    stateMsgs.push(msg);                                    
                                }
                                else
                                {
                                    stateMsgs[msgIndex] = msg;
                                }
                                break;
                            case PROGRAM_CHANGE:
                                programChangeSM = msg;
                                break;
                            case CHANNEL_PRESSURE:
                                channelPressureSM = msg;
                                break;
                            case PITCH_WHEEL:
                                pitchWheelSM = msg;
                                break;
                        }
                    }
                }
            }

            if(aftertouchSM !== undefined)
            {
                stateMsgs.push(aftertouchSM);
            }
            if(programChangeSM !== undefined)
            {
                stateMsgs.push(programChangeSM);
            }
            if(channelPressureSM !== undefined)
            {
                stateMsgs.push(channelPressureSM);
            }
            if(pitchWheelSM !== undefined)
            {
                stateMsgs.push(pitchWheelSM);
            }

            return stateMsgs;
        }

        if(this.midiObjects === undefined)
        {
            throw "Can't set OutputSpan!";
        }

        midiObjects = this.midiObjects;
        nMidiObjects = midiObjects.length;

        for(i = 0; i < nMidiObjects; ++i)
        {
            index = i;
            // find the index of the MidiChord straddling or at the startMarkerMsPositionInScore,
            // or the index of the MidiChord that starts after the startMarkerMsPositionInScore
            // or the index of a MidiRest that starts at the startMarkerMsPositionInScore.
            if(midiObjects[i] instanceof MidiChord)
            {
                midiChord = midiObjects[i];
                if((midiChord.msPositionInScore <= startMarkerMsPositionInScore)
                && (midiChord.msPositionInScore + midiChord.msDurationInScore > startMarkerMsPositionInScore))
                {
                    // if the MidiChord is at or straddles the startMarkerMsPositionInScore
                    // set its moment pointers to startMarkerMsPositionInScore
                    // midiChord.currentMoment will be undefined if there are no moments at or after startMarkerMsPositionInScore.
                    midiChord.setToStartMarker(startMarkerMsPositionInScore);
                    if(midiChord.currentMoment !== undefined)
                    {
                        break;
                    }
                }

                if(midiChord.msPositionInScore > startMarkerMsPositionInScore)
                {
                    // a MidiRest straddles the startMarker. 
                    midiChord.setToStartAtBeginning();
                    break;
                }
            }
            else if(midiObjects[i].msPositionInScore === startMarkerMsPositionInScore)
            {
                midiRest = midiObjects[i];
                midiRest.setToStartAtBeginning();
                break;
            }
        }

        // Set all further MidiChords and MidiRests up to the endMarker to start at their beginnings.
        for(i = index + 1; i < nMidiObjects; ++i)
        {
            midiObject = midiObjects[i];

            if(midiObject.msPositionInScore >= endMarkerMsPositionInScore)
            {
                break;
            }

            midiObject.setToStartAtBeginning();
        }

        this._currentMidiObjectIndex = index;
        this._currentMidiObject = midiObjects[index];
        this.currentMoment = this._currentMidiObject.currentMoment;// a MidiChord or MidiRest
        this.currentMoment = (this.currentMoment === undefined) ? null : this.currentMoment;
        // this.currentMoment is the first moment that is going to be played in this track.
        // (If the performance is set to start inside a rest, this.currentMoment will be at a
        // position later than the startMarker.)
        // this.currentMoment will be null if there are no more moments to play in the track.
        // (i.e. if last midiObject in the track is a rest, and the performance is set to start
        // after its beginning.  
        if(this.currentMoment !== null)
        {
            // The returned array will be empty when the performance starts at the beginning of the score.
            this.startStateMessages = getStartStateMessages(this);
        }
    };

    // Returns Number.MAX_VALUE at end of track.
    Track.prototype.currentMsPosition = function()
    {
        var msPos = Number.MAX_VALUE,
            cmObj = this._currentMidiObject,
            cMom = this.currentMoment;

        if(cmObj !== null && cMom !== null)
        {
            msPos = cmObj.msPositionInScore + cMom.msPositionInChord;
        }

        return msPos;
    };

    Track.prototype.advanceCurrentMoment = function()
    {
        var currentIndex;

        if(this.midiObjects === undefined)
        {
            throw "Can't advance currentMoment!";
        }

        this.currentMoment = this._currentMidiObject.advanceCurrentMoment();

        // MidiRests, and MidiChords that have ended, return null.
        if(this.currentMoment === null)
        {
            this._currentMidiObjectIndex++;
            currentIndex = this._currentMidiObjectIndex;
            if(currentIndex < this.midiObjects.length)
            {
                this._currentMidiObject = this.midiObjects[currentIndex];
                this.currentMoment = this._currentMidiObject.currentMoment;  // is non-null and has zero or more messages
            }
            else
            {
                this._currentMidiObject = null;
                this.currentMoment = null;
            }
        }
    };

    return publicTrackAPI;

}());
