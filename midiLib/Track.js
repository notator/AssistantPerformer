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
 *      moments             // a temporally sorted array of Moments
 *
 *      The following public attributes should not need to be used by this
 *      library's clients. They are used by Sequence while performing:
 *          fromIndex
 *          currentIndex
 *          toIndex
 *
 *      // functions (defined on the prototype):
 *
 *          // Adds a moment to the track.
 *          // Used when constructing a track from information in a file
 *          // (such as a score or standard MIDI file).
 *          addMoment(moment)   
 *          
 *          // Adds a moment to the track.
 *          // Used in Sequence.tick() to record a moment (originally in the
 *          // score) being played live by the Assistant.
 *          addLiveScoreMoment(moment)
 *          
 *          // Adds a moment to the track.
 *          // Used to record a moment (not originally in the score) containing
 *          // control information being added by the live performer.
 *          // Currently (1st March 2013), it is not possible to add noteOns
 *          // and/or noteOffs. That is something that could be developed...
 *          addLivePerformersControlMoment(moment)
 *      
 */

/*jslint bitwise: false, nomen: true, plusplus: true, white: true */

MIDILib.namespace('MIDILib.track');

MIDILib.track = (function ()
{
    "use strict";

    var
    UNDEFINED_TIMESTAMP = MIDILib.moment.UNDEFINED_TIMESTAMP,

    // An empty track is created. It contains an empty moments array.
    Track = function ()
    {
        if (!(this instanceof Track))
        {
            return new Track();
        }

        this.moments = []; // an array of Moments
        this.fromIndex = -1;
        this.currentIndex = -1;
        this.toIndex = -1;
    },

    // Add a moment to the end of this Track using the moment's (absolute) timestamp
    // field to determine whether or not to merge the moment with the current last
    // moment in the track.
    // Note that, contrary to Track.prototype.addMoment(), the newMoment is merged
    // with the current last moment if its timestamp is _less_than_or_equal_ to the
    // last moment's timestamp, and merging means _inserting_ the new messages
    // _before_ the current last moment's messages.
    // A new live moment's timestamp can be slightly unreliable with respect to
    // existing timestamps, owing to thread switching between the score playback and
    // the live performer. If the new messages are simply appended to the existing
    // messages, they can override already existing noteOffs, and notes begin to hang
    // in the recording (even though they may not in the live performance).
    _addLiveMoment = function (newMoment, moments)
    {
        var
        timestamp = newMoment.timestamp,
        lastMoment = moments[moments.length - 1],
        lastMomentTimestamp = lastMoment.timestamp;

        if (timestamp === UNDEFINED_TIMESTAMP || lastMomentTimestamp === UNDEFINED_TIMESTAMP)
        {
            throw "Error: timestamps must be defined here.";
        }

        if (timestamp > lastMomentTimestamp)
        {
            moments.push(newMoment); // can be a rest, containing one 'empty message'
        }
        else if (timestamp <= lastMomentTimestamp)
        {
            // See the comment above.
            lastMoment.messages = newMoment.messages.concat(lastMoment.messages);
        }
    },

    publicTrackAPI =
    {
        // creates an empty track
        Track: Track
    };
    // end var

    // Add a moment to the end of this Track using the moment's msPositionInScore
    // field to determine whether or not to merge the moment with the current last
    // moment in the track.
    // An exception is thrown if the new moment's msPositionInScore is
    // UNDEFINED_TIMESTAMP or less than that of the current last moment in the Track.
    Track.prototype.addMoment = function (moment)
    {
        var
        moments = this.moments,
        lastMoment = null,
        lastMomentMsPos,
        msPos = moment.msPositionInScore;

        if (msPos === UNDEFINED_TIMESTAMP)
        {
            throw "Error: msPositionInScore error.";
        }

        if (moments.length === 0)
        {
            moments.push(moment); // can be a rest, containing one 'empty message'
        }
        else
        {
            lastMoment = moments[moments.length - 1];
            lastMomentMsPos = lastMoment.msPositionInScore;

            if ((lastMomentMsPos === UNDEFINED_TIMESTAMP)
            || (msPos < lastMomentMsPos))
            {
                throw "Error: msPos error.";
            }

            if (msPos > lastMomentMsPos)
            {
                moments.push(moment); // can be a rest, containing one 'empty message'
            }
            else if (msPos === lastMomentMsPos)
            {
                lastMoment.mergeMoment(moment);
            }
        }
    };

    // Add a moment to the end of this Track using the moment's (absolute) timestamp
    // field to determine whether or not to merge the moment with the current last
    // moment in the track.
    // An exception is thrown if either the current last moment's or the new moment's
    // timestamp has the value UNDEFINED_TIMESTAMP.
    // This function defines and undefines an isInChord attribute for this track when
    // the moment argument has a .chordStart or .restStart attribute respectively.
    // .isInChord is used to decide whether or not to record controller information 
    // being created by a live performer. See addLivePerformersControlMoment() below.
    Track.prototype.addLiveScoreMoment = function (moment)
    {
        var moments = this.moments;

        if (moments.length === 0)
        {
            moments.push(moment); // can be a rest, containing one 'empty message'
        }
        else
        {
            _addLiveMoment(moment, moments);
        }

        if (moment.restStart !== undefined && this.isInChord !== undefined)
        {
            delete this.isInChord;
        }
        else if (moment.chordStart !== undefined)
        {
            this.isInChord = true;            
        }
    };

    // Add a moment to the end of this Track using the moment's (absolute) timestamp
    // field to determine whether or not to merge the moment with the current last
    // moment in the track.
    // This function should only be called if this track's .isInChord attribute is
    // defined. It therefore throws an exception if it is not.
    // An exception is also thrown if either the current last moment's or the new
    // moment's timestamp has the value UNDEFINED_TIMESTAMP.
    Track.prototype.addLivePerformersControlMoment = function (moment)
    {
        if (this.isInChord === undefined)
        {
            throw "Error: this.isInChord must be defined here.";
        }

        _addLiveMoment(moment, this.moments);
    };

    return publicTrackAPI;

} ());
