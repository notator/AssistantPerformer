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
 *                          // If moment.timestamp is UNDEFINED_TIMESTAMP,
 *                          // moment.msPositionInScore is used instead.
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
    Moment = MIDILib.moment.Moment,

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

    // A moment can only be appended to the end of the Track.
    // Note that the value of moment.timestamp is not used in this function.
    Track.prototype.addMoment = function (moment)
    {
        var 
        moments = this.moments,
        msPositionInScore, oldMoment;

        msPositionInScore = moment.msPositionInScore;

        if (moments.length === 0 || msPositionInScore > moments[moments.length-1].msPositionInScore)
        {
            moments.push(moment); // can be a rest, containing one 'empty message'
        }
        else if (msPositionInScore === moments[moments.length - 1].msPositionInScore)
        {
            oldMoment = moments[moments.length - 1];
            oldMoment.mergeMoment(moment);
        }
        else
        {
            throw "Error: A moment can only be appended to the end of a track.";
        }
    };

    return publicTrackAPI;

} ());
