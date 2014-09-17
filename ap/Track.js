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
 *      currentMidiObject = null; // The MidiChord or MidiRest currently being played by this track.
 *      currentMoment = null; // the moment which is about to be played by the currentMidiObject.
 *
 *      The following attributes are "private" -- should not need to be used by track's clients:
 *          _currentMidiObjectIndex
 *          _indexOfLastPerformedMidiObjectInAssistedSpan
 *
 *  Public functions (defined in prototype)
 *      finalBarlineMsPosition()
 *      setForSpan(startMarkerMsPositionInScore, endMarkerMsPositionInScore, isAssisted)
 *      currentMsPosition()
 *      advanceCurrentMoment(inLoopPhase)
 *      isPlayingFinalAssistedMidiObjectInTheSpan()
 */

/*jslint bitwise: false, nomen: true, plusplus: true, white: true */
/*global _AP: false,  window: false,  performance: false, console: false */

_AP.namespace('_AP.track');

_AP.track = (function()
{
    "use strict";
    var
    // An empty track is created. It contains an empty midiObjects array.
    Track = function()
    {
        if(!(this instanceof Track))
        {
            return new Track();
        }

        this.midiObjects = []; // a temporally sorted array of MidiChords and MidiRests
        this.currentMidiObject = null; // The MidiChord or MidiRest currently being played by this track.
        this.currentMoment = null; // the moment which is about to be played by the currentMidiObject. 
        this._currentMidiObjectIndex = -1; // the current index in this track's midiObjects array
        this._indexOfLastPerformedMidiObjectInAssistedSpan = -1;
    },

    publicTrackAPI =
    {
        // creates an empty track
        Track: Track
    };
    // end var

    Track.prototype.finalBarlineMsPosition = function()
    {
        var lastMidiObject = this.midiObjects[this.midiObjects.length - 1],
            finalBarlineMsPos = lastMidiObject.msPositionInScore + lastMidiObject.msDurationInScore;

        return finalBarlineMsPos;
    };

    // Sets track._currentMidiObjectIndex, track.currentMidiObject and track.currentMoment.
    // track._currentMidiObjectIndex is the index of track.currentMidiObject, which is either
    // the last midiObject before or at the startMarker, or the last midiObject in the track.
    // If the track has a rest at the startMarker, this.currentMoment.messages can be empty. 
	// If the track has no midiObjects at the startMarker, and the previous midiObject is a rest
	// straddling the startMarker, the rest is adjusted to begin at the startMarker with a new,
	// empty moment. (this.currentMoment.messages will be then be empty).
    Track.prototype.setForSpan = function(startMarkerMsPositionInScore, endMarkerMsPositionInScore, isAssisted)
    {
        var i, moIndex, midiObject, midiObjects = this.midiObjects, nMidiObjects = midiObjects.length,
            lastPerformedIndex;

        for(i = 0; i < nMidiObjects; ++i)
        {
            if(midiObjects[i].msPositionInScore > startMarkerMsPositionInScore)
            {
                break;
            }
            moIndex = i;
        }

        this._currentMidiObjectIndex = moIndex;
        lastPerformedIndex = moIndex; // also updated below

        // moIndex is now either the index of the last midiObject before or at startMarkerMsPositionInScore
        // or the index of the last midiObject in the track.
        midiObject = midiObjects[moIndex];
        midiObject.setToFirstStartMarker(startMarkerMsPositionInScore);

        this.currentMidiObject = midiObject;
        this.currentMoment = midiObject.currentMoment; // this.currentMoment.messages can be empty (see above)

        for(i = moIndex + 1; i < nMidiObjects; ++i)
        {
            midiObject = midiObjects[i];
            if(midiObject.msPositionInScore < endMarkerMsPositionInScore)
            {
                midiObject.setToStartAtBeginning();
                lastPerformedIndex = i;
            }
            else
            {
                break;
            }
        }

        if(isAssisted === true)
        {
            this._indexOfLastPerformedMidiObjectInAssistedSpan = lastPerformedIndex;
        }
        else
        {
            this._indexOfLastPerformedMidiObjectInAssistedSpan = -1;
        }
    };

    // Returns Number.MAX_VALUE at end of track.
    Track.prototype.currentMsPosition = function()
    {
        var msPos,
            cmObj = this.currentMidiObject,
            cMom = this.currentMoment;

        if(cmObj !== null)
        {
            console.assert(cMom !== null, "CurrentMoment should never be null here.");
            if(cmObj.msDurationOfRepeats !== undefined)
            {
                // a chord
                msPos = cmObj.msPositionInScore + cmObj.msDurationOfRepeats + cMom.msPositionInChord;
            }
            else
            {
                // a rest
                msPos = cmObj.msPositionInScore;
            }
        }
        else
        {
            return Number.MAX_VALUE; // end of track
        }
        return msPos;
    };

    // If the inLoopPhase argument is undefined or false, or currentMidiChord._repeat is false, the currentMidiChord will not repeat, and
    // track.currentMidiChord will be advanced when necessary. This is as if the track contained a single, flat sequence of moments.
    // If both inLoopPhase and currentMidiChord._repeat are true, currentMoment will cycle through the currentMidiChord's moments, and
    // never be set to null. In this case, this.currentMidiObject will not be advanced by this function.
    Track.prototype.advanceCurrentMoment = function(inLoopPhase)
    {
        var currentIndex;

        this.currentMoment = this.currentMidiObject.advanceCurrentMoment(inLoopPhase);

        if(this.currentMoment === null)
        {
            this._currentMidiObjectIndex++;
            currentIndex = this._currentMidiObjectIndex;
            if(currentIndex < this.midiObjects.length)
            {
                this.currentMidiObject = this.midiObjects[currentIndex];
                this.currentMoment = this.currentMidiObject.currentMoment;  // is non-null and has zero or more messages
            }
            else
            if((this._indexOfLastPerformedMidiObjectInAssistedSpan < 0) // end of track
            || (currentIndex > this._indexOfLastPerformedMidiObjectInAssistedSpan))
            {
                this.currentMidiObject = null;
                this.currentMoment = null;
            }
        }
    };

    Track.prototype.isPlayingFinalAssistedMidiObjectInTheSpan = function()
    {
        var rval = false, currentIndex = this._currentMidiObjectIndex;
        if(currentIndex > this._indexOfLastPerformedMidiObjectInAssistedSpan)
        {
            // this.currentMidiObject can be greater than _indexOfLastPerformedMidiObjectInAssistedSpan
            // at the end of a span if the final object was a rest or non-repeating chord.
            rval = true;
        }
        else
        if((currentIndex === this._indexOfLastPerformedMidiObjectInAssistedSpan)
        && (this.currentMoment.msPositionInChord > 0 || this.currentMidiObject.msDurationOfRepeats > 0))
        {
            rval = true;
        }

        return rval;
    };

    return publicTrackAPI;

}());
