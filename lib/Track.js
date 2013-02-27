/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  jiTrack.js
 *  The MIDILib.track namespace which defines the
 *      Track() empty Track constructor.
 *
 *  Public Interface:
 *      moments             // an array of Moments
 *      addMoment(moment)   // Appends a Moment to the end of this Track.
 *
 *      The following attributes should not need to be used by clients of this
 *      library. They are used by Sequence while performing:
 *          fromIndex
 *          currentIndex
 *          toIndex
 */

/*jslint bitwise: false, nomen: false, plusplus: true, white: true */

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

    publicTrackAPI =
    {
        // creates an empty track
        Track: Track
    };
    // end var

    // Add a moment to the end of this Track using the moment's msPositionInScore
    // field to determine whether or not to merge the moment with the current last
    // moment in the track. Use addTypestampedMoment() to use the moment's (absolute)
    // timestamp instead.
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
    // moment in the track. (Use addMoment() to use msPositionInScore instead.)
    // An exception is thrown if either the current last moment's or the new moment's
    // timestamp has the value UNDEFINED_TIMESTAMP.
    // This function defines and undefines an isInChord attribute for this track
    // when the moment argument has a .chordStart or .restStart attribute respectively.
    // This.isInChord is used to decide whether or not to record controller
    // information being created by a live performer. See addLivePerformerMoment() below.
    Track.prototype.addLiveScoreMoment = function (moment)
    {
        var
        moments = this.moments,
        lastMoment = null,
        lastMomentTimestamp,
        timestamp = moment.timestamp;

        if (timestamp === UNDEFINED_TIMESTAMP)
        {
            throw "Error: timestamp error.";
        }

        if (moments.length === 0)
        {
            moments.push(moment); // can be a rest, containing one 'empty message'
        }
        else
        {
            lastMoment = moments[moments.length - 1];
            lastMomentTimestamp = lastMoment.timestamp;

            if (lastMomentTimestamp === UNDEFINED_TIMESTAMP || timestamp < lastMomentTimestamp)
            {
                throw "Error: timestamp error.";
            }

            if (timestamp > lastMomentTimestamp)
            {
                moments.push(moment); // can be a rest, containing one 'empty message'
            }
            else if (timestamp === lastMomentTimestamp)
            { 
                lastMoment.mergeTimestampedMoment(moment);
            }
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
    // An exception is thrown if either the current last moment's or the new moment's
    // has the value UNDEFINED_TIMESTAMP.
    Track.prototype.addLivePerformersControlMoment = function (moment)
    {
        var
        moments = this.moments,
        lastMoment = null,
        lastMomentTimestamp,
        timestamp = moment.timestamp;

        if (this.isInChord === undefined)
        {
            throw "Error: this.isInChord must be defined here.";
        }

        if (timestamp === UNDEFINED_TIMESTAMP)
        {
            throw "Error: timestamp error.";
        }

        lastMoment = moments[moments.length - 1];
        lastMomentTimestamp = lastMoment.timestamp;

        if (lastMomentTimestamp === UNDEFINED_TIMESTAMP)
        {
            throw "Error: timestamp error.";
        }

        if (timestamp > lastMomentTimestamp)
        {
            moments.push(moment); // can be a rest, containing one 'empty message'
        }
        else if (timestamp <= lastMomentTimestamp)
        {
            // <= because this is unpredictable in real-time performances.
            // Note that this behaviour is different from addMoment() and
            // addLiveScoreMoment() above.
            // This _inserts_ the new control messages before the messages
            // in the current last moment. Otherwise, if the current last
            // moment contains noteOffs, they seem to get disabled.
            moment.mergeTimestampedMoment(lastMoment);
            moments[moments.length - 1] = moment;
        }
    };

    return publicTrackAPI;

} ());
