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
 *      The following public attributes should not need to be used by this
 *      library's clients. They are used by Sequence while performing:
 *          fromIndex
 *          currentIndex
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
        this.currentIndex = -1; // the current index in this track's midiObjects array
        this.toIndex = -1; // the toIndex in this track's midiObjects array. This object is never played.
        this.currentMidiObject = null; // The MidiChord or MidiRest currently being played by this track.
        this.nextMoment = null; // the moment which is about to be played by the currentMidiObject.
    },

    publicTrackAPI =
    {
        // creates an empty track
        Track: Track
    };
    // end var

    // Sets both the this.currentMidiObject and this.nextMoment attributes.
    // this.currentMidiObject is the MidiChord or MidiRest containing the next non-empty moment in this track.
    // this.nextMoment is set to the first moment in this.currentMidiObject. This moment contains at least one MIDI message.
    // If there are no more moments to play, both this.currentMidiObject and this.nextMoment are set to null. 
    Track.prototype.getNextMidiObject = function()
    {
        var midiObject = null;

        if(this.fromIndex === -1 || this.toIndex === -1)
        {
            throw "this.fromIndex and this.toIndex must be set here!";
        }

        if(this.midiObjects.length < this.toIndex)
        {
            throw "Error: this.midiObjects.length < this.toIndex.";
        }

        if(this.currentIndex === -1)
        {
            this.currentIndex = this.fromIndex;
        }
        else
        {
            this.currentIndex++;
        }

        while(midiObject === null && this.currentIndex < this.toIndex)
        {
            midiObject = this.midiObjects[this.currentIndex];
            midiObject.getFirstMoment(); // sets midiObject.nextMoment to the midiObject's first moment, initialises indices etc...
            if(midiObject.nextMoment.messages.length === 0)
            {
                midiObject = null;
                this.currentIndex++;
            }
        }

        if(this.currentIndex < this.toIndex)
        {
            this.currentMidiObject = midiObject;
            this.nextMoment = this.currentMidiObject.nextMoment;
        }
        else
        {
            this.currentMidiObject = null;
            this.nextMoment = null;
        }
    };

    // Sets this.currentIndex, this.currentMidiObject and this.nextMoment
    // such that this.nextMoment is the first non-empty moment after (including) the midiObject at fromIndex.
    Track.prototype.setFirstNextMoment = function(fromIndex)
    {
        var
        index = fromIndex, midiObject;

        for(index = 0; index < this.midiObjects.length; ++index)
        {
            midiObject = this.midiObjects[index];
            if(midiObject.moments[0].messages.length > 0)
            {
                break;
            }
        }
        this.currentIndex = index;
        this.currentMidiObject = midiObject;
        this.nextMoment = this.currentMidiObject.moments[0];
    };

    // Sets this.nextMoment to the result of calling this.currentMidiObject.getNextMoment().
    // If this.currentMidiObject.getNextMoment() sets currentMidiObject.nextMoment to null,
    // this.currentMidiObject is updated by calling this.getNextMidiObject().

    // Both track.currentMidiObject and track.nextMoment are null if there are no more moments in the track.
    // Otherwise, both are non-null.
    Track.prototype.getNextMoment = function()
    {
        if(this.currentIndex === -1)
        {
            throw "this.currentMidiObject must have been initialised!";
        }

        if(this.currentMidiObject !== null) // is null when there are no more midiObjects
        {
            // midiObject.getNextMoment() sets midiObject.nextMoment to the midiObject's next non-empty moment, updates indices etc...
            // If the midiObject's moments repeat, this function never sets midiObject.nextMoment to null.
            // The function sets midiObject.nextMoment to null after returning all the non-repeated moments.
            // MidiRests never repeat their single moment (which is returned by getFirstMoment()),
            // so MIDIRest.getNextMoment() always sets midiObject.nextMoment to null.
            this.currentMidiObject.getNextMoment();

            if(this.currentMidiObject.nextMoment === null || this.currentMidiObject.nextMoment.messages.length === 0)
            {
                this.getNextMidiObject();
            }
            else
            {
                this.nextMoment = this.currentMidiObject.nextMoment;
            }
        }
    };

    return publicTrackAPI;

}());
