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
        // *** this.worker = new WebWorker(TrackWebWorker.js);
    },

    publicTrackAPI =
    {
        // creates an empty track
        Track: Track
    };
    // end var

    
    // Sets track.currentIndex, track.currentMidiObject and track.nextMoment
    // such that track.nextMoment is the first non-empty moment in or after after the midiObject at fromIndex.
    // The last midiObject to be played is at toIndex-1.
    Track.prototype._setFirstNextMoment = function(fromIndex, toIndex)
    {
        var
        index, midiObject;

        this.currentIndex = -1;
        for(index = fromIndex; index < toIndex; ++index)
        {
            midiObject = this.midiObjects[index];
            if(midiObject.moments[0].messages.length > 0)
            {
                this.currentIndex = index;
                this.currentMidiObject = midiObject;
                this.nextMoment = midiObject.moments[0];

                break;
            }
        }
        if(this.currentIndex === -1)
        {
            throw "Error: This track.isPerforming should have been set to false.";
        }
    };

    Track.prototype.init = function(fromIndex, toIndex)
    {
        var index;

        this._setFirstNextMoment(fromIndex, toIndex);

        for(index = fromIndex; index < toIndex; ++index)
        {
            this.midiObjects[index].getFirstMoment();
        }
    };

    // Sets this.nextMoment to the result of calling this.currentMidiObject.advanceNextMoment().
    // If this.currentMidiObject.advanceNextMoment() sets currentMidiObject.nextMoment to null,
    // this.currentMidiObject is updated by calling this._getNextMidiObject().
    // Both track.nextMoment and track.currentMidiObject are null if there are no more moments in the track.
    // Otherwise, both are non-null.
    Track.prototype.advanceNextMoment = function()
    {
        if(this.currentIndex === -1)
        {
            throw "this.currentMidiObject must have been initialised!";
        }

        if(this.nextMoment !== null) // is null when there are no more midiObjects
        {
            // midiObject.advanceNextMoment() sets midiObject.nextMoment to the midiObject's next non-empty moment, updates indices etc...
            // If the midiObject's moments repeat, this function never sets midiObject.nextMoment to null.
            // The function sets midiObject.nextMoment to null after returning all the non-repeated moments.
            // MidiRests never repeat their single moment (which is returned by getFirstMoment()),
            // so MIDIRest.advanceNextMoment() always sets midiObject.nextMoment to null.
            this.currentMidiObject.advanceNextMoment();

            if(this.currentMidiObject.nextMoment === null || this.currentMidiObject.nextMoment.messages.length === 0)
            {
                this._getNextMidiObject();
            }
            else
            {
                this.nextMoment = this.currentMidiObject.nextMoment;
            }
        }
    };

    // Sets both the this.currentMidiObject and this.nextMoment attributes.
    // this.currentMidiObject is the MidiChord or MidiRest containing the next non-empty moment in this track.
    // this.nextMoment is set to the first moment in this.currentMidiObject. This moment contains at least one MIDI message.
    // If there are no more moments to play, both this.currentMidiObject and this.nextMoment are set to null. 
    Track.prototype._getNextMidiObject = function()
    {
        var midiObject = null, firstMoment = null;

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
            this.currentIndex = this.fromIndex - 1;
        }

        while(this.currentIndex < this.toIndex)
        {
            this.currentIndex++;
            if(this.currentIndex === this.toIndex)
            {
                break;
            }
            midiObject = this.midiObjects[this.currentIndex];
            firstMoment = midiObject.getFirstMoment(); // sets midiObject.nextMoment to the midiObject's first moment, initialises indices etc...
            if(firstMoment !== null)
            {
                break;
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


    // If necessary, updates track.nextMoment (and track.currentMidiObject),
    // so that track.currentMidiObject.msPositionInScore is greater than or equal to the current msPosition re the score.
    // returns null if there are no more moments in the track.
    Track.prototype.nextMomentPositionInScore = function(scoreMsPosition)
    {
        var nextMomentMsPositionInScore = null;

        // Both this.nextMoment and this.currentMidiObject are null if there are no more moments in the track.
        // Otherwise, both are non-null.
        if(this.nextMoment !== null)
        {
            if(this.currentMidiObject === null)
            {
                throw "Error: that should be impossible.";
            }

            nextMomentMsPositionInScore = this.currentMidiObject.msPositionInScore + this.nextMoment.msPositionInChord;

            console.log("1 scoreMsPosition=" + scoreMsPosition + "  currentMidiObject.msPositionInScore=" + this.currentMidiObject.msPositionInScore + "  nextMomentMsPositionInScore=" + nextMomentMsPositionInScore);

            while(this.nextMoment !== null && this.currentMidiObject.msPositionInScore < scoreMsPosition && nextMomentMsPositionInScore >= scoreMsPosition)
            {
                console.log("**** Advancing MidiObject.");
                this._getNextMidiObject();
                if(this.nextMoment === null)
                {
                    nextMomentMsPositionInScore = null;
                    console.log("End of Track.");
                }
                else
                {
                    if(this.currentMidiObject === null)
                    {
                        throw "Error: that should be impossible.";
                    }

                    nextMomentMsPositionInScore = this.currentMidiObject.msPositionInScore + this.nextMoment.msPositionInChord;
                    console.log("2 scoreMsPosition=" + scoreMsPosition + "  currentMidiObject.msPositionInScore=" + this.currentMidiObject.msPositionInScore + "  nextMomentMsPositionInScore=" + nextMomentMsPositionInScore);
                }
            }
        }

        return nextMomentMsPositionInScore;
    };

    return publicTrackAPI;

}());
