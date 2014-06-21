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
 *          toIndex
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
        this.toIndex = -1; // the toIndex in this track's midiObjects array. This object is never played.
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

    // Sets track._currentMidiObjectIndex, track.currentMidiObject and track.currentMoment
    // (The last midiObject to be played is at toIndex-1.)
    Track.prototype.runtimeInit = function(fromIndex, toIndex)
    {
        var index;

        for(index = fromIndex; index < toIndex; ++index)
        {
            this.midiObjects[index].runtimeInit();
        }

        this._currentMidiObjectIndex = this.fromIndex;
        this.currentMidiObject = this.midiObjects[this._currentMidiObjectIndex];
        this.currentMoment = this.currentMidiObject.currentMoment; // has zero or messages
    };

    // This function is called when the running scoreMsPosition changes.
    // It advances track.currentMidiObject if there is a following MidiObject at scoreMsPosition
    // Otherwise it does nothing.    
    Track.prototype.advanceMidiObject = function(scoreMsPosition)
    {
        var nextIndex;
        if(this._currentMidiObjectIndex < this.toIndex - 1)
        {
            nextIndex = this._currentMidiObjectIndex + 1;
            if(this.midiObjects[nextIndex].msPositionInScore === scoreMsPosition)
            {
                this._currentMidiObjectIndex++;
                this.currentMidiObject = this.midiObjects[this._currentMidiObjectIndex];
                this.currentMoment = this.currentMidiObject.currentMoment;  // has zero or messages
            }
        }
    };

    // Calls this.currentMidiObject.advanceMoment(), then sets this.currentMoment
    // to this.currentMidiObject.currentMoment, which is either null or has messages
    // This function does not advance track.currentMidiObject.
    Track.prototype.advanceMoment = function()
    {
        if(this._currentMidiObjectIndex === -1)
        {
            throw "this.currentMidiObject must have been initialised!";
        }

        if(this.currentMidiObject !== null) // is null when there are no more midiObjects
        {
            this.currentMidiObject.advanceMoment();
            this.currentMoment = this.currentMidiObject.currentMoment;
            // this.currentMoment can either be null if it is beyond the end of a non-repeating chord or rest,
            // or can be non-null with a messages attribute if the currentMidiObject is a chord.
        }
    };

    // Throws an exception if either currentMidiObject or currentMoment are null.
    Track.prototype.currentMsPosition = function()
    {
        var msPos;
        if(this.currentMidiObject !== null && this.currentMoment !== null)
        {
            msPos = this.currentMidiObject.msPositionInScore + this.currentMoment.msPositionInChord;
        }
        else
        {
            throw "Error: this function should never be called when either currentMidiObject or currentMoment are null.";
        }
        return msPos;
    };

    // track.currentMoment is moved to the next moment in the track.
    // If necessary, track.currentMidiObject is updated as well.
    // Both track.currentMidiObject and track.currentMoment are null at the end of the track,
    // but non-null otherwise.
    // This function is used in sequence.finishSpanSilently().
    Track.prototype.advanceCurrentMoment = function()
    {
        var nextMoment;

        // Updates the currentMidiObject's internal moment index, ignoring its repeat setting.
        // Sets currentMidiObject.currentMoment to null if out of range.
        this.currentMidiObject.advanceCurrentMoment(); 

        nextMoment = this.currentMidiObject.currentMoment;
        if(nextMoment !== null)
        {
            this.currentMoment = nextMoment;
        }
        else
        {
            this._currentMidiObjectIndex++;
            if(this._currentMidiObjectIndex < this.midiObjects.length)
            {
                this.currentMidiObject = this.midiObjects[this._currentMidiObjectIndex];
                this.currentMoment = this.currentMidiObject.currentMoment;  // is non-null and has zero or more messages
            }
            else
            {
                this.currentMidiObject = null;
                this.currentMoment = null;
            }
        }
    };

    return publicTrackAPI;

}());
