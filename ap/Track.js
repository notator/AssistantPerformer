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
 *
 *      The following attributes should not need to be used by track's clients:
 *          fromIndex
 *          _currentMidiObjectIndex
 *      
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
        this.fromIndex = -1; // the fromIndex in this track's midiObjects array
        this._currentMidiObjectIndex = -1; // the current index in this track's midiObjects array
        this.currentMidiObject = null; // The MidiChord or MidiRest currently being played by this track.
        this.currentMoment = null; // the moment which is about to be played by the currentMidiObject.
    },

    publicTrackAPI =
    {
        // creates an empty track
        Track: Track
    };
    // end var

    // Simple helper function that returns the endMsPosition of the final midiObject in the track.
    // (Often used to find the msPosition of the final barline).
    Track.prototype.endMsPosition = function()
    {
        var lastMidiObject = this.midiObjects[this.midiObjects.length - 1],
            endPos = lastMidiObject.msPositionInScore + lastMidiObject.msDurationInScore;

        return endPos;
    };

    // Sets track._currentMidiObjectIndex, track.currentMidiObject and track.currentMoment.
    // track._currentMidiObjectIndex is the index of track.currentMidiObject, which is either
    // the last midiObject before or at the startMarker, or the last midiObject in the track.
    // If the track has a rest at the startMarker, this.currentMoment.messages can be empty. 
    // If the track has no midiObjects at the startMarker, and the previous midiObject is a rest,
    // this.currentMoment.messages will be empty.
    Track.prototype.setToFirstStartMarker = function(startMarkerMsPositionInScore)
    {
        var i, moIndex, midiObject, nMidiObjects = this.midiObjects.length;

        for(i = 0; i < nMidiObjects; ++i)
        {
            if(this.midiObjects[i].msPositionInScore > startMarkerMsPositionInScore)
            {
                break;
            }
            moIndex = i;
        }

        this._currentMidiObjectIndex = moIndex;

        // moIndex is now either the index of the last midiObject before or at startMarkerMsPositionInScore
        // or the index of the last midiObject in the track.
        midiObject = this.midiObjects[moIndex];
        midiObject.setToFirstStartMarker(startMarkerMsPositionInScore);
        this.currentMidiObject = midiObject;
        this.currentMoment = midiObject.currentMoment; // this.currentMoment.messages can be empty (see above)
    };

    // Advances the currentMidiObject if the next one is at msPosition. Stops repeating chords, if any.
    // Sets _currentMidiObjectIndex, currentMidiObject and currentMoment
    // Sets currentMidiObject and currentMoment to null when there are no more moments.
    Track.prototype.advanceCurrentMidiObjectIfTheNextOneIsAtMsPosition = function(msPosition)
    {
        var
        nextIndex = this._currentMidiObjectIndex + 1;

        if(nextIndex === this.midiObjects.length)
        {
            this._currentMidiObjectIndex++;
            this.currentMidiObject = null;
            this.currentMoment = null;
        }
        else if(this.midiObjects[nextIndex].msPositionInChord === msPosition)
        {
            this._currentMidiObjectIndex = nextIndex;
            this.currentMidiObject = this.midiObjects[nextIndex];
            this.currentMoment = this.currentMidiObject.currentMoment;
        }
        // else do nothing
    };

    // Returns Number.MAX_VALUE at end of track.
    Track.prototype.currentMsPosition = function()
    {
        var msPos;
        if(this.currentMidiObject !== null)
        {
            msPos = this.currentMidiObject.msPositionInScore + this.currentMoment.msPositionInChord;
        }
        else
        {
            return Number.MAX_VALUE; // end of track
        }
        return msPos;
    };

    // Track.currentMoment is moved to the next moment in the currentMidiObject (ignoring the midiObject's repeat attribute).
    // If the end of the currentMidiObect.moments is reached, the currentMidiObject is advanced.
    // Both track.currentMidiObject and track.currentMoment are null at the end of the track, but non-null otherwise.
    Track.prototype.advanceCurrentMoment = function()
    {
        var nextMoIndex;

        // advanceCurrentMoment() updates the currentMidiObject's internal moment index, ignoring its repeat setting,
        // and sets currentMidiObject.currentMoment to null if out of range.
        this.currentMoment = this.currentMidiObject.advanceCurrentMoment();
        if(this.currentMoment === null)
        {
            this._currentMidiObjectIndex++;
            if(this._currentMidiObjectIndex < this.midiObjects.length)
            {
                this.currentMidiObject = this.midiObjects[this._currentMidiObjectIndex];
                this.currentMoment = this.currentMidiObject.currentMoment;  // is non-null and has zero or more messages
            }
            else // end of track
            {
                this.currentMidiObject = null;
                this.currentMoment = null;
            }
        }
    };

    return publicTrackAPI;

}());
