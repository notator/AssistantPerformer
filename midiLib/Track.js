/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  midiLib/Track.js
 *  The MIDILib.track namespace which defines the
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

MIDILib.namespace('MIDILib.track');

MIDILib.track = (function ()
{
    "use strict";
    var
    // An empty track is created. It contains an empty midiObjects array.
    Track = function ()
    {
        if (!(this instanceof Track))
        {
            return new Track();
        }

        this.midiObjects = []; // a temporally sorted array of MidiChords and MidiRests
        this.fromIndex = -1; // the fromIndex in this track's midiObjects array
        this._currentMidiObjectIndex = -1; // the current index in this track's midiObjects array
        this.toIndex = -1; // the toIndex in this track's midiObjects array. This object is never played.
        this.currentMidiObject = null; // The MidiChord or MidiRest currently being played by this track.
        this.currentMoment = null; // the moment which is about to be played by the currentMidiObject.
        this._nextMidiObject = null; // The MidiChord or MidiRest following this.currentMidiObject in this track.
    },

    publicTrackAPI =
    {
        // creates an empty track
        Track: Track
    };
    // end var

    // Sets track._currentMidiObjectIndex, track.currentMidiObject, track.currentMoment and track._nextMidiObject
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
        this.currentMoment = this.currentMidiObject.currentMoment; // is either null or has messages
        if(this._currentMidiObjectIndex < this.toIndex - 1)
        {
            this._nextMidiObject = this.midiObjects[this._currentMidiObjectIndex + 1];
        }
        else
        {
            this._nextMidiObject = null;
        }
    };

    // This function is called when the running scoreMsPosition changes.
    // It does nothing, if:
    //      this._nextMidiObject === null (there are no more midiObjects to play) or
    //      this._nextMidiObject.msPositionInScore !== scoreMsPosition.
    // Otherwise it sets track._currentMidiObjectIndex, track.currentMidiObject, track.currentMoment and track._nextMidiObject
    Track.prototype.advanceMidiObject = function(scoreMsPosition)
    {
        if(this._nextMidiObject !== null && this._nextMidiObject.msPositionInScore === scoreMsPosition)
        {
            this.currentMidiObject = this._nextMidiObject;
            this.currentMoment = this.currentMidiObject.currentMoment; // can be null if currentMidiObject is an empty rest

            this._currentMidiObjectIndex++;
            if(this._currentMidiObjectIndex < this.toIndex - 1)
            {
                this._nextMidiObject = this.midiObjects[this._currentMidiObjectIndex + 1];
            }
            else
            {
                this._nextMidiObject = null;
            }
        }
    };

    // Calls this.currentMidiObject.advanceMoment(), then sets this.currentMoment
    // to this.currentMidiObject.currentMoment, which is either null or has messages  
    Track.prototype.advanceMoment = function()
    {
        if(this._currentMidiObjectIndex === -1)
        {
            throw "this.currentMidiObject must have been initialised!";
        }

        if(this.currentMidiObject !== null) // is null when there are no more midiObjects
        {
            this.currentMidiObject.advanceMoment();
            this.currentMoment = this.currentMidiObject.currentMoment; // is either null or has messages
        }
    };

    return publicTrackAPI;

}());
