/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  jiTrack.js
 *  The JI_NAMESPACE.sequence namespace which defines the
 *    Track() empty sequence constructor.
 *
 *  A Track has the following public interface:
 *       addMIDIMessage(midiMessage);
 *       addMIDIMoment(midiMoment, sequencePositionInScore) // see JI_NAMESPACE.midiMoment
 *       midiMoments // an array of midiMoments
 *       fromIndex // used while performing
 *       currentIndex // used while performing
 *       toIndex // used while performing
 *  
 */

JI_NAMESPACE.namespace('JI_NAMESPACE.track');

JI_NAMESPACE.track = (function ()
{
    "use strict";

    var 
    // An empty track is created. It contains an empty midiMoments array.
    Track = function ()
    {
        var midiMoments = [],
            fromIndex,
            currentIndex,
            toIndex,
            currentLastTimestamp = -1,

        // A midiMoment can only be appended to the end of the track. 
        addMIDIMoment = function (midiMoment, sequencePositionInScore)
        {
            var lastMoment, timestamp, msPositionInScore = -1, oldMoment;

            function subtractTime(midiMoment, subsequenceMsPositionInScore)
            {
                var i, nMessages = midiMoment.messages.length;

                midiMoment.timestamp -= subsequenceMsPositionInScore;
                for (i = 0; i < nMessages; ++i)
                {
                    midiMoment.messages[i].timestamp -= subsequenceMsPositionInScore;
                }
            }

            subtractTime(midiMoment, sequencePositionInScore);
            timestamp = midiMoment.timestamp;

            if (timestamp > currentLastTimestamp)
            {
                currentLastTimestamp = timestamp;
                midiMoments.push(midiMoment); // can be a rest, containing one 'empty midiMessage'
            }
            else if (timestamp === currentLastTimestamp)
            {
                oldMoment = midiMoments[midiMoments.length - 1];
                oldMoment.mergeMIDIMoment(midiMoment);
            }
            else
            {
                throw "Error: A midiMoment can only be appended to the end of a track.";
            }
        };

        if (!(this instanceof Track))
        {
            return new Track();
        }

        this.addMIDIMoment = addMIDIMoment;
        this.midiMoments = midiMoments;
        this.fromIndex = fromIndex;
        this.currentIndex = currentIndex;
        this.toIndex = toIndex;
    },

    publicAPI =
    {
        // creates an empty track
        Track: Track
    };
    // end var

    return publicAPI;

} ());
